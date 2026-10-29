import { addDays, differenceInCalendarDays, parseISO, subDays, format } from 'date-fns';

/** Days apart that still count as the same period (one missed log in between). */
const SAME_PERIOD_GAP = 2;

export type MommyPeriodState =
  | 'none'      // nothing recorded since the birth
  | 'today'     // period recorded for today: offer "ended"
  | 'askToday'  // recorded until yesterday and not ended: ask whether it continues today
  | 'idle';     // last period is over: offer "started"

export interface MommyPeriodStatus {
  state: MommyPeriodState;
  /** First day of the latest period (yyyy-MM-dd). */
  start: string | null;
  /** Latest recorded flow day (yyyy-MM-dd). */
  lastDay: string | null;
  /** Day number of the current period counting today (today / askToday). */
  dayNumber: number;
}

/**
 * Status of the postpartum period card from recorded flow days.
 * `endedOn` is the last day the user marked as the end (kept on the device).
 */
export function mommyPeriodStatus(flowDays: readonly string[], today: string, endedOn: string | null): MommyPeriodStatus {
  const days = [...new Set(flowDays)].filter((d) => d <= today).sort();
  const lastDay = days.at(-1) ?? null;
  if (!lastDay) return { state: 'none', start: null, lastDay: null, dayNumber: 0 };

  let start = lastDay;
  for (let i = days.length - 2; i >= 0; i--) {
    if (differenceInCalendarDays(parseISO(start), parseISO(days[i])) > SAME_PERIOD_GAP) break;
    start = days[i];
  }
  const dayNumber = differenceInCalendarDays(parseISO(today), parseISO(start)) + 1;
  const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');

  if (endedOn && endedOn >= lastDay) return { state: 'idle', start, lastDay, dayNumber: 0 };
  if (lastDay === today) return { state: 'today', start, lastDay, dayNumber };
  if (lastDay === yesterday) return { state: 'askToday', start, lastDay, dayNumber };
  return { state: 'idle', start, lastDay, dayNumber: 0 };
}

/** The last `count` calendar days ending today, oldest first (yyyy-MM-dd). */
export function recentDays(today: string, count = 14): string[] {
  const end = parseISO(today);
  return Array.from({ length: count }, (_, i) => format(subDays(end, count - 1 - i), 'yyyy-MM-dd'));
}

export interface MommyCycleInsights {
  /** Day of the current cycle counting the latest period start as day 1. */
  cycleDay: number;
  /** Cycle length used for the forecast (normal 21–35 day cycles only). */
  cycleLength: number;
  /** Average recorded period length in days. */
  periodLength: number;
  nextPeriod: string;
  daysUntilNext: number;
  /** Completed cycles since the birth, newest first. */
  cycles: { start: string; length: number; anomalous: boolean }[];
  /** True once two or more normal cycles drive the forecast. */
  learned: boolean;
}

/**
 * Postpartum cycle overview from recorded flow days alone (the Mommy profile keeps its
 * pregnancy anchors). Periods are runs of flow days; a cycle runs from one start to the next.
 * Cycles outside 21–35 days are shown as anomalies and do not move the forecast.
 */
export function mommyCycleInsights(flowDays: readonly string[], today: string, fallbackCycleLength = 28): MommyCycleInsights | null {
  const days = [...new Set(flowDays)].filter((d) => d <= today).sort();
  if (!days.length) return null;
  const periods: string[][] = [];
  for (const day of days) {
    const run = periods.at(-1);
    if (run && differenceInCalendarDays(parseISO(day), parseISO(run.at(-1)!)) <= SAME_PERIOD_GAP) run.push(day);
    else periods.push([day]);
  }
  const starts = periods.map((run) => run[0]);
  const cycles = starts.slice(1).map((start, i) => {
    const length = differenceInCalendarDays(parseISO(start), parseISO(starts[i]));
    return { start: starts[i], length, anomalous: length < 21 || length > 35 };
  }).reverse();
  const normal = cycles.filter((c) => !c.anomalous).slice(0, 6).map((c) => c.length);
  const learned = normal.length >= 2;
  const cycleLength = learned ? Math.round(normal.reduce((a, b) => a + b, 0) / normal.length) : fallbackCycleLength;
  const lengths = periods.map((run) => differenceInCalendarDays(parseISO(run.at(-1)!), parseISO(run[0])) + 1);
  const periodLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const latest = starts.at(-1)!;
  const cycleDay = differenceInCalendarDays(parseISO(today), parseISO(latest)) + 1;
  const next = format(addDays(parseISO(latest), cycleLength), 'yyyy-MM-dd');
  return { cycleDay, cycleLength, periodLength, nextPeriod: next,
    daysUntilNext: differenceInCalendarDays(parseISO(next), parseISO(today)), cycles, learned };
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** Phase of a cycle day: period days, ovulation around (length - 14) ± 1, follicular before, luteal after. */
export function phaseForCycleDay(cycleDay: number, cycleLength: number, periodLength: number): CyclePhase {
  const ovulation = cycleLength - 14;
  if (cycleDay <= periodLength) return 'menstrual';
  if (Math.abs(cycleDay - ovulation) <= 1) return 'ovulation';
  return cycleDay < ovulation ? 'follicular' : 'luteal';
}
