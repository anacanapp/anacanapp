// Ported from: src/hooks/useDynamicContent.ts, src/lib/name-collections.ts (via name_collections.dart)
//
// Same keys as React (note the underscores: `['safety_items', …]`, `['hospital_bag_templates', …]` are different
// cache entries from useDynamicTools' `['safety-items', …]` / `['hospital-bag-templates', …]`). `useWeeklyTips` is
// ported by the home feature (features/home/data/pregnancy_content.dart, same key) and not duplicated.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/cache/cache.dart';
import '../../../core/content_packs/row_translation.dart' show BundledContentLookup;
import '../../../core/data/data.dart' show Rows, mapRowsTranslation;
import '../../../state/user_store.dart';
import 'name_collections.dart';
import 'tools_data_source.dart';

const Duration _fiveMinutes = Duration(minutes: 5);

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

/// The queryFn body of `useRecipes` after the fetch. `category` keeps its source value (filter / free-tier grouping
/// key); the localized text goes to `categoryLabel`. Frontend defaults: emoji 🍽️, calories 0, stage = source
/// category, benefits [].
Rows shapeRecipes(Rows data, String language, {BundledContentLookup? lookup}) {
  const fields = ['title', 'description', 'category', 'ingredients', 'instructions', 'tags'];
  final mapped = lookup == null ? mapRowsTranslation(data, language, fields) : mapRowsTranslation(data, language, fields, lookup: lookup);
  return [
    for (var i = 0; i < mapped.length; i++)
      {
        ...mapped[i],
        'category': data[i]['category'] ?? '',
        'categoryLabel': mapped[i]['category'],
        'ingredients': mapped[i]['ingredients'] is List ? mapped[i]['ingredients'] : <dynamic>[],
        'instructions': mapped[i]['instructions'] is List ? mapped[i]['instructions'] : <dynamic>[],
        'emoji': '🍽️',
        'calories': 0,
        'stage': data[i]['category'] ?? '',
        'benefits': <dynamic>[],
      },
  ];
}

/// `useRecipes()` → `['recipes', language]` (`admin_recipes`, newest first, 5 min).
final recipesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['recipes', language],
    staleTime: _fiveMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async => shapeRecipes(
        await source.select(const TableQuery('admin_recipes', eq: {'is_active': true}, order: [(column: 'created_at', ascending: false)])),
        language),
  );
}, name: 'recipesQuery');

/// `useSafetyItems()` (useDynamicContent) → `['safety_items', language]`, ordered by name_az.
final safetyItemsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['safety_items', language],
    staleTime: _fiveMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
        await source.select(const TableQuery('safety_items', eq: {'is_active': true}, order: [(column: 'name_az', ascending: true)])),
        language,
        const ['name', 'description']),
  );
}, name: 'safetyItemsQuery');

/// The `baby_names_db` read of `useBabyNames`: the `lang` collection; when the column is missing (an error message
/// mentioning `lang`), the legacy `origin_en` marker (English = not null, otherwise null).
Future<Rows> fetchBabyNames(ToolsDataSource source, String targetLang) async {
  const byPopularity = [(column: 'popularity', ascending: false)];
  try {
    return await source.select(TableQuery('baby_names_db', eq: {'is_active': true, 'lang': targetLang}, order: byPopularity));
  } on PostgrestException catch (e) {
    if (!RegExp('lang').hasMatch(e.message)) rethrow;
    return source.select(TableQuery('baby_names_db',
        eq: const {'is_active': true},
        notNull: targetLang == 'en' ? const ['origin_en'] : const [],
        isNull: targetLang == 'en' ? const [] : const ['origin_en'],
        order: byPopularity));
  }
}

/// `useBabyNames(countryCode)` → `['baby_names', language, countryCode]`.
final babyNamesQuery = queryProviderFamily<Rows, String?>((ref, countryCode) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['baby_names', language, countryCode],
    staleTime: _fiveMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async =>
        mapRowsTranslation(await fetchBabyNames(source, nameCollectionLanguage(countryCode, language)), language, const ['meaning', 'origin']),
  );
}, name: 'babyNamesQuery');

/// `useHospitalBagTemplates()` (useDynamicContent) → `['hospital_bag_templates', language]`: active rows, item_name.
final hospitalBagTemplatesContentQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['hospital_bag_templates', language],
    staleTime: _fiveMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
        await source.select(const TableQuery('hospital_bag_templates', eq: {'is_active': true}, order: [(column: 'sort_order', ascending: true)])),
        language,
        const ['item_name']),
  );
}, name: 'hospitalBagTemplatesContentQuery');

/// The queryFn body of `useNutritionTips` after the fetch (nutrients / benefits arrays, emoji 🍎).
Rows shapeNutritionTips(Rows data, String language) => [
      for (final item in mapRowsTranslation(data, language, const ['title', 'content']))
        {
          ...item,
          'nutrients': item['nutrients'] is List ? item['nutrients'] : <dynamic>[],
          'emoji': '🍎',
          'benefits': item['nutrients'] is List ? item['nutrients'] : <dynamic>[],
        },
    ];

/// `useNutritionTips()` → `['nutrition_tips', language]` (newest first).
final nutritionTipsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['nutrition_tips', language],
    staleTime: _fiveMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async => shapeNutritionTips(
        await source.select(const TableQuery('nutrition_tips', eq: {'is_active': true}, order: [(column: 'created_at', ascending: false)])),
        language),
  );
}, name: 'nutritionTipsQuery');
