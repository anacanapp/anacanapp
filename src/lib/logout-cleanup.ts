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
 * weaning, nap, pill, timers), clears delivered ones and forgets the scheduler's desired
 * set, so the next person on this device does not see the previous account's reminders
 * or their content, and a later re-plan cannot bring them back.
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { resetLocalNotifications } = await import('@/lib/local-notification-scheduler');
  await resetLocalNotifications();
}

/** A notification tapped before (or during) logout must not open the next account's screens. */
async function dropQueuedNotificationTaps(): Promise<void> {
  const [{ clearQueuedNotificationTaps }, { consumePendingPushNav }] = await Promise.all([
    import('@/lib/notification-taps'), import('@/lib/pushNav'),
  ]);
  clearQueuedNotificationTaps();
  consumePendingPushNav();
}

/**
 * Privacy cleanup that must run while the session still exists (the device_tokens
 * delete is RLS-scoped to the signed-in account). Never throws; resolves within
 * about LOGOUT_STEP_TIMEOUT_MS even if a step hangs.
 */
export async function runLogoutCleanup(userId: string | null | undefined, timeoutMs = LOGOUT_STEP_TIMEOUT_MS): Promise<void> {
  const steps: Array<() => Promise<unknown>> = [cancelAllLocalNotifications, dropQueuedNotificationTaps];
  if (userId) {
    steps.push(async () => {
      const { unregisterDeviceForLogout } = await import('@/hooks/useDeviceToken');
      await unregisterDeviceForLogout(userId, timeoutMs);
    });
  }
  // The device step has its own per-call bounds; the outer bound covers the import too.
  await Promise.all(steps.map((step) => settleWithin(step, timeoutMs + 1500)));
}
