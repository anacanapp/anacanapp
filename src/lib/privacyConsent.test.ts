import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({ logEvent: vi.fn(async () => undefined) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' }, registerPlugin: () => fb }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => undefined) } }));

import { __resetPrivacyConsentForTests, getPrivacyConsent, hasPrivacyDecision, isAdPersonalizationAllowed, isAnalyticsAllowed,
  isAttributionAllowed, setPrivacyConsent, subscribePrivacyConsent } from './privacyConsent';

describe('privacy consent', () => {
  beforeEach(() => { localStorage.clear(); __resetPrivacyConsentForTests(); });

  it('starts undecided with every optional channel off', () => {
    expect(hasPrivacyDecision()).toBe(false);
    expect([isAnalyticsAllowed(), isAdPersonalizationAllowed(), isAttributionAllowed()]).toEqual([false, false, false]);
  });

  it('stores each choice separately and notifies listeners', async () => {
    const listener = vi.fn();
    subscribePrivacyConsent(listener);
    await setPrivacyConsent({ analytics: true, ads: false, attribution: true });
    expect(listener).toHaveBeenCalled();
    expect(getPrivacyConsent()).toMatchObject({ analytics: true, ads: false, attribution: true });
    expect(hasPrivacyDecision()).toBe(true);
    expect(JSON.parse(localStorage.getItem('anacan_privacy_consent_v1')!)).toMatchObject({ analytics: true, ads: false, attribution: true });
  });

  it('"essential only" turns everything off', async () => {
    await setPrivacyConsent({ analytics: true, ads: true, attribution: true });
    await setPrivacyConsent({ analytics: false, ads: false, attribution: false });
    expect([isAnalyticsAllowed(), isAdPersonalizationAllowed(), isAttributionAllowed()]).toEqual([false, false, false]);
    expect(hasPrivacyDecision()).toBe(true);
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('anacan_privacy_consent_v1', '{"analytics":true}');
    __resetPrivacyConsentForTests();
    expect(isAnalyticsAllowed()).toBe(false);
  });
});
