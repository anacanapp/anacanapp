import { cellKey, HINT_COST, type GardenProfile, type GardenRound, type GardenResult, type WordGardenLevel, type WordGardenMode } from './model';

export const createGardenProfile = (language: string, revision: string, mode: WordGardenMode): GardenProfile => ({
  schema: 'anacan-word-garden-profile-v1', language, revision, mode,
  progress: { unlockedLevel: 1, coins: 75, totalWords: 0, totalBonusWords: 0, bestScore: 0, levels: {}, bonusClaims: { level: 1, words: [] } }, round: null,
});
export function createGardenRound(level: WordGardenLevel): GardenRound {
  return { levelId: level.id, found: [], bonus: [], revealed: [], hintsUsed: 0, elapsedSeconds: 0, remainingSeconds: level.timeLimit, awarded: false, started: level.mode === 'calm' };
}
export function visibleGardenCells(level: WordGardenLevel, round: GardenRound): Set<string> {
  const found = new Set(round.found);
  return new Set([...round.revealed, ...level.cells.filter(cell => cell.wordIds.some(id => found.has(id))).map(cellKey)]);
}
export function gardenResult(level: WordGardenLevel, round: GardenRound): GardenResult {
  const stars = round.hintsUsed === 0 ? 3 : round.hintsUsed <= 2 ? 2 : 1;
  const letters = level.words.reduce((sum, word) => sum + word.letters.length, 0);
  const clockBonus = level.mode === 'timed' ? Math.min(300, Math.floor(Math.max(0, round.remainingSeconds || 0) * 2)) : 0;
  return { level: level.level, score: Math.max(10, letters * 30 + stars * 100 + round.bonus.length * 25 + clockBonus - round.hintsUsed * 15),
    stars, bonusWords: round.bonus.length, hintsUsed: round.hintsUsed };
}
export function isGardenSolved(level: WordGardenLevel, round: GardenRound) {
  return round.levelId === level.id && level.words.every(word => round.found.includes(word.id));
}
export type WordDecision = 'found' | 'bonus' | 'already' | 'short' | 'invalid';
export function submitGardenWord(profile: GardenProfile, level: WordGardenLevel, word: string): { profile: GardenProfile; decision: WordDecision; reward: number } {
  const round = profile.round;
  if (!round || round.levelId !== level.id || round.awarded || round.remainingSeconds === 0) return { profile, decision: 'invalid', reward: 0 };
  if (Array.from(word).length < 3) return { profile, decision: 'short', reward: 0 };
  if (round.found.includes(word) || round.bonus.includes(word)) return { profile, decision: 'already', reward: 0 };
  if (level.words.some(item => item.word === word)) return {
    profile: { ...profile, round: { ...round, found: [...round.found, word] } }, decision: 'found', reward: 0,
  };
  if (!level.bonusWords.includes(word)) return { profile, decision: 'invalid', reward: 0 };
  const newRound = { ...round, bonus: [...round.bonus, word] };
  const claims = profile.progress.bonusClaims;
  const eligible = level.level === profile.progress.unlockedLevel && (claims.level !== level.level || !claims.words.includes(word));
  return { decision: 'bonus', reward: eligible ? 5 : 0, profile: { ...profile, round: newRound,
    progress: eligible ? { ...profile.progress, coins: profile.progress.coins + 5, totalBonusWords: profile.progress.totalBonusWords + 1,
      bonusClaims: { level: level.level, words: [...(claims.level === level.level ? claims.words : []), word] } } : profile.progress } };
}
export function revealGardenHint(profile: GardenProfile, level: WordGardenLevel, key: string): { profile: GardenProfile; used: boolean } {
  const round = profile.round;
  if (!round || round.levelId !== level.id || round.awarded || round.remainingSeconds === 0) return { profile, used: false };
  const visible = visibleGardenCells(level, round), cost = round.hintsUsed === 0 ? 0 : HINT_COST;
  if (visible.has(key) || !level.cells.some(cell => cellKey(cell) === key) || profile.progress.coins < cost) return { profile, used: false };
  return { used: true, profile: { ...profile, progress: { ...profile.progress, coins: profile.progress.coins - cost },
    round: { ...round, revealed: [...round.revealed, key], hintsUsed: round.hintsUsed + 1 } } };
}
export function completeGardenLevel(profile: GardenProfile, level: WordGardenLevel): { profile: GardenProfile; result: GardenResult; reward: number } | null {
  const round = profile.round;
  if (!round || !isGardenSolved(level, round)) return null;
  const result = gardenResult(level, round);
  if (round.awarded) return { profile, result, reward: 0 };
  const firstWin = level.level === profile.progress.unlockedLevel;
  const previous = profile.progress.levels[String(level.level)];
  const levels: GardenProfile['progress']['levels'] = { ...profile.progress.levels, [level.level]: { stars: Math.max(previous?.stars || 0, result.stars) as 1 | 2 | 3,
    bestScore: Math.max(previous?.bestScore || 0, result.score) } };
  // Endless levels must not grow a multi-megabyte localStorage snapshot. Keep
  // recent stars, plus monotonic aggregate progress so old replays never farm coins.
  const recent = Object.fromEntries(Object.entries(levels).sort(([a], [b]) => Number(b) - Number(a)).slice(0, 180));
  const reward = firstWin ? 20 + result.stars * 10 : 0;
  return { result, reward, profile: { ...profile, round: { ...round, awarded: true }, progress: { ...profile.progress,
    levels: recent, unlockedLevel: firstWin ? level.level + 1 : profile.progress.unlockedLevel,
    coins: profile.progress.coins + reward, bestScore: Math.max(profile.progress.bestScore, result.score),
    totalWords: profile.progress.totalWords + (firstWin ? level.words.length : 0),
    bonusClaims: firstWin ? { level: level.level + 1, words: [] } : profile.progress.bonusClaims } } };
}
export function validGardenRound(round: unknown, level: WordGardenLevel): round is GardenRound {
  if (!round || typeof round !== 'object') return false;
  const value = round as GardenRound;
  const unique = (items: unknown, valid: (item: string) => boolean, max: number) => Array.isArray(items) && items.length <= max
    && new Set(items).size === items.length && items.every(item => typeof item === 'string' && valid(item));
  return value.levelId === level.id && unique(value.found, id => level.words.some(word => word.id === id), level.words.length)
    && unique(value.bonus, word => level.bonusWords.includes(word), level.bonusWords.length)
    && unique(value.revealed, key => level.cells.some(cell => cellKey(cell) === key), level.cells.length)
    && Number.isSafeInteger(value.hintsUsed) && value.hintsUsed >= 0 && value.hintsUsed <= level.cells.length
    && Number.isFinite(value.elapsedSeconds) && value.elapsedSeconds >= 0 && value.elapsedSeconds < 365 * 86400
    && (level.mode === 'calm' ? value.remainingSeconds === null : Number.isFinite(value.remainingSeconds) && value.remainingSeconds! >= 0 && value.remainingSeconds! <= level.timeLimit! + 600)
    && (value.started === undefined || typeof value.started === 'boolean')
    && typeof value.awarded === 'boolean' && (!value.awarded || level.words.every(word => value.found.includes(word.id)));
}
