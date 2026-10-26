import { describe, expect, it } from 'vitest';
import { ONBOARDING_OFFER_OPTION, annualStorePlan, standardStorePlan, validatePaidPurchase } from './onboarding-billing';

export function iosPackages() {
  const product = { identifier: 'com.atlasoon.anacan.premium.yearly', price: 29.99, priceString: '$29.99', currencyCode: 'USD', subscriptionPeriod: 'P1Y', introPrice: null };
  const normal = { identifier: '$rc_annual', packageType: 'ANNUAL', product };
  const offer = { ...normal, product: { ...product,
    introPrice: { price: 19.99, priceString: '$19.99', period: 'P1Y', cycles: 1 } } };
  return { normal, offer };
}
function phase(amount: number, recurrenceMode: number, cycles: number | null = null) {
  return { billingPeriod: { iso8601: 'P1Y' }, recurrenceMode, billingCycleCount: cycles,
    price: { amountMicros: Math.round(amount * 1e6), formatted: `$${amount.toFixed(2)}`, currencyCode: 'USD' } };
}
export function androidPackages() {
  const { normal, offer } = iosPackages();
  const full = phase(29.99, 1), intro = phase(19.99, 2, 1);
  const base = { id: 'yearly-plan', isBasePlan: true, fullPricePhase: full, pricingPhases: [full] };
  return {
    normal: { ...normal, product: { ...normal.product, identifier: `${normal.product.identifier}:yearly-plan`, subscriptionOptions: [base] } },
    offer: { ...offer, product: { ...offer.product, identifier: `${offer.product.identifier}:yearly-plan`, subscriptionOptions: [base,
      { id: ONBOARDING_OFFER_OPTION, isBasePlan: false, fullPricePhase: full, introPhase: intro, pricingPhases: [intro, full] }] } },
  };
}
describe('paid annual store contract', () => {
  it.each(['ios', 'android'] as const)('%s purchases the exact 19.99 first year with 29.99 renewal', platform => {
    const { normal, offer } = platform === 'ios' ? iosPackages() : androidPackages();
    const standard = standardStorePlan(normal, platform, 'yearly');
    const plan = annualStorePlan(offer, platform, 2);
    expect(standard?.price).toBe(29.99);
    expect(plan).toMatchObject({ price: 19.99, renewalPrice: 29.99, currency: 'USD', priceString: '$19.99' });
    expect(() => validatePaidPurchase(offer, plan!.request, platform)).not.toThrow();
    expect(() => validatePaidPurchase(normal, plan!.request, platform)).toThrow();
  });
  it('does not invent prices or eligibility and never advertises an automatic free trial', () => {
    const { normal, offer } = iosPackages();
    const standard = standardStorePlan(normal, 'ios', 'yearly');
    for (const eligibility of [undefined, 0, 3]) expect(annualStorePlan(offer, 'ios', eligibility)).toBeNull();
    expect(annualStorePlan(offer, 'ios', 1)?.price).toBe(29.99);
    expect(standardStorePlan(undefined, 'ios', 'yearly')).toBeNull();
    expect(standardStorePlan(normal, 'web', 'yearly')).toBeNull();
    const trial = { ...normal, product: { ...normal.product, introPrice: { price: 0, period: 'P3D' } } };
    expect(standardStorePlan(trial, 'ios', 'yearly', 2)).toBeNull();
    expect(standardStorePlan(trial, 'ios', 'yearly', 1)?.price).toBe(29.99);
  });
  it('rejects incompatible renewal, duration and live USD configuration', () => {
    const { normal, offer } = iosPackages();
    const standard = standardStorePlan(normal, 'ios', 'yearly');
    for (const product of [
      { ...offer.product, price: 39.99 },
      { ...offer.product, introPrice: { ...offer.product.introPrice, cycles: 2 } },
      { ...offer.product, introPrice: { ...offer.product.introPrice, period: 'P1M' } },
      { ...offer.product, introPrice: { ...offer.product.introPrice, price: 9.99 } },
    ]) expect(annualStorePlan({ ...offer, product }, 'ios', 2)).toBeNull();
  });
  it('uses localized store prices for non-USD storefronts', () => {
    const { normal, offer } = iosPackages();
    normal.product.currencyCode = 'EUR'; normal.product.price = 22.99; normal.product.priceString = '22,99 €';
    offer.product.currencyCode = 'EUR'; offer.product.price = 22.99; offer.product.priceString = '22,99 €';
    offer.product.introPrice.price = 16.99; offer.product.introPrice.priceString = '16,99 €';
    expect(annualStorePlan(offer, 'ios', 2)).toMatchObject({ priceString: '16,99 €', renewalPriceString: '22,99 €' });
  });
  it('rejects a Google offer containing any free phase and a replaced price', () => {
    const { normal, offer } = androidPackages();
    const standard = standardStorePlan(normal, 'android', 'yearly');
    const selected = annualStorePlan(offer, 'android')!;
    (offer.product.subscriptionOptions[1] as any).freePhase = phase(0, 2, 1);
    expect(annualStorePlan(offer, 'android')?.price).toBe(29.99);
    expect(() => validatePaidPurchase(offer, selected.request, 'android')).toThrow('PURCHASE_OPTION_UNAVAILABLE');
    delete (offer.product.subscriptionOptions[1] as any).freePhase;
    offer.product.subscriptionOptions[1].pricingPhases[0].price.amountMicros = 29990000;
    expect(() => validatePaidPurchase(offer, selected.request, 'android')).toThrow('PURCHASE_PRICE_CHANGED');
  });
  it('accepts Google single-payment annual intro phases with no recurring cycle count', () => {
    const { normal, offer } = androidPackages();
    const intro = offer.product.subscriptionOptions[1].pricingPhases[0];
    intro.recurrenceMode = 3; intro.billingCycleCount = null;
    expect(annualStorePlan(offer, 'android')).toMatchObject({ price: 19.99, renewalPrice: 29.99 });
  });
});
