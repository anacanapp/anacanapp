// Ported from: src/hooks/useBabyLogs.outbox.test.tsx (useBabyLogs cases), src/hooks/useBabyLogs.ts (pure helpers)
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/hooks/use_baby_logs.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../home_mommy/support/mommy_harness.dart';

Future<void> settle([int ms = 0]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  late MommyHarness h;
  late ProviderContainer c;

  setUp(() {
    resetChildrenSeedGuard();
    h = MommyHarness();
    h.repo.children = [childRow('c1')];
    c = h.container();
    c.listen(babyLogsProvider, (_, _) {});
  });
  tearDown(() {
    c.dispose();
    h.dispose();
  });

  group('useBabyLogs with the offline outbox', () {
    test('writes with a client uuid and reports a confirmed save', () async {
      await settle(10);
      expect(c.read(babyLogsProvider).loading, isFalse);
      final res = await c.read(babyLogsActionsProvider).addLog(logType: 'diaper', diaperType: 'wet');
      expect(res.error, isNull);
      expect(res.queued, isFalse);
      final id = res.data!.id;
      expect(id, matches(RegExp(r'^[0-9a-f-]{36}$')));
      final row = h.repo.logs.firstWhere((l) => l['id'] == id);
      expect(row, containsPair('child_id', 'c1'));
      expect(row, containsPair('user_id', 'u1'));
      expect(row, containsPair('diaper_type', 'wet'));
      expect(h.outbox.readOutbox('u1'), isEmpty);
    });

    test('queues offline, shows the row as pending, then flushes it once', () async {
      await settle(10);
      h.server.mode = 'offline';
      final res = await c.read(babyLogsActionsProvider).addLog(logType: 'feeding', feedType: 'formula', notes: '90 ml');
      expect(res.error, isNull);
      expect(res.queued, isTrue);
      expect(h.outbox.readOutbox('u1'), hasLength(1));
      await settle();
      final today = c.read(babyLogsProvider).todayLogs;
      expect(today, hasLength(1));
      expect(today.first.pending, isTrue);
      expect(today.first.feedType, 'formula');
      expect(c.read(babyLogsProvider).todayStats.formulaCount, 1);

      h.server.mode = 'ok';
      await h.outbox.flush('u1');
      await settle(10);
      expect(h.repo.logs, hasLength(1));
      expect(h.outbox.readOutbox('u1'), isEmpty);
      final after = c.read(babyLogsProvider).todayLogs;
      expect(after, hasLength(1));
      expect(after.first.pending, isFalse);
    });

    test('returns a real error without queueing', () async {
      await settle(10);
      h.server.mode = 'reject';
      final res = await c.read(babyLogsActionsProvider).addLog(logType: 'sleep');
      expect(res.error, isNotNull);
      expect(res.queued, isFalse);
      expect(h.outbox.readOutbox('u1'), isEmpty);
      await settle();
      expect(c.read(babyLogsProvider).todayLogs, isEmpty);
    });
  });

  group('realtime and helpers', () {
    test('a postgres change refetches the shared list', () async {
      await settle(10);
      final before = h.repo.calls.where((x) => x.startsWith('logs:')).length;
      h.repo.logs.add({
        'id': 'x1', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'diaper', 'diaper_type': 'dirty',
        'start_time': jsToIsoString(DomainClock.now()), 'created_at': '',
      });
      h.repo.emitLogChange();
      await settle(10);
      expect(h.repo.calls.where((x) => x.startsWith('logs:')).length, greaterThan(before));
      expect(c.read(babyLogsProvider).todayStats.dirtyCount, 1);
    });

    test('mergePendingBabyLogs keeps server rows, filters user / child / 7 days and sorts newest first', () {
      final now = DateTime.utc(2026, 11, 27, 12).millisecondsSinceEpoch;
      final server = [BabyLog.fromRow({'id': 'a', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'sleep', 'start_time': '2026-11-27T08:00:00.000Z'})];
      final merged = mergePendingBabyLogs(server, [
        {'id': 'a', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'sleep', 'start_time': '2026-11-27T09:00:00.000Z'},
        {'id': 'b', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'diaper', 'start_time': '2026-11-27T10:00:00.000Z'},
        {'id': 'c', 'user_id': 'u2', 'child_id': 'c1', 'log_type': 'diaper', 'start_time': '2026-11-27T10:00:00.000Z'},
        {'id': 'd', 'user_id': 'u1', 'child_id': 'c2', 'log_type': 'diaper', 'start_time': '2026-11-27T10:00:00.000Z'},
        {'id': 'e', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'diaper', 'start_time': '2026-11-01T10:00:00.000Z'},
      ], 'u1', 'c1', now);
      expect(merged.map((l) => l.id), ['b', 'a']);
      expect(merged.first.pending, isTrue);
      expect(merged.first.createdAt, '2026-11-27T10:00:00.000Z');
      expect(merged.last.pending, isFalse);
    });

    test('todayStats counts feeds by type, diapers and sleep minutes', () {
      final day = DateTime(2026, 11, 27, 9);
      String iso(DateTime d) => jsToIsoString(d);
      final logs = [
        BabyLog.fromRow({'id': '1', 'log_type': 'feeding', 'feed_type': 'breast_left', 'start_time': iso(day), 'end_time': iso(day.add(const Duration(minutes: 10)))}),
        BabyLog.fromRow({'id': '2', 'log_type': 'feeding', 'feed_type': 'right', 'start_time': iso(day)}),
        BabyLog.fromRow({'id': '3', 'log_type': 'feeding', 'feed_type': 'formula', 'start_time': iso(day)}),
        BabyLog.fromRow({'id': '4', 'log_type': 'sleep', 'start_time': iso(day), 'end_time': iso(day.add(const Duration(minutes: 95)))}),
        BabyLog.fromRow({'id': '5', 'log_type': 'diaper', 'diaper_type': 'mixed', 'start_time': iso(day)}),
      ];
      final s = todayStatsOf(logs);
      expect((s.feedingCount, s.breastFeedingCount, s.formulaCount, s.solidCount), (3, 2, 1, 0));
      expect((s.sleepMinutes, s.sleepHours), (95, 1.6));
      expect((s.diaperCount, s.bothCount), (1, 1));
      final b = feedingBreakdownOf(logs);
      expect((b.leftCount, b.rightCount, b.leftTotalSeconds, b.formulaCount), (1, 1, 600, 1));
    });
  });

  test('outbox copy of the queued toast', () {
    expect(queuedToast().title, 'Saxlanıldı, internet gələndə göndəriləcək');
  });
}
