import { Capacitor } from '@capacitor/core';

/** Every logout step is bounded: a stuck native bridge or network never holds the logout. */
export const LOGOUT_STEP_TIMEOUT_MS = 2500;

function settleWithin(work: () => Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve().then(work).then(() => undefined, () => undefined),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Cancels every scheduled local notification (vaccine, baby chat, water, parenting,
 * weaning, nap, pill, timers) and clears delivered ones, so the next person on this
 * device does not see the previous account's reminders or their content.
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  const ids = (pending?.notifications ?? []).map((item) => ({ id: item.id }));
  if (ids.length) await LocalNotifications.cancel({ notifications: ids });
  try { await LocalNotifications.removeAllDeliveredNotifications(); } catch { /* optional on older plugins */ }
}

/**
 * Privacy cleanup that must run while the session still exists (the device_tokens
 * delete is RLS-scoped to the signed-in account). Never throws; resolves within
 * about LOGOUT_STEP_TIMEOUT_MS even if a step hangs.
 */
export async function runLogoutCleanup(userId: string | null | undefined, timeoutMs = LOGOUT_STEP_TIMEOUT_MS): Promise<void> {
  const steps: Array<() => Promise<unknown>> = [cancelAllLocalNotifications];
  if (userId) {
    steps.push(async () => {
      const { unregisterDeviceForLogout } = await import('@/hooks/useDeviceToken');
      await unregisterDeviceForLogout(userId, timeoutMs);
    });
  }
  // The device step has its own per-call bounds; the outer bound covers the import too.
  await Promise.all(steps.map((step) => settleWithin(step, timeoutMs + 1500)));
}
