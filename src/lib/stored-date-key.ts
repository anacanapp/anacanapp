import { localDateKey } from '@/lib/local-date';

/**
 * YYYY-MM-DD of a calendar date kept in the user store (due date, last period, birth date).
 *
 * Those values arrive in two shapes: `new Date('2026-03-01')` from the profile row (UTC midnight) and
 * `new Date(2026, 2, 1)` from on-device pickers (local midnight). `toISOString()` shifts the second shape back a
 * day east of UTC; `localDateKey` shifts the first shape back a day west of UTC. A plain YYYY-MM-DD string is
 * returned as is, a value at exactly UTC midnight keeps its UTC day, anything else uses the local day.
 */
export function storedDateKey(value: Date | string | number | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const utcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  return utcMidnight ? date.toISOString().slice(0, 10) : localDateKey(date);
}

/**
 * Local-midnight Date for a stored calendar date (due date, last period, birth date, log_date).
 *
 * `new Date('2026-03-01')` is UTC midnight, which is still 28 February west of UTC, so day/week maths done on it
 * was one day late in the Americas. This reads the value with the same rules as `storedDateKey` (a YYYY-MM-DD
 * string or a UTC-midnight Date keeps that calendar day, anything else uses its local day) and returns that day at
 * local midnight. East of UTC (Baku, Istanbul, Moscow) the result is the same day the old parsing gave.
 * Returns null for empty or invalid values.
 */
export function storedCalendarDate(value: Date | string | number | null | undefined): Date | null {
  const key = storedDateKey(value);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
