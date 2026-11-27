// Ported from: src/components/tools/DoctorsHospitals.tsx (healthcare-providers / healthcare-provider queries and the
//              translation at render), src/hooks/useProviderReviews.ts
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../state/user_store.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

/// The country whose providers are listed: the saved account country, else the store's, else the language's.
final healthcareCountryProvider = Provider<String>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final store = ref.watch(userStoreProvider.select((s) => s.countryCode));
  final profile = ref.watch(authProfileProvider.select((p) => p?.countryCode));
  return regionalCountry(language, [profile, store]);
});

/// `['healthcare-providers', activeCountry, backendUrl]` (the language is not in the key: the list never depends on
/// it; only the shown text is translated at render).
final healthcareProvidersQuery = queryProvider<Rows>((ref) {
  final country = ref.watch(healthcareCountryProvider);
  final backend = ref.watch(healthBackendUrlProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['healthcare-providers', country, backend],
    codec: QueryCodecs.rows,
    queryFn: (_) => db.select(HQuery('healthcare_providers', filters: [
      const (column: 'is_active', op: 'eq', value: true),
      eqF('country_code', country),
    ], order: const [(column: 'is_featured', ascending: false), (column: 'rating', ascending: false)])),
  );
}, name: 'healthcareProvidersQuery');

/// The render-time translation of the providers (name, specialty, description, address, service names).
Rows translateProviders(Rows providers, String language) => [
      for (final p in mapRowsTranslation(providers, language, const ['name', 'specialty', 'description', 'address']))
        {
          ...p,
          if (p['services'] is List)
            'services': [
              for (final s in p['services'] as List)
                if (s is Map)
                  {
                    ...Map<String, dynamic>.from(s),
                    'name': language == 'az' ? (s['name_az'] ?? s['name']) : (s['name_$language'] ?? s['name_az'] ?? s['name']),
                  }
                else
                  s,
            ],
        },
    ];

/// The list filter of a chip (`all`, `hospital`, `gynecology`, `ivf`, `pediatrics`, `mammology`) + the search text.
bool providerMatches(Row p, String filter, String search) {
  final name = '${p['name'] ?? ''}'.toLowerCase();
  final specialty = '${p['specialty'] ?? ''}'.toLowerCase();
  final q = search.toLowerCase();
  final matchesSearch = name.contains(q) || specialty.contains(q);
  final type = p['provider_type'];
  final bool matchesFilter = switch (filter) {
    'all' => true,
    'hospital' => type == 'hospital' || type == 'clinic',
    'gynecology' => type == 'doctor' && (specialty.contains('ginekoloq') || specialty.contains('mama')),
    'ivf' => type == 'doctor' && (specialty.contains('ivf') || specialty.contains('fertillik')),
    'pediatrics' => type == 'doctor' && (specialty.contains('pediatr') || specialty.contains('neonatoloq') || specialty.contains(tr('doctorshospitals_usaq_36b348', 'uşaq'))),
    'mammology' => type == 'doctor' && (specialty.contains('mamoloq') || specialty.contains('onkoloq')),
    _ => false,
  };
  return matchesSearch && matchesFilter;
}

/// `['healthcare-provider', id]`: the latest rating / review count.
final healthcareProviderQuery = queryProviderFamily<Row?, String>((ref, id) {
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Row?>(
    queryKey: ['healthcare-provider', id],
    codec: QueryCodecs.maybeRow,
    queryFn: (_) => db.maybeSingle(HQuery('healthcare_providers', columns: 'rating, review_count', filters: [eqF('id', id)])),
  );
}, name: 'healthcareProviderQuery');

/// `['provider-reviews', providerId]`: active reviews, newest first, with the author's name / avatar.
final providerReviewsQuery = queryProviderFamily<Rows, String>((ref, providerId) {
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['provider-reviews', providerId],
    enabled: providerId.isNotEmpty,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final data = await db.select(HQuery('healthcare_provider_reviews',
          filters: [eqF('provider_id', providerId), const (column: 'is_active', op: 'eq', value: true)], order: const [(column: 'created_at', ascending: false)]));
      final userIds = {for (final r in data) r['user_id']}.toList();
      Rows profiles = const [];
      try {
        profiles = await db.select(HQuery('profiles', columns: 'user_id, name, avatar_url', filters: [inF('user_id', userIds)]));
      } catch (_) {}
      final byUser = {for (final p in profiles) p['user_id']: p};
      return [
        for (final r in data)
          {
            ...r,
            'user_name': (byUser[r['user_id']]?['name'] is String && (byUser[r['user_id']]!['name'] as String).isNotEmpty)
                ? byUser[r['user_id']]!['name']
                : tr('useproviderreviews_i_stifadeci_b6bdd6', 'İstifadəçi'),
            'user_avatar': byUser[r['user_id']]?['avatar_url'],
          },
      ];
    },
  );
}, name: 'providerReviewsQuery');

/// `['user-review', providerId, userId]`.
final userReviewQuery = queryProviderFamily<Row?, String>((ref, providerId) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Row?>(
    queryKey: ['user-review', providerId, userId],
    enabled: providerId.isNotEmpty && userId != null,
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async {
      if (userId == null) return null;
      return db.maybeSingle(HQuery('healthcare_provider_reviews', filters: [eqF('provider_id', providerId), eqF('user_id', userId)]));
    },
  );
}, name: 'userReviewQuery');

class ProviderReviewActions {
  ProviderReviewActions(this._ref);
  final Ref _ref;

  void _invalidate(String providerId) {
    final qc = _ref.read(queryClientProvider);
    unawaited(qc.invalidateQueries(queryKey: ['provider-reviews', providerId]));
    unawaited(qc.invalidateQueries(queryKey: ['user-review', providerId]));
    unawaited(qc.invalidateQueries(queryKey: const ['healthcare-providers']));
  }

  /// `submitReview`: upsert on (provider_id, user_id).
  Future<void> submit(String providerId, {required int rating, required String comment}) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) throw StateError(tr('useproviderreviews_i_stifadeci_daxil_olmayib_96484b', 'İstifadəçi daxil olmayıb'));
    await _ref.read(healthDbProvider).upsert(
          'healthcare_provider_reviews',
          {'provider_id': providerId, 'user_id': userId, 'rating': rating, 'comment': comment.isEmpty ? null : comment, 'updated_at': DateTime.now().toUtc().toIso8601String()},
          onConflict: 'provider_id,user_id',
        );
    _invalidate(providerId);
  }

  /// `deleteReview`.
  Future<void> delete(String providerId) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) throw StateError(tr('useproviderreviews_i_stifadeci_daxil_olmayib_96484b', 'İstifadəçi daxil olmayıb'));
    await _ref.read(healthDbProvider).delete('healthcare_provider_reviews', [eqF('provider_id', providerId), eqF('user_id', userId)]);
    _invalidate(providerId);
  }
}

final providerReviewActionsProvider = Provider<ProviderReviewActions>(ProviderReviewActions.new);

/// Realtime of one provider's reviews: refreshes only its reviews and rating (not the whole list).
final providerReviewsLiveProvider = Provider.autoDispose.family<void, String>((ref, providerId) {
  ref.read(healthRealtimeProvider).subscribe(ref, channelPrefix: 'provider-$providerId', table: 'healthcare_provider_reviews', filter: 'provider_id=eq.$providerId', onChange: () {
    final qc = ref.read(queryClientProvider);
    unawaited(qc.invalidateQueries(queryKey: ['provider-reviews', providerId]));
    unawaited(qc.invalidateQueries(queryKey: ['healthcare-provider', providerId]));
  });
});
