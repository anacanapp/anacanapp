// Ported from: (no vitest for VitaminTracker.tsx / useVitaminSchedules.ts — behaviour checks of the port)
import 'package:anacan/domain/dates/local_date.dart';
import 'package:anacan/features/tools/vitamins/vitamin_data.dart';
import 'package:anacan/features/tools/vitamins/vitamin_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> schedule(String id, String name, {bool active = true, bool notify = true}) => {
      'id': id,
      'user_id': testUserId,
      'vitamin_name': name,
      'icon_emoji': '🟢',
      'scheduled_time': '08:00:00',
      'days_of_week': [0, 1, 2, 3, 4, 5, 6],
      'is_active': active,
      'notification_enabled': notify,
    };

void main() {
  test('saved names are shown in the app language (DB row, then the presets)', () {
    final db = [
      {'name': 'Vitamin D', 'name_az': 'D vitamini', 'name_en': 'Vitamin D'},
    ];
    expect(translatedVitaminName('d vitamini', db, 'en'), 'Vitamin D');
    expect(translatedVitaminName('Iron', const [], 'az'), 'Dəmir');
    expect(translatedVitaminName('My pill', const [], 'az'), 'My pill');
  });

  toolTest('marks a vitamin taken through the offline outbox and undoes it', (tester) async {
    final h = HealthHarness(tables: {'user_vitamin_schedules': [schedule('s1', 'Folat (Fol turşusu)'), schedule('s2', 'Old', active: false)]});
    await h.pump(tester, VitaminTracker(onBack: () {}));
    expect(find.text('0/1'), findsOneWidget);
    expect(find.text('Old'), findsNothing);

    await tester.tap(semanticsWidget('Folat (Fol turşusu)'));
    await settle(tester);
    final log = h.db.rows('vitamin_intake_logs').single;
    expect([log['schedule_id'], log['log_date'], log['user_id']], ['s1', todayKey(), testUserId]);
    expect(find.text('1/1'), findsOneWidget);
    expect(find.text('🎉 Bütün vitaminlər qəbul edildi!'), findsOneWidget);

    await tester.tap(semanticsWidget('Folat (Fol turşusu)'));
    await settle(tester);
    expect(h.db.rows('vitamin_intake_logs'), isEmpty);
    expect(find.text('0/1'), findsOneWidget);
  });

  toolTest('adds a schedule from the modal (name required)', (tester) async {
    final h = HealthHarness();
    await h.pump(tester, VitaminTracker(onBack: () {}));
    expect(find.text('Vitamin əlavə edin'), findsOneWidget);
    await tester.tap(find.text('+ Vitamin əlavə et'));
    await settle(tester);
    await tester.tap(find.text('Vitamin Əlavə Et').last);
    await settle(tester);
    expect(find.text('Vitamin adını daxil edin'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('vit-name')), 'Omega-3');
    await tester.tap(find.text('Vitamin Əlavə Et').last);
    await settle(tester);
    final row = h.db.rows('user_vitamin_schedules').single;
    expect([row['vitamin_name'], row['scheduled_time'], row['notification_enabled']], ['Omega-3', '08:00:00', true]);
  });
}
