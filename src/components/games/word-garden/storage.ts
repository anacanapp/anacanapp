import { writeStorageItem } from '@/lib/local-storage';
import { createGardenProfile } from './state';
import type { GardenPreferences, GardenProfile, WordGardenMode } from './model';
import { WORD_GARDEN_LIBRARIES, WORD_GARDEN_PREVIOUS_REVISIONS } from './library';

export const gardenStorageKey = (language: string, revision: string, mode: WordGardenMode) => `anacan_word_garden_v1:${language}:${revision}:${mode}`;
const preferencesKey = 'anacan_word_garden_preferences_v1';
export const DEFAULT_GARDEN_PREFERENCES: GardenPreferences = { sound: false, haptics: true, highContrast: false, reducedMotion: false, theme: 'garden' };
export function readGardenProfile(language: string, revision: string, mode: WordGardenMode): GardenProfile {
  const fallback = createGardenProfile(language, revision, mode);
  try {
    const text = localStorage.getItem(gardenStorageKey(language, revision, mode));
    if (!text) {
      if (WORD_GARDEN_LIBRARIES[language]?.revision === revision) for (const previous of WORD_GARDEN_PREVIOUS_REVISIONS[language] || []) {
        if (!localStorage.getItem(gardenStorageKey(language, previous, mode))) continue;
        const saved = readGardenProfile(language, previous, mode);
        // Keep aggregates, currency and an unfinished puzzle bound to its original
        // dictionary. The previous key is retained; only future puzzles use v2.
        return { ...saved, revision, round: saved.round?.awarded ? null : saved.round };
      }
      return fallback;
    }
    if (text.length > 100000) return fallback;
    const value = JSON.parse(text) as GardenProfile, progress = value.progress;
    const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
    if (value.schema !== fallback.schema || value.language !== language || value.revision !== revision || value.mode !== mode || !progress
      || !integer(progress.unlockedLevel) || progress.unlockedLevel < 1 || progress.unlockedLevel >= Number.MAX_SAFE_INTEGER
      || ![progress.coins, progress.totalWords, progress.totalBonusWords, progress.bestScore].every(integer)
      || !progress.levels || typeof progress.levels !== 'object' || Array.isArray(progress.levels) || Object.keys(progress.levels).length > 180
      || !Object.entries(progress.levels).every(([level, result]) => /^\d+$/.test(level) && result && [1, 2, 3].includes(result.stars) && integer(result.bestScore))
      || !progress.bonusClaims || !integer(progress.bonusClaims.level) || !Array.isArray(progress.bonusClaims.words)
      || progress.bonusClaims.words.length > 1000 || !progress.bonusClaims.words.every(word => typeof word === 'string' && word.length < 40)) return fallback;
    const saved = value.round;
    const round = saved && typeof saved === 'object' && typeof saved.levelId === 'string'
      && [revision, ...(WORD_GARDEN_PREVIOUS_REVISIONS[language] || [])].some(version => saved.levelId.startsWith(`${language}:${version}:${mode}:`)) && saved.levelId.length < 160
      && Array.isArray(saved.found) && Array.isArray(saved.bonus) && Array.isArray(saved.revealed)
      && saved.found.length <= 8 && saved.bonus.length <= 1000 && saved.revealed.length <= 121
      && typeof saved.awarded === 'boolean' ? saved : null;
    return { ...value, round };
  } catch { return fallback; }
}
export function writeGardenProfile(profile: GardenProfile): boolean {
  try { writeStorageItem(localStorage, gardenStorageKey(profile.language, profile.revision, profile.mode), JSON.stringify(profile)); return true; }
  catch { return false; }
}
export function readGardenPreferences(): GardenPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    if (!saved) return { ...DEFAULT_GARDEN_PREFERENCES };
    return { sound: saved.sound === true, haptics: saved.haptics !== false, highContrast: saved.highContrast === true,
      reducedMotion: saved.reducedMotion === true, theme: ['garden', 'lake', 'night'].includes(saved.theme) ? saved.theme : 'garden' };
  } catch { return { ...DEFAULT_GARDEN_PREFERENCES }; }
}
export function writeGardenPreferences(value: GardenPreferences) {
  try { writeStorageItem(localStorage, preferencesKey, JSON.stringify(value)); } catch { /* Optional preferences stay in memory. */ }
}
