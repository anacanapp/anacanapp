// Ported from: android/app/src/main/java/com/atlasoon/anacan/MainActivity.java (load(): registerPlugin of the local
//              plugins) and ios/App/App/MainViewController.swift (capacitorDidLoad(): registerPluginInstance)
//
// The overrides that put the app's own native code (method channels in app/android/app/src/main/kotlin/com/atlasoon/
// anacan/ and app/ios/Runner/) behind the feature seams. The channel-backed seams are only overridden on the iOS /
// Android host ([NativeHost]); in tests and desktop runs every seam keeps its feature default, so the list is safe to
// spread unconditionally: `...nativePlatformWiringOverrides()` in app/app_wiring.dart.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../domain/cycle/health_cycle.dart' show PeriodDay;
import '../../features/baby/live_timer/live_timer.dart' show liveTimerBridgeProvider;
import '../../features/home/home_slots.dart' show homeWidgetBridgeProvider;
import '../../features/home_flow/flow_platform.dart' show CycleHealthWriter, cycleHealthWriterProvider;
import '../../features/security/screen_capture_guard.dart' show screenshotGuardPlatformProvider;
import '../../features/settings/data/health_service.dart'
    show healthCyclePluginProvider, healthServiceProvider, healthVitalsPluginProvider;
import '../../features/settings/widget_settings_screen.dart' show homeWidgetsSyncProvider;
import '../../features/tools/pregnancy_common/pregnancy_ports.dart' show healthVitalsBackgroundSyncProvider;
import '../../services/analytics/facebook_events.dart' show facebookEventsPluginProvider;
import '../../services/security/dashboard_capture.dart' show MethodChannelScreenshotGuard;
import 'facebook_events_channel.dart';
import 'health_channels.dart';
import 'home_widgets/home_widgets_service.dart';
import 'live_timer_channel.dart';
import 'native_host.dart';

/// One process-wide client per channel (a channel has one method-call handler on the Dart side).
final screenshotGuardChannelProvider =
    Provider<MethodChannelScreenshotGuard>((ref) => MethodChannelScreenshotGuard(), name: 'screenshotGuardChannelProvider');
final liveTimerChannelProvider =
    Provider<MethodChannelLiveTimerBridge>((ref) => MethodChannelLiveTimerBridge(isNative: true), name: 'liveTimerChannelProvider');

/// `syncPeriodDaysToHealth` (healthCycle.ts) for the flow home, through the one HealthService (serialized writes,
/// the cycle-write switch, the native check).
class HealthServiceCycleWriter implements CycleHealthWriter {
  const HealthServiceCycleWriter(this._ref);
  final Ref _ref;

  @override
  Future<bool> syncPeriodDays(List<PeriodDay> days) => _ref
      .read(healthServiceProvider)
      .syncPeriodDaysToHealth([for (final d in days) (date: d.date, flow: d.flow, cycleStart: d.cycleStart)]);
}

/// [host] defaults to the real process host.
List<Override> nativePlatformWiringOverrides({NativeHost? host}) {
  final native = (host ?? NativeHost.current()).isNative;
  return [
    // HealthService already returns "unavailable" off the native host, so these two are host independent.
    cycleHealthWriterProvider.overrideWith((ref) => HealthServiceCycleWriter(ref)),
    healthVitalsBackgroundSyncProvider.overrideWith((ref) => (userId) => ref.read(healthServiceProvider).syncVitalsInBackground(userId)),
    if (native) ...[
      // ScreenshotGuard (Android FLAG_SECURE + capture callback, iOS curtain / secure surface).
      screenshotGuardPlatformProvider.overrideWith((ref) => ref.watch(screenshotGuardChannelProvider)),
      // LiveActivity (Android foreground-service chronometer, iOS ActivityKit).
      liveTimerBridgeProvider.overrideWith((ref) => ref.watch(liveTimerChannelProvider)),
      // AnacanWidgets (home-screen widgets): the home journey push and the widget-settings change event.
      homeWidgetBridgeProvider.overrideWith((ref) => ref.watch(homeWidgetsServiceProvider)),
      homeWidgetsSyncProvider.overrideWith((ref) => ref.watch(homeWidgetsServiceProvider)),
      // HealthCycle / HealthVitals (Health Connect, HealthKit).
      healthCyclePluginProvider.overrideWithValue(const MethodChannelHealthCycle()),
      healthVitalsPluginProvider.overrideWithValue(const MethodChannelHealthVitals()),
      // FbEvents (Meta App Events; consent and the event map stay in Dart).
      facebookEventsPluginProvider.overrideWithValue(const MethodChannelFacebookEvents()),
    ],
  ];
}
