/**
 * Offline outbox for small health log writes (baby logs, kick sessions).
 *
 * A write is put in a per-user persisted queue BEFORE the network call, so an
 * app kill, a dropped connection or a timeout can never lose it. Every row
 * carries a client generated UUID as its primary key and is sent with
 * `upsert(..., { onConflict: 'id', ignoreDuplicates: true })`, so a retry of a
 * row the server already stored is a no-op instead of a duplicate.
 *
 * - Confirmed write: the entry is removed.
 * - Network/timeout/5xx failure: the entry stays and is flushed later (app
 *   start, login, `online`, app resume).
 * - Real server rejection (constraint, RLS...): the direct caller removes it and
 *   shows an error; during a background flush it is retried a few times and then
 *   dropped (logged), so a poisoned row never blocks the queue forever.
 *
 * Storage: localStorage through the quota-aware writer (durable, never evicted
 * as a disposable cache). Entries are keyed by user id so accounts never mix.
 */
import { App as CapApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { writeStorageItem } from './local-storage';
import { WATER_OUTBOX_TABLE, sendWaterDelta } from './water-intake-rpc';

/** Row tables, plus `water_intake`: a water delta sent through increment_water_intake_v1 (entry id = op id). */
export type OutboxTable = 'baby_logs' | 'kick_sessions' | typeof WATER_OUTBOX_TABLE;

export interface OutboxEntry {
  /** Client generated UUID, also the row's primary key. */
  id: string;
  table: OutboxTable;
  payload: Record<string, unknown>;
  createdAt: number;
  /** Failed send attempts (any reason). */
  attempts: number;
  /** Attempts the server answered with a real (non-transient) rejection. */
  rejects?: number;
}

export interface SendResult {
  data?: unknown;
  error: unknown;
  /** HTTP status when known (0 = no response). */
  status?: number;
}

export type OutboxSender = (table: OutboxTable, row: Record<string, unknown>) => Promise<SendResult>;

export type SaveOutcome =
  | { status: 'saved'; data: Record<string, unknown> }
  | { status: 'queued'; data: Record<string, unknown> }
  | { status: 'error'; error: unknown };

export interface FlushResult {
  sent: number;
  failed: number;
  dropped: number;
  tables: OutboxTable[];
}

/** Server rejections tolerated in background flushes before an entry is dropped. */
export const OUTBOX_MAX_REJECTS = 5;
/** Hard ceiling for any entry (also network failures), roughly weeks of resumes. */
export const OUTBOX_MAX_ATTEMPTS = 200;
/** Request timeout; a slower answer is treated like a network failure. */
export const OUTBOX_SEND_TIMEOUT_MS = 15_000;

const KEY_PREFIX = 'anacan_outbox_v1:';
const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;
const TABLES: OutboxTable[] = ['baby_logs', 'kick_sessions', WATER_OUTBOX_TABLE];

export function newClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  // RFC 4122 v4 fallback for very old WebViews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as OutboxEntry;
  return typeof e.id === 'string' && TABLES.includes(e.table) && !!e.payload && typeof e.payload === 'object'
    && typeof e.createdAt === 'number' && typeof e.attempts === 'number';
}

export function readOutbox(userId: string | null | undefined): OutboxEntry[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

// ---- change notifications -------------------------------------------------
type Listener = (event: { userId: string; sentTables: OutboxTable[] }) => void;
const listeners = new Set<Listener>();

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(userId: string, sentTables: OutboxTable[] = []) {
  listeners.forEach((listener) => {
    try { listener({ userId, sentTables }); } catch (error) { console.error('outbox listener failed', error); }
  });
}

function writeOutbox(userId: string, entries: OutboxEntry[]): boolean {
  try {
    if (entries.length === 0) localStorage.removeItem(keyFor(userId));
    else writeStorageItem(localStorage, keyFor(userId), JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error('outbox write failed', error);
    return false;
  }
}

/** Adds (or replaces, same id) an entry. Returns false when storage refused it. */
export function enqueueOutbox(
  userId: string,
  entry: { id: string; table: OutboxTable; payload: Record<string, unknown> },
): boolean {
  const current = readOutbox(userId);
  const existing = current.find((e) => e.id === entry.id);
  const next: OutboxEntry = existing
    ? { ...existing, payload: { ...entry.payload, id: entry.id } }
    : { id: entry.id, table: entry.table, payload: { ...entry.payload, id: entry.id }, createdAt: Date.now(), attempts: 0 };
  const ok = writeOutbox(userId, [...current.filter((e) => e.id !== entry.id), next]);
  if (ok) notify(userId);
  return ok;
}

export function removeOutboxEntry(userId: string, id: string): void {
  const current = readOutbox(userId);
  if (!current.some((e) => e.id === id)) return;
  writeOutbox(userId, current.filter((e) => e.id !== id));
  notify(userId);
}

/** Queued rows of one table (payload incl. id), oldest first, for optimistic display. */
export function pendingOutboxRows(userId: string | null | undefined, table: OutboxTable): Record<string, unknown>[] {
  return readOutbox(userId)
    .filter((e) => e.table === table)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => e.payload);
}

// ---- error classification ------------------------------------------------
/** True for failures that may succeed later: offline, timeout, no response, 5xx, 408/429, expired auth. */
export function isTransientError(error: unknown, status?: number): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (status !== undefined && (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500)) return true;
  if (!error) return false;
  const e = error as { name?: string; message?: string; code?: string; details?: string };
  if (e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'TypeError') return true;
  if (e.code === 'PGRST301' || e.code === 'PGRST303') return true; // JWT expired/invalid: retry after refresh
  const text = `${e.message ?? ''} ${e.details ?? ''} ${typeof error === 'string' ? error : ''}`.toLowerCase();
  return /failed to fetch|load failed|network|fetch failed|timed? ?out|timeout|aborted|offline|connection|econn|enotfound|socket/.test(text);
}

// ---- sending --------------------------------------------------------------
/** Idempotent insert: an already stored id is ignored rather than duplicated. */
export const sendRow: OutboxSender = async (table, row) => {
  if (table === WATER_OUTBOX_TABLE) return sendWaterDelta(row);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), OUTBOX_SEND_TIMEOUT_MS) : null;
  try {
    // Dynamic table name: the generated client types cannot narrow a union here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from(table)
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      .select();
    if (controller) query = query.abortSignal(controller.signal);
    const { data, error, status } = await query.maybeSingle();
    return { data, error, status };
  } catch (error) {
    return { data: null, error, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

function bump(userId: string, id: string, rejected: boolean): 'kept' | 'dropped' {
  const current = readOutbox(userId);
  const entry = current.find((e) => e.id === id);
  if (!entry) return 'kept';
  const attempts = entry.attempts + 1;
  const rejects = (entry.rejects ?? 0) + (rejected ? 1 : 0);
  if (rejects >= OUTBOX_MAX_REJECTS || attempts >= OUTBOX_MAX_ATTEMPTS) {
    console.error('outbox: dropping entry after repeated failures', { table: entry.table, id, attempts, rejects });
    writeOutbox(userId, current.filter((e) => e.id !== id));
    return 'dropped';
  }
  writeOutbox(userId, current.map((e) => (e.id === id ? { ...e, attempts, rejects } : e)));
  return 'kept';
}

/**
 * Persist-then-send for one row. The row (with `id`) is queued first; the
 * outcome says whether the server confirmed it, it stays queued, or the server
 * rejected it (then it is removed again so the caller can let the user retry).
 */
export async function saveWithOutbox(
  userId: string,
  table: OutboxTable,
  row: Record<string, unknown>,
  send: OutboxSender = sendRow,
): Promise<SaveOutcome> {
  const id = typeof row.id === 'string' && row.id ? row.id : newClientId();
  const payload = { ...row, id };
  const persisted = enqueueOutbox(userId, { id, table, payload });
  const { data, error, status } = await send(table, payload);
  if (!error) {
    removeOutboxEntry(userId, id);
    return { status: 'saved', data: (data && typeof data === 'object' ? data : payload) as Record<string, unknown> };
  }
  if (isTransientError(error, status) && persisted) {
    bump(userId, id, false);
    return { status: 'queued', data: payload };
  }
  removeOutboxEntry(userId, id);
  return { status: 'error', error };
}

const inflight = new Map<string, Promise<FlushResult>>();

/** Sends queued entries oldest first; stops at the first transient failure. Deduped per user. */
export function flushOutbox(userId: string | null | undefined, send: OutboxSender = sendRow): Promise<FlushResult> {
  const empty: FlushResult = { sent: 0, failed: 0, dropped: 0, tables: [] };
  if (!userId) return Promise.resolve(empty);
  const running = inflight.get(userId);
  if (running) return running;
  if (readOutbox(userId).length === 0) return Promise.resolve(empty);

  const run = (async () => {
    const result: FlushResult = { ...empty, tables: [] };
    const entries = [...readOutbox(userId)].sort((a, b) => a.createdAt - b.createdAt);
    for (const entry of entries) {
      // Removed meanwhile (direct save confirmed it)
      if (!readOutbox(userId).some((e) => e.id === entry.id)) continue;
      const { error, status } = await send(entry.table, { ...entry.payload, id: entry.id });
      if (!error) {
        removeOutboxEntry(userId, entry.id);
        result.sent++;
        if (!result.tables.includes(entry.table)) result.tables.push(entry.table);
        continue;
      }
      const transient = isTransientError(error, status);
      result.failed++;
      if (bump(userId, entry.id, !transient) === 'dropped') result.dropped++;
      if (transient) break; // still offline: keep the rest for the next trigger
    }
    notify(userId, result.tables);
    return result;
  })().finally(() => inflight.delete(userId));
  inflight.set(userId, run);
  return run;
}

// ---- automatic flush triggers ---------------------------------------------
const activeUsers = new Map<string, number>();
let triggersInstalled = false;

function flushActiveUsers() {
  activeUsers.forEach((_count, userId) => { void flushOutbox(userId); });
}

function installTriggers() {
  if (triggersInstalled || typeof window === 'undefined') return;
  triggersInstalled = true;
  window.addEventListener('online', flushActiveUsers);
  try {
    const pending = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) flushActiveUsers();
    });
    if (pending && typeof (pending as Promise<unknown>).catch === 'function') {
      (pending as Promise<unknown>).catch(() => { /* web without the plugin */ });
    }
  } catch { /* plugin unavailable */ }
}

/**
 * Keeps the outbox of a signed-in user flushing: flushes immediately (app start,
 * login, remount) and again on `online` and app resume. Reference counted, so
 * many hook instances share one set of listeners. Returns a release function.
 */
export function retainOutboxUser(userId: string): () => void {
  installTriggers();
  activeUsers.set(userId, (activeUsers.get(userId) ?? 0) + 1);
  void flushOutbox(userId);
  return () => {
    const count = (activeUsers.get(userId) ?? 1) - 1;
    if (count <= 0) activeUsers.delete(userId);
    else activeUsers.set(userId, count);
  };
}

/** Test helper. */
export function __resetOutboxForTests() {
  inflight.clear();
  activeUsers.clear();
  listeners.clear();
}
