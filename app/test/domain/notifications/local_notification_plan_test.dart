// Ported from: src/lib/local-notification-scheduler.test.ts ("planning (pure)" group; the "native scheduling"
// group drives a mocked Capacitor plugin and belongs to the native layer, its store rules are covered below)

import 'package:anacan/domain/notifications/local_notification_plan.dart';
import 'package:flutter_test/flutter_test.dart';

final now = DateTime(2026, 11, 25, 9, 0);
int hours(num h) => now.millisecondsSinceEpoch + (h * 3600000).round();
List<StoredNotification> items(int base, int count, int startHour) =>
    [for (var i = 0; i < count; i++) StoredNotification(id: base + i, title: 't${base + i}', body: 'b', at: hours(startHour + i))];

void main() {
  group('planning (pure)', () {
    test('orders by next fire time and keeps only the budget', () {
      final plan = planLocalNotifications({'b': items(200, 3, 1), 'a': items(100, 3, 2)}, now.millisecondsSinceEpoch, 4);
      expect(plan.map((n) => n.id), [200, 100, 201, 101]);
    });
    test('counts a daily reminder as its next occurrence and drops one-shots in the past', () {
      final eight = DateTime(2026, 1, 1, 8, 0).millisecondsSinceEpoch;
      expect(nextFireAt(at: eight, repeat: 'day', now: now.millisecondsSinceEpoch), DateTime(2026, 11, 26, 8, 0).millisecondsSinceEpoch);
      expect(nextFireAt(at: hours(-1), now: now.millisecondsSinceEpoch), isNull);
      final plan = planLocalNotifications({
        'water': [StoredNotification(id: 101, title: 'w', body: 'b', at: eight, repeat: 'day')],
        'vaccine': [StoredNotification(id: 1, title: 'v', body: 'b', at: hours(30)), StoredNotification(id: 2, title: 'old', body: 'b', at: hours(-2))],
      }, now.millisecondsSinceEpoch);
      expect(plan.map((n) => n.id), [101, 1]);
    });
  });

  group('store rules (from the native-scheduling cases)', () {
    test('keeps at most 60 pending (the nearest) and counts unmanaged pending ids against the limit', () {
      final store = SchedulerStore();
      replaceNamespace(store, 'vaccine:a', items(1000, 50, 1));
      replaceNamespace(store, 'vaccine:b', items(2000, 50, 1));
      var r = planReconcile(store, extraCancel: const [], pending: <int>{}, now: now.millisecondsSinceEpoch);
      expect(r.chosen, hasLength(pendingBudget));
      expect(r.toSchedule, hasLength(pendingBudget));
      r = planReconcile(store, extraCancel: const [], pending: {1, 2, 3}, now: now.millisecondsSinceEpoch);
      expect(r.chosen, hasLength(pendingBudget - 3));
    });
    test('an id belongs to one namespace; unchanged reminders are not re-sent; retired ids are cancelled', () {
      final store = SchedulerStore();
      replaceNamespace(store, 'a', items(1, 2, 1));
      final previous = replaceNamespace(store, 'b', items(2, 1, 5));
      expect(previous, isEmpty);
      expect(store.namespaces['a']!.map((n) => n.id), [1]);
      var r = planReconcile(store, extraCancel: const [], pending: null, now: now.millisecondsSinceEpoch);
      for (final n in r.toSchedule) {
        store.scheduled['${n.id}'] = fingerprint(n.item);
      }
      r = planReconcile(store, extraCancel: const [77], pending: {1, 2}, now: now.millisecondsSinceEpoch);
      expect(r.toSchedule, isEmpty);
      expect(r.cancel, [77]);
    });
    test("binding another account drops its reminders but keeps device-level water", () {
      final store = SchedulerStore(owner: 'u1');
      replaceNamespace(store, 'water', items(101, 1, 1));
      replaceNamespace(store, 'vaccine:x', items(1, 2, 1));
      expect(bindOwner(store, 'u2'), [1, 2]);
      expect(store.namespaces.keys, ['water']);
      expect(bindOwner(store, 'u2'), isNull);
      expect(parseSchedulerStore(null).namespaces, isEmpty);
      final round = parseSchedulerStore('{"v":1,"owner":"u","namespaces":{"a":[{"id":1,"title":"t","body":"b","at":5},{"id":1.5}]},"scheduled":{"1":"x","2":3}}');
      expect([round.owner, round.namespaces['a']!.length, round.scheduled], ['u', 1, {'1': 'x'}]);
    });
  });
}
