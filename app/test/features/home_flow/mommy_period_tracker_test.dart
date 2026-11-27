// Ported from: src/components/mommy/MommyPeriodTracker.test.tsx
import 'package:anacan/features/home_flow/data/flow_hooks.dart' show ymd;
import 'package:anacan/features/home_flow/mommy_period_tracker.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'flow_test_support.dart';

void main() {
  flowSetUpAll();
  late FlowTestEnv env;
  final now = DateTime(2026, 9, 14, 12);
  String day(int ago) => ymd(DateTime(now.year, now.month, now.day - ago));
  List<Map<String, dynamic>> flow(List<int> agos) => [for (final a in agos) {'id': 'x$a', 'log_date': day(a), 'flow_intensity': 'unspecified'}];

  setUp(() {
    env = FlowTestEnv(now: now, profile: {'baby_birth_date': '2026-01-01'});
    env.container.read(userStoreProvider.notifier).setLifeStage('mommy');
  });
  tearDown(() => env.dispose());

  Future<void> pump(WidgetTester tester, {VoidCallback? onOpen}) async {
    phoneSurface(tester);
    await tester.pumpWidget(env.wrap(MommyPeriodBanner(onOpen: onOpen ?? () {})));
    await settle(tester);
  }

  group('MommyPeriodBanner', () {
    testWidgets('invites to track with the Menstruasiya wording and records today on Başladı', (tester) async {
      var opened = 0;
      await pump(tester, onOpen: () => opened++);
      expect(find.text('Menstruasiyanız bərpa olunub?'), findsOneWidget);
      await tester.tap(find.text('Menstruasiya izləyicinizi və təqviminizi açın'));
      expect(opened, 1);
      await tester.tap(find.text('Başladı'));
      await settle(tester);
      final call = env.repo.rpcCalls.single;
      expect(call['p_dates'], [day(0)]);
      expect(call['p_flow'], 'unspecified');
      expect(call['p_preserve_existing'], true);
    });

    testWidgets('shows the day count and ends the period over its whole range', (tester) async {
      env.repo.periodLogs = flow([2, 1, 0]);
      await pump(tester);
      expect(find.text('Gün 3'), findsOneWidget);
      final pressed = find.byWidgetPredicate((w) => w is Semantics && w.properties.toggled == true);
      expect(pressed, findsNWidgets(3));
      await tester.tap(find.text('Bitdi'));
      await settle(tester);
      final call = env.repo.rpcCalls.single;
      expect(call['p_complete'], true);
      expect(call['p_dates'], [day(2), day(1), day(0)]);
      // Ended today: the card now offers a new start.
      expect(find.text('Başladı'), findsOneWidget);
    });

    testWidgets('asks about today when recorded until yesterday and logs it on Davam edir', (tester) async {
      env.repo.periodLogs = flow([2, 1]);
      await pump(tester);
      expect(find.text('Bu gün də davam edir?'), findsOneWidget);
      await tester.tap(find.text('Davam edir'));
      await settle(tester);
      final call = env.repo.rpcCalls.single;
      expect(call['p_dates'], [day(0)]);
      expect(call['p_flow'], 'unspecified');
      expect(call['p_preserve_existing'], true);
    });

    testWidgets('toggles a day in the 14-day strip', (tester) async {
      env.repo.periodLogs = flow([20]);
      await pump(tester);
      final days = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('strip-'));
      expect(days, findsNWidgets(14));
      await tester.tap(days.at(12));
      await settle(tester);
      final call = env.repo.rpcCalls.single;
      expect(call['p_dates'], [day(1)]);
      expect(call['p_flow'], 'unspecified');
      expect(call['p_preserve_existing'], false);
    });
  });

  testWidgets('PeriodTrackerView renders the observation-only calendar and the empty overview', (tester) async {
    phoneSurface(tester, height: 2400);
    var back = 0;
    await tester.pumpWidget(env.wrap(PeriodTrackerView(onBack: () => back++), scroll: false));
    await settle(tester);
    expect(find.text('Menstruasiya izləyicim'), findsOneWidget);
    expect(find.text('Proqnoz'), findsNothing);
    expect(find.text('Qeydə alınmış günlər: 0'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Analıq bölməsinə qayıt'));
    expect(back, 1);
  });
}
