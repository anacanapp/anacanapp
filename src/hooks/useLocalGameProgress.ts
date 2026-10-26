import { useCallback, useEffect, useState } from 'react';

// Device-local progress tracking for mini-games (level unlocks, stars, best scores).
// This works fully offline/without login so gameplay + progression is never blocked
// by network/auth state. Global leaderboard sync (Supabase) is layered on top separately.

export interface LevelProgress {
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
}

export interface GameProgress {
  unlockedLevel: number; // highest level index the player may play (1-based)
  levels: Record<number, LevelProgress>;
  bestScoreOverall: number;
}

const STORAGE_PREFIX = 'anacan_minigame_progress_';

const defaultProgress: GameProgress = {
  unlockedLevel: 1,
  levels: {},
  bestScoreOverall: 0,
};

function readProgress(gameId: string): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + gameId);
    if (!raw) return { ...defaultProgress };
    const parsed = JSON.parse(raw);
    return {
      unlockedLevel: parsed.unlockedLevel || 1,
      levels: parsed.levels || {},
      bestScoreOverall: parsed.bestScoreOverall || 0,
    };
  } catch {
    return { ...defaultProgress };
  }
}

function writeProgress(gameId: string, progress: GameProgress) {
  try {
    localStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(progress));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function useLocalGameProgress(gameId: string) {
  const [progress, setProgress] = useState<GameProgress>(() => readProgress(gameId));

  useEffect(() => {
    setProgress(readProgress(gameId));
  }, [gameId]);

  const recordLevelResult = useCallback(
    (level: number, score: number, stars: 0 | 1 | 2 | 3, passed: boolean) => {
      setProgress((prev) => {
        const existing = prev.levels[level];
        const nextLevels: Record<number, LevelProgress> = {
          ...prev.levels,
          [level]: {
            stars: Math.max(existing?.stars || 0, stars) as 0 | 1 | 2 | 3,
            bestScore: Math.max(existing?.bestScore || 0, score),
          },
        };
        const nextUnlocked = passed ? Math.max(prev.unlockedLevel, level + 1) : prev.unlockedLevel;
        const next: GameProgress = {
          unlockedLevel: nextUnlocked,
          levels: nextLevels,
          bestScoreOverall: Math.max(prev.bestScoreOverall, score),
        };
        writeProgress(gameId, next);
        return next;
      });
    },
    [gameId]
  );

  const isLevelUnlocked = useCallback((level: number) => level <= progress.unlockedLevel, [progress.unlockedLevel]);

  return { progress, recordLevelResult, isLevelUnlocked };
}
