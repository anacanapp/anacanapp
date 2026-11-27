// Ported from: src/hooks/useAptek.ts, src/lib/aptek-i18n.ts
//
// Anacan Aptek (pharmacy) data: config, catalogue, the server-side cart, coupons, orders and checkout.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/i18n.dart';
import '../../../domain/aptek/aptek_offers.dart' show OfferProduct;
import '../../../domain/aptek/aptek_pricing.dart';
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../state/user_store.dart';
import '../commerce_backend.dart';
import '../qaygicash/qaygicash_hooks.dart' show invalidateQaygiCash;

/// `ap(key, vars)`: copy for this area (ui-copy 'aptek' section; English is the safety net).
String ap(String key, [Map<String, Object?>? vars, String? language]) => copyText('aptek', key, language: language, vars: vars);

/// "12,50 ₼" in the active language's number format (whole amounts without decimals).
String formatAzn(num amount, [String? language]) {
  final lang = language ?? currentLanguage();
  final isInt = amount == amount.truncateToDouble();
  // Non-breaking space keeps the sign on the number's line in narrow cards.
  return '${formatIntlNumber(lang, amount, maximumFractionDigits: 2, minimumFractionDigits: isInt ? 0 : 2)}\u00a0₼';
}

class AptekProduct implements OfferProduct {
  AptekProduct({
    required this.id,
    this.sku,
    required this.name,
    this.description,
    required this.category,
    required this.price,
    this.originalPrice,
    required this.images,
    this.brand,
    this.kind,
    this.minAgeMonths,
    this.volume,
    required this.tags,
    required this.salesCount,
    this.stock,
    this.sourceUrl,
    required this.cashbackOwn,
  });

  @override
  final String id;
  @override
  final String? sku;
  final String name;
  final String? description;
  final String category;
  @override
  final num price;
  final num? originalPrice;
  final List<String> images;
  final String? brand;
  @override
  final String? kind;
  @override
  final num? minAgeMonths;
  final String? volume;
  @override
  final List<String> tags;
  @override
  final num salesCount;
  final num? stock;
  final String? sourceUrl;

  /// Anacan-brand product: earns the QayğıCash own_shop rate (partner products earn nothing).
  final bool cashbackOwn;

  static num _n(Object? v) => v is num ? v : (v is String ? (num.tryParse(v.trim()) ?? 0) : 0);
  static num? _nn(Object? v) => v == null ? null : (v is num ? v : (v is String ? num.tryParse(v.trim()) : null));
  static String? _s(Object? v) => v is String ? v : null;

  factory AptekProduct.fromRow(Map<String, dynamic> r) {
    final images = r['images'];
    final image = r['image_url'];
    return AptekProduct(
      id: '${r['id']}',
      sku: _s(r['sku']),
      name: _s(r['name']) ?? '',
      description: _s(r['description']),
      category: _s(r['category']) ?? '',
      price: _n(r['price']),
      originalPrice: r['original_price'] != null ? _n(r['original_price']) : null,
      images: images is List && images.isNotEmpty ? [for (final i in images) '$i'] : (image != null && image != '' ? ['$image'] : const []),
      brand: _s(r['brand']),
      kind: _s(r['kind']),
      minAgeMonths: _nn(r['min_age_months']),
      volume: _s(r['volume']),
      tags: r['tags'] is List ? [for (final t in r['tags'] as List) '$t'] : const [],
      salesCount: _n(r['sales_count']),
      stock: _nn(r['stock']),
      sourceUrl: _s(r['source_url']),
      cashbackOwn: r['cashback_own'] == true,
    );
  }
}

class AptekCartLine {
  const AptekCartLine({required this.id, required this.productId, required this.quantity, required this.product});
  final String id;
  final String productId;
  final int quantity;
  final AptekProduct product;
}

class AptekOrderItem {
  AptekOrderItem(this.row);
  final Map<String, dynamic> row;
  String get id => '${row['id']}';
  String get productId => '${row['product_id']}';
  String get productName => row['product_name'] is String ? row['product_name'] as String : '';
  int get quantity => row['quantity'] is num ? (row['quantity'] as num).toInt() : 0;
}

class AptekOrder {
  AptekOrder(this.row);
  final Map<String, dynamic> row;
  String get id => '${row['id']}';
  String get orderNumber => '${row['order_number'] ?? ''}';
  String get status => '${row['status'] ?? ''}';
  num get totalAmount => row['total_amount'] is num ? row['total_amount'] as num : (num.tryParse('${row['total_amount']}') ?? 0);
  String? get deliverySlot => row['delivery_slot'] is String ? row['delivery_slot'] as String : null;
  List<AptekOrderItem> get orderItems => row['order_items'] is List
      ? [
          for (final i in row['order_items'] as List)
            if (i is Map) AptekOrderItem(Map<String, dynamic>.from(i)),
        ]
      : const [];
}

final aptekConfigQuery = queryProvider<AptekConfig>(
  (ref) => QueryOptions<AptekConfig>(
    queryKey: ['aptek-config', ref.watch(commerceBackendUrlProvider)],
    staleTime: const Duration(minutes: 5),
    queryFn: (_) async {
      final res = await ref.read(commerceBackendProvider).rpc('get_aptek_config');
      if (res.error != null) return parseAptekConfig(null); // migration not applied yet → store stays hidden
      return parseAptekConfig(res.data);
    },
  ),
  name: 'aptekConfigQuery',
);

/// Whether the store is visible for this user (country + admin toggle; admins always).
class AptekAvailability {
  const AptekAvailability({required this.available, this.config});
  final bool available;
  final AptekConfig? config;
}

final aptekAvailableProvider = Provider.autoDispose<AptekAvailability>((ref) {
  final profile = ref.watch(authProfileProvider);
  final isAdmin = ref.watch(isAdminProvider);
  final store = ref.watch(userStoreProvider);
  final config = ref.watch(aptekConfigQuery).data;
  final country = regionalCountry(store.language, [profile?.countryCode, store.countryCode]);
  return AptekAvailability(available: isAptekAvailable(config, country, isAdmin), config: config);
});

/// `useAptekProducts(enabled)`. React mounts it with `!!user` (the cart) and `available` (cards, store); one
/// observer per cache key here, so it is enabled when any of them would be: signed in, or the store is available.
final aptekProductsQuery = queryProvider<List<AptekProduct>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final signedIn = ref.watch(authUserProvider.select((u) => u != null));
  final available = ref.watch(aptekAvailableProvider.select((a) => a.available));
  return QueryOptions<List<AptekProduct>>(
    queryKey: ['aptek-products', ref.watch(commerceBackendUrlProvider), language],
    enabled: signedIn || available,
    staleTime: const Duration(minutes: 5),
    queryFn: (_) async {
      final rows = await ref.read(commerceBackendProvider).aptekProducts();
      return [
        for (final r in mapRowsTranslation(rows, language, const ['name', 'description', 'category'])) AptekProduct.fromRow(Map<String, dynamic>.from(r)),
      ];
    },
  );
}, name: 'aptekProductsQuery');

final aptekCartRowsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['aptek-cart', ref.watch(commerceBackendUrlProvider), uid],
    enabled: uid != null,
    queryFn: (_) => ref.read(commerceBackendProvider).aptekCartRows(uid!),
  );
}, name: 'aptekCartRowsQuery');

/// `useAptekCart()`.
class AptekCart {
  AptekCart({required this.lines, required this.rows, required this.isLoading, required this.setQuantity});
  final List<AptekCartLine> lines;
  final List<Map<String, dynamic>> rows;
  final bool isLoading;

  /// `setQuantity(productId, quantity)` (0 removes; capped at 20). Optimistic, rolled back on error.
  final Future<void> Function(String productId, num quantity) setQuantity;

  int get count => lines.fold(0, (s, l) => s + l.quantity);
  int quantityOf(String productId) {
    for (final r in rows) {
      if (r['product_id'] == productId) return r['quantity'] is num ? (r['quantity'] as num).toInt() : 0;
    }
    return 0;
  }

  Future<void> add(String productId, [int n = 1]) => setQuantity(productId, quantityOf(productId) + n);
}

int _clampQty(num quantity) => math.max(0, math.min(20, quantity.round()));

final aptekCartProvider = Provider.autoDispose<AptekCart>((ref) {
  final products = ref.watch(aptekProductsQuery).data ?? const <AptekProduct>[];
  final q = ref.watch(aptekCartRowsQuery);
  final rows = q.data ?? const <Map<String, dynamic>>[];
  final byId = {for (final p in products) p.id: p};
  final lines = [
    for (final r in rows)
      if (byId.containsKey(r['product_id']))
        AptekCartLine(
          id: '${r['id']}',
          productId: '${r['product_id']}',
          quantity: r['quantity'] is num ? (r['quantity'] as num).toInt() : 0,
          product: byId[r['product_id']]!,
        ),
  ];
  Future<void> setQuantity(String productId, num quantity) async {
    final uid = ref.read(authUserProvider)?.id;
    if (uid == null) throw StateError('AUTH');
    final client = ref.read(queryClientProvider);
    final key = ['aptek-cart', ref.read(commerceBackendUrlProvider), uid];
    final qty = _clampQty(quantity);
    final snapshot = await client.optimisticUpdate<List<Map<String, dynamic>>>(key, (prev) {
      final old = prev ?? const <Map<String, dynamic>>[];
      if (old.any((r) => r['product_id'] == productId)) {
        return [
          for (final r in old)
            if (r['product_id'] == productId) {...r, 'quantity': qty} else r,
        ].where((r) => (r['quantity'] as num? ?? 0) > 0).toList();
      }
      return qty > 0
          ? [
              ...old,
              {'id': 'tmp-$productId', 'product_id': productId, 'quantity': qty},
            ]
          : old;
    });
    final backend = ref.read(commerceBackendProvider);
    Map<String, dynamic>? existing;
    for (final r in rows) {
      if (r['product_id'] == productId) existing = r;
    }
    try {
      if (qty == 0) {
        if (existing != null) await backend.aptekCartDelete('${existing['id']}', uid);
      } else if (existing != null) {
        await backend.aptekCartUpdate('${existing['id']}', uid, qty);
      } else {
        await backend.aptekCartInsert(uid, productId, qty);
      }
    } catch (e) {
      snapshot.rollback();
      rethrow;
    } finally {
      unawaited(client.invalidateQueries(queryKey: key));
    }
  }

  return AptekCart(lines: lines, rows: rows, isLoading: q.isLoading, setQuantity: setQuantity);
});

/// Looks up a coupon for the preview; the server re-validates at checkout.
Future<AptekCoupon?> fetchAptekCoupon(CommerceBackend backend, String code) async {
  final clean = code.trim().toUpperCase();
  if (!RegExp(r'^[A-Z0-9_-]{2,40}$').hasMatch(clean)) return null;
  final data = await backend.aptekCoupon(clean);
  if (data == null) return null;
  final value = data['discount_value'];
  try {
    return AptekCoupon.fromJson({...data, 'discount_value': value is num ? value : (num.tryParse('$value') ?? double.nan)});
  } catch (_) {
    return null;
  }
}

AptekTotals aptekTotals(List<AptekCartLine> lines, AptekConfig? config, [AptekCoupon? coupon]) => computeAptekTotals(
  [for (final l in lines) PriceLine(sku: l.product.sku, price: l.product.price, quantity: l.quantity)],
  config ?? parseAptekConfig(null),
  coupon,
);

class PlaceOrderInput {
  const PlaceOrderInput({
    required this.items,
    this.coupon,
    required this.slot,
    required this.payment,
    required this.address,
    required this.phone,
    this.notes,
    this.cashback,
  });
  final List<Map<String, Object?>> items;
  final String? coupon;
  final String slot;

  /// 'cash' | 'card_on_delivery'
  final String payment;
  final Map<String, Object?> address;
  final String phone;
  final String? notes;

  /// QayğıCash bonus to apply, in AZN (server re-checks max share, minimum and balance).
  final double? cashback;
}

class PlacedOrder {
  const PlacedOrder({required this.orderId, required this.orderNumber, required this.total, this.cashback});
  final String orderId;
  final String orderNumber;
  final num total;
  final num? cashback;
}

/// `usePlaceAptekOrder().mutateAsync(input)`.
Future<PlacedOrder> placeAptekOrder({
  required CommerceBackend backend,
  required QueryClient client,
  required String backendUrl,
  required String? uid,
  required PlaceOrderInput input,
}) async {
  final res = await backend.rpc('place_aptek_order', {
    'p_items': input.items,
    'p_coupon': input.coupon == null || input.coupon!.isEmpty ? null : input.coupon,
    'p_slot': input.slot,
    'p_payment': input.payment,
    'p_address': input.address,
    'p_phone': input.phone,
    'p_notes': input.notes == null || input.notes!.isEmpty ? null : input.notes,
    if (input.cashback != null && input.cashback! > 0) 'p_cashback': input.cashback,
  });
  if (res.error != null) {
    unawaited(invalidateQaygiCash(client));
    throw res.error!;
  }
  final d = res.data is Map ? res.data as Map : const {};
  unawaited(client.invalidateQueries(queryKey: ['aptek-cart', backendUrl, uid]));
  unawaited(client.invalidateQueries(queryKey: ['aptek-orders', backendUrl, uid]));
  unawaited(client.invalidateQueries(queryKey: const ['aptek-products']));
  unawaited(invalidateQaygiCash(client));
  return PlacedOrder(
    orderId: '${d['order_id'] ?? ''}',
    orderNumber: '${d['order_number'] ?? ''}',
    total: d['total'] is num ? d['total'] as num : 0,
    cashback: d['cashback'] is num ? d['cashback'] as num : null,
  );
}

/// Maps a checkout RPC error to a copy key.
String aptekErrorKey(Object? error) {
  final msg = errorText(error);
  final code = RegExp(r'APTEK_[A-Z_]+').firstMatch(msg)?[0];
  switch (code) {
    case 'APTEK_BAD_COUPON':
      return 'coupon_invalid';
    case 'APTEK_OUT_OF_STOCK':
      return 'err_stock';
    case 'APTEK_BAD_PHONE':
      return 'err_phone';
    case 'APTEK_BAD_ADDRESS':
      return 'err_address';
    case 'APTEK_DISABLED':
      return 'err_disabled';
    default:
      return 'err_generic';
  }
}

final aptekOrdersQuery = queryProvider<List<AptekOrder>>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  return QueryOptions<List<AptekOrder>>(
    queryKey: ['aptek-orders', ref.watch(commerceBackendUrlProvider), uid],
    enabled: uid != null,
    queryFn: (_) async => [for (final r in await ref.read(commerceBackendProvider).aptekOrders(uid!)) AptekOrder(r)],
  );
}, name: 'aptekOrdersQuery');

/// `discountPct(p)`.
int discountPct(AptekProduct p) => p.originalPrice != null && p.originalPrice! > p.price ? ((1 - p.price / p.originalPrice!) * 100).round() : 0;

/// `ageLabel(months)`.
String ageLabel(num? months) => months == null ? ap('age_any') : ap('age_from', {'n': months is int || months == months.truncate() ? months.toInt() : months});
