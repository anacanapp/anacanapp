// Covers NativeServicesHost (Index's useDeviceToken() / useVaccineRemindersAtStart and bootstrap's
// initializeNativeFeatures) mounted under the root toaster.
import 'package:anacan/services/native/native_services_host.dart';
import 'package:anacan/services/native/services_wiring.dart';
import 'package:anacan/services/push/push_platform.dart';
import 'package:anacan/services/push/send_push.dart';
import 'package:anacan/shell/shell_inputs.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../features/settings/support/harness.dart';
import '../notifications/fake_local_notifications.dart';
import '../push/fake_push.dart';

class _NoTransport implements PushFunctionTransport {
  @override
  Future<PushInvokeResponse> invoke(String name, Map<String, Object?> body) async => const PushInvokeResponse(data: {'sent': 1});
}

void main() {
  testWidgets('registers the signed-in device and shows the daily permission toast with its action', (tester) async {
    final push = FakePushPlatform()..messaging.receive = 'prompt';
    final repo = FakeDeviceTokenRepository();
    final os = FakeLocalNotificationBackend()..native = false; // no vaccine refresh: needs the plugin
    await pumpApp(
      tester,
      const NativeServicesHost(),
      scroll: false,
      overrides: [
        ...baseOverrides(),
        ...notificationServicesWiringOverrides(),
        pushPlatformProvider.overrideWithValue(push),
        deviceTokenRepositoryProvider.overrideWithValue(repo),
        localNotificationBackendProvider.overrideWithValue(os),
        pushFunctionTransportProvider.overrideWithValue(_NoTransport()),
        shellUserProvider.overrideWithValue(const ShellUser(
            isAuthenticated: true, authLoading: false, profileLoaded: true, language: 'az', backendUrl: 'https://api.anacan.az', userId: 'user-1')),
      ],
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('Bildirişlərə icazə verin'), findsOneWidget);
    await tester.tap(find.text('İcazə ver'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(push.messaging.requestCalls, 1);
    expect(repo.upserts.single['user_id'], 'user-1');
    // Let the toast's exit timer finish while the toaster is still mounted.
    await tester.pump(const Duration(seconds: 1));
  });

  test('the web push platform is the default', () => expect(const WebPushPlatform().isNative, isFalse));
}
