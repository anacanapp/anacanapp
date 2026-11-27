import { withRandom } from './setup';
import { activateColorBombSwap, applyMatchResult, createBoard, findMatchGroups, hasAnyPossibleMove, reshuffleBoard, swap, type Board, type Pos, type SpecialEvent } from '@/components/games/birlesdir/matchEngine';
import { getLevelConfig, getStarsForScore, getLevelSections } from '@/components/games/birlesdir/levelConfig';
import { getTilePool } from '@/components/games/birlesdir/tileDefs';

// Transcribed from BirlesdirGame.tsx (module-private there).
function computeScore(clearedCount: number, cascadeIndex: number, events: SpecialEvent[], scoreMultiplier: number): number {
  const base = clearedCount * 12;
  const cascadeMultiplier = 1 + cascadeIndex * 0.5;
  let bonus = 0;
  for (const e of events) {
    if (e.kind === 'striped-h' || e.kind === 'striped-v') bonus += e.created ? 30 : 60;
    else if (e.kind === 'wrapped') bonus += e.created ? 50 : 100;
    else if (e.kind === 'color-bomb') bonus += e.created ? 80 : 160;
  }
  return Math.round((base * cascadeMultiplier + bonus) * scoreMultiplier);
}
const view = (board: Board) => board.map(row => row.map(tile => tile ? (tile.special ? [tile.type, tile.special] : [tile.type]) : null));

/** One player swap resolved exactly like BirlesdirGame.attemptSwap + resolveFrom (timers removed). */
function play(board: Board, a: Pos, b: Pos, typeCount: number, multiplier: number) {
  let gained = 0; const steps: unknown[] = [];
  const tileA = board[a.row][a.col], tileB = board[b.row][b.col];
  let current: Board, cascadeIndex = 0;
  if (tileA?.special === 'color-bomb' || tileB?.special === 'color-bomb') {
    const step = activateColorBombSwap(board, a, b, typeCount);
    gained += computeScore(step.clearedCount, 0, step.events, multiplier); current = step.board; cascadeIndex = 1;
    steps.push({ cleared: step.clearedCount, events: step.events, board: view(current) });
  } else {
    const swapped = swap(board, a, b), result = findMatchGroups(swapped, [a, b]);
    if (!result.groups.length) return { valid: false, board, gained: 0, steps };
    const step = applyMatchResult(swapped, result, typeCount);
    gained += computeScore(step.clearedCount, 0, step.events, multiplier); current = step.board; cascadeIndex = 1;
    steps.push({ groups: result.groups, cleared: step.clearedCount, events: step.events, board: view(current) });
  }
  for (;;) {
    const result = findMatchGroups(current);
    if (!result.groups.length) break;
    const step = applyMatchResult(current, result, typeCount);
    gained += computeScore(step.clearedCount, cascadeIndex, step.events, multiplier); current = step.board; cascadeIndex++;
    steps.push({ cascade: cascadeIndex, cleared: step.clearedCount, events: step.events, board: view(current) });
  }
  let reshuffled = false;
  if (!hasAnyPossibleMove(current, typeCount)) { current = reshuffleBoard(current, typeCount); reshuffled = true; }
  return { valid: true, board: current, gained, steps, reshuffled };
}

function firstMove(board: Board): [Pos, Pos] | null {
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) {
    if (board[r][c]?.special === 'color-bomb') return [{ row: r, col: c }, { row: r, col: c + 1 < board[0].length ? c + 1 : c - 1 }];
  }
  for (let r = board.length - 1; r >= 0; r--) for (let c = 0; c < board[0].length; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const b = { row: r + dr, col: c + dc };
      if (b.row >= board.length || b.col >= board[0].length) continue;
      if (findMatchGroups(swap(board, { row: r, col: c }, b)).groups.length) return [{ row: r, col: c }, b];
    }
  }
  return null;
}

export function all() {
  const games = [[1, 1], [8, 2], [15, 3], [27, 4], [40, 5]].map(([level, seed]) => withRandom(seed * 7919, () => {
    const config = getLevelConfig(level), typeCount = getTilePool(config.tileTypesCount).length;
    let board = createBoard(8, 8, typeCount);
    const initial = view(board), turns: unknown[] = [];
    let score = 0, moves = config.movesLimit;
    while (moves > 0) {
      const move = firstMove(board);
      if (!move) break;
      const result = play(board, move[0], move[1], typeCount, config.scoreMultiplier);
      board = result.board; score += result.gained; moves--;
      turns.push({ move, gained: result.gained, steps: result.steps, reshuffled: result.reshuffled, board: view(board) });
    }
    const perMoveBonus = Math.max(12, Math.round(55 * config.scoreMultiplier));
    const finalScore = score >= config.targetScore ? score + Math.max(0, moves) * perMoveBonus : score;
    return { level, seed, typeCount, initial, turns, score, finalScore, stars: getStarsForScore(finalScore, config.targetScore) };
  }));
  const configs = Array.from({ length: 42 }, (_, index) => getLevelConfig(index));
  const stars = [[0, 800], [799, 800], [800, 800], [959, 800], [960, 800], [1199, 800], [1200, 800], [6650, 6650], [9975, 6650]].map(([score, target]) => ({ score, target, value: getStarsForScore(score, target) }));
  const shuffles = withRandom(5, () => [5, 6, 7].map(typeCount => {
    const board = createBoard(6, 7, typeCount);
    board[0][0] = { id: 9999, type: -1, special: 'color-bomb' }; board[2][3] = { ...board[2][3]!, special: 'striped-v' };
    return { typeCount, before: view(board), after: view(reshuffleBoard(board, typeCount)) };
  }));
  return { games, configs, stars, sections: getLevelSections(), shuffles, pools: [1, 3, 5, 7, 9].map(n => getTilePool(n).map(tile => tile.type)) };
}
