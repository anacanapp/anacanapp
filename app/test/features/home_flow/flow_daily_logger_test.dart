// Ported from: (no React suite) — widget cases for src/components/flow/FlowDailyLogger.tsx save / edit / clear through
// useSaveFlowDailyLog (record_period_days RPC). The React logger has no optimistic cache write and no offline queue
// (the RPC is called directly); the cases assert that, and the refetch that replaces it.
import 'dart:async';

import 'package:anacan/features/home_flow/flow_daily_logger.dart';
import 'package:flutter_test/flutter_test.dart';

import 'flow_test_support.dart';

void main() {
  flowSetUpAll();
  late FlowTestEnv env;
  setUp(() {
    env = FlowTestEnv(now: DateTime(2026, 9, 14, 12));
    env.repo.symptoms = [
      {'id': 's1', 'symptom_key': 'cramps', 'label': 'Cramps', 'label_az': 'Sancı', 'emoji': '⚡', 'category': 'physical', 'sort_order': 1},
    ];
  });
  tearDown(() => env.dispose());

  Future<void> pump(WidgetTester tester) async {
    phoneSurface(tester, height: 2200);
    await tester.pumpWidget(env.wrap(const FlowDailyLogger()));
    await settle(tester);
  }

  testWidgets('save: new log sends the daily fields through record_period_days without a flow', (tester) async {
    await pump(tester);
    expect(find.text('Saxla'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Yaxşı').first);
    await tester.tap(find.bySemanticsLabel('⚡ Sancı'));
    await tester.pump();
    await tester.tap(find.text('Saxla'));
    await settle(tester);
    final call = env.repo.rpcCalls.single;
    expect(call['p_dates'], ['2026-09-14']);
    expect(call['p_flow'], isNull); // flow not edited → untouched
    final daily = call['p_daily_log']! as Map;
    expect(daily['mood'], 4);
    expect(daily['symptoms'], ['cramps']);
    expect(daily.containsKey('flow_intensity'), isFalse);
    // invalidated + refetched: the header now shows the filled tag and the button reads "Yenilə"
    expect(find.text('Doldurulub'), findsOneWidget);
    expect(find.text('Yenilə'), findsOneWidget);
  });

  testWidgets('edit: an existing log fills the form; changing the flow sends it explicitly', (tester) async {
    env.repo.dailyLogs = [
      {'id': 'd1', 'log_date': '2026-09-14', 'mood': 2, 'symptoms': <String>[], 'water_glasses': 0, 'cervical_mucus': 'eggwhite'},
    ];
    await pump(tester);
    expect(find.text('Doldurulub'), findsOneWidget);
    expect(tester.getSemantics(find.bySemanticsLabel('Pis').first), isSemantics(isToggled: true));
    await tester.tap(find.bySemanticsLabel('🩸🩸🩸 Güclü'));
    await tester.pump();
    await tester.tap(find.text('Yenilə'));
    await settle(tester);
    expect(env.repo.rpcCalls.single['p_flow'], 'heavy');
    expect((env.repo.rpcCalls.single['p_daily_log']! as Map)['mood'], 2);
  });

  testWidgets('delete: deselecting a saved value clears it (null) on save', (tester) async {
    env.repo.dailyLogs = [
      {'id': 'd1', 'log_date': '2026-09-14', 'symptoms': <String>[], 'water_glasses': 0, 'cervical_mucus': 'eggwhite'},
    ];
    await pump(tester);
    await tester.tap(find.bySemanticsLabel('🥚 Yumurta ağı'));
    await tester.pump();
    await tester.tap(find.text('Yenilə'));
    await settle(tester);
    final daily = env.repo.rpcCalls.single['p_daily_log']! as Map;
    expect(daily.containsKey('cervical_mucus'), isTrue);
    expect(daily['cervical_mucus'], isNull);
  });

  testWidgets('no changes → save disabled; pending shows Saxlanılır...; failure keeps the form (no optimistic write)', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Saxla'));
    await tester.pump();
    expect(env.repo.rpcCalls, isEmpty);

    env.repo.rpcGate = Completer<void>();
    env.repo.rpcError = Exception('offline');
    await tester.tap(find.bySemanticsLabel('Əla').first);
    await tester.pump();
    await tester.tap(find.text('Saxla'));
    await tester.pump(const Duration(milliseconds: 10));
    expect(find.text('Saxlanılır...'), findsOneWidget);
    env.repo.rpcGate!.complete();
    await settle(tester);
    expect(find.text('Saxla'), findsOneWidget); // nothing cached as saved
    expect(find.text('Doldurulub'), findsNothing);
    expect(tester.getSemantics(find.bySemanticsLabel('Əla').first), isSemantics(isToggled: true));
  });
}
