import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Fake backend: daily_logs rows per day plus increment_water_intake_v1 with op-id dedupe. */
const mocks = vi.hoisted(() => ({
  rows: new Map<string, { water_intake: number; mood: number | null }>(),
  ops: new Set<string>(),
  calls: [] as Array<{ p_log_date: string; p_delta: number; p_op_id: string }>,
  mode: 'ok' as 'ok' | 'offline' | 'lost_answer' | 'missing_rpc',
  gate: null as Promise<void> | null,
  auth: { user: { id: 'u1' } as { id: string } | null },
  notifyWaterGoal: vi.fn(),
}));

const networkError = { message: 'TypeError: Failed to fetch', code: '' };

function applyDelta(day: string, delta: number) {
  const row = mocks.rows.get(day) ?? { water_intake: 0, mood: null };
  row.water_intake = Math.max(0, row.water_intake + delta);
  mocks.rows.set(day, row);
  return row.water_intake;
}

async function rpc(name: string, args: { p_log_date: string; p_delta: number; p_op_id: string }) {
  if (mocks.gate) await mocks.gate;
  if (name !== 'increment_water_intake_v1') return { data: null, error: { code: 'PGRST202' }, status: 404 };
  mocks.calls.push(args);
  if (mocks.mode === 'offline') return { data: null, error: networkError, status: 0 };
  if (mocks.mode === 'missing_rpc') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 };
  if (mocks.ops.has(args.p_op_id)) {
    return { data: { water_intake: mocks.rows.get(args.p_log_date)?.water_intake ?? 0, applied: false, log_date: args.p_log_date }, error: null, status: 200 };
  }
  mocks.ops.add(args.p_op_id);
  const total = applyDelta(args.p_log_date, args.p_delta);
  if (mocks.mode === 'lost_answer') return { data: null, error: networkError, status: 0 };
  return { data: { water_intake: total, applied: true, log_date: args.p_log_date }, error: null, status: 200 };
}

function from(table: string) {
  const filters: Record<string, unknown> = {};
  let upsertRow: Record<string, unknown> | null = null;
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'abortSignal']) c[m] = () => c;
  c.eq = (k: string, v: unknown) => { filters[k] = v; return c; };
  c.upsert = (row: Record<string, unknown>) => { upsertRow = row; return c; };
  c.maybeSingle = async () => {
    if (mocks.mode === 'offline') return { data: null, error: networkError, status: 0 };
    if (upsertRow) {
      const day = upsertRow.log_date as string;
      const row = mocks.rows.get(day) ?? { water_intake: 0, mood: null };
      row.water_intake = upsertRow.water_intake as number;
      mocks.rows.set(day, row);
      return { data: { water_intake: row.water_intake }, error: null, status: 201 };
    }
    const row = mocks.rows.get(filters.log_date as string);
    return { data: row ? { water_intake: row.water_intake } : null, error: null, status: 200 };
  };
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mocks.mode === 'offline'
    ? { data: null, error: networkError }
    : {
        data: table === 'daily_logs'
          ? [...mocks.rows.entries()].map(([log_date, r]) => ({ id: `id-${log_date}`, user_id: 'u1', log_date, ...r }))
            .sort((a, b) => b.log_date.localeCompare(a.log_date))
          : [],
        error: null,
      }).then(resolve);
  return c;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: (name: string, args: { p_log_date: string; p_delta: number; p_op_id: string }) => {
      const p = rpc(name, args);
      const builder = { abortSignal: () => builder, then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => p.then(res, rej) };
      return builder;
    },
  },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) } }));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./usePartnerNotifications', () => ({
  usePartnerNotifications: () => ({ notifyMoodUpdate: vi.fn(), notifyWaterGoal: mocks.notifyWaterGoal }),
}));

import { useDailyLogs } from './useDailyLogs';
import { __resetOutboxForTests, flushOutbox, readOutbox } from '@/lib/offline-outbox';
import { __resetWaterForTests } from '@/lib/water-intake';

const originalTz = process.env.TZ;

beforeEach(() => {
  process.env.TZ = 'Asia/Baku';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T08:00:00Z')); // 12:00 in Baku
  localStorage.clear();
  __resetOutboxForTests();
  __resetWaterForTests();
  mocks.rows.clear();
  mocks.ops.clear();
  mocks.calls.length = 0;
  mocks.mode = 'ok';
  mocks.gate = null;
  mocks.auth.user = { id: 'u1' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.env.TZ = originalTz;
});

async function mounted() {
  const hook = renderHook(() => useDailyLogs());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('water taps', () => {
  it('counts a quick double tap as two glasses, shown before the server answers', async () => {
    mocks.rows.set('2026-09-10', { water_intake: 3, mood: 4 });
    const { result } = await mounted();
    expect(result.current.waterToday).toBe(3);

    let release!: () => void;
    mocks.gate = new Promise<void>((r) => { release = r; });
    let taps!: Promise<unknown>;
    act(() => { taps = Promise.all([result.current.updateWaterIntake(1), result.current.updateWaterIntake(1)]); });
    await waitFor(() => expect(result.current.waterToday).toBe(5));
    mocks.gate = null;
    await act(async () => { release(); await taps; });

    expect(mocks.calls.map((c) => c.p_delta)).toEqual([1, 1]);
    expect(new Set(mocks.calls.map((c) => c.p_op_id)).size).toBe(2);
    expect(mocks.rows.get('2026-09-10')).toEqual({ water_intake: 5, mood: 4 });
    expect(result.current.waterToday).toBe(5);
    expect(result.current.todayLog?.mood).toBe(4);
    expect(readOutbox('u1')).toEqual([]);
  });

  it('starts a new local day at 1 when the app stayed open across midnight', async () => {
    mocks.rows.set('2026-09-10', { water_intake: 6, mood: null });
    const { result } = await mounted();
    expect(result.current.waterToday).toBe(6);

    vi.setSystemTime(new Date('2026-09-10T20:05:00Z')); // 00:05 on 11 Sep in Baku, still 10 Sep in UTC
    await act(async () => { await result.current.updateWaterIntake(1); });

    expect(mocks.calls[0]).toMatchObject({ p_log_date: '2026-09-11', p_delta: 1 });
    expect(mocks.rows.get('2026-09-11')?.water_intake).toBe(1);
    expect(mocks.rows.get('2026-09-10')?.water_intake).toBe(6);
    expect(result.current.waterToday).toBe(1);
    expect(result.current.todayLog?.log_date).toBe('2026-09-11');
  });

  it('does not show yesterday’s row as today after midnight', async () => {
    mocks.rows.set('2026-09-10', { water_intake: 6, mood: 2 });
    const { result, rerender } = await mounted();
    vi.setSystemTime(new Date('2026-09-10T20:05:00Z'));
    rerender();
    expect(result.current.waterToday).toBe(0);
    expect(result.current.todayLog).toBeNull();
  });

  it('keeps offline taps queued, shows them, and replays them once when online', async () => {
    const { result } = await mounted();
    mocks.mode = 'offline';
    let outcome: unknown;
    await act(async () => { outcome = await result.current.updateWaterIntake(1); });
    await act(async () => { await result.current.updateWaterIntake(1); });
    expect(outcome).toMatchObject({ error: null });
    expect(readOutbox('u1').map((e) => e.table)).toEqual(['water_intake', 'water_intake']);
    expect(result.current.waterToday).toBe(2);

    mocks.mode = 'ok';
    await act(async () => { await flushOutbox('u1'); });
    expect(readOutbox('u1')).toEqual([]);
    expect(mocks.rows.get('2026-09-10')?.water_intake).toBe(2);
    await waitFor(() => expect(result.current.waterToday).toBe(2));
  });

  it('does not double count when the answer was lost and the tap is retried', async () => {
    const { result } = await mounted();
    mocks.mode = 'lost_answer';
    await act(async () => { await result.current.updateWaterIntake(1); });
    expect(mocks.rows.get('2026-09-10')?.water_intake).toBe(1);
    expect(readOutbox('u1')).toHaveLength(1);

    mocks.mode = 'ok';
    await act(async () => { await flushOutbox('u1'); });
    expect(mocks.calls).toHaveLength(2);
    expect(mocks.calls[0].p_op_id).toBe(mocks.calls[1].p_op_id);
    expect(mocks.rows.get('2026-09-10')?.water_intake).toBe(1);
    await waitFor(() => expect(result.current.waterToday).toBe(1));
  });

  it('falls back to the old read-and-add write when the server has no RPC yet', async () => {
    mocks.rows.set('2026-09-10', { water_intake: 2, mood: null });
    const { result } = await mounted();
    mocks.mode = 'missing_rpc';
    await act(async () => { await result.current.updateWaterIntake(1); });
    expect(mocks.rows.get('2026-09-10')?.water_intake).toBe(3);
    expect(result.current.waterToday).toBe(3);
    expect(readOutbox('u1')).toEqual([]);
  });
});
