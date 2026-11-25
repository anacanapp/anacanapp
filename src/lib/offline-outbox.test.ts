import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn() } }));

import {
  OUTBOX_MAX_REJECTS,
  __resetOutboxForTests,
  enqueueOutbox,
  flushOutbox,
  isTransientError,
  pendingOutboxRows,
  readOutbox,
  saveWithOutbox,
  subscribeOutbox,
  type OutboxSender,
} from './offline-outbox';

const networkError = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
const rlsError = { message: 'new row violates row-level security policy', code: '42501' };

/** Fake server: a table of rows keyed by id, with an idempotent insert like upsert ignoreDuplicates. */
function fakeServer() {
  const rows = new Map<string, Record<string, unknown>>();
  let mode: 'ok' | 'offline' | 'reject' = 'ok';
  const calls: string[] = [];
  const send: OutboxSender = async (_table, row) => {
    calls.push(row.id as string);
    if (mode === 'offline') return { data: null, error: networkError, status: 0 };
    if (mode === 'reject') return { data: null, error: rlsError, status: 403 };
    if (rows.has(row.id as string)) return { data: null, error: null, status: 201 };
    rows.set(row.id as string, row);
    return { data: row, error: null, status: 201 };
  };
  return { rows, calls, send, setMode: (m: typeof mode) => { mode = m; } };
}

beforeEach(() => {
  localStorage.clear();
  __resetOutboxForTests();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

describe('offline outbox', () => {
  it('enqueues entries with the client id as row id and dedupes by id', () => {
    expect(enqueueOutbox('u1', { id: 'a', table: 'baby_logs', payload: { log_type: 'sleep' } })).toBe(true);
    enqueueOutbox('u1', { id: 'a', table: 'baby_logs', payload: { log_type: 'sleep', notes: 'x' } });
    const entries = readOutbox('u1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'a', table: 'baby_logs', attempts: 0, payload: { id: 'a', notes: 'x' } });
    expect(typeof entries[0].createdAt).toBe('number');
  });

  it('keeps queues isolated per user', async () => {
    enqueueOutbox('u1', { id: 'a', table: 'baby_logs', payload: { user_id: 'u1' } });
    enqueueOutbox('u2', { id: 'b', table: 'kick_sessions', payload: { user_id: 'u2' } });
    expect(readOutbox('u1').map((e) => e.id)).toEqual(['a']);
    expect(readOutbox('u2').map((e) => e.id)).toEqual(['b']);
    expect(pendingOutboxRows('u1', 'kick_sessions')).toEqual([]);

    const server = fakeServer();
    await flushOutbox('u1', server.send);
    expect(server.calls).toEqual(['a']);
    expect(readOutbox('u1')).toEqual([]);
    expect(readOutbox('u2')).toHaveLength(1);
  });

  it('saves directly and leaves nothing queued on a confirmed write', async () => {
    const server = fakeServer();
    const outcome = await saveWithOutbox('u1', 'baby_logs', { user_id: 'u1', log_type: 'diaper' }, server.send);
    expect(outcome.status).toBe('saved');
    expect(server.rows.size).toBe(1);
    expect(readOutbox('u1')).toEqual([]);
  });

  it('queues on a network failure and flushes later with the same id (idempotent)', async () => {
    const server = fakeServer();
    server.setMode('offline');
    const outcome = await saveWithOutbox('u1', 'baby_logs', { user_id: 'u1', log_type: 'sleep' }, server.send);
    expect(outcome.status).toBe('queued');
    const [entry] = readOutbox('u1');
    expect(entry.attempts).toBe(1);
    expect(pendingOutboxRows('u1', 'baby_logs')).toEqual([expect.objectContaining({ id: entry.id, log_type: 'sleep' })]);

    // Second flush still offline: kept and retried later
    const offline = await flushOutbox('u1', server.send);
    expect(offline).toMatchObject({ sent: 0, failed: 1, dropped: 0 });
    expect(readOutbox('u1')[0].attempts).toBe(2);

    server.setMode('ok');
    const listener = vi.fn();
    subscribeOutbox(listener);
    const flushed = await flushOutbox('u1', server.send);
    expect(flushed).toMatchObject({ sent: 1, tables: ['baby_logs'] });
    expect(readOutbox('u1')).toEqual([]);
    expect(listener).toHaveBeenCalledWith({ userId: 'u1', sentTables: ['baby_logs'] });
    expect([...server.rows.keys()]).toEqual([entry.id]);

    // A retry of an id the server already has does not duplicate the row
    enqueueOutbox('u1', { id: entry.id, table: 'baby_logs', payload: entry.payload });
    await flushOutbox('u1', server.send);
    expect(server.rows.size).toBe(1);
    expect(readOutbox('u1')).toEqual([]);
  });

  it('returns a real server error without queueing', async () => {
    const server = fakeServer();
    server.setMode('reject');
    const outcome = await saveWithOutbox('u1', 'kick_sessions', { user_id: 'u1', kick_count: 3 }, server.send);
    expect(outcome.status).toBe('error');
    expect(readOutbox('u1')).toEqual([]);
  });

  it('caps retries of entries the server keeps rejecting', async () => {
    const server = fakeServer();
    server.setMode('reject');
    enqueueOutbox('u1', { id: 'bad', table: 'baby_logs', payload: {} });
    enqueueOutbox('u1', { id: 'good', table: 'baby_logs', payload: {} });
    for (let i = 1; i < OUTBOX_MAX_REJECTS; i++) {
      const r = await flushOutbox('u1', server.send);
      expect(r.dropped).toBe(0);
    }
    const last = await flushOutbox('u1', server.send);
    expect(last.dropped).toBe(2);
    expect(readOutbox('u1')).toEqual([]);
  });

  it('stops a flush at the first network failure and dedupes concurrent flushes', async () => {
    const server = fakeServer();
    server.setMode('offline');
    enqueueOutbox('u1', { id: 'a', table: 'baby_logs', payload: {} });
    enqueueOutbox('u1', { id: 'b', table: 'baby_logs', payload: {} });
    const [first, second] = await Promise.all([flushOutbox('u1', server.send), flushOutbox('u1', server.send)]);
    expect(first).toBe(second);
    expect(server.calls).toEqual(['a']);
  });

  it('classifies transient errors', () => {
    expect(isTransientError(networkError)).toBe(true);
    expect(isTransientError({ name: 'AbortError', message: 'aborted' })).toBe(true);
    expect(isTransientError({ message: 'x' }, 503)).toBe(true);
    expect(isTransientError(rlsError, 403)).toBe(false);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    expect(isTransientError(rlsError, 403)).toBe(true);
  });
});
