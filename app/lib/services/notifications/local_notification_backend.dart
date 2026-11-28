// Ported from: src/lib/local-notification-scheduler.ts (the `@capacitor/local-notifications` calls: loadPlugin,
//              checkPermissions / requestPermissions, getPending, schedule (toNative), cancel,
//              removeAllDeliveredNotifications), src/lib/native.ts (localNotifications.checkPermissions)
//
// The OS side of on-device notifications, kept narrow so the scheduler, its tests and every feature seam are pure
// Dart. The default [UnavailableLocalNotificationBackend] is React's web / no-plugin branch (`loadPlugin()` → null):
// nothing is scheduled and every caller sees "unavailable". The native step implements this interface with
// `flutter_local_notifications` (+ `timezone` for `zonedSchedule`, the daily `matchDateTimeComponents.time` repeat
// and exact/inexact alarms on Android).

/// Notification permission as Capacitor reports `display`: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'.
typedef NotificationDisplay = String;

/// When an OS notification fires (`schedule` of the Capacitor payload).
sealed class NativeNotificationSchedule {
  const NativeNotificationSchedule();
}

/// `{ at, allowWhileIdle: true }`: once at [at].
class NativeScheduleAt extends NativeNotificationSchedule {
  const NativeScheduleAt(this.at);
  final DateTime at;
  @override
  bool operator ==(Object other) => other is NativeScheduleAt && other.at == at;
  @override
  int get hashCode => at.hashCode;
  @override
  String toString() => 'at($at)';
}

/// `{ on: { hour, minute }, repeats: true, allowWhileIdle: true }`: every day at this local time.
class NativeScheduleDaily extends NativeNotificationSchedule {
  const NativeScheduleDaily({required this.hour, required this.minute});
  final int hour;
  final int minute;
  @override
  bool operator ==(Object other) => other is NativeScheduleDaily && other.hour == hour && other.minute == minute;
  @override
  int get hashCode => Object.hash(hour, minute);
  @override
  String toString() => 'daily($hour:$minute)';
}

/// One notification handed to the OS. [schedule] null = show it now (`notifyNow`).
class NativeLocalNotification {
  const NativeLocalNotification({
    required this.id,
    required this.title,
    required this.body,
    this.schedule,
    this.extra,
    this.smallIcon,
    this.channelId,
    this.ongoing,
    this.autoCancel,
  });
  final int id;
  final String title;
  final String body;
  final NativeNotificationSchedule? schedule;

  /// Tap payload (`extra`); a tap with `type` / `deeplink` is routed (`localTapData`).
  final Map<String, Object?>? extra;
  final String? smallIcon;
  final String? channelId;

  /// Android ongoing / auto-cancel flags of the timer fallback notification.
  final bool? ongoing;
  final bool? autoCancel;

  @override
  String toString() => 'NativeLocalNotification($id, $title, $schedule)';
}

/// The local-notification plugin. Every method may throw (a failing bridge); the scheduler handles it like React.
abstract interface class LocalNotificationBackend {
  /// `Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')`.
  bool get isAvailable;

  /// `checkPermissions().display`.
  Future<NotificationDisplay> checkDisplay();

  /// `requestPermissions().display` (shows the OS prompt).
  Future<NotificationDisplay> requestDisplay();

  /// Ids of the notifications pending in the OS (`getPending()`).
  Future<List<int>> pendingIds();

  /// `schedule({ notifications })`: an existing id is replaced.
  Future<void> schedule(List<NativeLocalNotification> notifications);

  /// `cancel({ notifications: ids })`.
  Future<void> cancel(List<int> ids);

  /// `removeAllDeliveredNotifications()`.
  Future<void> removeAllDelivered();
}

/// Web / no plugin: nothing is available (the scheduler never calls the other members).
class UnavailableLocalNotificationBackend implements LocalNotificationBackend {
  const UnavailableLocalNotificationBackend();
  @override
  bool get isAvailable => false;
  @override
  Future<NotificationDisplay> checkDisplay() => Future.error(UnsupportedError('local notifications are not available'));
  @override
  Future<NotificationDisplay> requestDisplay() => Future.error(UnsupportedError('local notifications are not available'));
  @override
  Future<List<int>> pendingIds() async => const [];
  @override
  Future<void> schedule(List<NativeLocalNotification> notifications) async {}
  @override
  Future<void> cancel(List<int> ids) async {}
  @override
  Future<void> removeAllDelivered() async {}
}
