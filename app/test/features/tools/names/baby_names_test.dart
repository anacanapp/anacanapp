// Ported from: src/components/tools/BabyNames.tsx, src/hooks/useFavoriteNames.ts (behaviour checks; no vitest suite)
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/names/baby_names.dart';
import 'package:anacan/features/tools/names/favorite_names.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';
import '../support/tools_harness.dart' show FakeToolsSource;

class FakeNamesRepository implements NamesRepository {
  final List<Map<String, dynamic>> favorites = [];
  Object? lookup;
  var _id = 0;

  @override
  Future<List<Map<String, dynamic>>> loadFavorites(String userId) async => [...favorites];

  @override
  Future<Map<String, dynamic>> insertFavorite(Map<String, Object?> row) async {
    final r = <String, dynamic>{'id': 'f${_id++}', 'created_at': '2026-11-01', ...row};
    favorites.insert(0, r);
    return r;
  }

  @override
  Future<void> deleteFavorite(String userId, String name) async => favorites.removeWhere((f) => f['name'] == name);

  @override
  Future<({Object? data, Object? error})> aiLookup(String name, String language) async => (data: lookup, error: null);
}

List<Map<String, dynamic>> names(int count) => [
      {'id': 'n-aylin', 'name': 'Aylin', 'gender': 'girl', 'meaning': 'Ay işığı', 'origin': 'Türk', 'popularity': 90, 'lang': 'az'},
      {'id': 'n-murad', 'name': 'Murad', 'gender': 'boy', 'meaning': 'Arzu', 'origin': 'Ərəb', 'popularity': 70, 'lang': 'az'},
      {'id': 'n-deniz', 'name': 'Dəniz', 'gender': 'unisex', 'meaning': null, 'origin': null, 'popularity': 0, 'lang': 'az'},
      for (var i = 0; i < count; i++) {'id': 'x$i', 'name': 'Ad$i', 'gender': 'boy', 'meaning': 'm', 'popularity': 1, 'lang': 'az'},
    ];

void main() {
  testWidgets('filters by gender and search, pages by 60 and toggles favourites', (tester) async {
    final env = PregnancyEnv();
    final repo = FakeNamesRepository();
    await pumpTool(tester, BabyNames(onBack: () {}), overrides: [
      ...env.overrides,
      namesRepositoryProvider.overrideWithValue(repo),
      toolsDataSourceProvider.overrideWithValue(FakeToolsSource({'baby_names_db': names(70)})),
    ]);
    await tester.pump();
    await tester.pump();
    expect(find.text('Körpə Adları'), findsOneWidget);
    expect(find.text('73 ad'), findsOneWidget);
    expect(find.byKey(const ValueKey('names-more')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('names-filter-girl')));
    await tester.pump();
    // girls + unisex
    expect(find.text('2 ad'), findsOneWidget);
    expect(find.text('Aylin'), findsOneWidget);
    expect(find.text('Dəniz'), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('names-search')), 'işığ');
    await tester.pump();
    expect(find.text('1 ad'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('names-fav-Aylin')));
    await tester.pump();
    await tester.pump();
    expect(repo.favorites.single['name'], 'Aylin');
    expect(find.text('💗 Seçilmişlər'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('a name that is not in the list can be looked up with AI', (tester) async {
    final env = PregnancyEnv();
    final repo = FakeNamesRepository()
      ..lookup = {
        'success': true,
        'found': true,
        'item': {'id': 'n-new'},
        'display': {'name': 'Ülvi', 'gender': 'boy', 'meaning': 'Uca', 'origin': 'Ərəb', 'popularity': 40},
      };
    await pumpTool(tester, BabyNames(onBack: () {}), overrides: [
      ...env.overrides,
      namesRepositoryProvider.overrideWithValue(repo),
      toolsDataSourceProvider.overrideWithValue(FakeToolsSource({'baby_names_db': names(0)})),
    ]);
    await tester.pump();
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('names-search')), 'Ülvi');
    await tester.pump();
    expect(find.text('Ad tapılmadı'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('names-ai')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('names-detail')), findsOneWidget);
    expect(find.text('Uca'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('names-detail-toggle')));
    await tester.pumpAndSettle();
    expect(repo.favorites.single['name'], 'Ülvi');
    await unmount(tester);
  });
}
