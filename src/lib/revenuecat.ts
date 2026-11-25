import { Capacitor } from '@capacitor/core';
import { isAzureBackend } from '@/integrations/supabase/backend-config';
import { isoPeriod, optionHasTrial, validatePaidPurchase, type PaidPurchaseRequest } from './onboarding-billing';
import { classifyPurchaseError, googleSubscriptionId, premiumSourceKind, storePurchaseBlock, type PurchaseErrorCode, type StoreEntitlementInfo } from './purchase-errors';

// Source/store builds retain RevenueCat. Azure activation is an explicit preview
// opt-in paired with the reviewed server contract; anonymous SDK setup stays off.
// REQUIREMENTS for Android:
//   1. After pulling this code, run: npm install && npx cap sync android
//   2. Configure a Paywall in RevenueCat Dashboard → Paywalls (otherwise
//      presentPaywall() silently no-ops and the JS custom UI is used).
//   3. Ensure offerings & products are set in RevenueCat Dashboard.
const AZURE_PREVIEW = isAzureBackend();
export const REVENUECAT_ENABLED = !AZURE_PREVIEW || import.meta.env.VITE_AZURE_REVENUECAT_ENABLED === 'true';
let azureConfigured = false;
let azureUserId: string | null = null;
let azureEpoch = 0;
let azureBinding = Promise.resolve();

async function currentAzureIdentity(): Promise<boolean> {
  if (!AZURE_PREVIEW) return true;
  if (!azureUserId) return false;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.auth.getSession();
    return !error && data.session?.user.id === azureUserId;
  } catch { return false; }
}

// Bundle marker — cihazda hansı web bundle-ın işlədiyini yoxlamaq üçün.
// RevenueCat Debug səhifəsində görünür. Hər kritik fix-də artırılır.
export const RC_BUILD_MARKER = '2026-11-25-purchase-recovery-v4';

// ── Versiyalı offering strategiyası ──────────────────────────────
// Bu build offerings.all-dan aşağıdakı paket dəstini seçir. Qiymət və trial
// isə mağazadakı product/base plan/offer-dən gəlir. Eyni product istifadə
// olunursa mağaza dəyişikliyi köhnə build-lərə də çata bilər; mövcud
// abunəçilərin qiymətini offering ID-si deyil, mağazanın cohort qaydası qoruyur.
// RC Dashboard-da: "pricing_2026" adlı offering yaradın (yeni məhsullarla);
// "current" offering-ə TOXUNMAYIN. Bu ID tapılmasa, current-ə düşürük.
export const RC_OFFERING_ID = 'pricing_2026';

// RevenueCat Configuration
// NOTE: RevenueCat requires PLATFORM-SPECIFIC public API keys (Android & iOS).
// Get them from: RevenueCat Dashboard → Project Settings → API Keys → Public app-specific
export const REVENUECAT_CONFIG = {
  // Android Google Play public key (starts with "goog_")
  ANDROID_API_KEY: 'goog_oMjcZonQOQKsqInQGZdfeBeJEDg',
  // iOS App Store public key (starts with "appl_")
  IOS_API_KEY: 'appl_QFkRqVsmtObOxwBjvTUKChSFubL',
  // Fallback (used if platform-specific is not set) — keep for backwards compat
  API_KEY: 'test_bXWdDDnuTuBrVDYOOviwZDCLvIW',
  ENTITLEMENT_ID: 'Anacan LLC Pro',
} as const;

function getApiKey(): string {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' && !REVENUECAT_CONFIG.ANDROID_API_KEY.startsWith('goog_REPLACE')) {
    return REVENUECAT_CONFIG.ANDROID_API_KEY;
  }
  if (platform === 'ios' && !REVENUECAT_CONFIG.IOS_API_KEY.startsWith('appl_REPLACE')) {
    return REVENUECAT_CONFIG.IOS_API_KEY;
  }
  return REVENUECAT_CONFIG.API_KEY;
}

// Product identifiers (must match RevenueCat dashboard)
export const RC_PRODUCTS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const hasRevenueCatPlugin = (): boolean =>
  REVENUECAT_ENABLED && isNativePlatform() && Capacitor.isPluginAvailable('Purchases');

// RevenueCat native paywall UI — həm iOS, həm Android-də aktiv.
// Dashboard paywall dizaynında mənfi padding olmamalıdır, yoxsa Android crash verir.
export const canUseNativePaywallUI = (): boolean =>
  REVENUECAT_ENABLED &&
  (!AZURE_PREVIEW || !!azureUserId) &&
  isNativePlatform() &&
  Capacitor.isPluginAvailable('RevenueCatUI');

export const hasRevenueCatUIPlugin = (): boolean =>
  canUseNativePaywallUI();

export const getPlatform = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
};

/**
 * Apple Ads attribution (AdServices). iOS only: RevenueCat fetches the AdServices attribution token after configure and
 * resolves campaign / ad group / keyword for the subscriber, so Apple Ads installs can be tied to trials and purchases.
 * AdServices is Apple's own attribution, works without the ATT prompt and sends no device identifiers.
 */
async function enableAppleAdsAttribution(Purchases: { enableAdServicesAttributionTokenCollection: () => Promise<void> }): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  try { await Purchases.enableAdServicesAttributionTokenCollection(); } catch { /* older native plugin: skip */ }
}

/**
 * Initialize RevenueCat SDK. Call once at app startup on native platforms.
 */
export async function initRevenueCat(appUserID?: string): Promise<void> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin()) return;

  if (AZURE_PREVIEW) {
    if (!appUserID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserID)) return;
    const epoch = azureEpoch;
    const bind = azureBinding.then(async () => {
      if (epoch !== azureEpoch || azureUserId === appUserID) return;
      const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
      if (!azureConfigured) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        await Purchases.configure({ apiKey: getApiKey(), appUserID });
        azureConfigured = true;
        await enableAppleAdsAttribution(Purchases);
      } else await Purchases.logIn({ appUserID });
      if (epoch === azureEpoch) azureUserId = appUserID;
    });
    azureBinding = bind.catch(() => {});
    try { await bind; } catch { throw new Error('REVENUECAT_INITIALIZATION_UNAVAILABLE'); }
    return;
  }

  try {
    const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');

    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey: getApiKey(),
      appUserID: appUserID || undefined,
    });
    await enableAppleAdsAttribution(Purchases);

    console.log('[RevenueCat] SDK configured successfully on', Capacitor.getPlatform());
  } catch (err) {
    console.error('[RevenueCat] init error:', err);
  }
}

/**
 * Identify user in RevenueCat (call after login)
 */
export async function identifyUser(appUserID: string): Promise<void> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin()) return;
  if (AZURE_PREVIEW) return initRevenueCat(appUserID);
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.logIn({ appUserID });
  } catch (err) {
    console.error('RevenueCat identify error:', err);
  }
}

/**
 * Log out user from RevenueCat (call after logout)
 */
export async function logOutRevenueCat(): Promise<void> {
  if (AZURE_PREVIEW) {
    azureEpoch++;
    azureUserId = null;
    // Purchases.logOut creates an anonymous customer. Keep billing closed until
    // the next authenticated UUID is explicitly bound instead.
    return;
  }
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin()) return;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.logOut();
  } catch (err) {
    console.error('RevenueCat logout error:', err);
  }
}

/**
 * Check if user has the Pro entitlement
 */
export async function checkEntitlement(): Promise<{
  isPro: boolean;
  expiresAt: string | null;
  productId: string | null;
  willRenew: boolean;
  /** RevenueCat periodType: 'TRIAL' | 'INTRO' | 'NORMAL' (NORMAL = real ödənişli) */
  periodType: string | null;
  /** RevenueCat entitlement store (APP_STORE, PLAY_STORE, PROMOTIONAL, ...). */
  store?: string | null;
}> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin() || !await currentAzureIdentity()) {
    return { isPro: false, expiresAt: null, productId: null, willRenew: false, periodType: null };
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENT_ID];

    if (entitlement) {
      return {
        isPro: true,
        expiresAt: entitlement.expirationDate || null,
        productId: entitlement.productIdentifier || null,
        willRenew: entitlement.willRenew ?? false,
        periodType: (entitlement as any).periodType || null,
        store: (entitlement as { store?: string }).store || null,
      };
    }

    return { isPro: false, expiresAt: null, productId: null, willRenew: false, periodType: null };
  } catch (err) {
    console.error('RevenueCat entitlement check error:', err);
    return { isPro: false, expiresAt: null, productId: null, willRenew: false, periodType: null };
  }
}

/**
 * Get available offerings/packages
 */
export async function getOfferings() {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin() || !await currentAzureIdentity()) return null;

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const result = await Purchases.getOfferings();
    // Workaround: TS types say PurchasesOfferings directly, but runtime wraps in { offerings }
    const offerings = ('offerings' in result) ? (result as any).offerings : result;
    return offerings;
  } catch (err) {
    console.error('RevenueCat offerings error:', err);
    return null;
  }
}

/** Unknown eligibility never enables a discounted StoreKit purchase. */
export async function getIntroEligibility(productIdentifiers: string[]): Promise<Record<string, number>> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin() || Capacitor.getPlatform() !== 'ios' || !productIdentifiers.length || !await currentAzureIdentity()) return {};
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers });
    return Object.fromEntries(Object.entries(result).map(([id, value]) => [id, value.status]));
  } catch { return {}; }
}

/**
 * Find the best subscription option for purchase on Android (Google Play).
 * Google Play free trials live on OFFERS, not on the base plan. To guarantee
 * the trial is applied we must explicitly purchase the SubscriptionOption that
 * contains a freePhase, instead of relying on defaultOption.
 */
export function findFreeTrialOption(pkg: any): any | null {
  const options = pkg?.product?.subscriptionOptions;
  if (!Array.isArray(options) || options.length === 0) return null;

  // 1) Prefer an offer (non base-plan) with a free trial phase
  const trialOffer = options.find((o: any) => o?.freePhase && !o?.isBasePlan);
  if (trialOffer) return trialOffer;

  // 2) Any option with a free phase
  const anyTrial = options.find((o: any) => o?.freePhase);
  if (anyTrial) return anyTrial;

  return null;
}

interface EntitlementLike { store?: string; productIdentifier?: string; productPlanIdentifier?: string | null; willRenew?: boolean; expirationDate?: string | null }
function activeStoreEntitlementFrom(customerInfo: unknown): StoreEntitlementInfo | null {
  const info = customerInfo as { entitlements?: { active?: Record<string, EntitlementLike | undefined> } } | null | undefined;
  const entitlement = info?.entitlements?.active?.[REVENUECAT_CONFIG.ENTITLEMENT_ID];
  if (!entitlement) return null;
  return { store: entitlement.store || null, productIdentifier: entitlement.productIdentifier || null,
    productPlanIdentifier: entitlement.productPlanIdentifier || null, willRenew: !!entitlement.willRenew,
    expirationDate: entitlement.expirationDate || null };
}

export interface PremiumPurchaseContext { ownPremium: boolean; householdPremium: boolean }

// PRORATION_MODE values (purchases-typescript-internal): numeric literals keep the
// lazy SDK import the only runtime dependency.
const PRORATION_IMMEDIATE_WITH_TIME_PRORATION = 1;
const PRORATION_DEFERRED = 6;

/**
 * Paid purchases only. Android selects the explicit paid option/base plan;
 * failed offers never fall back to a different price. Existing trial entitlements
 * remain valid; this policy only controls new purchase requests.
 *
 * A purchase that would duplicate an active Premium from another source (anacan.az /
 * promotional / household / the other platform's store) is refused. An Android user
 * with an active Play subscription changes plan through googleProductChangeInfo, so
 * Google replaces the old subscription instead of billing both.
 */
export async function purchasePackage(packageToPurchase: any, selection?: PaidPurchaseRequest, expectedUserId?: string,
  premium?: PremiumPurchaseContext): Promise<{
  success: boolean;
  customerInfo?: any;
  error?: PurchaseErrorCode;
}> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin() || !await currentAzureIdentity()) {
    return { success: false, error: 'BILLING_UNAVAILABLE' };
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    let customerInfo: any;
    if (expectedUserId && (await Purchases.getAppUserID()).appUserID !== expectedUserId) {
      return { success: false, error: 'REVENUECAT_ACCOUNT_MISMATCH' };
    }

    const platform = Capacitor.getPlatform();
    let current: StoreEntitlementInfo | null | undefined;
    try { current = activeStoreEntitlementFrom((await Purchases.getCustomerInfo())?.customerInfo); } catch { current = undefined; }
    const kind = premiumSourceKind({ platform: getPlatform(), ownPremium: !!premium?.ownPremium, householdPremium: !!premium?.householdPremium, storeEntitlement: current });
    const blocked = storePurchaseBlock(kind);
    if (blocked) return { success: false, error: blocked };

    const selectedOption = selection ? validatePaidPurchase(packageToPurchase, selection, platform) : null;
    if (platform === 'android' && Array.isArray(packageToPurchase?.product?.subscriptionOptions)) {
      const option = selectedOption ?? packageToPurchase.product.subscriptionOptions.find((item: any) => item.isBasePlan && !optionHasTrial(item));
      if (!option) return { success: false, error: 'PURCHASE_OPTION_UNAVAILABLE' };
      let googleProductChangeInfo: { oldProductIdentifier: string; prorationMode: number } | undefined;
      if (kind === 'store_same' && current?.productIdentifier) {
        const oldProduct = googleSubscriptionId(current.productIdentifier)!;
        const [newProduct, newBasePlan] = String(packageToPurchase.product.identifier || '').split(':');
        const oldBasePlan = current.productPlanIdentifier || current.productIdentifier.split(':')[1] || null;
        if (oldProduct === newProduct && (!newBasePlan || !oldBasePlan || oldBasePlan === newBasePlan)) {
          return { success: false, error: 'ALREADY_OWNED' };
        }
        const toAnnual = ['P1Y', 'P12M'].includes(isoPeriod(option?.fullPricePhase?.billingPeriod) || '');
        googleProductChangeInfo = { oldProductIdentifier: oldProduct, prorationMode: toAnnual ? PRORATION_IMMEDIATE_WITH_TIME_PRORATION : PRORATION_DEFERRED };
      }
      type ChangeInfo = NonNullable<Parameters<typeof Purchases.purchaseSubscriptionOption>[0]['googleProductChangeInfo']>;
      const result = await Purchases.purchaseSubscriptionOption(googleProductChangeInfo
        ? { subscriptionOption: option, googleProductChangeInfo: googleProductChangeInfo as unknown as ChangeInfo }
        : { subscriptionOption: option });
      customerInfo = result.customerInfo;
    } else {
      const intro = packageToPurchase?.product?.introPrice;
      if (platform === 'ios' && intro) {
        const eligibility = await getIntroEligibility([packageToPurchase.product.identifier]);
        const status = eligibility[packageToPurchase.product.identifier];
        const paidIntro = Number(intro.price) > 0;
        // A free trial is never started implicitly. A paid introductory price is
        // allowed when eligible, or when eligibility is unknown and the user was shown
        // both prices ("first year X, otherwise Y").
        const allowed = !paidIntro ? status === 1
          : selection?.paidIntro ? status === 2 || !!selection.introUncertain
          : status === 1 || !!selection?.introUncertain;
        if (!allowed) return { success: false, error: 'PURCHASE_OPTION_UNAVAILABLE' };
      }
      if (platform === 'android' && optionHasTrial(packageToPurchase?.product?.defaultOption)) return { success: false, error: 'PURCHASE_OPTION_UNAVAILABLE' };
      const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
      customerInfo = result.customerInfo;
    }

    const isPro = !!customerInfo?.entitlements?.active?.[REVENUECAT_CONFIG.ENTITLEMENT_ID];
    // A finished store call without the entitlement (deferred / Ask to Buy) is pending, not failed.
    return isPro ? { success: true, customerInfo } : { success: false, customerInfo, error: 'PURCHASE_PENDING' };
  } catch (err: any) {
    const code = classifyPurchaseError(err);
    if (code !== 'USER_CANCELLED' && code !== 'PURCHASE_PENDING') console.error('RevenueCat purchase error:', code, err?.code ?? '');
    return { success: false, error: code };
  }
}

/**
 * Restore purchases
 */
export type RestoreFailure = 'none' | 'network' | 'account' | 'error';
export async function restorePurchases(expectedUserId?: string): Promise<{
  success: boolean;
  customerInfo?: any;
  /** Why nothing was restored: nothing to restore vs. a network/store/account problem. */
  reason?: RestoreFailure;
}> {
  if (!REVENUECAT_ENABLED || !hasRevenueCatPlugin() || !await currentAzureIdentity()) return { success: false };

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    if (expectedUserId && (await Purchases.getAppUserID()).appUserID !== expectedUserId) return { success: false, reason: 'account' };
    const { customerInfo } = await Purchases.restorePurchases();
    const isPro = !!customerInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENT_ID];
    return isPro ? { success: true, customerInfo } : { success: false, customerInfo, reason: 'none' };
  } catch (err) {
    const code = classifyPurchaseError(err);
    console.error('RevenueCat restore error:', code);
    return { success: false, reason: code === 'STORE_NETWORK' ? 'network' : code === 'RECEIPT_IN_USE' || code === 'REVENUECAT_ACCOUNT_MISMATCH' ? 'account' : 'error' };
  }
}

/**
 * Present RevenueCat native paywall.
 * Returns { didPurchase: false, available: false } when the RevenueCat UI
 * plugin or a configured paywall is not available — caller should fall back
 * to the custom in-app modal UI.
 */
export async function presentPaywall(): Promise<{
  didPurchase: boolean;
  available: boolean;
}> {
  if (!canUseNativePaywallUI() || !await currentAzureIdentity()) {
    return { didPurchase: false, available: false };
  }

  try {
    const mod = await import('@revenuecat/purchases-capacitor-ui').catch(() => null);
    if (!mod || !mod.RevenueCatUI) {
      console.warn('[RevenueCat] UI plugin not available — falling back to custom paywall');
      return { didPurchase: false, available: false };
    }
    const { RevenueCatUI, PAYWALL_RESULT } = mod;
    const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
    console.log('[RevenueCat] presentPaywall result:', JSON.stringify(result));
    if (result?.result === PAYWALL_RESULT.NOT_PRESENTED) {
      // No paywall configured for the current offering — fall back to custom UI.
      return { didPurchase: false, available: false };
    }
    const didPurchase =
      result?.result === PAYWALL_RESULT.PURCHASED ||
      result?.result === PAYWALL_RESULT.RESTORED;
    return { didPurchase, available: true };
  } catch (err) {
    console.error('[RevenueCat] paywall error — falling back to custom UI:', err);
    return { didPurchase: false, available: false };
  }
}

/**
 * Present RevenueCat Customer Center
 */
export async function presentCustomerCenter(): Promise<boolean> {
  if (!canUseNativePaywallUI() || !await currentAzureIdentity()) return false;

  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui');
    await RevenueCatUI.presentCustomerCenter();
    return true;
  } catch (err) {
    console.error('RevenueCat Customer Center error:', err);
    return false;
  }
}

export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
export const ANDROID_PACKAGE = 'com.atlasoon.anacan';
/** Store subscription management page (cancel, resume, change plan) for the given store. */
export function storeSubscriptionsUrl(store: 'ios' | 'android', productIdentifier?: string | null): string {
  if (store === 'ios') return APPLE_SUBSCRIPTIONS_URL;
  const sku = googleSubscriptionId(productIdentifier);
  return sku
    ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=${ANDROID_PACKAGE}`
    : `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
}
export function openStoreSubscriptions(store: 'ios' | 'android', productIdentifier?: string | null): void {
  window.open(storeSubscriptionsUrl(store, productIdentifier), '_system');
}
