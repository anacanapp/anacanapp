/**
 * Water taps as server-side deltas (audit M1).
 *
 * - The day is the phone's local calendar day at tap time, never the cached "today" row, so a
 *   tap after midnight starts the new day at 1 instead of carrying yesterday's total.
 * - Each tap is a delta with a client op id, persisted in the offline outbox before it is sent.
 *   Quick double taps are two deltas (+2), never two "total + 1" writes (+1).
 * - Sends from this device run one after another, so server totals arrive in order.
 * - Offline / timeout / 5xx: the tap stays queued and is replayed by the outbox flush
 *   (online, app resume, login). The server ignores an op id it already applied.
 *
 * Display = server total for the day (when the loaded row is for that day) + queued deltas.
 */
import { todayKey } from './local-date';
import {
  enqueueOutbox, isTransientError, newClientId, readOutbox, removeOutboxEntry,
  type OutboxSender, type SaveOutcome, sendRow,
} from './offline-outbox';
import { WATER_OUTBOX_TABLE, clampWater } from './water-intake-rpc';

export { WATER_OUTBOX_TABLE };

/** Sum of queued (not yet confirmed) water deltas of `userId` for `day`. */
export function pendingWaterDelta(userId: string | null | undefined, day: string): number {
  return readOutbox(userId)
    .filter((e) => e.table === WATER_OUTBOX_TABLE && e.payload.log_date === day && typeof e.payload.delta === 'number')
    .reduce((sum, e) => sum + (e.payload.delta as number), 0);
}

/** Stored water of a loaded log row, only when that row is for `day` (yesterday's row counts as 0). */
export function storedWaterForDay(log: { log_date: string; water_intake: number | null } | null | undefined, day: string): number {
  return log && log.log_date === day ? log.water_intake || 0 : 0;
}

/** What the UI shows for `day`. */
export function displayedWater(
  userId: string | null | undefined,
  log: { log_date: string; water_intake: number | null } | null | undefined,
  day: string = todayKey(),
): number {
  return clampWater(storedWaterForDay(log, day) + pendingWaterDelta(userId, day));
}

export interface AddWaterOptions {
  /** Local day of the tap; defaults to the phone's calendar day now. */
  day?: string;
  send?: OutboxSender;
  /** Called with the confirmed server total before the tap leaves the queue (no flicker). */
  onServerTotal?: (total: number, day: string, applied: boolean) => void;
}

const chains = new Map<string, Promise<unknown>>();

/**
 * Records one water tap. Resolves `saved` (server total in `data.water_intake`), `queued`
 * (kept for a later flush) or `error` (rejected by the server; the tap is dropped again).
 */
export function addWater(userId: string, delta: number, options: AddWaterOptions = {}): Promise<SaveOutcome> {
  const day = options.day ?? todayKey();
  const send = options.send ?? sendRow;
  const id = newClientId();
  const payload = { id, user_id: userId, log_date: day, delta };
  const persisted = enqueueOutbox(userId, { id, table: WATER_OUTBOX_TABLE, payload });

  const run = async (): Promise<SaveOutcome> => {
    // A background flush already delivered it while this tap waited for the previous one.
    if (persisted && !readOutbox(userId).some((e) => e.id === id)) return { status: 'saved', data: payload };
    const { data, error, status } = await send(WATER_OUTBOX_TABLE, payload);
    if (!error) {
      const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
      const total = typeof result.water_intake === 'number' ? result.water_intake : null;
      if (total !== null) options.onServerTotal?.(total, day, result.applied !== false);
      removeOutboxEntry(userId, id);
      return { status: 'saved', data: { ...payload, ...result } };
    }
    if (isTransientError(error, status) && persisted) return { status: 'queued', data: payload };
    removeOutboxEntry(userId, id);
    return { status: 'error', error };
  };

  const previous = chains.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  chains.set(userId, current);
  void current.finally(() => { if (chains.get(userId) === current) chains.delete(userId); }).catch(() => undefined);
  return current;
}

/** Test helper. */
export function __resetWaterForTests() {
  chains.clear();
}
