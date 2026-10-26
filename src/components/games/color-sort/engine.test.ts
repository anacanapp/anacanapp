import { describe, expect, it } from 'vitest';
import { boardKey, completedCount, inspectPour, isLocked, isSolved, pour, replaySolution, solve, validateBoard } from './engine';
import { BUNDLED_LEVELS, getFallbackLevel, validateLevel } from './levels';
import { getLevelProfile, MAX_LEVEL_COUNT } from './difficulty';
import { generateLevel } from './generator';
import { addTube, boardOf, createSession, pourSession, readSavedSession, saveSession, undoSession } from './session';

describe('Color Sort rules and shipped levels', () => {
  it('pours only the contiguous top color and fits the target without mutating the input', () => {
    const board = [[0, 1, 1, 1], [0, 1, 1], []], original = structuredClone(board), rules = { capacity: 4, locks: [] };
    const result = pour(board, rules, { from: 0, to: 1 })!;
    expect(result.amount).toBe(1);
    expect(result.board).toEqual([[0, 1, 1], [0, 1, 1, 1], []]);
    expect(board).toEqual(original);
    expect(inspectPour([[0, 1], [0], []], rules, 0, 1).reason).toBe('different');
    expect(inspectPour(board, rules, 2, 0).reason).toBe('empty');
    expect(inspectPour(board, rules, 0, 0).amount).toBe(0);
  });

  it('opens an empty locked tube only after a completed color, and seals finished tubes', () => {
    const rules = { capacity: 4, locks: [{ tube: 4, after: 1 }] };
    let board = [[0, 0, 1, 1], [1, 1, 0, 0], [], [], []];
    expect(isLocked(board, rules, 4)).toBe(true);
    expect(inspectPour(board, rules, 0, 4).reason).toBe('locked');
    board = pour(board, rules, { from: 0, to: 2 })!.board;
    board = pour(board, rules, { from: 1, to: 0 })!.board;
    expect(completedCount(board, 4)).toBe(1);
    expect(isLocked(board, rules, 4)).toBe(false);
    expect(inspectPour(board, rules, 0, 4).reason).toBe('complete');
    expect(isSolved(pour(board, rules, { from: 2, to: 1 })!.board, 4)).toBe(true);
  });

  it('ships thirty different puzzles with fully replayable solutions inside their move budgets', () => {
    expect(BUNDLED_LEVELS).toHaveLength(30);
    expect(new Set(BUNDLED_LEVELS.map(level => JSON.stringify(level.board))).size).toBe(30);
    BUNDLED_LEVELS.forEach((level, index) => {
      expect(level.level).toBe(index + 1);
      expect(validateLevel(level, level.level), `level ${level.level}`).toBe(true);
      expect(isSolved(level.board, level.rules.capacity)).toBe(false);
      expect(replaySolution(level.board, level.rules, level.solution), `solution ${level.level}`).not.toBeNull();
      if (level.moveLimit !== null) expect(level.moveLimit).toBeGreaterThanOrEqual(level.solution.length);
    });
    expect(getLevelProfile(1).colors).toBeLessThan(getLevelProfile(30).colors);
    expect(getLevelProfile(1).emptyTubes).toBeGreaterThan(getLevelProfile(30).emptyTubes);
    expect(getLevelProfile(30)).toMatchObject({ lockedTubes: 2, hiddenTubes: 3, limitedMoves: true });
  });

  it('has verified offline fallback levels beyond the initial catalog, including remapped locks', () => {
    for (const number of [31, 40, 75, MAX_LEVEL_COUNT]) {
      const level = getFallbackLevel(number);
      expect(validateLevel(level, number), `fallback ${number}`).toBe(true);
      expect(replaySolution(level.board, level.rules, level.solution)).not.toBeNull();
    }
  });

  it('generates an additional reproducible puzzle and finds a legal hint path', () => {
    const level = generateLevel(31, { maxAttempts: 40, maxNodes: 20_000 })!;
    expect(level).not.toBeNull();
    expect(validateLevel(level, 31)).toBe(true);
    const result = solve(level.board, level.rules, { maxNodes: 30_000 });
    expect(result.status).toBe('solved');
    if (result.status === 'solved') expect(replaySolution(level.board, level.rules, result.moves)).not.toBeNull();
  }, 20_000);

  it('distinguishes a genuinely blocked state from a bounded search and rejects malformed boards', () => {
    const blocked = [[0, 1, 0, 1], [1, 0, 1, 0], []], rules = { capacity: 4, locks: [{ tube: 2, after: 1 }] };
    expect(solve(blocked, rules).status).toBe('unsolvable');
    const level = BUNDLED_LEVELS[0];
    expect(solve(level.board, level.rules, { maxDepth: 0 }).status).toBe('limit');
    expect(validateBoard([[0, 9], []], 2, rules)).toBe(false);
    expect(validateLevel({ ...level, solution: [null] }, 1)).toBe(false);
    expect(boardKey([[1, 0, 11]], { capacity: 4, locks: [] })).not.toBe(boardKey([[10, 1, 1]], { capacity: 4, locks: [] }));
  });
});

describe('Color Sort local round', () => {
  it('undo restores liquid and lock eligibility but retains revealed knowledge', () => {
    const level = BUNDLED_LEVELS[15];
    let state = createSession(level);
    const initial = structuredClone(state);
    expect(state.revealed.length).toBeLessThan(state.tubes.flat().length);
    state = pourSession(state, level, level.solution[0])!.session;
    const known = state.revealed;
    const undone = undoSession(state)!;
    expect(boardOf(undone)).toEqual(level.board);
    expect(undone.moves).toBe(0);
    expect(undone.revealed).toEqual(expect.arrayContaining(known));
    expect(state.moves).toBe(1);
    expect(initial.tubes).toEqual(createSession(level).tubes);
  });

  it('adds only one free tube, preserves every unit and persists/resumes the current round', () => {
    const level = BUNDLED_LEVELS[3];
    let state = pourSession(createSession(level), level, level.solution[0])!.session;
    state = addTube(state)!;
    expect(state.tubes).toHaveLength(level.board.length + 1);
    expect(state.tubes.flat()).toHaveLength(level.colors * 4);
    expect(addTube(state)).toBeNull();
    expect(state.history).toEqual([]);
    saveSession(state, level);
    expect(readSavedSession(level)).toEqual(state);
    expect(readSavedSession(BUNDLED_LEVELS[0])).toBeNull();
    localStorage.setItem('anacan_colorsort_round_v1', '{bad');
    expect(readSavedSession(level)).toBeNull();
  });
});
