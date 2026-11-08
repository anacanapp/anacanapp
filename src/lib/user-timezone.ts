/**
 * Writes the device time zone (IANA name) to user_preferences.timezone so server jobs
 * (vitamin reminders) can fire at the parent's local time.
 *
 * - At most one attempt per user per app session (module memory).
 * - Writes only when the stored value differs.
 * - Quiet when the column does not exist yet (migration 20261108100000_user_timezone.sql not
 *   applied) or the backend is offline: nothing is logged and nothing is retried this session.
 */
import { supabase } from '@/integrations/supabase/client';

/** Same rule as the database CHECK constraint. */
export const TIME_ZONE_PATTERN = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;

export function isValidTimeZoneName(tz: unknown): tz is string {
  return typeof tz === 'string' && tz.length >= 1 && tz.length <= 64 && TIME_ZONE_PATTERN.test(tz);
}

/** The device time zone, or null when unavailable or not storable. */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZoneName(tz) ? tz : null;
  } catch {
    return null;
  }
}

type Result = { data?: unknown; error: unknown };

/** Minimal client surface used here (tests pass a fake). The column is not in the generated types yet. */
export interface TimeZoneClient {
  from(table: 'user_preferences'): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<Result> } };
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<Result>;
  };
}

export type TimeZoneSyncOutcome = 'skipped' | 'unchanged' | 'updated' | 'unavailable';

const attempted = new Set<string>();

/** Test helper: forget which users were synced this session. */
export function resetTimeZoneSyncForTests() {
  attempted.clear();
}

export async function syncUserTimeZone(
  userId: string | null | undefined,
  options: { client?: TimeZoneClient; timeZone?: string | null } = {}
): Promise<TimeZoneSyncOutcome> {
  if (!userId || attempted.has(userId)) return 'skipped';
  const timeZone = options.timeZone === undefined ? deviceTimeZone() : options.timeZone;
  if (!isValidTimeZoneName(timeZone)) return 'skipped';
  attempted.add(userId);
  const client = options.client ?? (supabase as unknown as TimeZoneClient);
  try {
    const read = await client.from('user_preferences').select('timezone').eq('user_id', userId).maybeSingle();
    // Missing column (not migrated yet), RLS or network: stay quiet.
    if (read.error) return 'unavailable';
    const stored = (read.data as { timezone?: unknown } | null | undefined)?.timezone;
    if (stored === timeZone) return 'unchanged';
    const write = await client.from('user_preferences').upsert({ user_id: userId, timezone: timeZone }, { onConflict: 'user_id' });
    return write.error ? 'unavailable' : 'updated';
  } catch {
    return 'unavailable';
  }
}
