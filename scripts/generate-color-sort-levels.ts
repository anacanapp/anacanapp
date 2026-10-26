import { generateLevel } from '../src/components/games/color-sort/generator.ts';
import { INITIAL_LEVEL_COUNT } from '../src/components/games/color-sort/difficulty.ts';

// Preview a reproducible catalog. The checked-in catalog is reviewed separately;
// this command never edits source, user progress, remote settings or scores.
const levels = [];
for (let level = 1; level <= INITIAL_LEVEL_COUNT; level++) {
  const result = generateLevel(level, { maxAttempts: 160, maxNodes: 60_000 });
  if (!result) throw new Error(`COLOR_SORT_GENERATION_FAILED_LEVEL_${level}`);
  levels.push(result);
  console.error(`level=${level} colors=${result.colors} empty=${result.emptyTubes} locks=${result.lockedTubes} par=${result.parMoves}`);
}
console.log('[\n' + levels.map(level => JSON.stringify({ level: level.level, seed: level.seed,
  board: level.board, solution: level.solution.map(move => [move.from, move.to]) })).join(',\n') + '\n]');
