// Qabarcıq partlat: a 90-second tap-to-pop round on an 8×10 grid of 6 colours.
// Tapping a bubble pops its connected same-colour group (2+). Bubbles above fall down and new ones
// drop in from the top, so the board never empties. Quick consecutive pops build a combo multiplier.

export const BUBBLE_ID = 'qabarciq';
export const COLS = 8;
export const ROWS = 10;
export const COLORS = 6;
export const ROUND_SECONDS = 90;
export const COMBO_WINDOW_MS = 1600;
export const MAX_MULTIPLIER = 5;
export const START_WANDS = 2;
export const START_RAINBOWS = 1;
export const MAX_SCORE = 300_000; // server bound (submit_game_score_v1)

export interface Bubble { id: number; color: number }
export type Grid = Bubble[][]; // grid[col][row], row 0 = top

export interface Rng { next(): number }
export function createRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return { next() { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x1_0000_0000; } };
}

export interface BoardState { grid: Grid; nextId: number; rng: Rng }

export function createBoard(seed: number): BoardState {
  const rng = createRng(seed);
  let nextId = 1;
  const grid: Grid = [];
  for (let c = 0; c < COLS; c++) {
    const col: Bubble[] = [];
    for (let r = 0; r < ROWS; r++) col.push({ id: nextId++, color: Math.floor(rng.next() * COLORS) });
    grid.push(col);
  }
  const board = { grid, nextId, rng };
  ensureMove(board);
  return board;
}

const key = (c: number, r: number) => c * ROWS + r;

/** Connected same-colour cells (4-neighbour) starting at (c, r). */
export function findGroup(grid: Grid, c: number, r: number): [number, number][] {
  const color = grid[c]?.[r]?.color;
  if (color === undefined) return [];
  const seen = new Set<number>([key(c, r)]);
  const out: [number, number][] = [];
  const stack: [number, number][] = [[c, r]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    out.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(key(nx, ny))) continue;
      if (grid[nx][ny].color !== color) continue;
      seen.add(key(nx, ny));
      stack.push([nx, ny]);
    }
  }
  return out;
}

export function hasMove(grid: Grid): boolean {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const color = grid[c][r].color;
    if ((c + 1 < COLS && grid[c + 1][r].color === color) || (r + 1 < ROWS && grid[c][r + 1].color === color)) return true;
  }
  return false;
}

/** Recolours one random bubble to match a neighbour if the board has no pair (practically never happens). */
export function ensureMove(board: BoardState): void {
  if (hasMove(board.grid)) return;
  const c = Math.floor(board.rng.next() * (COLS - 1)), r = Math.floor(board.rng.next() * ROWS);
  board.grid[c + 1][r] = { ...board.grid[c + 1][r], color: board.grid[c][r].color };
}

/** Removes the given cells, lets the rest fall and fills each column from the top. Returns the new board. */
export function removeCells(board: BoardState, cells: [number, number][]): BoardState {
  const remove = new Set(cells.map(([c, r]) => key(c, r)));
  let nextId = board.nextId;
  const grid: Grid = board.grid.map((col, c) => {
    const kept = col.filter((_, r) => !remove.has(key(c, r)));
    const fresh: Bubble[] = [];
    while (fresh.length + kept.length < ROWS) fresh.push({ id: nextId++, color: Math.floor(board.rng.next() * COLORS) });
    return [...fresh, ...kept];
  });
  const next = { grid, nextId, rng: board.rng };
  ensureMove(next);
  return next;
}

export function multiplierFor(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.max(0, combo - 1) * 0.5);
}

/** Points for popping n bubbles at the given combo (combo counts this pop). */
export function pointsFor(n: number, combo: number): number {
  if (n < 1) return 0;
  return Math.round(n * n * 5 * multiplierFor(combo));
}

export function cellsOfColor(grid: Grid, color: number): [number, number][] {
  const out: [number, number][] = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r].color === color) out.push([c, r]);
  return out;
}

export interface RoundStats { score: number; popped: number; bestCombo: number; pops: number }
export const emptyStats = (): RoundStats => ({ score: 0, popped: 0, bestCombo: 0, pops: 0 });
