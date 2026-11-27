// Ported from: src/hooks/useAffiliateProducts.ts (useAffiliateProducts, useSavedProducts, useIsProductSaved,
//              useSaveProduct, useUnsaveProduct)
//
// Same query keys, filters and translation fields as the React hooks. `useAffiliateProduct(id)` has no caller in the
// consumer app and is not ported. Every backend call goes through [AffiliateDb] so tests swap in a fake.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Db, Rows, asRow, asRows, dbProvider, mapRowTranslation, mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show toasts;

const List<String> _fields = ['name', 'description', 'category', 'review_summary'];

abstract interface class AffiliateDb {
  /// `from('affiliate_products').select('*').eq('is_active', true).order('is_featured', desc).order('sort_order')`
  /// (+ `.overlaps('life_stages', [lifeStage])`).
  Future<Rows> products(String? lifeStage);

  /// `from('saved_affiliate_products').select('id, created_at, product:affiliate_products(*)').eq('user_id')
  /// .order('created_at', desc)`.
  Future<Rows> saved(String userId);

  /// `select('id').eq('user_id').eq('product_id').maybeSingle()` → a row exists.
  Future<bool> isSaved(String userId, String productId);

  /// `insert({ user_id, product_id })`.
  Future<void> save(String userId, String productId);

  /// `delete().eq('user_id').eq('product_id')`.
  Future<void> unsave(String userId, String productId);
}

class SupabaseAffiliateDb implements AffiliateDb {
  SupabaseAffiliateDb(this._db);
  final Db _db;

  @override
  Future<Rows> products(String? lifeStage) async {
    var q = _db.from('affiliate_products').select().eq('is_active', true);
    if (lifeStage != null && lifeStage.isNotEmpty) q = q.overlaps('life_stages', [lifeStage]);
    return asRows(await q.order('is_featured', ascending: false).order('sort_order', ascending: true));
  }

  @override
  Future<Rows> saved(String userId) async => asRows(await _db
      .from('saved_affiliate_products')
      .select('id, created_at, product:affiliate_products(*)')
      .eq('user_id', userId)
      .order('created_at', ascending: false));

  @override
  Future<bool> isSaved(String userId, String productId) async =>
      asRow(await _db.from('saved_affiliate_products').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle()) != null;

  @override
  Future<void> save(String userId, String productId) async => _db.from('saved_affiliate_products').insert({'user_id': userId, 'product_id': productId});

  @override
  Future<void> unsave(String userId, String productId) async =>
      _db.from('saved_affiliate_products').delete().eq('user_id', userId).eq('product_id', productId);
}

final affiliateDbProvider = Provider<AffiliateDb>((ref) => SupabaseAffiliateDb(ref.watch(dbProvider)), name: 'affiliateDbProvider');

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

/// `useAffiliateProducts(lifeStage)` → `['affiliate-products', lifeStage, language]`.
final affiliateProductsQuery = queryProviderFamily<Rows, String?>((ref, lifeStage) {
  final language = _language(ref);
  final db = ref.watch(affiliateDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['affiliate-products', lifeStage, language],
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await db.products(lifeStage), language, _fields),
  );
}, name: 'affiliateProductsQuery');

/// `useSavedProducts()` → `['saved-affiliate-products', userId, language]`: the joined product, translated, with
/// `savedId` / `savedAt`.
final savedAffiliateProductsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final language = _language(ref);
  final db = ref.watch(affiliateDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['saved-affiliate-products', userId, language],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return const [];
      return [
        for (final item in await db.saved(userId))
          {
            'savedId': item['id'],
            'savedAt': item['created_at'],
            ...?(item['product'] is Map ? mapRowTranslation((item['product'] as Map).cast<String, dynamic>(), language, _fields) : null),
          },
      ];
    },
  );
}, name: 'savedAffiliateProductsQuery');

/// `useIsProductSaved(productId)` → `['is-product-saved', productId, userId]`.
final isAffiliateProductSavedQuery = queryProviderFamily<bool, String>((ref, productId) {
  final userId = ref.watch(authUserProvider)?.id;
  final db = ref.watch(affiliateDbProvider);
  return QueryOptions<bool>(
    queryKey: ['is-product-saved', productId, userId],
    enabled: userId != null && productId.isNotEmpty,
    queryFn: (_) async => userId == null || productId.isEmpty ? false : db.isSaved(userId, productId),
  );
}, name: 'isAffiliateProductSavedQuery');

/// `useSaveProduct().mutate(id)` / `useUnsaveProduct().mutate(id)` with their toasts and invalidations.
Future<void> toggleAffiliateSaved(WidgetRef ref, BuildContext context, String productId, {required bool saved}) async {
  final userId = ref.read(authUserProvider)?.id;
  final db = ref.read(affiliateDbProvider);
  final qc = ref.read(queryClientProvider);
  final toast = toasts(context);
  void invalidate() {
    unawaited(qc.invalidateQueries(queryKey: const ['saved-affiliate-products']));
    unawaited(qc.invalidateQueries(queryKey: ['is-product-saved', productId]));
  }

  if (saved) {
    try {
      if (userId == null) throw StateError(tr('useaffiliateproducts_giris_etmelisiniz_6c2220', 'Giriş etməlisiniz'));
      await db.unsave(userId, productId);
      invalidate();
      // useAffiliateProducts.ts literal title.
      toast.show(title: 'Silindi', description: tr('useaffiliateproducts_mehsul_favoritlerden_silindi_d9717b', 'Məhsul favoritlərdən silindi'));
    } catch (_) {
      // useUnsaveProduct has no onError.
    }
    return;
  }
  try {
    if (userId == null) throw StateError(tr('useaffiliateproducts_giris_etmelisiniz_6c2220', 'Giriş etməlisiniz'));
    await db.save(userId, productId);
    invalidate();
    toast.show(title: tr('useaffiliateproducts_yadda_saxlanildi_cf4f4a', 'Yadda saxlanıldı'), description: tr('useaffiliateproducts_mehsul_favoritlere_elave_edildi_748bcf', 'Məhsul favoritlərə əlavə edildi'));
  } catch (_) {
    toast.show(title: tr('useaffiliateproducts_xeta_3cdbb6', 'Xəta'), description: tr('useaffiliateproducts_mehsul_saxlanila_bilmedi_b71bb7', 'Məhsul saxlanıla bilmədi'), destructive: true);
  }
}
