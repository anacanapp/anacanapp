// Ported from: src/hooks/useDailyLogs.water.test.tsx
import 'dart:async';

import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/home/data/daily_logs.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../home_test_support.dart';

void main() {
  late HomeTestEnv env;

  setUp(() {
    installTestI18n();
    resetWaterChainsForTests();
    // 12:00 in the device zone (the Baku zone of the React test is the device's local zone here).
    env = HomeTestEnv(now: DateTime(2026, 9, 10, 12));
  });
  tearDown(() => env.dispose());

  Future<DailyLogsController> mounted() async {
    env.container.listen(dailyLogsProvider, (_, _) {});
    await Future<void>.delayed(Duration.zero);
    final c = env.container.read(dailyLogsProvider.notifier);
    await c.fetchLogs();
    expect(env.container.read(dailyLogsProvider).loading, isFalse);
    return c;
  }

  group('water taps', () {
    test('counts a quick double tap as two glasses, shown before the server answers', () async {
      env.repo.dailyRows['2026-09-10'] = {'water_intake': 3, 'mood': 4};
      final c = await mounted();
      expect(c.waterToday(), 3);

      env.repo.gate = Completer<void>();
      final taps = Future.wait([c.updateWaterIntake(1), c.updateWaterIntake(1)]);
      await Future<void>.delayed(Duration.zero);
      expect(c.waterToday(), 5);
      env.repo.gate!.complete();
      env.repo.gate = null;
      await taps;

      expect([for (final call in env.repo.waterCalls) call['delta']], [1, 1]);
      expect({for (final call in env.repo.waterCalls) call['id']}.length, 2);
      expect(env.repo.dailyRows['2026-09-10'], {'water_intake': 5, 'mood': 4});
      expect(c.waterToday(), 5);
      expect(c.visibleTodayLog()?['mood'], 4);
      expect(env.outbox.readOutbox('u1'), isEmpty);
    });

    test('starts a new local day at 1 when the app stayed open across midnight', () async {
      env.repo.dailyRows['2026-09-10'] = {'water_intake': 6, 'mood': null};
      final c = await mounted();
      expect(c.waterToday(), 6);

      DomainClock.setSystemTime(DateTime(2026, 9, 11, 0, 5));
      await c.updateWaterIntake(1);

      expect(env.repo.waterCalls.first['log_date'], '2026-09-11');
      expect(env.repo.waterCalls.first['delta'], 1);
      expect(env.repo.dailyRows['2026-09-11']?['water_intake'], 1);
      expect(env.repo.dailyRows['2026-09-10']?['water_intake'], 6);
      expect(c.waterToday(), 1);
      expect(c.visibleTodayLog()?['log_date'], '2026-09-11');
    });

    test('does not show yesterday’s row as today after midnight', () async {
      env.repo.dailyRows['2026-09-10'] = {'water_intake': 6, 'mood': 2};
      final c = await mounted();
      DomainClock.setSystemTime(DateTime(2026, 9, 11, 0, 5));
      expect(c.waterToday(), 0);
      expect(c.visibleTodayLog(), isNull);
    });

    test('keeps offline taps queued, shows them, and replays them once when online', () async {
      final c = await mounted();
      env.repo.mode = FakeMode.offline;
      final outcome = await c.updateWaterIntake(1);
      await c.updateWaterIntake(1);
      expect(outcome.error, isNull);
      expect([for (final e in env.outbox.readOutbox('u1')) e.table], ['water_intake', 'water_intake']);
      expect(c.waterToday(), 2);

      env.repo.mode = FakeMode.ok;
      await env.outbox.flush('u1');
      expect(env.outbox.readOutbox('u1'), isEmpty);
      expect(env.repo.dailyRows['2026-09-10']?['water_intake'], 2);
      await Future<void>.delayed(Duration.zero);
      await c.fetchLogs();
      expect(c.waterToday(), 2);
    });

    test('does not double count when the answer was lost and the tap is retried', () async {
      final c = await mounted();
      env.repo.mode = FakeMode.lostAnswer;
      await c.updateWaterIntake(1);
      expect(env.repo.dailyRows['2026-09-10']?['water_intake'], 1);
      expect(env.outbox.readOutbox('u1'), hasLength(1));

      env.repo.mode = FakeMode.ok;
      await env.outbox.flush('u1');
      expect(env.repo.waterCalls, hasLength(2));
      expect(env.repo.waterCalls[0]['id'], env.repo.waterCalls[1]['id']);
      expect(env.repo.dailyRows['2026-09-10']?['water_intake'], 1);
      await c.fetchLogs();
      expect(c.waterToday(), 1);
    });

    // 'falls back to the old read-and-add write when the server has no RPC yet' lives in the outbox sender
    // (core/offline/outbox_senders.dart) and is covered by test/core/offline/offline_outbox_test.dart.
  });
}
