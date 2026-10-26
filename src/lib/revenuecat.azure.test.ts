import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ platform: 'ios', native: true,
  configure: vi.fn(), logIn: vi.fn(), logOut: vi.fn(), setLogLevel: vi.fn(), getCustomerInfo: vi.fn(), getOfferings: vi.fn(),
  purchasePackage: vi.fn(), purchaseSubscriptionOption: vi.fn(), restorePurchases: vi.fn(), presentPaywall: vi.fn(), presentCustomerCenter: vi.fn(), getSession: vi.fn(),
  checkTrialOrIntroductoryPriceEligibility: vi.fn(), getAppUserID: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform,
  isNativePlatform: () => mocks.native, isPluginAvailable: () => true } }));
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: mocks, LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock('@revenuecat/purchases-capacitor-ui', () => ({ RevenueCatUI: mocks,
  PAYWALL_RESULT: { NOT_PRESENTED: 'NOT_PRESENTED', PURCHASED: 'PURCHASED', RESTORED: 'RESTORED' } }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); mocks.platform = 'ios'; mocks.native = true;
  vi.stubEnv('MODE', 'azure');
  vi.stubEnv('VITE_AZURE_REVENUECAT_ENABLED', undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it.each(['ios', 'android'])('keeps every RevenueCat SDK entry point closed on Azure native %s', async platform => {
  mocks.platform = platform;
  const rc = await import('./revenuecat');
  expect(rc.REVENUECAT_ENABLED).toBe(false);
  expect(rc.hasRevenueCatPlugin()).toBe(false);
  expect(rc.canUseNativePaywallUI()).toBe(false);
  await rc.initRevenueCat('fixture-user'); await rc.identifyUser('fixture-user'); await rc.logOutRevenueCat();
  expect(await rc.checkEntitlement()).toMatchObject({ isPro: false });
  expect(await rc.getOfferings()).toBeNull();
  expect(await rc.purchasePackage({ identifier: 'fixture-package' })).toMatchObject({ success: false });
  expect(await rc.restorePurchases()).toEqual({ success: false });
  expect(await rc.presentPaywall()).toEqual({ didPurchase: false, available: false });
  await rc.presentCustomerCenter();
  for (const mock of Object.values(mocks)) if (typeof mock === 'function') expect(mock).not.toHaveBeenCalled();
});

it('preserves SDK configuration, identity and purchase calls in source production builds', async () => {
  vi.stubEnv('MODE', 'production');
  const rc = await import('./revenuecat');
  expect(rc.REVENUECAT_ENABLED).toBe(true);
  expect(rc.hasRevenueCatPlugin()).toBe(true);
  await rc.initRevenueCat('fixture-user'); await rc.identifyUser('fixture-user');
  expect(mocks.configure).toHaveBeenCalledWith({ apiKey: rc.REVENUECAT_CONFIG.IOS_API_KEY, appUserID: 'fixture-user' });
  expect(mocks.logIn).toHaveBeenCalledWith({ appUserID: 'fixture-user' });
  mocks.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: { [rc.REVENUECAT_CONFIG.ENTITLEMENT_ID]: {} } } } });
  await expect(rc.purchasePackage({ identifier: 'fixture-package' })).resolves.toMatchObject({ success: true });
  expect(mocks.purchasePackage).toHaveBeenCalledExactlyOnceWith({ aPackage: { identifier: 'fixture-package' } });
});

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
it('explicit Azure activation waits for an authenticated UUID and coalesces repeated initialization', async () => {
  vi.stubEnv('VITE_AZURE_REVENUECAT_ENABLED', 'true');
  const rc = await import('./revenuecat');
  expect(rc.REVENUECAT_ENABLED).toBe(true);
  await rc.initRevenueCat(); await rc.initRevenueCat('not-a-uuid');
  expect(mocks.configure).not.toHaveBeenCalled();
  await Promise.all([rc.initRevenueCat(USER), rc.identifyUser(USER), rc.initRevenueCat(USER)]);
  expect(mocks.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: rc.REVENUECAT_CONFIG.IOS_API_KEY, appUserID: USER });
  expect(mocks.setLogLevel).toHaveBeenCalledWith({ level: 'WARN' });
  expect(mocks.logIn).not.toHaveBeenCalled();
});

it('Azure purchase/restore/paywall never operate on a different or signed-out account', async () => {
  vi.stubEnv('VITE_AZURE_REVENUECAT_ENABLED', 'true');
  const rc = await import('./revenuecat'); await rc.initRevenueCat(USER);
  for (const session of [null, { user: { id: OTHER } }]) {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    expect((await rc.purchasePackage({ identifier: 'fixture' })).success).toBe(false);
    expect((await rc.restorePurchases()).success).toBe(false);
    expect((await rc.presentPaywall()).available).toBe(false);
    await rc.presentCustomerCenter();
  }
  for (const key of ['purchasePackage', 'restorePurchases', 'presentPaywall', 'presentCustomerCenter']) expect(mocks[key]).not.toHaveBeenCalled();
});

it('Azure logout does not create an anonymous customer; next UUID is explicitly rebound', async () => {
  vi.stubEnv('VITE_AZURE_REVENUECAT_ENABLED', 'true');
  const rc = await import('./revenuecat'); await rc.initRevenueCat(USER);
  await rc.logOutRevenueCat();
  expect(rc.canUseNativePaywallUI()).toBe(false);
  expect(mocks.logOut).not.toHaveBeenCalled();
  await rc.identifyUser(OTHER);
  expect(mocks.configure).toHaveBeenCalledOnce();
  expect(mocks.logIn).toHaveBeenCalledExactlyOnceWith({ appUserID: OTHER });
});

it('a late SDK initialization cannot reopen billing after logout', async () => {
  vi.stubEnv('VITE_AZURE_REVENUECAT_ENABLED', 'true');
  let finish!: () => void;
  mocks.configure.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const rc = await import('./revenuecat');
  const starting = rc.initRevenueCat(USER);
  await vi.waitFor(() => expect(mocks.configure).toHaveBeenCalledOnce());
  await rc.logOutRevenueCat(); finish(); await starting;
  expect(rc.canUseNativePaywallUI()).toBe(false);
});

it('Android buys the paid base plan instead of the free-trial default and never falls back after an offer error', async () => {
  vi.stubEnv('MODE', 'production'); mocks.platform = 'android';
  const rc = await import('./revenuecat');
  const paid = { id: 'yearly-plan', isBasePlan: true, pricingPhases: [{ price: { amountMicros: 19990000 } }] };
  const trial = { id: 'yearly-plan:trial', isBasePlan: false, freePhase: {}, pricingPhases: [{ price: { amountMicros: 0 } }] };
  const pkg = { product: { identifier: 'yearly:yearly-plan', defaultOption: trial, subscriptionOptions: [trial, paid] } };
  mocks.purchaseSubscriptionOption.mockResolvedValue({ customerInfo: { entitlements: { active: { 'Anacan LLC Pro': {} } } } });
  expect((await rc.purchasePackage(pkg)).success).toBe(true);
  expect(mocks.purchaseSubscriptionOption).toHaveBeenCalledExactlyOnceWith({ subscriptionOption: paid });
  expect(mocks.purchasePackage).not.toHaveBeenCalled();
  mocks.purchaseSubscriptionOption.mockRejectedValue({ code: 'OFFER_UNAVAILABLE' });
  expect((await rc.purchasePackage(pkg)).success).toBe(false);
  expect(mocks.purchasePackage).not.toHaveBeenCalled();
});

it('StoreKit refuses an automatic free trial and rechecks eligibility before a paid introductory purchase', async () => {
  vi.stubEnv('MODE', 'production');
  const rc = await import('./revenuecat');
  const pkg = { product: { identifier: 'yearly.offer', price: 19.99, currencyCode: 'USD', introPrice: { price: 0 } } };
  mocks.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ 'yearly.offer': { status: 2 } });
  expect((await rc.purchasePackage(pkg)).success).toBe(false); expect(mocks.purchasePackage).not.toHaveBeenCalled();
  pkg.product.introPrice.price = 14.99;
  const request = { productId: 'yearly.offer', price: 14.99, currency: 'USD', paidIntro: true };
  mocks.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ 'yearly.offer': { status: 1 } });
  expect((await rc.purchasePackage(pkg, request)).success).toBe(false); expect(mocks.purchasePackage).not.toHaveBeenCalled();
  mocks.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ 'yearly.offer': { status: 2 } });
  mocks.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: { 'Anacan LLC Pro': {} } } } });
  expect((await rc.purchasePackage(pkg, request)).success).toBe(true); expect(mocks.purchasePackage).toHaveBeenCalledOnce();
});
it('Source purchase and restore reject a stale RevenueCat account binding', async () => {
  vi.stubEnv('MODE', 'production');
  const rc = await import('./revenuecat');
  mocks.getAppUserID.mockResolvedValue({ appUserID: OTHER });
  expect((await rc.purchasePackage({ identifier: 'fixture-package' }, undefined, USER)).success).toBe(false);
  expect((await rc.restorePurchases(USER)).success).toBe(false);
  expect(mocks.purchasePackage).not.toHaveBeenCalled(); expect(mocks.restorePurchases).not.toHaveBeenCalled();
});
