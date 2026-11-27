// Ported from: (no vitest file for BabyGrowthTracker.tsx) — behaviour checks of the port: trio values and change,
// WHO card only with a known sex, add / edit / delete through the repository, the "at least one measure" error.
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/tools/baby_growth/baby_growth_tracker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../baby_tracker/support/baby_tools_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;

  setUp(() {
    h = BabyToolsHarness();
    DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-01-01', gender: 'girl')];
  });
  tearDown(DomainClock.reset);

  Map<String, dynamic> entry(String id, String date, {num? w, num? hgt, num? head, String? notes}) =>
      {'id': id, 'user_id': 'u1', 'child_id': 'c1', 'entry_date': date, 'weight_kg': w, 'height_cm': hgt, 'head_cm': head, 'notes': notes};

  testWidgets('shows the latest values with the change and the WHO curves', (tester) async {
    h.growth.rows.addAll([entry('a', '2026-09-01', w: 6.5, hgt: 62, head: 40), entry('b', '2026-10-01', w: 7.25, hgt: 64.5, head: 41, notes: 'Həkim')]);
    await h.pump(tester, BabyGrowthTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('7.25'), findsOneWidget);
    expect(find.text('+0.75'), findsOneWidget);
    expect(find.text('+2.5'), findsOneWidget);
    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text('📝 Həkim'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('who-measure-head')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byType(LineChart), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('no WHO chart when the sex is unknown', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-01-01', gender: 'unknown')];
    h.growth.rows.add(entry('a', '2026-09-01', w: 6.5));
    await h.pump(tester, BabyGrowthTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byType(LineChart), findsNothing);
    await h.finish(tester);
  });

  testWidgets('adds a measurement for the selected child and rejects an empty form', (tester) async {
    await h.pump(tester, BabyGrowthTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Hələ ölçü yoxdur'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('growth-first')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('growth-save')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.text('Ən azı bir ölçü daxil edin'), findsOneWidget);
    expect(h.growth.calls, isEmpty);
    await tester.enterText(find.descendant(of: find.byKey(const ValueKey('growth-weight')), matching: find.byType(EditableText)), '5,2');
    await tester.tap(find.byKey(const ValueKey('growth-save')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.growth.calls, ['insert']);
    expect(h.growth.rows.single, containsPair('weight_kg', 5.2));
    expect(h.growth.rows.single, containsPair('child_id', 'c1'));
    expect(h.growth.rows.single, containsPair('entry_date', '2026-11-27'));
    expect(find.byKey(const ValueKey('growth-save')), findsNothing);
    await h.finish(tester);
  });

  testWidgets('edits and deletes an entry', (tester) async {
    h.growth.rows.add(entry('a', '2026-09-01', w: 6.5));
    await h.pump(tester, BabyGrowthTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('growth-edit-a')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    await tester.enterText(find.descendant(of: find.byKey(const ValueKey('growth-weight')), matching: find.byType(EditableText)), '6.8');
    await tester.tap(find.byKey(const ValueKey('growth-save')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.growth.rows.single['weight_kg'], 6.8);
    await tester.tap(find.byKey(const ValueKey('growth-delete-a')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(h.growth.rows, isEmpty);
    expect(h.growth.calls, ['update:a', 'delete:a']);
    await h.finish(tester);
  });
}
