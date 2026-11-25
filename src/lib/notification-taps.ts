/**
 * Notification taps (remote push and on-device reminders), registered at app start.
 *
 * The tap listeners used to be attached only after the push token was saved (useDeviceToken) or after
 * Index mounted, so a tap that arrived earlier (cold start, slow network, token failure, not signed in
 * yet) opened only the home screen. main.tsx now calls installNotificationTapListeners() synchronously
 * at boot; taps are queued here until the app attaches its router (Index → navigateFromPush, which
 * itself waits for auth/profile before applying the target).
 *
 * This module imports only Capacitor plugin proxies (no SDK, no app state), so it is safe before
 * backend admission.
 */
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export type NotificationTapData = Record<string, unknown>;
type Handler = (data: NotificationTapData) => void;

/** The same tap can be reported by two plugins (FCM and the Capacitor push fallback). */
const DUPLICATE_WINDOW_MS = 2_000;

let handler: Handler | null = null;
/** Only the latest tap is kept: navigating through several old taps would be confusing. */
let queued: NotificationTapData | null = null;
let lastKey = '';
let lastAt = 0;
let installed = false;

const asRecord = (value: unknown): NotificationTapData | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as NotificationTapData : null;

/** Hand a tap to the router, or queue it until the router is attached. Exported for tests. */
export function deliverNotificationTap(data: NotificationTapData | null | undefined, now = Date.now()): void {
  if (!data) return;
  let key = '';
  try { key = JSON.stringify(data); } catch { key = String(now); }
  if (key === lastKey && now - lastAt < DUPLICATE_WINDOW_MS) return;
  lastKey = key; lastAt = now;
  if (handler) {
    try { handler(data); } catch (e) { console.warn('[notification-taps] routing failed:', e); }
    return;
  }
  queued = data;
}

/**
 * Attach the router (Index). A tap queued before this point is delivered right away. Returns a detach
 * function; taps after detaching (e.g. signed out) are queued again.
 */
export function attachNotificationTapHandler(next: Handler): () => void {
  handler = next;
  const pending = queued;
  queued = null;
  if (pending) {
    try { next(pending); } catch (e) { console.warn('[notification-taps] routing failed:', e); }
  }
  return () => { if (handler === next) handler = null; };
}

/** Logout: a tap queued for the old account is dropped. */
export function clearQueuedNotificationTaps(): void {
  queued = null;
}

/** Push-style data of a local reminder tap: only reminders that carry a route (type or deeplink). */
export function localTapData(extra: unknown): NotificationTapData | null {
  const data = asRecord(extra);
  if (!data) return null;
  return typeof data.type === 'string' || typeof data.deeplink === 'string' ? data : null;
}

/**
 * Register every tap listener once, synchronously, at app start (native only). The plugins retain a tap
 * that launched the app until a listener exists, so registering early also covers cold starts.
 */
export function installNotificationTapListeners(): void {
  if (installed || !Capacitor.isNativePlatform()) return;
  installed = true;
  const guard = (register: () => Promise<unknown> | unknown) => {
    try { void Promise.resolve(register()).catch(() => {}); } catch { /* plugin not in this build */ }
  };
  guard(() => FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    deliverNotificationTap(asRecord(event?.notification?.data));
  }));
  guard(() => PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    deliverNotificationTap(asRecord(action?.notification?.data));
  }));
  guard(() => LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    deliverNotificationTap(localTapData(action?.notification?.extra));
  }));
}

/** Tests only. */
export function __resetNotificationTapsForTests(): void {
  handler = null; queued = null; lastKey = ''; lastAt = 0; installed = false;
}
