// Ported from: (no React suites for these hooks) — behaviour of src/hooks/{useCycleHistory,usePeriodDayLogs,
// useFlowDailyLogs,useFlowReminders}.ts: query keys, stats, completePeriodWrite, the period-recording scope, and the
// offline-outbox path of useAddCycle (optimistic insert of a queued entry, flush → refetch).
import 'dart:async';

import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/domain/cycle/health_cycle.dart' show PeriodDay;
import 'package:anacan/features/home_flow/data/flow_hooks.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';

import '../flow_test_support.dart';

class _RecordingHealth implements CycleHealthWriter {
  final List<List<PeriodDay>> calls = [];
  @override
  Future<bool> syncPeriodDays(List<PeriodDay> days) async {
    calls.add(days);
    return true;
  }
}

Future<void> flush() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  group('cycleStatsOf (useCycleStats)', () {
    test('defaults without history', () {
      final s = cycleStatsOf([], 30);
      expect((s.averageCycleLength, s.averagePeriodLength, s.shortestCycle, s.longestCycle, s.totalCycles), (30, 5, 28, 28, 0));
    });

    test('averages normal cycles only, counts anomalies, sanity-filters 15–60 and periods 1–15 with an end date', () {
      final s = cycleStatsOf([
        {'cycle_length': 28, 'period_length': 5, 'end_date': '2026-01-05'},
        {'cycle_length': 30, 'period_length': 4, 'end_date': '2026-02-04'},
        {'cycle_length': 53, 'period_length': 6, 'end_date': null},
        {'cycle_length': 2, 'period_length': 30, 'end_date': '2026-04-01'},
      ], 28);
      expect(s.averageCycleLength, 29);
      expect(s.anomalousCycles, 1);
      expect(s.shortestCycle, 28);
      expect(s.longestCycle, 53);
      expect(s.cycleVariation, 25);
      expect(s.averagePeriodLength, 5); // (5 + 4) / 2 = 4.5 → Math.round 5
      expect(s.totalCycles, 4);
    });
  });

  group('recordPeriodDays / completePeriodWrite', () {
    late FlowTestEnv env;
    late _RecordingHealth health;
    setUp(() {
      health = _RecordingHealth();
      env = FlowTestEnv(now: DateTime(2026, 9, 14, 12), extra: [cycleHealthWriterProvider.overrideWithValue(health)]);
    });
    tearDown(() => env.dispose());

    test('sends the RPC payload, updates the flow profile, invalidates the user keys and syncs Health', () async {
      final c = env.container;
      final sub = c.listen(periodDayLogsQuery(null), (_, _) {});
      final mut = c.listen(recordPeriodDaysMutation, (_, _) {});
      await flush();
      expect(sub.read().data, isEmpty);
      env.repo.profile = {'last_period_date': '2026-09-12', 'period_length': 4, 'cycle_length': 30};
      await c.read(recordPeriodDaysMutation.notifier).mutateAsync(PeriodWrite(dates: [DateTime(2026, 9, 13), '2026-09-12'], flow: 'light'));
      final p = env.repo.rpcCalls.single;
      expect(p['p_expected_user_id'], 'u1');
      expect(p['p_dates'], ['2026-09-12', '2026-09-13']);
      expect((p['p_complete'], p['p_preserve_existing'], p['p_daily_log'], p['p_timezone']), (false, false, null, 'UTC'));
      final u = c.read(userStoreProvider);
      expect((u.lastPeriodDate, u.periodLength, u.cycleLength), (DateTime(2026, 9, 12), 4, 30));
      await flush();
      expect(sub.read().data!.map((r) => r['log_date']), ['2026-09-12', '2026-09-13']); // refetched
      expect(health.calls.single.map((d) => d.date), ['2026-09-12', '2026-09-13']);
      sub.close();
      mut.close();
    });

    test('rejects future or empty dates before calling the server', () async {
      final mut = env.container.listen(recordPeriodDaysMutation, (_, _) {});
      await expectLater(
          env.container.read(recordPeriodDaysMutation.notifier).mutateAsync(const PeriodWrite(dates: ['2026-09-15'], flow: 'unspecified')),
          throwsA(anything));
      await expectLater(env.container.read(recordPeriodDaysMutation.notifier).mutateAsync(const PeriodWrite(dates: [], flow: 'clear')), throwsA(anything));
      expect(env.repo.rpcCalls, isEmpty);
      mut.close();
    });

    test('a non-ok or foreign answer is PERIOD_WRITE_FAILED and nothing is invalidated', () async {
      env.repo.rpcError = StateError('boom');
      final mut = env.container.listen(recordPeriodDaysMutation, (_, _) {});
      await expectLater(
          env.container.read(recordPeriodDaysMutation.notifier).mutateAsync(const PeriodWrite(dates: ['2026-09-14'], flow: 'unspecified')),
          throwsA(isA<StateError>()));
      expect(health.calls, isEmpty);
      mut.close();
    });

    test('writes of one user run one after another (period-recording scope)', () async {
      final mut = env.container.listen(saveFlowDailyLogMutation, (_, _) {});
      final mut2 = env.container.listen(recordPeriodDaysMutation, (_, _) {});
      env.repo.rpcGate = Completer<void>();
      final first = env.container.read(saveFlowDailyLogMutation.notifier).mutateAsync({'log_date': '2026-09-14', 'mood': 3});
      final second = env.container.read(recordPeriodDaysMutation.notifier).mutateAsync(const PeriodWrite(dates: ['2026-09-13'], flow: 'heavy'));
      await flush();
      expect(env.repo.rpcCalls, hasLength(1)); // the second waits for the first
      final gate = env.repo.rpcGate!;
      env.repo.rpcGate = null;
      gate.complete();
      await Future.wait([first, second]);
      expect(env.repo.rpcCalls.map((c) => c['p_flow']), [null, 'heavy']);
      mut.close();
      mut2.close();
    });
  });

  group('useAddCycle offline outbox', () {
    test('a queued entry is inserted optimistically and the cache refreshes after the flush delivered it', () async {
      final connectivity = ManualConnectivitySource();
      final sent = <Map<String, Object?>>[];
      var online = false;
      final outbox = OfflineOutbox(
        store: LocalStore.memory(),
        connectivity: connectivity,
        log: (_) {},
        sender: (table, row) async {
          if (!online) return const SendResult(error: 'Failed to fetch', status: 0);
          sent.add(row);
          return SendResult(data: row, status: 201);
        },
      );
      final env = FlowTestEnv(now: DateTime(2026, 9, 14, 12), outbox: outbox);
      addTearDown(env.dispose);
      final c = env.container;
      final seen = <List<Object?>>[];
      final q = c.listen(cycleHistoryQuery, (_, next) => seen.add([for (final r in next.data ?? const []) r['id']]));
      final m = c.listen(addCycleMutation, (_, _) {});
      await flush();
      expect(q.read().data, isEmpty);

      final row = await c.read(addCycleMutation.notifier).mutateAsync({'cycle_number': 4, 'start_date': '2026-09-10', 'cycle_length': null});
      await flush();
      // shown at once (optimistic), then replaced by the refetch that does not know the queued row yet
      expect(seen.any((ids) => ids.contains(row['id'])), isTrue);
      expect(q.read().data, isEmpty);
      expect(outbox.readOutbox('u1').single.table, 'cycle_history');
      expect(sent, isEmpty);

      online = true;
      env.repo.cycles = [{...row}];
      await outbox.flush('u1');
      await flush();
      expect(sent.single['cycle_number'], 4);
      expect(outbox.readOutbox('u1'), isEmpty);
      expect(q.read().data!.single['id'], row['id']); // refetched after the 'cycle_history' flush event
      q.close();
      m.close();
    });
  });

  group('reminders', () {
    late FlowTestEnv env;
    setUp(() => env = FlowTestEnv());
    tearDown(() => env.dispose());

    test('initialize upserts the four defaults; toggle patches is_enabled', () async {
      final c = env.container;
      final q = c.listen(flowRemindersQuery, (_, _) {});
      final i = c.listen(initializeFlowRemindersMutation, (_, _) {});
      final t = c.listen(toggleReminderMutation, (_, _) {});
      await c.read(initializeFlowRemindersMutation.notifier).mutateAsync(null);
      final rows = env.repo.calls.firstWhere((x) => x.$1 == 'upsertReminders').$2! as List;
      expect(rows.map((r) => (r as Map)['reminder_type']), ['period_start', 'ovulation', 'fertile_start', 'pms']);
      expect(rows.map((r) => (r as Map)['days_before']), [2, 1, 1, 0]);
      await flush();
      expect(q.read().data, hasLength(4));
      await c.read(toggleReminderMutation.notifier).mutateAsync((id: 'r-pms', isEnabled: false));
      final patch = env.repo.calls.lastWhere((x) => x.$1 == 'updateReminder').$2! as Map;
      expect((patch['id'], patch['is_enabled']), ('r-pms', false));
      q.close();
      i.close();
      t.close();
    });
  });
}
