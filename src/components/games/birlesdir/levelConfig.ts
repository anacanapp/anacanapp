// Birləşdir — match-3 level configuration (40 levels, 5 tiers: Asan→Əfsanə).

export const TOTAL_LEVELS = 40;
export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

export interface BirlesdirLevelConfig {
  level: number;
  movesLimit: number;
  targetScore: number;
  tileTypesCount: number;
  tierName: string;
  // Per-tier score multiplier applied on top of raw clear/combo scoring, so the
  // displayed target-score curve climbs smoothly across all 20 levels even
  // though higher tiers use more tile types (which makes matches rarer and
  // raw achievable scores lower). Calibrated against random-playthrough
  // simulation so an average round lands around the 1-star mark with room
  // for skilled/lucky play to reach 2-3 stars.
  scoreMultiplier: number;
}

interface Tier {
  name: string;
  minLevel: number;
  maxLevel: number;
  movesBase: number;
  movesStep: number;
  tileTypesCount: number;
  scoreMultiplier: number;
}

// Smooth, always-increasing target curve across all 20 levels (independent of
// tier so the numbers always feel like real progression to the player).
const TARGET_BASE = 800;
const TARGET_STEP = 150;

const TIERS: Tier[] = [
  { name: 'Asan', minLevel: 1, maxLevel: 7, movesBase: 24, movesStep: 1, tileTypesCount: 5, scoreMultiplier: 0.47 },
  { name: 'Orta', minLevel: 8, maxLevel: 14, movesBase: 26, movesStep: 1, tileTypesCount: 6, scoreMultiplier: 1.34 },
  { name: 'Çətin', minLevel: 15, maxLevel: 20, movesBase: 28, movesStep: 1, tileTypesCount: 7, scoreMultiplier: 1.94 },
  // ── Yeni tier-lər (21-40): gedişlər ARTMIR (sabit təzyiq), hədəf qalxmağa
  //    davam edir; multiplier yüksəkdir ki, bacarıqlı kombolarla çatmaq mümkün
  //    olsun — amma az gedişlə hər xəta baha başa gəlir.
  { name: 'Usta', minLevel: 21, maxLevel: 30, movesBase: 27, movesStep: 0, tileTypesCount: 7, scoreMultiplier: 2.25 },
  { name: 'Əfsanə', minLevel: 31, maxLevel: 40, movesBase: 25, movesStep: 0, tileTypesCount: 7, scoreMultiplier: 2.55 },
];

export const TIER_NAMES = TIERS.map((t) => t.name);

function getTier(level: number): Tier {
  return TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel) || TIERS[TIERS.length - 1];
}

export function getLevelConfig(level: number): BirlesdirLevelConfig {
  const lvl = Math.min(Math.max(level, 1), TOTAL_LEVELS);
  const tier = getTier(lvl);
  const offset = lvl - tier.minLevel;

  return {
    level: lvl,
    movesLimit: tier.movesBase + tier.movesStep * offset,
    targetScore: Math.round(TARGET_BASE + TARGET_STEP * (lvl - 1)),
    tileTypesCount: tier.tileTypesCount,
    tierName: tier.name,
    scoreMultiplier: tier.scoreMultiplier,
  };
}

export function getLevelSections(): { label: string; levels: number[] }[] {
  return TIERS.map((tier) => ({
    label: tier.name,
    levels: Array.from({ length: tier.maxLevel - tier.minLevel + 1 }, (_, i) => tier.minLevel + i),
  }));
}

export function getStarsForScore(score: number, targetScore: number): 0 | 1 | 2 | 3 {
  if (score < targetScore) return 0;
  if (score >= targetScore * 1.5) return 3;
  if (score >= targetScore * 1.2) return 2;
  return 1;
}
