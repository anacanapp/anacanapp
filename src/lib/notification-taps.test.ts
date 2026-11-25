import { beforeEach, describe, expect, it, vi } from 'vitest';

const cap = vi.hoisted(() => ({
  native: true,
  listeners: new Map<string, (event: any) => void>(),
  add: (plugin: string) => vi.fn((event: string, cb: (e: any) => void) => {
    cap.listeners.set(`${plugin}:${event}`, cb);
    return Promise.resolve({ remove: async () => {} });
  }),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => cap.native } }));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: { addListener: cap.add('fcm') } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { addListener: cap.add('push') } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { addListener: cap.add('local') } }));

import {
  __resetNotificationTapsForTests, attachNotificationTapHandler, clearQueuedNotificationTaps, deliverNotificationTap,
  installNotificationTapListeners, localTapData,
} from './notification-taps';

beforeEach(() => { __resetNotificationTapsForTests(); cap.listeners.clear(); cap.native = true; });

describe('early tap queue', () => {
  it('registers every tap listener synchronously at install (before any await)', () => {
    installNotificationTapListeners();
    expect([...cap.listeners.keys()].sort()).toEqual([
      'fcm:notificationActionPerformed', 'local:localNotificationActionPerformed', 'push:pushNotificationActionPerformed',
    ]);
    installNotificationTapListeners(); // idempotent
    expect(cap.listeners.size).toBe(3);
  });

  it('queues a tap that arrives before the router and delivers it when the router attaches', () => {
    installNotificationTapListeners();
    cap.listeners.get('fcm:notificationActionPerformed')!({ notification: { data: { type: 'direct_message', sender_id: 'x' } } });
    const handler = vi.fn();
    attachNotificationTapHandler(handler);
    expect(handler).toHaveBeenCalledWith({ type: 'direct_message', sender_id: 'x' });
    // Later taps go straight to the router.
    cap.listeners.get('local:localNotificationActionPerformed')!({ notification: { extra: { type: 'baby_chat' } } });
    expect(handler).toHaveBeenLastCalledWith({ type: 'baby_chat' });
  });

  it('keeps only the latest queued tap and ignores the same tap reported twice', () => {
    deliverNotificationTap({ type: 'a' }, 1_000);
    deliverNotificationTap({ type: 'b' }, 1_100);
    deliverNotificationTap({ type: 'b' }, 1_200); // second plugin, same tap
    const handler = vi.fn();
    attachNotificationTapHandler(handler);
    expect(handler.mock.calls).toEqual([[{ type: 'b' }]]);
    deliverNotificationTap({ type: 'b' }, 1_300);
    expect(handler).toHaveBeenCalledTimes(1);
    deliverNotificationTap({ type: 'b' }, 9_000); // a new tap on the same kind later
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('queues again after the router detaches, and logout drops the queued tap', () => {
    const first = vi.fn();
    const detach = attachNotificationTapHandler(first);
    detach();
    deliverNotificationTap({ type: 'community' }, 1);
    expect(first).not.toHaveBeenCalled();
    clearQueuedNotificationTaps();
    const second = vi.fn();
    attachNotificationTapHandler(second);
    expect(second).not.toHaveBeenCalled();
  });

  it('routes only local reminders that carry a route', () => {
    expect(localTapData({ type: 'vaccine_reminder', deeplink: 'anacan://tool/vaccine-calendar' })).toEqual({ type: 'vaccine_reminder', deeplink: 'anacan://tool/vaccine-calendar' });
    expect(localTapData({ deeplink: 'anacan://tool/x' })).toEqual({ deeplink: 'anacan://tool/x' });
    expect(localTapData({ dose: 'x' })).toBeNull();
    expect(localTapData(null)).toBeNull();
    installNotificationTapListeners();
    const handler = vi.fn();
    attachNotificationTapHandler(handler);
    cap.listeners.get('local:localNotificationActionPerformed')!({ notification: { id: 5 } }); // a timer: nothing to route
    expect(handler).not.toHaveBeenCalled();
  });

  it('a router error does not break later taps', () => {
    const handler = vi.fn().mockImplementationOnce(() => { throw new Error('boom'); });
    attachNotificationTapHandler(handler);
    deliverNotificationTap({ type: 'a' }, 1);
    deliverNotificationTap({ type: 'b' }, 2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('registers nothing on the web', () => {
    cap.native = false;
    installNotificationTapListeners();
    expect(cap.listeners.size).toBe(0);
  });
});
