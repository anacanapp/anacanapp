// Ported from: src/lib/code-tools.test.ts, src/hooks/useDynamicContent.test.tsx (+ query keys / filters / shaping of
//              src/hooks/useDynamicTools.ts, src/hooks/useDynamicConfig.ts, src/hooks/useDynamicContent.ts,
//              src/lib/followup-content.ts, src/lib/name-collections.ts)
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/content_packs/content_key.dart' show contentTranslationKey;
import 'package:anacan/features/onboarding/onboarding_tour_host.dart' show TourToolConfig, tourToolConfigsProvider;
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/tour_configs.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../settings/support/harness.dart' show seededStore;
import '../support/tools_harness.dart';

Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  group('code tool rows', () {
    test('normal rows need is_active; code rows are live while kept inactive for old builds', () {
      expect(isToolRowLive({'tool_id': 'kick', 'is_active': true}), isTrue);
      expect(isToolRowLive({'tool_id': 'kick', 'is_active': false}), isFalse);
      expect(isToolRowLive({'tool_id': 'cakes', 'is_active': false}), isTrue);
      expect(isToolRowLive({'tool_id': 'baby-tracker', 'is_active': false}), isTrue);
    });
  });

  group('useToolConfigs shaping', () {
    final rows = [
      {'tool_id': 'a', 'name': 'A', 'is_active': true, 'sort_order': 3, 'mommy_order': 2, 'mommy_active': true},
      {'tool_id': 'b', 'name': 'B', 'name_en': 'Bee', 'is_active': true, 'sort_order': 1, 'mommy_order': null, 'mommy_active': null},
      {'tool_id': 'c', 'name': 'C', 'is_active': true, 'sort_order': 2, 'mommy_order': 5, 'mommy_active': false},
      {'tool_id': 'kick', 'name': 'K', 'is_active': false, 'sort_order': 0},
      {'tool_id': 'cakes', 'name': 'Cakes', 'is_active': false, 'sort_order': 9, 'mommy_order': 0},
    ];

    test('keeps live rows, filters the stage flag, sorts by the stage order (falling back to sort_order)', () {
      expect(shapeToolConfigs(rows, 'mommy', 'az').map((t) => t.toolId), ['cakes', 'b', 'a']);
      expect(shapeToolConfigs(rows, null, 'az').map((t) => t.toolId), ['b', 'c', 'a', 'cakes']);
      expect(shapeToolConfigs(rows, 'bump', 'en').firstWhere((t) => t.toolId == 'b').name, 'Bee');
    });

    test('stable for equal orders', () {
      final same = [for (final id in ['x', 'y', 'z']) {'tool_id': id, 'name': id, 'is_active': true, 'sort_order': 1}];
      expect(shapeToolConfigs(same, 'flow', 'az').map((t) => t.toolId), ['x', 'y', 'z']);
    });
  });

  group('queries', () {
    late FakeToolsSource source;
    late ProviderContainer c;

    setUp(() {
      source = FakeToolsSource();
      c = ProviderContainer(overrides: [
        localStoreProvider.overrideWithValue(seededStore(user: {'language': 'az', 'lifeStage': 'mommy'})),
        queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
        toolsDataSourceProvider.overrideWithValue(source),
      ]);
    });
    tearDown(() => c.dispose());

    test('tool configs: key, or-filter with every code tool, typed rows', () async {
      source.tables['tool_configs'] = [cfg('kick', 'Təpik', {'is_active': true, 'sort_order': 1})];
      c.listen(toolConfigsQuery('mommy'), (_, _) {});
      await settle();
      expect(source.calls.single.table, 'tool_configs');
      expect(source.calls.single.or,
          'is_active.eq.true,tool_id.in.(cakes,mini-games,baby-tracker,sleep-training,solid-food-guide,parenting,play-together,kid-exercises)');
      final data = c.read(toolConfigsQuery('mommy')).data!;
      expect(data.single.toolId, 'kick');
      expect(c.read(queryClientProvider).getQueryData<List<ToolConfig>>(['tool-configs', 'mommy', 'az']), isNotNull);
    });

    test('tour tool configs: null until loaded, disabled tools removed, display_name wins', () async {
      source.tables['tool_configs'] = [
        cfg('kick', 'Təpik', {'is_active': true, 'display_name': 'Təpik sayğacı', 'bump_locked': true}),
        cfg('names', 'Adlar', {'is_active': true}),
      ];
      final sub = c.listen(toolsTourConfigsProvider('bump'), (_, _) {});
      expect(sub.read(), isNull);
      await settle();
      final list = c.read(toolsTourConfigsProvider('bump'))!;
      expect(list.map((t) => t.toolId), ['kick', 'names']);
      expect(list.first.name, 'Təpik sayğacı');
      expect(list.first.bumpLocked, isTrue);
      expect(list.first, isA<TourToolConfig>());
    });

    test('the tourToolConfigsProvider override the app root adds', () async {
      source.tables['tool_configs'] = [cfg('kick', 'Təpik', {'is_active': true})];
      final wired = ProviderContainer(parent: c, overrides: [
        tourToolConfigsProvider.overrideWith((ref, stage) => ref.watch(toolsTourConfigsProvider(stage))),
      ]);
      addTearDown(wired.dispose);
      wired.listen(tourToolConfigsProvider('mommy'), (_, _) {});
      await settle();
      expect(wired.read(tourToolConfigsProvider('mommy'))!.single.toolId, 'kick');
    });

    test('meal types: stage filter; safety items: category filter unless all', () async {
      source.tables['meal_types'] = [
        {'id': '1', 'name': 'Səhər', 'life_stages': ['mommy']},
        {'id': '2', 'name': 'Gecə', 'life_stages': ['bump']},
      ];
      c.listen(mealTypesQuery('mommy'), (_, _) {});
      c.listen(safetyItemsByCategoryQuery('all'), (_, _) {});
      c.listen(safetyItemsByCategoryQuery('food'), (_, _) {});
      await settle();
      expect(c.read(mealTypesQuery('mommy')).data!.map((r) => r['id']), ['1']);
      final safety = source.calls.where((q) => q.table == 'safety_items').toList();
      expect(safety.map((q) => q.eq), [
        {'is_active': true},
        {'is_active': true, 'category': 'food'},
      ]);
      expect(safety.first.order.single, (column: 'name', ascending: true));
    });

    test('photoshoot outfits keep universal and matching genders', () async {
      source.tables['photoshoot_outfits'] = [
        {'id': '1', 'gender': 'all'},
        {'id': '2', 'gender': 'unisex'},
        {'id': '3', 'gender': 'boy'},
        {'id': '4', 'gender': 'girl'},
      ];
      c.listen(photoshootOutfitsQuery('girl'), (_, _) {});
      await settle();
      expect(c.read(photoshootOutfitsQuery('girl')).data!.map((r) => r['id']), ['1', '2', '4']);
    });

    test('exercises parse a JSON steps string', () async {
      source.tables['exercises'] = [
        {'id': 'e1', 'name': 'Gəzinti', 'steps': '["a","b"]'},
        {'id': 'e2', 'name': 'Yoga', 'steps': null},
      ];
      c.listen(exercisesQuery, (_, _) {});
      await settle();
      final data = c.read(exercisesQuery).data!;
      expect(data[0]['steps'], ['a', 'b']);
      expect(data[1]['steps'], isEmpty);
    });

    test('baby names: the lang collection, legacy origin_en fallback when the column is missing', () async {
      source.tables['baby_names_db'] = [
        {'id': 'n1', 'name': 'Aysel', 'meaning': 'Ay kimi'},
      ];
      c.listen(babyNamesQuery('US'), (_, _) {});
      await settle();
      expect(source.calls.single.eq, {'is_active': true, 'lang': 'en'});
      expect(source.calls.single.order.single, (column: 'popularity', ascending: false));

      final legacy = _LangMissingSource();
      expect((await fetchBabyNames(legacy, 'az')).single['id'], 'legacy');
      expect(legacy.calls.last.isNull, ['origin_en']);
      await fetchBabyNames(legacy, 'en');
      expect(legacy.calls.last.notNull, ['origin_en']);
    });
  });

  group('localized recipe identity', () {
    for (final transport in ['server columns', 'source-schema bundle']) {
      test('keeps filtering and free-tier grouping stable with $transport', () {
        const translated = {
          'title': 'Owsianka',
          'category': 'Sniadania',
          'ingredients': ['Platki owsiane'],
          'instructions': ['Wymieszaj skladniki.'],
        };
        final row = <String, dynamic>{
          'id': 'public-recipe',
          'category': 'seher_yemeyi',
          'title': 'Oatmeal',
          'ingredients': ['Oats'],
          'instructions': ['Mix ingredients.'],
          if (transport == 'server columns') ...{for (final e in translated.entries) '${e.key}_pl': e.value},
        };
        final recipe = shapeRecipes([row], 'pl',
            lookup: (item, field, language) =>
                transport == 'source-schema bundle' && item['id'] == row['id'] && language == 'pl' ? translated[field] : null).single;
        expect(recipe['category'], 'seher_yemeyi');
        expect(recipe['stage'], 'seher_yemeyi');
        expect(recipe['categoryLabel'], 'Sniadania');
        expect(recipe['title'], 'Owsianka');
        expect(recipe['ingredients'], ['Platki owsiane']);
        expect(recipe['instructions'], ['Wymieszaj skladniki.']);
        expect(row['category'], 'seher_yemeyi');
      });
    }
  });

  group('mapFollowupContent', () {
    test('fills <field>_<lang> from the bound bundle value; explicit server copy wins', () {
      final row = {'id': 'x1', 'name': 'Gəzinti', 'name_az': null, 'name_en': 'Walking'};
      final key = contentTranslationKey(row, 'name')!;
      final values = {
        key: {'pl': 'Spacer'},
      };
      expect(mapFollowupContent([row], 'pl', const ['name'], values: values).single['name'], 'Spacer');
      expect(mapFollowupContent([{...row, 'name_pl': 'Chód'}], 'pl', const ['name'], values: values).single['name'], 'Chód');
      // An edited source gets another key: the stale bundle value is not used.
      expect(mapFollowupContent([{...row, 'name': 'Yeriş'}], 'pl', const ['name'], values: values).single['name'], isNot('Spacer'));
    });
  });

  group('nameCollectionLanguage', () {
    test('English-speaking countries, flag countries, else the app language', () {
      expect(nameCollectionLanguage('us', 'az'), 'en');
      expect(nameCollectionLanguage('IE', 'ru'), 'en');
      expect(nameCollectionLanguage('TR', 'az'), 'tr');
      expect(nameCollectionLanguage('AZ', 'en'), 'az');
      expect(nameCollectionLanguage(null, 'de'), 'de');
      expect(nameCollectionLanguage('XX', 'xx'), 'az');
    });
  });
}

class _LangMissingSource implements ToolsDataSource {
  final List<TableQuery> calls = [];
  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async {
    calls.add(query);
    if (query.eq.containsKey('lang')) throw const PostgrestException(message: 'column baby_names_db.lang does not exist');
    return [
      {'id': 'legacy'},
    ];
  }
}
