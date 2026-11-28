// Ported from: src/lib/parenting-reminders.ts, src/components/tools/parenting/useParentingReminders.ts
//
// Tərbiyə programme reminders (this phone only): one local notification a day at the parent's chosen time (default
// 20:30) while a programme runs. Free users get them for the free programme days (1–3) only; Premium for every
// day. Nothing is scheduled — and everything already scheduled is cancelled — when the preference is off, the
// programme is finished or paused, the admin switch / content is gone, or a free user reached the Premium days. The
// next 7 days are scheduled. Ids 882200–882207 (namespace 'parenting').
import 'dart:async';

import '../../../domain/js_compat.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../domain/parenting/parenting.dart' show ProgrammeProgress, freeProgrammeDays, isFinished, isoDay;
import '../../../state/local_store.dart';
import 'parenting_content.dart' show Programme;
import 'parenting_copy.dart';
import 'parenting_store.dart';
import 'programme_ports.dart' show ProgrammeNotifications;

const int parentingReminderBaseId = 882200;
const int reminderDays = 7;
final List<int> parentingReminderIds = [for (var i = 0; i <= reminderDays; i++) parentingReminderBaseId + i];

class ReminderSlot {
  const ReminderSlot({required this.id, required this.at, required this.programmeId, required this.dayIndex});
  final int id;
  final DateTime at;
  final String programmeId;

  /// 0-based programme day the reminder is about.
  final int dayIndex;
}

/// The running programme reminders follow: not finished, not paused; the most recently changed one over every
/// child's programmes.
({Programme programme, ProgrammeProgress progress, String? childId})? activeProgramme(ParentingLocal state, List<Programme> programmes) {
  ({Programme programme, ProgrammeProgress progress, String? childId})? best;
  for (final x in allSlots(state)) {
    for (final programme in programmes) {
      final progress = x.slot.programmes[programme.id];
      if (progress == null || progress.paused == true || isFinished(progress, programme.days.length)) continue;
      if (best == null || progress.updatedAt.compareTo(best.progress.updatedAt) > 0) best = (programme: programme, progress: progress, childId: x.childId);
    }
  }
  return best;
}

DateTime _atTime(DateTime base, String time, int addDays) {
  final parts = (RegExp(r'^\d{2}:\d{2}$').hasMatch(time) ? time : defaultReminderTime).split(':').map(int.parse).toList();
  return DateTime(base.year, base.month, base.day + addDays, parts[0], parts[1]);
}

/// Which reminders should exist now. Today is included only while today's step is still open and the time has not
/// passed; each following day reminds about the next step.
List<ReminderSlot> reminderSlots({
  required ParentingLocal state,
  required List<Programme> programmes,
  required bool allowed,
  bool? isPremium,
  DateTime? now,
  required String today,
}) {
  if (!allowed || state.reminder?.on != true) return const [];
  final active = activeProgramme(state, programmes);
  if (active == null) return const [];
  final at = now ?? DomainClock.now();
  final total = active.programme.days.length;
  final next = active.progress.done.length;
  final doneToday = active.progress.done.isNotEmpty && active.progress.done.last == today;
  final time = state.reminder!.time.isNotEmpty ? state.reminder!.time : defaultReminderTime;
  final startToday = !doneToday && _atTime(at, time, 0).isAfter(at);
  final slots = <ReminderSlot>[];
  for (var k = 0; slots.length < reminderDays; k++) {
    final dayIndex = next + k;
    if (dayIndex >= total) break;
    if (isPremium == false && dayIndex >= freeProgrammeDays) break; // free users: the free days only
    slots.add(ReminderSlot(id: parentingReminderBaseId + slots.length, at: _atTime(at, time, startToday ? k : k + 1), programmeId: active.programme.id, dayIndex: dayIndex));
  }
  return slots;
}

/// Stable key: re-schedule only when the planned reminders change.
String slotsKey(List<ReminderSlot> slots) {
  final key = slots.map((s) => '${s.programmeId}:${s.dayIndex}@${s.at.millisecondsSinceEpoch}').join('|');
  return key.isEmpty ? 'none' : key;
}

/// Whether the reminder switch is offered for a programme whose next step is [nextDay] (0-based).
bool canRemindDay(int nextDay, bool isPremium) => isPremium || nextDay < freeProgrammeDays;

/// The notifications for [slots] with their tap target (`parenting_programme` push type).
List<StoredNotification> parentingReminderItems(List<ReminderSlot> slots, ({String title, String body}) Function(ReminderSlot slot) text, {bool partner = false}) => [
      for (final s in slots)
        () {
          final t = text(s);
          return StoredNotification(
            id: s.id,
            title: t.title,
            body: t.body,
            at: s.at.millisecondsSinceEpoch,
            extra: {'type': 'parenting_programme', 'partner': partner ? '1' : '0', 'programme': s.programmeId},
          );
        }(),
    ];

/// Replace this phone's Tərbiyə reminders with [slots] (empty = cancel all). Never throws.
Future<void> syncParentingReminders(ProgrammeNotifications scheduler, List<ReminderSlot> slots, ({String title, String body}) Function(ReminderSlot slot) text,
    {bool partner = false}) async {
  try {
    await scheduler.setLocalNotifications('parenting', parentingReminderItems(slots, text, partner: partner), ask: true, cancelIds: parentingReminderIds);
  } catch (_) {}
}

const String _lastKey = 'anacan.parenting.reminders.v1';

/// `useParentingReminders`: keeps this phone's Tərbiyə reminders in line with the state. [allowed] / [isPremium]
/// null = still unknown → nothing changes; [programmes] null = content still loading → nothing changes.
void keepParentingReminders({
  required LocalStore store,
  required ProgrammeNotifications scheduler,
  required ParentingLocal state,
  required List<Programme>? programmes,
  required bool? allowed,
  required bool? isPremium,
  bool partner = false,
  DateTime? now,
}) {
  List<ReminderSlot>? slots;
  if (allowed == null) return;
  if (!allowed) {
    slots = const [];
  } else {
    if (isPremium == null || programmes == null) return;
    final at = now ?? DomainClock.now();
    slots = reminderSlots(state: state, programmes: programmes, allowed: allowed, isPremium: isPremium, now: at, today: isoDay(at));
  }
  final key = slotsKey(slots);
  String last;
  try {
    last = store.getItem(_lastKey) ?? 'none';
  } catch (_) {
    last = 'none';
  }
  if (key == last) return; // already scheduled exactly so (or nothing to cancel)
  try {
    store.setItem(_lastKey, key);
  } catch (_) {}
  final list = programmes ?? const <Programme>[];
  unawaited(syncParentingReminders(scheduler, slots, (slot) {
    Programme? programme;
    for (final p in list) {
      if (p.id == slot.programmeId) programme = p;
    }
    final day = programme != null && slot.dayIndex < programme.days.length ? programme.days[slot.dayIndex] : null;
    return (
      title: pf('par_notif_title', {'programme': programme?.title ?? ''}),
      body: pf('par_notif_body', {'n': slot.dayIndex + 1, 'task': day?.title ?? ''}),
    );
  }, partner: partner));
}
