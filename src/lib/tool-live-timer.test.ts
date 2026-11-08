import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const h = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android',
  native: true,
  start: vi.fn(async (_o: Record<string, unknown>) => {}),
  stop: vi.fn(async (_o?: { timerId?: string }) => {}),
}));

vi.mock('@/lib/native', () => ({
  get isNative() { return h.native; },
  hapticFeedback: {},
}));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => h.platform, isNativePlatform: () => h.native },
}));
vi.mock('@/plugins/LiveActivityPlugin', () => ({
  default: { startActivity: h.start, stopActivity: h.stop },
}));
// The hook files import Supabase/auth for the data hooks; only the live-timer hooks are tested here.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePartnerNotifications', () => ({ usePartnerNotifications: () => ({}) }));

import { showToolLiveTimer, hideToolLiveTimer, __resetToolLiveTimerForTests } from './tool-live-timer';
import { contractionLivePhase, MAX_INTERVAL_SECONDS } from './laborUtils';
import { kickLiveTimerState } from './kickSession';
import { useContractionLiveTimer } from '@/hooks/useContractions';
import { useKickLiveTimer } from '@/hooks/useKickSessions';

const view = (label: string, startTime = 1000) => ({ type: 'kick' as const, label, subLabel: 'sub', startTime });
const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  h.platform = 'ios';
  h.native = true;
  h.start.mockReset().mockResolvedValue(undefined);
  h.stop.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  __resetToolLiveTimerForTests();
});

describe('tool live timer bridge', () => {
  it('starts with the shared plugin payload and skips identical updates', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    expect(h.start).toHaveBeenCalledTimes(1);
    const payload = h.start.mock.calls[0][0];
    expect(payload).toMatchObject({ type: 'kick', label: 'Hərəkət · 1', subLabel: 'sub', startTime: 1000, stopLabel: 'Gizlət' });
    expect(String(payload.id)).toMatch(/^kick-1000-/);
    expect(payload.channelName).toBe('Taymerlər');

    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    expect(h.start).toHaveBeenCalledTimes(1);
  });

  it('iOS: an update starts a new activity first, then ends the old one', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    const firstId = h.start.mock.calls[0][0].id;
    await showToolLiveTimer('kick', view('Hərəkət · 2'));
    expect(h.start).toHaveBeenCalledTimes(2);
    const secondId = h.start.mock.calls[1][0].id;
    expect(secondId).not.toBe(firstId);
    expect(h.stop).toHaveBeenCalledWith({ timerId: firstId });
    expect(h.start.mock.invocationCallOrder[1]).toBeLessThan(h.stop.mock.invocationCallOrder[0]);
  });

  it('Android: an update reuses the id (in-place notification update), no stop', async () => {
    h.platform = 'android';
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    await showToolLiveTimer('kick', view('Hərəkət · 2'));
    expect(h.start.mock.calls.map((c) => c[0].id)).toEqual(['kick-1000', 'kick-1000']);
    expect(h.stop).not.toHaveBeenCalled();
  });

  it('Android: a new phase (new start time) stops the previous notification after starting', async () => {
    h.platform = 'android';
    await showToolLiveTimer('contraction', { type: 'contraction', label: 'Sancı', subLabel: 's', startTime: 1 });
    await showToolLiveTimer('contraction', { type: 'contraction', label: 'Son sancıdan bəri', subLabel: 's', startTime: 2 });
    expect(h.stop).toHaveBeenCalledWith({ timerId: 'contraction-1' });
  });

  it('hide stops the shown timer once and is a no-op afterwards', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    const id = h.start.mock.calls[0][0].id;
    await hideToolLiveTimer('kick');
    expect(h.stop).toHaveBeenCalledWith({ timerId: id });
    await hideToolLiveTimer('kick');
    expect(h.stop).toHaveBeenCalledTimes(1);
  });

  it('ends a leftover timer from before an app restart (persisted id)', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    const id = h.start.mock.calls[0][0].id;
    __resetToolLiveTimerForTests(); // memory gone, localStorage kept
    await hideToolLiveTimer('kick');
    expect(h.stop).toHaveBeenCalledWith({ timerId: id });
  });

  it('fast updates are coalesced to the newest one', async () => {
    const p1 = showToolLiveTimer('kick', view('Hərəkət · 1'));
    void showToolLiveTimer('kick', view('Hərəkət · 2'));
    void showToolLiveTimer('kick', view('Hərəkət · 3'));
    await p1;
    expect(h.start.mock.calls.map((c) => c[0].label)).toEqual(['Hərəkət · 3']);
  });

  it('a hide followed by the same show in one render keeps the timer (no flicker)', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    void hideToolLiveTimer('kick');
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    expect(h.start).toHaveBeenCalledTimes(1);
    expect(h.stop).not.toHaveBeenCalled();
  });

  it('when Live Activities are off (start rejects) nothing is remembered as shown', async () => {
    h.start.mockRejectedValueOnce(new Error('Live Activities disabled by user'));
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    await hideToolLiveTimer('kick');
    expect(h.stop).not.toHaveBeenCalled();
  });

  it('slots are independent', async () => {
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    await showToolLiveTimer('contraction', { type: 'contraction', label: 'Sancı', subLabel: 's', startTime: 5 });
    await hideToolLiveTimer('contraction');
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.stop.mock.calls[0][0]?.timerId).toMatch(/^contraction-5-/);
  });

  it('web: no native calls', async () => {
    h.native = false;
    await showToolLiveTimer('kick', view('Hərəkət · 1'));
    await hideToolLiveTimer('kick');
    expect(h.start).not.toHaveBeenCalled();
    expect(h.stop).not.toHaveBeenCalled();
  });
});

describe('contractionLivePhase', () => {
  it('running contraction counts from its start', () => {
    expect(contractionLivePhase({ activeStart: 500, lastEnd: 100 }, 1000)).toEqual({ phase: 'active', startTime: 500 });
  });
  it('between contractions counts from the last end, up to an hour', () => {
    const end = 10_000;
    expect(contractionLivePhase({ activeStart: null, lastEnd: end }, end + 1000)).toEqual({
      phase: 'rest', startTime: end, until: end + MAX_INTERVAL_SECONDS * 1000,
    });
    expect(contractionLivePhase({ activeStart: null, lastEnd: end }, end + MAX_INTERVAL_SECONDS * 1000)).toBeNull();
  });
  it('nothing after clearing', () => {
    expect(contractionLivePhase({ activeStart: null, lastEnd: null }, 1000)).toBeNull();
  });
});

describe('kickLiveTimerState', () => {
  it('maps a running session and idle', () => {
    expect(kickLiveTimerState({ startedAt: 42, kicks: 3 })).toEqual({ startTime: 42, count: 3 });
    expect(kickLiveTimerState(null)).toBeNull();
  });
});

describe('live timer hooks', () => {
  it('kick: start, count update on tap, stop on Dayandır', async () => {
    h.platform = 'android';
    const { rerender } = renderHook(({ s }) => useKickLiveTimer(s), {
      initialProps: { s: { startedAt: 7000, kicks: 0 } as { startedAt: number; kicks: number } | null },
    });
    await flush();
    expect(h.start).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'kick-7000', type: 'kick', label: 'Hərəkət · 0', startTime: 7000,
    }));
    rerender({ s: { startedAt: 7000, kicks: 1 } });
    await flush();
    expect(h.start).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'kick-7000', label: 'Hərəkət · 1' }));
    rerender({ s: null });
    await flush();
    expect(h.stop).toHaveBeenCalledWith({ timerId: 'kick-7000' });
  });

  it('kick: disabled until the user is known', async () => {
    renderHook(() => useKickLiveTimer(null, false));
    await flush();
    expect(h.start).not.toHaveBeenCalled();
    expect(h.stop).not.toHaveBeenCalled();
  });

  it('contraction: running, then since-last, then cleared', async () => {
    h.platform = 'android';
    const now = Date.now();
    const { rerender } = renderHook(({ t }) => useContractionLiveTimer(t), {
      initialProps: { t: { activeStart: now - 5000, lastStart: null, lastEnd: null } as { activeStart: number | null; lastStart: number | null; lastEnd: number | null } },
    });
    await flush();
    expect(h.start).toHaveBeenLastCalledWith(expect.objectContaining({
      id: `contraction-${now - 5000}`, type: 'contraction', label: 'Sancı', startTime: now - 5000,
    }));
    rerender({ t: { activeStart: null, lastStart: now - 5000, lastEnd: now } });
    await flush();
    expect(h.start).toHaveBeenLastCalledWith(expect.objectContaining({
      id: `contraction-${now}`, label: 'Son sancıdan bəri', startTime: now,
    }));
    expect(h.stop).toHaveBeenCalledWith({ timerId: `contraction-${now - 5000}` });
    rerender({ t: { activeStart: null, lastStart: null, lastEnd: null } });
    await flush();
    expect(h.stop).toHaveBeenLastCalledWith({ timerId: `contraction-${now}` });
  });
});
