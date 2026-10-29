import { differenceInCalendarDays, parseISO, subDays, format } from 'date-fns';

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
