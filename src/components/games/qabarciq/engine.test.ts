import { describe, expect, it } from 'vitest';
import { COLS, ROWS, cellsOfColor, createBoard, findGroup, hasMove, multiplierFor, pointsFor, removeCells, type BoardState } from './engine';

const fixed = (colors: number[][]): BoardState => {
  let id = 1;
  return { grid: colors.map(col => col.map(color => ({ id: id++, color }))), nextId: id, rng: { next: () => 0 } };
};
const column = (color: number) => Array.from({ length: ROWS }, () => color);

describe('qabarciq engine', () => {
  it('creates a full board with at least one move, deterministically', () => {
    const a = createBoard(42), b = createBoard(42);
    expect(a.grid).toHaveLength(COLS);
    expect(a.grid.every(col => col.length === ROWS)).toBe(true);
    expect(a.grid.map(col => col.map(x => x.color))).toEqual(b.grid.map(col => col.map(x => x.color)));
    expect(hasMove(a.grid)).toBe(true);
  });

  it('finds the connected same-colour group only', () => {
    const cols: number[][] = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, (_, r) => (c + r) % 2 ? 1 : 2));
    cols[0][0] = 3; cols[0][1] = 3; cols[1][1] = 3; cols[3][3] = 3;
    const group = findGroup(fixed(cols).grid, 0, 0);
    expect(group).toHaveLength(3);
  });

  it('pops, drops the rest down and refills to a full board', () => {
    const cols = Array.from({ length: COLS }, (_, c) => column(c % 2 ? 4 : 5));
    cols[0] = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3];
    const board = fixed(cols);
    const topId = board.grid[0][0].id;
    const next = removeCells(board, [[0, 9], [0, 8]]);
    expect(next.grid[0]).toHaveLength(ROWS);
    expect(next.grid[0][2].id).toBe(topId); // old top fell 2 rows
    expect(next.grid[0][0].id).toBeGreaterThanOrEqual(board.nextId);
  });

  it('scores bigger groups and combos higher, capped multiplier', () => {
    expect(pointsFor(2, 1)).toBe(20);
    expect(pointsFor(5, 1)).toBe(125);
    expect(pointsFor(5, 3)).toBe(250);
    expect(multiplierFor(100)).toBe(5);
  });

  it('collects every cell of a colour for the rainbow booster', () => {
    const cols = Array.from({ length: COLS }, () => column(1));
    cols[2][4] = 0; cols[6][1] = 0;
    expect(cellsOfColor(fixed(cols).grid, 0)).toHaveLength(2);
  });
});
