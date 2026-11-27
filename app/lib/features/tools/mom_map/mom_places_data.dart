// Ported from: src/hooks/useMomFriendlyPlaces.ts (useMomFriendlyPlaces, usePlaceReviews, useAddPlace, useAddReview),
//              src/hooks/usePlacesConfig.ts (usePlaceCategories, usePlaceAmenities, FALLBACK_CATEGORIES,
//              FALLBACK_AMENITIES)
//
// Same query keys, filters and stale times as the React hooks; reads and writes go through the tools' [HealthDb]
// seam. `useVerifyAmenity` has no caller in the consumer app and is not ported.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../state/user_store.dart';
import '../health_common/health_db.dart';

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

/// `usePlaceCategories()` → `['place-categories', language]` (30 min).
final placeCategoriesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['place-categories', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('place_categories', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['label'],
    ),
  );
}, name: 'placeCategoriesQuery');

/// `usePlaceAmenities()` → `['place-amenities', language]` (30 min).
final placeAmenitiesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['place-amenities', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('place_amenities', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['label'],
    ),
  );
}, name: 'placeAmenitiesQuery');

/// The filters of `useMomFriendlyPlaces({ category, amenities })`.
typedef MomPlaceFilters = ({String category, List<String> amenities});

/// `useMomFriendlyPlaces(filters)` → `['mom-friendly-places', filters, language]` (5 min). Amenity columns are
/// filtered on the server (`.eq(amenity, true)` for each, AND).
final momFriendlyPlacesQuery = queryProviderFamily<Rows, MomPlaceFilters>((ref, filters) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: [
      'mom-friendly-places',
      {'category': filters.category, 'amenities': filters.amenities},
      language,
    ],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final rows = await db.select(
        HQuery(
          'mom_friendly_places',
          filters: [
            eqF('is_active', true),
            if (filters.category.isNotEmpty && filters.category != 'all') eqF('category', filters.category),
            for (final amenity in filters.amenities) eqF(amenity, true),
          ],
          order: const [(column: 'avg_rating', ascending: false)],
        ),
      );
      return mapRowsTranslation(rows, language, const ['name', 'description', 'address']);
    },
  );
}, name: 'momFriendlyPlacesQuery');

/// `usePlaceReviews(placeId)` → `['place-reviews', placeId]` (verified reviews, newest first).
final placeReviewsQuery = queryProviderFamily<Rows, String>((ref, placeId) {
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['place-reviews', placeId],
    enabled: placeId.isNotEmpty,
    codec: QueryCodecs.rows,
    queryFn: (_) => db.select(
      HQuery('place_reviews', filters: [eqF('place_id', placeId), eqF('is_verified', true)], order: const [(column: 'created_at', ascending: false)]),
    ),
  );
}, name: 'placeReviewsQuery');

/// `useAddPlace().mutateAsync(place)`: hidden until an admin approves it (`is_active: false`).
Future<Row> addMomPlace(HealthDb db, String userId, Map<String, dynamic> place) => db.insert('mom_friendly_places', {
  'name': place['name'] ?? '',
  'latitude': place['latitude'] ?? 0,
  'longitude': place['longitude'] ?? 0,
  'category': place['category'] ?? 'cafe',
  ...place,
  'is_active': false,
  'is_verified': false,
  'created_by': userId,
});

/// `useAddReview().mutateAsync(review)`.
Future<Row> addPlaceReview(HealthDb db, String userId, Map<String, dynamic> review) => db.insert('place_reviews', {...review, 'user_id': userId});

/// `FALLBACK_CATEGORIES` (offline / loading).
List<Row> fallbackPlaceCategories() => [
  {'category_key': 'all', 'label': tr('useplacesconfig_hamisi_c73c4d', 'Hamısı'), 'icon_name': 'MapPin', 'color_gradient': 'from-pink-500 to-rose-600'},
  // usePlacesConfig.ts keeps these labels as plain literals (no tr).
  {'category_key': 'cafe', 'label': 'Kafe', 'icon_name': 'Utensils', 'color_gradient': 'from-amber-500 to-orange-600'},
  {'category_key': 'restaurant', 'label': 'Restoran', 'icon_name': 'Utensils', 'color_gradient': 'from-red-500 to-rose-600'},
  {'category_key': 'mall', 'label': 'Mall', 'icon_name': 'Building2', 'color_gradient': 'from-blue-500 to-indigo-600'},
  {'category_key': 'park', 'label': 'Park', 'icon_name': 'TreePine', 'color_gradient': 'from-emerald-500 to-green-600'},
];

/// `FALLBACK_AMENITIES`.
List<Row> fallbackPlaceAmenities() => [
  {'amenity_key': 'has_breastfeeding_room', 'label': tr('useplacesconfig_emizdirme_otagi_029c1d', 'Əmizdirmə otağı'), 'emoji': '🤱'},
  {'amenity_key': 'has_changing_table', 'label': tr('useplacesconfig_deyisdirme_masasi_99a9aa', 'Dəyişdirmə masası'), 'emoji': '👶'},
  // usePlacesConfig.ts literal.
  {'amenity_key': 'has_elevator', 'label': 'Lift', 'emoji': '🛗'},
];
