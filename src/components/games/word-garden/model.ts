export const WORD_GARDEN_ID = 'word-garden';
export const LEVEL_PAGE_SIZE = 20;
export const HINT_COST = 25;
export type WordGardenMode = 'calm' | 'timed';
export type WordTier = 'common' | 'standard' | 'bonus';
export type GardenTheme = 'garden' | 'lake' | 'night';
export interface LexiconWord { word: string; frequency: number; tier: WordTier; definition?: string }
export interface WordLexicon {
  schema: 'anacan-word-garden-lexicon-v1'; language: string; revision: string; locale: string;
  alphabet: string[]; minLength: number; maxLength: number; openingRacks: string[]; words: LexiconWord[];
  source: { name: string; url: string; license: string; licenseUrl: string; sha256: string; note: string };
}
export interface GardenWord { id: string; word: string; letters: string[]; row: number; column: number; direction: 'across' | 'down'; definition?: string }
export interface GardenCell { row: number; column: number; letter: string; wordIds: string[] }
export interface WordGardenLevel {
  schema: 'anacan-word-garden-level-v1'; language: string; revision: string; level: number; mode: WordGardenMode;
  id: string; seed: number; letters: string[]; words: GardenWord[]; bonusWords: string[];
  cells: GardenCell[]; rows: number; columns: number; difficulty: 1 | 2 | 3 | 4 | 5; timeLimit: number | null;
}
export interface GardenRound {
  levelId: string; found: string[]; bonus: string[]; revealed: string[]; hintsUsed: number;
  elapsedSeconds: number; remainingSeconds: number | null; awarded: boolean; started?: boolean;
}
export interface GardenResult { level: number; score: number; stars: 1 | 2 | 3; bonusWords: number; hintsUsed: number }
export interface GardenPreferences {
  sound: boolean; haptics: boolean; highContrast: boolean; reducedMotion: boolean; theme: GardenTheme;
}
export interface GardenProgress {
  unlockedLevel: number; coins: number; totalWords: number; totalBonusWords: number; bestScore: number;
  levels: Record<string, { stars: 1 | 2 | 3; bestScore: number }>;
  bonusClaims: { level: number; words: string[] };
}
export interface GardenProfile {
  schema: 'anacan-word-garden-profile-v1'; language: string; revision: string; mode: WordGardenMode;
  progress: GardenProgress; round: GardenRound | null;
}
export interface LevelProfile { rackLength: number; targetWords: number; difficulty: WordGardenLevel['difficulty'] }
export function getGardenLevelProfile(level: number): LevelProfile {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error('WORD_GARDEN_LEVEL_INVALID');
  if (level <= 10) return { rackLength: 4, targetWords: 3, difficulty: 1 };
  if (level <= 40) return { rackLength: 5, targetWords: 4, difficulty: 2 };
  if (level <= 100) return { rackLength: 6, targetWords: 5, difficulty: 3 };
  if (level <= 220) return { rackLength: 7, targetWords: 6, difficulty: 4 };
  return { rackLength: 8, targetWords: 7 + level % 2, difficulty: 5 };
}
export function gardenTimeLimit(words: readonly Pick<GardenWord, 'letters'>[], rackLength: number, difficulty: WordGardenLevel['difficulty']): number {
  const letters = words.reduce((sum, word) => sum + word.letters.length, 0);
  // A short, readable challenge: more answers/letters earn a little more time.
  return Math.max(25, Math.min(100, Math.round(10 + words.length * 4 + letters * .9 + Math.max(0, rackLength - 4) * 2 + (difficulty - 1) * 2)));
}
export const cellKey = (cell: Pick<GardenCell, 'row' | 'column'>) => `${cell.row}:${cell.column}`;
