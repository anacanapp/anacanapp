import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
import { classifyPurchaseError, googleSubscriptionId, isPendingPurchase, premiumSourceKind, purchaseErrorMessage, storePurchaseBlock } from './purchase-errors';

describe('RevenueCat error classification', () => {
  it('reads string error codes (RC PURCHASES_ERROR_CODE)', () => {
    expect(classifyPurchaseError({ code: '1', message: 'Purchase was cancelled.' })).toBe('USER_CANCELLED');
    expect(classifyPurchaseError({ code: '20', message: 'The payment is pending.' })).toBe('PURCHASE_PENDING');
    expect(classifyPurchaseError({ code: '10' })).toBe('STORE_NETWORK');
    expect(classifyPurchaseError({ code: '35' })).toBe('STORE_NETWORK');
    expect(classifyPurchaseError({ code: '6' })).toBe('ALREADY_OWNED');
    expect(classifyPurchaseError({ code: '7' })).toBe('RECEIPT_IN_USE');
    expect(classifyPurchaseError({ code: '2' })).toBe('STORE_PROBLEM');
  });
  it('still accepts numeric codes and the userCancelled flag', () => {
    expect(classifyPurchaseError({ code: 1 })).toBe('USER_CANCELLED');
    expect(classifyPurchaseError({ code: 20 })).toBe('PURCHASE_PENDING');
    expect(classifyPurchaseError({ userCancelled: true, code: '0' })).toBe('USER_CANCELLED');
  });
  it('detects pending payments, not as failures', () => {
    expect(isPendingPurchase({ code: '20' })).toBe(true);
    expect(isPendingPurchase({ readableErrorCode: 'PAYMENT_PENDING' })).toBe(true);
    expect(isPendingPurchase({ code: '0' })).toBe(false);
  });
  it('maps internal validation errors thrown as Error(message)', () => {
    expect(classifyPurchaseError(new Error('PURCHASE_PRICE_CHANGED'))).toBe('PURCHASE_PRICE_CHANGED');
    expect(classifyPurchaseError(new Error('PURCHASE_OPTION_UNAVAILABLE'))).toBe('PURCHASE_OPTION_UNAVAILABLE');
    expect(classifyPurchaseError('REVENUECAT_ACCOUNT_MISMATCH')).toBe('REVENUECAT_ACCOUNT_MISMATCH');
    expect(classifyPurchaseError(new Error('Some English SDK message'))).toBe('UNKNOWN');
    expect(classifyPurchaseError(new Error('The Internet connection appears to be offline.'))).toBe('STORE_NETWORK');
  });
});

describe('localized purchase messages', () => {
  it.each(['REVENUECAT_ACCOUNT_MISMATCH', 'PURCHASE_OPTION_UNAVAILABLE', 'PURCHASE_PRICE_CHANGED', 'PURCHASE_PENDING', 'STORE_NETWORK',
    'PREMIUM_SOURCE_NON_STORE', 'PREMIUM_SOURCE_HOUSEHOLD', 'PREMIUM_MANAGED_ELSEWHERE', 'UNKNOWN', 'Purchase failed', null])('never shows the raw code %s', code => {
    const text = purchaseErrorMessage(code as string | null);
    expect(text).toBeTruthy();
    if (code) expect(text).not.toContain(code);
    expect(text).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    expect(text).not.toContain('—');
  });
});

describe('store purchase guard', () => {
  const base = { ownPremium: false, householdPremium: false, storeEntitlement: null };
  it('allows a first purchase and a same-store plan change', () => {
    expect(premiumSourceKind({ ...base, platform: 'android' })).toBe('none');
    expect(premiumSourceKind({ ...base, platform: 'android', ownPremium: true, storeEntitlement: { store: 'PLAY_STORE', productIdentifier: 'monthly' } })).toBe('store_same');
    expect(premiumSourceKind({ ...base, platform: 'ios', ownPremium: true, storeEntitlement: { store: 'APP_STORE', productIdentifier: 'monthly' } })).toBe('store_same');
    expect(storePurchaseBlock('none')).toBeNull(); expect(storePurchaseBlock('store_same')).toBeNull();
  });
  it('blocks web/promo, household and the other platform store', () => {
    expect(storePurchaseBlock(premiumSourceKind({ ...base, platform: 'ios', ownPremium: true }))).toBe('PREMIUM_SOURCE_NON_STORE');
    expect(storePurchaseBlock(premiumSourceKind({ ...base, platform: 'ios', ownPremium: true, storeEntitlement: { store: 'PROMOTIONAL', productIdentifier: 'rc_promo_x' } }))).toBe('PREMIUM_SOURCE_NON_STORE');
    expect(storePurchaseBlock(premiumSourceKind({ ...base, platform: 'android', householdPremium: true }))).toBe('PREMIUM_SOURCE_HOUSEHOLD');
    expect(storePurchaseBlock(premiumSourceKind({ ...base, platform: 'android', ownPremium: true, storeEntitlement: { store: 'APP_STORE', productIdentifier: 'y' } }))).toBe('PREMIUM_MANAGED_ELSEWHERE');
  });
  it('strips the Google base plan from product identifiers', () => {
    expect(googleSubscriptionId('com.atlasoon.anacan.premium.monthly:monthly-plan')).toBe('com.atlasoon.anacan.premium.monthly');
    expect(googleSubscriptionId(null)).toBeNull();
  });
});
