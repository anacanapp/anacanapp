// Ported from: src/components/tools/SafetyLookup.tsx (behaviour checks; no vitest suite)
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/safety/safety_lookup.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';
import '../support/tools_harness.dart' show FakeToolsSource;

final source = FakeToolsSource({
  'safety_categories': [
    {'category_id': 'all', 'name': 'Hamısı', 'emoji': '✨'},
    {'category_id': 'food', 'name': 'Qida', 'emoji': '🍎'},
    {'category_id': 'drug', 'name': 'Dərman', 'emoji': null},
  ],
  'safety_items': [
    {'id': 'i1', 'name': 'Alma', 'description': 'Faydalıdır', 'category': 'food', 'safety_level': 'safe'},
    {'id': 'i2', 'name': 'Qəhvə', 'description': 'Gündə 200 mq', 'category': 'food', 'safety_level': 'warning'},
    {'id': 'i3', 'name': 'İzotretinoin', 'description': 'Qadağandır', 'category': 'drug', 'safety_level': 'danger'},
  ],
});

void main() {
  testWidgets('counts by level, filters by category / search and opens the detail', (tester) async {
    final env = PregnancyEnv();
    await pumpTool(tester, SafetyLookup(onBack: () {}), overrides: [...env.overrides, toolsDataSourceProvider.overrideWithValue(source)]);
    await tester.pump();
    expect(find.text('Təhlükəsizlik Sorğusu'), findsOneWidget);
    // The DB "all" row is dropped in favour of the built-in "Hamısı" chip.
    expect(find.byKey(const ValueKey('safety-cat-all')), findsOneWidget);
    expect(find.text('📦'), findsOneWidget); // missing emoji fallback
    expect(find.text('Təhlükəli'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('safety-cat-food')));
    await tester.pump();
    expect(find.text('İzotretinoin'), findsNothing);
    expect(find.text('Qəhvə'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('safety-item-i2')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('safety-detail')), findsOneWidget);
    expect(find.text('Həkiminizlə məsləhətləşin'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('safety-detail-close')));
    await tester.pumpAndSettle();
    await unmount(tester);
  });

  testWidgets('an unknown item is looked up with AI and shown', (tester) async {
    final env = PregnancyEnv(profile: testProfile({'life_stage': 'bump', 'last_period_date': '2026-08-01'}));
    final bodies = <Map<String, Object?>>[];
    await pumpTool(tester, SafetyLookup(onBack: () {}), overrides: [
      ...env.overrides,
      toolsDataSourceProvider.overrideWithValue(source),
      safetyAiLookupProvider.overrideWithValue((body) async {
        bodies.add(body);
        return (data: {'success': true, 'item': {'id': 'n1', 'name': 'Kivi', 'description': 'Vitamin C', 'safety_level': 'safe'}}, error: null);
      }),
    ]);
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('safety-search')), 'Kivi');
    await tester.pump();
    expect(find.text('Bazada tapılmadı'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('safety-ai')));
    await tester.pumpAndSettle();
    expect(bodies.single['query'], 'Kivi');
    expect(bodies.single.containsKey('category'), isFalse);
    expect((bodies.single['userContext']! as Map)['lifeStage'], 'bump');
    expect((bodies.single['userContext']! as Map)['pregnancyWeek'], isA<int>());
    expect(find.byKey(const ValueKey('safety-detail')), findsOneWidget);
    expect(find.text('Vitamin C'), findsOneWidget);
    await unmount(tester);
  });
}
