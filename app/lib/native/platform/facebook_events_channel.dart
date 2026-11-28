// Ported from: src/lib/facebook-events.ts (the plugin surface: Android local `FbEvents`, iOS `capacitor-facebook-events`)
//
// [FacebookEventsPlugin] over the `anacan/fb_events` method channel. Native side: Android `FbEventsPlugin.kt` (Meta
// SDK; silent when the build has no app id / client token), iOS `FbEventsChannel.swift` (no-op unless FBSDKCoreKit is
// in the build and FacebookAppID / FacebookClientToken are set). Consent and the event map stay in services/analytics/facebook_events.dart.
import 'package:flutter/services.dart';

import '../../services/analytics/facebook_events.dart' show FacebookEventsPlugin;

class MethodChannelFacebookEvents implements FacebookEventsPlugin {
  const MethodChannelFacebookEvents({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/fb_events';
  final MethodChannel _channel;

  @override
  Future<void> logEvent({required String event, required Map<String, Object> params}) =>
      _channel.invokeMethod<void>('logEvent', <String, Object?>{'event': event, 'params': params});

  @override
  Future<void> setAdvertiserTrackingEnabled(bool enabled) =>
      _channel.invokeMethod<void>('setAdvertiserTrackingEnabled', <String, Object?>{'enabled': enabled});

  @override
  Future<void> setConsent(bool enabled) => _channel.invokeMethod<void>('setConsent', <String, Object?>{'enabled': enabled});
}
