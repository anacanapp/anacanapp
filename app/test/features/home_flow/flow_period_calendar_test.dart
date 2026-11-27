// Ported from: src/components/flow/FlowPeriodCalendar.test.tsx (+ day-state widget cases)
import 'package:anacan/design/design.dart';
import 'package:anacan/features/home_flow/flow_period_calendar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'flow_test_support.dart';

Finder day(String key) => find.byKey(ValueKey('flow-day-$key'));

void main() {
  flowSetUpAll();
  late FlowTestEnv env;
  setUp(() {
    env = FlowTestEnv(now: DateTime(2026, 9, 14, 12), lastPeriod: DateTime(2026, 9, 10));
    env.repo.periodLogs = [
      {'id': 'day-12', 'log_date': '2026-09-12', 'flow_intensity': 'medium'},
    ];
  });
  tearDown(() => env.dispose());

  Future<void> pumpCalendar(WidgetTester tester, {bool trackingOnly = false, String? fromDate}) async {
    phoneSurface(tester, height: 1100);
    await tester.pumpWidget(env.wrap(FlowPeriodCalendar(trackingOnly: trackingOnly, fromDate: fromDate)));
    await settle(tester);
  }

  testWidgets('opens an existing day for editing instead of deleting it on tap', (tester) async {
    await pumpCalendar(tester);
    await tester.tap(day('2026-09-12'));
    await settle(tester);
    expect(env.repo.rpcCalls, isEmpty);
    await tester.tap(find.bySemanticsLabel(RegExp('Güclü')));
    await settle(tester);
    expect(env.repo.rpcCalls.first['p_flow'], 'heavy');
    expect(env.repo.rpcCalls.first['p_dates'], ['2026-09-12']);
  });

  testWidgets('records today as had flow without inventing an amount or more days', (tester) async {
    await pumpCalendar(tester);
    await tester.tap(find.text('Bu gün axın oldu'));
    await settle(tester);
    expect(env.repo.rpcCalls.first['p_flow'], 'unspecified');
    expect(env.repo.rpcCalls.first['p_dates'], ['2026-09-14']);
  });

  testWidgets('lets the user explicitly replace no-flow or clear a saved date', (tester) async {
    env.repo.periodLogs.add({'id': 'day-14', 'log_date': '2026-09-14', 'flow_intensity': 'none'});
    await pumpCalendar(tester);
    await tester.tap(find.text('Bu gün axın oldu'));
    await settle(tester);
    expect(env.repo.rpcCalls[0]['p_preserve_existing'], isNot(true));
    await tester.tap(day('2026-09-12'));
    await settle(tester);
    await tester.tap(find.text('Bu günün qeydini sil'));
    await settle(tester);
    expect(env.repo.rpcCalls[1]['p_flow'], 'clear');
  });

  testWidgets('disables future observations and distinguishes no-flow from recorded period days', (tester) async {
    env.repo.periodLogs.add({'id': 'none', 'log_date': '2026-09-13', 'flow_intensity': 'none'});
    await pumpCalendar(tester);
    expect(tester.getSemantics(day('2026-09-15')), containsSemantics(hasEnabledState: true, isEnabled: false));
    expect(tester.getSemantics(day('2026-09-12')), containsSemantics(hasToggledState: true, isToggled: true));
    expect(tester.getSemantics(day('2026-09-13')), containsSemantics(hasToggledState: true, isToggled: false));
  });

  testWidgets('offers Mommy observation-only tracking without fertile/predicted days or a module change', (tester) async {
    await pumpCalendar(tester, trackingOnly: true, fromDate: '2026-09-11');
    expect(find.text('Məhsuldar'), findsNothing);
    expect(find.text('Proqnoz'), findsNothing);
    expect(tester.getSemantics(day('2026-09-10')), containsSemantics(hasEnabledState: true, isEnabled: false));
    await tester.tap(day('2026-09-12'));
    await settle(tester);
    await tester.tap(find.bySemanticsLabel(RegExp('Yüngül')));
    await settle(tester);
    expect(env.repo.rpcCalls.first['p_flow'], 'light');
    expect(env.repo.rpcCalls.first.containsKey('life_stage'), isFalse);
  });

  group('day states', () {
    Color? bgOf(WidgetTester tester, String key) {
      final containers = tester.widgetList<Container>(find.descendant(of: day(key), matching: find.byType(Container)));
      for (final c in containers) {
        final d = c.decoration;
        if (d is BoxDecoration && d.color != null && d.borderRadius == BorderRadius.circular(12)) return d.color;
      }
      return null;
    }

    testWidgets('period, predicted, fertile, ovulation and today', (tester) async {
      // lastPeriod 2026-09-10, cycle 28, period 5: predicted 10..14, fertile 19..25, ovulation 24..25.
      env.repo.periodLogs = [
        {'id': 'a', 'log_date': '2026-09-10', 'flow_intensity': 'heavy'},
        {'id': 'b', 'log_date': '2026-09-11', 'flow_intensity': 'light'},
      ];
      await pumpCalendar(tester);
      expect(bgOf(tester, '2026-09-10'), TwColors.red500.withValues(alpha: 0.9)); // logged heavy
      expect(bgOf(tester, '2026-09-11'), TwColors.red200); // logged light
      expect(bgOf(tester, '2026-09-12'), TwColors.red100.withValues(alpha: 0.6)); // predicted
      expect(bgOf(tester, '2026-09-20'), TwColors.pink100); // fertile
      expect(bgOf(tester, '2026-09-24'), TwColors.pink200); // ovulation
      expect(find.descendant(of: day('2026-09-24'), matching: find.text('🌸')), findsOneWidget);
      expect(bgOf(tester, '2026-09-16'), isNull); // plain day
      // today (14th, predicted) carries the 2px primary ring
      final ring = tester.widgetList<Container>(find.descendant(of: day('2026-09-14'), matching: find.byType(Container))).where((c) {
        final d = c.decoration;
        return d is BoxDecoration && d.border != null;
      });
      expect(ring, isNotEmpty);
    });
  });
}
