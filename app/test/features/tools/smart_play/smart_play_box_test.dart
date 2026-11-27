// Ported from: (no vitest file for SmartPlayBox.tsx / usePlayActivities.ts) — behaviour checks of the port: the age
// filter (corrected age, profile fallback with date-fns differenceInDays / differenceInMonths), the inventory match
// order, today's recommendation, the home items picker and logging a finished game with its rating.
import 'package:anacan/features/tools/health_common/health_db.dart';
import 'package:anacan/features/tools/smart_play/smart_play_box.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart' show FakeHealthDb;
import '../more_support/more_harness.dart';

Map<String, dynamic> activity(String id, {int min = 0, int max = 3650, List<String> items = const [], List<String> skills = const ['motor'], int sort = 0}) => {
      'id': id,
      'title': 'Oyun $id',
      'description': 'Təsvir $id',
      'instructions': 'Addım 1\nAddım 2',
      'min_age_days': min,
      'max_age_days': max,
      'duration_minutes': 10,
      'required_items': items,
      'skill_tags': skills,
      'difficulty_level': 'easy',
      'is_active': true,
      'sort_order': sort,
    };

void main() {
  group('age and matching', () {
    test('date-fns style whole days and months', () {
      expect(playDifferenceInDays(DateTime(2026, 11, 27, 10), DateTime(2026, 11, 20, 12)), 6);
      expect(playDifferenceInDays(DateTime(2026, 11, 27, 12), DateTime(2026, 11, 20, 12)), 7);
      expect(playDifferenceInMonths(DateTime(2026, 11, 27), DateTime(2026, 9, 28)), 1);
      expect(playDifferenceInMonths(DateTime(2026, 11, 28), DateTime(2026, 9, 28)), 2);
    });

    test('labels the age from the child (corrected) or the profile birth date', () {
      expect(playBabyInfo(child: (days: 20, months: 0, corrected: false)).label, '20 günlük');
      expect(playBabyInfo(child: (days: 100, months: 3, corrected: true)).label, '3 aylıq (korreksiya)');
      expect(playBabyInfo(child: (days: 500, months: 16, corrected: false)).label, '1 yaş 4 ay');
      expect(playBabyInfo(child: (days: 730, months: 24, corrected: false)).label, '2 yaş');
      final p = playBabyInfo(babyBirthDate: '2026-11-01', now: DateTime(2026, 11, 27, 12));
      expect(p.days, 26);
      expect(p.months, 0);
      expect(playBabyInfo().label, '');
    });

    test('keeps activities of the age and puts the ones matching home items first', () {
      final all = [
        activity('a', items: ['Top']),
        activity('b', items: ['Top', 'Qaşıq']),
        activity('c', min: 400),
        activity('d'),
        activity('e', items: ['Kağız']),
      ];
      final none = playRecommendations(all, 100, const []);
      expect(none.filtered.map((x) => x['id']), ['a', 'b', 'd', 'e']);
      expect(none.matched, isEmpty);
      expect(none.today?['id'], 'a');
      final some = playRecommendations(all, 100, ['top', 'qaşıq']);
      expect(some.matched.map((x) => x['id']), ['b', 'a', 'd']);
      expect(some.today?['id'], 'b');
    });
  });

  group('screen', () {
    late MoreToolsHarness h;
    late FakeHealthDb db;
    setUp(() {
      h = MoreToolsHarness();
      db = FakeHealthDb({
        'play_activities': [activity('a1', items: ['Top'], sort: 1), activity('a2', items: ['Qab'], skills: ['language', 'social'], sort: 2)],
        'play_inventory_items': [
          {'id': 'i1', 'name': 'Top', 'name_az': 'Top', 'emoji': '⚽', 'category': 'toys', 'is_active': true, 'sort_order': 1},
          {'id': 'i2', 'name': 'Qab', 'name_az': 'Qab', 'emoji': '🥣', 'category': 'kitchen', 'is_active': true, 'sort_order': 2},
        ],
        'user_play_inventory': [],
      });
      h.extra.add(healthDbProvider.overrideWithValue(db));
    });

    Future<void> settle(WidgetTester tester) async {
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
    }

    Finder key(String k) => find.byKey(ValueKey(k));

    testWidgets('picks home items and recommends the matching game first', (tester) async {
      await h.pump(tester, SmartPlayBox(onBack: () {}));
      await settle(tester);
      expect(key('smartplay-setup'), findsOneWidget);
      expect(find.text('Oyun a1'), findsWidgets);
      expect(tester.widget<Text>(key('smartplay-skill-motor')).data, '1');
      await tester.tap(key('smartplay-setup'));
      await settle(tester);
      await tester.tap(key('smartplay-item-i2'));
      await settle(tester);
      expect(db.rows('user_play_inventory').single, containsPair('item_name', 'Qab'));
      expect(key('smartplay-inventory-count'), findsOneWidget);
      // The toggle removes it again.
      await tester.tap(key('smartplay-item-i2'));
      await settle(tester);
      expect(db.rows('user_play_inventory'), isEmpty);
      await tester.tap(key('smartplay-item-i2'));
      await settle(tester);
      await tester.tapAt(const Offset(5, 5));
      await settle(tester);
      expect(key('smartplay-setup'), findsNothing);
      expect(find.textContaining('Sizin üçün (1)'), findsOneWidget);
      expect(key('smartplay-row-a2'), findsOneWidget);
      expect(key('smartplay-row-a1'), findsNothing);
      await h.finish(tester);
    });

    testWidgets('logs a finished game with its rating; closing the rating brings the detail back', (tester) async {
      await h.pump(tester, SmartPlayBox(onBack: () {}));
      await settle(tester);
      await tester.tap(key('smartplay-start'));
      await settle(tester);
      expect(find.text('Addım 1\nAddım 2'), findsOneWidget);
      await tester.tap(key('smartplay-complete-open'));
      await settle(tester);
      expect(key('smartplay-log'), findsOneWidget);
      await tester.tapAt(const Offset(5, 5));
      await settle(tester);
      expect(key('smartplay-complete-open'), findsOneWidget);
      await tester.tap(key('smartplay-complete-open'));
      await settle(tester);
      await tester.tap(key('smartplay-star-4'));
      await tester.pump();
      await tester.tap(key('smartplay-log'));
      await settle(tester);
      final log = db.rows('play_activity_logs').single;
      expect(log['activity_id'], 'a1');
      expect(log['rating'], 4);
      expect(log['user_id'], 'u1');
      expect(log.containsKey('notes'), false);
      expect(key('smartplay-log'), findsNothing);
      expect(key('smartplay-complete-open'), findsNothing);
      expect(find.text('Oyun tamamlandı! 🎉'), findsOneWidget);
      await h.finish(tester);
    });
  });
}
