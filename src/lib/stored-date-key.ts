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
