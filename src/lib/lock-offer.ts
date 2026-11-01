// One-time offer, on the first Home visit after onboarding (native only), to protect the app with
// Face ID / fingerprint + PIN. It uses the existing app lock (appLock.ts); it can be turned off later
// in Settings → App lock.
import { Capacitor } from '@capacitor/core';
import { isLockEnabled } from './appLock';

const KEY = 'anacan.lockOffer.seenAt';

export function shouldOfferLock(): boolean {
  if (!Capacitor.isNativePlatform() || isLockEnabled()) return false;
  try {return !localStorage.getItem(KEY);} catch {return false;}
}

export function markLockOfferSeen(): void {
  try {localStorage.setItem(KEY, String(Date.now()));} catch {/* optional */}
}
