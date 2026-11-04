/**
 * Privacy consent (analytics / ad personalisation / attribution).
 *
 * Opt-in model: until the person decides, every optional third-party channel is off
 * (Firebase Analytics collection, Facebook App Events, personalised ads). The decision is
 * stored on the device per install; changing it applies immediately to the native SDKs.
 * Native defaults (AndroidManifest / Info.plist) also start with collection disabled, so
 * nothing is sent before this module runs.
 */
import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface PrivacyConsent { analytics: boolean; ads: boolean; attribution: boolean; decidedAt: string | null }
const KEY = 'anacan_privacy_consent_v1';
const UNDECIDED: PrivacyConsent = Object.freeze({ analytics: false, ads: false, attribution: false, decidedAt: null });

let state: PrivacyConsent = readSync();
let loaded = false;
const listeners = new Set<() => void>();

function parse(raw: string | null | undefined): PrivacyConsent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || typeof value.decidedAt !== 'string') return null;
    return { analytics: value.analytics === true, ads: value.ads === true, attribution: value.attribution === true, decidedAt: value.decidedAt };
  } catch { return null; }
}
function readSync(): PrivacyConsent {
  try { return parse(globalThis.localStorage?.getItem(KEY)) ?? UNDECIDED; } catch { return UNDECIDED; }
}

export function getPrivacyConsent(): PrivacyConsent { return state; }
export const hasPrivacyDecision = () => state.decidedAt !== null;
export const isAnalyticsAllowed = () => state.analytics;
export const isAttributionAllowed = () => state.attribution;
export const isAdPersonalizationAllowed = () => state.ads;

function emit() { listeners.forEach(listener => { try { listener(); } catch { /* listener errors never block consent */ } }); }
export function subscribePrivacyConsent(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function usePrivacyConsent(): PrivacyConsent { return useSyncExternalStore(subscribePrivacyConsent, getPrivacyConsent, getPrivacyConsent); }

/** Native Preferences survive WebView storage eviction; localStorage keeps the first read synchronous. */
export async function loadPrivacyConsent(): Promise<PrivacyConsent> {
  if (loaded) return state;
  loaded = true;
  try {
    const { value } = await Preferences.get({ key: KEY });
    const stored = parse(value);
    if (stored && stored.decidedAt !== state.decidedAt) {
      state = stored;
      try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* private mode */ }
      emit();
    }
  } catch { /* keep the synchronous value */ }
  await applyPrivacyConsent(state);
  return state;
}

export async function setPrivacyConsent(choice: Pick<PrivacyConsent, 'analytics' | 'ads' | 'attribution'>): Promise<PrivacyConsent> {
  state = { analytics: !!choice.analytics, ads: !!choice.ads, attribution: !!choice.attribution, decidedAt: new Date().toISOString() };
  const raw = JSON.stringify(state);
  try { localStorage.setItem(KEY, raw); } catch { /* private mode */ }
  try { await Preferences.set({ key: KEY, value: raw }); } catch { /* best effort */ }
  emit();
  await applyPrivacyConsent(state, true);
  return state;
}

/** Push the decision into Firebase (collection + Consent Mode v2) and the Meta SDK. */
export async function applyPrivacyConsent(consent: PrivacyConsent, fromUser = false): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { FirebaseAnalytics, ConsentType, ConsentStatus } = await import('@capacitor-firebase/analytics');
    const status = (granted: boolean) => granted ? ConsentStatus.Granted : ConsentStatus.Denied;
    await Promise.all([
      FirebaseAnalytics.setConsent({ type: ConsentType.AnalyticsStorage, status: status(consent.analytics) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdStorage, status: status(consent.ads) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdUserData, status: status(consent.ads) }),
      FirebaseAnalytics.setConsent({ type: ConsentType.AdPersonalization, status: status(consent.ads) }),
    ]);
    await FirebaseAnalytics.setEnabled({ enabled: consent.analytics });
  } catch { /* analytics SDK unavailable: nothing is collected */ }
  try {
    const { applyFacebookConsent } = await import('./facebook-events');
    await applyFacebookConsent(consent.attribution, fromUser);
  } catch { /* Meta SDK unavailable */ }
}

/** Test hook. */
export function __resetPrivacyConsentForTests(value: PrivacyConsent = UNDECIDED) { state = value; loaded = false; listeners.clear(); }
