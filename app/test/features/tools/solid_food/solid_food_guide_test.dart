// Ported from: (no vitest file for the SolidFoodGuide screen) — behaviour checks of the port: the child's stage,
// the readiness checklist, tabs, the emergency number in the rules, the food group filter and the recipe list
// (age from the Azerbaijani source title, free tier, opening the Recipes tool).
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/hooks/use_children.dart' show childrenCacheKey;
import 'package:anacan/features/tools/solid_food/solid_food_guide.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;

  setUp(() {
    h = BabyToolsHarness();
    DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-07-01')];
  });
  tearDown(DomainClock.reset);

  /// useChildren starts from the offline cache (`initialData`), so the guide's stage state sees the child at mount.
  void cacheChildren() => OfflineCache(h.store).writeCache(childrenCacheKey, 'u1', h.repo.children);

  testWidgets('opens on the child\'s stage and tracks the readiness checklist', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-08-01')];
    cacheChildren();
    await h.pump(tester, SolidFoodGuide(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    // ~3-4 months old → 0-6 stage with the readiness list.
    expect(find.byKey(const ValueKey('sfg-ready-0')), findsOneWidget);
    for (var i = 0; i < 4; i++) {
      await tester.tap(find.byKey(ValueKey('sfg-ready-$i')));
      await tester.pump();
    }
    expect(tester.widget<Text>(find.descendant(of: find.byKey(const ValueKey('sfg-ready-3')), matching: find.byType(Text))).data, isNotEmpty);
    await h.finish(tester);
  });

  testWidgets('fills the emergency number in the rules and filters foods by group', (tester) async {
    await h.pump(tester, SolidFoodGuide(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('sfg-tab-rules')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.textContaining('103'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('sfg-tab-foods')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('sfg-group-egg')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Yumurta'), findsWidgets);
    await h.finish(tester);
  });

  testWidgets('suggests baby recipes by the source-title age, locks beyond the free three and opens Recipes', (tester) async {
    h.tools.tables['admin_recipes'] = [
      for (var i = 0; i < 5; i++) {'id': 'r$i', 'title': 'Püre $i (${6 + i} months+)', 'category': 'baby_food', 'is_active': true, 'created_at': '2026-0$i-01'},
      {'id': 'x', 'title': 'Adult', 'category': 'dinner', 'is_active': true, 'created_at': '2026-01-01'},
    ];
    h.recipeTitles = {for (var i = 0; i < 5; i++) 'r$i': 'Püre $i (${6 + i} ay+)'};
    cacheChildren();
    var opened = 0;
    h.registry.registerTool(ToolId.recipes, (context, a) => GestureDetector(onTap: a.onBack, child: Text('recipes-tool ${opened++}')));
    await h.pump(tester, SolidFoodGuide(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('sfg-tab-recipes')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    // The child is ~4.9 months: up to 6 months+ (max(months, 6)).
    expect(find.byKey(const ValueKey('sfg-recipe-r0')), findsOneWidget);
    expect(find.byKey(const ValueKey('sfg-recipe-r1')), findsNothing);
    expect(find.text('Püre 0'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('sfg-recipe-r0')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.textContaining('recipes-tool'), findsOneWidget);
    await tester.tap(find.textContaining('recipes-tool'));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('sfg-all-recipes')), findsOneWidget);
    await h.finish(tester);
  });
}
