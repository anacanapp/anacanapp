// Ported from: src/lib/local-notification-scheduler.test.ts
//
// The Capacitor plugin mock becomes [FakeLocalNotificationBackend]; `vi.setSystemTime` becomes the scheduler clock;
// localStorage is an in-memory LocalStore. The Capacitor-proxy `then` case (52.0.0/52.0.1) has no Dart equivalent.
// The last group covers the Dart-only members (notifyNow, cancelIds, the re-planner, legacy appointment cleanup).
import 'dart:convert';

import 'package:anacan/domain/notifications/local_notification_plan.dart';
import 'package:anacan/services/notifications/local_notification_backend.dart';
import 'package:anacan/services/notifications/local_notification_scheduler.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_local_notifications.dart';

final DateTime kNow = DateTime(2026, 11, 25, 9, 0); // Wednesday 09:00 local
DateTime hours(num h) => kNow.add(Duration(milliseconds: (h * 3600000).round()));
List<StoredNotification> items(int base, int count, num startHour) => [
      for (var i = 0; i < count; i++)
        StoredNotification(id: base + i, title: 't${base + i}', body: 'b', at: hours(startHour + i).millisecondsSinceEpoch),
    ];

void main() {
  late FakeLocalNotificationBackend os;
  late LocalStore store;
  late DateTime now;
  late LocalNotificationScheduler scheduler;

  setUp(() {
    now = kNow;
    os = FakeLocalNotificationBackend();
    store = LocalStore.memory();
    scheduler = LocalNotificationScheduler(store: store, backend: os, clock: () => now);
  });

  group('planning (pure)', () {
    test('orders by next fire time and keeps only the budget', () {
      final plan = planLocalNotifications({'b': items(200, 3, 1), 'a': items(100, 3, 2)}, kNow.millisecondsSinceEpoch, 4);
      expect(plan.map((n) => n.id), [200, 100, 201, 101]);
    });

    test('counts a daily reminder as its next occurrence and drops one-shots in the past', () {
      final eight = DateTime(2026, 1, 1, 8, 0).millisecondsSinceEpoch;
      expect(nextFireAt(at: eight, repeat: 'day', now: kNow.millisecondsSinceEpoch), DateTime(2026, 11, 26, 8, 0).millisecondsSinceEpoch);
      expect(nextFireAt(at: hours(-1).millisecondsSinceEpoch, now: kNow.millisecondsSinceEpoch), isNull);
      final plan = planLocalNotifications({
        'water': [StoredNotification(id: 101, title: 'w', body: 'b', at: eight, repeat: 'day')],
        'vaccine': [
          StoredNotification(id: 1, title: 'v', body: 'b', at: hours(30).millisecondsSinceEpoch),
          StoredNotification(id: 2, title: 'old', body: 'b', at: hours(-2).millisecondsSinceEpoch),
        ],
      }, kNow.millisecondsSinceEpoch);
      expect(plan.map((n) => n.id), [101, 1]); // tomorrow 08:00 comes before +30 h
    });
  });

  group('native scheduling', () {
    test('keeps at most $pendingBudget pending (the nearest) across every feature and child', () async {
      await scheduler.setLocalNotifications('vaccine:a', items(1000, 40, 10));
      await scheduler.setLocalNotifications('vaccine:b', items(2000, 40, 1));
      await scheduler.setLocalNotifications('parenting', items(3000, 7, 5));
      expect(os.pending.length, pendingBudget);
      final all = [...items(1000, 40, 10), ...items(2000, 40, 1), ...items(3000, 7, 5)]
        ..sort((x, y) => x.at != y.at ? x.at - y.at : x.id - y.id);
      final nearest = all.take(pendingBudget).map((n) => n.id).toList()..sort();
      expect(os.pendingKeys..sort(), nearest);
      // The rest stays in the durable desired set for a later re-plan.
      expect(scheduler.desired(), hasLength(87));
    });

    test('schedules the remaining reminders on a later re-plan once the nearest ones have fired', () async {
      await scheduler.setLocalNotifications('vaccine:a', items(1000, 70, 1));
      expect(os.pending.containsKey(1060), isFalse);
      // 15 hours later the first 15 have fired (the OS drops delivered one-shots).
      now = hours(15.5);
      for (var i = 0; i < 15; i++) {
        os.pending.remove(1000 + i);
      }
      await scheduler.replan();
      expect(os.pending.length, 55); // 70 - 15 left, all fit now
      expect(os.pending.containsKey(1069), isTrue);
      expect(scheduler.desired('vaccine:a'), hasLength(55)); // fired ones are pruned
    });

    test('cancels reminders a feature no longer wants and ones pushed out by nearer reminders', () async {
      await scheduler.setLocalNotifications('parenting', items(3000, 5, 1));
      await scheduler.setLocalNotifications('parenting', items(3000, 2, 1));
      expect(os.cancelledIds, containsAll([3002, 3003, 3004]));
      expect(os.pendingKeys, [3000, 3001]);

      await scheduler.setLocalNotifications('far', items(5000, 59, 100));
      expect(os.pending.length, pendingBudget);
      os.cancelCalls.clear();
      await scheduler.setLocalNotifications('near', items(6000, 3, 2));
      // 2 + 59 > 60, so 5058 was never pending; the next three farthest of "far" make room and stay desired.
      expect(os.pending.containsKey(5058), isFalse);
      expect(os.cancelledIds..sort(), [5055, 5056, 5057]);
      expect(os.pending.length, pendingBudget);
      expect(scheduler.desired('far'), hasLength(59));
    });

    test('keeps ids stable: an installed reminder of an older version is replaced, never duplicated, and unchanged ones are not re-sent',
        () async {
      // Scheduled by the previous app version directly (same stable id), not known to the scheduler.
      os.pending[882200] = legacyNotification(882200, 'old copy');
      os.pending[882205] = legacyNotification(882205, 'old day 6');
      await scheduler.setLocalNotifications('parenting', items(882200, 2, 3), cancelIds: [for (var i = 0; i < 8; i++) 882200 + i]);
      expect(os.pendingKeys..sort(), [882200, 882201]);
      expect(os.pending[882200]!.title, 't882200');
      expect(os.cancelledIds, contains(882205)); // the retired legacy id
      os.scheduleCalls.clear();
      await scheduler.setLocalNotifications('parenting', items(882200, 2, 3));
      await scheduler.replan();
      expect(os.scheduleCalls, isEmpty);
    });

    test('counts pending reminders it does not own against the iOS limit', () async {
      for (var i = 0; i < 10; i++) {
        os.pending[9000 + i] = legacyNotification(9000 + i, 'legacy');
      }
      await scheduler.setLocalNotifications('vaccine:a', items(1000, 70, 1));
      expect(os.pending.length, pendingBudget);
      expect(os.pendingKeys.where((id) => id >= 1000 && id < 2000), hasLength(50));
    });

    test('a daily reminder is handed to the OS as a repeating time of day', () async {
      await scheduler.setLocalNotifications(
          'water', [StoredNotification(id: 101, title: 'w', body: 'b', at: DateTime(2026, 11, 25, 10, 0).millisecondsSinceEpoch, repeat: 'day')]);
      expect(os.pending[101]!.schedule, const NativeScheduleDaily(hour: 10, minute: 0));
    });

    test('never prompts unless the feature asks from a user action, and keeps the desired set while not allowed', () async {
      os.display = 'prompt';
      expect(await scheduler.setLocalNotifications('nap', items(880001, 1, 2)), 'denied');
      expect(os.requestCalls, 0);
      expect(os.pending, isEmpty);
      await scheduler.replan();
      expect(os.requestCalls, 0);
      expect(await scheduler.setLocalNotifications('weaning', items(881100, 1, 3), ask: true), 'scheduled');
      expect(os.requestCalls, 1);
      expect(os.pendingKeys..sort(), [880001, 881100]); // the waiting nap alert is scheduled too
    });

    test('removes a namespace family (every vaccine block)', () async {
      await scheduler.setLocalNotifications('vaccine:883400', items(883400, 2, 1));
      await scheduler.setLocalNotifications('vaccine:883430', items(883430, 2, 1));
      await scheduler.setLocalNotifications('water', items(101, 1, 1));
      await scheduler.clearNamespaces('vaccine:');
      expect(os.pendingKeys, [101]);
      expect(scheduler.desired().map((n) => n.id), [101]);
    });

    test('logout clears the desired set and every pending and delivered notification', () async {
      await scheduler.setLocalNotifications('vaccine:a', items(1000, 3, 1));
      os.pending[77] = legacyNotification(77, 'other');
      await scheduler.reset();
      expect(os.pending, isEmpty);
      expect(os.removeDeliveredCalls, 1);
      expect(scheduler.desired(), isEmpty);
      await scheduler.replan();
      expect(os.pending, isEmpty);
    });

    test("cancels another account's reminders when a different account is bound; device reminders stay", () async {
      await scheduler.bindOwner('user-a');
      await scheduler.setLocalNotifications('vaccine:a', items(1000, 2, 1));
      await scheduler.setLocalNotifications('water', items(101, 1, 1));
      await scheduler.bindOwner('user-a');
      expect(os.pending.length, 3);
      await scheduler.bindOwner('user-b');
      expect(os.pendingKeys, [101]);
      expect(scheduler.desired('vaccine:a'), isEmpty);
    });

    test('does nothing on the web', () async {
      os.native = false;
      expect(await scheduler.setLocalNotifications('nap', items(880001, 1, 2)), 'unavailable');
      expect(os.scheduleCalls, isEmpty);
      expect(os.scheduledIds, isEmpty);
    });
  });

  group('Dart scheduler members', () {
    test('stores the desired set under the WebView key with the same JSON shape', () async {
      await scheduler.bindOwner('user-a');
      await scheduler.setLocalNotifications('water', [
        StoredNotification(id: 101, title: 'w', body: 'b', at: hours(1).millisecondsSinceEpoch, repeat: 'day', extra: const {'type': 'x'}),
      ]);
      final raw = jsonDecode(store.getItem('anacan.localNotifications.v1')!) as Map;
      expect(raw['v'], 1);
      expect(raw['owner'], 'user-a');
      expect((raw['namespaces'] as Map)['water'], [
        {'id': 101, 'title': 'w', 'body': 'b', 'at': hours(1).millisecondsSinceEpoch, 'repeat': 'day', 'extra': {'type': 'x'}},
      ]);
      expect((raw['scheduled'] as Map).keys, ['101']);
    });

    test('notifyNow shows at once without a pending slot and asks only when told to', () async {
      os.display = 'prompt';
      expect(await scheduler.notifyNow(id: 1100000001, title: 't', body: 'b'), isFalse);
      expect(os.requestCalls, 0);
      expect(await scheduler.notifyNow(id: 1100000001, title: 't', body: 'b', ask: true, ongoing: true), isTrue);
      expect(os.pending[1100000001]!.schedule, isNull);
      expect(os.pending[1100000001]!.ongoing, isTrue);
      expect(scheduler.desired(), isEmpty);
    });

    test('cancelIds cancels ids outside any namespace', () async {
      await scheduler.notifyNow(id: 55, title: 't', body: 'b');
      await scheduler.cancelIds([55]);
      expect(os.pending, isEmpty);
      os.cancelCalls.clear();
      await scheduler.cancelIds(const []);
      expect(os.cancelCalls, isEmpty);
    });

    test('operations run in order (a feature update never races a re-plan)', () async {
      final order = <String>[];
      final a = scheduler.setLocalNotifications('a', items(1, 1, 1)).then((_) => order.add('set'));
      final b = scheduler.replan().then((_) => order.add('replan'));
      final c = scheduler.clearNamespaces('a').then((_) => order.add('clear'));
      await Future.wait([a, b, c]);
      expect(order, ['set', 'replan', 'clear']);
      expect(os.pending, isEmpty);
    });

    test('a failing bridge does not break the queue', () async {
      os.pendingError = StateError('bridge');
      await expectLater(scheduler.reset(), throwsStateError);
      os.pendingError = null;
      expect(await scheduler.setLocalNotifications('a', items(1, 1, 1)), 'scheduled');
    });

    test('the re-planner runs now and on resume, throttled to the interval', () async {
      VoidCallback? onResume;
      await scheduler.setLocalNotifications('a', items(1, 1, 1));
      os.pending.clear();
      scheduler.installReplanner(listen: (cb) {
        onResume = cb;
        return () {};
      });
      Future<void> drain() => scheduler.cancelIds(const []);
      await drain();
      expect(os.pendingKeys, [1]);
      os.pending.clear();
      now = now.add(const Duration(seconds: 10));
      onResume!();
      await drain();
      expect(os.pending, isEmpty); // throttled
      now = now.add(const Duration(seconds: 31));
      onResume!();
      await drain();
      expect(os.pendingKeys, [1]);
      // Installed once.
      scheduler.installReplanner(listen: (cb) => throw StateError('twice'));
    });

    test('the re-planner registers no resume listener off native', () {
      var listened = false;
      scheduler.installReplanner(isNative: false, listen: (cb) {
        listened = true;
        return () {};
      });
      expect(listened, isFalse);
    });

    test('clears the legacy local appointment reminders (400..1499) once per device', () async {
      for (final id in [399, 400, 1499, 1500]) {
        os.pending[id] = legacyNotification(id, 'x');
      }
      await scheduler.clearLegacyAppointmentNotifications();
      expect(os.pendingKeys..sort(), [399, 1500]);
      expect(store.getItem(legacyAppointmentClearedKey), '1');
      os.pending[401] = legacyNotification(401, 'x');
      await scheduler.clearLegacyAppointmentNotifications();
      expect(os.pending.containsKey(401), isTrue);
    });
  });
}
