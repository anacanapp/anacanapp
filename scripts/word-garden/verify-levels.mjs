import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundled = await build({ stdin: { contents: 'export {generateGardenLevel,validateGardenLevel} from "./src/components/games/word-garden/generator.ts";export {compileLexicon,canSpellWord,splitLetters} from "./src/components/games/word-garden/lexicon.ts";',
  resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const bytes = await readFile(join(root, 'src/components/games/word-garden/data/az.json'));
const data = JSON.parse(bytes), lexicon = engine.compileLexicon(data, 'az');
const receipt = JSON.parse(await readFile(join(root, 'scripts/word-garden/az-import-receipt.json'), 'utf8'));
const report = { at: new Date().toISOString(), passed: false, language: 'az', revision: data.revision,
  words: lexicon.words.size, targets: lexicon.targets.length, generated: 0, failures: [], wordCounts: {}, variants: {}, variety: {}, timeLimits: {} };
const assert = (value, code) => { if (!value) throw new Error(code); };
try {
  assert(createHash('sha256').update(bytes).digest('hex') === receipt.librarySha256, 'WORD_GARDEN_LIBRARY_RECEIPT_CHANGED');
  for (const mode of ['calm', 'timed']) {
    const variants = new Set(), opening = new Set(), encountered = new Set();
    let previous = null, adjacentRepeatedWords = 0, adjacentRepeatedRacks = 0, repeatedPuzzles = 0;
    let minTime = Infinity, maxTime = 0;
    for (const level of [...Array.from({ length: 2400 }, (_, index) => index + 1), 10000, 1000000, 2147483647]) {
      const puzzle = engine.generateGardenLevel(lexicon, level, mode);
      assert(engine.validateGardenLevel(puzzle, lexicon), 'WORD_GARDEN_GENERATED_LEVEL_INVALID');
      const cells = new Map(puzzle.cells.map(cell => [`${cell.row}:${cell.column}`, cell]));
      // Every horizontal/vertical run must be a placed answer, not an accidental
      // adjacent sequence. Validate independently of generator placement code.
      for (const cell of puzzle.cells) for (const [dr, dc, direction] of [[0, 1, 'across'], [1, 0, 'down']]) {
        if (cells.has(`${cell.row - dr}:${cell.column - dc}`)) continue;
        let row = cell.row, column = cell.column, word = '';
        while (cells.has(`${row}:${column}`)) { word += cells.get(`${row}:${column}`).letter; row += dr; column += dc; }
        if (word.length > 1) assert(puzzle.words.some(answer => answer.word === word && answer.row === cell.row
          && answer.column === cell.column && answer.direction === direction), 'WORD_GARDEN_ACCIDENTAL_WORD');
      }
      assert(puzzle.bonusWords.every(word => engine.canSpellWord(puzzle.letters, engine.splitLetters(word, data.locale))), 'WORD_GARDEN_BONUS_LETTERS_INVALID');
      if (mode === 'timed') {
        assert(Number.isInteger(puzzle.timeLimit) && puzzle.timeLimit >= 25 && puzzle.timeLimit <= 100, 'WORD_GARDEN_TIMER_BUDGET_INVALID');
        minTime = Math.min(minTime, puzzle.timeLimit); maxTime = Math.max(maxTime, puzzle.timeLimit);
      }
      const signature = puzzle.words.map(word => word.word).sort().join('|');
      if (level <= 20) opening.add(signature);
      for (const word of puzzle.words) encountered.add(word.word);
      if (previous && level <= 2400) {
        const repeated = puzzle.words.filter(word => previous.words.some(answer => answer.word === word.word)).length;
        adjacentRepeatedWords += repeated;
        if (signature === previous.words.map(word => word.word).sort().join('|')) repeatedPuzzles++;
        if ([...puzzle.letters].sort().join('') === [...previous.letters].sort().join('')) adjacentRepeatedRacks++;
      }
      previous = puzzle;
      report.generated++;
      const key = `${puzzle.difficulty}:${puzzle.words.length}`;
      report.wordCounts[key] = (report.wordCounts[key] || 0) + 1;
      if (level > 220) variants.add(puzzle.words.map(word => word.word).sort().join('|'));
    }
    report.variants[mode] = variants.size;
    report.variety[mode] = { distinctFirstTwenty: opening.size, encounteredTargetWords: encountered.size,
      adjacentRepeatedWords, adjacentRepeatedRacks, repeatedPuzzles };
    assert(opening.size === 20 && adjacentRepeatedRacks === 0 && repeatedPuzzles === 0, 'WORD_GARDEN_VARIETY_REQUIRED');
    if (mode === 'timed') report.timeLimits = { minimum: minTime, maximum: maxTime, firstLevel: engine.generateGardenLevel(lexicon, 1, mode).timeLimit };
  }
  report.passed = true;
} catch (error) {
  report.error = error.message; process.exitCode = 1;
}
await writeFile(join(root, 'scripts/word-garden/level-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
