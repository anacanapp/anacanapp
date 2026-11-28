// Ported from: the module singletons of src/lib/local-notification-scheduler.ts, src/lib/chat-notifications.ts,
//              src/hooks/useDeviceToken.ts, src/lib/push.ts, src/lib/logout-cleanup.ts (the steps it runs) and the
//              platform seams of src/lib/native.ts / src/lib/permissions.ts
//
// One provider per service, and [notificationServicesWiringOverrides]: the feature seams (docs/flutter/WIRING.md) implemented on
// these services, for `featureWiringOverrides()` in app/app_wiring.dart. The OS plugins are the four interfaces
// [localNotificationBackendProvider], [pushPlatformProvider], [notificationTapSourcesProvider] (taps, installed from
// `main()`) and [nativePermissionsProvider]: the plugin implementations inside the iOS / Android app
// ([isMobileHost]), React's web / no-plugin behaviour anywhere else (tests on a desktop host).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../core/auth/auth_controller.dart' show logoutCleanupStepsProvider;
import '../../core/data/db.dart' show dbProvider;
import '../../core/session/logout_cleanup.dart' show LogoutCleanupSteps;
import '../../features/baby/live_timer/live_timer.dart' show timerNotificationSchedulerProvider;
import '../../features/baby_chat/baby_chat_notifications.dart' show babyChatNotificationPlannerProvider;
import '../../features/chat/data/chat_push.dart' show chatPushSenderProvider;
import '../../features/chat/data/partner_messages.dart' show chatIncomingNotifierProvider;
import '../../features/health_screens/common/health_ports.dart' show illnessNotificationPermissionProvider, illnessReminderPlannerProvider;
import '../../features/home_flow/flow_platform.dart' show flowNotificationPlannerProvider;
import '../../features/onboarding/onboarding_ports.dart'
    show NotificationPermissionPort, notificationPermissionProvider, pushGrantedCallbackProvider;
import '../../features/settings/data/preferences.dart' show reminderSchedulerProvider;
import '../../features/tools/parenting/programme_ports.dart' show programmeNotificationsProvider;
import '../../features/tools/vaccines/vaccine_reminders.dart' show vaccineNotificationSchedulerProvider;
import '../../shell/nav/shell_controller.dart' show notificationTapQueueProvider, pushNavRouterProvider;
import '../../state/persisted_store.dart' show localStoreProvider;
import 'mobile_host.dart';
import 'native_platform.dart';
import '../notifications/chat_notifications.dart';
import '../notifications/flutter_local_notification_backend.dart';
import '../notifications/local_notification_backend.dart';
import '../notifications/local_notification_scheduler.dart';
import '../notifications/local_reminders.dart';
import '../notifications/notification_seams.dart';
import '../notifications/vaccine_reminders_at_start.dart';
import '../push/device_token.dart';
import '../push/firebase_push_platform.dart';
import '../push/notification_tap_listeners.dart';
import '../push/push_platform.dart';
import '../push/send_push.dart';

// ── Local notifications ──

/// The OS notification plugin: flutter_local_notifications in the app build, unavailable elsewhere (web, tests).
final localNotificationBackendProvider = Provider<LocalNotificationBackend>(
  (ref) => isMobileHost ? FlutterLocalNotificationBackend() : const UnavailableLocalNotificationBackend(),
  name: 'localNotificationBackendProvider',
);

final localNotificationSchedulerProvider = Provider<LocalNotificationScheduler>((ref) {
  final scheduler = LocalNotificationScheduler(store: ref.watch(localStoreProvider), backend: ref.watch(localNotificationBackendProvider));
  ref.onDispose(scheduler.dispose);
  return scheduler;
}, name: 'localNotificationSchedulerProvider');

final localRemindersProvider = Provider<LocalReminders>(
  (ref) => LocalReminders(ref.watch(localNotificationSchedulerProvider), isNative: ref.watch(nativePlatformProvider).isNative),
  name: 'localRemindersProvider',
);

final chatNotificationsProvider = Provider<ChatNotifications>(
  (ref) => ChatNotifications(store: ref.watch(localStoreProvider), scheduler: ref.watch(localNotificationSchedulerProvider)),
  name: 'chatNotificationsProvider',
);

final vaccineRefreshDepsProvider =
    Provider<VaccineRefreshDeps>((ref) => SupabaseVaccineRefreshDeps(ref.watch(dbProvider)), name: 'vaccineRefreshDepsProvider');

// ── Push ──

/// The remote-push plugins: Firebase Messaging in the app build, the web build (no push) elsewhere.
final pushPlatformProvider = Provider<PushPlatform>(
  (ref) => isMobileHost ? FirebasePushPlatform(platform: isIOSHost ? 'ios' : 'android') : const WebPushPlatform(),
  name: 'pushPlatformProvider',
);

final deviceTokenRepositoryProvider =
    Provider<DeviceTokenRepository>((ref) => SupabaseDeviceTokenRepository(ref.watch(dbProvider)), name: 'deviceTokenRepositoryProvider');

final deviceTokenServiceProvider = Provider<DeviceTokenService>((ref) {
  final scheduler = ref.watch(localNotificationSchedulerProvider);
  final service = DeviceTokenService(
    platform: ref.watch(pushPlatformProvider),
    repository: ref.watch(deviceTokenRepositoryProvider),
    store: ref.watch(localStoreProvider),
    bindLocalNotificationOwner: scheduler.bindOwner,
  );
  ref.onDispose(service.dispose);
  return service;
}, name: 'deviceTokenServiceProvider');

/// `FirebaseMessaging.checkPermissions()` / `requestPermissions()` for onboarding: throws when push is unavailable
/// (the onboarding records that as "unsupported", like the web build).
class PushPermissionPort implements NotificationPermissionPort {
  const PushPermissionPort(this.platform);
  final PushPlatform platform;

  @override
  Future<String> check() async {
    if (!platform.isNative) throw UnsupportedError('push messaging is not available');
    return platform.messaging.checkPermissions();
  }

  @override
  Future<String> request() async {
    if (!platform.isNative) throw UnsupportedError('push messaging is not available');
    return platform.messaging.requestPermissions();
  }
}

/// The logout privacy steps (src/lib/logout-cleanup.ts) on these services.
LogoutCleanupSteps servicesLogoutCleanupSteps(Ref ref) => LogoutCleanupSteps(
      cancelAllLocalNotifications: () async {
        final scheduler = ref.read(localNotificationSchedulerProvider);
        if (!scheduler.backend.isAvailable) return;
        await scheduler.reset();
      },
      dropQueuedNotificationTaps: () async {
        ref.read(notificationTapQueueProvider).clearQueued();
        ref.read(pushNavRouterProvider).consumePending();
      },
      unregisterDeviceForLogout: (userId, timeout) => ref.read(deviceTokenServiceProvider).unregisterDeviceForLogout(userId, timeout),
    );

/// The overrides for `featureWiringOverrides()` (app/app_wiring.dart): every notification / push seam on the services.
List<Override> notificationServicesWiringOverrides() => [
      // One process-wide tap queue: taps from boot wait for the shell across provider-scope restarts.
      notificationTapQueueProvider.overrideWithValue(processNotificationTapQueue),
      chatPushSenderProvider.overrideWith((ref) => ref.watch(contractPushSenderProvider)),
      chatIncomingNotifierProvider.overrideWith((ref) {
        final notifications = ref.watch(chatNotificationsProvider);
        return ({required String title, required String body, required int idSeed, String? userId}) =>
            notifications.notifyIncomingChatMessage(title: title, body: body, idSeed: idSeed, userId: userId);
      }),
      flowNotificationPlannerProvider.overrideWith((ref) => SchedulerFlowNotificationPlanner(ref.watch(localNotificationSchedulerProvider))),
      babyChatNotificationPlannerProvider.overrideWith((ref) => SchedulerFlowNotificationPlanner(ref.watch(localNotificationSchedulerProvider))),
      illnessReminderPlannerProvider.overrideWith((ref) => SchedulerFlowNotificationPlanner(ref.watch(localNotificationSchedulerProvider))),
      illnessNotificationPermissionProvider.overrideWith((ref) {
        final scheduler = ref.watch(localNotificationSchedulerProvider);
        return () => requestPermissionIfPrompt(scheduler);
      }),
      programmeNotificationsProvider.overrideWith((ref) => SchedulerProgrammeNotifications(ref.watch(localNotificationSchedulerProvider))),
      vaccineNotificationSchedulerProvider
          .overrideWith((ref) => SchedulerVaccineNotificationScheduler(ref.watch(localNotificationSchedulerProvider))),
      timerNotificationSchedulerProvider
          .overrideWith((ref) => SchedulerTimerNotificationScheduler(ref.watch(localNotificationSchedulerProvider))),
      reminderSchedulerProvider.overrideWith((ref) => SchedulerReminderScheduler(ref.watch(localRemindersProvider))),
      notificationPermissionProvider.overrideWith((ref) => PushPermissionPort(ref.watch(pushPlatformProvider))),
      pushGrantedCallbackProvider.overrideWith((ref) => () => ref.read(deviceTokenServiceProvider).pushGranted()),
      logoutCleanupStepsProvider.overrideWith(servicesLogoutCleanupSteps),
    ];
