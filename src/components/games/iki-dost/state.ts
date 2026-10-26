import { friendsLevel } from './levels';
import { friendsSolved, replayFriends } from './engine';
import { TWO_FRIENDS_LEVELS, TWO_FRIENDS_REVISION, type FriendsProfile, type FriendsRound, type FriendsLevel } from './model';
import { writeStorageItem } from '@/lib/local-storage';

export const FRIENDS_STORAGE_KEY = `anacan_two_friends_v1:${TWO_FRIENDS_REVISION}`;
export const FRIENDS_PREFERENCES_KEY = 'anacan_two_friends_preferences_v1';
export const FRIENDS_PATH_LIMIT = 320;
export const FRIENDS_HINT_LIMIT = 3;
export function createFriendsProfile(): FriendsProfile {
  return { schema: 'anacan-two-friends-profile-v1', revision: TWO_FRIENDS_REVISION,
    progress: { unlocked: 1, totalRescues: 0, bestScore: 0, levels: {} }, round: null };
}
export const createFriendsRound = (level: number): FriendsRound => ({ level, path: [], moves: 0, hints: 0, undos: 0, awarded: false });
export function friendsResult(level: FriendsLevel, round: FriendsRound) {
  const stars: 1 | 2 | 3 = round.hints === 0 && round.moves <= level.par ? 3 : round.hints <= 1 && round.moves <= level.par + 8 ? 2 : 1;
  return { stars, score: Math.max(100, 500 + stars * 150 + level.chapter * 100 - Math.max(0, round.moves - level.par) * 10 - round.hints * 30) };
}
export function completeFriendsLevel(profile: FriendsProfile, level: FriendsLevel): FriendsProfile {
  const round = profile.round;
  if (!round || round.level !== level.level || round.awarded || !friendsSolved(level, replayFriends(level, round.path).state)) return profile;
  const result = friendsResult(level, round), previous = profile.progress.levels[String(level.level)];
  const firstWin = !previous;
  return { ...profile, round: { ...round, awarded: true }, progress: { ...profile.progress,
    unlocked: Math.max(profile.progress.unlocked, Math.min(TWO_FRIENDS_LEVELS, level.level + 1)),
    totalRescues: profile.progress.totalRescues + (firstWin ? 2 : 0), bestScore: Math.max(profile.progress.bestScore, result.score),
    levels: { ...profile.progress.levels, [level.level]: { stars: Math.max(previous?.stars || 0, result.stars) as 1 | 2 | 3,
      score: Math.max(previous?.score || 0, result.score) } } } };
}
export function readFriendsProfile(): FriendsProfile {
  const fallback = createFriendsProfile();
  try {
    const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!raw || raw.length > 24000) return fallback;
    const saved = JSON.parse(raw) as FriendsProfile, progress = saved.progress;
    const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
    if (saved.schema !== fallback.schema || saved.revision !== TWO_FRIENDS_REVISION || !progress
      || !integer(progress.unlocked) || progress.unlocked < 1 || progress.unlocked > TWO_FRIENDS_LEVELS
      || !integer(progress.totalRescues) || progress.totalRescues > TWO_FRIENDS_LEVELS * 2 || !integer(progress.bestScore)
      || !progress.levels || Array.isArray(progress.levels) || Object.keys(progress.levels).length > TWO_FRIENDS_LEVELS
      || !Object.entries(progress.levels).every(([key, value]) => /^\d+$/.test(key) && Number(key) >= 1 && Number(key) <= TWO_FRIENDS_LEVELS
        && value && [1, 2, 3].includes(value.stars) && integer(value.score))) return fallback;
    let round = saved.round;
    if (round) {
      try {
        if (!integer(round.level) || round.level < 1 || round.level > progress.unlocked || !Array.isArray(round.path)
          || round.path.length > FRIENDS_PATH_LIMIT || ![round.moves, round.hints, round.undos].every(integer)
          || round.moves < round.path.length || round.hints > FRIENDS_HINT_LIMIT || typeof round.awarded !== 'boolean') throw new Error('INVALID_ROUND');
        const replay = replayFriends(friendsLevel(round.level), round.path);
        if (round.awarded && !friendsSolved(friendsLevel(round.level), replay.state)) throw new Error('INVALID_AWARDED_ROUND');
      } catch { round = null; }
    }
    return { ...saved, round };
  } catch { return fallback; }
}
export function writeFriendsProfile(profile: FriendsProfile): boolean {
  try { writeStorageItem(localStorage, FRIENDS_STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
