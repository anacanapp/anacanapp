// Ported from: packages/tiktok-events/index.d.ts (the TikTokEvents plugin surface)
//
// [TikTokEventsPlugin] over the `anacan/tiktok_events` method channel. Native side: Android `TikTokEventsPlugin.kt`
// (a "not_configured" stub until the TikTok Business SDK dependency is added, app/android/native_pending/README.md),
// iOS `TikTokEventsChannel.swift` (answers "not_configured" unless TikTokBusinessSDK is in the build). Credentials stay
// in the native configuration; consent, the event map and identity stay in tiktok_events.dart.
import 'package:flutter/services.dart';

import 'tiktok_events.dart';

class MethodChannelTikTokEvents implements TikTokEventsPlugin {
  const MethodChannelTikTokEvents({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/tiktok_events';
  final MethodChannel _channel;

  @override
  Future<({bool started, String? reason})> start({required bool tracking, bool debug = false}) async {
    final result = await _channel.invokeMapMethod<String, Object?>('start', <String, Object?>{'tracking': tracking, 'debug': debug});
    final reason = result?['reason'];
    return (started: result?['started'] == true, reason: reason is String ? reason : null);
  }

  @override
  Future<void> setEnabled(bool enabled) => _channel.invokeMethod<void>('setEnabled', <String, Object?>{'enabled': enabled});

  @override
  Future<void> track({required String event, TikTokProps? properties}) =>
      _channel.invokeMethod<void>('track', <String, Object?>{'event': event, 'properties': properties ?? const <String, Object>{}});

  @override
  Future<void> identify(String externalId) => _channel.invokeMethod<void>('identify', <String, Object?>{'externalId': externalId});

  @override
  Future<void> logout() => _channel.invokeMethod<void>('logout');
}
