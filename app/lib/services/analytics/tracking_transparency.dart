// Ported from: the `capacitor-plugin-app-tracking-transparency` calls of src/lib/facebook-events.ts and
//              src/lib/tiktok-events.ts
//
// iOS App Tracking Transparency. The prompt is asked by the app (after the person opted in to attribution inside
// Anacan), never by the Meta / TikTok SDKs. Default: the plugin is unavailable — React's catch branch, so
// attribution stays limited (tracking = false).
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `notDetermined` | `restricted` | `denied` | `authorized`.
typedef TrackingStatus = String;

abstract interface class TrackingTransparency {
  Future<TrackingStatus> getStatus();
  Future<TrackingStatus> requestPermission();
}

class UnavailableTrackingTransparency implements TrackingTransparency {
  const UnavailableTrackingTransparency();
  @override
  Future<TrackingStatus> getStatus() async => throw StateError('ATT plugin unavailable');
  @override
  Future<TrackingStatus> requestPermission() async => throw StateError('ATT plugin unavailable');
}

final trackingTransparencyProvider = Provider<TrackingTransparency>((ref) => const UnavailableTrackingTransparency());
