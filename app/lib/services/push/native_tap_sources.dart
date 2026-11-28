// Ported from: src/lib/notification-taps.ts (the FirebaseMessaging `notificationActionPerformed` and
//              LocalNotifications `localNotificationActionPerformed` listeners)
//
// The tap streams of the app build: Firebase Messaging (background / terminated taps, data payload) and
// flutter_local_notifications (the reminder's `extra`). No Capacitor push fallback exists in this build.
import '../notifications/flutter_local_notification_backend.dart' show LocalNotificationsRuntime;
import 'firebase_push_platform.dart' show FirebaseRuntime;
import 'notification_tap_listeners.dart';

class NativeNotificationTapSources implements NotificationTapSources {
  const NativeNotificationTapSources();
  @override
  bool get isNative => true;
  @override
  Stream<Object?>? get messagingTaps => FirebaseRuntime.instance.taps;
  @override
  Stream<Object?>? get pushFallbackTaps => null;
  @override
  Stream<Object?>? get localTaps => LocalNotificationsRuntime.instance.taps;
}
