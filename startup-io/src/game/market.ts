export type SectorId = 'ai' | 'fintech' | 'cloud';
export type PowerKind = 'magnet' | 'firewall' | 'accelerator' | 'patent';
export type OpportunityKind = 'fund' | 'talent' | 'cloud-credit' | 'patent' | 'audit';
export type FundId = 'angel' | 'seed' | 'series-a' | 'growth';
export type MarketPhase = 'steady' | 'ai-boom' | 'funding-winter' | 'gpu-shortage' | 'product-launch';

export const SECTORS: readonly { id: SectorId; color: string; logo: string }[] = [
  { id: 'ai', color: '#8dc8e7', logo: 'circuit' },
  { id: 'fintech', color: '#b9d994', logo: 'wave' },
  { id: 'cloud', color: '#bea8e5', logo: 'cube' },
];
export const FUNDS: readonly { id: FundId; name: string; fraction: number; minimum: number; color: string; power: PowerKind }[] = [
  { id: 'angel', name: 'Emberlane Angels', fraction: .26, minimum: 12, color: '#bee18b', power: 'magnet' },
  { id: 'seed', name: 'Mossgate Seed', fraction: .4, minimum: 24, color: '#ddc38b', power: 'accelerator' },
  { id: 'series-a', name: 'Prismvale Capital', fraction: .56, minimum: 40, color: '#9dc8e5', power: 'firewall' },
  { id: 'growth', name: 'Starhaven Growth', fraction: .72, minimum: 65, color: '#bdb0e7', power: 'patent' },
];
export const FUND_BY_ID = (id: FundId) => FUNDS.find(fund => fund.id === id)!;
export const POWER_DURATION: Record<PowerKind, number> = { magnet: 14, firewall: 8, accelerator: 10, patent: 16 };
export interface TimedPower { kind: PowerKind; until: number }
export interface Opportunity { id: number; kind: OpportunityKind; fund: FundId; x: number; y: number; radius: number; value: number; alive: boolean; expires: number }
export interface MarketSave { nextSpawn: number; sequence: number; opportunities: Opportunity[]; powers: TimedPower[]; pivotReadyAt: number; pivotUntil: number; sector: SectorId; completedMissions: string[]; auditImmuneUntil: number }

export function marketAt(elapsed: number): { phase: MarketPhase; remaining: number; active: boolean } {
  if (elapsed < 50) return { phase: 'steady', remaining: 50 - elapsed, active: false };
  const index = Math.floor((elapsed - 50) / 85);
  const into = (elapsed - 50) % 85;
  const phases: MarketPhase[] = ['ai-boom', 'funding-winter', 'gpu-shortage', 'product-launch'];
  return { phase: into < 25 ? phases[index % phases.length] : 'steady', remaining: into < 25 ? 25 - into : 85 - into, active: into < 25 };
}

export function gainMultiplier(sector: SectorId, kind: string, phase: MarketPhase, patented: boolean) {
  let value = 1;
  if (sector === 'ai' && ['gpu', 'server', 'data-center'].includes(kind)) value *= 1.3;
  if (sector === 'fintech' && ['investment', 'fund'].includes(kind)) value *= 1.15;
  if (phase === 'ai-boom' && ['gpu', 'server', 'data-center'].includes(kind)) value *= 1.5;
  if (phase === 'funding-winter' && kind === 'investment') value *= .7;
  if (phase === 'product-launch' && kind !== 'fund') value *= 1.25;
  if (patented) value *= 1.35;
  return value;
}
export function freshMarket(sector: SectorId = 'ai'): MarketSave {
  return { nextSpawn: 5, sequence: 0, opportunities: [], powers: [], pivotReadyAt: 0, pivotUntil: 0, sector, completedMissions: [], auditImmuneUntil: 0 };
}
export const MISSIONS = [
  { id: 'first-funding', target: 12, reward: 45, stat: 'investments' },
  { id: 'venture-round', target: 1, reward: 70, stat: 'funds' },
  { id: 'build-stack', target: 5, reward: 90, stat: 'assets' },
  { id: 'first-acquisitions', target: 2, reward: 100, stat: 'acquisitions' },
  { id: 'growth-rounds', target: 5, reward: 180, stat: 'funds' },
] as const;
