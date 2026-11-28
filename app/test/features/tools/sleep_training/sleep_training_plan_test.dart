// Ported from: src/hooks/useSleepTrainingPlan.test.ts
import 'dart:convert';

import 'package:anacan/domain/sleep/sleep_training.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training_plan.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training_sync.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../parenting/support/programme_harness.dart' show FakeSleepPlanRemote;

void main() {
  setUp(resetPlanTableState);

  test('keeps a plan per child on the phone and stays local-only while the table is absent', () async {
    final store = LocalStore.memory({planStorageKey('u1'): jsonEncode({'wakeTime': '06:30'})});
    final db = FakeSleepPlanRemote(error: const PlanDbError(code: 'PGRST205', message: "Could not find the table 'public.sleep_training_plans' in the schema cache"));
    var c = SleepTrainingPlanController(store: store, remote: db, userId: 'u1', childId: 'a', syncDelay: const Duration(milliseconds: 1));
    expect(c.loaded, true);
    expect(c.state.wakeTime, '06:30');
    await Future<void>.delayed(Duration.zero);
    expect(db.calls.length, 1);

    c.update((s) => setWake(s, '07:30'));
    expect(c.state.wakeTime, '07:30');
    expect(c.pending, true);
    expect((jsonDecode(store.getItem(planStorageKeyV2('u1', 'a'))!) as Map)['plan']['wakeTime'], '07:30');

    // Another child: a new controller (the screen re-creates it per child).
    c.dispose();
    c = SleepTrainingPlanController(store: store, remote: db, userId: 'u1', childId: 'b', syncDelay: const Duration(milliseconds: 1));
    expect(c.state.wakeTime, '07:00');
    await Future<void>.delayed(const Duration(milliseconds: 10));
    // After the table turned out to be missing, no further requests go out.
    expect(db.calls.length, 1);
    c.dispose();
  });

  test('does not sync for a guest', () async {
    final store = LocalStore.memory();
    final db = FakeSleepPlanRemote();
    final c = SleepTrainingPlanController(store: store, remote: db, userId: null, childId: 'a', syncDelay: const Duration(milliseconds: 1));
    c.update((s) => setWake(s, '08:00'));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(store.getItem(planStorageKeyV2('guest', 'a')), contains('08:00'));
    expect(db.calls, isEmpty);
    c.dispose();
  });
}
