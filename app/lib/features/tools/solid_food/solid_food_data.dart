// Ported from: src/data/solidFoodGuide.ts (structure), src/data/solid-food-guide/index.ts (text loader, fill),
//              src/components/tools/SolidFoodGuide.tsx (BABY_RECIPE_CATEGORY, recipeMinMonths, stripAge, source titles)
//
// Texts live per language in assets/i18n/solid-food-guide.<lang>.json (copies of src/data/solid-food-guide/*.json,
// same order as the arrays below). `useSolidFoodGuideText(language)` → [solidFoodGuideTextProvider] (English when a
// file is missing, then Azerbaijani).
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/cache/cache.dart';
import '../../../core/net/backend_providers.dart';

/// 'iron' | 'ca' | 'omega' | 'c' | 'allergen'
typedef GuideTag = String;

/// 'meat' | 'fish' | 'egg' | 'dairy' | 'legumes' | 'grains' | 'vegetables' | 'fruit' | 'fats_seeds'
typedef FoodGroupId = String;

class GuideStage {
  const GuideStage(this.id, this.fromMonths, this.toMonths);
  final String id;
  final int fromMonths;
  final int toMonths;
}

const List<GuideStage> stages = [
  GuideStage('0-6', 0, 6),
  GuideStage('6-8', 6, 9),
  GuideStage('9-11', 9, 12),
  GuideStage('12-24', 12, 24),
  GuideStage('24-48', 24, 48),
];

/// Aligned with text.nutrients; the needs table shows rows whose first need is not '—'.
const List<GuideTag?> nutrientTags = ['iron', null, null, 'ca', 'omega', null, 'c'];

/// Aligned with text.plate. Colours: `var(--a-coral)`, `var(--a-yellow-2, #ffc94d)`, `var(--a-green-2, #63bd8b)`.
const List<({int share, String color})> plate = [
  (share: 25, color: 'coral'),
  (share: 25, color: 'yellow2'),
  (share: 50, color: 'green2'),
];

const List<FoodGroupId> foodGroups = ['meat', 'fish', 'egg', 'dairy', 'legumes', 'grains', 'vegetables', 'fruit', 'fats_seeds'];

/// Aligned with text.foods.
const List<({FoodGroupId group, int from, List<GuideTag> tags})> foods = [
  (group: 'meat', from: 6, tags: ['iron']),
  (group: 'meat', from: 6, tags: ['iron']),
  (group: 'meat', from: 6, tags: ['iron']),
  (group: 'meat', from: 6, tags: ['iron']),
  (group: 'meat', from: 7, tags: ['iron']),
  (group: 'fish', from: 6, tags: ['omega', 'allergen']),
  (group: 'fish', from: 6, tags: ['omega', 'allergen']),
  (group: 'fish', from: 6, tags: ['allergen']),
  (group: 'egg', from: 6, tags: ['iron', 'allergen']),
  (group: 'dairy', from: 6, tags: ['ca', 'allergen']),
  (group: 'dairy', from: 6, tags: ['ca', 'allergen']),
  (group: 'dairy', from: 6, tags: []),
  (group: 'dairy', from: 12, tags: ['ca', 'allergen']),
  (group: 'legumes', from: 6, tags: ['iron']),
  (group: 'legumes', from: 6, tags: ['iron']),
  (group: 'legumes', from: 7, tags: ['iron']),
  (group: 'grains', from: 6, tags: ['iron']),
  (group: 'grains', from: 6, tags: []),
  (group: 'grains', from: 6, tags: ['iron']),
  (group: 'grains', from: 6, tags: ['allergen']),
  (group: 'grains', from: 7, tags: ['iron']),
  (group: 'vegetables', from: 6, tags: []),
  (group: 'vegetables', from: 6, tags: ['c']),
  (group: 'vegetables', from: 6, tags: []),
  (group: 'vegetables', from: 6, tags: ['iron']),
  (group: 'vegetables', from: 7, tags: ['c']),
  (group: 'vegetables', from: 6, tags: ['iron']),
  (group: 'fruit', from: 6, tags: []),
  (group: 'fruit', from: 6, tags: []),
  (group: 'fruit', from: 6, tags: []),
  (group: 'fruit', from: 6, tags: ['c']),
  (group: 'fruit', from: 6, tags: []),
  (group: 'fruit', from: 9, tags: ['iron']),
  (group: 'fats_seeds', from: 6, tags: []),
  (group: 'fats_seeds', from: 6, tags: ['allergen']),
  (group: 'fats_seeds', from: 6, tags: ['allergen']),
  (group: 'fats_seeds', from: 6, tags: ['ca', 'allergen']),
  (group: 'fats_seeds', from: 9, tags: ['omega']),
];

/// Aligned with text.dishes[stage].
const Map<String, List<List<GuideTag>>> dishTags = {
  '6-8': [['iron'], ['iron'], ['iron'], ['iron'], ['iron'], ['ca', 'allergen'], [], ['iron', 'allergen'], ['c'], ['omega', 'allergen'], ['iron', 'allergen'], []],
  '9-11': [['iron'], ['iron', 'allergen'], ['omega', 'allergen'], ['ca', 'allergen'], ['iron'], ['iron'], ['iron', 'allergen'], ['iron', 'allergen'], ['iron'], ['ca', 'allergen'], ['ca', 'allergen'], ['iron']],
  '12-24': [['iron'], ['iron'], ['iron'], ['iron', 'allergen'], ['iron', 'allergen'], ['iron', 'c', 'allergen'], ['iron'], ['omega', 'allergen'], ['iron'], ['iron', 'allergen'], ['iron', 'ca', 'allergen'], ['ca'], ['ca', 'allergen'], ['iron', 'allergen']],
  '24-48': [['iron'], ['omega'], ['iron'], ['ca', 'allergen'], ['iron', 'c', 'allergen'], ['iron', 'c'], ['iron'], ['iron', 'allergen'], ['ca', 'allergen'], ['iron']],
};

/// `stageFor(months)`: the stage containing the age, else 6-8.
GuideStage stageFor(int? months) {
  for (final s in stages) {
    if (months != null && months >= s.fromMonths && months < s.toMonths) return s;
  }
  return stages[1];
}

/// `fill(template, n)`: first `{n}` only.
String fill(String template, Object n) => template.replaceFirst('{n}', '$n');

/// The app's Recipes tool keeps baby recipes in this category (Duzelis67).
const String babyRecipeCategory = 'baby_food';

/// Minimum age in months from the Azerbaijani source title, e.g. "Armud püresi (6 ay+)" or "Naqets (1 yaş+)".
int? recipeMinMonths(String title) {
  final match = RegExp(r'(\d+)\s*(ay|yaş)\s*\+', caseSensitive: false).firstMatch(title);
  if (match == null) return null;
  return int.parse(match[1]!) * (match[2]!.toLowerCase() == 'yaş' ? 12 : 1);
}

/// Recipe titles end with the age in the user's language; the guide shows it separately.
String stripAge(String title) => title.replaceFirst(RegExp(r'\s*\([^()]*\d[^()]*\)\s*$'), '');

// ── texts ──

/// `SolidFoodGuideText` (the JSON of one language).
class SolidFoodGuideText {
  const SolidFoodGuideText(this.json);
  final Map<String, dynamic> json;

  Map<String, String> get ui => (json['ui'] as Map).map((k, v) => MapEntry('$k', '$v'));
  String u(String key) => ui[key] ?? '';
  List<Map<String, dynamic>> _maps(String key) => [for (final v in (json[key] as List? ?? const [])) Map<String, dynamic>.from(v as Map)];
  List<String> _strings(String key) => [for (final v in (json[key] as List? ?? const [])) '$v'];

  List<Map<String, dynamic>> get stages => _maps('stages');
  List<String> get readiness => _strings('readiness');
  List<Map<String, dynamic>> get sampleDay => _maps('sampleDay');
  List<String> get nutrientAges => _strings('nutrientAges');
  List<Map<String, dynamic>> get nutrients => _maps('nutrients');
  List<Map<String, dynamic>> get plate => _maps('plate');
  List<String> get ironHelps => _strings('ironHelps');
  List<String> get ironBlocks => _strings('ironBlocks');
  List<String> get allergens => _strings('allergens');
  List<String> get allergenSteps => _strings('allergenSteps');
  List<Map<String, dynamic>> get avoid => _maps('avoid');
  List<String> get choking => _strings('choking');
  List<Map<String, dynamic>> get myths => _maps('myths');
  Map<String, String> get foodGroups => (json['foodGroups'] as Map).map((k, v) => MapEntry('$k', '$v'));
  List<Map<String, dynamic>> get foods => _maps('foods');
  Map<String, List<String>> get dishes =>
      (json['dishes'] as Map).map((k, v) => MapEntry('$k', [for (final d in v as List) '$d']));
  String get emergency => '${json['emergency'] ?? ''}';
  String get disclaimer => '${json['disclaimer'] ?? ''}';
}

/// Reads one language file (null when it is missing).
typedef SolidFoodGuideAssetLoader = Future<String?> Function(String language);

final solidFoodGuideAssetLoaderProvider = Provider<SolidFoodGuideAssetLoader>((ref) => (language) async {
      try {
        return await rootBundle.loadString('assets/i18n/solid-food-guide.$language.json');
      } catch (_) {
        return null;
      }
    });

/// `loadSolidFoodGuideText(language)`: the language file, else English, else Azerbaijani.
final solidFoodGuideTextProvider = FutureProvider.family<SolidFoodGuideText, String>((ref, language) async {
  final load = ref.watch(solidFoodGuideAssetLoaderProvider);
  final raw = await load(language) ?? await load('en') ?? await load('az');
  return SolidFoodGuideText(Map<String, dynamic>.from(jsonDecode(raw!) as Map));
}, name: 'solidFoodGuideTextProvider');

// ── source titles ──

/// `admin_recipes` titles of the baby category (`select('id, title').eq('category').eq('is_active', true)`).
typedef BabyRecipeSourceTitles = Future<List<Map<String, dynamic>>> Function();

final babyRecipeSourceTitlesFetcherProvider = Provider<BabyRecipeSourceTitles>((ref) => () async {
      final SupabaseClient client = ref.read(supabaseClientProvider);
      final data = await client.from('admin_recipes').select('id, title').eq('category', babyRecipeCategory).eq('is_active', true);
      return [for (final r in data) Map<String, dynamic>.from(r)];
    });

/// `useQuery(['baby-recipe-source-titles'], staleTime 30 min)` → id → Azerbaijani title.
final babyRecipeSourceTitlesQuery = queryProvider<Map<String, String>>((ref) {
  final fetch = ref.watch(babyRecipeSourceTitlesFetcherProvider);
  return QueryOptions(
    queryKey: const ['baby-recipe-source-titles'],
    staleTime: const Duration(minutes: 30),
    queryFn: (_) async {
      // React ignores the error (`const { data } = …`): an empty map.
      try {
        return {for (final r in await fetch()) '${r['id']}': '${r['title']}'};
      } catch (_) {
        return const <String, String>{};
      }
    },
  );
}, name: 'babyRecipeSourceTitlesQuery');
