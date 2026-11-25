/**
 * Daily "Körpəmdən mesajlar" notifications, scheduled on the device (no server job):
 * the next 7 arrivals at each day's own time. Tapping opens the chat (pushNav 'baby_chat'; the tap listener
 * is registered at app start in notification-taps.ts).
 */
import { Capacitor } from '@capacitor/core';
import { dailyArrival, type BabyChatText } from '@/lib/baby-chat';

const BASE_ID = 7300;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const DAYS = 7;
const ALL_IDS = Array.from({ length: DAYS }, (_, i) => BASE_ID + i);
const NAMESPACE = 'baby-chat';

const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

/** Reschedules the next week. Asks for permission only when `ask` is true (opening the chat). */
export async function scheduleBabyChatNotifications(text: BabyChatText, userId: string, ask = false): Promise<void> {
  if (!available()) return;
  const now = Date.now();
  const notifications = Array.from({ length: DAYS }, (_, i) => {
    const at = dailyArrival(addDays(new Date(), i), userId);
    return { id: BASE_ID + i, at };
  }).filter(({ at }) => at.getTime() > now + 60_000).map(({ id, at }, i) => ({
    id,
    title: text.ui.notif_title,
    body: text.notifications[(at.getDate() + i) % text.notifications.length],
    at,
    extra: { type: 'baby_chat' },
  }));
  const { setLocalNotifications } = await import('@/lib/local-notification-scheduler');
  await setLocalNotifications(NAMESPACE, notifications, { ask, cancelIds: ALL_IDS });
}

export async function cancelBabyChatNotifications(): Promise<void> {
  if (!available()) return;
  const { setLocalNotifications } = await import('@/lib/local-notification-scheduler');
  await setLocalNotifications(NAMESPACE, [], { cancelIds: ALL_IDS });
}
