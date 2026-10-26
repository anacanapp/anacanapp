import type { GameResult, RunStats } from './game/model';

export const STARTER_CREDITS = 250;
export const ACTIVITY_REWARDS = { investment: 3, asset: 18, acquisition: 45 } as const;
export const activityCredits = (stats: RunStats) => stats.investments * ACTIVITY_REWARDS.investment + stats.assets * ACTIVITY_REWARDS.asset + stats.acquisitions * ACTIVITY_REWARDS.acquisition + (stats.funds ?? 0) * 35 + (stats.bonusCredits ?? 0);
export const resultCredits = (result: GameResult) => activityCredits(result.stats);
