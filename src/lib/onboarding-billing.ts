/** Actual store prices and eligibility drive the offer. The reference amounts
 * are a configuration contract, never a fallback charge or entitlement grant. */
// Retained identifier for existing receipts/configurations; it is no longer the
// exit offer. The current exit offer is the normal paid monthly package.
export const ONBOARDING_OFFERING = 'onboarding_last_chance_2026';
export const ONBOARDING_OFFER_PRODUCT = 'com.atlasoon.anacan.premium.yearly.onboarding';
export const ONBOARDING_ANNUAL_PRODUCT = 'com.atlasoon.anacan.premium.yearly';
export const ONBOARDING_OFFER_OPTION = 'yearly-plan:onboarding-first-year';
export const ONBOARDING_USD_PRICES = { annual: 29.99, firstYear: 19.99 } as const;

export interface PaidPurchaseRequest {
  productId: string;
  optionId?: string;
  price: number;
  currency: string;
  paidIntro?: boolean;
}
export interface StorePlan {
  pkg: any;
  price: number;
  priceString: string;
  currency: string;
  renewalPrice: number;
  renewalPriceString: string;
  kind: 'yearly' | 'monthly';
  request: PaidPurchaseRequest;
}
export const isoPeriod = (period: any): string | null => typeof period === 'string' ? period : period?.iso8601 || null;
const annual = (period: any) => ['P1Y', 'P12M'].includes(isoPeriod(period) || '');
const validMoney = (price: number, text: unknown, currency: unknown) => Number.isFinite(price) && price > 0
  && typeof text === 'string' && text.trim().length > 0 && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency);
const phaseMoney = (phase: any) => ({ price: Number(phase?.price?.amountMicros) / 1e6,
  priceString: phase?.price?.formatted || '', currency: phase?.price?.currencyCode || '' });
export const optionHasTrial = (option: any): boolean => !!option?.freePhase || (option?.pricingPhases || []).some((phase: any) => Number(phase?.price?.amountMicros) === 0);

export function standardStorePlan(pkg: any, platform: 'ios' | 'android' | 'web', kind: 'yearly' | 'monthly', eligibility?: number): StorePlan | null {
  const raw = pkg?._raw ?? pkg, product = raw?.product;
  if (!product?.identifier || platform === 'web') return null;
  const expectedPeriod = (period: any) => kind === 'yearly' ? annual(period) : isoPeriod(period) === 'P1M';
  let money = { price: Number(product.price), priceString: product.priceString || '', currency: product.currencyCode || '' };
  let optionId: string | undefined;
  if (platform === 'android') {
    const base = product.subscriptionOptions?.find((option: any) => option.isBasePlan && !option.isPrepaid && !option.installmentsInfo
      && !optionHasTrial(option) && option.pricingPhases?.length === 1 && expectedPeriod(option.fullPricePhase?.billingPeriod)
      && option.fullPricePhase?.recurrenceMode === 1);
    if (!base?.id) return null;
    money = phaseMoney(base.fullPricePhase); optionId = base.id;
  } else {
    if (!expectedPeriod(product.subscriptionPeriod)) return null;
    // StoreKit auto-applies eligible introductory offers. Never display the
    // regular price while an automatic intro price/trial could be charged.
    if (product.introPrice && eligibility !== 1) return null;
  }
  if (!validMoney(money.price, money.priceString, money.currency)) return null;
  return { pkg, ...money, renewalPrice: money.price, renewalPriceString: money.priceString, kind,
    request: { productId: product.identifier, optionId, price: money.price, currency: money.currency } };
}

export function annualStorePlan(pkg: any, platform: 'ios' | 'android' | 'web', eligibility?: number): StorePlan | null {
  const standard = standardStorePlan(pkg, platform, 'yearly', eligibility);
  if (platform === 'web') return null;
  const raw = pkg?._raw ?? pkg, product = raw?.product;
  if (product?.identifier?.split(':')[0] !== ONBOARDING_ANNUAL_PRODUCT) return standard;
  let first: { price: number; priceString: string; currency: string };
  let renewal: typeof first;
  let optionId: string | undefined;
  if (platform === 'android') {
    const option = product.subscriptionOptions?.find((item: any) => item.id === ONBOARDING_OFFER_OPTION);
    if (!standard || !option || option.isBasePlan || option.isPrepaid || option.installmentsInfo || optionHasTrial(option) || option.pricingPhases?.length !== 2) return standard;
    const [intro, full] = option.pricingPhases;
    const oneCharge = intro.recurrenceMode === 2 && intro.billingCycleCount === 1
      || intro.recurrenceMode === 3 && [null, undefined, 0, 1].includes(intro.billingCycleCount);
    if (!annual(intro.billingPeriod) || !annual(full.billingPeriod) || !oneCharge || full.recurrenceMode !== 1) return standard;
    first = phaseMoney(intro); renewal = phaseMoney(full); optionId = option.id;
  } else {
    const intro = product.introPrice;
    if (eligibility !== 2 || !annual(product.subscriptionPeriod) || !annual(intro?.period) || intro?.cycles !== 1) return standard;
    first = { price: Number(intro.price), priceString: intro.priceString || '', currency: product.currencyCode || '' };
    renewal = { price: Number(product.price), priceString: product.priceString || '', currency: product.currencyCode || '' };
  }
  if (!validMoney(first.price, first.priceString, first.currency) || !validMoney(renewal.price, renewal.priceString, renewal.currency)
    || first.currency !== renewal.currency || first.price >= renewal.price
    || standard && (standard.currency !== renewal.currency || Math.abs(renewal.price - standard.price) > 0.000001)) return standard;
  if (first.currency === 'USD' && (Math.abs(renewal.price - ONBOARDING_USD_PRICES.annual) > .000001
    || Math.abs(first.price - ONBOARDING_USD_PRICES.firstYear) > .000001)) return standard;
  return { pkg, ...first, kind: 'yearly', renewalPrice: renewal.price, renewalPriceString: renewal.priceString,
    request: { productId: product.identifier, optionId, price: first.price, currency: first.currency, paidIntro: platform === 'ios' } };
}

/** Validate the choice immediately before handing it to the native store. No
 * fallback to another package/price when an offer is unavailable or rejected. */
export function validatePaidPurchase(raw: any, request: PaidPurchaseRequest, platform: string): any | null {
  if (raw?.product?.identifier !== request.productId || !Number.isFinite(request.price) || request.price <= 0) throw new Error('PURCHASE_PRICE_CHANGED');
  if (platform === 'android') {
    const option = raw.product.subscriptionOptions?.find((item: any) => item.id === request.optionId);
    if (!option || optionHasTrial(option)) throw new Error('PURCHASE_OPTION_UNAVAILABLE');
    const money = phaseMoney(option.pricingPhases?.[0]);
    if (money.currency !== request.currency || Math.abs(money.price - request.price) > .000001) throw new Error('PURCHASE_PRICE_CHANGED');
    return option;
  }
  const value = request.paidIntro ? raw.product.introPrice : raw.product;
  if (!value || raw.product.currencyCode !== request.currency || Math.abs(Number(value.price) - request.price) > .000001) throw new Error('PURCHASE_PRICE_CHANGED');
  return null;
}
