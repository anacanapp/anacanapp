// Ported from: src/lib/vaccine-reminders.test.ts
//
// The vitest "multi-child" cases mock the Capacitor LocalNotifications plugin under the central scheduler; here the
// scheduler seam ([VaccineNotificationScheduler]) is faked: it records every namespace write (scheduled ids,
// cancelIds) and answers like the scheduler for the permission state ('granted' → 'scheduled', 'prompt' without
// asking → 'denied'). Re-sending identical reminders is the central scheduler's job (diffing), so "nothing is
// re-sent" is asserted as "the same namespace content".
import 'package:anacan/domain/notifications/local_notification_plan.dart';
import 'package:anacan/domain/vaccines/vaccine_schedule.dart';
import 'package:anacan/features/tools/vaccines/vaccine_reminders.dart';
import 'package:anacan/shell/links/deeplink.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime local(int y, int m, int d, [int h = 0, int mi = 0]) => DateTime(y, m, d, h, mi);
final DateTime now = local(2026, 11, 8, 9, 0); // Sunday 09:00
ReminderDose dose(String id, String status, DateTime? due) => ReminderDose(id: id, status: status, due: due);
String two(int v) => v.toString().padLeft(2, '0');
String fmt(DateTime d) => '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';

class FakeScheduler implements VaccineNotificationScheduler {
  bool native = true;
  String perm = 'granted';
  int permissionPrompts = 0;
  final Map<String, List<StoredNotification>> namespaces = {};
  final List<List<int>> scheduled = [];
  final List<List<int>> cancelled = [];

  List<int> get scheduledIds => [for (final c in scheduled) ...c];
  List<int> get cancelledIds => [for (final c in cancelled) ...c];

  @override
  bool get isNativePlatform => native;

  @override
  Future<String> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = true, List<int> cancelIds = const []}) async {
    if (!native) return 'unavailable';
    if (perm != 'granted') {
      if (!ask) return 'denied';
      permissionPrompts++;
    }
    final previous = namespaces[namespace] ?? const [];
    final stale = cancelIds.where((id) => !items.any((n) => n.id == id)).toList();
    cancelled.add(stale);
    final changed = [for (final n in items) if (!previous.any((p) => p.id == n.id && p.at == n.at && p.body == n.body)) n.id];
    if (changed.isNotEmpty) scheduled.add(changed);
    namespaces[namespace] = items;
    return items.isEmpty ? 'cleared' : 'scheduled';
  }

  @override
  Future<void> clearLocalNotificationNamespaces(String prefix, List<int> ids) async {
    namespaces.removeWhere((k, _) => k.startsWith(prefix));
    cancelled.add(ids);
  }

  void clear() {
    scheduled.clear();
    cancelled.clear();
  }
}

void main() {
  group('vaccineReminderSlots', () {
    test('reminds at 10:00 three days before and on the due day, only for doses in the next 60 days', () {
      final slots = vaccineReminderSlots([
        dose('a', 'future', local(2026, 11, 20)),
        dose('far', 'future', local(2027, 1, 20)),
        dose('none', 'future', null),
      ], now);
      expect([for (final s in slots) [s.doseId, s.kind, fmt(s.at)]], [
        ['a', 'soon', '2026-11-17 10:00'],
        ['a', 'today', '2026-11-20 10:00'],
      ]);
      expect(slots.map((s) => s.id).toList(), [vaccineReminderBaseId, vaccineReminderBaseId + 1]);
    });

    test('skips done, skipped, conditional and interval doses and times already past', () {
      final slots = vaccineReminderSlots([
        dose('done', 'done', local(2026, 11, 20)),
        dose('skip', 'skipped', local(2026, 11, 20)),
        dose('cond', 'conditional', local(2026, 11, 20)),
        dose('int', 'interval', local(2026, 11, 20)),
        dose('today', 'pending', local(2026, 11, 8)),
        dose('tomorrow', 'future', local(2026, 11, 9)),
      ], now);
      expect([for (final s in slots) [s.doseId, s.kind, fmt(s.at)]], [
        ['today', 'today', '2026-11-08 10:00'],
        ['tomorrow', 'today', '2026-11-09 10:00'],
      ]);
      expect(vaccineReminderSlots([dose('today', 'pending', local(2026, 11, 8))], local(2026, 11, 8, 10, 30)), isEmpty);
    });

    test('sends one gentle overdue reminder per dose on its due weekday, at most a few, never older than a year', () {
      final slots = vaccineReminderSlots([
        dose('o1', 'overdue', local(2026, 9, 2)),
        dose('o2', 'overdue', local(2026, 9, 3)),
        dose('o3', 'overdue', local(2026, 9, 9)),
        dose('o4', 'overdue', local(2026, 10, 3)),
        dose('o5', 'overdue', local(2026, 10, 4)),
        dose('old', 'overdue', local(2025, 1, 1)),
      ], now);
      expect([for (final s in slots) [s.doseId, s.kind, fmt(s.at)]], [
        ['o1', 'overdue', '2026-11-11 10:00'],
        ['o2', 'overdue', '2026-11-12 10:00'],
        ['o4', 'overdue', '2026-11-14 10:00'],
      ]);
      expect(slots.where((s) => s.kind == 'overdue'), hasLength(maxOverdue));
    });

    test('keeps the overdue time stable across reschedules within the week (at most once a week)', () {
      final d = [dose('o', 'overdue', local(2026, 10, 4))];
      expect(fmt(vaccineReminderSlots(d, now)[0].at), '2026-11-08 10:00');
      expect(fmt(vaccineReminderSlots(d, local(2026, 11, 8, 11))[0].at), '2026-11-15 10:00');
      expect(fmt(vaccineReminderSlots(d, local(2026, 11, 11, 15))[0].at), '2026-11-15 10:00');
    });

    test('caps upcoming reminders and keeps ids in the dedicated range', () {
      final many = [for (var i = 0; i < 30; i++) dose('d${two(i)}', 'future', local(2026, 11, 15 + i))];
      final slots = vaccineReminderSlots([...many, dose('o', 'overdue', local(2026, 10, 1))], now);
      expect(slots.where((s) => s.kind != 'overdue'), hasLength(maxUpcoming));
      expect(slots.where((s) => s.kind == 'overdue'), hasLength(1));
      expect(slots.map((s) => s.id).reduce((a, b) => a > b ? a : b), lessThan(vaccineReminderBaseId + maxUpcoming + maxOverdue));
      expect(slots.map((s) => s.id).toSet().length, slots.length);
    });

    test('changes the key only when the plan changes', () {
      final a = vaccineReminderSlots([dose('a', 'future', local(2026, 11, 20))], now);
      final b = vaccineReminderSlots([dose('a', 'future', local(2026, 11, 20))], local(2026, 11, 8, 9, 30));
      expect(vaccineSlotsKey(a, 'az'), vaccineSlotsKey(b, 'az'));
      expect(vaccineSlotsKey(a, 'az'), isNot(vaccineSlotsKey(a, 'en')));
      expect(vaccineSlotsKey(const [], 'az'), 'az|none');
    });
  });

  group('vaccineDueDate', () {
    const row = ScheduleLike(id: 'r', doseNumber: 1, recommendedAgeDays: 60, minAgeDays: 45, maxAgeDays: 120);
    ScheduleLike withMeta(Map<String, Object?> extra) => ScheduleLike(
          id: 'r', doseNumber: 1, recommendedAgeDays: 60, minAgeDays: 45, maxAgeDays: 120,
          scheduleMeta: {
            'protocol': 'anacan-vaccine-schedule-v1', 'version': '1', 'kind': 'routine', 'age': {'months': 2, 'days': 0}, 'end_age': null,
            'expected_age_days': 60, 'expected_dose_number': 1, 'source_url': 'x', 'source_label': 'x', ...extra,
          },
        );

    test('uses the recommended age for plain rows and local midnight', () {
      expect(fmt(vaccineDueDate(row, '2026-10-01', {})!), '2026-11-30 00:00');
      expect(vaccineDueDate(row, 'nope', {}), isNull);
    });

    test('follows calendar offsets and waits for the earlier dose of an interval', () {
      expect(fmt(vaccineDueDate(withMeta({}), '2026-10-31', {})!), '2026-12-31 00:00');
      final rel = withMeta({'relative': {'schedule_id': 'prev', 'min': {'months': 1, 'days': 0}}});
      expect(vaccineDueDate(rel, '2026-10-01', {}), isNull);
      final logs = {'prev': const VaccinationLike(administeredAt: '2026-12-15')};
      expect(fmt(vaccineDueDate(rel, '2026-10-01', logs)!), '2027-01-15 00:00');
      expect(vaccineDueDate(withMeta({'kind': 'seasonal'}), '2026-10-01', {}), isNull);
    });
  });

  group('tap payload', () {
    test('opens the vaccine calendar through the existing deeplink route', () {
      final parsed = parseDeeplink(vaccineDeeplink);
      expect(parsed?.action, 'tool');
      expect(parsed?.params['tool_id'], 'vaccine-calendar');
    });
  });

  group('multi-child reminders', () {
    late FakeScheduler ln;
    late VaccineReminders reminders;
    ({String title, String body}) text(VaccineReminderSlot _) => (title: 't', body: 'b');
    setUp(() {
      ln = FakeScheduler();
      reminders = VaccineReminders(LocalStore.memory(), ln);
    });

    test('gives every child a stable block that never overlaps another child or the legacy range', () {
      final a = reminders.vaccineChildBase('a'), b = reminders.vaccineChildBase('b');
      expect(a, vaccineChildBaseId);
      expect(b, vaccineChildBaseId + vaccineChildStride);
      expect(reminders.vaccineChildBase('a'), a);
      expect(vaccineChildStride, greaterThanOrEqualTo(maxUpcoming + maxOverdue));
      expect(vaccineChildBaseId, greaterThanOrEqualTo(vaccineReminderBaseId + maxUpcoming + maxOverdue));
      final many = [for (var i = 0; i < 30; i++) dose('d${two(i)}', 'future', local(2026, 11, 15 + i))];
      final sa = vaccineReminderSlots(many, now, a!), sb = vaccineReminderSlots(many, now, b!);
      final ids = [...sa, ...sb].map((x) => x.id).toList();
      expect(ids.toSet().length, ids.length);
      expect(sa.map((x) => x.id).reduce((x, y) => x > y ? x : y), lessThan(b));
    });

    test('reuses a slot of a child that is no longer kept, and refuses when every block is taken', () {
      final ids = [for (var i = 0; i < maxReminderChildren; i++) 'c$i'];
      for (final id in ids) {
        reminders.vaccineChildBase(id, ids);
      }
      expect(reminders.vaccineChildBase('extra', ids), isNull);
      expect(reminders.vaccineChildBase('extra', ids.sublist(1)), vaccineChildBaseId);
    });

    test('schedules all children at app start without prompting, each in its own block', () async {
      final result = await reminders.refreshAll([
        ChildReminderPlan(childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text: text),
        ChildReminderPlan(childId: 'b', doses: [dose('y', 'future', local(2026, 11, 21))], text: text),
      ], now);
      expect(result, 'scheduled');
      expect(ln.permissionPrompts, 0);
      expect(ln.scheduledIds, [vaccineChildBaseId, vaccineChildBaseId + 1, vaccineChildBaseId + vaccineChildStride, vaccineChildBaseId + vaccineChildStride + 1]);
      expect(ln.namespaces['vaccine:$vaccineChildBaseId']![0].extra, {'type': 'vaccine_reminder', 'deeplink': vaccineDeeplink, 'dose': 'x'});
      // Rescheduling child a from the calendar leaves child b alone.
      ln.clear();
      await reminders.sync(const [], text, baseId: reminders.vaccineChildBase('a'));
      expect(ln.cancelledIds, isNot(contains(vaccineChildBaseId + vaccineChildStride)));
      expect(ln.cancelledIds, contains(vaccineChildBaseId));
      expect(ln.cancelledIds, contains(vaccineReminderBaseId));
    });

    test('does not ask for permission and schedules nothing when it is not granted', () async {
      ln.perm = 'prompt';
      final result = await reminders.refreshAll([ChildReminderPlan(childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text: text)], now);
      expect(result, 'denied');
      expect(ln.permissionPrompts, 0);
      expect(ln.scheduled, isEmpty);
    });

    test('cancels every block when the switch is off, and the blocks of children that are gone', () async {
      await reminders.refreshAll([
        ChildReminderPlan(childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text: text),
        ChildReminderPlan(childId: 'b', doses: [dose('y', 'future', local(2026, 11, 21))], text: text),
      ], now);
      ln.clear();
      await reminders.refreshAll([ChildReminderPlan(childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text: text)], now);
      expect(ln.cancelledIds, contains(vaccineChildBaseId + vaccineChildStride));
      expect(ln.scheduledIds, isEmpty);
      expect(ln.cancelledIds, isNot(contains(vaccineChildBaseId)));

      ln.clear();
      reminders.enabled = false;
      expect(await reminders.refreshAll([ChildReminderPlan(childId: 'a', doses: [dose('x', 'future', local(2026, 11, 20))], text: text)], now), 'cleared');
      expect(ln.scheduled, isEmpty);
      expect(ln.cancelledIds, contains(vaccineChildBaseId + (maxReminderChildren - 1) * vaccineChildStride));
      ln.clear();
      await reminders.cancelAll();
      expect(ln.cancelledIds, hasLength((maxReminderChildren + 1) * (maxUpcoming + maxOverdue)));
    });

    test('runs the app-start refresh once per stamp (account, day, language)', () {
      expect(reminders.refreshDue('u:2026-11-08:az'), isTrue);
      reminders.markRefresh('u:2026-11-08:az');
      expect(reminders.refreshDue('u:2026-11-08:az'), isFalse);
      expect(reminders.refreshDue('u:2026-11-09:az'), isTrue);
      expect(reminders.refreshDue('other:2026-11-08:az'), isTrue);
    });
  });
}
