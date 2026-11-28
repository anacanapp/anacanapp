// Ported from: src/lib/sleep-training-sync.test.ts
// (src/lib/sleepTrainingPlansSql.test.ts checks the SQL migration file, not app code: not ported.)
import 'dart:convert';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/sleep/sleep_training.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training_sync.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../parenting/support/programme_harness.dart' show FakeSleepPlanRemote;

const String today = '2026-11-08';
LocalStore memory([Map<String, String> init = const {}]) => LocalStore.memory(init);
PlanState plan(String wake, [String? method]) {
  final p = setWake(defaultPlanState, wake);
  return method != null ? pickMethod(p, method, today) : p;
}

StoredPlan stored(PlanState p, String? updatedAt, bool dirty) => StoredPlan(plan: p, updatedAt: updatedAt, dirty: dirty);
bool sameAsDefault(PlanState p) => samePlan(p, defaultPlanState);

void main() {
  group('device copy per child', () {
    test('adopts the older per-account plan once, for the first child, and marks it for upload', () {
      final s = memory({planStorageKey('u1'): jsonEncode(plan('06:30', 'chair').toJson())});
      final a = readLocalPlan(s, 'u1', 'child-a', today);
      expect(a.plan.wakeTime, '06:30');
      expect(a.plan.method, 'chair');
      expect(a.dirty, true);
      expect(a.updatedAt, isNull);
      expect(s.getItem(legacyClaimKey('u1')), 'child-a');
      expect((jsonDecode(s.getItem(planStorageKeyV2('u1', 'child-a'))!) as Map)['plan']['wakeTime'], '06:30');
      // A second child starts empty; the first keeps its own copy.
      expect(sameAsDefault(readLocalPlan(s, 'u1', 'child-b', today).plan), true);
      expect(readLocalPlan(s, 'u1', 'child-a', today).plan.method, 'chair');
    });

    test('starts empty without a child, without storage or with garbage', () {
      final s = memory({planStorageKey('u1'): jsonEncode(plan('06:30').toJson())});
      expect(sameAsDefault(readLocalPlan(s, 'u1', null, today).plan), true);
      expect(s.getItem(legacyClaimKey('u1')), isNull);
      expect(sameAsDefault(readLocalPlan(null, 'u1', 'c', today).plan), true);
      expect(readLocalPlan(memory({planStorageKeyV2('u1', 'c'): '{oops'}), 'u1', 'c', today).dirty, false);
    });

    test('stamps real changes only', () {
      final base = stored(plan('07:00'), '2026-11-01T10:00:00.000Z', false);
      expect(identical(applyLocalChange(base, plan('07:00')), base), true);
      final next = applyLocalChange(base, plan('07:30'), DateTime.parse('2026-11-08T08:00:00.000Z'));
      expect(next.dirty, true);
      expect(next.updatedAt, '2026-11-08T08:00:00.000Z');
    });
  });

  group('mergePlan (newest wins)', () {
    final now = DateTime.parse('2026-11-08T09:00:00.000Z');
    test('uploads a newer local change and takes a newer server copy', () {
      final local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
      final a = mergePlan(local, RemotePlan(plan: plan('08:00').toJson(), updatedAt: '2026-11-07T08:00:00.000Z'), today);
      expect(identical(a.next, local), true);
      expect(a.push, true);
      final r = mergePlan(local, RemotePlan(plan: plan('08:00').toJson(), updatedAt: '2026-11-08T08:30:00.000Z'), today);
      expect(r.push, false);
      expect(r.next.dirty, false);
      expect(r.next.updatedAt, '2026-11-08T08:30:00.000Z');
      expect(r.next.plan.wakeTime, '08:00');
    });

    test('keeps an in-sync copy, uploads a first plan and lets a legacy copy lose to any server row', () {
      final synced = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', false);
      final a = mergePlan(synced, RemotePlan(plan: plan('06:30').toJson(), updatedAt: '2026-11-08T08:00:00.000Z'), today);
      expect(identical(a.next, synced), true);
      expect(a.push, false);
      expect(mergePlan(stored(defaultPlanState, null, false), null, today).push, false);
      final legacy = stored(plan('06:00'), null, true);
      final b = mergePlan(legacy, null, today, now);
      expect(b.next, legacy.copyWith(updatedAt: jsToIsoString(now)));
      expect(b.push, true);
      expect(mergePlan(legacy, RemotePlan(plan: plan('08:00').toJson(), updatedAt: '2026-01-01T00:00:00.000Z'), today).next.plan.wakeTime, '08:00');
    });

    test('sanitises the server copy', () {
      final r = mergePlan(stored(defaultPlanState, null, false),
          const RemotePlan(plan: {'wakeTime': '99:99', 'method': 'nope', 'stepsDone': ['x']}, updatedAt: '2026-11-08T08:00:00.000Z'), today);
      expect(sameAsDefault(r.next.plan), true);
    });
  });

  group('syncPlan', () {
    setUp(resetPlanTableState);

    test('inserts a first plan, then updates only an older row', () async {
      final db = FakeSleepPlanRemote();
      final local = stored(plan('06:30', 'fading'), '2026-11-08T08:00:00.000Z', true);
      final a = await syncPlan(db: db, userId: 'u', childId: 'c', local: local, todayKey: today);
      expect(a.ok, true);
      expect(a.state.dirty, false);
      expect(db.rows, hasLength(1));
      expect(db.rows[0], containsPair('user_id', 'u'));
      expect(db.rows[0], containsPair('child_id', 'c'));
      expect(db.rows[0], containsPair('updated_at', '2026-11-08T08:00:00.000Z'));

      final newer = stored(plan('07:30', 'fading'), '2026-11-08T09:00:00.000Z', true);
      await syncPlan(db: db, userId: 'u', childId: 'c', local: newer, todayKey: today);
      expect((db.rows[0]['plan'] as Map)['wakeTime'], '07:30');
      expect(db.calls, contains('update'));
    });

    test('adopts a newer server copy instead of uploading an older local change', () async {
      final db = FakeSleepPlanRemote(rows: [
        {'id': 'r', 'user_id': 'u', 'child_id': 'c', 'plan': plan('08:00').toJson(), 'updated_at': '2026-11-08T10:00:00.000Z'},
      ]);
      final res = await syncPlan(db: db, userId: 'u', childId: 'c', local: stored(plan('06:00'), '2026-11-08T09:00:00.000Z', true), todayKey: today);
      expect(res.ok, true);
      expect(res.state.plan.wakeTime, '08:00');
      expect(db.calls, isNot(contains('update')));
    });

    test('stays quietly local-only while the table is absent', () async {
      final db = FakeSleepPlanRemote(error: const PlanDbError(code: 'PGRST205', message: "Could not find the table 'public.sleep_training_plans' in the schema cache"));
      final local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
      final a = await syncPlan(db: db, userId: 'u', childId: 'c', local: local, todayKey: today);
      expect(identical(a.state, local), true);
      expect(a.ok, false);
      final calls = db.calls.length;
      final b = await syncPlan(db: db, userId: 'u', childId: 'c', local: local, todayKey: today);
      expect(identical(b.state, local), true);
      expect(b.ok, false);
      expect(db.calls.length, calls);
      expect(isMissingTable(const PlanDbError(code: '42P01')), true);
      expect(isMissingTable(const PlanDbError(code: '08006', message: 'network')), false);
    });

    test('keeps the local copy (still dirty) on a network failure', () async {
      final db = FakeSleepPlanRemote(error: const PlanDbError(code: '08006', message: 'Failed to fetch'));
      final local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
      final res = await syncPlan(db: db, userId: 'u', childId: 'c', local: local, todayKey: today);
      expect(identical(res.state, local), true);
      expect(res.ok, false);
    });

    test('lets the partner read the shared plan', () async {
      final db = FakeSleepPlanRemote(rows: [
        {'id': 'r', 'user_id': 'mom', 'child_id': 'c', 'plan': plan('06:45', 'chair').toJson(), 'updated_at': '2026-11-08T10:00:00.000Z'},
      ]);
      final shared = await fetchSharedSleepPlan(db, 'mom', 'c', today);
      expect(shared?.plan.method, 'chair');
      expect(await fetchSharedSleepPlan(db, 'mom', 'other', today), isNull);
    });
  });
}
