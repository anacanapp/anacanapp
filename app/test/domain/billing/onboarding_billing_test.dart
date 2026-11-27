// Ported from: src/lib/onboarding-billing.test.ts

import 'package:anacan/domain/billing/onboarding_billing.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> iosProduct() => {
      'identifier': 'com.atlasoon.anacan.premium.yearly', 'price': 29.99, 'priceString': r'$29.99', 'currencyCode': 'USD',
      'subscriptionPeriod': 'P1Y', 'introPrice': null,
    };
({Map<String, Object?> normal, Map<String, Object?> offer}) iosPackages() {
  final normal = {'identifier': r'$rc_annual', 'packageType': 'ANNUAL', 'product': iosProduct()};
  final offer = {
    ...normal,
    'product': {...iosProduct(), 'introPrice': {'price': 19.99, 'priceString': r'$19.99', 'period': 'P1Y', 'cycles': 1}},
  };
  return (normal: normal, offer: offer);
}

Map<String, Object?> phase(double amount, int recurrenceMode, [int? cycles]) => {
      'billingPeriod': {'iso8601': 'P1Y'}, 'recurrenceMode': recurrenceMode, 'billingCycleCount': cycles,
      'price': {'amountMicros': (amount * 1e6).round(), 'formatted': '\$${amount.toStringAsFixed(2)}', 'currencyCode': 'USD'},
    };

({Map<String, Object?> normal, Map<String, Object?> offer}) androidPackages() {
  final ios = iosPackages();
  final full = phase(29.99, 1), intro = phase(19.99, 2, 1);
  final base = {'id': 'yearly-plan', 'isBasePlan': true, 'fullPricePhase': full, 'pricingPhases': [full]};
  final np = ios.normal['product']! as Map<String, Object?>, op = ios.offer['product']! as Map<String, Object?>;
  return (
    normal: {...ios.normal, 'product': {...np, 'identifier': '${np['identifier']}:yearly-plan', 'subscriptionOptions': [base]}},
    offer: {
      ...ios.offer,
      'product': {
        ...op,
        'identifier': '${op['identifier']}:yearly-plan',
        'subscriptionOptions': [
          base,
          {'id': onboardingOfferOption, 'isBasePlan': false, 'fullPricePhase': full, 'introPhase': intro, 'pricingPhases': [intro, full]},
        ],
      },
    },
  );
}

Map<String, Object?> prod(Map<String, Object?> pkg) => pkg['product']! as Map<String, Object?>;
Map<String, Object?> intro(Map<String, Object?> pkg) => prod(pkg)['introPrice']! as Map<String, Object?>;
List options(Map<String, Object?> pkg) => prod(pkg)['subscriptionOptions']! as List;

void main() {
  group('paid annual store contract', () {
    for (final platform in ['ios', 'android']) {
      test('$platform purchases the exact 19.99 first year with 29.99 renewal', () {
        final pk = platform == 'ios' ? iosPackages() : androidPackages();
        final standard = standardStorePlan(pk.normal, platform, 'yearly');
        final plan = annualStorePlan(pk.offer, platform, 2)!;
        expect(standard?.price, 29.99);
        expect([plan.price, plan.renewalPrice, plan.currency, plan.priceString], [19.99, 29.99, 'USD', r'$19.99']);
        expect(() => validatePaidPurchase(pk.offer, plan.request, platform), returnsNormally);
        expect(() => validatePaidPurchase(pk.normal, plan.request, platform), throwsA(isA<PurchaseError>()));
      });
    }

    test('does not invent prices or eligibility and never advertises an automatic free trial', () {
      final pk = iosPackages();
      for (final e in [null, 0, 3]) {
        final plan = annualStorePlan(pk.offer, 'ios', e)!;
        expect([plan.price, plan.renewalPrice, plan.introUncertain, plan.request.price, plan.request.introUncertain], [19.99, 29.99, true, 29.99, true]);
      }
      expect(annualStorePlan(pk.offer, 'ios', 1)?.price, 29.99);
      expect(standardStorePlan(null, 'ios', 'yearly'), isNull);
      expect(standardStorePlan(pk.normal, 'web', 'yearly'), isNull);
      final trial = {...pk.normal, 'product': {...prod(pk.normal), 'introPrice': {'price': 0, 'period': 'P3D'}}};
      expect(standardStorePlan(trial, 'ios', 'yearly', 2), isNull);
      expect(standardStorePlan(trial, 'ios', 'yearly', 1)?.price, 29.99);
    });

    test('rejects incompatible duration configuration', () {
      final pk = iosPackages();
      for (final product in [
        {...prod(pk.offer), 'introPrice': {...intro(pk.offer), 'cycles': 2}},
        {...prod(pk.offer), 'introPrice': {...intro(pk.offer), 'period': 'P1M'}},
      ]) {
        expect(annualStorePlan({...pk.offer, 'product': product}, 'ios', 2), isNull);
      }
    });

    test('shows any store first-year price below the renewal (one-day 11.11 offer) on iOS and Android', () {
      final offer = iosPackages().offer;
      prod(offer)['introPrice'] = {...intro(offer), 'price': 11.11, 'priceString': r'$11.11'};
      final p = annualStorePlan(offer, 'ios', 2)!;
      expect([p.price, p.priceString, p.renewalPrice, p.request.price, p.request.paidIntro], [11.11, r'$11.11', 29.99, 11.11, true]);
      prod(offer)['introPrice'] = {...intro(offer), 'price': 29.99, 'priceString': r'$29.99'};
      expect(annualStorePlan(offer, 'ios', 2)?.request, isNull);
      final android = androidPackages().offer;
      final option = options(android)[1] as Map<String, Object?>;
      option['pricingPhases'] = [phase(11.11, 2, 1), (option['pricingPhases']! as List)[1]];
      final a = annualStorePlan(android, 'android')!;
      expect([a.price, a.renewalPrice, a.request.price, a.request.optionId], [11.11, 29.99, 11.11, onboardingOfferOption]);
    });

    test('uses localized store prices for non-USD storefronts', () {
      final pk = iosPackages();
      for (final p in [prod(pk.normal), prod(pk.offer)]) {
        p['currencyCode'] = 'EUR';
        p['price'] = 22.99;
        p['priceString'] = '22,99 €';
      }
      intro(pk.offer)['price'] = 16.99;
      intro(pk.offer)['priceString'] = '16,99 €';
      final plan = annualStorePlan(pk.offer, 'ios', 2)!;
      expect([plan.priceString, plan.renewalPriceString], ['16,99 €', '22,99 €']);
    });

    test('rejects a Google offer containing any free phase and a replaced price', () {
      final pk = androidPackages();
      final selected = annualStorePlan(pk.offer, 'android')!;
      final option = options(pk.offer)[1] as Map<String, Object?>;
      option['freePhase'] = phase(0, 2, 1);
      expect(annualStorePlan(pk.offer, 'android')?.price, 29.99);
      expect(() => validatePaidPurchase(pk.offer, selected.request, 'android'),
          throwsA(isA<PurchaseError>().having((e) => e.message, 'message', 'PURCHASE_OPTION_UNAVAILABLE')));
      option.remove('freePhase');
      (((option['pricingPhases']! as List)[0] as Map)['price'] as Map)['amountMicros'] = 29990000;
      expect(() => validatePaidPurchase(pk.offer, selected.request, 'android'),
          throwsA(isA<PurchaseError>().having((e) => e.message, 'message', 'PURCHASE_PRICE_CHANGED')));
    });

    test('accepts Google single-payment annual intro phases with no recurring cycle count', () {
      final pk = androidPackages();
      final introPhase = ((options(pk.offer)[1] as Map)['pricingPhases'] as List)[0] as Map;
      introPhase['recurrenceMode'] = 3;
      introPhase['billingCycleCount'] = null;
      final p = annualStorePlan(pk.offer, 'android')!;
      expect([p.price, p.renewalPrice], [19.99, 29.99]);
    });
  });

  group('unknown iOS intro eligibility', () {
    test('keeps the default yearly plan available and its request valid at the regular price', () {
      final offer = iosPackages().offer;
      final plan = annualStorePlan(offer, 'ios', null)!;
      expect([plan.kind, plan.priceString, plan.renewalPriceString, plan.introUncertain], ['yearly', r'$19.99', r'$29.99', true]);
      expect(plan.request.paidIntro, isNull);
      expect(() => validatePaidPurchase(offer, plan.request, 'ios'), returnsNormally);
    });
    test('known eligibility keeps the exact contract', () {
      final offer = iosPackages().offer;
      expect(annualStorePlan(offer, 'ios', 2)?.introUncertain, isNull);
      final p = annualStorePlan(offer, 'ios', 1)!;
      expect([p.price, p.renewalPrice], [29.99, 29.99]);
      expect(p.introUncertain, isNull);
    });
    test('never makes an unknown free trial or a non-annual intro buyable', () {
      final normal = iosPackages().normal;
      final trial = {...normal, 'product': {...prod(normal), 'introPrice': {'price': 0, 'priceString': r'$0.00', 'period': 'P1Y', 'cycles': 1}}};
      for (final e in [null, 0, 3]) {
        expect(standardStorePlan(trial, 'ios', 'yearly', e), isNull);
      }
      final monthly = {
        ...normal,
        'product': {...prod(normal), 'subscriptionPeriod': 'P1M', 'introPrice': {'price': 1.99, 'priceString': r'$1.99', 'period': 'P1M', 'cycles': 1}},
      };
      expect(standardStorePlan(monthly, 'ios', 'monthly', null), isNull);
      final higher = {...normal, 'product': {...prod(normal), 'introPrice': {'price': 39.99, 'priceString': r'$39.99', 'period': 'P1Y', 'cycles': 1}}};
      expect(standardStorePlan(higher, 'ios', 'yearly', 0), isNull);
    });
  });
}
