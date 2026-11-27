// Ported from: (no React suite) — src/components/ttc/TtcSection.tsx goal switch, checklist and log sheet writes.
import 'package:anacan/features/ttc/ttc_section.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../home_flow/flow_test_support.dart';

void main() {
  flowSetUpAll();

  Widget section() => FlowGoalSection(
        lastPeriodDate: DateTime(2026, 9, 10),
        cycleLength: 28,
        periodLength: 5,
        ovulation: DateTime(2026, 9, 24),
        ovulationConfirmed: false,
      );

  testWidgets('switching to "get pregnant" saves the goal with a start date and shows the fertility home', (tester) async {
    final env = FlowTestEnv();
    addTearDown(env.dispose);
    phoneSurface(tester, height: 2600);
    await tester.pumpWidget(env.wrap(section()));
    await settle(tester);
    expect(find.byType(FertilityRing), findsNothing);
    await tester.tap(find.bySemanticsLabel('🌱 Hamilə qalmaq'));
    await settle(tester);
    final patch = env.repo.calls.firstWhere((c) => c.$1 == 'updateProfile').$2! as Map;
    expect(patch['flow_goal'], 'conceive');
    expect((patch['ttc_state'] as Map)['started_on'], '2026-09-14');
    expect(find.byType(FertilityRing), findsOneWidget);
    expect(find.text('Dövrün 5. günü'), findsOneWidget);
  });

  testWidgets('conceive profile: checklist toggles save the bounded ttc_state', (tester) async {
    final env = FlowTestEnv(profile: {
      'flow_goal': 'conceive',
      'ttc_state': {'started_on': '2026-09-01'},
    });
    addTearDown(env.dispose);
    phoneSurface(tester, height: 2600);
    await tester.pumpWidget(env.wrap(section()));
    await settle(tester);
    await tester.tap(find.text('Fol turşusu hər gün'));
    await settle(tester);
    final patch = env.repo.calls.lastWhere((c) => c.$1 == 'updateProfile').$2! as Map;
    final state = patch['ttc_state'] as Map;
    expect((state['checklist'] as Map)['folic'], true);
    expect(state['tests'], isEmpty);
    expect(find.text('1 / 8'), findsOneWidget);
  });
}
