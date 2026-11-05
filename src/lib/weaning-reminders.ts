// Premium: a local notification at 09:00 on the first day of each upcoming weaning step (this phone only).
import { reminderDays, type WeaningPlan, type WeaningStep } from './weaning';

const BASE_ID = 881_100;
/** A plan has at most 10 steps (1 morning + 4 day + 1 nap + 3 night + 1 bedtime). */
const ALL_IDS = Array.from({ length: 12 }, (_, i) => ({ id: BASE_ID + i }));

export async function syncWeaningReminders(
  plan: WeaningPlan | null,
  enabled: boolean,
  text: { title: string; body: (step: WeaningStep) => string },
  now = new Date(),
): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ALL_IDS });
    if (!enabled || !plan) return;
    const due = reminderDays(plan, now);
    if (!due.length) return;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: due.map(({ step, at }) => ({
        id: BASE_ID + plan.steps.indexOf(step), title: text.title, body: text.body(step), schedule: { at, allowWhileIdle: true },
      })),
    });
  } catch { /* reminders are a convenience; the plan screen still shows today's step */ }
}
