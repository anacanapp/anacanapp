import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the v3 Azerbaijani library from the published v2 bytes plus a
// hand-curated editorial word list. No translation/LLM service is involved:
// every added or promoted word is listed in az-editorial-v3.json. The pinned
// corpus list (same SHA as v1/v2) only supplies frequency values.
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (value, code) => { if (!value) throw new Error(code); };
assert(process.argv.slice(2).join(' ') === '--from-v2', 'USE_EXPAND_AZ_V3_FROM_V2');
const dataDir = join(root, 'src/components/games/word-garden/data');
const libraryPath = join(dataDir, 'az.json'), legacyPath = join(dataDir, 'az-v2.json');
const receiptPath = join(root, 'scripts/word-garden/az-import-receipt.json');
const legacyReceiptPath = join(root, 'scripts/word-garden/az-import-receipt-v2.json');
const V2_SHA = '4ee1a4ccd2dd8bc7753fe92096905a225605f56a599919d5b21e5e331da1cefb';
const exists = path => access(path).then(() => true, () => false);
async function preserve(path, destination, expected) {
  try { await copyFile(path, destination, constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  assert(hash(await readFile(destination)) === expected, 'WORD_GARDEN_LEGACY_LIBRARY_CONFLICT');
}
// Re-runs read the preserved v2 copy; the first run preserves it byte-for-byte.
const sourcePath = await exists(legacyPath) ? legacyPath : libraryPath;
const original = await readFile(sourcePath);
assert(hash(original) === V2_SHA, 'WORD_GARDEN_PUBLISHED_V2_LIBRARY_REQUIRED');
if (sourcePath === libraryPath) {
  await preserve(libraryPath, legacyPath, V2_SHA);
  const receiptBytes = await readFile(receiptPath);
  await preserve(receiptPath, legacyReceiptPath, hash(receiptBytes));
}
const legacyReceipt = JSON.parse(await readFile(legacyReceiptPath, 'utf8'));
const library = JSON.parse(original);
const editorialBytes = await readFile(join(root, 'scripts/word-garden/az-editorial-v3.json'));
const editorial = JSON.parse(editorialBytes);
assert(library.revision === 'az-202610-v2' && editorial.previousRevision === library.revision
  && /^az-\d{6}-v\d+$/.test(editorial.revision) && editorial.revision !== library.revision, 'WORD_GARDEN_EDITORIAL_REVISION_REQUIRED');

const alphabet = /^[abcçdeəfgğhxıijkqlmnoöprsştuüvyz]+$/u;
const list = lines => lines.join(' ').split(/\s+/).filter(Boolean);
const valid = word => word === word.normalize('NFC').toLocaleLowerCase('az') && alphabet.test(word)
  && Array.from(word).length >= library.minLength && Array.from(word).length <= library.maxLength;
const common = list(editorial.commonWords), standard = list(editorial.standardWords);
const keepBonus = new Set(list(editorial.corpusPromotion.keepBonus)), demote = new Set(list(editorial.demoteToBonus));
for (const word of [...common, ...standard, ...keepBonus, ...demote]) assert(valid(word), `WORD_GARDEN_EDITORIAL_WORD_INVALID:${word}`);
const editorialWords = new Set([...common, ...standard]);
assert(editorialWords.size === common.length + standard.length, 'WORD_GARDEN_EDITORIAL_DUPLICATE');
for (const word of [...keepBonus, ...demote]) assert(!editorialWords.has(word), `WORD_GARDEN_EDITORIAL_CONFLICT:${word}`);

const frequencyResponse = await fetch(legacyReceipt.sources.frequencyUrl, { signal: AbortSignal.timeout(60000), redirect: 'error' });
assert(frequencyResponse.ok, 'WORD_FREQUENCY_DOWNLOAD_FAILED');
const frequencyBytes = Buffer.from(await frequencyResponse.arrayBuffer());
assert(hash(frequencyBytes) === legacyReceipt.sources.frequencySha256, 'WORD_FREQUENCY_SNAPSHOT_CHANGED');
const frequencies = new Map();
for (const match of frequencyBytes.toString().matchAll(/word=([^,\r\n]+),f=(\d+)/g)) {
  const word = match[1].normalize('NFC').toLocaleLowerCase('az');
  frequencies.set(word, Math.max(frequencies.get(word) || 0, Number(match[2])));
}

const commonSet = new Set(common), byWord = new Map(library.words.map(entry => [entry.word, entry]));
const counts = { promotedCommon: 0, promotedEditorial: 0, promotedCorpus: 0, demoted: 0, added: 0 };
const words = library.words.map(entry => {
  if (demote.has(entry.word)) { counts.demoted++; return { ...entry, tier: 'bonus' }; }
  if (commonSet.has(entry.word)) { if (entry.tier !== 'common') counts.promotedCommon++; return { ...entry, tier: 'common' }; }
  if (entry.tier !== 'bonus') return entry;
  if (editorialWords.has(entry.word)) { counts.promotedEditorial++; return { ...entry, tier: 'standard' }; }
  // Dictionary lemmas confirmed by the pinned corpus become targets unless the
  // editor kept them as bonus-only (archaic, inflected, adult/violent, demonyms).
  if (entry.frequency >= editorial.corpusPromotion.minimumFrequency && !keepBonus.has(entry.word)) {
    counts.promotedCorpus++; return { ...entry, tier: 'standard' };
  }
  return entry;
});
for (const word of [...common, ...standard]) if (!byWord.has(word)) {
  counts.added++;
  words.push({ word, frequency: frequencies.get(word) || 0, tier: commonSet.has(word) ? 'common' : 'standard' });
}
words.sort((a, b) => a.word.localeCompare(b.word, 'az') || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
const updated = { ...library, revision: editorial.revision, words,
  source: { ...library.source, editorialSha256: hash(editorialBytes),
    note: 'v2 Kaikki/Wiktionary dictionary snapshot plus hand-curated Azerbaijani editorial lemmas (no machine translation); corpus-confirmed dictionary lemmas promoted; per-player deterministic dealing.' } };
const bytes = JSON.stringify(updated) + '\n';
await writeFile(libraryPath, bytes);
const lengths = {};
for (const entry of words) {
  const length = Array.from(entry.word).length, bucket = lengths[length] ||= { words: 0, targets: 0 };
  bucket.words++; if (entry.tier !== 'bonus') bucket.targets++;
}
const report = { schema: legacyReceipt.schema, language: 'az', revision: updated.revision,
  words: words.length, targetWords: words.filter(word => word.tier !== 'bonus').length,
  commonWords: words.filter(word => word.tier === 'common').length, lengths, changes: counts,
  dictionaryRowsRead: legacyReceipt.dictionaryRowsRead, sourceBytes: legacyReceipt.sourceBytes,
  librarySha256: hash(bytes), sources: updated.source, method: 'v2-snapshot-plus-hand-curated-editorial',
  previousRevision: library.revision, previousLibrarySha256: V2_SHA };
await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ revision: report.revision, words: report.words, targets: report.targetWords,
  commonWords: report.commonWords, lengths, changes: counts, librarySha256: report.librarySha256 }));
