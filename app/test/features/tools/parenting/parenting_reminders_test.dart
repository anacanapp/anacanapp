// Ported from: src/lib/parenting-reminders.test.ts
// The Capacitor LocalNotifications mock is a recording ProgrammeNotifications; the permission / web checks belong to
// the app-wide scheduler behind that seam (phase 9), so the "denied / web" half of the last case is not portable.
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/parenting/parenting.dart' show ProgrammeProgress;
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_reminders.dart';
import 'package:anacan/features/tools/parenting/parenting_store.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

final DateTime now = DateTime(2026, 11, 7, 10, 0); // Saturday 10:00 local
const String today = '2026-11-07';
final ParentingContent az = contentOf('az');

ParentingLocal state({Map<String, ProgrammeProgress> programmes = const {}, ReminderPref reminder = const ReminderPref(on: true, time: '20:30')}) =>
    emptyParenting().copyState(programmes: programmes, reminder: reminder);

Map<String, ProgrammeProgress> running(List<String> done, {bool? paused}) =>
    {'sleep-7': ProgrammeProgress(startedAt: '2026-11-05', done: done, updatedAt: '2026-11-06T09:00:00.000Z', paused: paused)};

List<ReminderSlot> slots(ParentingLocal s, {bool allowed = true, DateTime? at, bool isPremium = true}) =>
    reminderSlots(state: s, programmes: az.programmes, allowed: allowed, isPremium: isPremium, now: at ?? now, today: today);

List<int> days(List<ReminderSlot> l) => [for (final s in l) s.dayIndex];

void main() {
  setUp(() => DomainClock.setSystemTime(now));
  tearDown(DomainClock.reset);

  group('Tərbiyə programme reminders: what to schedule', () {
    test('schedules today at the chosen time and the next days, one step a day, up to the end of the programme', () {
      final list = slots(state(programmes: running(['2026-11-05', '2026-11-06'])));
      expect(days(list), [2, 3, 4, 5, 6]);
      expect(list[0].at, DateTime(2026, 11, 7, 20, 30));
      expect(list[1].at, DateTime(2026, 11, 8, 20, 30));
      expect(list.map((s) => s.id).toSet().length, list.length);
    });

    test('starts tomorrow when today’s step is done or the time has passed; honours the chosen time', () {
      expect(slots(state(programmes: running(['2026-11-06', today])))[0].at, DateTime(2026, 11, 8, 20, 30));
      expect(slots(state(programmes: running([])), at: DateTime(2026, 11, 7, 21, 0))[0].at, DateTime(2026, 11, 8, 20, 30));
      expect(slots(state(programmes: running([]), reminder: const ReminderPref(on: true, time: '07:15')))[0].at, DateTime(2026, 11, 8, 7, 15));
    });

    test('schedules nothing when off, finished, paused, not allowed (switch / Premium) or without a programme', () {
      expect(slots(state(programmes: running([]), reminder: const ReminderPref(on: false, time: '20:30'))), isEmpty);
      expect(slots(state(programmes: running([for (var i = 0; i < 7; i++) '2026-10-2$i']))), isEmpty);
      expect(slots(state(programmes: running([], paused: true))), isEmpty);
      expect(slots(state(programmes: running([])), allowed: false), isEmpty);
      expect(slots(state()), isEmpty);
    });

    test('follows the most recently changed running programme', () {
      final s = state(programmes: {
        'sleep-7': const ProgrammeProgress(startedAt: '2026-11-01', done: [], updatedAt: '2026-11-01T08:00:00.000Z'),
        'tantrums-14': const ProgrammeProgress(startedAt: '2026-11-02', done: ['2026-11-02'], updatedAt: '2026-11-06T08:00:00.000Z'),
      });
      expect(activeProgramme(s, az.programmes)?.programme.id, 'tantrums-14');
      expect(slots(s).every((x) => x.programmeId == 'tantrums-14'), true);
      expect(slots(s), hasLength(7));
      expect(slotsKey(const []), 'none');
    });
  });

  group('Tərbiyə programme reminders: free users get the free days', () {
    test('schedules only the free days (1–3) for a free user and stops after them', () {
      expect(days(slots(state(programmes: running([])), isPremium: false)), [0, 1, 2]);
      expect(days(slots(state(programmes: running(['2026-11-05'])), isPremium: false)), [1, 2]);
      expect(days(slots(state(programmes: running(['2026-11-05', '2026-11-06'])), isPremium: false)), [2]);
      expect(slots(state(programmes: running(['2026-11-04', '2026-11-05', '2026-11-06'])), isPremium: false), isEmpty);
    });

    test('keeps every day for Premium and nothing when the switch is off or the preference is off', () {
      expect(days(slots(state(programmes: running([])), isPremium: true)), [0, 1, 2, 3, 4, 5, 6]);
      expect(slots(state(programmes: running([])), isPremium: false, allowed: false), isEmpty);
      expect(slots(state(programmes: running([]), reminder: const ReminderPref(on: false, time: '20:30')), isPremium: false), isEmpty);
    });

    test('offers the reminder switch to free users while the next step is a free day', () {
      expect([for (final d in [0, 1, 2, 3]) canRemindDay(d, false)], [true, true, true, false]);
      expect(canRemindDay(10, true), true);
    });
  });

  group('Tərbiyə programme reminders: native scheduling', () {
    ({String title, String body}) text(ReminderSlot _) => (title: 'T', body: 'B');

    test('cancels every earlier reminder, then schedules the new list with a tap target', () async {
      final n = RecordingNotifications();
      final list = slots(state(programmes: running([])));
      await syncParentingReminders(n, list, text, partner: true);
      expect(n.calls, hasLength(1));
      expect(n.calls.single.cancelIds, parentingReminderIds);
      expect(parentingReminderIds, [for (var i = 882200; i <= 882207; i++) i]);
      final scheduled = n.calls.single.items;
      expect(scheduled, hasLength(list.length));
      expect(scheduled[0].extra, {'type': 'parenting_programme', 'partner': '1', 'programme': list[0].programmeId});
      expect(intentFromPushData(scheduled[0].extra!), const PushNavIntent(screen: 'partner-parenting'));
      expect(intentFromPushData({'type': 'parenting_programme', 'partner': '0'}), const PushNavIntent(tool: 'parenting'));
    });

    test('only cancels for an empty list, and does nothing on the web or without permission', () async {
      final n = RecordingNotifications();
      await syncParentingReminders(n, const [], text);
      expect(n.calls.single.items, isEmpty);
      expect(n.calls.single.cancelIds, parentingReminderIds);
    });

    test('keepParentingReminders re-schedules only when the planned list changes (useParentingReminders)', () async {
      final h = ProgrammeHarness();
      final s = state(programmes: running([]));
      void keep({bool? allowed = true, bool? premium = true, List<Programme>? programmes}) => keepParentingReminders(
          store: h.store, scheduler: h.notifications, state: s, programmes: programmes ?? az.programmes, allowed: allowed, isPremium: premium);
      keep(allowed: null);
      keep(premium: null);
      expect(h.notifications.calls, isEmpty);
      keep();
      keep();
      await Future<void>.delayed(Duration.zero);
      expect(h.notifications.calls, hasLength(1));
      final first = h.notifications.last('parenting').first;
      expect(first.id, 882200);
      expect(first.title, isNotEmpty);
      keep(allowed: false);
      await Future<void>.delayed(Duration.zero);
      expect(h.notifications.calls, hasLength(2));
      expect(h.notifications.calls.last.items, isEmpty);
    });
  });
}
