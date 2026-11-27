// Ported from: (no vitest for BloodSugarTracker.tsx — behaviour checks of the port)
import 'package:anacan/features/tools/blood_sugar/blood_sugar.dart';
import 'package:anacan/features/tools/blood_sugar/blood_sugar_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> log(String id, num value, String type, Duration ago) =>
    {'id': id, 'user_id': testUserId, 'reading_value': value, 'reading_type': type, 'meal_context': null, 'notes': null, 'logged_at': DateTime.now().subtract(ago).toUtc().toIso8601String()};

void main() {
  toolTest('a low reading in the last 6 hours shows the hypo advice in the chosen unit', (tester) async {
    final h = HealthHarness(tables: {'blood_sugar_logs': [log('a', 60, 'random', const Duration(hours: 1))]});
    h.store.setItem(glucoseUnitKey, 'mmol');
    await h.pump(tester, BloodSugarTracker(onBack: () {}));
    expect(find.byKey(const ValueKey('bs-hypo')), findsOneWidget);
    expect(find.textContaining('3.9 mmol/L-dən aşağı (hipoqlikemiya)'), findsOneWidget);
    expect(find.text('3.3'), findsOneWidget);
  });

  toolTest('two highs this week show the repeated-high hint; the unit choice is saved per device', (tester) async {
    final h = HealthHarness(tables: {
      'blood_sugar_logs': [log('a', 100, 'fasting', const Duration(hours: 2)), log('b', 130, 'after_meal', const Duration(hours: 30))],
    });
    await h.pump(tester, BloodSugarTracker(onBack: () {}));
    expect(find.byKey(const ValueKey('bs-repeated')), findsOneWidget);
    expect(find.byKey(const ValueKey('bs-hypo')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('bs-unit-mmol')));
    await tester.pump();
    expect(h.store.getItem(glucoseUnitKey), 'mmol');
    expect(find.text('5.6'), findsOneWidget);
  });

  toolTest('adds a reading stored in mg/dL from mmol/L input', (tester) async {
    final h = HealthHarness();
    h.store.setItem(glucoseUnitKey, 'mmol');
    await h.pump(tester, BloodSugarTracker(onBack: () {}));
    expect(find.text('Hələ heç bir qeyd yoxdur'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Əlavə et'));
    await settle(tester);
    await tester.enterText(find.byKey(const ValueKey('bs-reading')), '5,5');
    await tester.pump();
    await tester.tap(find.text('Aclıq'));
    await tester.pump();
    expect(find.text('Hədəfdən yuxarı'), findsOneWidget);
    await tester.tap(find.text('Qeyd et'));
    await settle(tester);
    final row = h.db.rows('blood_sugar_logs').single;
    expect([row['reading_value'], row['reading_type'], row['notes']], [99, 'fasting', null]);
  });
}
