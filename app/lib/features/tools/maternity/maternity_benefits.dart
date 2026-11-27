// Ported from: src/hooks/useMaternityBenefits.ts (useMaternityBenefits; the admin hook stays web)
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/net/backend_providers.dart';
import '../../../domain/maternity/maternity_rules.dart';
import '../../../state/user_store.dart';

abstract interface class MaternityRepository {
  /// `maternity_config`: `select('*').eq('is_active', true)`.
  Future<List<Map<String, dynamic>>> config();

  /// `maternity_guidelines`: `select('*').eq('is_active', true).order('sort_order')`.
  Future<List<Map<String, dynamic>>> guidelines();
}

class SupabaseMaternityRepository implements MaternityRepository {
  SupabaseMaternityRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> config() async =>
      [for (final r in await _client().from('maternity_config').select().eq('is_active', true)) Map<String, dynamic>.from(r)];

  @override
  Future<List<Map<String, dynamic>>> guidelines() async => [
        for (final r in await _client().from('maternity_guidelines').select().eq('is_active', true).order('sort_order', ascending: true))
          Map<String, dynamic>.from(r),
      ];
}

final maternityRepositoryProvider = Provider<MaternityRepository>((ref) => SupabaseMaternityRepository(() => ref.read(supabaseClientProvider)));

@immutable
class MaternityBenefits {
  const MaternityBenefits({this.config, this.guidelines = const []});

  /// Null when the fetch failed (the AZ benefit then follows the static rules).
  final MaternityConfig? config;

  /// Translated title / content rows.
  final List<Map<String, dynamic>> guidelines;
}

/// `useMaternityBenefits()`: refetched per language (React: `useEffect(fetchData, [language])`).
final maternityBenefitsQuery = queryProvider<MaternityBenefits>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final repo = ref.watch(maternityRepositoryProvider);
  return QueryOptions<MaternityBenefits>(
    queryKey: ['maternity-benefits', language],
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async {
      try {
        final results = await Future.wait([repo.config(), repo.guidelines()]);
        final rows = [
          for (final r in results[0])
            {'config_key': r['config_key'], 'value': r['value'] is num ? r['value'] : num.tryParse('${r['value']}') ?? 0},
        ];
        return MaternityBenefits(
          config: MaternityConfig.fromRows(rows.cast<Map<String, Object?>>()),
          guidelines: mapRowsTranslation(results[1], language, const ['title', 'content']),
        );
      } catch (e) {
        debugPrint('Error fetching maternity data: $e');
        return const MaternityBenefits();
      }
    },
  );
}, name: 'maternityBenefitsQuery');
