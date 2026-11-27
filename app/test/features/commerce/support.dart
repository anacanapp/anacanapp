// Ported from: (test support) — the vi.mock setups of the commerce tests: a fake CommerceBackend instead of the
// supabase client (rpc / functions.invoke / table reads), a frozen platform, image placeholders, captured
// analytics, and the profile/settings harness (pumpApp, baseOverrides).
import 'dart:async';

import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/commerce/commerce_backend.dart';
import 'package:anacan/features/commerce/common/commerce_ui.dart';
import 'package:anacan/features/commerce/qaygicash/qaygicash_premium.dart' show commercePlatformProvider;
import 'package:anacan/native/purchases/purchase_analytics.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../settings/support/harness.dart';

export '../settings/support/harness.dart';

typedef RpcHandler = FutureOr<DbResult<Object?>> Function(String fn, Map<String, dynamic>? params);
typedef InvokeHandler = FutureOr<DbResult<Object?>> Function(String name, Object? body);

class FakeCommerceBackend implements CommerceBackend {
  FakeCommerceBackend({this.onRpc, this.onInvoke});
  RpcHandler? onRpc;
  InvokeHandler? onInvoke;
  final List<(String, Map<String, dynamic>?)> rpcCalls = [];
  final List<(String, Object?)> invokeCalls = [];

  List<Map<String, dynamic>> products = [];
  List<Map<String, dynamic>> cartRows = [];
  List<Map<String, dynamic>> cakeRows = [];
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> venues = [];
  Map<String, dynamic>? coupon;
  List<Map<String, dynamic>> orders = [];

  @override
  Future<DbResult<Object?>> rpc(String fn, [Map<String, dynamic>? params]) async {
    rpcCalls.add((fn, params));
    final h = onRpc;
    return h == null ? const DbResult<Object?>(data: null) : await h(fn, params);
  }

  @override
  Future<DbResult<Object?>> invoke(String name, Object? body) async {
    invokeCalls.add((name, body));
    final h = onInvoke;
    return h == null ? const DbResult<Object?>(data: null) : await h(name, body);
  }

  @override
  Future<List<JsonRow>> aptekProducts() async => products;
  @override
  Future<List<JsonRow>> aptekCartRows(String userId) async => cartRows;
  @override
  Future<void> aptekCartDelete(String id, String userId) async => cartRows.removeWhere((r) => r['id'] == id);
  @override
  Future<void> aptekCartUpdate(String id, String userId, int quantity) async {
    for (final r in cartRows) {
      if (r['id'] == id) r['quantity'] = quantity;
    }
  }

  @override
  Future<void> aptekCartInsert(String userId, String productId, int quantity) async =>
      cartRows.add({'id': 'c${cartRows.length + 1}', 'product_id': productId, 'quantity': quantity});
  @override
  Future<JsonRow?> aptekCoupon(String code) async => coupon;
  @override
  Future<List<JsonRow>> aptekOrders(String userId) async => orders;
  @override
  Future<List<JsonRow>> cakes() async => cakeRows;
  @override
  Future<List<JsonRow>> partnerCategories() async => categories;
  @override
  Future<List<JsonRow>> partnerVenues(String? categoryKey) async => venues;
}

class RecordingAnalytics implements AnalyticsSink {
  final List<(String, Map<String, Object?>)> events = [];
  @override
  void logEvent(String name, [Map<String, Object?> params = const {}]) => events.add((name, params));
  @override
  void logPaywallClicked(String source, String plan) {}
  @override
  void logPaywallShown(String source) {}
  @override
  void logPremiumSubscribed(String packageId, double price, String currency) {}
  @override
  void logTrialStarted(String packageId, double price, String currency) {}
}

/// The harness overrides plus the fake backend, an 'ios' platform and grey image boxes.
List<Override> commerceOverrides(
  FakeCommerceBackend backend, {
  String platform = 'ios',
  RecordingAnalytics? analytics,
  List<Override> extra = const [],
  bool isAdmin = false,
  LocalStore? store,
}) => [
  ...baseOverrides(isAdmin: isAdmin, store: store),
  commerceBackendProvider.overrideWithValue(backend),
  commerceBackendUrlProvider.overrideWithValue('https://api.test'),
  commercePlatformProvider.overrideWithValue(platform),
  commerceImageProvider.overrideWithValue((context, src, fit) => const ColoredBox(color: Color(0xFFDDDDDD))),
  analyticsSinkProvider.overrideWithValue(analytics ?? RecordingAnalytics()),
  ...extra,
];

/// The `WALLET` fixture of QaygiCash.test.tsx.
Map<String, Object?> walletFixture([Map<String, Object?> patch = const {}]) => {
  'enabled': true, 'status': 'live', 'country': 'AZ', 'currency': 'AZN', //
  'available_minor': 659, 'pending_minor': 108, 'expiring_30d_minor': 0, 'next_expiry_at': null, 'debt_minor': 0,
  'rates': {'premium_yearly': 500, 'premium_monthly': 300, 'book': 500, 'cake': 300, 'own_shop': 500, 'partner': 0, 'affiliate': 0},
  'hold_days_physical': 14, 'hold_days_digital': 7, 'expiry_months': 12, 'max_redeem_pct': 30, 'min_redeem_minor': 100,
  'redeem_channels': ['aptek', 'cake', 'book'], 'terms_version': 1,
  'premium_redeem': {
    'enabled': false,
    'monthly': {'enabled': false, 'price_minor': 399},
    'yearly': {'enabled': false, 'price_minor': 2699},
    'platforms': {'ios': false, 'android': false, 'web': false},
  },
  ...patch,
};
