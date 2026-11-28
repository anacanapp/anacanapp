// Ported from: src/components/tools/SleepTraining.tsx, src/components/sleep/NextNapSection.tsx (no React suite:
// widget checks of the port — the plan, live timer, widget action, tabs and the nap alerts).
import 'dart:convert';

import 'package:anacan/core/i18n/tr.dart' show I18nRuntime;
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/sleep/nap_alerts.dart';
import 'package:anacan/features/baby/hooks/use_baby_care_actions.dart' show bc;
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training_sync.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../home/home_test_support.dart' show installRealI18n;
import '../parenting/support/programme_harness.dart';

late I18nRuntime _i18n;

ProgrammeHarness _harness({String? birth = '2026-06-01'}) {
  final h = ProgrammeHarness();
  final child = ProgrammeChild(id: 'c1', name: 'Aysel', birthDate: birth);
  h.inputs = ProgrammeInputs(userId: 'u1', lifeStage: 'mommy', children: [child], selectedChild: child);
  return h;
}

Map<String, dynamic> _stored(ProgrammeHarness h) => (jsonDecode(h.store.getItem(planStorageKeyV2('u1', 'c1'))!) as Map)['plan'] as Map<String, dynamic>;

void main() {
  setUpAll(() async => _i18n = await installRealI18n());
  setUp(() {
    I18nRuntime.instance = _i18n;
    resetPlanTableState();
    DomainClock.setSystemTime(DateTime(2026, 11, 9, 10, 0));
  });
  tearDown(DomainClock.reset);

  testWidgets('shows the age band hero, the next-nap section and the tabs', (tester) async {
    final h = _harness();
    await h.pump(tester, SleepTraining(onBack: () {}));
    expect(find.byKey(const ValueKey('sleep-hero')), findsOneWidget);
    expect(find.text(bc5Months()), findsWidgets);
    expect(find.byKey(const ValueKey('sleep-live-button')), findsOneWidget);
    // Nap alerts were planned for the 'nap' namespace with their fixed ids.
    expect(h.notifications.calls.where((c) => c.namespace == 'nap'), isNotEmpty);
    expect(h.notifications.calls.first.cancelIds, NapAlertIds.all);
    await h.finish(tester);
  });

  testWidgets('starts the live timer and keeps it in the per-child plan', (tester) async {
    final h = _harness();
    await h.pump(tester, SleepTraining(onBack: () {}));
    await tapKey(tester, 'sleep-live-button');
    expect(_stored(h)['pendingSleepStart'], isNotNull);
    await tapKey(tester, 'sleep-discard');
    expect(_stored(h)['pendingSleepStart'], isNull);
    await h.finish(tester);
  });

  testWidgets('a "Sleep" tap on the home-screen widget starts the timer at once', (tester) async {
    final h = _harness();
    h.widgetActions.set('sleep');
    await h.pump(tester, SleepTraining(onBack: () {}));
    expect(_stored(h)['pendingSleepStart'], isNotNull);
    await h.finish(tester);
  });

  testWidgets('stopping saves the sleep as a baby log', (tester) async {
    final h = _harness();
    await h.pump(tester, SleepTraining(onBack: () {}));
    await tapKey(tester, 'sleep-live-button');
    DomainClock.setSystemTime(DateTime(2026, 11, 9, 11, 0));
    await tapKey(tester, 'sleep-live-button');
    await h.flush(tester);
    expect(h.addedSleeps, hasLength(1));
    expect(h.addedSleeps.first.$2.difference(h.addedSleeps.first.$1).inMinutes, 60);
    expect(_stored(h)['pendingSleepStart'], isNull);
    await h.finish(tester);
  });

  testWidgets('shows the empty state without a birth date and outside 1–12 months', (tester) async {
    final h = _harness(birth: null);
    await h.pump(tester, SleepTraining(onBack: () {}));
    expect(find.byKey(const ValueKey('sleep-hero')), findsNothing);
    await h.finish(tester);
    final old = _harness(birth: '2024-01-01');
    await old.pump(tester, SleepTraining(onBack: () {}));
    expect(find.byKey(const ValueKey('sleep-hero')), findsNothing);
    await old.finish(tester);
  });

  testWidgets('the plan tab picks a method and the safety tab calls the country number', (tester) async {
    final h = _harness();
    h.inputs = ProgrammeInputs(userId: 'u1', lifeStage: 'mommy', children: h.inputs.children, selectedChild: h.inputs.selectedChild, profileCountryCode: 'AZ');
    await h.pump(tester, SleepTraining(onBack: () {}));
    await tapText(tester, bcText('sleeptraining_tab_plan'));
    await tapKey(tester, 'method-chair');
    expect(_stored(h)['method'], 'chair');
    expect(_stored(h)['planStartDate'], '2026-11-09');
    await tapText(tester, bcText('sleeptraining_tab_safety'));
    await tapKey(tester, 'safety-back');
    expect(_stored(h)['safetyDone'], ['back']);
    await tapKey(tester, 'sleep-emergency-call');
    expect(h.calls.single.toString(), 'tel:103');
    await h.finish(tester);
  });

  testWidgets('the wake-up stepper moves the schedule by 15 minutes', (tester) async {
    final h = _harness();
    await h.pump(tester, SleepTraining(onBack: () {}));
    await tapKey(tester, 'wake-plus');
    expect(_stored(h)['wakeTime'], '07:15');
    await tapKey(tester, 'wake-preset-06:30');
    expect(_stored(h)['wakeTime'], '06:30');
    await h.finish(tester);
  });
}

String bcText(String key, [Map<String, Object?>? vars]) => bc(key, vars);
String bc5Months() => bc('sleeptraining_age_label', {'months': 5});
