import { isComplete, replaySolution, segmentCount, solve, type Board } from './engine.ts';
import { CAPACITY, getLevelProfile, makeLevel, rulesForProfile, type ColorSortLevel } from './difficulty.ts';

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: T[], random: () => number): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
}

export function generateLevel(level: number, options: { maxAttempts?: number; maxNodes?: number; maxMilliseconds?: number } = {}): ColorSortLevel | null {
  const profile = getLevelProfile(level), rules = rulesForProfile(profile);
  if (profile.level === 1) {
    const board = [[0, 0, 1, 1], [1, 1, 0, 0], [], [], []];
    return makeLevel(profile, 1, board, [{ from: 0, to: 2 }, { from: 1, to: 0 }, { from: 2, to: 1 }]);
  }
  const { maxAttempts = 48, maxNodes = 35_000, maxMilliseconds = Infinity } = options;
  const started = performance.now();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (performance.now() - started > maxMilliseconds) return null;
    const seed = (Math.imul(profile.level, 0x45D9F3B) + Math.imul(attempt + 1, 0x9E3779B9)) >>> 0;
    const random = seededRandom(seed);
    const unitSize = profile.level === 2 ? 2 : 1;
    const chunks = shuffled(Array.from({ length: profile.colors * CAPACITY / unitSize }, (_, index) =>
      Array(unitSize).fill(Math.floor(index / (CAPACITY / unitSize)))), random).flat();
    const board: Board = Array.from({ length: profile.colors }, (_, index) => chunks.slice(index * CAPACITY, (index + 1) * CAPACITY));
    if (board.some(tube => isComplete(tube, CAPACITY))) continue;
    const signatures = new Set(board.map(tube => tube.join(',')));
    if (signatures.size !== profile.colors || segmentCount(board) < profile.colors * (unitSize === 2 ? 2 : 3)) continue;
    for (let index = 0; index < profile.emptyTubes + profile.lockedTubes; index++) board.push([]);
    const remaining = maxMilliseconds - (performance.now() - started);
    const result = solve(board, rules, { maxNodes, maxMilliseconds: remaining, maxDepth: 120 });
    if (result.status === 'solved' && result.moves.length >= profile.colors + 1 && replaySolution(board, rules, result.moves)) {
      return makeLevel(profile, seed, board, result.moves);
    }
  }
  return null;
}

/** Safe offline fallback: permute a proven same-difficulty template, including
 * real tube indexes in locks and its complete solution. Never return an
 * unchecked random board when a worker is unavailable or hits its budget. */
export function permuteLevel(template: ColorSortLevel, level: number): ColorSortLevel {
  const random = seededRandom(Math.imul(level, 0x27D4EB2D));
  const colors = shuffled(Array.from({ length: template.colors }, (_, index) => index), random);
  const order = shuffled(Array.from({ length: template.board.length }, (_, index) => index), random);
  const inverse = new Map(order.map((oldIndex, index) => [oldIndex, index]));
  const board = order.map(index => template.board[index].map(color => colors[color]));
  const rules = { capacity: template.rules.capacity, locks: template.rules.locks.map(lock => ({ ...lock, tube: inverse.get(lock.tube)! })) };
  const solution = template.solution.map(move => ({ from: inverse.get(move.from)!, to: inverse.get(move.to)! }));
  return { ...template, ...getLevelProfile(level), seed: level, board, rules, solution };
}
