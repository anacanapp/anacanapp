// Ported from: src/hooks/useBanners.ts (useBanners, useIncrementBannerClick, useIncrementBannerImpression)
//
// Inventory per placement with full targeting: v3 (tier / pregnancy week / child age evaluated server-side) or
// v2 through `get_banner_inventory_vN`; the legacy table read (stage / language / country filters and the
// per-user impression cap) when signed out or neither RPC exists. A backend without v3 is remembered for the
// session so each slot does not pay a failing call. The admin mutations of useBanners.ts are web-only.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../state/shell_bindings.dart' show backendUrlProvider;
import '../../../state/user_store.dart';
import 'banner.dart';

class BannerRpcError implements Exception {
  const BannerRpcError({this.code, this.message});
  final String? code;
  final String? message;
  @override
  String toString() => 'BannerRpcError($code, $message)';
}

/// Data access of the inventory (overridable in tests).
abstract interface class BannersSource {
  /// `supabase.rpc(name, args)`: rows, or throws [BannerRpcError] (`code` = PostgREST / SQLSTATE code).
  Future<List<Map<String, dynamic>>> rpc(String name, Map<String, Object?> args);

  /// `banners` where active (+ placement), ordered by sort_order, with the `.or()` targeting filters.
  Future<List<Map<String, dynamic>>> table({String? placement, String? lifeStage, required String language, String? countryCode});

  /// `banner_impressions(banner_id, seen_count)` of [userId] for [bannerIds].
  Future<List<Map<String, dynamic>>> impressions(String userId, List<String> bannerIds);

  Future<void> incrementClick(String id);
  Future<void> incrementImpression(String id);
}

class SupabaseBannersSource implements BannersSource {
  SupabaseBannersSource(this.db);
  final Db Function() db;

  @override
  Future<List<Map<String, dynamic>>> rpc(String name, Map<String, Object?> args) async {
    try {
      return asRows(await db().rpc<Object?>(name, params: args));
    } on PostgrestException catch (e) {
      throw BannerRpcError(code: e.code, message: e.message);
    }
  }

  @override
  Future<List<Map<String, dynamic>>> table({String? placement, String? lifeStage, required String language, String? countryCode}) async {
    var query = db().from('banners').select().eq('is_active', true);
    if (placement != null) query = query.eq('placement', placement);
    if (lifeStage != null && lifeStage.isNotEmpty) query = query.or('target_life_stages.is.null,target_life_stages.eq.{},target_life_stages.cs.{$lifeStage}');
    query = query.or('target_languages.is.null,target_languages.eq.{},target_languages.cs.{$language}');
    if (countryCode != null && countryCode.isNotEmpty) query = query.or('target_countries.is.null,target_countries.eq.{},target_countries.cs.{$countryCode}');
    return asRows(await query.order('sort_order', ascending: true));
  }

  @override
  Future<List<Map<String, dynamic>>> impressions(String userId, List<String> bannerIds) async {
    try {
      return asRows(await db().from('banner_impressions').select('banner_id, seen_count').eq('user_id', userId).inFilter('banner_id', bannerIds));
    } catch (_) {
      return const [];
    }
  }

  @override
  Future<void> incrementClick(String id) async {
    try {
      await db().rpc<Object?>('increment_banner_click', params: {'p_banner_id': id});
    } catch (_) {}
  }

  @override
  Future<void> incrementImpression(String id) async {
    try {
      await db().rpc<Object?>('increment_banner_impression', params: {'p_banner_id': id});
    } catch (_) {}
  }
}

List<Map<String, dynamic>> asRows(Object? data) => data is List ? [for (final r in data) if (r is Map) Map<String, dynamic>.from(r)] : const [];

final bannersSourceProvider = Provider<BannersSource>((ref) => SupabaseBannersSource(() => ref.read(dbProvider)));

/// Backends without the v3 runtime (per process).
final Set<String> _inventoryV3Missing = <String>{};

/// `useBanners(placement)` inputs.
typedef BannersQueryInputs = ({String backend, String language, String? lifeStage, String countryCode, String? userId});

final bannersInputsProvider = Provider<BannersQueryInputs>((ref) {
  final store = ref.watch(userStoreProvider.select((s) => (language: s.language, country: s.countryCode)));
  final profile = ref.watch(authProfileProvider);
  final profileCountry = profile?.countryCode;
  return (
    backend: ref.watch(backendUrlProvider),
    language: store.language,
    lifeStage: profile?.lifeStage,
    countryCode: ((profileCountry != null && profileCountry.isNotEmpty ? profileCountry : null) ?? store.country ?? '').toUpperCase(),
    userId: ref.watch(authUserProvider.select((u) => u?.id)),
  );
});

Future<List<Banner>> fetchBanners(BannersSource source, BannersQueryInputs inputs, String? placement) async {
  final language = inputs.language, userId = inputs.userId;
  if (userId != null && placement != null) {
    // v3 evaluates tier / pregnancy-week / child-age targeting server-side; v2 is the compatibility path until
    // the v3 runtime is installed on this backend.
    for (final name in const ['get_banner_inventory_v3', 'get_banner_inventory_v2']) {
      if (name.endsWith('v3') && _inventoryV3Missing.contains(inputs.backend)) continue;
      try {
        final rows = await source.rpc(name, {'p_actor': userId, 'p_placement': placement, 'p_language': language});
        return [for (final r in mapRowsTranslation(rows, language, const ['title', 'description', 'button_text'])) Banner.fromRow(r)];
      } on BannerRpcError catch (error) {
        if (!const ['PGRST202', '42883'].contains(error.code)) rethrow;
        if (name.endsWith('v3')) _inventoryV3Missing.add(inputs.backend);
      }
    }
  }
  final lifeStage = inputs.lifeStage;
  final data = await source.table(
    placement: placement,
    lifeStage: lifeStage,
    language: language,
    countryCode: inputs.countryCode.isEmpty ? null : inputs.countryCode,
  );
  var rows = [for (final r in mapRowsTranslation(data, language, const ['title', 'description', 'button_text'])) Banner.fromRow(r)];
  final capped = [for (final b in rows) if (b.maxImpressionsPerUser != null) b.id];
  if (userId != null && capped.isNotEmpty) {
    final seen = <String, num>{
      for (final i in await source.impressions(userId, capped))
        if (i['seen_count'] is num) '${i['banner_id']}': i['seen_count'] as num,
    };
    rows = rows.where((b) => b.maxImpressionsPerUser == null || (seen[b.id] ?? 0) < b.maxImpressionsPerUser!).toList();
  }
  return rows;
}

/// `useBanners(placement)`: 5 min stale, 30 min gc, no focus refetch (admin mutations invalidate ['banners']).
final bannersQuery = queryProviderFamily<List<Banner>, String?>((ref, placement) {
  final inputs = ref.watch(bannersInputsProvider);
  return QueryOptions<List<Banner>>(
    queryKey: ['banners', inputs.backend, placement, inputs.language, inputs.lifeStage, inputs.countryCode, inputs.userId],
    staleTime: const Duration(minutes: 5),
    gcTime: const Duration(minutes: 30),
    refetchOnWindowFocus: RefetchOn.never,
    codec: QueryCodecs.models<Banner>((b) => b.toRow(), Banner.fromRow),
    queryFn: (_) => fetchBanners(ref.read(bannersSourceProvider), inputs, placement),
  );
}, name: 'bannersQuery');

/// Test hook: forget the per-process "v3 missing" memory.
void resetBannerInventoryMemory() => _inventoryV3Missing.clear();
