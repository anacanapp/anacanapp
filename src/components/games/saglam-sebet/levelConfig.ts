// Sağlam Səbət — level & item configuration
// 60 hand-tuned difficulty levels for the "catch the healthy object" arcade game,
// grouped into 6 difficulty tiers (Rahat→Əfsanə) with longer, more relaxed sessions.

export const TOTAL_LEVELS = 60;

export interface GameItemDef {
  emoji: string;
  label: string;
  points: number;
}

// Healthy items — catching these earns points
export const GOOD_ITEMS: GameItemDef[] = [
  { emoji: '🍎', label: 'Alma', points: 10 },
  { emoji: '🥦', label: 'Brokoli', points: 12 },
  { emoji: '💧', label: 'Su', points: 8 },
  { emoji: '🥛', label: 'Süd', points: 10 },
  { emoji: '🥕', label: 'Yerkökü', points: 8 },
  { emoji: '🍊', label: 'Portağal', points: 10 },
  { emoji: '🥑', label: 'Avokado', points: 14 },
  { emoji: '🐟', label: 'Balıq', points: 15 },
  { emoji: '🍇', label: 'Üzüm', points: 9 },
  { emoji: '🥗', label: 'Salat', points: 12 },
];

// Harmful items — catching these costs a life (heart)
export const BAD_ITEMS: GameItemDef[] = [
  { emoji: '🍔', label: 'Fast-food', points: 0 },
  { emoji: '🍟', label: 'Qızarmış kartof', points: 0 },
  { emoji: '🥤', label: 'Qazlı içki', points: 0 },
  { emoji: '🍩', label: 'Donut', points: 0 },
  { emoji: '🍕', label: 'Pizza', points: 0 },
  { emoji: '🍬', label: 'Şəkərli konfet', points: 0 },
  { emoji: '🌧️', label: 'Stress buludu', points: 0 },
  { emoji: '😪', label: 'Yuxusuzluq', points: 0 },
];

export interface LevelConfig {
  level: number;
  // milliseconds between spawns
  spawnInterval: number;
  // pixels per second the object falls
  fallSpeed: number;
  // fall speed variance (randomized +/- this fraction)
  speedVariance: number;
  // probability (0-1) that a spawned item is a "bad" item
  badChance: number;
  // number of lives (hearts) player starts with
  lives: number;
  // score required to pass the level
  targetScore: number;
  // level duration in seconds
  duration: number;
  // difficulty tier this level belongs to (for grouping/labeling in the UI)
  tierName: string;
  tierIndex: number;
}

interface DifficultyTier {
  name: string;
  minLevel: number;
  maxLevel: number;
  fallSpeedRange: [number, number];
  spawnIntervalRange: [number, number];
  badChanceRange: [number, number];
  durationRange: [number, number];
  targetBase: number;
  targetStep: number;
  lives: number;
}

// 4 comfortable, clearly distinct difficulty tiers (10 levels each = 40 total).
// Within a tier, pacing ramps up smoothly; between tiers there's a noticeable
// (but still fair) jump, giving the levels real variety instead of one long
// monotonic grind. Sessions are longer overall (42s-80s) so a round feels like
// a proper relaxing break rather than a rushed reflex test.
const TIERS: DifficultyTier[] = [
  {
    name: 'Rahat',
    minLevel: 1,
    maxLevel: 10,
    fallSpeedRange: [90, 145],
    spawnIntervalRange: [820, 1000],
    badChanceRange: [0.08, 0.18],
    durationRange: [42, 54],
    targetBase: 50,
    targetStep: 14,
    lives: 4,
  },
  {
    name: 'Orta',
    minLevel: 11,
    maxLevel: 20,
    fallSpeedRange: [145, 195],
    spawnIntervalRange: [620, 800],
    badChanceRange: [0.18, 0.28],
    durationRange: [50, 62],
    targetBase: 230,
    targetStep: 18,
    lives: 4,
  },
  {
    name: 'Çətin',
    minLevel: 21,
    maxLevel: 30,
    fallSpeedRange: [195, 255],
    spawnIntervalRange: [460, 620],
    badChanceRange: [0.28, 0.38],
    durationRange: [56, 68],
    targetBase: 460,
    targetStep: 22,
    lives: 3,
  },
  {
    name: 'Ekspert',
    minLevel: 31,
    maxLevel: 40,
    fallSpeedRange: [255, 330],
    spawnIntervalRange: [320, 460],
    badChanceRange: [0.38, 0.48],
    durationRange: [60, 78],
    targetBase: 700,
    targetStep: 26,
    lives: 3,
  },
  // ── Yeni tier-lər (41-60): daha sürətli, daha riskli, daha uzun raundlar ──
  {
    name: 'Usta',
    minLevel: 41,
    maxLevel: 50,
    fallSpeedRange: [330, 400],
    spawnIntervalRange: [280, 400],
    badChanceRange: [0.46, 0.54],
    durationRange: [66, 84],
    targetBase: 980,
    targetStep: 30,
    lives: 3,
  },
  {
    name: 'Əfsanə',
    minLevel: 51,
    maxLevel: 60,
    fallSpeedRange: [400, 480],
    spawnIntervalRange: [240, 340],
    badChanceRange: [0.52, 0.6],
    durationRange: [72, 90],
    targetBase: 1300,
    targetStep: 34,
    lives: 2,
  },
];

export const TIER_NAMES = TIERS.map((t) => t.name);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function getTier(level: number): { tier: DifficultyTier; index: number } {
  const index = TIERS.findIndex((t) => level >= t.minLevel && level <= t.maxLevel);
  return index === -1 ? { tier: TIERS[TIERS.length - 1], index: TIERS.length - 1 } : { tier: TIERS[index], index };
}

// Generate a balanced, comfortable difficulty curve for levels 1-40.
export function getLevelConfig(level: number): LevelConfig {
  const lvl = Math.min(Math.max(level, 1), TOTAL_LEVELS);
  const { tier, index } = getTier(lvl);
  const span = Math.max(tier.maxLevel - tier.minLevel, 1);
  const t = (lvl - tier.minLevel) / span; // 0..1 progress within the tier

  const fallSpeed = Math.round(lerp(tier.fallSpeedRange[0], tier.fallSpeedRange[1], t));
  const spawnInterval = Math.round(lerp(tier.spawnIntervalRange[0], tier.spawnIntervalRange[1], t));
  const badChance = +lerp(tier.badChanceRange[0], tier.badChanceRange[1], t).toFixed(3);
  const duration = Math.round(lerp(tier.durationRange[0], tier.durationRange[1], t));
  const targetScore = Math.round(tier.targetBase + tier.targetStep * (lvl - tier.minLevel));

  return {
    level: lvl,
    spawnInterval,
    fallSpeed,
    speedVariance: 0.22,
    badChance,
    lives: tier.lives,
    targetScore,
    duration,
    tierName: tier.name,
    tierIndex: index,
  };
}

// Groups of levels per difficulty tier, for a sectioned level-select screen.
export function getLevelSections(): { label: string; levels: number[] }[] {
  return TIERS.map((tier) => ({
    label: tier.name,
    levels: Array.from({ length: tier.maxLevel - tier.minLevel + 1 }, (_, i) => tier.minLevel + i),
  }));
}

// Star rating for a completed level based on how far past the target the player scored.
export function getStarsForScore(score: number, targetScore: number): 0 | 1 | 2 | 3 {
  if (score < targetScore) return 0;
  if (score >= targetScore * 1.6) return 3;
  if (score >= targetScore * 1.25) return 2;
  return 1;
}
