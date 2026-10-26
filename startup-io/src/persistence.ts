import { clamp } from './game/model';
import type { GameResult, RunSave, RunStats, WorldSave } from './game/model';
import { COSMETICS, defaultLook, FREE_ITEMS, itemById, PALETTE } from './game/cosmetics';
import type { FrameId, PlayerLook, TrailId } from './game/cosmetics';
import { activityCredits, STARTER_CREDITS } from './economy';
import type { Language } from './i18n';
import { freshMarket, FUNDS, MISSIONS, SECTORS } from './game/market';
import type { MarketSave, SectorId } from './game/market';
import { BRANDS } from './game/cosmetics';

export const SAVE_KEY = 'startup.io.progress.v1';
export const PLAYER_COLORS = PALETTE;
interface RunLedger { runId: string; credits: number; distance: number; acquisitions: number; finalized: boolean }
export interface EndlessRecords { bestMass: number; longestRun: number; totalDistance: number; totalRuns: number; acquisitions: number }
export interface Progress {
  version: 3;
  name: string;
  color: string;
  tutorialSeen: boolean;
  settings: { language: Language; sound: boolean; haptics: boolean; sensitivity: number; details: boolean };
  credits: number;
  lifetimeCredits: number;
  owned: string[];
  look: PlayerLook;
  sector: SectorId;
  endless: EndlessRecords;
  activeRun: RunSave | null;
  runLedger: RunLedger[];
  // Old achievements are archived on upgrade; they do not control the endless game.
  legacyRecords: { stars: number; bestMass: number; bestTime: number | null; wins: number }[];
}
export function freshProgress(): Progress {
  return {
    version: 3, name: 'My Startup', color: PALETTE[0], tutorialSeen: false,
    settings: { language: 'az', sound: false, haptics: true, sensitivity: 1, details: true },
    credits: STARTER_CREDITS, lifetimeCredits: STARTER_CREDITS, owned: [...FREE_ITEMS], look: defaultLook(), sector: 'ai',
    endless: { bestMass: 0, longestRun: 0, totalDistance: 0, totalRuns: 0, acquisitions: 0 }, activeRun: null, runLedger: [], legacyRecords: [],
  };
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positive = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const integer = (value: unknown, fallback = 0) => Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(positive(value, fallback)));
const runIdValid = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);
export const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const validLogoImage = (value: unknown): value is string => typeof value === 'string' && value.length < 150000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);

function parseWorld(value: unknown): WorldSave {
  const world = object(value);
  const origin = (value: unknown) => typeof value === 'string' && /^-?\d{1,160}$/.test(value) ? value : '0';
  return {
    originX: origin(world.originX), originY: origin(world.originY),
    states: (Array.isArray(world.states) ? world.states : []).slice(-192).flatMap(item => {
      const state = object(item);
      if (typeof state.key !== 'string' || !/^\d{1,3}:-?\d{1,160}:-?\d{1,160}$/.test(state.key)) return [];
      return [{ key: state.key, referenceMass: Math.max(1, positive(state.referenceMass, 10)), consumed: (Array.isArray(state.consumed) ? state.consumed : []).slice(0, 64).flatMap(entry => {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'number' || entry[0] < 0 || entry[0] > 64 || typeof entry[1] !== 'number' || !Number.isFinite(entry[1]) || entry[1] < 0) return [];
        return [[Math.trunc(entry[0]), entry[1]] as [number, number]];
      }) }];
    }),
  };
}
function parseStats(value: unknown, mass = 10): RunStats {
  const stats = object(value);
  const parsed: RunStats = { investments: integer(stats.investments), assets: integer(stats.assets), acquisitions: integer(stats.acquisitions), peakMass: Math.max(mass, positive(stats.peakMass, mass)), distance: positive(stats.distance) };
  for (const key of ['funds', 'powers', 'audits', 'bonusCredits'] as const) if (stats[key] !== undefined) parsed[key] = integer(stats[key]);
  return parsed;
}
function parseMarket(value: unknown): MarketSave | undefined {
  if (!value) return undefined;
  const market = object(value);
  const result = freshMarket(SECTORS.some(sector => sector.id === market.sector) ? market.sector as SectorId : 'ai');
  result.nextSpawn = positive(market.nextSpawn, 5); result.sequence = integer(market.sequence);
  result.pivotReadyAt = positive(market.pivotReadyAt); result.pivotUntil = positive(market.pivotUntil); result.auditImmuneUntil = positive(market.auditImmuneUntil);
  result.powers = (Array.isArray(market.powers) ? market.powers : []).slice(0, 4).flatMap(value => {
    const power = object(value);
    return ['magnet', 'firewall', 'accelerator', 'patent'].includes(power.kind as string) ? [{ kind: power.kind as MarketSave['powers'][number]['kind'], until: positive(power.until) }] : [];
  });
  result.opportunities = (Array.isArray(market.opportunities) ? market.opportunities : []).slice(0, 7).flatMap(value => {
    const item = object(value);
    if (!['fund', 'talent', 'cloud-credit', 'patent', 'audit'].includes(item.kind as string) || !FUNDS.some(fund => fund.id === item.fund) || typeof item.x !== 'number' || typeof item.y !== 'number' || !Number.isFinite(item.x + item.y)) return [];
    return [{ id: integer(item.id), kind: item.kind as MarketSave['opportunities'][number]['kind'], fund: item.fund as MarketSave['opportunities'][number]['fund'], x: item.x, y: item.y, radius: Math.max(1, positive(item.radius, 15)), value: positive(item.value), alive: item.alive !== false, expires: positive(item.expires) }];
  });
  result.completedMissions = (Array.isArray(market.completedMissions) ? market.completedMissions : []).filter((value): value is string => MISSIONS.some(mission => mission.id === value)).slice(0, 5);
  return result;
}
export function parseRun(value: unknown): RunSave | null {
  const run = object(value); const player = object(run.player);
  if (run.version !== 1 || !runIdValid(run.runId) || typeof player.mass !== 'number' || !Number.isFinite(player.mass) || player.mass < 1) return null;
  if (typeof player.x !== 'number' || typeof player.y !== 'number' || !Number.isFinite(player.x + player.y)) return null;
  const heading = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return {
    version: 1, runId: run.runId, seed: integer(run.seed) >>> 0, elapsed: positive(run.elapsed), started: run.started === true,
    energy: clamp(positive(run.energy, 100), 0, 100), shield: clamp(positive(run.shield), 0, 8),
    player: { x: player.x, y: player.y, mass: player.mass, heading: heading(player.heading) }, stats: parseStats(run.stats, player.mass),
    bots: (Array.isArray(run.bots) ? run.bots : []).slice(0, BRANDS.length).flatMap(value => {
      const bot = object(value);
      if (typeof bot.id !== 'number' || bot.id < 1 || bot.id > BRANDS.length || typeof bot.mass !== 'number' || !Number.isFinite(bot.mass) || bot.mass < 1 || typeof bot.x !== 'number' || typeof bot.y !== 'number' || !Number.isFinite(bot.x + bot.y)) return [];
      return [{ id: Math.trunc(bot.id), mass: bot.mass, x: bot.x, y: bot.y, heading: heading(bot.heading), alive: bot.alive !== false, respawnAt: positive(bot.respawnAt) }];
    }), world: parseWorld(run.world), market: parseMarket(run.market),
  };
}

export function parseProgress(raw: string | null): Progress {
  const fallback = freshProgress(); if (!raw) return fallback;
  try {
    const value = object(JSON.parse(raw));
    if (![1, 2, 3].includes(value.version as number)) return fallback;
    const settings = object(value.settings); const look = object(value.look); const endless = object(value.endless);
    const owned = [...new Set([...FREE_ITEMS, ...(Array.isArray(value.owned) ? value.owned.filter((id): id is string => typeof id === 'string' && Boolean(itemById(id))) : [])])];
    const legacy = (Array.isArray(value.legacyRecords) ? value.legacyRecords : Array.isArray(value.records) ? value.records : []).slice(0, 6).map(value => {
      const record = object(value);
      return { stars: clamp(integer(record.stars), 0, 3), bestMass: positive(record.bestMass), bestTime: record.bestTime === null ? null : positive(record.bestTime), wins: integer(record.wins) };
    });
    const logo = typeof look.logo === 'string' && owned.includes(look.logo) && itemById(look.logo)?.category === 'logo' ? look.logo : 'rocket';
    const trail = typeof look.trail === 'string' && owned.includes(`trail-${look.trail}`) ? look.trail as TrailId : 'none';
    const frame = typeof look.frame === 'string' && owned.includes(`frame-${look.frame}`) ? look.frame as FrameId : 'classic';
    const runLedger: RunLedger[] = (Array.isArray(value.runLedger) ? value.runLedger : []).slice(-64).flatMap(value => {
      const entry = object(value);
      return runIdValid(entry.runId) ? [{ runId: entry.runId, credits: integer(entry.credits), distance: positive(entry.distance), acquisitions: integer(entry.acquisitions), finalized: entry.finalized === true }] : [];
    });
    const activeRun = value.version === 3 ? parseRun(value.activeRun) : null;
    return {
      ...fallback,
      sector: SECTORS.some(sector => sector.id === value.sector) ? value.sector as SectorId : 'ai',
      name: typeof value.name === 'string' ? value.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 18) || fallback.name : fallback.name,
      color: validColor(value.color) ? value.color : fallback.color,
      tutorialSeen: value.version === 3 && value.tutorialSeen === true,
      settings: { language: settings.language === 'en' ? 'en' : 'az', sound: settings.sound === true, haptics: settings.haptics !== false, sensitivity: clamp(positive(settings.sensitivity, 1), .65, 1.5), details: settings.details !== false },
      credits: integer(value.credits, STARTER_CREDITS), lifetimeCredits: integer(value.lifetimeCredits, STARTER_CREDITS), owned,
      look: { logo, trail, frame, monogram: typeof look.monogram === 'string' ? look.monogram.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 3) || 'S' : 'S', customImage: validLogoImage(look.customImage) ? look.customImage : null },
      endless: { bestMass: Math.max(positive(endless.bestMass), ...legacy.map(record => record.bestMass), activeRun?.stats.peakMass ?? 0), longestRun: positive(endless.longestRun), totalDistance: positive(endless.totalDistance), totalRuns: integer(endless.totalRuns), acquisitions: integer(endless.acquisitions) },
      activeRun: activeRun && !runLedger.some(entry => entry.runId === activeRun.runId && entry.finalized) ? activeRun : null,
      runLedger, legacyRecords: legacy,
    };
  } catch { return fallback; }
}
export function loadProgress(): Progress { try { return parseProgress(localStorage.getItem(SAVE_KEY)); } catch { return freshProgress(); } }
export function saveProgress(progress: Progress): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); return true; } catch { return false; } }

function settle(progress: Progress, run: { runId: string; elapsed: number; stats: RunStats }, finalized: boolean, activeRun: RunSave | null): Progress {
  const previous = progress.runLedger.find(entry => entry.runId === run.runId);
  if (previous?.finalized) return progress;
  const earned = activityCredits(run.stats);
  const delta = Math.max(0, earned - (previous?.credits ?? 0));
  const ledger: RunLedger = { runId: run.runId, credits: Math.max(earned, previous?.credits ?? 0), distance: Math.max(run.stats.distance, previous?.distance ?? 0), acquisitions: Math.max(run.stats.acquisitions, previous?.acquisitions ?? 0), finalized };
  return {
    ...progress,
    credits: Math.min(Number.MAX_SAFE_INTEGER, progress.credits + delta), lifetimeCredits: Math.min(Number.MAX_SAFE_INTEGER, progress.lifetimeCredits + delta), activeRun,
    runLedger: [...progress.runLedger.filter(entry => entry.runId !== run.runId), ledger].slice(-64),
    endless: {
      bestMass: Math.max(progress.endless.bestMass, run.stats.peakMass), longestRun: Math.max(progress.endless.longestRun, run.elapsed),
      totalDistance: progress.endless.totalDistance + Math.max(0, run.stats.distance - (previous?.distance ?? 0)),
      acquisitions: progress.endless.acquisitions + Math.max(0, run.stats.acquisitions - (previous?.acquisitions ?? 0)),
      totalRuns: progress.endless.totalRuns + (finalized ? 1 : 0),
    },
  };
}
export const checkpointRun = (progress: Progress, run: RunSave): Progress => settle(progress, run, false, run);
export const recordResult = (progress: Progress, result: GameResult): Progress => settle(progress, result, true, null);

export function equipItem(progress: Progress, id: string): Progress {
  const item = itemById(id); if (!item || !progress.owned.includes(id)) return progress;
  const look = { ...progress.look };
  if (item.category === 'logo') look.logo = id;
  if (item.category === 'trail') look.trail = id.replace('trail-', '') as TrailId;
  if (item.category === 'frame') look.frame = id.replace('frame-', '') as FrameId;
  return { ...progress, look };
}
export function buyItem(progress: Progress, id: string): { progress: Progress; status: 'bought' | 'equipped' | 'insufficient' | 'invalid' } {
  const item = itemById(id);
  if (!item) return { progress, status: 'invalid' };
  if (progress.owned.includes(id)) return { progress: equipItem(progress, id), status: 'equipped' };
  if (progress.credits < item.price) return { progress, status: 'insufficient' };
  return { progress: equipItem({ ...progress, credits: progress.credits - item.price, owned: [...progress.owned, id] }, id), status: 'bought' };
}
export const equippedId = (progress: Progress, category: 'logo' | 'trail' | 'frame') => category === 'logo' ? progress.look.logo : `${category}-${progress.look[category]}`;
export const ownedCount = (progress: Progress) => COSMETICS.filter(item => progress.owned.includes(item.id) && item.id !== 'custom').length;
