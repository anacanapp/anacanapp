// Ported from: (no vitest for BloodPressureTracker.tsx — behaviour checks of the port)
import 'package:anacan/features/settings/ui/settings_ui.dart' show cssUpper;
import 'package:anacan/features/tools/blood_pressure/blood_pressure_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> reading(int sys, int dia, {int? pulse, String? at}) => {
      'id': 'r$sys',
      'user_id': testUserId,
      'systolic': sys,
      'diastolic': dia,
      'pulse': pulse,
      'measured_at': at ?? DateTime.now().toUtc().toIso8601String(),
    };

void main() {
  toolTest('a pregnancy reading ≥160/110 shows the urgent pre-eclampsia alert with the emergency call', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'bump'}, tables: {'blood_pressure_logs': [reading(165, 100)]});
    await h.pump(tester, BloodPressureTracker(onBack: () {}));
    expect(find.byKey(const ValueKey('bp-urgent')), findsOneWidget);
    expect(find.text('Ağır hipertenziya — preeklampsiya riski!'), findsOneWidget);
    expect(find.text(cssUpper('Preeklampsiya nəzarəti')), findsOneWidget);
    await tester.tap(find.descendant(of: find.byKey(const ValueKey('bp-urgent')), matching: find.text('103')));
    expect(h.launched, [Uri(scheme: 'tel', path: '103')]);
  });

  toolTest('≥140/90 outside pregnancy warns without the urgent card', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'flow'}, tables: {'blood_pressure_logs': [reading(145, 85)]});
    await h.pump(tester, BloodPressureTracker(onBack: () {}));
    expect(find.byKey(const ValueKey('bp-urgent')), findsNothing);
    expect(find.byKey(const ValueKey('bp-warning')), findsOneWidget);
    expect(find.text('Son ölçməniz yüksəkdir. Bu gün həkiminizlə əlaqə saxlamağı tövsiyə edirik.'), findsOneWidget);
  });

  toolTest('the first 6 weeks after birth use the pregnancy thresholds', (tester) async {
    final birth = DateTime.now().subtract(const Duration(days: 10));
    final key = '${birth.year}-${birth.month.toString().padLeft(2, '0')}-${birth.day.toString().padLeft(2, '0')}';
    final h = HealthHarness(user: {'lifeStage': 'mommy', 'babyBirthDate': key}, tables: {'blood_pressure_logs': [reading(142, 88)]});
    await h.pump(tester, BloodPressureTracker(onBack: () {}));
    expect(find.text(cssUpper('Doğuşdan sonra preeklampsiya nəzarəti')), findsOneWidget);
    expect(find.textContaining('Doğuşdan sonrakı ilk 6 həftədə'), findsOneWidget);
  });

  toolTest('validates and saves a reading', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'flow'});
    await h.pump(tester, BloodPressureTracker(onBack: () {}));
    expect(find.text('Hələ ölçmə yoxdur'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('bp-sys')), '300');
    await tester.enterText(find.byKey(const ValueKey('bp-dia')), '80');
    await tester.pump();
    await tester.tap(find.text('Qeyd et'));
    await settle(tester);
    expect(find.text('Düzgün dəyərlər daxil edin (məs. 120/80)'), findsOneWidget);
    expect(h.db.rows('blood_pressure_logs'), isEmpty);

    await tester.enterText(find.byKey(const ValueKey('bp-sys')), '118');
    await tester.enterText(find.byKey(const ValueKey('bp-pulse')), '72');
    await tester.pump();
    await tester.tap(find.text('Qeyd et'));
    await settle(tester);
    final row = h.db.rows('blood_pressure_logs').single;
    expect([row['systolic'], row['diastolic'], row['pulse'], row['user_id']], [118, 80, 72, testUserId]);
    expect(find.text('118/80'), findsWidgets);
  });
}
