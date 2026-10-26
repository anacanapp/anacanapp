// Sleep training (babies 1–12 months): age norms, a daily nap schedule built from the
// wake-up time, live status, 7-day summaries with insights and the on-device plan state.
// Pure functions only; the screen keeps state in localStorage per user.
import type { BabyLogRow } from '@/lib/baby-logs-range';

export type AgeBand = '1-3' | '4-6' | '7-9' | '10-12';

export interface BandNorms {
  totalSleepHours: [number, number];
  naps: [number, number];
  wakeWindowMinutes: [number, number];
  napMinutes: [number, number];
  longestNightHours: [number, number];
}

export const BAND_NORMS: Record<AgeBand, BandNorms> = {
  '1-3': { totalSleepHours: [14, 17], naps: [4, 5], wakeWindowMinutes: [45, 90], napMinutes: [30, 90], longestNightHours: [4, 6] },
  '4-6': { totalSleepHours: [12, 16], naps: [3, 4], wakeWindowMinutes: [90, 150], napMinutes: [45, 120], longestNightHours: [6, 8] },
  '7-9': { totalSleepHours: [12, 16], naps: [2, 3], wakeWindowMinutes: [120, 180], napMinutes: [45, 120], longestNightHours: [8, 10] },
  '10-12': { totalSleepHours: [12, 16], naps: [2, 2], wakeWindowMinutes: [150, 240], napMinutes: [60, 120], longestNightHours: [10, 12] },
};

export const MIN_SLEEP_MINUTES = 5;
export const MAX_SLEEP_MINUTES = 16 * 60;
export const PLAN_DAYS = 14;
const MIN_DAYS_FOR_REVIEW = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Whole months between birth and now (0 when the date is invalid or in the future). */
export function monthsOld(birth: Date, now: Date): number {
  if (Number.isNaN(birth.getTime()) || birth.getTime() > now.getTime()) return 0;
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

const inRange = (months: number) => Number.isInteger(months) && months >= 1 && months <= 12;

export function ageBand(months: number): AgeBand | null {
  if (!inRange(months)) return null;
  return months <= 3 ? '1-3' : months <= 6 ? '4-6' : months <= 9 ? '7-9' : '10-12';
}

/** The tool is offered to mommy-stage users whose baby is 1–12 months old. */
export function sleepTrainingEligible(o: { lifeStage?: string | null; birthDate: Date | null; now: Date }): boolean {
  return o.lifeStage === 'mommy' && !!o.birthDate && inRange(monthsOld(o.birthDate, o.now));
}

/** "07:30" → 450, or null. */
export function parseClock(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatClock(minutes: number): string {
  const t = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const mid = (r: [number, number]) => Math.round((r[0] + r[1]) / 2);

export interface ScheduleBlock { type: 'wake' | 'nap' | 'bedtime'; start: string; end: string }

export function blockMinutes(b: ScheduleBlock): number {
  const s = parseClock(b.start), e = parseClock(b.end);
  return s === null || e === null ? 0 : (e - s + 1440) % 1440;
}

const BEDTIME_EARLIEST = 19 * 60;
const BEDTIME_LATEST = 20 * 60 + 30;
const DAY_LENGTH = 13 * 60;

/** Wake → (awake, nap)×n → awake → bedtime, choosing the nap count whose awake windows fit the age best. */
export function buildSchedule(o: { wakeTime: string; band: AgeBand }): ScheduleBlock[] {
  const wake = parseClock(o.wakeTime);
  if (wake === null) return [];
  const norms = BAND_NORMS[o.band];
  const bedtime = Math.min(BEDTIME_LATEST, Math.max(BEDTIME_EARLIEST, wake + DAY_LENGTH));
  const awakeSpan = bedtime - wake;
  const napLen = mid(norms.napMinutes), window = mid(norms.wakeWindowMinutes);
  let naps = norms.naps[0], best = Number.POSITIVE_INFINITY;
  for (let n = norms.naps[0]; n <= norms.naps[1]; n += 1) {
    const diff = Math.abs((awakeSpan - n * napLen) / (n + 1) - window);
    if (diff < best) { best = diff; naps = n; }
  }
  const gap = Math.round((awakeSpan - naps * napLen) / (naps + 1));
  const blocks: ScheduleBlock[] = [];
  let t = wake;
  for (let i = 0; i < naps; i += 1) {
    blocks.push({ type: 'wake', start: formatClock(t), end: formatClock(t + gap) });
    t += gap;
    blocks.push({ type: 'nap', start: formatClock(t), end: formatClock(t + napLen) });
    t += napLen;
  }
  blocks.push({ type: 'wake', start: formatClock(t), end: formatClock(bedtime) });
  blocks.push({ type: 'bedtime', start: formatClock(bedtime), end: formatClock(bedtime) });
  return blocks;
}

export interface ScheduleStatus { currentIndex: number | null; nextIndex: number | null; minutesToNext: number | null; minutesLeft: number | null }

export function scheduleStatus(schedule: ScheduleBlock[], now: Date): ScheduleStatus {
  if (!schedule.length) return { currentIndex: null, nextIndex: null, minutesToNext: null, minutesLeft: null };
  const n = minutesOfDay(now);
  let current: number | null = null, left: number | null = null;
  schedule.forEach((b, i) => {
    if (b.type === 'bedtime') return;
    const s = parseClock(b.start), len = blockMinutes(b);
    if (s === null || len === 0) return;
    const into = (n - s + 1440) % 1440;
    if (into < len) { current = i; left = len - into; }
  });
  let next: number | null = null, toNext: number | null = null;
  schedule.forEach((b, i) => {
    const s = parseClock(b.start);
    if (s === null || i === current) return;
    const d = (s - n + 1440) % 1440;
    if (d === 0 && b.type !== 'bedtime') return;
    if (toNext === null || d < toNext) { toNext = d; next = i; }
  });
  return { currentIndex: current, nextIndex: next, minutesToNext: toNext, minutesLeft: left };
}

export interface TimelineSegment { kind: 'wake' | 'nap' | 'night'; blockIndex: number; startPct: number; widthPct: number }
const pct = (m: number) => (m / 1440) * 100;

function pushSegment(out: TimelineSegment[], kind: TimelineSegment['kind'], blockIndex: number, start: number, len: number) {
  if (len <= 0) return;
  const first = Math.min(len, 1440 - start);
  out.push({ kind, blockIndex, startPct: pct(start), widthPct: pct(first) });
  if (len > first) out.push({ kind, blockIndex, startPct: 0, widthPct: pct(len - first) });
}

/** 24-hour bar segments; the night wraps past midnight back to the wake-up time. */
export function timelineSegments(schedule: ScheduleBlock[]): TimelineSegment[] {
  const out: TimelineSegment[] = [];
  schedule.forEach((b, i) => {
    if (b.type === 'bedtime') return;
    const s = parseClock(b.start);
    if (s !== null) pushSegment(out, b.type, i, s, blockMinutes(b));
  });
  const bedIndex = schedule.findIndex((b) => b.type === 'bedtime');
  const bed = bedIndex >= 0 ? parseClock(schedule[bedIndex].start) : null;
  const wake = schedule.length ? parseClock(schedule[0].start) : null;
  if (bed !== null && wake !== null) pushSegment(out, 'night', bedIndex, bed, (wake - bed + 1440) % 1440);
  return out;
}

export const DEFAULT_WAKE = '07:00';
export const WAKE_PRESETS = ['06:30', '07:00', '07:30', '08:00'];
export const WAKE_MIN = 5 * 60;
export const WAKE_MAX = 10 * 60 + 30;
const clampWake = (m: number) => Math.min(WAKE_MAX, Math.max(WAKE_MIN, m));

export function normalizeWake(value: unknown): string {
  const m = typeof value === 'string' ? parseClock(value) : null;
  return m === null ? DEFAULT_WAKE : formatClock(clampWake(m));
}

export function shiftWake(value: string, delta: number): string {
  const m = parseClock(normalizeWake(value)) ?? (parseClock(DEFAULT_WAKE) as number);
  return formatClock(clampWake(m + delta));
}

export interface SleepEntry { id: string; start: Date; end: Date; minutes: number; kind: 'night' | 'nap' }

const entryKind = (start: Date, minutes: number): SleepEntry['kind'] => {
  const h = start.getHours();
  return h >= 19 || h < 6 || minutes >= 240 ? 'night' : 'nap';
};

export function sleepEntries(logs: BabyLogRow[]): SleepEntry[] {
  const out: SleepEntry[] = [];
  logs.forEach((l, i) => {
    if (l.log_type !== 'sleep' || !l.end_time) return;
    const start = new Date(l.start_time), end = new Date(l.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (minutes > 0) out.push({ id: l.id ?? `log-${i}`, start, end, minutes, kind: entryKind(start, minutes) });
  });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

const addDays = (d: Date, n = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const localDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToUtc = (key: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const utcToKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export function shiftKey(key: string, days: number): string {
  const ms = keyToUtc(key);
  return ms === null ? key : utcToKey(ms + days * DAY_MS);
}

export interface SleepDay { key: string; date: Date; totalMinutes: number; napCount: number; nightMinutes: number; sessions: SleepEntry[] }

/** Sleeps grouped by the day on which they ended, oldest day first. */
export function sleepDays(entries: SleepEntry[], now: Date, days = 7): SleepDay[] {
  const out: SleepDay[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const from = addDays(now, -i), to = addDays(now, -i + 1);
    const sessions = entries.filter((e) => e.end > from && e.end <= to);
    out.push({
      key: localDateKey(from), date: from,
      totalMinutes: sessions.reduce((s, e) => s + e.minutes, 0),
      napCount: sessions.filter((e) => e.kind === 'nap').length,
      nightMinutes: sessions.filter((e) => e.kind === 'night').reduce((s, e) => s + e.minutes, 0),
      sessions,
    });
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export type Insight = 'no_data' | 'need_more_data' | 'naps_below_range' | 'nap_short' | 'night_short'
  | 'wake_window_long' | 'wake_window_short' | 'total_below_range' | 'all_good';

export interface SleepSummary {
  daysWithData: number; avgDailyMinutes: number | null; avgNapsPerDay: number | null; avgNapMinutes: number | null;
  avgLongestNightMinutes: number | null; avgWakeWindowMinutes: number | null; medianBedtime: string | null;
  medianWakeTime: string | null; insights: Insight[];
}

/** Averages over the 7 days before today (today excluded) and what stands out for the age band. */
export function sleepSummary(o: { sessions: SleepEntry[]; band: AgeBand; now: Date }): SleepSummary {
  const norms = BAND_NORMS[o.band];
  const days = sleepDays(o.sessions, o.now, 8).slice(0, 7).filter((d) => d.totalMinutes > 0);
  const empty: SleepSummary = { daysWithData: 0, avgDailyMinutes: null, avgNapsPerDay: null, avgNapMinutes: null,
    avgLongestNightMinutes: null, avgWakeWindowMinutes: null, medianBedtime: null, medianWakeTime: null, insights: ['no_data'] };
  if (!days.length) return empty;
  const all = days.flatMap((d) => d.sessions), naps = all.filter((e) => e.kind === 'nap'), nights = all.filter((e) => e.kind === 'night');
  const longestNights = days.map((d) => Math.max(0, ...d.sessions.filter((e) => e.kind === 'night').map((e) => e.minutes))).filter((m) => m > 0);
  const windows: number[] = [];
  days.forEach((d) => {
    const dn = d.sessions.filter((e) => e.kind === 'nap');
    for (let i = 1; i < dn.length; i += 1) {
      const gap = (dn[i].start.getTime() - dn[i - 1].end.getTime()) / 60_000;
      if (gap > 0 && gap < 12 * 60) windows.push(gap);
    }
  });
  const bedtimes = nights.map((e) => { const m = minutesOfDay(e.start); return m < 12 * 60 ? m + 1440 : m; });
  const s: SleepSummary = {
    daysWithData: days.length,
    avgDailyMinutes: mean(days.map((d) => d.totalMinutes)),
    avgNapsPerDay: naps.length ? mean(days.map((d) => d.napCount)) : null,
    avgNapMinutes: mean(naps.map((e) => e.minutes)),
    avgLongestNightMinutes: mean(longestNights),
    avgWakeWindowMinutes: mean(windows),
    medianBedtime: bedtimes.length ? formatClock(median(bedtimes) as number) : null,
    medianWakeTime: nights.length ? formatClock(median(nights.map((e) => minutesOfDay(e.end))) as number) : null,
    insights: [],
  };
  if (days.length < MIN_DAYS_FOR_REVIEW) return { ...s, insights: ['need_more_data'] };
  const found: Insight[] = [];
  if (s.avgNapsPerDay !== null && s.avgNapsPerDay < norms.naps[0]) found.push('naps_below_range');
  if (s.avgLongestNightMinutes !== null && s.avgLongestNightMinutes < norms.longestNightHours[0] * 60) found.push('night_short');
  if (s.avgNapMinutes !== null && s.avgNapMinutes < norms.napMinutes[0]) found.push('nap_short');
  if (s.avgWakeWindowMinutes !== null && s.avgWakeWindowMinutes > norms.wakeWindowMinutes[1]) found.push('wake_window_long');
  if (s.avgWakeWindowMinutes !== null && s.avgWakeWindowMinutes < norms.wakeWindowMinutes[0]) found.push('wake_window_short');
  if (s.avgDailyMinutes !== null && s.avgDailyMinutes < norms.totalSleepHours[0] * 60) found.push('total_below_range');
  return { ...s, insights: found.length ? found : ['all_good'] };
}

// ── Plan state (on device) ─────────────────────────────────────────────────────
export const ROUTINE_STEPS = ['bath', 'pajamas', 'feed', 'story', 'dim_lights', 'crib_drowsy'] as const;
export type RoutineStep = typeof ROUTINE_STEPS[number];
export const METHODS = ['gentle_pickup', 'chair', 'fading', 'timed_checks'] as const;
export type Method = typeof METHODS[number];
export const METHOD_STEPS: Record<Method, string[]> = {
  gentle_pickup: ['gp_step_1', 'gp_step_2', 'gp_step_3', 'gp_step_4'],
  chair: ['chair_step_1', 'chair_step_2', 'chair_step_3'],
  fading: ['fade_step_1', 'fade_step_2', 'fade_step_3', 'fade_step_4', 'fade_step_5'],
  timed_checks: ['tc_step_1', 'tc_step_2', 'tc_step_3'],
};
export const RATINGS = ['easy', 'medium', 'hard'] as const;
export type Rating = typeof RATINGS[number];
export const SAFETY_ITEMS = ['back', 'firm', 'empty', 'share', 'sofa', 'temp', 'smoke'] as const;

export interface PlanState {
  wakeTime: string;
  method: Method | null;
  planStartDate: string | null;
  planDone: Record<string, Rating | null>;
  stepsDone: string[];
  routineDone: Record<string, string[]>;
  nightWakes: Record<string, number>;
  safetyDone: string[];
  pendingSleepStart: string | null;
}

export const DEFAULT_PLAN_STATE: PlanState = {
  wakeTime: DEFAULT_WAKE, method: null, planStartDate: null, planDone: {}, stepsDone: [],
  routineDone: {}, nightWakes: {}, safetyDone: [], pendingSleepStart: null,
};

export const planStorageKey = (userId: string) => `anacan.sleepTraining.v1.${userId}`;
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
const isPlanDay = (k: string) => /^\d+$/.test(k) && Number(k) >= 1 && Number(k) <= PLAN_DAYS;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const allSteps = () => METHODS.flatMap((m) => METHOD_STEPS[m]);

/** Plan day number (1 = start day) for today. */
export function planDayNumber(startKey: string, todayKey: string): number {
  const a = keyToUtc(startKey), b = keyToUtc(todayKey);
  return a === null || b === null ? 0 : Math.round((b - a) / DAY_MS) + 1;
}

export function planProgress(s: PlanState) {
  const completed = Object.keys(s.planDone).filter(isPlanDay).length;
  return { completed, total: PLAN_DAYS, percent: Math.round((completed / PLAN_DAYS) * 100) };
}

const routineComplete = (xs?: string[]) => !!xs && ROUTINE_STEPS.every((s) => xs.includes(s));

/** Consecutive complete evenings ending today (or yesterday while today is still open). */
export function routineStreak(done: Record<string, string[]>, todayKey: string): number {
  let key = routineComplete(done[todayKey]) ? todayKey : shiftKey(todayKey, -1), n = 0;
  while (n < 365 && routineComplete(done[key])) { n += 1; key = shiftKey(key, -1); }
  return n;
}

/** Night wake-ups belong to the night that started the previous evening before noon. */
export const nightKey = (d: Date) => localDateKey(d.getHours() < 12 ? addDays(d, -1) : d);

export function averageNightWakes(wakes: Record<string, number>, todayKey: string): number | null {
  const xs: number[] = [];
  for (let i = 0; i < 7; i += 1) { const v = wakes[shiftKey(todayKey, -i)]; if (typeof v === 'number') xs.push(v); }
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

export const toggleRoutine = (s: PlanState, key: string, step: string): PlanState =>
  ({ ...s, routineDone: { ...s.routineDone, [key]: toggle(s.routineDone[key] ?? [], step) } });
export const setWake = (s: PlanState, wake: string): PlanState => ({ ...s, wakeTime: normalizeWake(wake) });
export const pickMethod = (s: PlanState, method: Method, todayKey: string): PlanState =>
  ({ ...s, method, planStartDate: s.planStartDate ?? todayKey });
export const resetPlan = (s: PlanState): PlanState => ({ ...s, method: null, planStartDate: null, planDone: {}, stepsDone: [] });
export function ratePlanDay(s: PlanState, day: number, rating: Rating | null, clear = false): PlanState {
  if (!s.method || !Number.isInteger(day) || day < 1 || day > PLAN_DAYS) return s;
  const planDone = { ...s.planDone };
  if (clear) delete planDone[String(day)]; else planDone[String(day)] = rating;
  return { ...s, planDone };
}
export const toggleStep = (s: PlanState, step: string): PlanState =>
  (allSteps().includes(step) ? { ...s, stepsDone: toggle(s.stepsDone, step) } : s);
export const toggleSafety = (s: PlanState, item: string): PlanState =>
  ((SAFETY_ITEMS as readonly string[]).includes(item) ? { ...s, safetyDone: toggle(s.safetyDone, item) } : s);
export function adjustNightWakes(s: PlanState, key: string, delta: number): PlanState {
  const v = Math.min(20, Math.max(0, (s.nightWakes[key] ?? 0) + delta));
  return { ...s, nightWakes: { ...s.nightWakes, [key]: v } };
}
export const setPendingSleep = (s: PlanState, iso: string | null): PlanState => ({ ...s, pendingSleepStart: iso });

/** Drops entries older than 30 days and anything malformed, so storage stays small. */
export function prunePlanState(s: PlanState, todayKey: string): PlanState {
  const today = keyToUtc(todayKey);
  const recent = (k: string) => { const t = keyToUtc(k); return t !== null && today !== null && today - t >= 0 && today - t <= 29 * DAY_MS; };
  const routineDone: Record<string, string[]> = {};
  Object.entries(s.routineDone).forEach(([k, v]) => { if (recent(k)) routineDone[k] = v.filter((x) => (ROUTINE_STEPS as readonly string[]).includes(x)); });
  const nightWakes: Record<string, number> = {};
  Object.entries(s.nightWakes).forEach(([k, v]) => { if (recent(k) && Number.isFinite(v)) nightWakes[k] = Math.min(20, Math.max(0, Math.round(v))); });
  const planDone: Record<string, Rating | null> = {};
  Object.entries(s.planDone).forEach(([k, v]) => { if (isPlanDay(k)) planDone[k] = v && (RATINGS as readonly string[]).includes(v) ? v : null; });
  const steps = allSteps();
  return {
    ...s, wakeTime: normalizeWake(s.wakeTime), planDone,
    stepsDone: [...new Set(s.stepsDone)].filter((x) => steps.includes(x)),
    safetyDone: [...new Set(s.safetyDone)].filter((x) => (SAFETY_ITEMS as readonly string[]).includes(x)),
    routineDone, nightWakes, pendingSleepStart: isIso(s.pendingSleepStart) ? s.pendingSleepStart : null,
  };
}

/** Reads whatever was stored (including the older planDays format) into a valid state. */
export function parsePlanState(raw: unknown): PlanState {
  if (!raw || typeof raw !== 'object') return DEFAULT_PLAN_STATE;
  const r = raw as Record<string, unknown>;
  const planDone: Record<string, Rating | null> = {};
  if (r.planDone && typeof r.planDone === 'object') {
    Object.entries(r.planDone as Record<string, unknown>).forEach(([k, v]) => {
      if (isPlanDay(k)) planDone[k] = (RATINGS as readonly unknown[]).includes(v) ? (v as Rating) : null;
    });
  }
  if (Array.isArray(r.planDays)) {
    (r.planDays as unknown[]).forEach((d) => {
      if (Number.isInteger(d) && (d as number) >= 1 && (d as number) <= PLAN_DAYS && !(String(d) in planDone)) planDone[String(d)] = null;
    });
  }
  const routineDone: Record<string, string[]> = {};
  if (r.routineDone && typeof r.routineDone === 'object') {
    Object.entries(r.routineDone as Record<string, unknown>).forEach(([k, v]) => {
      if (keyToUtc(k) !== null && Array.isArray(v)) routineDone[k] = v.filter((x): x is string => typeof x === 'string' && (ROUTINE_STEPS as readonly string[]).includes(x));
    });
  }
  const nightWakes: Record<string, number> = {};
  if (r.nightWakes && typeof r.nightWakes === 'object') {
    Object.entries(r.nightWakes as Record<string, unknown>).forEach(([k, v]) => {
      if (keyToUtc(k) !== null && typeof v === 'number' && Number.isFinite(v)) nightWakes[k] = Math.min(20, Math.max(0, Math.round(v)));
    });
  }
  const steps = allSteps();
  return {
    wakeTime: normalizeWake(r.wakeTime),
    method: (METHODS as readonly unknown[]).includes(r.method) ? (r.method as Method) : null,
    planStartDate: typeof r.planStartDate === 'string' && keyToUtc(r.planStartDate) !== null ? r.planStartDate : null,
    planDone,
    stepsDone: Array.isArray(r.stepsDone) ? [...new Set((r.stepsDone as unknown[]).filter((x): x is string => typeof x === 'string' && steps.includes(x)))] : [],
    routineDone, nightWakes,
    safetyDone: Array.isArray(r.safetyDone) ? [...new Set((r.safetyDone as unknown[]).filter((x): x is string => typeof x === 'string' && (SAFETY_ITEMS as readonly string[]).includes(x)))] : [],
    pendingSleepStart: isIso(r.pendingSleepStart) ? r.pendingSleepStart : null,
  };
}

export { addDays as dayOffset };
