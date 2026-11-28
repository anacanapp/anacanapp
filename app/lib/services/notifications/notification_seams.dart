// Ported from: src/lib/local-notification-scheduler.ts (setLocalNotifications / clearLocalNotificationNamespaces /
//              notifyNow / cancelLocalNotificationIds as each feature calls them), src/lib/nap-alerts.ts
//              (requestNapAlertPermission), src/components/illness/IllnessSheets.tsx (MedSheet's permission request
//              when a dose reminder is on), src/lib/native.ts (localNotifications for the settings screen)
//
// The features' notification seams (WIRING.md) implemented on the central scheduler. "Native" here means "the
// local-notification plugin is available" ([LocalNotificationBackend.isAvailable]): until the native backend is
// wired, every seam keeps React's web behaviour (no reminder switch, nothing scheduled).
import '../../features/baby/live_timer/timer_notifications.dart' show TimerNotificationScheduler;
import '../../features/home_flow/flow_platform.dart' show FlowNotificationPlanner;
import '../../features/settings/data/preferences.dart' show DesiredNotification, ReminderScheduler;
import '../../features/tools/parenting/programme_ports.dart' show ProgrammeNotifications;
import '../../features/tools/vaccines/vaccine_reminders.dart' show VaccineNotificationScheduler, VaccineReminderResult;
import 'local_notification_scheduler.dart';
import 'local_reminders.dart';

/// `FlowNotificationPlanner` (flow home, baby chat, illness dose reminders).
class SchedulerFlowNotificationPlanner implements FlowNotificationPlanner {
  const SchedulerFlowNotificationPlanner(this.scheduler);
  final LocalNotificationScheduler scheduler;

  @override
  bool get isNativePlatform => scheduler.backend.isAvailable;

  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) =>
      scheduler.setLocalNotifications(namespace, items, ask: ask, cancelIds: cancelIds);
}

/// `requestNapAlertPermission()`: true when notifications may be shown (asks when not yet granted).
Future<bool> requestLocalNotificationPermission(LocalNotificationScheduler scheduler) async {
  try {
    if (!scheduler.backend.isAvailable) return false;
    if (await scheduler.backend.checkDisplay() == 'granted') return true;
    return await scheduler.backend.requestDisplay() == 'granted';
  } catch (_) {
    return false;
  }
}

/// MedSheet: `checkPermissions()`, and `requestPermissions()` only while the OS would still prompt.
Future<void> requestPermissionIfPrompt(LocalNotificationScheduler scheduler) async {
  try {
    if (!scheduler.backend.isAvailable) return;
    final p = await scheduler.backend.checkDisplay();
    if (p == 'prompt' || p == 'prompt-with-rationale') await scheduler.backend.requestDisplay();
  } catch (_) {
    // web / no plugin
  }
}

/// The programme tools (nap alerts, weaning, Tərbiyə).
class SchedulerProgrammeNotifications implements ProgrammeNotifications {
  const SchedulerProgrammeNotifications(this.scheduler);
  final LocalNotificationScheduler scheduler;

  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) async {
    try {
      await scheduler.setLocalNotifications(namespace, items, ask: ask, cancelIds: cancelIds);
    } catch (_) {
      // best effort
    }
  }

  @override
  Future<bool> requestPermission() => requestLocalNotificationPermission(scheduler);
}

/// The vaccine reminders (`vaccine:<block>` namespaces).
class SchedulerVaccineNotificationScheduler implements VaccineNotificationScheduler {
  const SchedulerVaccineNotificationScheduler(this.scheduler);
  final LocalNotificationScheduler scheduler;

  @override
  bool get isNativePlatform => scheduler.backend.isAvailable;

  @override
  Future<VaccineReminderResult> setLocalNotifications(String namespace, List<StoredNotification> items,
          {bool ask = true, List<int> cancelIds = const []}) =>
      scheduler.setLocalNotifications(namespace, items, ask: ask, cancelIds: cancelIds);

  @override
  Future<void> clearLocalNotificationNamespaces(String prefix, List<int> ids) => scheduler.clearNamespaces(prefix, ids);
}

/// The live-timer fallback notification (`notifyNow` / `cancelLocalNotificationIds`).
class SchedulerTimerNotificationScheduler implements TimerNotificationScheduler {
  const SchedulerTimerNotificationScheduler(this.scheduler);
  final LocalNotificationScheduler scheduler;

  @override
  Future<void> notifyNow({
    required int id,
    required String title,
    required String body,
    bool ongoing = true,
    bool autoCancel = false,
    String smallIcon = 'ic_stat_icon',
    bool ask = true,
  }) =>
      scheduler.notifyNow(id: id, title: title, body: body, ongoing: ongoing, autoCancel: autoCancel, smallIcon: smallIcon, ask: ask);

  @override
  Future<void> cancelIds(List<int> ids) => scheduler.cancelIds(ids);
}

/// The settings screen's reminders (water, vitamin, exercise, "all off").
class SchedulerReminderScheduler implements ReminderScheduler {
  SchedulerReminderScheduler(this.reminders);
  final LocalReminders reminders;
  LocalNotificationScheduler get _scheduler => reminders.scheduler;

  @override
  Future<void> scheduleWaterReminder({bool ask = false}) => reminders.scheduleWaterReminder(ask: ask);

  @override
  Future<void> cancelWaterReminders() => reminders.cancelWaterReminders();

  @override
  Future<void> cancelAll() => reminders.cancelAll();

  @override
  Future<void> setLocalNotifications(String group, List<DesiredNotification> list, {bool ask = false, List<int>? cancelIds}) =>
      _scheduler.setLocalNotifications(
        group,
        [
          for (final n in list)
            StoredNotification(id: n.id, title: n.title, body: n.body, at: n.at.millisecondsSinceEpoch, repeat: n.repeat),
        ],
        ask: ask,
        cancelIds: cancelIds ?? const [],
      );

  @override
  Future<String> displayPermission() => reminders.checkPermissions();
}
