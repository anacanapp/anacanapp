// Ported from: node_modules/capacitor-plugin-app-tracking-transparency (AppTrackingTransparencyPlugin.swift: getStatus,
//              requestPermission, the iOS 17.4 "denied while notDetermined" retry on the next activation)
//
// [TrackingTransparency] on app_tracking_transparency (same ATTrackingManager calls and the same iOS 17.4 retry). The
// prompt text is Info.plist NSUserTrackingUsageDescription with its 25 InfoPlist.strings translations
// (app/tool/ios/apply_ios_parity.mjs). iOS only: the Capacitor plugin has no Android implementation.
import 'package:app_tracking_transparency/app_tracking_transparency.dart' as att;

import 'tracking_transparency.dart';

/// The plugin's status strings. Before iOS 14 (no ATT) the Capacitor plugin answered 'authorized'.
TrackingStatus trackingStatusName(att.TrackingStatus status) => switch (status) {
      att.TrackingStatus.notDetermined => 'notDetermined',
      att.TrackingStatus.restricted => 'restricted',
      att.TrackingStatus.denied => 'denied',
      att.TrackingStatus.authorized => 'authorized',
      att.TrackingStatus.notSupported => 'authorized',
    };

class AppTrackingTransparencyPlugin implements TrackingTransparency {
  const AppTrackingTransparencyPlugin();

  @override
  Future<TrackingStatus> getStatus() async => trackingStatusName(await att.AppTrackingTransparency.trackingAuthorizationStatus);

  @override
  Future<TrackingStatus> requestPermission() async => trackingStatusName(await att.AppTrackingTransparency.requestTrackingAuthorization());
}
