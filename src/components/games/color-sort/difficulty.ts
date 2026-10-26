import type { Board, Move, Rules } from './engine.ts';

export const COLOR_SORT_ID = 'color-sort';
export const INITIAL_LEVEL_COUNT = 30;
export const LEVEL_PACK_SIZE = 10;
export const MAX_LEVEL_COUNT = 300;
export const CAPACITY = 4;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'master' | 'expert';
export interface LevelProfile {
  level: number; difficulty: Difficulty; colors: number; emptyTubes: number;
  lockedTubes: number; hiddenTubes: number; hiddenDepth: number; limitedMoves: boolean;
}
export interface ColorSortLevel extends LevelProfile {
  version: 1; seed: number; board: Board; rules: Rules; solution: Move[];
  parMoves: number; moveLimit: number | null;
}

export function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(MAX_LEVEL_COUNT, Math.max(1, Math.floor(level))) : 1;
}

export function getLevelProfile(input: number): LevelProfile {
  const level = normalizeLevel(input);
  const colors = level === 1 ? 2 : level <= 3 ? 3 : level <= 9 ? 4 : level <= 15 ? 5 : level <= 21 ? 6 : level <= 27 ? 7 : 8;
  const difficulty: Difficulty = level <= 6 ? 'easy' : level <= 12 ? 'medium' : level <= 18 ? 'hard' : level <= 24 ? 'master' : 'expert';
  return { level, difficulty, colors, emptyTubes: level <= 6 ? 3 : level <= 15 ? 2 : 1,
    lockedTubes: level < 11 ? 0 : level < 19 ? 1 : 2,
    hiddenTubes: level < 13 ? 0 : level < 19 ? 1 : level < 25 ? 2 : Math.min(colors - 1, 3 + Math.floor((level - 25) / 10)),
    hiddenDepth: level < 25 ? 2 : 3, limitedMoves: level > 6 };
}

export function rulesForProfile(profile: LevelProfile): Rules {
  return { capacity: CAPACITY, locks: Array.from({ length: profile.lockedTubes }, (_, index) => ({
    tube: profile.colors + profile.emptyTubes + index,
    after: index === 0 ? 1 : profile.level >= 28 ? 3 : 2,
  })) };
}

export function makeLevel(profile: LevelProfile, seed: number, board: Board, solution: Move[]): ColorSortLevel {
  const slack = profile.difficulty === 'medium' ? 14 : profile.difficulty === 'hard' ? 10 : profile.difficulty === 'master' ? 8 : 6;
  return { ...profile, version: 1, seed, board, rules: rulesForProfile(profile), solution, parMoves: solution.length,
    moveLimit: profile.limitedMoves ? solution.length + Math.max(slack, Math.ceil(solution.length * 0.3)) : null };
}

export function resultForLevel(level: ColorSortLevel, moves: number, hints: number, extraTubes: number, undos: number) {
  const stars: 1 | 2 | 3 = extraTubes > 0 ? 1 : moves <= level.parMoves + 2 && hints === 0 ? 3
    : moves <= Math.ceil(level.parMoves * 1.35) + 3 ? 2 : 1;
  const efficiency = Math.max(0, (level.moveLimit ?? level.parMoves + 14) - moves);
  const score = Math.max(100, level.colors * 150 + level.level * 20 + stars * 100 + efficiency * 10 - hints * 35 - extraTubes * 80 - undos * 5);
  return { level: level.level, score, stars, passed: true as const };
}
