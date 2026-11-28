// Ported from: the native plugin lookups of src/lib/ads/native.ts (`Capacitor.isPluginAvailable('AdMob')`),
//              src/lib/analytics.ts (`@capacitor-firebase/analytics` when native), src/lib/tiktok-events.ts,
//              src/lib/customerio.ts (`CustomerIoDataIn`), src/lib/facebook-events.ts (`capacitor-plugin-app-tracking-
//              transparency` on iOS)
//
// The ad and analytics SDK seams on their real implementations inside the iOS / Android app; elsewhere (web, tests on
// a desktop host) every seam keeps its default, React's "plugin not available" branch. The Meta App Events seam
// (`facebookEventsPluginProvider`) is wired by native/platform/native_platform_wiring.dart.
// App root: `...adsAnalyticsSdkWiringOverrides()` in `featureWiringOverrides()` (app/app_wiring.dart).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../ads/admob_adapter.dart' show admobSdkProvider;
import '../ads/ads_providers.dart' show compiledAdmobAppId, compiledAdmobAppIdProvider;
import '../ads/google_mobile_ads_sdk.dart';
import '../native/mobile_host.dart';
import 'analytics_providers.dart' show firebaseAnalyticsPlatformProvider;
import 'att_tracking_transparency.dart';
import 'customerio.dart' show customerIoPluginLoaderProvider;
import 'customerio_channel.dart';
import 'firebase_analytics_platform.dart';
import 'tiktok_events.dart' show tiktokEventsPluginProvider;
import 'tiktok_events_channel.dart';
import 'tracking_transparency.dart' show trackingTransparencyProvider;

/// The app's `anacan/admob` channel (native story ad, declared app id).
final admobNativeChannelProvider = Provider<AdmobNativeChannel>((ref) => AdmobNativeChannel(), name: 'admobNativeChannelProvider');

/// google_mobile_ads behind [AdmobSdk].
final googleMobileAdsSdkProvider = Provider<GoogleMobileAdsSdk>(
  (ref) => GoogleMobileAdsSdk(platform: isIOSHost ? 'ios' : 'android', native: ref.watch(admobNativeChannelProvider)),
  name: 'googleMobileAdsSdkProvider',
);

/// [mobile] / [ios] default to the real process host.
List<Override> adsAnalyticsSdkWiringOverrides({bool? mobile, bool? ios}) {
  if (!(mobile ?? isMobileHost)) return const <Override>[];
  return [
    // @capacitor-community/admob (+ the patch's native story ad).
    admobSdkProvider.overrideWith((ref) => ref.watch(googleMobileAdsSdkProvider)),
    // VITE_ADMOB_*_APP_ID: the id the native configuration declares.
    compiledAdmobAppIdProvider
        .overrideWith((ref) => NativeAdmobAppId(ref.watch(admobNativeChannelProvider), fallback: compiledAdmobAppId).resolve),
    // @capacitor-firebase/analytics.
    firebaseAnalyticsPlatformProvider.overrideWith((ref) => FlutterFireAnalytics()),
    // capacitor-plugin-app-tracking-transparency (iOS only, as the plugin).
    if (ios ?? isIOSHost) trackingTransparencyProvider.overrideWith((ref) => const AppTrackingTransparencyPlugin()),
    // packages/tiktok-events, packages/customerio-data-in.
    tiktokEventsPluginProvider.overrideWith((ref) => const MethodChannelTikTokEvents()),
    customerIoPluginLoaderProvider.overrideWith((ref) => () async => const MethodChannelCustomerIo()),
  ];
}
