import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the OS: pending notifications keyed by id (scheduling an existing id replaces it,
// as on iOS and Android).
const os = vi.hoisted(() => ({
  native: true,
  display: 'granted' as string,
  pending: new Map<number, any>(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  request: vi.fn(),
  removeDelivered: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => os.native, isPluginAvailable: () => os.native } }));
// Like the real Capacitor plugin proxy: every unknown property, including `then`, is a native
// method stub that fails with "not implemented". Returning the plugin from an async function
// therefore breaks promise resolution (52.0.0/52.0.1: no reminder was ever scheduled on iOS).
vi.mock('@capacitor/local-notifications', () => {
  const impl: Record<string, unknown> = {
    schedule: async (arg: { notifications: any[] }) => { os.schedule(arg); for (const n of arg.notifications) os.pending.set(n.id, n); },
    cancel: async (arg: { notifications: { id: number }[] }) => { os.cancel(arg); for (const n of arg.notifications) os.pending.delete(n.id); },
    getPending: async () => ({ notifications: [...os.pending.values()].map((n) => ({ id: n.id, title: n.title, body: n.body })) }),
    checkPermissions: async () => ({ display: os.display }),
    requestPermissions: async () => { os.request(); os.display = 'granted'; return { display: 'granted' }; },
    removeAllDeliveredNotifications: async () => { os.removeDelivered(); },
  };
  const LocalNotifications = new Proxy(impl, {
    get: (target, prop) => (prop in target ? target[prop as string] : () => {
      throw new Error(`"LocalNotifications.${String(prop)}()" is not implemented on ios`);
    }),
  });
  return { LocalNotifications };
});

import {
  PENDING_BUDGET, bindLocalNotificationOwner, clearLocalNotificationNamespaces, desiredLocalNotifications, nextFireAt,
  planLocalNotifications, replanLocalNotifications, resetLocalNotifications, setLocalNotifications,
} from './local-notification-scheduler';

const NOW = new Date(2026, 10, 25, 9, 0); // Wednesday 09:00 local
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const items = (base: number, count: number, startHour: number) =>
  Array.from({ length: count }, (_, i) => ({ id: base + i, title: `t${base + i}`, body: 'b', at: hours(startHour + i) }));
const scheduledIds = () => os.schedule.mock.calls.flatMap(([arg]) => arg.notifications.map((n: { id: number }) => n.id));
const cancelledIds = () => os.cancel.mock.calls.flatMap(([arg]) => arg.notifications.map((n: { id: number }) => n.id));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  os.native = true; os.display = 'granted'; os.pending.clear();
  os.schedule.mockClear(); os.cancel.mockClear(); os.request.mockClear(); os.removeDelivered.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe('planning (pure)', () => {
  it('orders by next fire time and keeps only the budget', () => {
    const plan = planLocalNotifications({
      b: items(200, 3, 1).map((n) => ({ ...n, at: n.at.getTime() })),
      a: items(100, 3, 2).map((n) => ({ ...n, at: n.at.getTime() })),
    }, NOW.getTime(), 4);
    expect(plan.map((n) => n.id)).toEqual([200, 100, 201, 101]);
  });

  it('counts a daily reminder as its next occurrence and drops one-shots in the past', () => {
    const eight = new Date(2026, 0, 1, 8, 0).getTime();
    expect(nextFireAt({ at: eight, repeat: 'day' }, NOW.getTime())).toBe(new Date(2026, 10, 26, 8, 0).getTime());
    expect(nextFireAt({ at: hours(-1).getTime() }, NOW.getTime())).toBeNull();
    const plan = planLocalNotifications({
      water: [{ id: 101, title: 'w', body: 'b', at: eight, repeat: 'day' }],
      vaccine: [{ id: 1, title: 'v', body: 'b', at: hours(30).getTime() }, { id: 2, title: 'old', body: 'b', at: hours(-2).getTime() }],
    }, NOW.getTime());
    expect(plan.map((n) => n.id)).toEqual([101, 1]); // tomorrow 08:00 comes before +30 h
  });
});

describe('native scheduling', () => {
  it(`keeps at most ${PENDING_BUDGET} pending (the nearest) across every feature and child`, async () => {
    await setLocalNotifications('vaccine:a', items(1000, 40, 10));
    await setLocalNotifications('vaccine:b', items(2000, 40, 1));
    await setLocalNotifications('parenting', items(3000, 7, 5));
    expect(os.pending.size).toBe(PENDING_BUDGET);
    const all = [...items(1000, 40, 10), ...items(2000, 40, 1), ...items(3000, 7, 5)]
      .sort((x, y) => x.at.getTime() - y.at.getTime() || x.id - y.id).slice(0, PENDING_BUDGET).map((n) => n.id);
    expect([...os.pending.keys()].sort((x, y) => x - y)).toEqual([...all].sort((x, y) => x - y));
    // The rest stays in the durable desired set for a later re-plan.
    expect(desiredLocalNotifications()).toHaveLength(87);
  });

  it('schedules the remaining reminders on a later re-plan once the nearest ones have fired', async () => {
    await setLocalNotifications('vaccine:a', items(1000, 70, 1));
    expect(os.pending.has(1060)).toBe(false);
    // 15 hours later the first 15 have fired (the OS drops delivered one-shots).
    vi.setSystemTime(hours(15.5));
    for (let i = 0; i < 15; i++) os.pending.delete(1000 + i);
    await replanLocalNotifications();
    expect(os.pending.size).toBe(55); // 70 - 15 left, all fit now
    expect(os.pending.has(1069)).toBe(true);
    expect(desiredLocalNotifications('vaccine:a')).toHaveLength(55); // fired ones are pruned
  });

  it('cancels reminders a feature no longer wants and ones pushed out by nearer reminders', async () => {
    await setLocalNotifications('parenting', items(3000, 5, 1));
    await setLocalNotifications('parenting', items(3000, 2, 1));
    expect(cancelledIds()).toEqual(expect.arrayContaining([3002, 3003, 3004]));
    expect([...os.pending.keys()]).toEqual([3000, 3001]);

    await setLocalNotifications('far', items(5000, 59, 100));
    expect(os.pending.size).toBe(PENDING_BUDGET);
    os.cancel.mockClear();
    await setLocalNotifications('near', items(6000, 3, 2));
    // 2 + 59 > 60, so 5058 was never pending; the next three farthest of "far" make room and stay desired.
    expect(os.pending.has(5058)).toBe(false);
    expect(cancelledIds().sort()).toEqual([5055, 5056, 5057]);
    expect(os.pending.size).toBe(PENDING_BUDGET);
    expect(desiredLocalNotifications('far')).toHaveLength(59);
  });

  it('keeps ids stable: an installed reminder of an older version is replaced, never duplicated, and unchanged ones are not re-sent', async () => {
    // Scheduled by the previous app version directly (same stable id), not known to the scheduler.
    os.pending.set(882200, { id: 882200, title: 'old copy', body: 'b' });
    os.pending.set(882205, { id: 882205, title: 'old day 6', body: 'b' });
    await setLocalNotifications('parenting', items(882200, 2, 3), { cancelIds: Array.from({ length: 8 }, (_, i) => 882200 + i) });
    expect([...os.pending.keys()].sort()).toEqual([882200, 882201]);
    expect(os.pending.get(882200).title).toBe('t882200');
    expect(cancelledIds()).toContain(882205); // the retired legacy id
    os.schedule.mockClear();
    await setLocalNotifications('parenting', items(882200, 2, 3));
    await replanLocalNotifications();
    expect(os.schedule).not.toHaveBeenCalled();
  });

  it('counts pending reminders it does not own against the iOS limit', async () => {
    for (let i = 0; i < 10; i++) os.pending.set(9_000 + i, { id: 9_000 + i, title: 'legacy', body: 'b' });
    await setLocalNotifications('vaccine:a', items(1000, 70, 1));
    expect(os.pending.size).toBe(PENDING_BUDGET);
    expect([...os.pending.keys()].filter((id) => id >= 1000 && id < 2000)).toHaveLength(50);
  });

  it('a daily reminder is handed to the OS as a repeating time of day', async () => {
    await setLocalNotifications('water', [{ id: 101, title: 'w', body: 'b', at: new Date(2026, 10, 25, 10, 0), repeat: 'day' }]);
    expect(os.pending.get(101).schedule).toMatchObject({ on: { hour: 10, minute: 0 }, repeats: true });
  });

  it('never prompts unless the feature asks from a user action, and keeps the desired set while not allowed', async () => {
    os.display = 'prompt';
    expect(await setLocalNotifications('nap', items(880001, 1, 2))).toBe('denied');
    expect(os.request).not.toHaveBeenCalled();
    expect(os.pending.size).toBe(0);
    await replanLocalNotifications();
    expect(os.request).not.toHaveBeenCalled();
    expect(await setLocalNotifications('weaning', items(881100, 1, 3), { ask: true })).toBe('scheduled');
    expect(os.request).toHaveBeenCalledOnce();
    expect([...os.pending.keys()].sort()).toEqual([880001, 881100]); // the waiting nap alert is scheduled too
  });

  it('removes a namespace family (every vaccine block)', async () => {
    await setLocalNotifications('vaccine:883400', items(883400, 2, 1));
    await setLocalNotifications('vaccine:883430', items(883430, 2, 1));
    await setLocalNotifications('water', items(101, 1, 1));
    await clearLocalNotificationNamespaces('vaccine:');
    expect([...os.pending.keys()]).toEqual([101]);
    expect(desiredLocalNotifications().map((n) => n.id)).toEqual([101]);
  });

  it('logout clears the desired set and every pending and delivered notification', async () => {
    await setLocalNotifications('vaccine:a', items(1000, 3, 1));
    os.pending.set(77, { id: 77, title: 'other', body: 'b' });
    await resetLocalNotifications();
    expect(os.pending.size).toBe(0);
    expect(os.removeDelivered).toHaveBeenCalledOnce();
    expect(desiredLocalNotifications()).toEqual([]);
    await replanLocalNotifications();
    expect(os.pending.size).toBe(0);
  });

  it("cancels another account's reminders when a different account is bound; device reminders stay", async () => {
    await bindLocalNotificationOwner('user-a');
    await setLocalNotifications('vaccine:a', items(1000, 2, 1));
    await setLocalNotifications('water', items(101, 1, 1));
    await bindLocalNotificationOwner('user-a');
    expect(os.pending.size).toBe(3);
    await bindLocalNotificationOwner('user-b');
    expect([...os.pending.keys()]).toEqual([101]);
    expect(desiredLocalNotifications('vaccine:a')).toEqual([]);
  });

  it('does nothing on the web', async () => {
    os.native = false;
    expect(await setLocalNotifications('nap', items(880001, 1, 2))).toBe('unavailable');
    expect(os.schedule).not.toHaveBeenCalled();
    expect(scheduledIds()).toEqual([]);
  });
});
