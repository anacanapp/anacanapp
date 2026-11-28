// Ported from: src/components/security/ScreenCaptureGuard.test.tsx (the `dashboardCaptureAllowed()` case; the
// curtain / native protection cases are in test/features/security/app_lock_test.dart)
import 'package:anacan/services/security/dashboard_capture.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

bool allowed({
  bool shellShown = true,
  ShellLayer layer = ShellLayer.frame,
  ShellTab tab = ShellTab.home,
  bool blog = false,
  int blockers = 0,
  bool chat = false,
  bool tour = false,
}) =>
    dashboardCaptureAllowedFor(shellShown: shellShown, layer: layer, activeTab: tab, blogOverlayOpen: blog, blockers: blockers, fullScreenChat: chat, onboardingStep: tour);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('allows only the visible main dashboard; a modal or other screen restores protection', () {
    expect(allowed(shellShown: false), isFalse);
    expect(allowed(), isTrue);
    expect(allowed(blockers: 1), isFalse);
    expect(allowed(tab: ShellTab.tools), isFalse);
    expect(allowed(layer: ShellLayer.subScreen), isFalse);
    expect(allowed(layer: ShellLayer.motherChat), isFalse);
    expect(allowed(blog: true), isFalse);
    expect(allowed(chat: true), isFalse);
    expect(allowed(tour: true), isFalse);
  });

  test('the method-channel guard is a no-op without the native plugin and relays capture events', () async {
    const channel = MethodChannel('anacan/screenshot_guard_test');
    final guard = MethodChannelScreenshotGuard(channel: channel);
    await guard.setEnabled(true);
    await guard.setCurtainSuspended(false);
    final captures = <bool>[];
    final sub = guard.captureChanged.listen(captures.add);
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    await messenger.handlePlatformMessage(channel.name, channel.codec.encodeMethodCall(const MethodCall('captureChanged', {'captured': true})), (_) {});
    await Future<void>.delayed(Duration.zero);
    expect(captures, [true]);
    await sub.cancel();
  });
}
