import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  server: new Map<string, Record<string, unknown>>(),
  online: true,
  reject: false,
  toast: vi.fn(),
  notifyKick: vi.fn(async () => undefined),
  auth: { user: { id: 'u1' } },
  children: { selectedChild: { id: 'c1' } },
}));

const networkError = { message: 'TypeError: Failed to fetch', code: '' };

function from(table: string) {
  let upsertRow: Record<string, unknown> | null = null;
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'abortSignal']) c[m] = () => c;
  c.upsert = (row: Record<string, unknown>) => { upsertRow = row; return c; };
  c.maybeSingle = async () => {
    if (!mocks.online) return { data: null, error: networkError, status: 0 };
    if (mocks.reject) return { data: null, error: { message: 'check constraint', code: '23514' }, status: 400 };
    const id = upsertRow!.id as string;
    if (mocks.server.has(id)) return { data: null, error: null, status: 201 };
    const row = { created_at: new Date().toISOString(), ...upsertRow!, table };
    mocks.server.set(id, row);
    return { data: row, error: null, status: 201 };
  };
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mocks.online
    ? { data: [...mocks.server.values()].filter((r) => r.table === table), error: null }
    : { data: null, error: networkError }).then(resolve);
  return c;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => from(table),
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel: vi.fn(),
  },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) } }));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./useChildren', () => ({ useChildren: () => mocks.children }));
vi.mock('./use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('./usePartnerNotifications', () => ({ usePartnerNotifications: () => ({ notifyKickSession: mocks.notifyKick }) }));
vi.mock('@/lib/tool-live-timer', () => ({ showToolLiveTimer: vi.fn(), hideToolLiveTimer: vi.fn() }));

import { useBabyLogs } from './useBabyLogs';
import { useKickSessions } from './useKickSessions';
import { flushOutbox, readOutbox } from '@/lib/offline-outbox';

beforeEach(() => {
  localStorage.clear();
  mocks.server.clear();
  mocks.online = true;
  mocks.reject = false;
  mocks.toast.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useBabyLogs with the offline outbox', () => {
  it('writes with a client uuid and reports a confirmed save', async () => {
    const { result } = renderHook(() => useBabyLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let res: Awaited<ReturnType<typeof result.current.addLog>> | undefined;
    await act(async () => { res = await result.current.addLog({ log_type: 'diaper', diaper_type: 'wet' }); });
    expect(res).toMatchObject({ error: null, queued: false });
    const id = (res!.data as { id: string }).id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.server.get(id)).toMatchObject({ child_id: 'c1', user_id: 'u1', diaper_type: 'wet' });
    expect(readOutbox('u1')).toEqual([]);
  });

  it('queues offline, shows the row as pending, then flushes it once', async () => {
    const { result } = renderHook(() => useBabyLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.online = false;
    let res: Awaited<ReturnType<typeof result.current.addLog>> | undefined;
    await act(async () => { res = await result.current.addLog({ log_type: 'feeding', feed_type: 'formula', notes: '90 ml' }); });
    expect(res).toMatchObject({ error: null, queued: true });
    expect(readOutbox('u1')).toHaveLength(1);
    await waitFor(() => expect(result.current.todayLogs).toHaveLength(1));
    expect(result.current.todayLogs[0]).toMatchObject({ pending: true, feed_type: 'formula' });
    expect(result.current.getTodayStats().formulaCount).toBe(1);

    mocks.online = true;
    await act(async () => { await flushOutbox('u1'); });
    expect(mocks.server.size).toBe(1);
    expect(readOutbox('u1')).toEqual([]);
    await waitFor(() => expect(result.current.todayLogs[0]?.pending).toBeUndefined());
    expect(result.current.todayLogs).toHaveLength(1);
  });

  it('returns a real error without queueing', async () => {
    const { result } = renderHook(() => useBabyLogs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.reject = true;
    let res: Awaited<ReturnType<typeof result.current.addLog>> | undefined;
    await act(async () => { res = await result.current.addLog({ log_type: 'sleep' }); });
    expect(res!.error).toBeTruthy();
    expect(res!.queued).toBe(false);
    expect(readOutbox('u1')).toEqual([]);
    expect(result.current.todayLogs).toEqual([]);
  });
});

describe('useKickSessions with the offline outbox', () => {
  it('shows the queued toast offline and keeps the session visible as pending', async () => {
    const { result } = renderHook(() => useKickSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.online = false;
    let res: Awaited<ReturnType<typeof result.current.addSession>> | undefined;
    await act(async () => { res = await result.current.addSession(4, 120, null, Date.now()); });
    expect(res?.status).toBe('queued');
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Saxlanıldı, internet gələndə göndəriləcək' });
    await waitFor(() => expect(result.current.getTodayStats().totalKicks).toBe(4));
    expect(result.current.sessions[0].pending).toBe(true);
  });

  it('shows an error toast on a real rejection and a success toast only when confirmed', async () => {
    const { result } = renderHook(() => useKickSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.reject = true;
    let res: Awaited<ReturnType<typeof result.current.addSession>> | undefined;
    await act(async () => { res = await result.current.addSession(2, 60); });
    expect(res?.status).toBe('error');
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(readOutbox('u1')).toEqual([]);

    mocks.reject = false;
    mocks.toast.mockClear();
    await act(async () => { res = await result.current.addSession(2, 60, null, undefined, { quiet: true }); });
    expect(res?.status).toBe('saved');
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
