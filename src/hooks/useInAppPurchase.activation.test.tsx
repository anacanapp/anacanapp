import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  refresh: vi.fn(), invoke: vi.fn(), initialize: vi.fn(), identify: vi.fn(), purchase: vi.fn(), restore: vi.fn(), paywall: vi.fn(), invalidate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, refreshProfile: mocks.refresh }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { logPremiumSubscribed: vi.fn(), logTrialStarted: vi.fn() } }));
vi.mock('@/lib/revenuecat', () => ({
  REVENUECAT_ENABLED: true, isNativePlatform: () => true, hasRevenueCatPlugin: () => true,
  initRevenueCat: mocks.initialize, identifyUser: mocks.identify,
  checkEntitlement: async () => ({ isPro: true }),
  getOfferings: async () => ({ all: { pricing_2026: { availablePackages: [{ identifier: '$rc_monthly', packageType: 'MONTHLY',
    product: { identifier: 'com.atlasoon.anacan.premium.monthly', price: 3.99, currencyCode: 'USD' } }] } } }),
  purchasePackage: mocks.purchase, restorePurchases: mocks.restore, presentPaywall: mocks.paywall, presentCustomerCenter: async () => {},
  RC_PRODUCTS: { MONTHLY: 'monthly', YEARLY: 'yearly', LIFETIME: 'lifetime' }, RC_OFFERING_ID: 'pricing_2026',
  REVENUECAT_CONFIG: { ENTITLEMENT_ID: 'Anacan LLC Pro' },
}));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('MODE', 'azure');
  mocks.user = { id: '11111111-1111-4111-8111-111111111111' };
  mocks.invoke.mockResolvedValue({ data: { isPro: false }, error: null });
  mocks.purchase.mockResolvedValue({ success: true, customerInfo: { entitlements: { active: { 'Anacan LLC Pro': { periodType: 'NORMAL' } } } } });
  mocks.restore.mockResolvedValue({ success: true });
  mocks.paywall.mockResolvedValue({ available: true, didPurchase: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function ready() {
  const { useInAppPurchase } = await import('./useInAppPurchase');
  const hook = renderHook(useInAppPurchase);
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  mocks.invoke.mockClear(); mocks.refresh.mockClear();
  return hook;
}
it('does not initialize an anonymous SDK or treat cached client Premium as server confirmation', async () => {
  const hook = await ready();
  expect(hook.result.current.isPro).toBe(false);
  expect(hook.result.current.packages).toHaveLength(1);
  hook.unmount(); mocks.initialize.mockClear(); mocks.identify.mockClear(); mocks.user = null;
  const anonymous = await ready();
  expect(anonymous.result.current.isSupported).toBe(false);
  expect(mocks.initialize).not.toHaveBeenCalled(); expect(mocks.identify).not.toHaveBeenCalled();
});
it.each(['azure', 'production'])('%s: store success with unconfirmed backend stays pending and never repeats the purchase', async mode => {
  vi.stubEnv('MODE', mode);
  const { result } = await ready(); vi.useFakeTimers();
  let success: boolean;
  await act(async () => { const pending = result.current.purchaseMonthly(); await vi.runAllTimersAsync(); success = await pending; });
  expect(success!).toBe(false); expect(result.current.isPro).toBe(false);
  expect(result.current.error).toContain('Premium təsdiqi gözlənilir');
  expect(mocks.purchase).toHaveBeenCalledOnce(); expect(mocks.invoke).toHaveBeenCalledTimes(4);
  await act(async () => { expect(await result.current.purchaseMonthly()).toBe(false); });
  expect(mocks.purchase).toHaveBeenCalledOnce();
});
it('unlocks only after a successful authoritative sync', async () => {
  const { result } = await ready();
  mocks.invoke.mockResolvedValue({ data: { isPro: true }, error: null });
  await act(async () => { await expect(result.current.purchaseMonthly()).resolves.toBe(true); });
  expect(result.current.isPro).toBe(true); expect(mocks.purchase).toHaveBeenCalledOnce();
  const filter=mocks.invalidate.mock.calls.at(-1)?.[0];
  expect(filter.predicate({queryKey:['community-feed',mocks.user!.id]})).toBe(true);
  expect(filter.predicate({queryKey:['public-profile','author']})).toBe(true);
  expect(filter.predicate({queryKey:['community-profile-card',mocks.user!.id,'author']})).toBe(true);
});
it('restore and native paywall success cannot bypass an unconfirmed server result', async () => {
  const { result } = await ready(); vi.useFakeTimers();
  await act(async () => {
    const restoring = result.current.restorePurchases(); await vi.runAllTimersAsync(); expect(await restoring).toBe(false);
    const paywall = result.current.showPaywallSafe(); await vi.runAllTimersAsync(); expect(await paywall).toEqual({ available: true, didPurchase: false });
  });
  expect(result.current.isPro).toBe(false);
});
