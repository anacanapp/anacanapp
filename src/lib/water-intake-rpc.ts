/**
 * Server call for one water tap (a delta, not a total). The server adds it atomically
 * (increment_water_intake_v1) and ignores an op id it has already applied, so a retry after a
 * lost answer or an offline replay never counts a glass twice.
 *
 * Kept free of runtime imports from offline-outbox (which dispatches `water_intake` entries here).
 */
import { supabase } from '@/integrations/supabase/client';
import type { SendResult } from './offline-outbox';

export const WATER_OUTBOX_TABLE = 'water_intake' as const;
export const WATER_RPC = 'increment_water_intake_v1';
export const WATER_SEND_TIMEOUT_MS = 15_000;

/** Outbox payload of one tap. `id` is the client op id. */
export interface WaterDeltaPayload {
  id: string;
  user_id: string;
  log_date: string;
  delta: number;
}

/** Same bounds as the server column clamp. */
export const clampWater = (value: number) => Math.max(0, Math.min(20_000, Math.round(value)));

/** The server has no such function yet (old backend): PostgREST PGRST202 / 404. */
export function isMissingRpc(error: unknown, status?: number): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'PGRST202' || e.code === '42883') return true;
  return status === 404 && /function|rpc/i.test(e.message ?? '');
}

function withTimeout<T extends { abortSignal?: (signal: AbortSignal) => T }>(query: T): { query: T; done: () => void } {
  if (typeof AbortController === 'undefined' || typeof query.abortSignal !== 'function') return { query, done: () => undefined };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WATER_SEND_TIMEOUT_MS);
  return { query: query.abortSignal(controller.signal), done: () => clearTimeout(timer) };
}

/**
 * Old backend only: read the stored total and upsert total + delta. Not idempotent, which is
 * why it is used only while the RPC is missing (web may deploy before the migration).
 */
async function legacyAddWater(row: WaterDeltaPayload): Promise<SendResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const current = await db.from('daily_logs').select('water_intake')
    .eq('user_id', row.user_id).eq('log_date', row.log_date).maybeSingle();
  if (current.error) return { data: null, error: current.error, status: current.status };
  const total = clampWater((current.data?.water_intake ?? 0) + row.delta);
  const saved = await db.from('daily_logs')
    .upsert({ user_id: row.user_id, log_date: row.log_date, water_intake: total }, { onConflict: 'user_id,log_date' })
    .select('water_intake').maybeSingle();
  if (saved.error) return { data: null, error: saved.error, status: saved.status };
  return { data: { water_intake: saved.data?.water_intake ?? total, applied: true, log_date: row.log_date }, error: null, status: saved.status };
}

/** Sends one queued water delta. `data` is `{ water_intake, applied, log_date }` on success. */
export async function sendWaterDelta(raw: Record<string, unknown>): Promise<SendResult> {
  const row = raw as unknown as WaterDeltaPayload;
  if (typeof row.log_date !== 'string' || typeof row.delta !== 'number' || !row.delta) {
    return { data: null, error: { code: '22023', message: 'invalid water delta' }, status: 400 };
  }
  const timed = withTimeout(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)(WATER_RPC, { p_log_date: row.log_date, p_delta: row.delta, p_op_id: row.id }),
  );
  try {
    const { data, error, status } = await timed.query;
    if (error && isMissingRpc(error, status)) return await legacyAddWater(row);
    return { data, error, status };
  } catch (error) {
    return { data: null, error, status: 0 };
  } finally {
    timed.done();
  }
}
