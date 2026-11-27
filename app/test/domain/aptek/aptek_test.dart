// Ported from: src/lib/aptek-pricing.test.ts, src/lib/aptek-offers.test.ts

import 'package:anacan/domain/aptek/aptek_offers.dart';
import 'package:anacan/domain/aptek/aptek_pricing.dart';
import 'package:flutter_test/flutter_test.dart';

final config = parseAptekConfig({
  'enabled': true, 'countries': ['AZ'], 'free_shipping_min': 30, 'shipping_fee': 3, 'bundle_discount_pct': 10,
  'bundles': [
    {'id': 'newborn', 'skus': ['a', 'b', 'c']},
  ],
});
const coupon = AptekCoupon(
  code: 'ANACAN10', discountType: 'percentage', discountValue: 10, applicableTo: ['aptek'], isActive: true,
  startsAt: null, expiresAt: null, maxUses: null, usedCount: 0, minOrderAmount: null,
);

OfferProduct p(String id, {String? kind = 'bottles', num? minAge, List<String> tags = const [], num sales = 0, num price = 10}) =>
    OfferProduct(id: id, sku: id, kind: kind, minAgeMonths: minAge, tags: tags, salesCount: sales, price: price);

final catalogue = [
  p('anti0', tags: ['anti_colic'], minAge: 0, sales: 5),
  p('anti3', tags: ['anti_colic'], minAge: 3),
  p('bottle12', minAge: 12),
  p('formula', kind: 'food', tags: ['infant_formula'], minAge: 0),
  p('54692', kind: 'appliances'),
  p('bowl', kind: 'bowls', minAge: 6),
  p('spoon', kind: 'cutlery', minAge: 6),
  p('cup9', kind: 'cups', minAge: 9),
  p('cup12', kind: 'cups', minAge: 12),
];
const Map<String, Object?> on = {};

void main() {
  group('computeAptekTotals', () {
    test('matches the server for a complete set, extra items and a percentage coupon', () {
      final t = computeAptekTotals(const [
        PriceLine(sku: 'a', price: 7.5, quantity: 1), PriceLine(sku: 'b', price: 17.8, quantity: 1), PriceLine(sku: 'c', price: 4.6, quantity: 1),
        PriceLine(sku: 'x', price: 6.6, quantity: 3),
      ], config, coupon);
      expect(t.subtotal, 49.7);
      expect(t.bundleDiscount, 2.99);
      expect(t.couponDiscount, 4.67);
      expect(t.shipping, 0);
      expect(t.total, 42.04);
      expect(t.completeBundles, ['newborn']);
    });
    test('charges delivery below the free threshold and reports the gap', () {
      final t = computeAptekTotals(const [PriceLine(sku: 'x', price: 6.6, quantity: 1)], config);
      expect(t.shipping, 3);
      expect(t.total, 9.6);
      expect(t.toFreeShipping, 23.4);
    });
    test('gives no set discount for an incomplete set and nothing for an empty cart', () {
      expect(computeAptekTotals(const [PriceLine(sku: 'a', price: 10, quantity: 2)], config).bundleDiscount, 0);
      final e = computeAptekTotals(const [], config);
      expect([e.subtotal, e.shipping, e.total], [0, 0, 0]);
    });
    test('caps a fixed coupon at the discounted subtotal', () {
      final t = computeAptekTotals(const [PriceLine(sku: 'x', price: 5, quantity: 1)], config, coupon.copyWith(discountType: 'fixed', discountValue: 50));
      expect(t.couponDiscount, 5);
      expect(t.total, 3);
    });
  });

  group('couponProblem', () {
    test('accepts an aptek coupon and rejects others the way the server does', () {
      expect(couponProblem(coupon, 10), isNull);
      expect(couponProblem(coupon.copyWith(applicableTo: ['shop']), 10), 'coupon_invalid');
      expect(couponProblem(coupon.copyWith(isActive: false), 10), 'coupon_invalid');
      expect(couponProblem(coupon.copyWith(expiresAt: '2020-01-01T00:00:00Z'), 10), 'coupon_expired');
      expect(couponProblem(coupon.copyWith(maxUses: 1, usedCount: 1), 10), 'coupon_used_up');
      expect(couponProblem(coupon.copyWith(minOrderAmount: 20), 10), 'coupon_min_order');
      expect(couponProblem(null, 10), 'coupon_invalid');
    });
  });

  group('parseAptekConfig / isAptekAvailable', () {
    test('unwraps a JSON-encoded value and falls back to safe defaults', () {
      expect(parseAptekConfig('{"enabled":true}').enabled, true);
      final d = parseAptekConfig(null);
      expect(d.enabled, false);
      expect(d.freeShippingMin, 30);
      expect(parseAptekConfig({'bundle_discount_pct': 90}).bundleDiscountPct, 50);
    });
    test('shows the store only in its countries when enabled, and always to admins', () {
      expect(isAptekAvailable(config, 'az'), true);
      expect(isAptekAvailable(config, 'TR'), false);
      expect(isAptekAvailable(config.copyWith(enabled: false), 'AZ'), false);
      expect(isAptekAvailable(config.copyWith(enabled: false), 'TR', true), true);
      expect(isAptekAvailable(null, 'AZ'), false);
    });
  });

  group('offerProducts', () {
    test('never offers infant formula in any context', () {
      for (final ctx in offerRules.keys) {
        expect(offerProducts(ctx, catalogue, on, 0).map((x) => x.id), isNot(contains('formula')));
      }
    });
    test('respects the per-placement switch and a missing config', () {
      expect(offerProducts('colic', catalogue, {'colic': false}), isEmpty);
      expect(offerProducts('colic', catalogue, null), isEmpty);
    });
    test('filters by age: feeding bottles fit the baby, cups allow a 3-month look-ahead', () {
      expect(offerProducts('feed', catalogue, on, 2).map((x) => x.id), ['anti0', 'anti3', '54692']);
      expect(offerProducts('cups', catalogue, on, 6).map((x) => x.id), ['cup9']);
    });
    test('colic picks anti-colic products youngest first', () {
      expect(offerProducts('colic', catalogue, on).map((x) => x.id), ['anti0', 'anti3']);
    });
  });

  group('homeOfferContext', () {
    test('maps stage and baby age to a context', () {
      expect(homeOfferContext('bump', null), 'newborn');
      expect(homeOfferContext('mommy', 1), 'colic');
      expect(homeOfferContext('mommy', 5), 'feed');
      expect(homeOfferContext('mommy', 7), 'weaning');
      expect(homeOfferContext('mommy', 11), 'cups');
      expect(homeOfferContext('flow', null), isNull);
    });
  });
}
