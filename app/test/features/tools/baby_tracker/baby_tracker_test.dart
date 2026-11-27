// Ported from: (no vitest file for BabyTracker.tsx) — behaviour checks of the port: widget hand-off, diaper /
// formula writes through the offline outbox, the diaper hero achievement, two-tap delete, period chips, and the
// useAchievements hook (unlockAchievement / realtime toast).
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/tools/baby_tracker/achievements.dart';
import 'package:anacan/features/tools/baby_tracker/baby_tracker.dart';
import 'package:anacan/features/tools/baby_tracker/bt_ui.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/baby_tools_harness.dart';

String iso(DateTime d) => jsToIsoString(d);

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late BabyToolsHarness h;
  late DateTime now;

  setUp(() {
    h = BabyToolsHarness();
    now = DateTime.fromMillisecondsSinceEpoch(h.nowMs);
    DomainClock.setSystemTime(now);
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-06-01')];
  });
  tearDown(DomainClock.reset);

  Map<String, dynamic> log(String id, String type, DateTime start, {DateTime? end, String? feed, String? diaper, String? notes}) => {
        'id': id,
        'user_id': 'u1',
        'child_id': 'c1',
        'log_type': type,
        'start_time': iso(start),
        'end_time': end == null ? null : iso(end),
        'feed_type': feed,
        'diaper_type': diaper,
        'notes': notes,
        'created_at': iso(start),
      };

  testWidgets('opens the tab the home-screen widget asked for (consumeWidgetAction)', (tester) async {
    h.widgetActions.set('diaper');
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.byKey(const ValueKey('bt-diaper-wet')), findsOneWidget);
    expect(find.byKey(const ValueKey('bt-breast-left')), findsNothing);
    await h.finish(tester);
  });

  testWidgets('shows today\'s tiles and rows from the 90-day range', (tester) async {
    final today = DateTime(now.year, now.month, now.day, 8);
    h.repo.logs.addAll([
      log('f1', 'feeding', today, feed: 'formula', notes: '120 ml'),
      log('f2', 'feeding', today.add(const Duration(hours: 2)), feed: 'breast_left', end: today.add(const Duration(hours: 2, minutes: 15))),
      log('s1', 'sleep', today.add(const Duration(hours: 3)), end: today.add(const Duration(hours: 4, minutes: 30))),
      log('d1', 'diaper', today.add(const Duration(hours: 5)), diaper: 'wet'),
    ]);
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('120 ml'), findsWidgets);
    expect(find.text('1:30'), findsOneWidget); // sleep tile h:mm
    await h.finish(tester);
  });

  testWidgets('a diaper change is written through the outbox and the tenth of the day unlocks diaper hero', (tester) async {
    final today = DateTime(now.year, now.month, now.day, 1);
    for (var i = 0; i < 9; i++) {
      h.repo.logs.add(log('d$i', 'diaper', today.add(Duration(minutes: i * 5)), diaper: 'wet'));
    }
    h.widgetActions.set('diaper');
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    await tester.tap(find.byKey(const ValueKey('bt-diaper-dirty')));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(h.repo.logs.where((l) => l['diaper_type'] == 'dirty'), hasLength(1));
    expect(h.repo.logs.firstWhere((l) => l['diaper_type'] == 'dirty')['child_id'], 'c1');
    expect(h.services.achievements, ['diaper_hero']);
    await h.finish(tester);
  });

  testWidgets('saves a formula amount and rejects an invalid one', (tester) async {
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    await tester.enterText(find.descendant(of: find.byKey(const ValueKey('bt-ml')), matching: find.byType(EditableText)), '0');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('bt-formula-save')), warnIfMissed: false);
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(h.repo.logs, isEmpty);

    await tester.enterText(find.descendant(of: find.byKey(const ValueKey('bt-ml')), matching: find.byType(EditableText)), '90,5');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(h.repo.logs.single['notes'], '91 ml');
    expect(h.repo.logs.single['feed_type'], 'formula');
    await h.finish(tester);
  });

  testWidgets('deletes an entry only on the second tap', (tester) async {
    final today = DateTime(now.year, now.month, now.day, 6);
    h.repo.logs.add(log('x1', 'feeding', today, feed: 'solid', notes: 'Alma'));
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    final del = find.byKey(const ValueKey('bt-del-x1'));
    await tester.ensureVisible(del);
    await tester.tap(del);
    await tester.pump();
    expect(h.repo.logs, hasLength(1));
    await tester.tap(del);
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(h.repo.logs, isEmpty);
    await h.finish(tester);
  });

  testWidgets('the period chips switch the window', (tester) async {
    await h.pump(tester, BabyTracker(onBack: () {}));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    await tester.tap(find.byKey(const ValueKey('bt-period-30')));
    await tester.pump();
    expect(tester.widget<A3ChipButton>(find.byKey(const ValueKey('bt-period-30'))).on, isTrue);
    expect(tester.widget<A3ChipButton>(find.byKey(const ValueKey('bt-period-7'))).on, isFalse);
    await h.finish(tester);
  });

  group('useAchievements', () {
    test('unlocks once, marks it notified, and ignores duplicates', () async {
      final c = ProviderContainer(overrides: h.toolOverrides);
      addTearDown(() {
        c.dispose();
        h.dispose();
      });
      final actions = c.read(achievementsActionsProvider);
      expect(await actions.unlockAchievement('first_feed', 'mommy'), isTrue);
      expect(h.achievementsRepo.calls, ['insert:first_feed', 'notified:first_feed']);
      await c.read(queryClientProvider).refetchQueries(const QueryFilters(queryKey: ['user-achievements']));
      expect(await actions.unlockAchievement('first_feed', 'mommy'), isFalse);
      expect(h.achievementsRepo.calls, hasLength(2));
    });

    test('a duplicate key error is not an unlock', () async {
      h.achievementsRepo.rows.add({'id': 'x', 'achievement_id': 'diaper_hero', 'achievement_type': 'mommy', 'notified': true});
      final c = ProviderContainer(overrides: h.toolOverrides);
      addTearDown(() {
        c.dispose();
        h.dispose();
      });
      // Not in the cache yet: the cached list is fetched first, so nothing is inserted.
      expect(await c.read(achievementsActionsProvider).unlockAchievement('diaper_hero', 'mommy'), isFalse);
      expect(h.achievementsRepo.calls, isEmpty);
      c.read(queryClientProvider).setQueryDataValue(['user-achievements', 'u1'], const <Achievement>[]);
      expect(await c.read(achievementsActionsProvider).unlockAchievement('diaper_hero', 'mommy'), isFalse);
      expect(h.achievementsRepo.calls, ['insert:diaper_hero']);
    });

    test('totals points of the known definitions', () {
      const view = AchievementsView(
        achievements: [
          Achievement({'achievement_id': 'feeding_pro', 'achievement_type': 'mommy'}),
          Achievement({'achievement_id': 'first_kick', 'achievement_type': 'bump'}),
          Achievement({'achievement_id': 'unknown', 'achievement_type': 'mommy'}),
        ],
        loading: false,
      );
      expect(view.getTotalPoints(), 110);
      expect(view.hasAchievement('first_kick'), isTrue);
      expect(view.getAchievementsByType('mommy'), hasLength(2));
    });

    testWidgets('a realtime insert shows the achievement toast once', (tester) async {
      await h.pump(tester, BabyTracker(onBack: () {}));
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      h.achievementsRepo.listener!({'id': 'n1', 'achievement_id': 'sleep_tracker', 'achievement_type': 'mommy', 'notified': false});
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('🎉 Nailiyyət: Yuxu izləyicisi'), findsOneWidget);
      await h.finish(tester);
    });
  });
}
