import { describe, expect, it } from 'vitest';
import { computeAptekTotals, couponProblem, isAptekAvailable, parseAptekConfig, type AptekCoupon } from './aptek-pricing';

const config = parseAptekConfig({
  enabled: true, countries: ['AZ'], free_shipping_min: 30, shipping_fee: 3, bundle_discount_pct: 10,
  bundles: [{ id: 'newborn', skus: ['a', 'b', 'c'] }],
});
const coupon: AptekCoupon = {
  code: 'ANACAN10', discount_type: 'percentage', discount_value: 10, applicable_to: ['aptek'], is_active: true,
  starts_at: null, expires_at: null, max_uses: null, used_count: 0, min_order_amount: null,
};

describe('computeAptekTotals', () => {
  it('matches the server for a complete set, extra items and a percentage coupon', () => {
    // Same basket as the PGlite run of place_aptek_order: 7.5 + 17.8 + 4.6 set, 3 × 6.6 spoons.
    const t = computeAptekTotals([
      { sku: 'a', price: 7.5, quantity: 1 }, { sku: 'b', price: 17.8, quantity: 1 }, { sku: 'c', price: 4.6, quantity: 1 },
      { sku: 'x', price: 6.6, quantity: 3 },
    ], config, coupon);
    expect(t.subtotal).toBe(49.7);
    expect(t.bundleDiscount).toBe(2.99);
    expect(t.couponDiscount).toBe(4.67);
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(42.04);
    expect(t.completeBundles).toEqual(['newborn']);
  });

  it('charges delivery below the free threshold and reports the gap', () => {
    const t = computeAptekTotals([{ sku: 'x', price: 6.6, quantity: 1 }], config);
    expect(t.shipping).toBe(3);
    expect(t.total).toBe(9.6);
    expect(t.toFreeShipping).toBe(23.4);
  });

  it('gives no set discount for an incomplete set and nothing for an empty cart', () => {
    expect(computeAptekTotals([{ sku: 'a', price: 10, quantity: 2 }], config).bundleDiscount).toBe(0);
    expect(computeAptekTotals([], config)).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });

  it('caps a fixed coupon at the discounted subtotal', () => {
    const t = computeAptekTotals([{ sku: 'x', price: 5, quantity: 1 }], config, { ...coupon, discount_type: 'fixed', discount_value: 50 });
    expect(t.couponDiscount).toBe(5);
    expect(t.total).toBe(3);
  });
});

describe('couponProblem', () => {
  it('accepts an aptek coupon and rejects others the way the server does', () => {
    expect(couponProblem(coupon, 10)).toBeNull();
    expect(couponProblem({ ...coupon, applicable_to: ['shop'] }, 10)).toBe('coupon_invalid');
    expect(couponProblem({ ...coupon, is_active: false }, 10)).toBe('coupon_invalid');
    expect(couponProblem({ ...coupon, expires_at: '2020-01-01T00:00:00Z' }, 10)).toBe('coupon_expired');
    expect(couponProblem({ ...coupon, max_uses: 1, used_count: 1 }, 10)).toBe('coupon_used_up');
    expect(couponProblem({ ...coupon, min_order_amount: 20 }, 10)).toBe('coupon_min_order');
    expect(couponProblem(null, 10)).toBe('coupon_invalid');
  });
});

describe('parseAptekConfig / isAptekAvailable', () => {
  it('unwraps a JSON-encoded value and falls back to safe defaults', () => {
    expect(parseAptekConfig(JSON.stringify({ enabled: true })).enabled).toBe(true);
    const d = parseAptekConfig(null);
    expect(d.enabled).toBe(false);
    expect(d.free_shipping_min).toBe(30);
    expect(parseAptekConfig({ bundle_discount_pct: 90 }).bundle_discount_pct).toBe(50);
  });

  it('shows the store only in its countries when enabled, and always to admins', () => {
    expect(isAptekAvailable(config, 'az')).toBe(true);
    expect(isAptekAvailable(config, 'TR')).toBe(false);
    expect(isAptekAvailable({ ...config, enabled: false }, 'AZ')).toBe(false);
    expect(isAptekAvailable({ ...config, enabled: false }, 'TR', true)).toBe(true);
    expect(isAptekAvailable(undefined, 'AZ')).toBe(false);
  });
});
