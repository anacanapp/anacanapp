// Covers notificationServicesWiringOverrides(): every seam resolves on the services with the web defaults, and the
// logout steps of src/lib/logout-cleanup.ts.
import 'package:anacan/core/auth/auth_controller.dart' show logoutCleanupStepsProvider;
import 'package:anacan/features/baby/live_timer/live_timer.dart' show timerNotificationSchedulerProvider;
import 'package:anacan/features/baby_chat/baby_chat_notifications.dart' show babyChatNotificationPlannerProvider;
import 'package:anacan/features/chat/data/chat_push.dart' show chatPushSenderProvider;
import 'package:anacan/features/chat/data/partner_messages.dart' show chatIncomingNotifierProvider;
import 'package:anacan/features/health_screens/common/health_ports.dart' show illnessNotificationPermissionProvider, illnessReminderPlannerProvider;
import 'package:anacan/features/home_flow/flow_platform.dart' show flowNotificationPlannerProvider;
import 'package:anacan/features/onboarding/onboarding_ports.dart' show notificationPermissionProvider, pushGrantedCallbackProvider;
import 'package:anacan/features/settings/data/preferences.dart' show reminderSchedulerProvider;
import 'package:anacan/features/tools/parenting/programme_ports.dart' show programmeNotificationsProvider;
import 'package:anacan/features/tools/vaccines/vaccine_reminders.dart' show vaccineNotificationSchedulerProvider;
import 'package:anacan/services/native/services_wiring.dart';
import 'package:anacan/services/notifications/chat_notifications.dart' show chatNotificationIdBase;
import 'package:anacan/services/notifications/notification_seams.dart';
import 'package:anacan/services/push/device_token.dart' show DeviceTokenUser;
import 'package:anacan/services/push/notification_tap_listeners.dart';
import 'package:anacan/services/push/send_push.dart';
import 'package:anacan/shell/nav/shell_controller.dart' show notificationTapQueueProvider, pushNavRouterProvider;
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart' show localStoreProvider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../notifications/fake_local_notifications.dart';
import '../push/fake_push.dart';

void main() {
  late FakeLocalNotificationBackend os;
  late FakePushPlatform push;
  late FakeDeviceTokenRepository repo;
  late ProviderContainer container;

  ProviderContainer build({bool native = true}) {
    os = FakeLocalNotificationBackend()..native = native;
    push = FakePushPlatform(isNative: native);
    repo = FakeDeviceTokenRepository();
    final c = ProviderContainer(overrides: [
      ...notificationServicesWiringOverrides(),
      localStoreProvider.overrideWithValue(LocalStore.memory()),
      localNotificationBackendProvider.overrideWithValue(os),
      pushPlatformProvider.overrideWithValue(push),
      deviceTokenRepositoryProvider.overrideWithValue(repo),
      pushFunctionTransportProvider.overrideWithValue(_NoTransport()),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  setUp(() => container = build());

  test('every notification seam resolves to the central scheduler', () {
    expect(container.read(flowNotificationPlannerProvider), isA<SchedulerFlowNotificationPlanner>());
    expect(container.read(babyChatNotificationPlannerProvider), isA<SchedulerFlowNotificationPlanner>());
    expect(container.read(illnessReminderPlannerProvider), isA<SchedulerFlowNotificationPlanner>());
    expect(container.read(programmeNotificationsProvider), isA<SchedulerProgrammeNotifications>());
    expect(container.read(vaccineNotificationSchedulerProvider), isA<SchedulerVaccineNotificationScheduler>());
    expect(container.read(timerNotificationSchedulerProvider), isA<SchedulerTimerNotificationScheduler>());
    expect(container.read(reminderSchedulerProvider), isA<SchedulerReminderScheduler>());
    expect(container.read(chatPushSenderProvider), isA<ContractPushSender>());
    expect(container.read(notificationTapQueueProvider), same(processNotificationTapQueue));
    expect(container.read(illnessNotificationPermissionProvider), isA<Future<void> Function()>());
  });

  test('incoming chat messages notify through the scheduler', () async {
    await container.read(chatIncomingNotifierProvider)(title: 't', body: 'b', idSeed: 5, userId: null);
    // No widgets binding in this test: the app does not count as in front.
    expect(os.pendingKeys, [chatNotificationIdBase + 5]);
    expect(os.requestCalls, 0);
  });

  test('onboarding push permission: the plugin when native, unsupported on the web', () async {
    push.messaging.receive = 'prompt';
    expect(await container.read(notificationPermissionProvider).check(), 'prompt');
    final web = build(native: false);
    await expectLater(web.read(notificationPermissionProvider).check(), throwsUnsupportedError);
  });

  test('the tour grant registers this device for the signed-in user', () async {
    final service = container.read(deviceTokenServiceProvider);
    push.messaging.receive = 'denied';
    service.userChanged(const DeviceTokenUser(id: 'user-a', createdAt: '2026-01-01T00:00:00Z'));
    await pumpEventQueue();
    expect(repo.upserts, isEmpty);
    push.messaging.receive = 'granted';
    container.read(pushGrantedCallbackProvider)();
    await pumpEventQueue();
    expect(repo.upserts.single['user_id'], 'user-a');
    expect(os.requestCalls, 0);
  });

  test('logout steps cancel every reminder, drop queued taps and unregister this device', () async {
    final scheduler = container.read(localNotificationSchedulerProvider);
    await scheduler.notifyNow(id: 9, title: 't', body: 'b');
    container.read(pushNavRouterProvider).navigateFromPush(const {'type': 'baby_chat'});
    processNotificationTapQueue.deliver(const {'type': 'baby_chat', 'n': 'logout-test'});
    final steps = container.read(logoutCleanupStepsProvider);
    await steps.cancelAllLocalNotifications!();
    await steps.dropQueuedNotificationTaps!();
    await steps.unregisterDeviceForLogout!('user-a', const Duration(milliseconds: 50));
    expect(os.pending, isEmpty);
    expect(container.read(pushNavRouterProvider).consumePending(), isNull);
    final taps = <Object?>[];
    final detach = processNotificationTapQueue.attach(taps.add);
    detach();
    expect(taps, isEmpty);
    expect(repo.deviceDeletes.single, {'user_id': 'user-a', 'token': 'fcm-token-fixture'});
  });

  test('on the web the logout keeps the device scheduler untouched', () async {
    final web = build(native: false);
    await web.read(logoutCleanupStepsProvider).cancelAllLocalNotifications!();
    expect(os.removeDeliveredCalls, 0);
  });

}

class _NoTransport implements PushFunctionTransport {
  @override
  Future<PushInvokeResponse> invoke(String name, Map<String, Object?> body) async => const PushInvokeResponse(data: {'sent': 1});
}
