// Ported from: (no vitest suite) behaviour of src/lib/live-timer.ts, src/utils/timerNotifications.ts and
//              src/hooks/usePendingTimerStops.ts as documented in docs/LIVE_TIMER_SETUP.md and docs/flutter/SERVICES.md §15
import 'dart:async';

import 'package:anacan/features/baby/hooks/use_baby_logs.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/baby/hooks/use_pending_timer_stops.dart';
import 'package:anacan/features/baby/live_timer/live_timer.dart';
import 'package:anacan/state/timer_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../home_mommy/support/mommy_harness.dart';

/// Records every plugin call; `pending` is the native `anacan-pending-timer-stops` list.
class FakeBridge implements LiveTimerBridge {
  final calls = <String>[];
  List<PendingTimerStop> pending = [];
  bool failStart = false;
  bool failGet = false;
  void Function(PendingTimerStop)? listener;
  int removed = 0;

  @override
  bool get isNative => true;
  @override
  Future<void> startActivity(LiveActivityStart o) async {
    calls.add('start:${o.id}:${o.label}');
    if (failStart) throw Exception('Live Activities disabled by user');
  }

  @override
  Future<void> stopActivity({String? timerId}) async => calls.add('stop:$timerId');
  @override
  Future<List<PendingTimerStop>> getPendingStops() async {
    calls.add('get');
    if (failGet) throw Exception('no plugin');
    return List.of(pending);
  }

  @override
  Future<void> clearPendingStops() async {
    calls.add('clear');
    pending = [];
  }

  @override
  Future<void Function()> addTimerStoppedListener(void Function(PendingTimerStop) l) async {
    listener = l;
    return () => removed++;
  }
}

class FakeScheduler implements TimerNotificationScheduler {
  final shown = <(int, String, String)>[];
  final cancelled = <int>[];
  @override
  Future<void> notifyNow({required int id, required String title, required String body, bool ongoing = true, bool autoCancel = false, String smallIcon = 'ic_stat_icon', bool ask = true}) async =>
      shown.add((id, title, body));
  @override
  Future<void> cancelIds(List<int> ids) async => cancelled.addAll(ids);
}

const t0 = 1795000000000;
Future<void> settle([int ms = 10]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  group('timerNotifications', () {
    test('hashTimerId is the stable positive 31-bit id of the JS implementation', () {
      // Values computed with the TS function (`(h << 5) - h + c | 0`, `Math.abs(h) % 2147483647 || 1`).
      expect(hashTimerId('a'), 97);
      expect(hashTimerId('sleep-main-nochild-1795000000000'), hashTimerId('sleep-main-nochild-1795000000000'));
      expect(hashTimerId('sleep-main-nochild-1795000000000'), inInclusiveRange(1, 2147483646));
      expect(hashTimerId(''), 1);
    });

    test('nothing is shown or cancelled off-native', () async {
      final s = FakeScheduler();
      final n = TimerNotifications(s, isNative: false);
      await n.show('t', 'sleep');
      await n.clearAll(['t']);
      expect(s.shown, isEmpty);
      expect(s.cancelled, isEmpty);
    });
  });

  group('live-timer', () {
    late FakeBridge bridge;
    late FakeScheduler scheduler;
    late LiveTimer live;
    final toasts = <String>[];

    setUp(() {
      bridge = FakeBridge();
      scheduler = FakeScheduler();
      toasts.clear();
      live = LiveTimer(bridge: bridge, notifications: TimerNotifications(scheduler, isNative: true), isIos: true, onIosFailure: toasts.add);
    });

    test('starts a Live Activity with the child prefix and feeding side', () async {
      await live.startNativeTimer(const ActiveTimer(id: 'f1', type: 'feeding', feedType: 'left', childName: 'Aylin', startTime: t0));
      expect(bridge.calls.single, 'start:f1:Aylin — 🍼 Əmizdirmə (Sol)');
      expect(live.nativeActive, {'f1'});
      await live.stopNativeTimer('f1');
      expect(bridge.calls.last, 'stop:f1');
      expect(scheduler.cancelled, isEmpty);
    });

    test('falls back to the ongoing notification (+ iOS diagnostic toast) when the activity cannot start', () async {
      bridge.failStart = true;
      await live.startNativeTimer(const ActiveTimer(id: 's1', type: 'sleep', startTime: t0));
      expect(scheduler.shown.single, (hashTimerId('s1'), '😴 Yuxu', 'Timer aktiv — geri dönmək üçün toxunun'));
      expect(toasts.single, startsWith('LiveActivity başlamadı: '));
      await live.stopNativeTimer('s1');
      expect(scheduler.cancelled, [hashTimerId('s1')]);
      expect(bridge.calls.last, 'stop:s1');
    });

    test('processPendingStops clears the native list only when every save succeeded', () async {
      bridge.pending = [
        const PendingTimerStop(id: 'a', type: 'sleep', startTime: t0, stoppedAt: t0 + 60000),
        const PendingTimerStop(id: 'b', type: 'feeding', feedType: 'right', startTime: t0, stoppedAt: t0 + 60000),
      ];
      expect(await live.processPendingStops((s) => s.id == 'a'), 2);
      expect(bridge.calls, isNot(contains('clear')));
      expect(bridge.pending, hasLength(2));
      expect(await live.processPendingStops((s) => throw StateError('x')), 2);
      expect(bridge.calls, isNot(contains('clear')));
      expect(await live.processPendingStops((s) async => true), 2);
      expect(bridge.calls.last, 'clear');
      expect(await live.processPendingStops((s) => true), 0);
    });

    test('a failing plugin counts as nothing processed; off-native is inert', () async {
      bridge.failGet = true;
      expect(await live.processPendingStops((_) => true), 0);
      final off = LiveTimer(bridge: const NoopLiveTimerBridge(), notifications: TimerNotifications(scheduler, isNative: false));
      expect(await off.processPendingStops((_) => true), 0);
      off.onNativeTimerStopped(() {})();
    });

    test('a timerStopped listener resolved after cleanup is removed at once', () async {
      final off = live.onNativeTimerStopped(() {});
      off();
      await settle(0);
      expect(bridge.removed, 1);
    });
  });

  group('usePendingTimerStops', () {
    late MommyHarness h;
    late FakeBridge bridge;
    late ProviderContainer c;

    setUp(() {
      resetChildrenSeedGuard();
      h = MommyHarness(nowMs: t0 + 600000);
      h.repo.children = [childRow('c1'), childRow('c2', sort: 1)];
      bridge = FakeBridge();
      c = ProviderContainer(overrides: [
        ...h.overrides,
        liveTimerBridgeProvider.overrideWithValue(bridge),
        timerNotificationSchedulerProvider.overrideWithValue(FakeScheduler()),
      ]);
      c.listen(babyLogsProvider, (_, _) {});
    });
    tearDown(() {
      c.dispose();
      h.dispose();
    });

    test('waits for user + children, then writes sleep / feeding stops with the timer child and clears the list', () async {
      final id = c.read(timerStoreProvider.notifier).startTimer('feeding', feedType: 'left', childId: 'c2');
      bridge.pending = [
        PendingTimerStop(id: id, type: 'feeding', feedType: 'left', startTime: t0 + 600000, stoppedAt: t0 + 600000 + 300000),
        const PendingTimerStop(id: 's', type: 'sleep', startTime: t0, stoppedAt: t0 + 3600000),
        const PendingTimerStop(id: 'k', type: 'kick', startTime: t0, stoppedAt: t0 + 60000),
        const PendingTimerStop(id: 'tap', type: 'sleep', startTime: t0, stoppedAt: t0 + 2000),
      ];
      // Before the children list is ready nothing is written and the list is kept.
      final p = c.read(pendingTimerStopsProvider);
      p.deps = const PendingStopDeps(userId: 'u1', childrenLoading: true);
      await p.handlePending();
      expect(h.repo.logs, isEmpty);
      expect(bridge.calls, isNot(contains('clear')));

      c.listen(childrenProvider, (_, _) {});
      await settle(10);
      c.listen(pendingTimerStopsHostProvider, (_, _) {});
      await settle(30);
      expect(bridge.calls.last, 'clear');
      expect(h.repo.logs, hasLength(2));
      final feed = h.repo.logs.firstWhere((l) => l['log_type'] == 'feeding');
      expect(feed['feed_type'], 'breast_left');
      expect(feed['child_id'], 'c2', reason: 'the persisted timer decides the child (twins)');
      final sleep = h.repo.logs.firstWhere((l) => l['log_type'] == 'sleep');
      expect(sleep['child_id'], 'c1', reason: 'no timer in the store: the selected child');
      expect(sleep['start_time'], DateTime.fromMillisecondsSinceEpoch(t0, isUtc: true).toIso8601String());
      expect(sleep['end_time'], DateTime.fromMillisecondsSinceEpoch(t0 + 3600000, isUtc: true).toIso8601String());
      expect(c.read(timerStoreProvider).activeTimers, isEmpty, reason: 'the stopped store timer is removed');
    });

    test('skips a stop whose log already exists (duplicate guard) and still clears', () async {
      h.repo.logExistsAnswer = true;
      bridge.pending = [const PendingTimerStop(id: 's', type: 'sleep', startTime: t0, stoppedAt: t0 + 3600000)];
      c.listen(childrenProvider, (_, _) {});
      await settle(10);
      c.listen(pendingTimerStopsHostProvider, (_, _) {});
      await settle(30);
      expect(h.repo.logs, isEmpty);
      expect(bridge.calls.last, 'clear');
    });

    test('a rejected insert keeps the native list for the next resume / timerStopped event', () async {
      h.server.mode = 'reject';
      bridge.pending = [const PendingTimerStop(id: 's', type: 'sleep', startTime: t0, stoppedAt: t0 + 3600000)];
      c.listen(childrenProvider, (_, _) {});
      await settle(10);
      c.listen(pendingTimerStopsHostProvider, (_, _) {});
      await settle(30);
      expect(bridge.calls, isNot(contains('clear')));
      h.server.mode = 'ok';
      h.resumes.add(null); // app resume
      await settle(30);
      expect(bridge.calls.last, 'clear');
      bridge.pending = [const PendingTimerStop(id: 's2', type: 'sleep', startTime: t0 + 1, stoppedAt: t0 + 3600000)];
      bridge.listener!(bridge.pending.first); // Android live event
      await settle(30);
      expect(bridge.calls.last, 'clear');
      expect(h.repo.logs, hasLength(2));
    });

    test('an offline stop is queued in the outbox and counts as saved', () async {
      h.server.mode = 'offline';
      bridge.pending = [const PendingTimerStop(id: 's', type: 'sleep', startTime: t0, stoppedAt: t0 + 3600000)];
      c.listen(childrenProvider, (_, _) {});
      await settle(10);
      c.listen(pendingTimerStopsHostProvider, (_, _) {});
      await settle(30);
      expect(bridge.calls.last, 'clear');
      expect(h.outbox.readOutbox('u1'), hasLength(1));
    });

    test('the timer store drives the native hooks through LiveTimerNativeHooks', () async {
      final hooks = c.read(liveTimerNativeHooksProvider);
      hooks.startNativeTimer(const ActiveTimer(id: 'x', type: 'sleep', startTime: t0));
      await settle(0);
      expect(bridge.calls.last, startsWith('start:x:😴 Yuxu'));
      hooks.stopNativeTimer('x');
      await settle(0);
      expect(bridge.calls.last, 'stop:x');
      unawaited(Future<void>.value());
    });
  });
}
