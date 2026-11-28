// Ported from: src/lib/native.ts (localNotifications: checkPermissions, requestPermissions, cancelWaterReminders,
//              scheduleWaterReminder, schedulePillReminder, cancelAll; WATER_NOTIFICATION_ID / WATER_IDS)
//
// The device-level daily reminders of the settings screen, through the central scheduler. Scheduling never prompts
// unless [ask] is set from a user action.
import '../../core/i18n/tr.dart';
import 'local_notification_scheduler.dart';

/// Single stable id of the daily water reminder.
const int waterNotificationId = 101;

/// The current id + the legacy every-2-hours ids 108..120.
const List<int> waterNotificationIds = [waterNotificationId, 108, 110, 112, 114, 116, 118, 120];

/// Id of the daily vitamin reminder.
const int pillNotificationId = 200;

class LocalReminders {
  LocalReminders(this.scheduler, {required this.isNative, DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  final LocalNotificationScheduler scheduler;

  /// `isNative` of lib/native.ts.
  final bool isNative;
  final DateTime Function() _clock;

  /// `localNotifications.checkPermissions().display` ('granted' off native, like the web build).
  Future<String> checkPermissions() async {
    if (!isNative || !scheduler.backend.isAvailable) return 'granted';
    return scheduler.backend.checkDisplay();
  }

  Future<String> requestPermissions() async {
    if (!isNative || !scheduler.backend.isAvailable) return 'granted';
    return scheduler.backend.requestDisplay();
  }

  /// Cancels every pending water reminder (current id + the legacy ids).
  Future<void> cancelWaterReminders() async {
    if (!isNative) return;
    await scheduler.setLocalNotifications('water', const [], cancelIds: waterNotificationIds);
  }

  /// Exactly one water reminder a day at 10:00 (repeats daily); legacy every-2-hours reminders are cancelled.
  Future<void> scheduleWaterReminder({bool ask = false}) async {
    if (!isNative) return;
    final now = _clock();
    final at = DateTime(now.year, now.month, now.day, 10);
    await scheduler.setLocalNotifications(
      'water',
      [
        StoredNotification(
          id: waterNotificationId,
          title: tr('notifications_water_daily_title', 'Su vaxtı! 💧'),
          body: tr('notifications_water_daily_body', 'Gündə ən azı 8 stəkan su içməyi unutmayın.'),
          at: at.millisecondsSinceEpoch,
          repeat: 'day',
        ),
      ],
      cancelIds: waterNotificationIds,
      ask: ask,
    );
  }

  /// Daily vitamin reminder at the local time of [time] (id 200).
  Future<void> schedulePillReminder(DateTime time, {bool ask = false}) async {
    if (!isNative) return;
    await scheduler.setLocalNotifications(
      'vitamin',
      [
        StoredNotification(
          id: pillNotificationId,
          title: tr('native_vitamin_vaxti_9bfc40', 'Vitamin vaxtı! 💊'),
          body: tr('native_gundelik_vitaminlerinizi_qebul_6a3811', 'Gündəlik vitaminlərinizi qəbul etməyi unutmayın.'),
          at: time.millisecondsSinceEpoch,
          repeat: 'day',
        ),
      ],
      ask: ask,
    );
  }

  /// "All notifications off" / logout: forget and cancel everything.
  Future<void> cancelAll() async {
    if (!isNative) return;
    await scheduler.reset();
  }
}
