// Ported from: src/hooks/usePaymentMethods.ts (get_active_payment_methods), src/hooks/useCoupons.ts (coupons,
//              coupon_usage, increment_coupon_usage), src/components/shop/AlbumOrderScreen.tsx (proof upload to
//              `assets/album-proofs/<user>/<ms>.<ext>`, `album_orders` insert)
//
// Tests override [albumOrderBackendProvider] with a fake.
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/data.dart';

abstract interface class AlbumOrderBackend {
  /// `rpc('get_active_payment_methods')` (the public projection without `config`).
  Future<Rows> activePaymentMethods();

  /// `coupons` row with this upper-cased code that is active; null when missing or on error (`.single()`).
  Future<Row?> activeCoupon(String code);

  /// Whether the user already has a `coupon_usage` row for the coupon.
  Future<bool> couponUsedBy(String couponId, String userId);

  /// `coupon_usage` insert + `increment_coupon_usage` RPC.
  Future<void> recordCouponUsage({required String couponId, required String userId, required String orderType, String? orderId, required double discountAmount});

  /// Uploads a payment proof to `assets`; the public URL, or null when the upload failed.
  Future<String?> uploadProof(String path, Uint8List bytes, {String? contentType});

  /// `album_orders` insert; throws on error.
  Future<void> insertAlbumOrder(Map<String, dynamic> row);
}

class SupabaseAlbumOrderBackend implements AlbumOrderBackend {
  SupabaseAlbumOrderBackend(this.db);
  final Db db;

  @override
  Future<Rows> activePaymentMethods() async => asRows(await db.rpc<Object?>('get_active_payment_methods'));

  @override
  Future<Row?> activeCoupon(String code) async {
    try {
      return asRow(await db.from('coupons').select().eq('code', code.trim().toUpperCase()).eq('is_active', true).single());
    } catch (_) {
      return null;
    }
  }

  @override
  Future<bool> couponUsedBy(String couponId, String userId) async {
    final res = await db.query<Object?>(() => db.from('coupon_usage').select('id').eq('coupon_id', couponId).eq('user_id', userId));
    final data = res.data;
    return data is List && data.isNotEmpty;
  }

  @override
  Future<void> recordCouponUsage({required String couponId, required String userId, required String orderType, String? orderId, required double discountAmount}) async {
    await db.from('coupon_usage').insert({
      'coupon_id': couponId,
      'user_id': userId,
      'order_type': orderType,
      'order_id': orderId,
      'discount_amount': discountAmount,
    });
    // used_count is admin-only under RLS; the server-side RPC increments it atomically (limit check included).
    final rpc = await db.rpcResult('increment_coupon_usage', params: {'p_coupon_id': couponId});
    if (!rpc.ok) throw rpc.error!;
  }

  @override
  Future<String?> uploadProof(String path, Uint8List bytes, {String? contentType}) async {
    final res = await db.upload('assets', path, bytes, contentType: contentType);
    if (!res.ok) return null;
    return db.publicUrl('assets', path);
  }

  @override
  Future<void> insertAlbumOrder(Map<String, dynamic> row) async {
    await db.from('album_orders').insert(row);
  }
}

final albumOrderBackendProvider = Provider<AlbumOrderBackend>((ref) => SupabaseAlbumOrderBackend(ref.watch(dbProvider)), name: 'albumOrderBackendProvider');
