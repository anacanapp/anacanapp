/**
 * Daily "Körpəmdən mesajlar" notifications, scheduled on the device (no server job):
 * the next 7 arrivals at each day's own time. Tapping opens the chat (pushNav 'baby_chat').
 */
import { Capacitor } from '@capacitor/core';
import { navigateFromPush } from '@/lib/pushNav';
import { dailyArrival, type BabyChatText } from '@/lib/baby-chat';

const BASE_ID = 7300;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const DAYS = 7;
let tapRegistered = false;

const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

/** Reschedules the next week. Asks for permission only when `ask` is true (opening the chat). */
export async function scheduleBabyChatNotifications(text: BabyChatText, userId: string, ask = false): Promise<void> {
  if (!available()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' && ask) permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return;
  await LocalNotifications.cancel({ notifications: Array.from({ length: DAYS }, (_, i) => ({ id: BASE_ID + i })) });
  const now = Date.now();
  const notifications = Array.from({ length: DAYS }, (_, i) => {
    const at = dailyArrival(addDays(new Date(), i), userId);
    return { id: BASE_ID + i, at };
  }).filter(({ at }) => at.getTime() > now + 60_000).map(({ id, at }, i) => ({
    id,
    title: text.ui.notif_title,
    body: text.notifications[(at.getDate() + i) % text.notifications.length],
    schedule: { at, allowWhileIdle: true },
    extra: { type: 'baby_chat' },
  }));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export async function cancelBabyChatNotifications(): Promise<void> {
  if (!available()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: Array.from({ length: DAYS }, (_, i) => ({ id: BASE_ID + i })) });
}

/** Routes a tap on any local notification that carries a push-style `type`. Call once at start. */
export async function registerLocalNotificationTaps(): Promise<void> {
  if (tapRegistered || !available()) return;
  tapRegistered = true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification?.extra;
    if (extra && typeof extra === 'object' && typeof extra.type === 'string') navigateFromPush(extra);
  });
}
