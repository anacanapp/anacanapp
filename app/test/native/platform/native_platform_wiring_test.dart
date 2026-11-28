// Ported from: android/app/src/main/java/com/atlasoon/anacan/MainActivity.java, ios/App/App/MainViewController.swift
//              (which plugins the native app registers)
//
// The wiring list: off the iOS / Android host only the host-independent health seams are overridden (tests and desktop
// keep every feature default); on a native host the channel clients replace the defaults.
import 'package:anacan/features/baby/live_timer/live_timer.dart' show liveTimerBridgeProvider;
import 'package:anacan/features/home_flow/flow_platform.dart' show cycleHealthWriterProvider;
import 'package:anacan/features/security/screen_capture_guard.dart';
import 'package:anacan/features/settings/data/health_service.dart';
import 'package:anacan/native/platform/health_channels.dart';
import 'package:anacan/native/platform/live_timer_channel.dart';
import 'package:anacan/native/platform/native_host.dart';
import 'package:anacan/native/platform/native_platform_wiring.dart';
import 'package:anacan/services/analytics/facebook_events.dart';
import 'package:anacan/services/security/dashboard_capture.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the test host is not a native host', () {
    expect(NativeHost.current().isNative, isFalse);
  });

  test('off the native host the channel seams keep their defaults', () {
    final container = ProviderContainer(overrides: nativePlatformWiringOverrides());
    addTearDown(container.dispose);
    expect(nativePlatformWiringOverrides(), hasLength(2));
    expect(container.read(screenshotGuardPlatformProvider), isA<NoopScreenshotGuard>());
    expect(container.read(liveTimerBridgeProvider).isNative, isFalse);
    expect(container.read(facebookEventsPluginProvider), isNull);
    expect(container.read(healthCyclePluginProvider), isA<MissingHealthPlugins>());
    expect(container.read(cycleHealthWriterProvider), isA<HealthServiceCycleWriter>());
  });

  test('on a native host the method-channel clients are wired', () {
    final container = ProviderContainer(overrides: nativePlatformWiringOverrides(host: const NativeHost('android')));
    addTearDown(container.dispose);
    expect(container.read(screenshotGuardPlatformProvider), isA<MethodChannelScreenshotGuard>());
    final bridge = container.read(liveTimerBridgeProvider);
    expect(bridge, isA<MethodChannelLiveTimerBridge>());
    expect(bridge.isNative, isTrue);
    expect(container.read(healthCyclePluginProvider), isA<MethodChannelHealthCycle>());
    expect(container.read(healthVitalsPluginProvider), isA<MethodChannelHealthVitals>());
    expect(container.read(facebookEventsPluginProvider), isNotNull);
  });
}
