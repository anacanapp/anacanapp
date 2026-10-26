import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the verified dictionary snapshot. More of its corpus-confirmed lemmas
// become playable targets; the original published library remains byte-for-byte.
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (value, code) => { if (!value) throw new Error(code); };
assert(process.argv.slice(2).join(' ') === '--from-current', 'USE_REBALANCE_AZ_FROM_CURRENT');
const libraryPath = join(root, 'src/components/games/word-garden/data/az.json');
const receiptPath = join(root, 'scripts/word-garden/az-import-receipt.json');
const original = await readFile(libraryPath), library = JSON.parse(original);
const receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes);
const editorial = JSON.parse(await readFile(join(root, 'scripts/word-garden/az-editorial.json'), 'utf8'));
assert(library.language === 'az' && library.revision === 'az-202610-v1'
  && hash(original) === receipt.librarySha256 && editorial.revision === 'az-202610-v2', 'WORD_GARDEN_PUBLISHED_LIBRARY_REQUIRED');
async function preserve(path, destination, expected) {
  try { await copyFile(path, destination, constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; assert(hash(await readFile(destination)) === expected, 'WORD_GARDEN_LEGACY_LIBRARY_CONFLICT'); }
}
await preserve(libraryPath, join(root, 'src/components/games/word-garden/data/az-v1.json'), hash(original));
await preserve(receiptPath, join(root, 'scripts/word-garden/az-import-receipt-v1.json'), hash(receiptBytes));
const common = new Set(editorial.commonWords.split(/\s+/).filter(Boolean));
const words = library.words.map(entry => ({ ...entry, tier: common.has(entry.word) ? 'common' : entry.frequency >= editorial.targetFrequency ? 'standard' : 'bonus' }));
assert(editorial.openingRacks.every(word => words.some(entry => entry.word === word && entry.tier === 'common')), 'WORD_GARDEN_OPENING_WORDS_REQUIRED');
const updated = { ...library, revision: editorial.revision, openingRacks: editorial.openingRacks, words,
  source: { ...library.source, editorialSha256: hash(JSON.stringify(editorial)),
    note: 'Verified v1 dictionary snapshot; corpus-confirmed lemmas at frequency40+, varied Anacan opening curriculum; NFC/az Latin-script words and original sense filters retained.' } };
const bytes = JSON.stringify(updated) + '\n';
await writeFile(libraryPath, bytes);
const report = { ...receipt, revision: updated.revision, method: 'verified-dictionary-snapshot-rebalance',
  previousRevision: library.revision, previousLibrarySha256: receipt.librarySha256,
  words: words.length, targetWords: words.filter(word => word.tier !== 'bonus').length,
  commonWords: words.filter(word => word.tier === 'common').length, librarySha256: hash(bytes), sources: updated.source };
await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ revision: report.revision, words: report.words, targets: report.targetWords,
  commonWords: report.commonWords, previousLibraryPreserved: true, librarySha256: report.librarySha256 }));
