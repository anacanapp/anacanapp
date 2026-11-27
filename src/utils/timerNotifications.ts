import { tr } from "@/lib/tr";import { isNative } from '@/lib/native';
import type { TimerType } from '@/store/timerStore';

const getTimerLabels = (): Record<TimerType, string> => ({
  sleep: tr("timernotifications_yuxu_eb2b53", "😴 Yuxu"),
  feeding: tr("timernotifications_emizdirme_af3cc9", "🍼 Əmizdirmə"),
  diaper: tr("timernotifications_bez_deyisdirme_cfec83", "🧷 Bez dəyişdirmə"),
  'white-noise': tr("timernotifications_kuy_sesi_1de6fc", "🔊 Küy Səsi")
});

// Generate a stable numeric ID from timer string ID
function hashTimerId(timerId: string): number {
  let hash = 0;
  for (let i = 0; i < timerId.length; i++) {
    hash = (hash << 5) - hash + timerId.charCodeAt(i) | 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

export async function showTimerNotification(
timerId: string,
type: TimerType,
label?: string,
feedType?: 'left' | 'right')
{
  if (!isNative) return;

  try {
    const title = label || getTimerLabels()[type] || 'Timer';
    const feedSuffix = feedType ? ` (${feedType === 'left' ? tr("timernotifications_sol", "Sol") : tr("timernotifications_sag_edbe12", "Sağ")})` : '';

    // Shown at once through the central scheduler (never a pending slot). Starting a timer is the user's
    // own action, so it may ask for permission like before.
    const { notifyNow } = await import('@/lib/local-notification-scheduler');
    await notifyNow({
      id: hashTimerId(timerId),
      title: `${title}${feedSuffix}`,
      body: tr("timernotifications_timer_aktiv_geri_donmek_ucun_t_f7638a", "Timer aktiv \u2014 geri d\xF6nm\u0259k \xFC\xE7\xFCn toxunun"),
      ongoing: true,
      autoCancel: false,
      smallIcon: 'ic_stat_icon'
    }, { ask: true });
  } catch (e) {
    console.warn('Timer notification error:', e);
  }
}

export async function clearTimerNotification(timerId: string) {
  if (!isNative) return;
  const { cancelLocalNotificationIds } = await import('@/lib/local-notification-scheduler');
  await cancelLocalNotificationIds([hashTimerId(timerId)]);
}

/**
 * Clears the notifications of these timers only. It used to cancel EVERY pending local notification,
 * which also wiped vaccine, Tərbiyə and other reminders whenever the timers were reset.
 */
export async function clearAllTimerNotifications(timerIds: string[] = []) {
  if (!isNative || !timerIds.length) return;
  const { cancelLocalNotificationIds } = await import('@/lib/local-notification-scheduler');
  await cancelLocalNotificationIds(timerIds.map(hashTimerId));
}
