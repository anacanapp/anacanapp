// Ported from: src/lib/weaning-reminders.ts
//
// Premium: a local notification at 09:00 on the first day of each upcoming weaning step (this phone only). Ids
// 881100–881111 (namespace 'weaning'); delivery goes through [ProgrammeNotifications] (phase 9 scheduler).
import '../../../domain/js_compat.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../domain/weaning/weaning.dart';
import '../parenting/programme_ports.dart' show ProgrammeNotifications;

const int weaningReminderBaseId = 881100;

/// A plan has at most 10 steps (1 morning + 4 day + 1 nap + 3 night + 1 bedtime).
final List<int> weaningReminderIds = [for (var i = 0; i < 12; i++) weaningReminderBaseId + i];

/// The notifications that should be pending now (pure).
List<StoredNotification> weaningReminderItems(WeaningPlan? plan, bool enabled, ({String title, String Function(WeaningStep step) body}) text, DateTime now) {
  final due = enabled && plan != null ? reminderDays(plan, now) : const <({WeaningStep step, DateTime at})>[];
  return [
    for (final d in due)
      StoredNotification(id: weaningReminderBaseId + plan!.steps.indexOf(d.step), title: text.title, body: text.body(d.step), at: d.at.millisecondsSinceEpoch),
  ];
}

Future<void> syncWeaningReminders(
  ProgrammeNotifications scheduler,
  WeaningPlan? plan,
  bool enabled,
  ({String title, String Function(WeaningStep step) body}) text, [
  DateTime? now,
]) async {
  try {
    await scheduler.setLocalNotifications('weaning', weaningReminderItems(plan, enabled, text, now ?? DomainClock.now()),
        ask: true, cancelIds: weaningReminderIds);
  } catch (_) {
    // Reminders are a convenience; the plan screen still shows today's step.
  }
}
