export type AssetKind = 'investment' | 'gpu' | 'office' | 'server' | 'data-center' | 'tower' | 'campus' | 'hq';
export type GameStatus = 'playing' | 'paused' | 'lost' | 'finished';
export type LoseReason = 'competitor' | 'quit';
export type DistrictKind = 'park' | 'studios' | 'tech' | 'downtown' | 'waterfront';

export interface AssetSpec {
  kind: AssetKind;
  requiredMass: number;
  value: number;
  radius: number;
  color: string;
}
export interface Vec2 { x: number; y: number }
export interface Input extends Vec2 { boost: boolean; pivot?: boolean }
export interface Actor extends Vec2 {
  id: number;
  name: string;
  mass: number;
  radius: number;
  heading: number;
  vx: number;
  vy: number;
  color: string;
  logo: string;
  alive: boolean;
  respawnAt: number;
  protectedUntil: number;
  ai: { direction: Vec2; nextDecision: number; aggression: number; speed: number; mode: 'forage' | 'flee' | 'hunt' };
}
export interface Pickup extends Vec2 {
  id: string;
  chunk: string;
  slot: number;
  spec: AssetSpec;
  alive: boolean;
  respawnAt: number;
  phase: number;
}
export interface CityBlock extends Vec2 {
  key: string;
  size: number;
  district: DistrictKind;
  variation: number;
}
export interface RunStats {
  investments: number;
  assets: number;
  acquisitions: number;
  peakMass: number;
  distance: number;
  funds?: number;
  powers?: number;
  audits?: number;
  bonusCredits?: number;
}
export interface GameResult {
  runId: string;
  mass: number;
  elapsed: number;
  stats: RunStats;
  reason: LoseReason;
  killer?: string;
}
export interface ChunkState {
  key: string;
  referenceMass: number;
  consumed: [number, number][];
}
export interface WorldSave {
  originX: string;
  originY: string;
  states: ChunkState[];
}
export interface RunSave {
  version: 1;
  runId: string;
  seed: number;
  elapsed: number;
  started: boolean;
  energy: number;
  shield: number;
  player: Vec2 & { mass: number; heading: number };
  stats: RunStats;
  bots: { id: number; x: number; y: number; mass: number; heading: number; alive: boolean; respawnAt: number }[];
  world: WorldSave;
  market?: import('./market').MarketSave;
}
export type GameEvent =
  | { type: 'pickup'; id: string; x: number; y: number; value: number; kind: AssetKind }
  | { type: 'acquisition'; x: number; y: number; value: number; name: string }
  | { type: 'unlock'; kind: AssetKind }
  | { type: 'rebase'; x: number; y: number }
  | { type: 'result'; result: GameResult }
  | { type: 'opportunity'; kind: import('./market').OpportunityKind; fund: import('./market').FundId; value: number; x: number; y: number; actorId: number }
  | { type: 'mission'; id: string; reward: number }
  | { type: 'pivot'; x: number; y: number };
export interface ArenaActivity {
  id: number;
  at: number;
  type: 'joined' | 'acquired';
  actor: { id: number; name: string; logo: string; color: string };
  target?: { id: number; name: string; logo: string; color: string };
}
export interface GameSnapshot {
  status: GameStatus;
  mass: number;
  elapsed: number;
  started: boolean;
  energy: number;
  boosting: boolean;
  shield: number;
  rank: number;
  credits: number;
  district: DistrictKind;
  room: string;
  founders: number;
  activity: ArenaActivity[];
  rankChange: number;
  market: ReturnType<typeof import('./market').marketAt>;
  powers: import('./market').TimedPower[];
  pivotCooldown: number;
  pivoting: boolean;
  sector: import('./market').SectorId;
  danger?: { name: string; logo: string; color: string; x: number; y: number; progress: number };
  mission?: { id: string; progress: number; target: number; reward: number };
  nearestFund?: { fund: import('./market').FundId; x: number; y: number; value: number };
  nextAsset?: AssetSpec;
  leaderboard: { id: number; name: string; mass: number; player: boolean; logo: string; color: string }[];
  map: { id: number; x: number; y: number; threat: boolean }[];
}

export const START_MASS = 10;
export const TAKEOVER_SECONDS = 1.1;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const radiusForMass = (mass: number) => 12 + 6.4 * Math.pow(Math.max(1, mass), .32);
export const canAcquire = (big: number, small: number) => big / Math.max(small, 1) >= 1.18;
export const distanceSquared = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const movementSpeed = (mass: number) => radiusForMass(mass) * 8.6;

export function viewZoom(mass: number, width: number, height: number, wide = false) {
  const bodyPixels = clamp(23 + Math.log10(Math.max(10, mass) / 10) * 2, 23, 36) * clamp(Math.min(width, height) / 390, .72, 1.4);
  return bodyPixels / radiusForMass(mass) * (wide ? .8 : 1);
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(value: string, seed = 2166136261) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
