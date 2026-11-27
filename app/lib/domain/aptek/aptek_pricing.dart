// Ported from: src/lib/aptek-pricing.ts
//
// Anacan Aptek price preview. Mirrors public.place_aptek_order; the server recomputes everything at checkout and
// its numbers are the ones charged.

import 'dart:convert';
import 'dart:math' as math;

import '../js_compat.dart';

class AptekBundle {
  const AptekBundle({required this.id, required this.skus, this.tone});
  final String id;
  final List<String> skus;
  final String? tone;
}

class AptekConfig {
  const AptekConfig({
    required this.enabled,
    required this.countries,
    required this.freeShippingMin,
    required this.shippingFee,
    required this.bundleDiscountPct,
    required this.slots,
    required this.bundles,
    required this.placements,
  });
  final bool enabled;
  final List<String> countries;
  final double freeShippingMin;
  final double shippingFee;
  final double bundleDiscountPct;
  final List<String> slots;
  final List<AptekBundle> bundles;
  final Map<String, Object?> placements;

  AptekConfig copyWith({bool? enabled, Map<String, Object?>? placements}) => AptekConfig(
        enabled: enabled ?? this.enabled,
        countries: countries,
        freeShippingMin: freeShippingMin,
        shippingFee: shippingFee,
        bundleDiscountPct: bundleDiscountPct,
        slots: slots,
        bundles: bundles,
        placements: placements ?? this.placements,
      );
}

class PriceLine {
  const PriceLine({required this.sku, required this.price, required this.quantity});
  final String? sku;
  final num price;
  final num quantity;
}

class AptekCoupon {
  const AptekCoupon({
    required this.code,
    required this.discountType,
    required this.discountValue,
    this.applicableTo,
    this.isActive,
    this.startsAt,
    this.expiresAt,
    this.maxUses,
    this.usedCount,
    this.minOrderAmount,
  });
  final String code;
  final String discountType;
  final num discountValue;
  final List<String>? applicableTo;
  final bool? isActive;
  final String? startsAt;
  final String? expiresAt;
  final num? maxUses;
  final num? usedCount;
  final num? minOrderAmount;

  factory AptekCoupon.fromJson(Map<String, Object?> j) => AptekCoupon(
        code: j['code']! as String,
        discountType: j['discount_type']! as String,
        discountValue: j['discount_value']! as num,
        applicableTo: (j['applicable_to'] as List?)?.cast<String>(),
        isActive: j['is_active'] as bool?,
        startsAt: j['starts_at'] as String?,
        expiresAt: j['expires_at'] as String?,
        maxUses: j['max_uses'] as num?,
        usedCount: j['used_count'] as num?,
        minOrderAmount: j['min_order_amount'] as num?,
      );

  AptekCoupon copyWith({
    String? discountType,
    num? discountValue,
    List<String>? applicableTo,
    bool? isActive,
    String? expiresAt,
    num? maxUses,
    num? usedCount,
    num? minOrderAmount,
  }) =>
      AptekCoupon(
        code: code,
        discountType: discountType ?? this.discountType,
        discountValue: discountValue ?? this.discountValue,
        applicableTo: applicableTo ?? this.applicableTo,
        isActive: isActive ?? this.isActive,
        startsAt: startsAt,
        expiresAt: expiresAt ?? this.expiresAt,
        maxUses: maxUses ?? this.maxUses,
        usedCount: usedCount ?? this.usedCount,
        minOrderAmount: minOrderAmount ?? this.minOrderAmount,
      );
}

class AptekTotals {
  const AptekTotals({
    required this.subtotal,
    required this.bundleDiscount,
    required this.couponDiscount,
    required this.shipping,
    required this.total,
    required this.toFreeShipping,
    required this.completeBundles,
  });
  final double subtotal;
  final double bundleDiscount;
  final double couponDiscount;
  final double shipping;
  final double total;

  /// Amount still needed for free delivery (0 when reached).
  final double toFreeShipping;
  final List<String> completeBundles;

  Map<String, Object?> toJson() => {
        'subtotal': subtotal,
        'bundleDiscount': bundleDiscount,
        'couponDiscount': couponDiscount,
        'shipping': shipping,
        'total': total,
        'toFreeShipping': toFreeShipping,
        'completeBundles': completeBundles,
      };
}

const AptekConfig defaultAptekConfig = AptekConfig(
  enabled: false,
  countries: ['AZ'],
  freeShippingMin: 30,
  shippingFee: 3,
  bundleDiscountPct: 10,
  slots: ['today_evening', 'tomorrow_morning', 'tomorrow_evening', 'day_after'],
  bundles: [],
  placements: {},
);

double _round2(num n) => jsRound(n * 100) / 100;

String _jsString(Object? v) => v is num ? jsNumberToString(v) : '$v';

/// Normalises the stored config (it may arrive JSON-encoded or partial).
AptekConfig parseAptekConfig(Object? raw) {
  var value = raw;
  if (value is String) {
    try {
      value = jsonDecode(value);
    } catch (_) {
      value = null;
    }
  }
  final v = value is Map ? value : const {};
  double num0(Object? x, double d) => x is num && x.isFinite ? x.toDouble() : d;
  final countries = v['countries'], slots = v['slots'], bundles = v['bundles'], placements = v['placements'];
  return AptekConfig(
    enabled: v['enabled'] == true,
    countries: countries is List ? countries.map(_jsString).toList() : defaultAptekConfig.countries,
    freeShippingMin: num0(v['free_shipping_min'], defaultAptekConfig.freeShippingMin),
    shippingFee: num0(v['shipping_fee'], defaultAptekConfig.shippingFee),
    bundleDiscountPct: math.min(50, math.max(0, num0(v['bundle_discount_pct'], defaultAptekConfig.bundleDiscountPct))),
    slots: slots is List && slots.isNotEmpty ? slots.map(_jsString).toList() : defaultAptekConfig.slots,
    bundles: bundles is List
        ? [
            for (final b in bundles)
              if (b is Map && b['id'] is String && b['skus'] is List)
                AptekBundle(id: b['id'] as String, skus: (b['skus'] as List).map(_jsString).toList(), tone: b['tone'] as String?),
          ]
        : const [],
    placements: placements is Map ? placements.cast<String, Object?>() : const {},
  );
}

/// Coupon checks the server applies; returns a reason key or null when usable.
String? couponProblem(AptekCoupon? c, num subtotal, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  if (c == null || c.isActive != true) return 'coupon_invalid';
  if (!(c.applicableTo ?? const []).any((a) => a == 'aptek' || a == 'all')) return 'coupon_invalid';
  final starts = c.startsAt == null || c.startsAt!.isEmpty ? null : jsParseDate(c.startsAt!);
  if (starts != null && starts.isAfter(n)) return 'coupon_invalid';
  final expires = c.expiresAt == null || c.expiresAt!.isEmpty ? null : jsParseDate(c.expiresAt!);
  if (expires != null && expires.isBefore(n)) return 'coupon_expired';
  if (c.maxUses != null && (c.usedCount ?? 0) >= c.maxUses!) return 'coupon_used_up';
  if (c.minOrderAmount != null && subtotal < c.minOrderAmount!) return 'coupon_min_order';
  return null;
}

AptekTotals computeAptekTotals(List<PriceLine> lines, AptekConfig config, [AptekCoupon? coupon, DateTime? now]) {
  final subtotal = _round2(lines.fold<num>(0, (s, l) => s + l.price * l.quantity));
  final inCart = <String, num>{
    for (final l in lines)
      if (l.quantity > 0 && l.sku != null && l.sku!.isNotEmpty) l.sku!: l.price,
  };
  double bundleDiscount = 0;
  final complete = <String>[];
  for (final b in config.bundles) {
    if (b.skus.isNotEmpty && b.skus.every(inCart.containsKey)) {
      complete.add(b.id);
      final unitSum = b.skus.toSet().fold<num>(0, (s, sku) => s + (inCart[sku] ?? 0));
      bundleDiscount += _round2(unitSum * config.bundleDiscountPct / 100);
    }
  }
  bundleDiscount = _round2(bundleDiscount);
  num couponDiscount = 0;
  if (coupon != null && couponProblem(coupon, subtotal, now) == null) {
    final base = subtotal - bundleDiscount;
    couponDiscount = coupon.discountType == 'percentage'
        ? _round2(base * math.min(coupon.discountValue, 100) / 100)
        : math.min(coupon.discountValue, base);
  }
  final after = subtotal - bundleDiscount - couponDiscount;
  final shipping = subtotal == 0 || after >= config.freeShippingMin ? 0.0 : config.shippingFee;
  return AptekTotals(
    subtotal: subtotal,
    bundleDiscount: bundleDiscount,
    couponDiscount: _round2(couponDiscount),
    shipping: shipping,
    total: _round2(math.max(after, 0) + shipping),
    toFreeShipping: _round2(math.max(0, config.freeShippingMin - after)),
    completeBundles: complete,
  );
}

/// Shown in its countries when enabled; admins always see it.
bool isAptekAvailable(AptekConfig? config, String? countryCode, [bool isAdmin = false]) {
  if (isAdmin) return true;
  if (config == null || !config.enabled) return false;
  return countryCode != null && countryCode.isNotEmpty && config.countries.contains(countryCode.toUpperCase());
}
