import { writeStorageItem } from '@/lib/local-storage';

export interface CasualProfile<Round> {
  schema: 'anacan-casual-profile-v1'; game: string; revision: string;
  unlocked: number; levels: Record<string, { stars: 1 | 2 | 3; score: number }>; round: Round | null;
}
export const casualStorageKey = (game: string, revision: string) => `anacan_casual_v1:${game}:${revision}`;
export function readCasualProfile<Round>(game: string, revision: string, count: number, validateRound: (round: unknown) => round is Round): CasualProfile<Round> {
  const fallback: CasualProfile<Round> = { schema: 'anacan-casual-profile-v1', game, revision, unlocked: 1, levels: {}, round: null };
  try {
    const raw = localStorage.getItem(casualStorageKey(game, revision)); if (!raw || raw.length > 28000) return fallback;
    const value = JSON.parse(raw) as CasualProfile<Round>;
    if (value.schema !== fallback.schema || value.game !== game || value.revision !== revision || !Number.isInteger(value.unlocked)
      || value.unlocked < 1 || value.unlocked > count || !value.levels || Array.isArray(value.levels) || Object.keys(value.levels).length > count
      || !Object.entries(value.levels).every(([level, result]) => /^\d+$/.test(level) && Number(level) >= 1 && Number(level) <= count
        && result && [1, 2, 3].includes(result.stars) && Number.isSafeInteger(result.score) && result.score >= 0)) return fallback;
    const round = validateRound(value.round) && typeof (value.round as { level?: number })?.level === 'number'
      && (value.round as { level: number }).level <= value.unlocked ? value.round : null;
    return { ...value, round };
  } catch { return fallback; }
}
export function writeCasualProfile<Round>(value: CasualProfile<Round>): boolean {
  try { writeStorageItem(localStorage, casualStorageKey(value.game, value.revision), JSON.stringify(value)); return true; } catch { return false; }
}
export function recordCasualWin<Round>(profile: CasualProfile<Round>, level: number, count: number, result: { stars: 1 | 2 | 3; score: number }): CasualProfile<Round> {
  const previous = profile.levels[String(level)];
  return { ...profile, round: null, unlocked: Math.max(profile.unlocked, Math.min(count, level + 1)), levels: { ...profile.levels,
    [level]: { stars: Math.max(previous?.stars || 0, result.stars) as 1 | 2 | 3, score: Math.max(previous?.score || 0, result.score) } } };
}
