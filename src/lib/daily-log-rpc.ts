/**
 * Server call for one daily-log patch (mood, symptoms, bleeding, sleep, notes — never water).
 *
 * `daily_logs` keeps one row per (user_id, log_date), so a patch is merge-upserted on that natural
 * key: PostgREST updates only the columns in the payload and leaves the rest of the day untouched
 * (water written by increment_water_intake_v1, symptoms written from another screen). Re-applying the
 * same fields yields the same row, so a lost-response retry or an offline replay is idempotent and
 * never creates a second row for the day.
 *
 * Kept free of runtime imports from offline-outbox (which dispatches `daily_logs` entries here).
 */
import { supabase } from '@/integrations/supabase/client';
import type { SendResult } from './offline-outbox';

/** Outbox token for a daily-log patch (the real table is `daily_logs`; water uses its own token). */
export const DAILY_LOG_OUTBOX_TABLE = 'daily_logs' as const;
export const DAILY_LOG_SEND_TIMEOUT_MS = 15_000;

/** Columns a client may patch for a day; water is excluded on purpose (own atomic path). */
const PATCH_COLUMNS = new Set(['mood', 'symptoms', 'bleeding', 'temperature', 'notes', 'sleep_hours', 'sleep_quality']);

/**
 * Sends one queued daily-log patch. The outbox entry id (`row.id`) is only the queue key, not the
 * server row id (which stays server-generated), so it is dropped before the upsert. `water_intake`
 * is dropped too: taps go through the atomic water path, never this merge.
 */
export async function sendDailyLogPatch(raw: Record<string, unknown>): Promise<SendResult> {
  const userId = raw.user_id;
  const logDate = raw.log_date;
  if (typeof userId !== 'string' || typeof logDate !== 'string' || !logDate) {
    return { data: null, error: { code: '22023', message: 'invalid daily log patch' }, status: 400 };
  }
  const row: Record<string, unknown> = { user_id: userId, log_date: logDate };
  let hasField = false;
  for (const [key, value] of Object.entries(raw)) {
    if (!PATCH_COLUMNS.has(key) || value === undefined) continue;
    row[key] = value;
    hasField = true;
  }
  if (!hasField) {
    return { data: null, error: { code: '22023', message: 'empty daily log patch' }, status: 400 };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), DAILY_LOG_SEND_TIMEOUT_MS) : null;
  try {
    // Merge-upsert on the day's natural key; replays re-write the same fields (idempotent).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('daily_logs')
      .upsert(row, { onConflict: 'user_id,log_date' })
      .select();
    if (controller) query = query.abortSignal(controller.signal);
    const { data, error, status } = await query.maybeSingle();
    return { data, error, status };
  } catch (error) {
    return { data: null, error, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
