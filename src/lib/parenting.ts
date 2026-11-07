/**
 * Tərbiyə (evidence-based positive parenting, children 0–12 years): pure rules for the tile, age bands, the daily
 * tip, programme progress and quiz scoring, plus the device-only progress store.
 *
 * Programme progress and quiz results stay on this phone (localStorage per account). There is no server table:
 * nothing here is health data the family needs on another device, and a lost streak is easy to restart.
 */
import type {
  AgeBandId, MilestoneAnswer, MilestoneCheckpoint, MilestoneResultId, StyleDimension, StyleResultId,
} from '@/data/parenting/types';
import { ageInMonths, isoDay } from './weaning';

export { ageInMonths, isoDay };

/** Content exists only in Azerbaijani for now; the tile is shown to Azerbaijani-language users only. */
export const PARENTING_LANGUAGES = ['az'] as const;
/** Up to and including 12 years. */
export const MAX_MONTHS = 13 * 12;

export function isParentingLanguage(language: string | null | undefined): boolean {
  return (PARENTING_LANGUAGES as readonly string[]).includes(String(language || ''));
}

/**
 * Tile visibility: Ana (mommy) module, Azerbaijani app language, admin switch app_settings.parenting_tool = 'on',
 * and the active child (when known) is younger than 13. Without a birth date the parent picks the age band.
 */
export function isParentingTileVisible(o: {
  lifeStage: string | null | undefined;
  language: string | null | undefined;
  setting: unknown;
  birthDate?: string | null;
  now?: Date;
}): boolean {
  if (o.lifeStage !== 'mommy' || o.setting !== 'on' || !isParentingLanguage(o.language)) return false;
  const months = ageInMonths(o.birthDate, o.now);
  return months === null || months < MAX_MONTHS;
}

/** The age band for a child of this many months (null when unknown or 13+). */
export function ageBandFor(months: number | null | undefined): AgeBandId | null {
  if (months === null || months === undefined || !Number.isFinite(months) || months < 0) return null;
  if (months < 12) return '0-1';
  if (months < 36) return '1-3';
  if (months < 72) return '3-6';
  if (months < MAX_MONTHS) return '6-12';
  return null;
}

/** Days since 1970-01-01 for a local calendar day (stable across time zones and DST). */
function dayNumber(day: string): number {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Deterministic "tip of the day": the same tip all day, the next one tomorrow. */
export function dailyTipIndex(today: string, count: number): number {
  if (count <= 0) return -1;
  return ((dayNumber(today) % count) + count) % count;
}

// ── Programmes ──────────────────────────────────────────────────────────────────────────
export interface ProgrammeProgress {
  startedAt: string;
  /** Calendar day each programme day was checked off, in order (index 0 = day 1). */
  done: string[];
  updatedAt: string;
}

export function startProgramme(today: string): ProgrammeProgress {
  return { startedAt: today, done: [], updatedAt: today };
}

/** 0-based index of the next programme day (equals total when finished). */
export const nextDayIndex = (p: ProgrammeProgress | null | undefined) => (p ? p.done.length : 0);

/** One small step a day: the next day can be checked off once per calendar day. */
export function canCompleteToday(p: ProgrammeProgress | null | undefined, total: number, today: string): boolean {
  if (!p || p.done.length >= total) return false;
  return p.done[p.done.length - 1] !== today;
}

export function completeDay(p: ProgrammeProgress, total: number, today: string): ProgrammeProgress {
  if (!canCompleteToday(p, total, today)) return p;
  return { ...p, done: [...p.done, today], updatedAt: today };
}

/** Undo only the most recent check-off (a mis-tap). */
export function undoLastDay(p: ProgrammeProgress, today: string): ProgrammeProgress {
  if (!p.done.length) return p;
  return { ...p, done: p.done.slice(0, -1), updatedAt: today };
}

export const isFinished = (p: ProgrammeProgress | null | undefined, total: number) => !!p && p.done.length >= total;
export const progressPercent = (p: ProgrammeProgress | null | undefined, total: number) =>
  (!p || total <= 0 ? 0 : Math.round((Math.min(p.done.length, total) / total) * 100));

// ── Quizzes ─────────────────────────────────────────────────────────────────────────────
/** Average per dimension for 0…3 answers. */
export function styleScores(items: { dim: StyleDimension }[], answers: (number | null | undefined)[]): Record<StyleDimension, number> {
  const sum: Record<StyleDimension, number> = { warmth: 0, structure: 0, harsh: 0, giveIn: 0 };
  const n: Record<StyleDimension, number> = { warmth: 0, structure: 0, harsh: 0, giveIn: 0 };
  items.forEach((it, i) => {
    const a = answers[i];
    if (typeof a !== 'number' || a < 0 || a > 3) return;
    sum[it.dim] += a;
    n[it.dim] += 1;
  });
  const avg = (d: StyleDimension) => (n[d] ? sum[d] / n[d] : 0);
  return { warmth: avg('warmth'), structure: avg('structure'), harsh: avg('harsh'), giveIn: avg('giveIn') };
}

/**
 * Non-judgemental profile from Baumrind's two dimensions (warmth, structure) plus how often harshness or giving in
 * shows up when the parent is tired. Thresholds sit on the middle of the 0…3 scale.
 */
export function styleResult(s: Record<StyleDimension, number>): StyleResultId {
  const warm = s.warmth >= 1.75;
  const clear = s.structure >= 1.75 && s.giveIn < 1.75;
  const harsh = s.harsh >= 1.5;
  if (warm && harsh) return 'storm';
  if (harsh) return 'strict';
  if (warm && clear) return 'balanced';
  if (warm) return 'gentle';
  return clear ? 'strict' : 'stretched';
}

/** The latest checkpoint the child has reached (the first one for very young babies). */
export function checkpointFor(checkpoints: MilestoneCheckpoint[], months: number | null): MilestoneCheckpoint | null {
  if (!checkpoints.length) return null;
  const sorted = [...checkpoints].sort((a, b) => a.fromMonths - b.fromMonths);
  if (months === null) return sorted[0];
  let found = sorted[0];
  for (const c of sorted) if (months >= c.fromMonths) found = c;
  return found;
}

/**
 * Milestone self-check: a lost skill or "not yet" on a red-flag item → talk to a doctor; three or more "not yet /
 * not sure" → watch and support; otherwise on track. It is never a diagnosis.
 */
export function milestoneResult(
  checkpoint: MilestoneCheckpoint,
  answers: (MilestoneAnswer | null | undefined)[],
  regression: MilestoneAnswer | null | undefined,
): { id: MilestoneResultId; notYet: number[]; flagged: number[] } {
  const notYet: number[] = [];
  const flagged: number[] = [];
  checkpoint.items.forEach((it, i) => {
    const a = answers[i];
    if (a === 'no' || a === 'unsure') notYet.push(i);
    if (a === 'no' && it.flag) flagged.push(i);
  });
  const id: MilestoneResultId = regression === 'yes' || flagged.length ? 'talk' : notYet.length >= 3 ? 'watch' : 'ontrack';
  return { id, notYet, flagged };
}

// ── Device store ────────────────────────────────────────────────────────────────────────
export interface ParentingLocal {
  v: 1;
  /** Parent's manual age band (when there is no child or they read for a sibling). */
  band: AgeBandId | null;
  programmes: Record<string, ProgrammeProgress>;
  quizzes: Record<string, { at: string; result: string }>;
}

export const EMPTY_PARENTING = (): ParentingLocal => ({ v: 1, band: null, programmes: {}, quizzes: {} });
export const storageKey = (uid: string | null) => `anacan.parenting.v1.${uid || 'guest'}`;

const BANDS: AgeBandId[] = ['0-1', '1-3', '3-6', '6-12'];

/** Read and sanitise the stored state; any storage error or bad shape yields an empty state. */
export function readParenting(uid: string | null): ParentingLocal {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey(uid));
    if (!raw) return EMPTY_PARENTING();
    const data = JSON.parse(raw) as Partial<ParentingLocal>;
    const out = EMPTY_PARENTING();
    if (data.band && BANDS.includes(data.band)) out.band = data.band;
    const day = /^\d{4}-\d{2}-\d{2}$/;
    for (const [id, p] of Object.entries(data.programmes || {})) {
      if (!p || typeof p.startedAt !== 'string' || !Array.isArray(p.done)) continue;
      out.programmes[id] = {
        startedAt: p.startedAt,
        done: p.done.filter((d) => typeof d === 'string' && day.test(d)).slice(0, 60),
        updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.startedAt,
      };
    }
    for (const [id, q] of Object.entries(data.quizzes || {})) {
      if (q && typeof q.result === 'string' && typeof q.at === 'string') out.quizzes[id] = { at: q.at, result: q.result };
    }
    return out;
  } catch {
    return EMPTY_PARENTING();
  }
}

export function writeParenting(uid: string | null, state: ParentingLocal): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    /* private mode or full storage: progress stays in memory for this session */
  }
}
