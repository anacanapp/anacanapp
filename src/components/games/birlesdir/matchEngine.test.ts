import { describe, it, expect } from 'vitest';
import {
  createBoard,
  findMatchGroups,
  applyMatchResult,
  swap,
  isAdjacent,
  hasAnyPossibleMove,
  Board,
  Cell,
} from './matchEngine';

function makeBoardFromTypes(types: number[][]): Board {
  let id = 1;
  return types.map((row) => row.map((t) => (t === -9 ? null : { id: id++, type: t }))) as Board;
}

describe('matchEngine', () => {
  it('createBoard produces a board with no initial matches and at least one move', () => {
    const board = createBoard(8, 8, 5);
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(8);
    const result = findMatchGroups(board);
    expect(result.groups.length).toBe(0);
    expect(hasAnyPossibleMove(board, 5)).toBe(true);
  });

  it('detects a simple horizontal 3-match with no special', () => {
    const board = makeBoardFromTypes([
      [0, 0, 0, 1, 2],
      [1, 2, 3, 4, 0],
      [2, 3, 4, 0, 1],
      [3, 4, 0, 1, 2],
      [4, 0, 1, 2, 3],
    ]);
    const result = findMatchGroups(board);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].shape).toBe('plain');
    expect(result.groups[0].cells.length).toBe(3);
  });

  it('detects a straight 4-match and spawns a striped tile', () => {
    const board = makeBoardFromTypes([
      [0, 0, 0, 0, 2],
      [1, 2, 3, 4, 0],
      [2, 3, 4, 0, 1],
      [3, 4, 0, 1, 2],
      [4, 0, 1, 2, 3],
    ]);
    const result = findMatchGroups(board, [{ row: 0, col: 1 }]);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].shape).toBe('striped-h');
    expect(result.groups[0].spawnCell).toEqual({ row: 0, col: 1 });

    const step = applyMatchResult(board, result, 5);
    // spawn cell should now hold a striped-h special tile (not cleared to null,
    // since gravity keeps things bottom-anchored — but spawn cell content check
    // is easier before gravity, so verify via a fresh matchResult application
    // using a board where the spawn row is the bottom row).
    expect(step.events.some((e) => e.kind === 'striped-h' && e.created)).toBe(true);
  });

  it('detects an L-shaped 5-match and spawns a wrapped bomb', () => {
    const board = makeBoardFromTypes([
      [0, 1, 2, 3, 4],
      [0, 2, 3, 4, 0],
      [0, 0, 0, 1, 2],
      [3, 4, 1, 2, 3],
      [4, 1, 2, 3, 4],
    ]);
    // Column 0 rows 0-2 = [0,0,0] (vertical run of 3), row 2 cols 0-2 = [0,0,0] (horizontal run of 3)
    // intersecting at (2,0) => L-shape => wrapped
    const result = findMatchGroups(board, [{ row: 2, col: 0 }]);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].shape).toBe('wrapped');
  });

  it('detects a straight 5-match and spawns a color bomb', () => {
    const board = makeBoardFromTypes([
      [0, 0, 0, 0, 0],
      [1, 2, 3, 4, 1],
      [2, 3, 4, 1, 2],
      [3, 4, 1, 2, 3],
      [4, 1, 2, 3, 4],
    ]);
    const result = findMatchGroups(board, [{ row: 0, col: 2 }]);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].shape).toBe('color-bomb');
  });

  it('striped tile activation clears the full row when caught in a later match', () => {
    // Row 0 has a pre-existing striped-h tile at (0,2). Trigger a match elsewhere
    // that includes (0,2) in the cleared set indirectly is hard to construct by
    // hand, so instead directly test specialClearCells via applyMatchResult with
    // a matchedCells set that includes the striped tile's position.
    const board: Board = [
      [
        { id: 1, type: 0 },
        { id: 2, type: 0 },
        { id: 3, type: 0, special: 'striped-h' },
        { id: 4, type: 1 },
        { id: 5, type: 2 },
      ],
      [
        { id: 6, type: 1 },
        { id: 7, type: 2 },
        { id: 8, type: 3 },
        { id: 9, type: 4 },
        { id: 10, type: 0 },
      ],
    ];
    const matchResult = {
      groups: [{ type: 0, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }], shape: 'plain' as const }],
      matchedCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
    };
    const step = applyMatchResult(board, matchResult, 5);
    // The striped tile at (0,2) was part of the cleared cells -> should activate
    // and clear the ENTIRE row 0 (all 5 cells), not just the 3 matched ones.
    expect(step.clearedCount).toBe(5);
    expect(step.events.some((e) => e.kind === 'striped-h' && !e.created)).toBe(true);
  });

  it('isAdjacent works correctly', () => {
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });

  it('swap exchanges two tiles without mutating the original board', () => {
    const board = makeBoardFromTypes([
      [0, 1],
      [2, 3],
    ]);
    const swapped = swap(board, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(swapped[0][0]?.type).toBe(1);
    expect(swapped[0][1]?.type).toBe(0);
    expect(board[0][0]?.type).toBe(0); // original untouched
  });

  it('gravity refills columns and keeps existing tiles at the bottom', () => {
    const board = makeBoardFromTypes([
      [0, 0, 0, 1, 2],
      [1, 2, 3, 4, 0],
      [2, 3, 4, 0, 1],
      [3, 4, 0, 1, 2],
      [4, 0, 1, 2, 3],
    ]);
    const result = findMatchGroups(board);
    const step = applyMatchResult(board, result, 5);
    // After clearing row 0 cols 0-2 and refilling, board should have no nulls
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(step.board[r][c]).not.toBeNull();
      }
    }
  });
});
