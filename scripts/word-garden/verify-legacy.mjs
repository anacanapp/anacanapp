import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baselineId = 'native-20261008t162105-fc36dca2';
const old = join(root, 'azure-migration/native-preview', baselineId, 'workspace');
async function engine(directory) {
  const bundled = await build({ stdin: { contents: 'export {generateGardenLevel} from "./src/components/games/word-garden/generator.ts";export {compileLexicon} from "./src/components/games/word-garden/lexicon.ts";',
    resolveDir: directory, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
}
const current = await engine(root), baseline = await engine(old);
const bytes = await readFile(join(root, 'src/components/games/word-garden/data/az-v1.json'));
const before = await readFile(join(old, 'src/components/games/word-garden/data/az.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(bytes) !== hash(before)) throw new Error('WORD_GARDEN_ORIGINAL_DICTIONARY_CHANGED');
const lexicon = current.compileLexicon(JSON.parse(bytes), 'az'), previous = baseline.compileLexicon(JSON.parse(before), 'az');
const report = { at: new Date().toISOString(), passed: true, baselineId, revision: lexicon.data.revision,
  librarySha256: hash(bytes), compared: 0, modes: ['calm', 'timed'], originalDictionaryPreserved: true };
for (const mode of report.modes) for (const level of [1, 2, 3, 10, 11, 25, 40, 41, 100, 101, 220, 221, 1000, 10000, 1000000, 2147483647]) {
  if (JSON.stringify(current.generateGardenLevel(lexicon, level, mode)) !== JSON.stringify(baseline.generateGardenLevel(previous, level, mode))) {
    throw new Error('WORD_GARDEN_LEGACY_PUZZLE_CHANGED');
  }
  report.compared++;
}
await writeFile(join(root, 'scripts/word-garden/legacy-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
