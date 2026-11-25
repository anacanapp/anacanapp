// Premium: a local notification at 09:00 on the first day of each upcoming weaning step (this phone only).
import { reminderDays, type WeaningPlan, type WeaningStep } from './weaning';

const BASE_ID = 881_100;
/** A plan has at most 10 steps (1 morning + 4 day + 1 nap + 3 night + 1 bedtime). */
const ALL_IDS = Array.from({ length: 12 }, (_, i) => BASE_ID + i);

export async function syncWeaningReminders(
  plan: WeaningPlan | null,
  enabled: boolean,
  text: { title: string; body: (step: WeaningStep) => string },
  now = new Date(),
): Promise<void> {
  try {
    const due = enabled && plan ? reminderDays(plan, now) : [];
    const { setLocalNotifications } = await import('./local-notification-scheduler');
    await setLocalNotifications('weaning', due.map(({ step, at }) => ({
      id: BASE_ID + (plan as WeaningPlan).steps.indexOf(step), title: text.title, body: text.body(step), at,
    })), { ask: true, cancelIds: ALL_IDS });
  } catch { /* reminders are a convenience; the plan screen still shows today's step */ }
}
