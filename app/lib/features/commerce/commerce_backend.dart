// Ported from: src/integrations/supabase/client.ts (the `supabase.rpc / functions.invoke / from(...)` calls of
//              src/hooks/useQaygiCash.ts, src/hooks/useAptek.ts, src/hooks/useCakes.ts, src/hooks/usePartnerShop.ts,
//              src/hooks/usePartnerVenues.ts, src/lib/promo.ts, src/lib/premium-sponsor.ts, src/lib/in-app-epoint.ts,
//              src/components/qaygicash/QaygiCashPremium.tsx, src/components/cakes/CakeOrderForm.tsx)
//
// Every server call of the commerce feature goes through [CommerceBackend], so tests swap in a fake. Partner
// stores are read only through the server-scoped RPCs (`shop_storefront_v1`, `shop_partner_*`), never tables.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException, PostgrestException;

import '../../core/data/data.dart' hide Row;
import '../../state/shell_bindings.dart' show backendUrlProvider;

typedef JsonRow = Map<String, dynamic>;

abstract interface class CommerceBackend {
  /// `supabase.rpc(fn, params)` as `{data, error}`.
  Future<DbResult<Object?>> rpc(String fn, [Map<String, dynamic>? params]);

  /// `supabase.functions.invoke(name, { body })` as `{data, error}`; a non-2xx error is a [FunctionException]
  /// whose `details` hold the parsed body (supabase-js `error.context.json()`).
  Future<DbResult<Object?>> invoke(String name, Object? body);

  /// `products` where store = 'aptek' and is_active, by sales_count desc, limit 500 (throws).
  Future<List<JsonRow>> aptekProducts();

  /// `cart_items(id, product_id, quantity)` of [userId] (throws).
  Future<List<JsonRow>> aptekCartRows(String userId);
  Future<void> aptekCartDelete(String id, String userId);
  Future<void> aptekCartUpdate(String id, String userId, int quantity);
  Future<void> aptekCartInsert(String userId, String productId, int quantity);

  /// `coupons` ilike [code], maybeSingle (null when absent; errors read as absent, like the React destructure).
  Future<JsonRow?> aptekCoupon(String code);

  /// `orders(*, order_items(*))` of [userId] where store = 'aptek', newest first, limit 50 (throws).
  Future<List<JsonRow>> aptekOrders(String userId);

  /// `cakes` where is_active, by sort_order (throws).
  Future<List<JsonRow>> cakes();

  /// `partner_venue_categories` where is_active, by sort_order (throws).
  Future<List<JsonRow>> partnerCategories();

  /// `partner_venues_public` (featured first, sort_order), optionally one category (throws).
  Future<List<JsonRow>> partnerVenues(String? categoryKey);
}

class SupabaseCommerceBackend implements CommerceBackend {
  SupabaseCommerceBackend(this._db);
  final Db _db;

  List<JsonRow> _rows(Object? data) => data is List
      ? [
          for (final r in data)
            if (r is Map) Map<String, dynamic>.from(r),
        ]
      : <JsonRow>[];

  @override
  Future<DbResult<Object?>> rpc(String fn, [Map<String, dynamic>? params]) => _db.rpcResult(fn, params: params);

  @override
  Future<DbResult<Object?>> invoke(String name, Object? body) => _db.invoke(name, body: body);

  @override
  Future<List<JsonRow>> aptekProducts() async =>
      _rows(await _db.from('products').select().eq('store', 'aptek').eq('is_active', true).order('sales_count', ascending: false).limit(500));

  @override
  Future<List<JsonRow>> aptekCartRows(String userId) async => _rows(await _db.from('cart_items').select('id, product_id, quantity').eq('user_id', userId));

  @override
  Future<void> aptekCartDelete(String id, String userId) async {
    await _db.from('cart_items').delete().eq('id', id).eq('user_id', userId);
  }

  @override
  Future<void> aptekCartUpdate(String id, String userId, int quantity) async {
    await _db.from('cart_items').update({'quantity': quantity}).eq('id', id).eq('user_id', userId);
  }

  @override
  Future<void> aptekCartInsert(String userId, String productId, int quantity) async {
    await _db.from('cart_items').insert({'user_id': userId, 'product_id': productId, 'quantity': quantity});
  }

  @override
  Future<JsonRow?> aptekCoupon(String code) async {
    try {
      final data = await _db
          .from('coupons')
          .select('code, discount_type, discount_value, applicable_to, is_active, starts_at, expires_at, max_uses, used_count, min_order_amount')
          .ilike('code', code)
          .maybeSingle();
      return data == null ? null : Map<String, dynamic>.from(data);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<List<JsonRow>> aptekOrders(String userId) async =>
      _rows(await _db.from('orders').select('*, order_items(*)').eq('user_id', userId).eq('store', 'aptek').order('created_at', ascending: false).limit(50));

  @override
  Future<List<JsonRow>> cakes() async => _rows(await _db.from('cakes').select().eq('is_active', true).order('sort_order', ascending: true));

  @override
  Future<List<JsonRow>> partnerCategories() async =>
      _rows(await _db.from('partner_venue_categories').select().eq('is_active', true).order('sort_order', ascending: true));

  @override
  Future<List<JsonRow>> partnerVenues(String? categoryKey) async {
    var q = _db.from('partner_venues_public').select();
    if (categoryKey != null && categoryKey != 'all') q = q.eq('category_key', categoryKey);
    return _rows(await q.order('is_featured', ascending: false).order('sort_order', ascending: true));
  }
}

/// The commerce data access. Tests override it with a fake.
final commerceBackendProvider = Provider<CommerceBackend>((ref) => SupabaseCommerceBackend(ref.watch(dbProvider)));

/// `getBackendConfig().url` (part of the query keys; '' before the backend opened).
final commerceBackendUrlProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

/// `await error.context.json()` of a functions error: the parsed body, else null.
Object? functionErrorBody(Object? error) => error is FunctionException ? error.details : null;

/// `{message, error, code}` text of any error shape (JS errors, PostgREST, functions bodies, strings).
String errorText(Object? error) {
  if (error == null) return '';
  if (error is String) return error;
  if (error is Map) return [error['message'], error['error'], error['code']].whereType<String>().join(' ');
  if (error is PostgrestException) return [error.message, error.code ?? ''].join(' ');
  if (error is FunctionException) {
    final d = error.details;
    return [errorText(d), error.reasonPhrase ?? ''].join(' ');
  }
  return error.toString();
}
