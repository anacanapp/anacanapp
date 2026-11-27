// "Next nap" prediction: the wake window for the baby's age, learned from the family's own logged
// sleeps of the last 7 days, the rest of today's naps and bedtime, and upcoming sleep regressions.
// Pure functions; times are local.
import { BAND_NORMS, type AgeBand, type SleepEntry } from './sleep-training';

const MIN = 60_000;
const DAY_MS = 24 * 60 * MIN;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : 0;
};

/** Each nap of the day allows a slightly longer awake time (first window shortest, last longest). */
const WINDOW_FACTOR = [0.85, 1, 1.1, 1.15, 1.2];
export const windowFactor = (napIndex: number) => WINDOW_FACTOR[Math.min(WINDOW_FACTOR.length - 1, Math.max(0, napIndex))];

/** Daytime awake gaps between two logged sleeps (ignores overnight gaps and gaps beyond 6 h). */
export function awakeGaps(entries: SleepEntry[], now: Date, days = 7): number[] {
  const since = now.getTime() - days * DAY_MS;
  const sorted = entries.filter((e) => e.end.getTime() >= since).sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].end, start = sorted[i].start;
    const gap = (start.getTime() - prevEnd.getTime()) / MIN;
    const hour = prevEnd.getHours();
    if (gap >= 20 && gap <= 360 && hour >= 6 && hour < 19) gaps.push(gap);
  }
  return gaps;
}

export interface WakeWindow {
  /** Typical awake time in minutes for this baby now. */
  minutes: number;
  range: [number, number];
  /** How much the family's own data shaped it (0 = age norm only, up to 0.7). */
  personal: number;
  samples: number;
}

/** Age norm blended with the family's own median gap (more samples, more weight; capped at 70 %). */
export function personalWakeWindow(entries: SleepEntry[], band: AgeBand, now: Date): WakeWindow {
  const range = BAND_NORMS[band].wakeWindowMinutes;
  const norm = (range[0] + range[1]) / 2;
  const gaps = awakeGaps(entries, now).map((g) => clamp(g, range[0] * 0.75, range[1] * 1.25));
  const personal = Math.min(0.7, gaps.length / 15);
  const minutes = Math.round(norm * (1 - personal) + (gaps.length ? median(gaps) : norm) * personal);
  return { minutes: clamp(minutes, range[0] * 0.75, range[1] * 1.25), range, personal, samples: gaps.length };
}

export type SleepyCue = 'yawn' | 'stare' | 'rub_eyes' | 'fussy' | 'ears';
export const SLEEPY_CUES: SleepyCue[] = ['yawn', 'stare', 'rub_eyes', 'fussy', 'ears'];

export type NapState = 'sleeping' | 'early' | 'soon' | 'window' | 'overtired' | 'unknown';

export interface NextNap {
  state: NapState;
  lastWake: Date | null;
  awakeMinutes: number | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  /** Minutes until the window opens (negative once open). */
  minutesToStart: number | null;
  /** Progress of the wake window, 0…1.3 (for the gauge). */
  progress: number;
  napIndex: number;
  isBedtime: boolean;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Naps that ended today (night sleep excluded). */
export const napsToday = (entries: SleepEntry[], now: Date) => entries.filter((e) => e.kind === 'nap' && sameDay(e.end, now) && e.end <= now).length;

export function bedtimeFor(band: AgeBand, now: Date): Date {
  const h = band === '1-3' ? 20 * 60 + 30 : band === '4-6' ? 19 * 60 + 45 : 19 * 60 + 30;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(h / 60), h % 60);
}

/**
 * When the baby will be ready to sleep again. The last wake-up is the end of the latest logged sleep
 * (or the morning wake time when nothing is logged today). Each sleepy cue pulls the window 5 min
 * earlier (at most 15).
 */
export function predictNextNap(o: {
  entries: SleepEntry[]; band: AgeBand; now: Date; sleepingSince?: Date | null; morningWake?: Date | null; cues?: SleepyCue[];
}): NextNap {
  const { entries, band, now } = o;
  const empty: NextNap = { state: 'unknown', lastWake: null, awakeMinutes: null, windowStart: null, windowEnd: null, minutesToStart: null, progress: 0, napIndex: 0, isBedtime: false };
  if (o.sleepingSince) return { ...empty, state: 'sleeping' };
  const past = entries.filter((e) => e.end <= now);
  const latest = past[past.length - 1];
  let lastWake: Date | null = latest && now.getTime() - latest.end.getTime() < 10 * 60 * MIN ? latest.end : null;
  if (!lastWake && o.morningWake && o.morningWake <= now && sameDay(o.morningWake, now)) lastWake = o.morningWake;
  if (!lastWake) return empty;

  const ww = personalWakeWindow(entries, band, now);
  const napIndex = napsToday(entries, now);
  const length = ww.minutes * windowFactor(napIndex);
  const shift = Math.min(15, (o.cues?.length ?? 0) * 5);
  let start = new Date(lastWake.getTime() + (length * 0.92 - shift) * MIN);
  let end = new Date(lastWake.getTime() + (length * 1.08 - shift) * MIN);
  const bedtime = bedtimeFor(band, now);
  const isBedtime = start.getTime() >= bedtime.getTime() - 45 * MIN;
  if (isBedtime) {
    start = new Date(Math.max(bedtime.getTime() - 15 * MIN, lastWake.getTime() + 30 * MIN));
    end = new Date(start.getTime() + 30 * MIN);
  }
  const awakeMinutes = Math.round((now.getTime() - lastWake.getTime()) / MIN);
  const minutesToStart = Math.round((start.getTime() - now.getTime()) / MIN);
  const total = (end.getTime() - lastWake.getTime()) / MIN;
  const state: NapState = now > new Date(end.getTime() + 20 * MIN) ? 'overtired' : now >= start ? 'window' : minutesToStart <= 20 ? 'soon' : 'early';
  return { state, lastWake, awakeMinutes, windowStart: start, windowEnd: end, minutesToStart, progress: clamp(awakeMinutes / total, 0, 1.3), napIndex, isBedtime };
}

export interface PlanItem {
  kind: 'nap' | 'bedtime';
  start: Date;
  end: Date;
  status: 'done' | 'now' | 'predicted';
  minutes: number;
}

/** Today's naps that already happened plus the predicted rest of the day until bedtime. */
export function predictDay(o: { entries: SleepEntry[]; band: AgeBand; now: Date; next: NextNap; sleepingSince?: Date | null }): PlanItem[] {
  const { entries, band, now, next } = o;
  const items: PlanItem[] = entries.filter((e) => e.kind === 'nap' && sameDay(e.start, now))
    .map((e) => ({ kind: 'nap' as const, start: e.start, end: e.end, status: 'done' as const, minutes: e.minutes }));
  const norms = BAND_NORMS[band];
  const napLen = Math.round((norms.napMinutes[0] + norms.napMinutes[1]) / 2);
  const bedtime = bedtimeFor(band, now);
  const ww = personalWakeWindow(entries, band, now);
  let cursor: Date | null = null;
  let index = items.length;
  if (o.sleepingSince) {
    const end = new Date(Math.max(now.getTime() + 10 * MIN, o.sleepingSince.getTime() + napLen * MIN));
    items.push({ kind: 'nap', start: o.sleepingSince, end, status: 'now', minutes: Math.round((end.getTime() - o.sleepingSince.getTime()) / MIN) });
    cursor = end;
    index += 1;
  } else if (next.windowStart && !next.isBedtime) {
    const end = new Date(next.windowStart.getTime() + napLen * MIN);
    items.push({ kind: 'nap', start: next.windowStart, end, status: 'predicted', minutes: napLen });
    cursor = end;
    index += 1;
  }
  for (let guard = 0; cursor && guard < 4; guard++) {
    const start: Date = new Date(cursor.getTime() + ww.minutes * windowFactor(index) * MIN);
    if (start.getTime() >= bedtime.getTime() - 60 * MIN) break;
    const len = Math.min(napLen, Math.max(30, (bedtime.getTime() - start.getTime()) / MIN - ww.minutes));
    const end: Date = new Date(start.getTime() + len * MIN);
    items.push({ kind: 'nap', start, end, status: 'predicted', minutes: Math.round(len) });
    cursor = end;
    index += 1;
  }
  const bedStart = next.isBedtime && next.windowStart ? next.windowStart : bedtime;
  items.push({ kind: 'bedtime', start: bedStart, end: bedStart, status: 'predicted', minutes: 0 });
  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type RegressionKey = 'm4' | 'm8' | 'm12' | 'm18' | 'm24';
export interface Regression { key: RegressionKey; start: Date; end: Date; daysUntil: number; active: boolean }

/** Typical windows (weeks after birth) when sleep often gets harder for a while. */
const REGRESSIONS: { key: RegressionKey; fromWeek: number; toWeek: number }[] = [
  { key: 'm4', fromWeek: 15, toWeek: 19 },
  { key: 'm8', fromWeek: 34, toWeek: 44 },
  { key: 'm12', fromWeek: 50, toWeek: 55 },
  { key: 'm18', fromWeek: 76, toWeek: 82 },
  { key: 'm24', fromWeek: 102, toWeek: 108 }
];

/** The current regression (if any) and the next ones, based on (corrected) birth date. */
export function upcomingRegressions(birth: Date, now: Date): Regression[] {
  const base = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return REGRESSIONS.map((r) => {
    const start = new Date(base + r.fromWeek * 7 * DAY_MS), end = new Date(base + r.toWeek * 7 * DAY_MS);
    return { key: r.key, start, end, daysUntil: Math.round((start.getTime() - today) / DAY_MS), active: start.getTime() <= today && today <= end.getTime() };
  }).filter((r) => r.end.getTime() >= today);
}
