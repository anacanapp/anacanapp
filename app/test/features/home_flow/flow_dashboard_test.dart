// Ported from: src/components/flow/FlowDashboard.test.tsx
import 'package:anacan/features/home_flow/widgets/flow_common.dart' show flowFormat;
import 'package:anacan/features/home_flow/flow_dashboard.dart';
import 'package:anacan/features/home_flow/flow_period_calendar.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/features/home_flow/widgets/flow_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'flow_test_support.dart';

void main() {
  flowSetUpAll();
  late FlowTestEnv env;
  setUp(() {
    env = FlowTestEnv(now: DateTime(2026, 9, 14, 12), lastPeriod: DateTime(2026, 9, 10), extra: [
      flowHomeSlotsProvider.overrideWithValue(FlowHomeSlots(
        waterWidget: (_) => const SizedBox(key: ValueKey('water'), height: 40, child: Text('Water')),
      )),
    ]);
  });
  tearDown(() => env.dispose());

  Future<void> pump(WidgetTester tester) async {
    phoneSurface(tester, height: 7000);
    await tester.pumpWidget(env.wrap(const FlowDashboard()));
    await settle(tester);
  }

  Finder pickerDay(int d) => find.descendant(
        of: find.byType(ShadDayPicker),
        matching: find.bySemanticsLabel(flowFormat(DateTime(2026, 9, d), 'd MMMM yyyy')),
      );

  testWidgets('places the period calendar immediately before water tracking', (tester) async {
    await pump(tester);
    final calendar = tester.getRect(find.byType(FlowPeriodCalendar));
    final water = tester.getRect(find.byKey(const ValueKey('water')));
    // Next sibling: only the 22 px `.a-section` margin lies between them.
    expect(water.top - calendar.bottom, moreOrLessEquals(22, epsilon: 0.5));
  });

  testWidgets('submits all five chosen days as observations rather than a single start date', (tester) async {
    await pump(tester);
    await tester.tap(find.bySemanticsLabel('Period günlərini qeyd et'));
    await settle(tester);
    for (final d in [10, 11, 12, 13]) {
      await tester.tap(pickerDay(d)); // the 14th (today) is preselected
      await tester.pump();
    }
    await tester.tap(find.text('Qeyd et'));
    await settle(tester);
    expect(env.repo.rpcCalls, hasLength(1));
    expect(env.repo.rpcCalls[0]['p_flow'], 'unspecified');
    expect(env.repo.rpcCalls[0]['p_preserve_existing'], true);
    expect(env.repo.rpcCalls[0]['p_dates'], ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
  });

  testWidgets('keeps already recorded days selected and clears the ones the user unselects', (tester) async {
    env.repo.periodLogs = [
      {'id': 'a', 'log_date': '2026-09-08', 'flow_intensity': 'medium'},
      {'id': 'b', 'log_date': '2026-09-10', 'flow_intensity': 'unspecified'},
    ];
    await pump(tester);
    await tester.tap(find.bySemanticsLabel('Period günlərini qeyd et'));
    await settle(tester);
    for (final d in [8, 11, 12, 13, 14]) {
      await tester.tap(pickerDay(d));
      await tester.pump();
    }
    await tester.tap(find.text('Qeyd et'));
    await settle(tester);
    expect(env.repo.rpcCalls, hasLength(2));
    expect(env.repo.rpcCalls[0]['p_dates'], ['2026-09-08']);
    expect(env.repo.rpcCalls[0]['p_flow'], 'clear');
    expect(env.repo.rpcCalls[0]['p_preserve_existing'], false);
    expect(env.repo.rpcCalls[1]['p_dates'], ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
  });
}
