// Ported from: src/hooks/useDynamicTools.ts, src/lib/code-tools.ts (query filter)
//
// Same query keys and filters as the React hooks. Rows stay `Map<String, dynamic>` (snake_case) after
// `mapRowsTranslation`, except tool configs ([ToolConfig]). The admin-only `useRecipeCategoriesAdmin` is not ported
// (admin panel stays web). `useFaqs` / `useSupportCategories` live in features/support/data/support_tickets.dart
// (`faqsQuery`, `supportCategoriesQuery`, same keys) and are not duplicated here.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Rows, mapRowsTranslation;
import '../../../state/user_store.dart';
import 'code_tools.dart';
import 'tool_config.dart';
import 'tools_data_source.dart';

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

const _noOrder = <({String column, bool ascending})>[];
List<({String column, bool ascending})> _by(String column, [bool ascending = true]) => [(column: column, ascending: ascending)];

/// A translated `select('*').eq('is_active', true).order(sort_order)` list query.
QueryOptions<Rows> _activeList(Ref ref, List<Object?> key, String table, List<String> fields,
    {List<({String column, bool ascending})>? order, Rows Function(Rows rows)? post}) {
  final language = key.last as String;
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: key,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final rows = await source.select(TableQuery(table, eq: const {'is_active': true}, order: order ?? _by('sort_order')));
      final mapped = mapRowsTranslation(rows, language, fields);
      return post == null ? mapped : post(mapped);
    },
  );
}

// ── Safety lookup ──

/// `useSafetyCategories()` → `['safety-categories', language]`.
final safetyCategoriesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['safety-categories', language], 'safety_categories', const ['name']);
}, name: 'safetyCategoriesQuery');

/// `useSafetyItems(categoryId)` → `['safety-items', categoryId, language]` (`category` filter unless all/none).
final safetyItemsByCategoryQuery = queryProviderFamily<Rows, String?>((ref, categoryId) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['safety-items', categoryId, language],
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final filter = categoryId != null && categoryId.isNotEmpty && categoryId != 'all';
      final rows = await source.select(TableQuery('safety_items',
          eq: {'is_active': true, if (filter) 'category': categoryId}, order: _by('name')));
      return mapRowsTranslation(rows, language, const ['name', 'description', 'hazard_notes', 'tips']);
    },
  );
}, name: 'safetyItemsByCategoryQuery');

// ── Shop categories ──

/// `useShopCategories()` → `['shop-categories', language]`. useDynamicConfig's hook of the same name shares the key
/// (with a 10 min staleTime); see [shopCategoriesConfigQuery].
final shopCategoriesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['shop-categories', language], 'shop_categories', const ['name']);
}, name: 'shopCategoriesQuery');

// ── Nutrition ──

/// `useNutritionTargets()` → `['nutrition-targets', language]` (no order).
final nutritionTargetsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['nutrition-targets', language], 'nutrition_targets', const ['title', 'description'], order: _noOrder);
}, name: 'nutritionTargetsQuery');

/// `useMealTypes(lifeStage)` → `['meal-types', lifeStage, language]`, filtered to rows whose `life_stages` contain it.
final mealTypesQuery = queryProviderFamily<Rows, String?>((ref, lifeStage) {
  final language = _language(ref);
  return _activeList(ref, ['meal-types', lifeStage, language], 'meal_types', const ['name'],
      post: (mapped) => lifeStage != null && lifeStage.isNotEmpty
          ? mapped.where((m) => m['life_stages'] is List && (m['life_stages'] as List).contains(lifeStage)).toList()
          : mapped);
}, name: 'mealTypesQuery');

/// `useRecipeCategories()` → `['recipe-categories', language]`.
final recipeCategoriesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['recipe-categories', language], 'recipe_categories', const ['name']);
}, name: 'recipeCategoriesQuery');

// ── Photoshoot ──

/// `bg.gender === 'all' || bg.gender === 'unisex' || bg.gender === gender` when a gender is given.
Rows filterByGender(Rows rows, String? gender) => gender != null && gender.isNotEmpty
    ? rows.where((r) => r['gender'] == 'all' || r['gender'] == 'unisex' || r['gender'] == gender).toList()
    : rows;

/// `usePhotoshootBackgrounds(gender)` → `['photoshoot-backgrounds', gender, language]`, ordered by category_id, sort_order.
final photoshootBackgroundsQuery = queryProviderFamily<Rows, String?>((ref, gender) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-backgrounds', gender, language], 'photoshoot_backgrounds', const ['name', 'prompt_text'],
      order: const [(column: 'category_id', ascending: true), (column: 'sort_order', ascending: true)],
      post: (mapped) => filterByGender(mapped, gender));
}, name: 'photoshootBackgroundsQuery');

/// `usePhotoshootEyeColors()` → `['photoshoot-eye-colors', language]`.
final photoshootEyeColorsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-eye-colors', language], 'photoshoot_eye_colors', const ['name']);
}, name: 'photoshootEyeColorsQuery');

/// `usePhotoshootHairColors()` → `['photoshoot-hair-colors', language]`.
final photoshootHairColorsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-hair-colors', language], 'photoshoot_hair_colors', const ['name']);
}, name: 'photoshootHairColorsQuery');

/// `usePhotoshootHairStyles()` → `['photoshoot-hair-styles', language]`.
final photoshootHairStylesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-hair-styles', language], 'photoshoot_hair_styles', const ['name']);
}, name: 'photoshootHairStylesQuery');

/// `usePhotoshootOutfits(gender)` → `['photoshoot-outfits', gender, language]`.
final photoshootOutfitsQuery = queryProviderFamily<Rows, String?>((ref, gender) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-outfits', gender, language], 'photoshoot_outfits', const ['name', 'prompt_text'],
      post: (mapped) => filterByGender(mapped, gender));
}, name: 'photoshootOutfitsQuery');

/// `usePhotoshootImageStyles()` → `['photoshoot-image-styles', language]`.
final photoshootImageStylesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  return _activeList(ref, ['photoshoot-image-styles', language], 'photoshoot_image_styles', const ['style_name']);
}, name: 'photoshootImageStylesQuery');

// ── Weight recommendations ──

/// `useWeightRecommendations(trimester)` → `['weight-recommendations', trimester, language]` (trimester filter when
/// truthy, ordered by trimester).
final weightRecommendationsQuery = queryProviderFamily<Rows, int?>((ref, trimester) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['weight-recommendations', trimester, language],
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final rows = await source.select(TableQuery('weight_recommendations',
          eq: {'is_active': true, if (trimester != null && trimester != 0) 'trimester': trimester}, order: _by('trimester')));
      return mapRowsTranslation(rows, language, const ['description']);
    },
  );
}, name: 'weightRecommendationsQuery');

// ── AI suggested questions ──

/// `useAISuggestedQuestions(lifeStage, userType)` → `['ai-suggested-questions', lifeStage, userType, language]`.
final aiSuggestedQuestionsQuery = queryProviderFamily<Rows, ({String lifeStage, String userType})>((ref, arg) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['ai-suggested-questions', arg.lifeStage, arg.userType, language],
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final rows = await source.select(TableQuery('ai_suggested_questions',
          eq: {'is_active': true, 'life_stage': arg.lifeStage, 'user_type': arg.userType}, order: _by('sort_order')));
      return mapRowsTranslation(rows, language, const ['question']);
    },
  );
}, name: 'aiSuggestedQuestionsQuery');

// ── Tool configs ──

/// The `.or(...)` of `useToolConfigs`: active rows plus every code tool row.
String get toolConfigsOrFilter => 'is_active.eq.true,tool_id.in.(${kCodeToolIds.join(',')})';

/// Translated fields of `useToolConfigs`.
const List<String> kToolConfigFields = ['name', 'description', 'partner_name', 'partner_description', 'hero_subtitle', 'hero_badge'];

/// The queryFn body after the fetch: live rows, translation, stage-active filter, stage order (stable, like
/// `Array.prototype.sort`; a missing order reads as 0 the way `null - x` does in JS).
List<ToolConfig> shapeToolConfigs(Rows rows, String? lifeStage, String language) {
  final mapped = mapRowsTranslation(rows.where(isToolRowLive).toList(), language, kToolConfigFields).map(ToolConfig.fromRow).toList();
  final filtered = switch (lifeStage) {
    'flow' => mapped.where((t) => t.flowActive != false).toList(),
    'bump' => mapped.where((t) => t.bumpActive != false).toList(),
    'mommy' => mapped.where((t) => t.mommyActive != false).toList(),
    _ => mapped,
  };
  num orderOf(ToolConfig t) => switch (lifeStage) {
        'flow' => t.flowOrder ?? t.sortOrder ?? 0,
        'bump' => t.bumpOrder ?? t.sortOrder ?? 0,
        'mommy' => t.mommyOrder ?? t.sortOrder ?? 0,
        _ => t.sortOrder ?? 0,
      };
  final indexed = [for (var i = 0; i < filtered.length; i++) (i, filtered[i])];
  indexed.sort((a, b) {
    final c = orderOf(a.$2).compareTo(orderOf(b.$2));
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

/// `useToolConfigs(lifeStage)` → `['tool-configs', lifeStage, language]`.
final toolConfigsQuery = queryProviderFamily<List<ToolConfig>, String?>((ref, lifeStage) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<List<ToolConfig>>(
    queryKey: ['tool-configs', lifeStage, language],
    codec: QueryCodecs.models<ToolConfig>((t) => t.toRow(), ToolConfig.fromRow),
    queryFn: (_) async => shapeToolConfigs(await source.select(TableQuery('tool_configs', or: toolConfigsOrFilter)), lifeStage, language),
  );
}, name: 'toolConfigsQuery');

// ── Hospital bag templates ──

/// `useHospitalBagTemplates()` (useDynamicTools) → `['hospital-bag-templates', language]`: every row (no
/// `is_active` filter), item_name + notes translated.
final hospitalBagTemplatesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final source = ref.watch(toolsDataSourceProvider);
  return QueryOptions<Rows>(
    queryKey: ['hospital-bag-templates', language],
    codec: QueryCodecs.rows,
    queryFn: (_) async =>
        mapRowsTranslation(await source.select(TableQuery('hospital_bag_templates', order: _by('sort_order'))), language, const ['item_name', 'notes']),
  );
}, name: 'hospitalBagTemplatesQuery');
