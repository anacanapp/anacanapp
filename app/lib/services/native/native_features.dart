// Ported from: src/lib/native.ts (pushNotifications.register, pushNotifications.addListeners,
//              initializeNativeFeatures)
//
// What the app does once at start inside the native app: status bar style (already done by app/system_chrome.dart),
// the silent push check (never prompts), the daily water reminder when its switch is on, and the reminder
// re-planner (now and on every return to the foreground).
import 'package:flutter/foundation.dart';

import '../../state/local_store.dart';
import '../notifications/local_notification_scheduler.dart';
import '../notifications/local_reminders.dart';
import '../push/push_platform.dart';

/// `VITE_ANDROID_PUSH_AUTO_REGISTER=true` → `--dart-define=ANDROID_PUSH_AUTO_REGISTER=true`. Android push
/// auto-registration at start stays off by default (a missing google-services.json made `register()` crash).
const bool androidPushAutoRegister = bool.fromEnvironment('ANDROID_PUSH_AUTO_REGISTER');

/// LocalStore mirror of the water switch (useNotificationSettings writes it).
const String waterReminderEnabledKey = 'anacan_water_reminder_enabled';

/// `pushNotifications.register()`: never prompts (cold start, before onboarding); a device that already allowed
/// gets its FCM token (registration in `device_tokens` is the device-token service's job).
Future<void> registerPushAtStart(PushPlatform push, {bool autoRegisterOnAndroid = androidPushAutoRegister}) async {
  if (!push.isNative) return;
  if (push.platform == 'android' && !autoRegisterOnAndroid) {
    debugPrint('Android push auto-register deaktivdir (Firebase qurulmayıb ola bilər). '
        'Aktiv etmək üçün: --dart-define=ANDROID_PUSH_AUTO_REGISTER=true');
    return;
  }
  try {
    final permission = await push.messaging.checkPermissions();
    if (permission != 'granted') {
      debugPrint('Push notification permission not granted');
      return;
    }
    final token = await push.messaging.getToken() ?? '';
    debugPrint('Firebase Messaging token obtained: ${token.substring(0, token.length < 30 ? token.length : 30)}...');
  } catch (error) {
    debugPrint('Firebase Messaging not available, falling back to PushNotifications: $error');
    try {
      final fallback = push.fallback;
      if (fallback == null) throw StateError('push fallback is not available');
      if (await fallback.checkPermissions() != 'granted') {
        debugPrint('Push notification permission not granted');
        return;
      }
      // `register()`; the token arrives on the fallback's listeners.
      fallback.register().then((_) {}, onError: (Object e) => debugPrint('Registration error: $e'));
    } catch (fallbackError) {
      debugPrint('Push notification registration failed: $fallbackError');
    }
  }
}

/// `initializeNativeFeatures()`.
Future<void> initializeNativeFeatures({
  required bool isNative,
  required PushPlatform push,
  required LocalStore store,
  required LocalReminders reminders,
  required LocalNotificationScheduler scheduler,
  Future<void> Function()? setStatusBarDark,
  AppResumeListen? listenResume,
  bool autoRegisterOnAndroid = androidPushAutoRegister,
}) async {
  if (!isNative) {
    debugPrint('Running in web mode - native features disabled');
    return;
  }
  await setStatusBarDark?.call();
  await registerPushAtStart(push, autoRegisterOnAndroid: autoRegisterOnAndroid);
  // Default reminders respect the persisted switch.
  var waterEnabled = true;
  try {
    waterEnabled = store.getItem(waterReminderEnabledKey) != 'false';
  } catch (_) {
    // ignore storage errors
  }
  if (waterEnabled) await reminders.scheduleWaterReminder();
  // Re-plan the nearest pending reminders now and on every return to the foreground.
  scheduler.installReplanner(isNative: isNative, listen: listenResume);
}
