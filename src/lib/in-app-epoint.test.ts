import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), native: false, browser: false, open: vi.fn(), addListener: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke }, rpc: mocks.rpc } }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mocks.native, getPlatform: () => (mocks.native ? 'android' : 'web'), isPluginAvailable: () => mocks.browser },
  registerPlugin: () => ({ open: mocks.open, addListener: mocks.addListener }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => undefined }));
vi.mock('@/lib/premium-funnel', () => ({ funnelHit: vi.fn(), purchaseIntent: vi.fn(), funnelPlatform: () => 'android' }));
vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import {
  epointErrorKey, formatAzn, hasOwnPremium, isInAppEpointEligible, localeRegion, openCheckoutPage, parseEpointStatus, parseInAppEpointSetting,
  pendingCheckout, pollUntil, requestEpointCheckout, resolveCountry,
} from './in-app-epoint';
// The server reads the same setting (web-premium-subscription.ts); both parsers must agree.
import { inAppEpointAllowed, parseInAppEpoint, subscribeRedirects } from '../../supabase/functions/_shared/web-premium-subscription';

const SEED = { enabled: true, countries: ['AZ'], platforms: { android: true, ios: false, web: true } };

describe('in_app_epoint setting', () => {
  it('reads the object, the JSON string the admin writer stores and garbage (off)', () => {
    expect(parseInAppEpointSetting(SEED)).toEqual(SEED);
    expect(parseInAppEpointSetting(JSON.stringify(SEED))).toEqual(SEED);
    expect(parseInAppEpointSetting(JSON.stringify(JSON.stringify(SEED)))).toEqual(SEED);
    expect(parseInAppEpointSetting({ enabled: 'yes', countries: ['az', 'xx1', 'AZ', 7] })).toEqual({ enabled: false, countries: ['AZ'], platforms: { android: false, ios: false, web: false } });
    expect(parseInAppEpointSetting(undefined).enabled).toBe(false);
    expect(parseInAppEpointSetting('{broken').enabled).toBe(false);
  });

  it('matches the server parser and check for every case', () => {
    const cases: Array<[unknown, string | null, 'ios' | 'android' | 'web']> = [
      [SEED, 'AZ', 'android'], [SEED, 'az', 'web'], [SEED, 'AZ', 'ios'], [SEED, 'TR', 'android'], [SEED, null, 'android'],
      [{ ...SEED, enabled: false }, 'AZ', 'android'], [JSON.stringify({ ...SEED, platforms: { ios: true } }), 'AZ', 'ios'],
    ];
    for (const [raw, country, platform] of cases) {
      const client = isInAppEpointEligible(parseInAppEpointSetting(raw), country, platform);
      expect(inAppEpointAllowed(parseInAppEpoint(raw), country, platform), `${JSON.stringify(raw)} ${country} ${platform}`).toBe(client);
    }
    expect(isInAppEpointEligible(parseInAppEpointSetting(SEED), 'AZ', 'android')).toBe(true);
    expect(isInAppEpointEligible(parseInAppEpointSetting(SEED), 'AZ', 'ios')).toBe(false);
    expect(inAppEpointAllowed(parseInAppEpoint(SEED), 'AZ', 'desktop')).toBe(false);
  });

  it('takes the profile country first, else the device locale region', () => {
    expect(resolveCountry('az', 'en-US')).toBe('AZ');
    expect(resolveCountry(null, 'az-AZ')).toBe('AZ');
    expect(resolveCountry('', 'az-Latn-AZ')).toBe('AZ');
    expect(resolveCountry(undefined, 'az')).toBeNull();
    expect(localeRegion('ru_RU')).toBe('RU');
  });
});

describe('server answers', () => {
  it('parses web-premium status into server prices and the current Premium', () => {
    const offer = parseEpointStatus({ ok: true, payments_ready: true, offer: { active: true, kind: 'campaign', plans: {
      monthly: { price: 2.99, was: 4.99, pct: 40 }, yearly: { price: 24.99, was: 50.98, pct: 51, per_month: 2.08 } } },
      premium: { active: false, source: null } });
    expect(offer).toEqual({ paymentsReady: true, kind: 'campaign', rate: null, premium: { active: false, source: null }, plans: {
      monthly: { price: 2.99, was: 4.99, pct: 40, perMonth: null, usd: null }, yearly: { price: 24.99, was: 50.98, pct: 51, perMonth: 2.08, usd: null } } });
    const app = parseEpointStatus({ ok: true, payments_ready: true, offer: { active: true, kind: 'app', plans: { monthly: { price: 6.99, was: null },
      yearly: { price: 50.99, was: null, per_month: 4.24 } }, usd: { monthly: 3.99, yearly: 29.99 }, rate: 1.7, rate_date: '2026-11-25', rate_source: 'cbar' },
      premium: { active: false, source: null } });
    expect(app?.kind).toBe('app');
    expect(app?.rate).toEqual({ value: 1.7, date: '2026-11-25', source: 'cbar' });
    expect(app?.plans.yearly).toEqual({ price: 50.99, was: null, pct: null, perMonth: 4.24, usd: 29.99 });
    expect(parseEpointStatus({ ok: true, offer: { active: false }, premium: { active: true, source: 'store' } })?.plans).toEqual({ monthly: null, yearly: null });
    expect(parseEpointStatus({ ok: false })).toBeNull();
  });

  it('maps error codes to messages; store Premium gets its own', () => {
    expect(epointErrorKey('premium_active', 'store')).toBe('iep_err_premium_store');
    expect(epointErrorKey('premium_active', 'web_subscription')).toBe('iep_err_premium_active');
    expect(epointErrorKey('payments_unavailable')).toBe('iep_err_payments_unavailable');
    expect(epointErrorKey('too_many_attempts')).toBe('iep_err_too_many_attempts');
    expect(epointErrorKey('checkout_unavailable')).toBe('iep_err_checkout_unavailable');
    expect(epointErrorKey('app_checkout_disabled')).toBe('iep_err_checkout_unavailable');
    expect(epointErrorKey('database_unavailable')).toBe('iep_err_generic');
  });

  it('formats AZN with two decimals', () => {
    expect(formatAzn(4.9, 'en')).toMatch(/^4\.90 ₼$/);
    expect(formatAzn(24.99, 'az')).toMatch(/^24,99 ₼$/);
  });
});

describe('checkout', () => {
  beforeEach(() => { mocks.invoke.mockReset(); mocks.rpc.mockReset(); mocks.open.mockReset(); mocks.addListener.mockReset(); mocks.native = false; mocks.browser = false; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('asks web-premium for an app checkout with the consent the card shows', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, redirect_url: 'https://ecomm.pashabank.az/pay?x=1' }, error: null });
    expect(await requestEpointCheckout('yearly', 'android', 'ru')).toEqual({ ok: true, url: 'https://ecomm.pashabank.az/pay?x=1' });
    expect(mocks.invoke).toHaveBeenCalledWith('web-premium', { body: { action: 'subscribe', plan: 'yearly', page: 'app', consent: 'premium-autorenew-v1', platform: 'android', language: 'ru' } });
  });

  it('returns the refusal (200 ok:false) and the non-2xx body', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: false, error: 'premium_active', premium: { active: true, source: 'store' } }, error: null });
    expect(await requestEpointCheckout('monthly', 'web', 'az')).toEqual({ ok: false, error: 'premium_active', premiumSource: 'store' });
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ error: 'origin_not_allowed' }) } } });
    expect(await requestEpointCheckout('monthly', 'web', 'az')).toEqual({ ok: false, error: 'origin_not_allowed', premiumSource: null });
    mocks.invoke.mockRejectedValueOnce(new Error('offline'));
    expect(await requestEpointCheckout('monthly', 'web', 'az')).toEqual({ ok: false, error: 'unavailable', premiumSource: null });
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, redirect_url: 'javascript:alert(1)' }, error: null });
    expect((await requestEpointCheckout('monthly', 'web', 'az')).ok).toBe(false);
  });

  it('reads own Premium from get_premium_access_v1', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { protocol: 'anacan-premium-access-v1', userId: 'u1', own: { active: true } }, error: null });
    expect(await hasOwnPremium('u1')).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('get_premium_access_v1', { p_user_id: 'u1' });
    mocks.rpc.mockResolvedValueOnce({ data: { protocol: 'anacan-premium-access-v1', userId: 'u2', own: { active: true } }, error: null });
    expect(await hasOwnPremium('u1')).toBe(false);
  });

  it('opens the in-app browser when the native plugin exists, else the system browser', async () => {
    mocks.native = true; mocks.browser = true;
    mocks.addListener.mockResolvedValue({ remove: vi.fn() });
    const closed = vi.fn();
    expect(await openCheckoutPage('https://epoint.az/x', closed)).toBe('in_app');
    expect(mocks.open).toHaveBeenCalledWith({ url: 'https://epoint.az/x', presentationStyle: 'fullscreen' });
    mocks.addListener.mock.calls[0][1]();
    expect(closed).toHaveBeenCalled();
    mocks.browser = false;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await openCheckoutPage('https://epoint.az/y')).toBe('external');
    expect(open).toHaveBeenCalledWith('https://epoint.az/y', '_blank', 'noopener,noreferrer');
  });

  it('polls until Premium shows up or the time is up', async () => {
    let t = 0;
    const sleep = async (ms: number) => { t += ms; };
    const answers = [false, false, true];
    expect(await pollUntil(async () => answers.shift()!, { now: () => t, sleep, intervalMs: 3000, timeoutMs: 60000 })).toBe(true);
    expect(t).toBe(6000);
    t = 0;
    const check = vi.fn(async () => false);
    expect(await pollUntil(check, { now: () => t, sleep, intervalMs: 3000, timeoutMs: 60000 })).toBe(false);
    expect(check).toHaveBeenCalledTimes(21);
    expect(await pollUntil(async () => { throw new Error('x'); }, { now: () => t, sleep, timeoutMs: 0 })).toBe(false);
  });

  it('remembers a checkout that left the app for 30 minutes, per user', () => {
    localStorage.setItem('anacan_iep_pending_v1', JSON.stringify({ userId: 'u1', at: 1_000 }));
    expect(pendingCheckout('u1', 1_000 + 60_000)).toBe(true);
    expect(pendingCheckout('u2', 1_000 + 60_000)).toBe(false);
    expect(pendingCheckout('u1', 1_000 + 31 * 60_000)).toBe(false);
    localStorage.removeItem('anacan_iep_pending_v1');
  });
});

describe('server redirects', () => {
  it('sends app checkouts to the app return page and keeps the website pages', () => {
    expect(subscribeRedirects('app', false, 'android').success).toBe('https://anacan.az/website/premium/app-return/index.html?odenis=ugurlu&from=app');
    expect(subscribeRedirects('app', false, 'web').error).toBe('https://anacan.az/website/premium/app-return/index.html?odenis=xeta&from=web');
    expect(subscribeRedirects('standard', false).success).toBe('https://anacan.az/website/premium/abune/index.html?odenis=ugurlu');
    expect(subscribeRedirects(undefined, false).success).toBe('https://anacan.az/website/premium/kampaniya/index.html?odenis=ugurlu');
    expect(subscribeRedirects('app', true).success).toBe('https://anacan.az/website/premium/kampaniya/index.html?odenis=ugurlu');
  });
});
