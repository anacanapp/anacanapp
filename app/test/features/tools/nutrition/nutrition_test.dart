// Ported from: (no vitest for Nutrition.tsx / VitaminsTab.tsx / useMealLogs.ts / useVitamins.ts — behaviour checks)
import 'package:anacan/features/tools/nutrition/meal_logs.dart';
import 'package:anacan/features/tools/nutrition/nutrition.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

void main() {
  test('targets: DB row of the stage, else the fallback; +300 kcal per extra baby', () {
    expect(nutritionTargets([{'life_stage': 'bump', 'calories': 2200, 'water_glasses': 9, 'description': 'X'}], 'bump', 300).calories, 2500);
    final fb = nutritionTargets(const [], 'mommy', 0);
    expect([fb.calories, fb.water], [2500, 12]);
    expect(nutritionTargets(const [], null, 0).calories, 2000);
  });

  test('meal rows: the nursing row gets its own label, raw az names are translated', () {
    final rows = nutritionMealTypes([
      {'meal_id': 'nursing', 'name': 'Əlavə qida', 'time_range': 'Əlavə qida', 'emoji': '🤱'},
      {'meal_id': 'snack', 'name': 'Qəlyanaltı', 'time_range': 'İstənilən vaxt', 'emoji': null},
    ], 'en');
    expect(rows[0].name, 'Nursing');
    expect(rows[0].time, 'Anytime');
    expect(rows[1].name, 'Snack');
    expect(rows[1].time, 'Anytime');
    expect(rows[1].emoji, '🍽️');
  });

  test('vitamins: pregnancy week range / trimester filter and the B-complex dosage fix', () {
    final rows = shapeVitamins([
      {'name': 'Folat', 'week_start': 1, 'week_end': 12, 'importance': 'essential'},
      {'name': 'Iron', 'trimester': [2, 3]},
      {'name': 'Vitamin B Complex', 'dosage': 'hata', 'trimester': null},
    ], 'az', 20, 'bump');
    expect(rows.map((r) => r['name']), ['Iron', 'Vitamin B Complex']);
    expect(rows.last['dosage'], 'B1: 1.4mg, B2: 1.6mg, B6: 2mg/day');
  });

  toolTest('adds a quick food to a meal and counts today\'s calories', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'flow'});
    await h.pump(tester, Nutrition(onBack: () {}));
    expect(find.text('Səhər yeməyi'), findsOneWidget);
    await tester.tap(find.text('Səhər yeməyi'));
    await settle(tester);
    await tester.tap(find.text('Yumurta'));
    await settle(tester);
    final row = h.db.rows('meal_logs').single;
    expect([row['meal_type'], row['food_name'], row['calories']], ['breakfast', 'Yumurta', 78]);
    expect(find.text('Əlavə edilən qidalar'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Geri').first);
    await settle(tester);
    expect(find.textContaining('1 qida • 78 kcal'), findsOneWidget);
  });

  toolTest('the custom food looks the calories up with food-calories', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'flow'});
    h.db.onInvoke = (name, body) => {'found': true, 'calories': 350};
    await h.pump(tester, Nutrition(onBack: () {}));
    await tester.tap(find.text('Nahar'));
    await settle(tester);
    await tester.tap(find.text('Xüsusi qida əlavə et'));
    await settle(tester);
    await tester.enterText(find.byKey(const ValueKey('food-name')), 'Plov');
    await tester.tap(find.byKey(const ValueKey('food-calories')));
    await settle(tester);
    expect(h.db.invocations.single.$1, 'food-calories');
    expect(h.db.invocations.single.$2, {'name': 'Plov', 'language': 'az'});
    await tester.tap(find.text('Əlavə et').last);
    await settle(tester);
    final row = h.db.rows('meal_logs').single;
    expect([row['meal_type'], row['food_name'], row['calories']], ['lunch', 'Plov', 350]);
  });
}
