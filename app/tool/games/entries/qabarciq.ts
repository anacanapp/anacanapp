import { mulberry32 } from './setup';
import { cellsOfColor, createBoard, createRng, findGroup, hasMove, multiplierFor, pointsFor, removeCells, ensureMove, COLS, ROWS, MAX_SCORE, type BoardState } from '@/components/games/qabarciq/engine';
import { BUBBLE_MESSAGES, bubbleText } from '@/components/games/qabarciq/messages';

/** Scripted round mirroring BubblePop.tsx `tap`/`pop` scoring with an explicit clock instead of Date.now(). */
function scriptedRound(seed: number) {
  let board: BoardState = createBoard(seed);
  const initial = board.grid.map(col => col.map(b => [b.id, b.color]));
  const pick = mulberry32(seed ^ 0x5bd1e995);
  let score = 0, popped = 0, bestCombo = 0, pops = 0, combo = 0, lastPop = 0, now = 1_000_000, wands = 2, rainbows = 1;
  const log: unknown[] = [];
  for (let tap = 0; tap < 120; tap++) {
    now += [300, 900, 1700, 2500][Math.floor(pick() * 4)];
    if (combo && now - lastPop > 1600) combo = 0; // the 100 ms clock tick resets the combo
    const c = Math.floor(pick() * COLS), r = Math.floor(pick() * ROWS);
    const mode = tap % 37 === 5 && wands > 0 ? 'wand' : tap % 53 === 20 && rainbows > 0 ? 'rainbow' : 'pop';
    let cells: [number, number][], gained: number;
    const nextCombo = () => now - lastPop <= 1600 ? combo + 1 : 1;
    if (mode === 'wand') {
      cells = findGroup(board.grid, c, r); wands--;
      gained = Math.round(Math.max(1, cells.length) ** 2 * 5 * multiplierFor(combo + 1)) + 50;
    } else if (mode === 'rainbow') {
      cells = cellsOfColor(board.grid, board.grid[c][r].color); rainbows--;
      gained = Math.round(cells.length * 25 * multiplierFor(combo + 1));
    } else {
      cells = findGroup(board.grid, c, r);
      if (cells.length < 2) { log.push({ tap, c, r, shake: board.grid[c][r].id }); continue; }
      gained = 0;
    }
    const next = nextCombo();
    lastPop = now; combo = next;
    if (mode === 'pop') gained = pointsFor(cells.length, next);
    board = removeCells(board, cells);
    score = Math.min(MAX_SCORE, score + gained); popped += cells.length; bestCombo = Math.max(bestCombo, next); pops++;
    log.push({ tap, c, r, mode, cells, gained, combo: next, nextId: board.nextId });
  }
  return { seed, initial, log, final: board.grid.map(col => col.map(b => [b.id, b.color])), nextId: board.nextId, stats: { score, popped, bestCombo, pops } };
}

export function all() {
  const rngs = [0, 1, 42, 0xFFFFFFFF, 1731600000000, -5].map(seed => { const rng = createRng(seed); return { seed, values: Array.from({ length: 16 }, () => rng.next()) }; });
  const rounds = [1, 42, 1731600000000, 1731655123456, 987654321].map(scriptedRound);
  const scoring = { points: [[0, 1], [1, 1], [2, 1], [5, 1], [5, 3], [8, 2], [12, 9], [80, 4]].map(([n, combo]) => ({ n, combo, value: pointsFor(n, combo) })),
    multipliers: [0, 1, 2, 3, 8, 9, 100].map(combo => ({ combo, value: multiplierFor(combo) })) };
  // A board with no pair: ensureMove recolours one bubble.
  const flat = { grid: Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, (_, r) => ({ id: c * ROWS + r + 1, color: (c + r) % 2 === 0 ? (c % 3) : 3 + (r % 3) }))), nextId: 81, rng: createRng(7) };
  const before = hasMove(flat.grid); ensureMove(flat);
  const text = ['az', 'en', 'tk', 'uk', 'xx'].flatMap(language => (['title', 'combo', 'shareText', 'seconds'] as const).map(key => ({ language, key, value: bubbleText(language, key, { n: 4, score: 1250 }) })));
  return { rngs, rounds, scoring, ensure: { before, after: hasMove(flat.grid), grid: flat.grid.map(col => col.map(b => b.color)) }, text, languages: Object.keys(BUBBLE_MESSAGES) };
}
