import { describe, expect, it, vi } from 'vitest';
// Deno edge helper without Deno globals at import time.
import { planFromProduct, recordPremiumPurchase, storeProvider, storePurchaseFact } from '../../supabase/functions/_shared/premium-purchases';

const NOW = Date.parse('2026-11-25T12:00:00Z');

describe('premium purchase facts (revenuecat-sync → premium_purchases)', () => {
  it('maps stores and plans', () => {
    expect(storeProvider('app_store', 'com.atlasoon.anacan.premium.yearly')).toBe('app_store');
    expect(storeProvider('play_store', 'com.atlasoon.anacan.premium.monthly:monthly-plan')).toBe('play_store');
    expect(storeProvider('promotional', 'rc_promo_Anacan LLC Pro_monthly')).toBe('promo');
    expect(storeProvider('stripe', 'x')).toBe('other');
    expect(planFromProduct('com.atlasoon.anacan.premium.yearly')).toBe('yearly');
    expect(planFromProduct('com.atlasoon.anacan.premium.monthly:monthly-plan')).toBe('monthly');
    expect(planFromProduct('rc_promo_Anacan LLC Pro_yearly')).toBe('yearly');
    expect(planFromProduct('anything', 'lifetime')).toBe('lifetime');
    expect(planFromProduct(null)).toBe('other');
  });

  it('logs a recent store purchase with its transaction id and price', () => {
    const fact = storePurchaseFact('com.atlasoon.anacan.premium.yearly', {
      store: 'play_store', purchase_date: '2026-11-25T11:00:00Z', original_purchase_date: '2026-11-25T11:00:00Z',
      store_transaction_id: 'GPA.3333-1111-2222-44444', period_type: 'normal', price: { amount: 29.99, currency: 'USD' },
    }, 'subscription', NOW);
    expect(fact).toEqual({ provider: 'play_store', productId: 'com.atlasoon.anacan.premium.yearly', plan: 'yearly', amount: 29.99, currency: 'USD',
      providerRef: 'rc:GPA.3333-1111-2222-44444', kind: 'initial', platform: null, purchasedAt: '2026-11-25T11:00:00.000Z' });
  });

  it('marks renewals, falls back to product + date without a transaction id, and skips old, trial and sandbox purchases', () => {
    const renewal = storePurchaseFact('com.atlasoon.anacan.premium.monthly', { store: 'app_store', purchase_date: '2026-11-24T08:00:00Z',
      original_purchase_date: '2026-08-24T08:00:00Z' }, 'subscription', NOW);
    expect(renewal?.kind).toBe('renewal');
    expect(renewal?.providerRef).toBe('rc:com.atlasoon.anacan.premium.monthly:2026-11-24T08:00:00.000Z');
    expect(renewal?.amount).toBeNull();
    expect(storePurchaseFact('p.yearly', { purchase_date: '2026-10-01T00:00:00Z' }, 'subscription', NOW)).toBeNull();
    expect(storePurchaseFact('p.yearly', { purchase_date: '2026-11-25T00:00:00Z', period_type: 'trial' }, 'subscription', NOW)).toBeNull();
    expect(storePurchaseFact('p.yearly', { purchase_date: '2026-11-25T00:00:00Z', is_sandbox: true }, 'subscription', NOW)).toBeNull();
    expect(storePurchaseFact(null, { purchase_date: '2026-11-25T00:00:00Z' }, 'subscription', NOW)).toBeNull();
    expect(storePurchaseFact('p.yearly', { purchase_date: '2026-11-25T00:00:00Z', store_transaction_id: 'bad id with spaces' }, 'subscription', NOW)?.providerRef)
      .toBe('rc:p.yearly:2026-11-25T00:00:00.000Z');
  });

  it('records through the service RPC and never throws', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { recorded: true }, error: null });
    await recordPremiumPurchase({ rpc }, 'u1', { provider: 'epoint', productId: 'epoint:monthly', plan: 'monthly', amount: 4.99, currency: 'AZN',
      providerRef: 'epoint:c1', kind: 'initial' });
    expect(rpc).toHaveBeenCalledWith('premium_purchase_record_v1', { p_user: 'u1', p_provider: 'epoint', p_product: 'epoint:monthly', p_plan: 'monthly',
      p_amount: 4.99, p_currency: 'AZN', p_provider_ref: 'epoint:c1', p_kind: 'initial', p_platform: null, p_purchased_at: null });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordPremiumPurchase({ rpc: vi.fn().mockRejectedValue(new Error('down')) }, 'u1', { provider: 'other', productId: null, plan: 'other',
      amount: null, currency: null, providerRef: 'x:1', kind: 'initial' })).resolves.toBeUndefined();
    error.mockRestore();
  });
});
