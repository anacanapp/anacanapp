// Ported from: src/hooks/useDynamicConfig.ts (read hooks)
//
// Same keys, filters and 10 min staleTime as React. `useBabyMilestonesDB` is ported by the baby feature
// (features/baby/hooks/use_content_queries.dart `babyMilestonesDbQuery`, same key) and not duplicated. The
// `use*Admin` CRUD hooks are admin-panel only (the admin stays web) and are not ported.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Rows, mapRowsTranslation;
import '../../../state/user_store.dart';
import 'followup_content.dart';
import 'tools_data_source.dart';

const Duration _tenMinutes = Duration(minutes: 10);

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

QueryOptions<Rows> _list(Ref ref, List<Object?> key, TableQuery query, Rows Function(Rows rows) shape) {
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: key,
    staleTime: _tenMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async => shape(await source.select(query)),
  );
}

const _bySort = [(column: 'sort_order', ascending: true)];

/// `steps: Array.isArray(e.steps) ? e.steps : JSON.parse(e.steps || '[]')`.
Map<String, dynamic> withParsedSteps(Map<String, dynamic> e) {
  final steps = e['steps'];
  if (steps is List) return e;
  final text = steps is String && steps.isNotEmpty ? steps : '[]';
  // JSON.parse throws on invalid JSON, which turns the query into an error (as in the hook).
  return {...e, 'steps': jsonDecode(text)};
}

/// `useExercises()` → `['exercises', language]`: mapFollowupContent(name, description, steps), steps parsed.
final exercisesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['exercises', language],
    staleTime: _tenMinutes,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final rows = await source.select(const TableQuery('exercises', eq: {'is_active': true}, order: _bySort));
      final values = await ref.read(followupContentValuesProvider.future);
      return mapFollowupContent(rows, language, const ['name', 'description', 'steps'], values: values).map(withParsedSteps).toList();
    },
  );
}, name: 'exercisesQuery');

/// `useWhiteNoiseSounds()` → `['white-noise-sounds', language]`.
final whiteNoiseSoundsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _list(ref, ['white-noise-sounds', language], const TableQuery('white_noise_sounds', eq: {'is_active': true}, order: _bySort),
      (rows) => mapRowsTranslation(rows, language, const ['name', 'description']));
}, name: 'whiteNoiseSoundsQuery');

/// `usePhotoshootThemes(category)` → `['photoshoot-themes', category, language]`.
final photoshootThemesQuery = queryProviderFamily<Rows, String?>((ref, category) {
  final language = _language(ref);
  return _list(
      ref,
      ['photoshoot-themes', category, language],
      TableQuery('photoshoot_themes', eq: {'is_active': true, if (category != null && category.isNotEmpty) 'category': category}, order: _bySort),
      (rows) => mapRowsTranslation(rows, language, const ['name', 'prompt_text']));
}, name: 'photoshootThemesQuery');

/// `useSurpriseIdeas()` → `['surprise-ideas', language]`.
final surpriseIdeasQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _list(ref, ['surprise-ideas', language], const TableQuery('surprise_ideas', eq: {'is_active': true}, order: _bySort),
      (rows) => mapRowsTranslation(rows, language, const ['title', 'description']));
}, name: 'surpriseIdeasQuery');

/// `useSymptoms(lifeStage)` → `['symptoms', lifeStage, language]`, filtered to rows whose `life_stages` contain it.
final symptomsQuery = queryProviderFamily<Rows, String?>((ref, lifeStage) {
  final language = _language(ref);
  return _list(ref, ['symptoms', lifeStage, language], const TableQuery('symptoms', eq: {'is_active': true}, order: _bySort), (rows) {
    final mapped = mapRowsTranslation(rows, language, const ['label']);
    if (lifeStage == null || lifeStage.isEmpty) return mapped;
    return mapped.where((s) => s['life_stages'] is List && (s['life_stages'] as List).contains(lifeStage)).toList();
  });
}, name: 'symptomsQuery');

/// `useMoodOptions()` → `['mood-options', language]` (ordered by value).
final moodOptionsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _list(ref, ['mood-options', language],
      const TableQuery('mood_options', eq: {'is_active': true}, order: [(column: 'value', ascending: true)]),
      (rows) => mapRowsTranslation(rows, language, const ['label']));
}, name: 'moodOptionsQuery');

/// `useCommonFoods()` → `['common-foods', language]`.
final commonFoodsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _list(ref, ['common-foods', language], const TableQuery('common_foods', eq: {'is_active': true}, order: _bySort),
      (rows) => mapRowsTranslation(rows, language, const ['name']));
}, name: 'commonFoodsQuery');

/// useDynamicConfig's `useShopCategories()`: the same key as useDynamicTools' (`shopCategoriesQuery`) with a
/// 10 min staleTime.
final shopCategoriesConfigQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _list(ref, ['shop-categories', language], const TableQuery('shop_categories', eq: {'is_active': true}, order: _bySort),
      (rows) => mapRowsTranslation(rows, language, const ['name']));
}, name: 'shopCategoriesConfigQuery');
