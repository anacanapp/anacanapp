import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A reproducible data build. No runtime API, translation service or user/session
// information participates in validating a word or generating a game.
const root = fileURLToPath(new URL('../../', import.meta.url));
const dictionaryUrl = 'https://kaikki.org/dictionary/Azerbaijani/kaikki.org-dictionary-Azerbaijani.jsonl';
const frequencyUrl = 'https://raw.githubusercontent.com/subhangadirli/aosp-dict-az/c68c85cb297510d19cee04787e445e2a558b1f70/az_wordlist.combined';
const alphabet = /^[abcçdeəfgğhxıijkqlmnoöprsştuüvyz]+$/u;
const excludedTags = /(?:archaic|obsolete|dated|rare|dialectal|nonstandard|misspelling|error|alternative|abbreviation|initialism|acronym|slang|vulgar|offensive|derogatory|pejorative|regional|South|Iran|Arabic-script|Cyrillic)/i;
const excludedGloss = /(?:vulgar|offensive|derogatory|penis|vagina|sexual|porn|fuck|prostitute|whore|shit|bitch|nazi|terrorist|suicide|genocide)/i;
const normalize = word => String(word).normalize('NFC').toLocaleLowerCase('az');
const hash = value => createHash('sha256').update(value).digest('hex');
const assert = (value, code) => { if (!value) throw new Error(code); };

async function build() {
  assert(process.argv.slice(2).join(' ') === '--fetch', 'USE_IMPORT_AZ_FETCH');
  const editorial = JSON.parse(await readFile(join(root, 'scripts/word-garden/az-editorial.json'), 'utf8'));
  assert(/^az-\d{6}-v\d+$/.test(editorial.revision || '') && Number.isSafeInteger(editorial.targetFrequency)
    && editorial.targetFrequency > 0, 'WORD_GARDEN_EDITORIAL_REVISION_REQUIRED');
  const destination = join(root, 'src/components/games/word-garden/data/az.json');
  try {
    const current = JSON.parse(await readFile(destination, 'utf8'));
    assert(current.revision !== editorial.revision, 'WORD_GARDEN_PUBLISHED_REVISION_MUST_BE_BUMPED');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const common = new Set(editorial.commonWords.split(/\s+/).filter(Boolean).map(normalize));
  const excluded = new Set(editorial.excludedWords.map(normalize));
  const frequencyResponse = await fetch(frequencyUrl, { signal: AbortSignal.timeout(60000), redirect: 'error' });
  assert(frequencyResponse.ok, 'WORD_FREQUENCY_DOWNLOAD_FAILED');
  const frequencyBytes = Buffer.from(await frequencyResponse.arrayBuffer());
  const frequencies = new Map();
  for (const match of frequencyBytes.toString().matchAll(/word=([^,\r\n]+),f=(\d+)/g)) {
    frequencies.set(normalize(match[1]), Math.max(frequencies.get(normalize(match[1])) || 0, Number(match[2])));
  }
  assert(frequencies.size > 10000, 'WORD_FREQUENCY_FORMAT_CHANGED');
  const response = await fetch(dictionaryUrl, { redirect: 'error', signal: AbortSignal.timeout(300000) });
  assert(response.ok && response.body, 'WORD_DICTIONARY_DOWNLOAD_FAILED');
  const checksum = createHash('sha256'), decoder = new TextDecoder(), candidates = new Map();
  let pending = '', totalBytes = 0, rows = 0;
  const acceptedPos = new Set(['noun', 'verb', 'adj', 'adv', 'num', 'pron', 'det', 'postp', 'conj', 'intj']);
  function accept(line) {
    if (!line.trim()) return;
    rows++;
    const item = JSON.parse(line), word = normalize(item.word || '');
    if (item.lang_code !== 'az' || !acceptedPos.has(item.pos) || !alphabet.test(word)
      || Array.from(word).length < 3 || Array.from(word).length > 8 || excluded.has(word)
      || (!common.has(word) && /^[A-ZÇƏĞİÖŞÜ]/u.test(item.word))) return;
    const senses = (item.senses || []).filter(sense => !sense.form_of && !sense.alt_of
      && !excludedTags.test((sense.tags || []).join(' ')) && !excludedGloss.test((sense.glosses || []).join(' ')));
    if (!senses.length) return;
    const frequency = frequencies.get(word) || 0;
    // Corpus-confirmed lemmas are targets; dictionary-only lemmas are still
    // accepted as bonus words. Inflected forms/names do not inflate the library.
    const tier = common.has(word) ? 'common' : frequency >= editorial.targetFrequency ? 'standard' : 'bonus';
    const entry = { word, frequency, tier, ...(editorial.definitions[word] ? { definition: editorial.definitions[word] } : {}) };
    if (!candidates.has(word) || candidates.get(word).frequency < frequency) candidates.set(word, entry);
  }
  for await (const chunk of response.body) {
    checksum.update(chunk); totalBytes += chunk.byteLength;
    assert(totalBytes < 400 * 1024 * 1024, 'WORD_DICTIONARY_SIZE_CHANGED');
    pending += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = pending.indexOf('\n')) >= 0) { accept(pending.slice(0, index)); pending = pending.slice(index + 1); }
    assert(pending.length < 10 * 1024 * 1024, 'WORD_DICTIONARY_LINE_TOO_LARGE');
  }
  pending += decoder.decode(); if (pending.trim()) accept(pending);
  for (const word of common) if (alphabet.test(word) && Array.from(word).length >= 3 && Array.from(word).length <= 8 && !excluded.has(word)) {
    const found = candidates.get(word);
    if (found) { found.tier = 'common'; if (editorial.definitions[word]) found.definition = editorial.definitions[word]; }
  }
  const words = [...candidates.values()].sort((a, b) => a.word.localeCompare(b.word, 'az'));
  assert(words.length >= 1500 && words.filter(word => word.tier !== 'bonus').length >= 500, 'WORD_DICTIONARY_COVERAGE_REQUIRED');
  const revision = editorial.revision;
  const library = { schema: 'anacan-word-garden-lexicon-v1', language: 'az', revision, locale: 'az-AZ',
    alphabet: Array.from('abcçdeəfgğhxıijkqlmnoöprsştuüvyz'), minLength: 3, maxLength: 8,
    source: { name: 'Wiktionary / Kaikki.org', url: dictionaryUrl, license: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sha256: checksum.digest('hex'),
      frequencyUrl, frequencySha256: hash(frequencyBytes), editorialSha256: hash(JSON.stringify(editorial)),
      note: 'NFC/az case-normalized Latin-script lemmas, filtered senses, corpus-ranked targets, Anacan editorial difficulty selection.' },
    openingRacks: editorial.openingRacks.map(normalize), words };
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(library) + '\n');
  const report = { schema: 'anacan-word-garden-library-build-v1', language: 'az', revision, words: words.length,
    targetWords: words.filter(word => word.tier !== 'bonus').length, commonWords: words.filter(word => word.tier === 'common').length,
    dictionaryRowsRead: rows, sourceBytes: totalBytes, librarySha256: hash(await readFile(destination)), sources: library.source };
  await writeFile(join(root, 'scripts/word-garden/az-import-receipt.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ words: report.words, targetWords: report.targetWords, commonWords: report.commonWords,
    librarySha256: report.librarySha256, revision }));
}
await build();
