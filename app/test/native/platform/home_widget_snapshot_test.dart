// Ported from: src/lib/sleep-widgets.test.ts ("home widgets" cases), plus the snapshot JSON / sleep plan / mommy data
//              of src/lib/home-widgets.ts and src/hooks/useHomeWidgetSync.ts
import 'dart:convert';

import 'package:anacan/domain/baby/baby_logs_range.dart';
import 'package:anacan/features/home/home_slots.dart';
import 'package:anacan/features/settings/copy/feature_copy.dart';
import 'package:anacan/features/settings/widget_settings_screen.dart';
import 'package:anacan/native/platform/home_widgets/home_widget_snapshot.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime at(int h, [int m = 0, int dayOffset = 0]) => DateTime(2026, 11, 10 + dayOffset, h, m);

const WidgetCare care = WidgetCare(
  name: 'Murad',
  age: '3',
  emoji: '👶',
  lastFeedAt: 1,
  lastFeedText: 'x',
  nextNapStart: 2,
  nextNapEnd: 3,
  nextNapIsBedtime: false,
  sleepingSince: null,
  todayFeeds: 4,
  todaySleep: '2s 10d',
  todayDiapers: 3,
);

void main() {
  final az = widgetText('az');

  group('home widgets', () {
    test('never puts the real feeding or sleep data into the snapshot without Premium (shows a locked sample)', () {
      final free = buildWidgetSnapshot(text: az, premium: false, settings: const WidgetSettings(), journey: null, care: care, now: at(15));
      expect(free.careLocked, isTrue);
      expect(free.care?.name, isNot('Murad'));
      expect(free.care?.lastFeedAt, isNot(1));
      expect(free.care?.nextNapStart, isNot(2));
      expect(free.labels['premiumTitle'], az('premium_title'));
      expect(free.links['premium'], 'anacan://premium');
      final paid = buildWidgetSnapshot(
          text: az, premium: true, settings: const WidgetSettings(showFeed: false), journey: null, care: care, now: at(15));
      expect(paid.careLocked, isFalse);
      expect(paid.care?.lastFeedAt, isNull);
      expect(paid.care?.lastFeedText, '');
      expect(paid.care?.nextNapStart, 2);
    });

    test('stamps the day the today-totals belong to, the app locale and native-only labels', () {
      final snap = buildWidgetSnapshot(
          text: az, premium: true, settings: const WidgetSettings(), journey: null, care: care, now: at(15, 30), locale: 'az-AZ');
      expect(snap.care?.dayStart, DateTime(2026, 11, 10).millisecondsSinceEpoch);
      expect(snap.locale, 'az-AZ');
      expect(snap.labels['timerIdle'], az('timer_idle'));
      expect(snap.labels['sideLeft'], az('sides.left'));
      expect(snap.labels['todayZeroSleep'], '0 dəq');
    });

    test('formats age, durations and the last feed', () {
      expect(babyAgeText(az, DateTime(2026, 7, 29), DateTime(2026, 11, 10)), '3 ay 12 gün');
      expect(babyAgeText(az, DateTime(2026, 11, 1), DateTime(2026, 11, 10)), '9 gün');
      expect(babyAgeText(az, DateTime(2025, 8, 10), DateTime(2026, 11, 10)), '1 yaş 3 ay');
      expect(compactDuration(az, 100), '1s 40d');
      expect(compactDuration(az, 25), '25 dəq');
      final feed = lastFeed(az, const [
        BabyLogRow(id: '1', logType: 'feeding', feedType: 'breast_left', startTime: '2026-11-10T10:00:00.000Z', endTime: '2026-11-10T10:14:00.000Z'),
        BabyLogRow(id: '2', logType: 'feeding', feedType: 'formula', startTime: '2026-11-10T07:00:00.000Z'),
      ]);
      expect(feed?.text, 'Sol sinə · 14 dəq');
      expect(feed?.at, DateTime.utc(2026, 11, 10, 10, 14).millisecondsSinceEpoch);
    });
  });

  group('snapshot JSON (read by AnacanWidgets.kt and the iOS widget extension)', () {
    test('has the React field names; updatedAt is left out of the dedupe key', () {
      const journey = HomeWidgetJourney(eyebrow: 'Murad', title: '3 ay', subtitle: '', badge: '', progress: 0, emoji: '👶');
      final snap = buildWidgetSnapshot(
          text: az, premium: true, settings: const WidgetSettings(privacy: true, showActions: false), journey: journey, care: care, now: at(9), locale: 'az-AZ');
      final json = jsonDecode(snap.encode()) as Map<String, dynamic>;
      expect(json.keys, ['v', 'updatedAt', 'locale', 'premium', 'privacy', 'showActions', 'journey', 'care', 'careLocked', 'word', 'labels', 'links']);
      expect(json['v'], 1);
      expect(json['privacy'], isTrue);
      expect(json['showActions'], isFalse);
      expect((json['journey'] as Map)['eyebrow'], 'Murad');
      expect((json['care'] as Map)['sleepingSince'], isNull);
      expect((json['care'] as Map).containsKey('sleepingSince'), isTrue);
      expect(json['links'], kWidgetLinks);
      final later = buildWidgetSnapshot(
          text: az, premium: true, settings: const WidgetSettings(privacy: true, showActions: false), journey: journey, care: care, now: at(9, 0), locale: 'az-AZ');
      expect(later.stableKey(), snap.stableKey());
      expect(snap.stableKey().contains('updatedAt'), isFalse);
    });

    test('daily word rotates by the day of the year', () {
      final words = az.list('words');
      expect(words, isNotEmpty);
      final w = dailyWord(az, DateTime(2026, 1, 1, 12))!;
      expect(w.eyebrow, az('word_eyebrow'));
      expect(w.text, words[1 % words.length]);
      expect(dailyWord(az, DateTime(2026, 1, 2, 12))!.text, words[2 % words.length]);
    });
  });

  group('sleep plan and mommy data (useHomeWidgetSync)', () {
    test('reads the selected child\'s v2 plan first, then the legacy v1 plan', () {
      final store = <String, String>{
        'anacan.sleepTraining.v1.u1': jsonEncode({'wakeTime': '06:30', 'pendingSleepStart': '2026-11-10T08:00:00.000Z'}),
      };
      final legacy = sleepPlan((k) => store[k], 'u1', 'c1', at(12));
      expect(legacy.wakeTime, '06:30');
      expect(legacy.sleepingSince?.millisecondsSinceEpoch, DateTime.utc(2026, 11, 10, 8).millisecondsSinceEpoch);
      store['anacan.sleepTraining.v2.u1.c1'] = jsonEncode({
        'v': 2,
        'plan': {'wakeTime': '07:30'},
        'updatedAt': '2026-11-10T07:00:00.000Z',
        'dirty': false,
      });
      final current = sleepPlan((k) => store[k], 'u1', 'c1', at(12));
      expect(current.wakeTime, '07:30');
      expect(current.sleepingSince, isNull);
      expect(sleepPlan((k) => store[k], null, 'c1', at(12)).wakeTime, isNull);
    });

    test('builds the baby journey and today\'s care totals', () {
      final logs = [
        BabyLogRow(id: '1', logType: 'feeding', feedType: 'breast_right', startTime: at(9).toUtc().toIso8601String(), endTime: at(9, 20).toUtc().toIso8601String()),
        BabyLogRow(id: '2', logType: 'sleep', startTime: at(10).toUtc().toIso8601String(), endTime: at(11).toUtc().toIso8601String()),
        BabyLogRow(id: '3', logType: 'diaper', diaperType: 'wet', startTime: at(11, 30).toUtc().toIso8601String()),
      ];
      final data = mommyWidgetData(
        text: az,
        birthIso: '2026-07-29',
        name: 'Murad',
        emoji: '👶',
        logs: logs,
        plan: (sleepingSince: null, wakeTime: '07:00'),
        now: at(12),
      );
      expect(data.journey.eyebrow, 'Murad');
      expect(data.journey.title, '3 ay 12 gün');
      expect(data.journey.progress, 0);
      expect(data.care.lastFeedAt, at(9, 20).millisecondsSinceEpoch);
      expect(data.care.lastFeedText, '${az('sides.right')} · 20 dəq');
      expect(data.care.todayFeeds, 1);
      expect(data.care.todayDiapers, 1);
      expect(data.care.todaySleep, '1s 0d');
      expect(data.care.nextNapStart, isNotNull);
    });
  });
}
