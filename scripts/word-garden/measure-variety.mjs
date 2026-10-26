import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundled = await build({ stdin: { contents: 'export {generateGardenLevel} from "./src/components/games/word-garden/generator.ts";export {compileLexicon,wordsFromRack} from "./src/components/games/word-garden/lexicon.ts";',
  resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const libraryPath = process.argv[2] || 'src/components/games/word-garden/data/az.json';
const lexicon = engine.compileLexicon(JSON.parse(await readFile(join(root, libraryPath), 'utf8')), 'az');
const racks = {};
for (let length = 4; length <= 8; length++) {
  const roots = lexicon.targets.filter(word => word.letters.length === length);
  const signatures = new Map(roots.map(word => [word.signature, word]));
  const viable = [...signatures.values()].map(root => ({ root, targets: engine.wordsFromRack(lexicon, root.letters).filter(word => word.tier !== 'bonus').length }));
  racks[length] = { roots: roots.length, distinctRacks: signatures.size,
    twoAnswers: viable.filter(item => item.targets >= 2).length,
    threeAnswers: viable.filter(item => item.targets >= 3).length,
    commonTwoAnswers: viable.filter(item => item.targets >= 2 && item.root.tier === 'common').length };
}
const modes = {};
for (const mode of ['calm', 'timed']) {
  const started = performance.now();
  const levels = Array.from({ length: 240 }, (_, index) => engine.generateGardenLevel(lexicon, index + 1, mode));
  let adjacentIdentical = 0, adjacentWords = 0, adjacentRepeat = 0, adjacentRacks = 0;
  const windows = [];
  for (let index = 0; index < levels.length; index++) {
    const level = levels[index], previous = levels[index - 1];
    if (previous) {
      const words = new Set(previous.words.map(word => word.word));
      const repeated = level.words.filter(word => words.has(word.word)).length;
      adjacentWords += level.words.length; adjacentRepeat += repeated;
      if (repeated === level.words.length && previous.words.length === level.words.length) adjacentIdentical++;
      if ([...level.letters].sort().join('') === [...previous.letters].sort().join('')) adjacentRacks++;
    }
    if (index % 20 === 19) {
      const samples = levels.slice(index - 19, index + 1), counts = new Map();
      for (const sample of samples) for (const word of sample.words) counts.set(word.word, (counts.get(word.word) || 0) + 1);
      windows.push({ from: index - 18, to: index + 1,
        distinctPuzzles: new Set(samples.map(sample => sample.words.map(word => word.word).sort().join('|'))).size,
        distinctRacks: new Set(samples.map(sample => [...sample.letters].sort().join(''))).size,
        words: counts.size, mostRepeatedWord: Math.max(...counts.values()),
        timeRange: [Math.min(...samples.map(sample => sample.timeLimit || 0)), Math.max(...samples.map(sample => sample.timeLimit || 0))] });
    }
  }
  modes[mode] = { generationMilliseconds: Math.round(performance.now() - started), adjacentIdentical, adjacentRacks, adjacentRepeatedWordRatio: Number((adjacentRepeat / adjacentWords).toFixed(3)),
    opening: levels.slice(0, 10).map(level => ({ level: level.level, words: level.words.map(word => word.word), seconds: level.timeLimit })), windows };
}
console.log(JSON.stringify({ revision: lexicon.data.revision, words: lexicon.words.size, targets: lexicon.targets.length, racks, modes }, null, 2));
