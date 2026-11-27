// Ported from: (golden baselines — no React counterpart) — the flow home sections, period calendar and daily logger
// at 390×844 in light / dark and one RTL, with the fixture of tools/reference-shots flow.tabs__home (20 Nov 2026,
// cycle day 12, 5 learned cycles, positive OPK on the 20th). Self-generated: Flutter renders, not web parity.
import 'package:anacan/features/home_flow/flow_daily_logger.dart';
import 'package:anacan/features/home_flow/flow_dashboard.dart';
import 'package:anacan/features/home_flow/flow_period_calendar.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'flow_test_support.dart';

FlowTestEnv fixtureEnv() {
  final env = FlowTestEnv(
    now: DateTime(2026, 11, 20, 10),
    lastPeriod: DateTime(2026, 11, 9),
    extra: [
      flowHomeSlotsProvider.overrideWithValue(FlowHomeSlots(waterWidget: (context) => const SizedBox(height: 0))),
    ],
  );
  final r = env.repo;
  r.cycles = [
    for (final (i, c) in [(6, '2026-10-12', 28), (5, '2026-09-14', 28), (4, '2026-08-17', 28), (3, '2026-07-19', 29), (2, '2026-06-21', 28)].indexed)
      {'id': 'c$i', 'cycle_number': c.$1, 'start_date': c.$2, 'end_date': c.$2, 'cycle_length': c.$3, 'period_length': 5, 'created_at': ''},
  ];
  r.periodLogs = [
    {'id': 'p9', 'log_date': '2026-11-09', 'flow_intensity': 'light'},
    {'id': 'p10', 'log_date': '2026-11-10', 'flow_intensity': 'medium'},
    {'id': 'p11', 'log_date': '2026-11-11', 'flow_intensity': 'heavy'},
    {'id': 'p12', 'log_date': '2026-11-12', 'flow_intensity': 'medium'},
    {'id': 'p13', 'log_date': '2026-11-13', 'flow_intensity': 'light'},
  ];
  r.dailyLogs = [
    {'id': 'd20', 'log_date': '2026-11-20', 'mood': 4, 'energy_level': 4, 'symptoms': ['cramps'], 'water_glasses': 0, 'ovulation_test': 'positive'},
    {'id': 'd18', 'log_date': '2026-11-18', 'mood': 3, 'energy_level': 5, 'symptoms': ['bloating'], 'water_glasses': 0},
    {'id': 'd15', 'log_date': '2026-11-15', 'mood': 5, 'energy_level': 3, 'symptoms': ['cramps'], 'water_glasses': 0},
  ];
  r.moodLogs = [
    {'log_date': '2026-11-15', 'mood': 5, 'energy_level': 3, 'pain_level': 1, 'sleep_quality': 4},
    {'log_date': '2026-11-18', 'mood': 3, 'energy_level': 5, 'pain_level': 0, 'sleep_quality': 3},
    {'log_date': '2026-11-20', 'mood': 4, 'energy_level': 4, 'pain_level': 2, 'sleep_quality': 4},
  ];
  r.symptoms = [
    {'id': 's1', 'symptom_key': 'cramps', 'label': 'Sancı', 'label_az': 'Sancı', 'emoji': '⚡', 'sort_order': 1},
    {'id': 's2', 'symptom_key': 'bloating', 'label': 'Köp', 'label_az': 'Köp', 'emoji': '🎈', 'sort_order': 2},
  ];
  r.insights = [
    {'id': 'i1', 'title': 'Enerji yüksəlir', 'content': 'Estrogen artır — yeni işlərə başlamaq üçün yaxşı vaxtdır.', 'emoji': '⚡', 'phase': 'follicular'},
  ];
  r.tips = [
    {'id': 't1', 'title': 'Enerji yüksəlir', 'content': 'Estrogen artır — yeni işlərə başlamaq üçün yaxşı vaxtdır.', 'emoji': '⚡', 'category': 'nutrition', 'phase': 'follicular'},
  ];
  r.reminders = [
    {'id': 'r1', 'reminder_type': 'period_start', 'days_before': 2, 'time_of_day': '09:00:00', 'is_enabled': true},
    {'id': 'r2', 'reminder_type': 'ovulation', 'days_before': 1, 'time_of_day': '09:00:00', 'is_enabled': true},
    {'id': 'r3', 'reminder_type': 'pms', 'days_before': 0, 'time_of_day': '09:00:00', 'is_enabled': false},
  ];
  return env;
}

void main() {
  flowSetUpAll();

  Future<void> shoot(WidgetTester tester, Widget child, String name, {bool dark = false, bool rtl = false, double offset = 0}) async {
    final env = fixtureEnv();
    addTearDown(env.dispose);
    phoneSurface(tester);
    final controller = ScrollController();
    await tester.pumpWidget(UncontrolledProviderScopeWrapper(env: env, dark: dark, rtl: rtl, controller: controller, child: child));
    await goldenSettle(tester);
    if (offset > 0) {
      controller.jumpTo(offset.clamp(0, controller.position.maxScrollExtent));
      await tester.pump();
      await settleSvgs(tester);
    }
    await expectLater(find.byKey(const ValueKey('golden-root')), matchesGoldenFile('goldens/$name.png'));
  }

  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';
    for (final (i, offset) in [0.0, 800.0, 1600.0, 2400.0, 3200.0, 4000.0].indexed) {
      testWidgets('flow home s$i $mode', (tester) => shoot(tester, const FlowDashboard(), 'flow_home_s${i}_$mode', dark: dark, offset: offset));
    }
    testWidgets('flow calendar $mode', (tester) => shoot(tester, const FlowPeriodCalendar(), 'flow_calendar_$mode', dark: dark));
    for (final (i, offset) in [0.0, 760.0].indexed) {
      testWidgets('flow logger p$i $mode', (tester) => shoot(tester, const FlowDailyLogger(), 'flow_logger_p${i}_$mode', dark: dark, offset: offset));
    }
  }
  testWidgets('flow home s1 rtl', (tester) => shoot(tester, const FlowDashboard(), 'flow_home_s1_rtl', rtl: true, offset: 800));
}

/// Like FlowTestEnv.wrap with an external scroll controller and a golden key on the viewport.
class UncontrolledProviderScopeWrapper extends StatelessWidget {
  const UncontrolledProviderScopeWrapper({super.key, required this.env, required this.child, required this.controller, this.dark = false, this.rtl = false});
  final FlowTestEnv env;
  final Widget child;
  final ScrollController controller;
  final bool dark;
  final bool rtl;
  @override
  Widget build(BuildContext context) => RepaintBoundary(
        key: const ValueKey('golden-root'),
        child: env.wrap(child, dark: dark, rtl: rtl, controller: controller),
      );
}
