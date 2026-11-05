/**
 * Süddən ayırma (gradual weaning, child 12+ months): pure plan / readiness / check-in logic.
 *
 * Principles (approved prototype): the decision is the mother's; there is no one-day option; a step lasts at
 * least MIN_DAYS before the next one may start; red flags pause the plan and send to a doctor.
 * Dates are local calendar days as 'YYYY-MM-DD' strings so plans survive JSON, storage and time zones.
 */
import type { WeaningKey } from './weaning-copy';

export type FeedType = 'day' | 'nap' | 'morning' | 'night' | 'bedtime';
export type Pace = 'gentle' | 'medium';
export type NightMode = 'last' | 'separate';
export type PlanStatus = 'active' | 'paused' | 'finished' | 'cancelled';
export type PauseReason = 'doctor' | 'manual';

export const FEED_ICONS: Record<FeedType, string> = { day: '☀️', nap: '🌤️', morning: '🌅', night: '🌙', bedtime: '🛏️' };

/** Step length per pace. There is deliberately no one-day ("cold turkey") pace. */
export const PACE: Record<Pace, { days: number }> = { gentle: { days: 7 }, medium: { days: 4 } };
export const PACES = Object.keys(PACE) as Pace[];
/** Minimum days of a step before it may be marked done / the next step may start. */
export const MIN_DAYS = 3;
/** The tile appears from 9 months; a plan is built only from 12 months. */
export const TILE_MIN_MONTHS = 9;
export const PLAN_MIN_MONTHS = 12;
export const DELAY_SICK_DAYS = 10;
export const DELAY_CHANGE_DAYS = 14;
export const EXTEND_STEP_DAYS = 3;
export const FULL_EXTEND_DAYS = 2;
export const SLOW_EXTEND_DAYS = 3;
export const CUP_ML = 120;
export const MILK_MIN_ML = 470;
export const MILK_MAX_ML = 710;
export const MAX_CUPS = 7;

export interface Feeds { morning: boolean; day: number; nap: boolean; bedtime: boolean; night: number }
export const DEFAULT_FEEDS: Feeds = { morning: true, day: 2, nap: true, bedtime: true, night: 1 };
export const FEED_MAX: Record<'day' | 'night', number> = { day: 4, night: 3 };

export interface WeaningStep {
  id: string;
  type: FeedType;
  /** 1-based number when the plan has several feeds of this type (Gündüz əmizdirməsi 2), else 0. */
  n: number;
  start: string;
  len: number;
  status: 'todo' | 'done';
}

export interface WeaningPlan {
  id: string;
  childId: string | null;
  pace: Pace;
  nightMode: NightMode;
  steps: WeaningStep[];
  status: PlanStatus;
  pauseReason: PauseReason | null;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ── Dates ────────────────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export const addDays = (day: string, n: number): string => {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
/** Whole calendar days from a to b (DST-safe). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Whole months between a birth date and now; null when unknown or in the future. */
export function ageInMonths(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const b = parseDay(birthDate);
  if (b.getTime() > now.getTime()) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Tile visibility: Ana (mommy) module, active child at least 9 months, admin switch on. */
export function isWeaningTileVisible(o: { lifeStage: string | null | undefined; birthDate: string | null | undefined; setting: unknown; now?: Date }): boolean {
  if (o.lifeStage !== 'mommy' || o.setting !== 'on') return false;
  const months = ageInMonths(o.birthDate, o.now);
  return months !== null && months >= TILE_MIN_MONTHS;
}

// ── Plan building ────────────────────────────────────────────────────────────────────────
/** Steps in the plan for these feeds (night feeds are a separate module when nightMode is 'separate'). */
export function planStepCount(feeds: Feeds, nightMode: NightMode): number {
  return (feeds.morning ? 1 : 0) + feeds.day + (feeds.nap ? 1 : 0) + (feeds.bedtime ? 1 : 0) + (nightMode === 'last' ? feeds.night : 0);
}
export const planWeeks = (feeds: Feeds, nightMode: NightMode, pace: Pace) => Math.ceil((planStepCount(feeds, nightMode) * PACE[pace].days) / 7);

export function clampFeeds(f: Feeds): Feeds {
  const n = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  return { morning: !!f.morning, day: n(f.day, FEED_MAX.day), nap: !!f.nap, bedtime: !!f.bedtime, night: n(f.night, FEED_MAX.night) };
}

/**
 * Order: daytime → nap → morning → night (only when 'last') → bedtime last.
 * Night "separate" leaves night feeds to the later night-weaning module.
 */
export function buildSteps(feedsIn: Feeds, pace: Pace, nightMode: NightMode, start: string): WeaningStep[] {
  if (!PACE[pace]) throw new Error('WEANING_PACE');
  const f = clampFeeds(feedsIn);
  const order: { type: FeedType; n: number }[] = [];
  for (let i = 0; i < f.day; i++) order.push({ type: 'day', n: f.day > 1 ? i + 1 : 0 });
  if (f.nap) order.push({ type: 'nap', n: 0 });
  if (f.morning) order.push({ type: 'morning', n: 0 });
  if (nightMode === 'last') for (let i = 0; i < f.night; i++) order.push({ type: 'night', n: f.night > 1 ? i + 1 : 0 });
  if (f.bedtime) order.push({ type: 'bedtime', n: 0 });
  const len = PACE[pace].days;
  let s = start;
  return order.map((o, i) => {
    const step: WeaningStep = { id: `s${i}`, type: o.type, n: o.n, start: s, len, status: 'todo' };
    s = addDays(s, len);
    return step;
  });
}

const newId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};
export const newUuid = newId;

export function createPlan(o: { feeds: Feeds; pace: Pace; nightMode: NightMode; start: string; childId: string | null; now?: Date }): WeaningPlan {
  const feeds = clampFeeds(o.feeds);
  // Night mode only matters when there are night feeds.
  const nightMode: NightMode = feeds.night > 0 ? o.nightMode : 'last';
  const steps = buildSteps(feeds, o.pace, nightMode, o.start);
  if (!steps.length) throw new Error('WEANING_EMPTY_PLAN');
  const at = (o.now ?? new Date()).toISOString();
  return { id: newId(), childId: o.childId, pace: o.pace, nightMode, steps, status: 'active', pauseReason: null, startedAt: o.start, createdAt: at, updatedAt: at };
}

/** Keep later steps contiguous after step `index` moved or changed length. */
export function recomputeFrom(steps: WeaningStep[], index: number): WeaningStep[] {
  const out = steps.map((s) => ({ ...s }));
  for (let i = Math.max(1, index + 1); i < out.length; i++) out[i].start = addDays(out[i - 1].start, out[i - 1].len);
  return out;
}

export const currentStepIndex = (plan: WeaningPlan): number => plan.steps.findIndex((s) => s.status !== 'done');
export const currentStep = (plan: WeaningPlan): WeaningStep | null => plan.steps.find((s) => s.status !== 'done') ?? null;
export type StepState = 'done' | 'future' | 'cur';
export function stepState(step: WeaningStep, today: string): StepState {
  if (step.status === 'done') return 'done';
  return daysBetween(step.start, today) < 0 ? 'future' : 'cur';
}
export const doneCount = (plan: WeaningPlan) => plan.steps.filter((s) => s.status === 'done').length;
/** Last day of the plan (inclusive). */
export const planLastDay = (plan: WeaningPlan) => {
  const last = plan.steps[plan.steps.length - 1];
  return addDays(last.start, last.len - 1);
};
/** 1-based day of the running step. */
export const stepDay = (step: WeaningStep, today: string) => daysBetween(step.start, today) + 1;
/** "Comfortable, done" opens on day MIN_DAYS of the step. */
export const canComplete = (step: WeaningStep, today: string) => step.status !== 'done' && stepDay(step, today) >= MIN_DAYS;
/** Date when the step may be marked done (shown while waiting). */
export const nextUnlockDay = (step: WeaningStep) => addDays(step.start, MIN_DAYS);

/** "Start now" for an upcoming step: only when at least MIN_DAYS passed since the previous step started. */
export function canStartNow(plan: WeaningPlan, today: string): boolean {
  if (plan.status !== 'active') return false;
  const i = currentStepIndex(plan);
  if (i <= 0) return false;
  const s = plan.steps[i];
  if (stepState(s, today) !== 'future') return false;
  return daysBetween(plan.steps[i - 1].start, today) >= MIN_DAYS;
}

const touch = (plan: WeaningPlan, steps: WeaningStep[], extra: Partial<WeaningPlan> = {}): WeaningPlan =>
  ({ ...plan, steps, ...extra, updatedAt: new Date().toISOString() });

/** Mark the running step done; an overdue next step starts today, a future one keeps its date. */
export function completeCurrent(plan: WeaningPlan, today: string): WeaningPlan {
  const i = currentStepIndex(plan);
  if (i < 0 || !canComplete(plan.steps[i], today)) return plan;
  let steps = plan.steps.map((s, k) => (k === i ? { ...s, status: 'done' as const } : s));
  const next = steps[i + 1];
  if (next && daysBetween(next.start, today) > 0) {
    steps = steps.map((s, k) => (k === i + 1 ? { ...s, start: today } : s));
    steps = recomputeFrom(steps, i + 1);
  }
  const finished = !next;
  return touch(plan, steps, finished ? { status: 'finished', pauseReason: null } : {});
}

export function startNow(plan: WeaningPlan, today: string): WeaningPlan {
  if (!canStartNow(plan, today)) return plan;
  const i = currentStepIndex(plan);
  const steps = recomputeFrom(plan.steps.map((s, k) => (k === i ? { ...s, start: today } : s)), i);
  return touch(plan, steps);
}

export function extendStep(plan: WeaningPlan, stepId: string, days: number): WeaningPlan {
  const i = plan.steps.findIndex((s) => s.id === stepId);
  if (i < 0 || plan.steps[i].status === 'done' || days <= 0) return plan;
  const steps = recomputeFrom(plan.steps.map((s, k) => (k === i ? { ...s, len: s.len + days } : s)), i);
  return touch(plan, steps);
}

export function pausePlan(plan: WeaningPlan, reason: PauseReason): WeaningPlan {
  if (plan.status !== 'active' && plan.status !== 'paused') return plan;
  return touch(plan, plan.steps, { status: 'paused', pauseReason: reason });
}

/** Resume; a running step that started before today restarts today so the body gets its days again. */
export function resumePlan(plan: WeaningPlan, today: string): { plan: WeaningPlan; shifted: boolean } {
  if (plan.status !== 'paused') return { plan, shifted: false };
  const i = currentStepIndex(plan);
  let steps = plan.steps;
  let shifted = false;
  if (i >= 0 && daysBetween(steps[i].start, today) > 0) {
    steps = recomputeFrom(steps.map((s, k) => (k === i ? { ...s, start: today } : s)), i);
    shifted = true;
  }
  return { plan: touch(plan, steps, { status: 'active', pauseReason: null }), shifted };
}

export const cancelPlan = (plan: WeaningPlan): WeaningPlan => touch(plan, plan.steps, { status: 'cancelled', pauseReason: null });

// ── Readiness ────────────────────────────────────────────────────────────────────────────
export type Tone = 'mint' | 'amber' | 'red' | 'sky';
export type ReasonId = 'work' | 'tired' | 'pregnant' | 'doctor' | 'ready';
export const REASONS: ReasonId[] = ['work', 'tired', 'pregnant', 'doctor', 'ready'];
export interface Readiness { sick: boolean | null; change: boolean | null; allergy: boolean | null; reasons: ReasonId[] }
export const EMPTY_READINESS: Readiness = { sick: null, change: null, allergy: null, reasons: [] };
export const readinessAnswered = (r: Readiness) => r.sick !== null && r.change !== null && r.allergy !== null;

export interface Verdict { tone: Tone; title: WeaningKey; text: WeaningKey; canPlan: boolean; delay: number }
export function readinessVerdict(ageMonths: number | null, r: Readiness): Verdict {
  if (ageMonths === null) return { tone: 'amber', title: 'weaning_verdict_nochild_title', text: 'weaning_verdict_nochild_text', canPlan: false, delay: 0 };
  if (ageMonths < PLAN_MIN_MONTHS) return { tone: 'red', title: 'weaning_verdict_young_title', text: 'weaning_verdict_young_text', canPlan: false, delay: 0 };
  if (r.sick === true) return { tone: 'amber', title: 'weaning_verdict_sick_title', text: 'weaning_verdict_sick_text', canPlan: true, delay: DELAY_SICK_DAYS };
  if (r.change === true) return { tone: 'amber', title: 'weaning_verdict_change_title', text: 'weaning_verdict_change_text', canPlan: true, delay: DELAY_CHANGE_DAYS };
  return { tone: 'mint', title: 'weaning_verdict_ok_title', text: 'weaning_verdict_ok_text', canPlan: true, delay: 0 };
}

// ── Daily check-in (red flags) ───────────────────────────────────────────────────────────
export type ChildMood = 'happy' | 'ok' | 'sad';
export type Diapers = 'ok' | 'few';
export type Fullness = 'none' | 'some' | 'much';
export type MotherMood = 'good' | 'mixed' | 'low';
export interface CheckinAnswers {
  childMood: ChildMood | null;
  diapers: Diapers | null;
  childSick: boolean;
  fullness: Fullness | null;
  lump: boolean;
  red: boolean;
  fever: boolean;
  motherMood: MotherMood | null;
}
export const EMPTY_CHECKIN: CheckinAnswers = { childMood: null, diapers: null, childSick: false, fullness: null, lump: false, red: false, fever: false, motherMood: null };
export const checkinComplete = (c: CheckinAnswers) => !!(c.childMood && c.fullness && c.motherMood && c.diapers);

export type CheckinAction = 'pause' | 'slow' | 'extend' | 'offerPause' | null;
export interface CheckinResult { tone: Tone; title: WeaningKey; items: WeaningKey[]; action: CheckinAction; moodLink: boolean; emergency: boolean }

export function evaluateCheckin(c: CheckinAnswers): CheckinResult {
  const moodLink = c.motherMood === 'low';
  // Lump or redness together with fever: possible mastitis → pause, doctor today.
  if ((c.lump || c.red) && c.fever) {
    return { tone: 'red', title: 'weaning_res_mastitis_title', items: ['weaning_res_mastitis_1', 'weaning_res_mastitis_2', 'weaning_res_mastitis_3'], action: 'pause', moodLink, emergency: false };
  }
  // Few wet diapers in a sick child: dehydration risk → pause, pediatrician today.
  if (c.diapers === 'few' && c.childSick) {
    return { tone: 'red', title: 'weaning_res_dehyd_title', items: ['weaning_res_dehyd_1', 'weaning_res_dehyd_2', 'weaning_res_dehyd_3'], action: 'pause', moodLink, emergency: true };
  }
  const out: CheckinResult = { tone: 'mint', title: 'weaning_res_ok_title', items: [], action: null, moodLink, emergency: false };
  if (c.lump || c.red) {
    out.tone = 'amber'; out.title = 'weaning_res_clog_title'; out.action = 'slow';
    out.items.push('weaning_res_clog_1', 'weaning_res_clog_2', 'weaning_res_clog_3');
  } else if (c.fullness === 'much') {
    out.tone = 'amber'; out.title = 'weaning_res_full_title'; out.action = 'extend';
    out.items.push('weaning_res_full_1', 'weaning_res_full_2');
  }
  if (c.childSick) {
    if (out.tone === 'mint') { out.tone = 'sky'; out.title = 'weaning_res_sick_title'; }
    out.items.push('weaning_res_sick_item');
    out.action = out.action || 'offerPause';
  }
  if (c.childMood === 'sad') out.items.push('weaning_res_child_sad');
  if (c.motherMood === 'low') out.items.push('weaning_res_mother_low');
  if (!out.items.length) out.items.push('weaning_res_ok_item');
  return out;
}

/** Apply a check-in result to the plan: pause (doctor), slow down (+3 days) or extend (+2 days) the running step. */
export function applyCheckin(plan: WeaningPlan, res: CheckinResult): WeaningPlan {
  if (plan.status !== 'active' && plan.status !== 'paused') return plan;
  if (res.action === 'pause') return pausePlan(plan, 'doctor');
  const cur = currentStep(plan);
  if (!cur) return plan;
  if (res.action === 'slow') return extendStep(plan, cur.id, SLOW_EXTEND_DAYS);
  if (res.action === 'extend') return extendStep(plan, cur.id, FULL_EXTEND_DAYS);
  return plan;
}

// ── Nutrition ────────────────────────────────────────────────────────────────────────────
export type MilkStatus = 'low' | 'good' | 'over';
export function milkStatus(cups: number): MilkStatus {
  const ml = cups * CUP_ML;
  if (ml > MILK_MAX_ML) return 'over';
  if (ml >= MILK_MIN_ML) return 'good';
  return 'low';
}

/** Steps whose start-day reminder (09:00) is still ahead. */
export function reminderDays(plan: WeaningPlan, now: Date): { step: WeaningStep; at: Date }[] {
  if (plan.status !== 'active') return [];
  return plan.steps
    .filter((s) => s.status !== 'done')
    .map((s) => { const at = parseDay(s.start); at.setHours(9, 0, 0, 0); return { step: s, at }; })
    .filter((r) => r.at.getTime() > now.getTime() + 60_000);
}
