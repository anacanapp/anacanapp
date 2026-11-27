// Ported from: (no React suites) — display conditions of src/components/flow/{PeriodDelayBanner,CycleAnomalyBanner}.tsx,
// plus the card behaviour of PillReminderCard / FlowRemindersCard / CycleTrendChart.
import 'package:anacan/domain/notifications/local_notification_plan.dart' show StoredNotification;
import 'package:anacan/features/home_flow/cycle_anomaly_banner.dart';
import 'package:anacan/features/home_flow/cycle_trend_chart.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/features/home_flow/flow_reminders_card.dart';
import 'package:anacan/features/home_flow/period_delay_banner.dart';
import 'package:anacan/features/home_flow/pill_reminder_card.dart';
import 'package:anacan/features/home_flow/data/flow_hooks.dart';
import 'package:flutter_test/flutter_test.dart';

import 'flow_test_support.dart';

class _Planner implements FlowNotificationPlanner {
  final List<(String, List<StoredNotification>, List<int>)> calls = [];
  @override
  bool get isNativePlatform => true;
  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) async =>
      calls.add((namespace, items, cancelIds));
}

void main() {
  flowSetUpAll();

  group('periodDelayDays', () {
    final now = DateTime(2026, 9, 14, 12);
    test('null without a last period', () => expect(periodDelayDays(lastPeriodDate: null, averageCycleLength: 28, cycleLength: 28, now: now), isNull));
    test('days since minus the average cycle (falls back to the cycle length, then 28)', () {
      expect(periodDelayDays(lastPeriodDate: DateTime(2026, 8, 14), averageCycleLength: 28, cycleLength: 30, now: now), 3);
      expect(periodDelayDays(lastPeriodDate: DateTime(2026, 8, 14), averageCycleLength: 0, cycleLength: 30, now: now), 1);
      expect(periodDelayDays(lastPeriodDate: DateTime(2026, 8, 14), averageCycleLength: 0, cycleLength: 0, now: now), 3);
    });
  });

  group('PeriodDelayBanner', () {
    testWidgets('shows from 3 days late and inserts one throttled notification', (tester) async {
      final env = FlowTestEnv(lastPeriod: DateTime(2026, 8, 14)); // 31 days since, avg 28 → 3 days late
      addTearDown(env.dispose);
      phoneSurface(tester);
      await tester.pumpWidget(env.wrap(const PeriodDelayBanner()));
      await settle(tester);
      expect(find.text('Periodunuz 3 gün gecikir'), findsOneWidget);
      expect(find.text('TSİKL XƏBƏRDARLIĞI'), findsOneWidget); // CSS uppercase under lang=az: i → İ
      expect(env.repo.calls.where((c) => c.$1 == 'insertNotification'), hasLength(1));
      expect((env.repo.calls.firstWhere((c) => c.$1 == 'insertNotification').$2! as Map)['notification_type'], 'flow_delay');
    });

    testWidgets('hidden when 2 days late', (tester) async {
      final env = FlowTestEnv(lastPeriod: DateTime(2026, 8, 15));
      addTearDown(env.dispose);
      phoneSurface(tester);
      await tester.pumpWidget(env.wrap(const PeriodDelayBanner()));
      await settle(tester);
      expect(find.textContaining('gecikir'), findsNothing);
      expect(env.repo.calls.where((c) => c.$1 == 'insertNotification'), isEmpty);
    });
  });

  group('cycleAnomalies', () {
    test('needs one completed cycle; short, long and irregular rules', () {
      expect(cycleAnomalies([{'cycle_length': null}], cycleStatsOf([{'cycle_length': null}], 28)), isEmpty);
      final cycles = [
        {'cycle_length': 19},
        {'cycle_length': 40},
        {'cycle_length': 28},
      ];
      final a = cycleAnomalies(cycles, cycleStatsOf(cycles, 28));
      expect(a.map((x) => x.warn), [true, true, false]);
      expect(a[0].message, contains('19'));
      expect(a[1].message, contains('40'));
      expect(a[2].message, contains('21'));
      final normal = [
        {'cycle_length': 28},
        {'cycle_length': 30},
      ];
      expect(cycleAnomalies(normal, cycleStatsOf(normal, 28)), isEmpty);
    });

    testWidgets('banner renders one card per anomaly', (tester) async {
      final env = FlowTestEnv();
      addTearDown(env.dispose);
      env.repo.cycles = [
        {'id': 'a', 'cycle_number': 2, 'cycle_length': 53},
        {'id': 'b', 'cycle_number': 1, 'cycle_length': 28},
      ];
      phoneSurface(tester);
      await tester.pumpWidget(env.wrap(const CycleAnomalyBanner()));
      await settle(tester);
      expect(find.text('Uzun tsikl aşkar edildi'), findsOneWidget);
      expect(find.text('Qısa tsikl aşkar edildi'), findsNothing);
    });
  });

  test('cycleTrendData keeps the last 12 lengths oldest first', () {
    final d = cycleTrendData([
      for (var i = 14; i >= 1; i--) {'cycle_number': i, 'cycle_length': 20 + i},
      {'cycle_number': 0, 'cycle_length': null},
    ]);
    expect(d, hasLength(12));
    expect(d.first.cycle, '#3');
    expect(d.last.length, 34);
  });

  testWidgets('CycleTrendChart hides below two cycles', (tester) async {
    final env = FlowTestEnv();
    addTearDown(env.dispose);
    env.repo.cycles = [{'id': 'a', 'cycle_number': 1, 'cycle_length': 28}];
    phoneSurface(tester);
    await tester.pumpWidget(env.wrap(const CycleTrendChart()));
    await settle(tester);
    expect(find.text('Tsikl Uzunluğu Trendi'), findsNothing);
  });

  testWidgets('PillReminderCard: switching on saves the pill reminder and schedules id 91201 daily', (tester) async {
    final planner = _Planner();
    final env = FlowTestEnv(extra: [flowNotificationPlannerProvider.overrideWithValue(planner)]);
    addTearDown(env.dispose);
    phoneSurface(tester);
    await tester.pumpWidget(env.wrap(const PillReminderCard()));
    await settle(tester);
    expect(find.text('Gündəlik kontrasepsiya və ya dərman xatırlatması üçün aktiv edin.'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Həb Xatırlatması').last);
    await settle(tester);
    final saved = env.repo.calls.firstWhere((c) => c.$1 == 'upsertReminder').$2! as Map;
    expect((saved['reminder_type'], saved['time_of_day'], saved['is_enabled'], saved['user_id']), ('pill', '09:00:00', true, 'u1'));
    expect(planner.calls.single.$1, 'flow-pill');
    expect(planner.calls.single.$2.single.id, pillNotificationId);
    expect(planner.calls.single.$2.single.repeat, 'day');
    expect(find.text('Hər gün 09:00'), findsOneWidget);
  });

  testWidgets('FlowRemindersCard: creates defaults when empty and lists them with localized titles', (tester) async {
    final env = FlowTestEnv();
    addTearDown(env.dispose);
    phoneSurface(tester);
    await tester.pumpWidget(env.wrap(const FlowRemindersCard()));
    await settle(tester);
    expect(env.repo.calls.where((c) => c.$1 == 'upsertReminders'), hasLength(1));
    expect(find.text('4 aktiv'), findsOneWidget);
    expect(find.text('Period yaxınlaşır'), findsOneWidget);
    expect(find.text('Hamısını göstər (4)'), findsOneWidget);
    await tester.tap(find.text('Hamısını göstər (4)'));
    await settle(tester);
    expect(find.text('PMS dövrü'), findsOneWidget);
  });
}
