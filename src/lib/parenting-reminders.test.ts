import { beforeEach, describe, expect, it, vi } from 'vitest';

const cap = vi.hoisted(() => ({
  native: true,
  display: 'granted' as string,
  cancel: vi.fn(async (_: unknown) => {}),
  schedule: vi.fn(async (_: unknown) => {}),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => cap.native } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: cap.cancel,
    schedule: cap.schedule,
    checkPermissions: async () => ({ display: cap.display }),
    requestPermissions: async () => ({ display: cap.display }),
  },
}));

import az from '@/data/parenting/az';
import { EMPTY_PARENTING, type ParentingLocal } from './parenting';
import { activeProgramme, reminderSlots, slotsKey, syncParentingReminders } from './parenting-reminders';
import { intentFromPushData } from './pushNav';

const NOW = new Date(2026, 10, 7, 10, 0); // Saturday 10:00 local
const TODAY = '2026-11-07';
const state = (patch: Partial<ParentingLocal>): ParentingLocal => ({ ...EMPTY_PARENTING(), reminder: { on: true, time: '20:30' }, ...patch });
const running = (done: string[], extra: object = {}) => ({ 'sleep-7': { startedAt: '2026-11-05', done, updatedAt: '2026-11-06T09:00:00.000Z', ...extra } });
const slots = (s: ParentingLocal, o: { allowed?: boolean; now?: Date } = {}) =>
  reminderSlots({ state: s, programmes: az.programmes, allowed: o.allowed ?? true, now: o.now ?? NOW, today: TODAY });

beforeEach(() => { cap.native = true; cap.display = 'granted'; cap.cancel.mockClear(); cap.schedule.mockClear(); });

describe('Tərbiyə programme reminders: what to schedule', () => {
  it('schedules today at the chosen time and the next days, one step a day, up to the end of the programme', () => {
    const list = slots(state({ programmes: running(['2026-11-05', '2026-11-06']) }));
    expect(list.map((s) => s.dayIndex)).toEqual([2, 3, 4, 5, 6]); // 7-day programme, 2 done → days 3…7
    expect(list[0].at).toEqual(new Date(2026, 10, 7, 20, 30));
    expect(list[1].at).toEqual(new Date(2026, 10, 8, 20, 30));
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });

  it('starts tomorrow when today’s step is done or the time has passed; honours the chosen time', () => {
    expect(slots(state({ programmes: running(['2026-11-06', TODAY]) }))[0].at).toEqual(new Date(2026, 10, 8, 20, 30));
    expect(slots(state({ programmes: running([]) }), { now: new Date(2026, 10, 7, 21, 0) })[0].at).toEqual(new Date(2026, 10, 8, 20, 30));
    expect(slots(state({ programmes: running([]), reminder: { on: true, time: '07:15' } }))[0].at).toEqual(new Date(2026, 10, 8, 7, 15));
  });

  it('schedules nothing when off, finished, paused, not allowed (switch / Premium) or without a programme', () => {
    expect(slots(state({ programmes: running([]), reminder: { on: false, time: '20:30' } }))).toEqual([]);
    expect(slots(state({ programmes: running(Array.from({ length: 7 }, (_, i) => `2026-10-2${i}`)) }))).toEqual([]);
    expect(slots(state({ programmes: running([], { paused: true }) }))).toEqual([]);
    expect(slots(state({ programmes: running([]) }), { allowed: false })).toEqual([]);
    expect(slots(state({}))).toEqual([]);
  });

  it('follows the most recently changed running programme', () => {
    const s = state({
      programmes: {
        'sleep-7': { startedAt: '2026-11-01', done: [], updatedAt: '2026-11-01T08:00:00.000Z' },
        'tantrums-14': { startedAt: '2026-11-02', done: ['2026-11-02'], updatedAt: '2026-11-06T08:00:00.000Z' },
      },
    });
    expect(activeProgramme(s, az.programmes)?.programme.id).toBe('tantrums-14');
    expect(slots(s).every((x) => x.programmeId === 'tantrums-14')).toBe(true);
    expect(slots(s)).toHaveLength(7);
    expect(slotsKey([])).toBe('none');
  });
});

describe('Tərbiyə programme reminders: native scheduling', () => {
  const text = () => ({ title: 'T', body: 'B' });

  it('cancels every earlier reminder, then schedules the new list with a tap target', async () => {
    const list = slots(state({ programmes: running([]) }));
    await syncParentingReminders(list, text, { partner: true });
    expect(cap.cancel).toHaveBeenCalledTimes(1);
    const scheduled = (cap.schedule.mock.calls[0][0] as { notifications: { id: number; extra: Record<string, string> }[] }).notifications;
    expect(scheduled).toHaveLength(list.length);
    expect(scheduled[0].extra).toEqual({ type: 'parenting_programme', partner: '1', programme: list[0].programmeId });
    expect(intentFromPushData(scheduled[0].extra)).toEqual({ screen: 'partner-parenting' });
    expect(intentFromPushData({ type: 'parenting_programme', partner: '0' })).toEqual({ tool: 'parenting' });
  });

  it('only cancels for an empty list, and does nothing on the web or without permission', async () => {
    await syncParentingReminders([], text);
    expect(cap.cancel).toHaveBeenCalledTimes(1);
    expect(cap.schedule).not.toHaveBeenCalled();
    cap.display = 'denied';
    await syncParentingReminders(slots(state({ programmes: running([]) })), text);
    expect(cap.schedule).not.toHaveBeenCalled();
    cap.native = false;
    cap.cancel.mockClear();
    await syncParentingReminders([], text);
    expect(cap.cancel).not.toHaveBeenCalled();
  });
});
