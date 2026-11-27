// Ported from: src/lib/onboarding-billing.ts
//
// Actual store prices and eligibility drive the offer; the reference amounts are a configuration contract, never
// a fallback charge. Store packages are the RevenueCat JSON shapes (Map / List / scalars), read like the
// TypeScript reads its `any` values: a missing field is `undefined`, `Number(x)` coercion applies.

import '../js_compat.dart';

const String onboardingOffering = 'onboarding_last_chance_2026';
const String onboardingOfferProduct = 'com.atlasoon.anacan.premium.yearly.onboarding';
const String onboardingAnnualProduct = 'com.atlasoon.anacan.premium.yearly';
const String onboardingOfferOption = 'yearly-plan:onboarding-first-year';
const ({double annual, double firstYear}) onboardingUsdPrices = (annual: 29.99, firstYear: 19.99);

class PaidPurchaseRequest {
  const PaidPurchaseRequest({
    required this.productId,
    this.optionId,
    required this.price,
    required this.currency,
    this.paidIntro,
    this.introUncertain,
  });
  final String productId;
  final String? optionId;
  final double price;
  final String currency;
  final bool? paidIntro;
  final bool? introUncertain;

  Map<String, Object?> toJson() => {
        'productId': productId,
        if (optionId != null) 'optionId': optionId,
        'price': price,
        'currency': currency,
        if (paidIntro != null) 'paidIntro': paidIntro,
        if (introUncertain != null) 'introUncertain': introUncertain,
      };
}

class StorePlan {
  const StorePlan({
    required this.pkg,
    required this.price,
    required this.priceString,
    required this.currency,
    required this.renewalPrice,
    required this.renewalPriceString,
    required this.kind,
    required this.request,
    this.introUncertain,
  });
  final Object? pkg;
  final double price;
  final String priceString;
  final String currency;
  final double renewalPrice;
  final String renewalPriceString;

  /// 'yearly' | 'monthly'
  final String kind;
  final PaidPurchaseRequest request;
  final bool? introUncertain;
}

class PurchaseError implements Exception {
  const PurchaseError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// `obj?.key` on JSON-like values.
Object? _get(Object? obj, String key) => obj is Map ? obj[key] : null;
bool _truthy(Object? v) => v != null && v != false && v != '' && !(v is num && (v == 0 || v.isNaN));
String _str(Object? v) => _truthy(v) ? '$v' : '';

String? isoPeriod(Object? period) => period is String ? period : (_truthy(_get(period, 'iso8601')) ? _get(period, 'iso8601') as String : null);
bool _annual(Object? period) => const ['P1Y', 'P12M'].contains(isoPeriod(period) ?? '');

bool _validMoney(double price, Object? text, Object? currency) =>
    price.isFinite && price > 0 && text is String && text.trim().isNotEmpty && currency is String && RegExp(r'^[A-Z]{3}$').hasMatch(currency);

({double price, String priceString, String currency}) _phaseMoney(Object? phase) {
  final p = _get(phase, 'price');
  return (price: jsNumber(_get(p, 'amountMicros') ?? double.nan) / 1e6, priceString: _str(_get(p, 'formatted')), currency: _str(_get(p, 'currencyCode')));
}

/// `Number(undefined)` is NaN (jsNumber maps null to 0, so a missing field is passed as NaN explicitly).
double _num(Object? v) => v == null ? double.nan : jsNumber(v);

bool optionHasTrial(Object? option) {
  if (_truthy(_get(option, 'freePhase'))) return true;
  final phases = _get(option, 'pricingPhases');
  if (phases is! List) return false;
  return phases.any((phase) => _num(_get(_get(phase, 'price'), 'amountMicros')) == 0);
}

Object? _raw(Object? pkg) => _get(pkg, '_raw') ?? pkg;

StorePlan? standardStorePlan(Object? pkg, String platform, String kind, [int? eligibility]) {
  final product = _get(_raw(pkg), 'product');
  if (!_truthy(_get(product, 'identifier')) || platform == 'web') return null;
  bool expectedPeriod(Object? period) => kind == 'yearly' ? _annual(period) : isoPeriod(period) == 'P1M';
  var money = (price: _num(_get(product, 'price')), priceString: _str(_get(product, 'priceString')), currency: _str(_get(product, 'currencyCode')));
  String? optionId;
  if (platform == 'android') {
    final options = _get(product, 'subscriptionOptions');
    Object? base;
    if (options is List) {
      for (final option in options) {
        final phases = _get(option, 'pricingPhases');
        final full = _get(option, 'fullPricePhase');
        if (_truthy(_get(option, 'isBasePlan')) &&
            !_truthy(_get(option, 'isPrepaid')) &&
            !_truthy(_get(option, 'installmentsInfo')) &&
            !optionHasTrial(option) &&
            phases is List &&
            phases.length == 1 &&
            expectedPeriod(_get(full, 'billingPeriod')) &&
            _get(full, 'recurrenceMode') == 1) {
          base = option;
          break;
        }
      }
    }
    if (!_truthy(_get(base, 'id'))) return null;
    money = _phaseMoney(_get(base, 'fullPricePhase'));
    optionId = _get(base, 'id') as String;
  } else {
    if (!expectedPeriod(_get(product, 'subscriptionPeriod'))) return null;
    final intro = _get(product, 'introPrice');
    if (_truthy(intro) && eligibility != 1) {
      final uncertainYear = eligibility != 2 &&
          kind == 'yearly' &&
          _num(_get(intro, 'price')) > 0 &&
          _annual(_get(intro, 'period')) &&
          _get(intro, 'cycles') == 1;
      if (!uncertainYear) return null;
      final first = (price: _num(_get(intro, 'price')), priceString: _str(_get(intro, 'priceString')), currency: money.currency);
      if (!_validMoney(money.price, money.priceString, money.currency) ||
          !_validMoney(first.price, first.priceString, first.currency) ||
          first.price >= money.price) {
        return null;
      }
      return StorePlan(
        pkg: pkg,
        price: first.price,
        priceString: first.priceString,
        currency: first.currency,
        renewalPrice: money.price,
        renewalPriceString: money.priceString,
        kind: kind,
        introUncertain: true,
        request: PaidPurchaseRequest(
          productId: _get(product, 'identifier') as String,
          price: money.price,
          currency: money.currency,
          introUncertain: true,
        ),
      );
    }
  }
  if (!_validMoney(money.price, money.priceString, money.currency)) return null;
  return StorePlan(
    pkg: pkg,
    price: money.price,
    priceString: money.priceString,
    currency: money.currency,
    renewalPrice: money.price,
    renewalPriceString: money.priceString,
    kind: kind,
    request: PaidPurchaseRequest(
      productId: _get(product, 'identifier') as String,
      optionId: optionId,
      price: money.price,
      currency: money.currency,
    ),
  );
}

StorePlan? annualStorePlan(Object? pkg, String platform, [int? eligibility]) {
  final standard = standardStorePlan(pkg, platform, 'yearly', eligibility);
  if (platform == 'web') return null;
  final product = _get(_raw(pkg), 'product');
  final identifier = _get(product, 'identifier');
  if (identifier is! String || identifier.split(':')[0] != onboardingAnnualProduct) return standard;
  ({double price, String priceString, String currency}) first, renewal;
  String? optionId;
  if (platform == 'android') {
    final options = _get(product, 'subscriptionOptions');
    Object? option;
    if (options is List) {
      for (final item in options) {
        if (_get(item, 'id') == onboardingOfferOption) {
          option = item;
          break;
        }
      }
    }
    final phases = _get(option, 'pricingPhases');
    if (standard == null ||
        option == null ||
        _truthy(_get(option, 'isBasePlan')) ||
        _truthy(_get(option, 'isPrepaid')) ||
        _truthy(_get(option, 'installmentsInfo')) ||
        optionHasTrial(option) ||
        phases is! List ||
        phases.length != 2) {
      return standard;
    }
    final intro = phases[0], full = phases[1];
    final mode = _get(intro, 'recurrenceMode'), cycles = _get(intro, 'billingCycleCount');
    final oneCharge = (mode == 2 && cycles == 1) || (mode == 3 && (cycles == null || cycles == 0 || cycles == 1));
    if (!_annual(_get(intro, 'billingPeriod')) || !_annual(_get(full, 'billingPeriod')) || !oneCharge || _get(full, 'recurrenceMode') != 1) {
      return standard;
    }
    first = _phaseMoney(intro);
    renewal = _phaseMoney(full);
    optionId = _get(option, 'id') as String;
  } else {
    final intro = _get(product, 'introPrice');
    if (eligibility != 2 || !_annual(_get(product, 'subscriptionPeriod')) || !_annual(_get(intro, 'period')) || _get(intro, 'cycles') != 1) {
      return standard;
    }
    first = (price: _num(_get(intro, 'price')), priceString: _str(_get(intro, 'priceString')), currency: _str(_get(product, 'currencyCode')));
    renewal = (price: _num(_get(product, 'price')), priceString: _str(_get(product, 'priceString')), currency: _str(_get(product, 'currencyCode')));
  }
  if (!_validMoney(first.price, first.priceString, first.currency) ||
      !_validMoney(renewal.price, renewal.priceString, renewal.currency) ||
      first.currency != renewal.currency ||
      first.price >= renewal.price ||
      (standard != null && (standard.currency != renewal.currency || (renewal.price - standard.price).abs() > 0.000001))) {
    return standard;
  }
  return StorePlan(
    pkg: pkg,
    price: first.price,
    priceString: first.priceString,
    currency: first.currency,
    kind: 'yearly',
    renewalPrice: renewal.price,
    renewalPriceString: renewal.priceString,
    request: PaidPurchaseRequest(
      productId: identifier,
      optionId: optionId,
      price: first.price,
      currency: first.currency,
      paidIntro: platform == 'ios',
    ),
  );
}

/// Validates the choice right before handing it to the native store; never falls back to another price.
/// Returns the Android subscription option to buy (null on iOS). Throws [PurchaseError].
Object? validatePaidPurchase(Object? raw, PaidPurchaseRequest request, String platform) {
  final product = _get(raw, 'product');
  if (_get(product, 'identifier') != request.productId || !request.price.isFinite || request.price <= 0) {
    throw const PurchaseError('PURCHASE_PRICE_CHANGED');
  }
  if (platform == 'android') {
    final options = _get(product, 'subscriptionOptions');
    Object? option;
    if (options is List) {
      for (final item in options) {
        if (_get(item, 'id') == request.optionId) {
          option = item;
          break;
        }
      }
    }
    if (option == null || optionHasTrial(option)) throw const PurchaseError('PURCHASE_OPTION_UNAVAILABLE');
    final phases = _get(option, 'pricingPhases');
    final money = _phaseMoney(phases is List && phases.isNotEmpty ? phases[0] : null);
    if (money.currency != request.currency || (money.price - request.price).abs() > .000001) {
      throw const PurchaseError('PURCHASE_PRICE_CHANGED');
    }
    return option;
  }
  final value = request.paidIntro == true ? _get(product, 'introPrice') : product;
  // As in JS, a NaN price passes (`Math.abs(NaN) > x` is false).
  if (!_truthy(value) || _get(product, 'currencyCode') != request.currency || (_num(_get(value, 'price')) - request.price).abs() > .000001) {
    throw const PurchaseError('PURCHASE_PRICE_CHANGED');
  }
  return null;
}
