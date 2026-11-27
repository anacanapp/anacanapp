// Ported from: (no vitest for MentalHealthTracker.tsx / useMentalHealth.ts — behaviour checks of the port, incl. the
//              EPDS self-harm path of src/lib/epdsScoring.ts)
import 'package:anacan/domain/dates/local_date.dart';
import 'package:anacan/features/tools/mental_health/mental_health_data.dart';
import 'package:anacan/features/tools/mental_health/mental_health_tracker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

const firstOptions = [
  'Həmişəki kimi',
  'Həmişəki qədər',
  'Bəli, çox vaxt',
  'Xeyr, ümumiyyətlə yox',
  'Bəli, kifayət qədər çox',
  'Bəli, çox vaxt bacarmırdım',
  'Bəli, çox vaxt',
  'Bəli, çox vaxt',
  'Bəli, çox vaxt',
  'Bəli, kifayət qədər tez-tez',
];

void main() {
  group('EPDS prompt', () {
    final now = DateTime(2026, 11, 27, 12);
    String day(int ago) => daysAgoKey(ago, now);

    test('5 consecutive low days (check-ins or daily logs) prompt the questionnaire', () {
      final logs = [for (var i = 0; i < 5; i++) {'log_date': day(i), 'mood': 2}];
      expect(shouldShowEpdsPrompt(const [], logs, now: now), isTrue);
      expect(shouldShowEpdsPrompt(const [], logs.take(4).toList(), now: now), isFalse);
    });

    test('a check-in of the same day wins over the daily log', () {
      final logs = [for (var i = 0; i < 5; i++) {'log_date': day(i), 'mood': 1}];
      final checkins = [{'checked_at': day(2), 'mood_level': 5}];
      expect(shouldShowEpdsPrompt(checkins, logs, now: now), isFalse);
      expect(mergeMoodSignals(checkins, logs, now: now).firstWhere((s) => s.checkedAt == day(2)).moodLevel, 5);
    });

    test('older than 14 days does not count', () {
      final logs = [for (var i = 15; i < 25; i++) {'log_date': day(i), 'mood': 1}];
      expect(shouldShowEpdsPrompt(const [], logs, now: now), isFalse);
    });
  });

  test('help lines: only the user\'s country when rows carry a country; the old schema shows all', () {
    final rows = [
      {'name': 'AZ', 'country_code': 'AZ'},
      {'name': 'UZ', 'country_code': 'UZ'},
      {'name': 'legacy', 'country_code': null},
    ];
    expect(filterResourcesByCountry(rows, 'AZ').map((r) => r['name']), ['AZ', 'legacy']);
    expect(filterResourcesByCountry([{'name': 'x'}], 'UZ'), hasLength(1));
    expect(mentalHealthCountry('kk', null, null), 'KZ');
  });

  Future<void> answerAll(WidgetTester tester) async {
    for (var i = 0; i < firstOptions.length; i++) {
      await tester.tap(find.text(firstOptions[i]).last);
      await settle(tester, 2);
      if (i < firstOptions.length - 1) {
        await tester.tap(find.text('Növbəti'));
        await settle(tester, 2);
      }
    }
  }

  toolTest('a self-harm answer shows the inline help and the urgent result with the emergency call', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'mommy'});
    await h.pump(tester, MentalHealthTracker(onBack: () {}));
    await tester.tap(find.text('EPDS Testi'));
    await settle(tester);
    await answerAll(tester);
    expect(find.byKey(const ValueKey('epds-self-harm-inline')), findsOneWidget);
    await tester.tap(find.text('Nəticəni Gör'));
    await settle(tester);
    final row = h.db.rows('epds_assessments').single;
    expect(row['risk_level'], 'high');
    expect(find.byKey(const ValueKey('epds-urgent-help')), findsOneWidget);
    expect(find.text('Təcili dəstək'), findsWidgets);
    await tester.tap(find.descendant(of: find.byKey(const ValueKey('epds-urgent-help')), matching: find.byKey(const ValueKey('mh-emergency-call'))));
    expect(h.launched.last, Uri(scheme: 'tel', path: '103'));
  });

  toolTest('when saving fails the result is still shown on the device', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'mommy'});
    h.db.failWrite['epds_assessments'] = Exception('offline');
    await h.pump(tester, MentalHealthTracker(onBack: () {}));
    await tester.tap(find.text('EPDS Testi'));
    await settle(tester);
    await answerAll(tester);
    await tester.tap(find.text('Nəticəni Gör'));
    await settle(tester);
    expect(h.db.rows('epds_assessments'), isEmpty);
    expect(find.byKey(const ValueKey('epds-urgent-help')), findsOneWidget);
  });

  toolTest('a mood check-in is saved and mirrored to the daily log', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'mommy'});
    await h.pump(tester, MentalHealthTracker(onBack: () {}));
    await tester.enterText(find.byKey(const ValueKey('mh-notes')), 'yorğunam');
    await tester.tap(semanticsWidget('Yaxşı'));
    await settle(tester);
    final checkin = h.db.rows('mood_checkins').single;
    expect([checkin['mood_level'], checkin['checked_at'], checkin['notes']], [4, todayKey(), 'yorğunam']);
    final daily = h.db.rows('daily_logs').single;
    expect([daily['mood'], daily['log_date']], [4, todayKey()]);
    expect(h.partnerMoods, [4]);
    expect(find.textContaining('hiss edirsiniz'), findsOneWidget);
  });
}
