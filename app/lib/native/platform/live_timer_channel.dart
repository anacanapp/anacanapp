// Ported from: src/plugins/LiveActivityPlugin.ts (registerPlugin('LiveActivity') + addListener('timerStopped'))
//
// [LiveTimerBridge] over the `anacan/live_timer` method channel. Native side: Android `TimerWidgetPlugin.kt` +
// `TimerForegroundService.kt` (lock-screen chronometer notification), iOS `LiveActivityChannel.swift` (ActivityKit).
// Every call may throw like the Capacitor plugin (PlatformException / MissingPluginException); the live-timer logic
// catches and falls back to its ongoing local notification. `timerStopped` arrives as a method call from Android
// while the app runs (iOS has no live event; its stops are read on resume).
import 'package:flutter/services.dart';

import '../../features/baby/live_timer/live_timer_bridge.dart';

class MethodChannelLiveTimerBridge implements LiveTimerBridge {
  MethodChannelLiveTimerBridge({required this.isNative, MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/live_timer';

  final MethodChannel _channel;
  final List<void Function(PendingTimerStop stop)> _listeners = <void Function(PendingTimerStop stop)>[];
  bool _handlerSet = false;

  @override
  final bool isNative;

  @override
  Future<void> startActivity(LiveActivityStart options) => _channel.invokeMethod<void>('startActivity', options.toJson());

  @override
  Future<void> stopActivity({String? timerId}) =>
      _channel.invokeMethod<void>('stopActivity', <String, Object?>{'timerId': ?timerId});

  @override
  Future<List<PendingTimerStop>> getPendingStops() async {
    final res = await _channel.invokeMethod<Object?>('getPendingStops');
    final raw = res is Map ? res['stops'] : null;
    if (raw is! List) return const <PendingTimerStop>[];
    return [for (final item in raw) ?PendingTimerStop.tryParse(item)];
  }

  @override
  Future<void> clearPendingStops() => _channel.invokeMethod<void>('clearPendingStops');

  @override
  Future<void Function()> addTimerStoppedListener(void Function(PendingTimerStop stop) listener) async {
    if (!_handlerSet) {
      _handlerSet = true;
      _channel.setMethodCallHandler(_onNativeCall);
    }
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  Future<Object?> _onNativeCall(MethodCall call) async {
    if (call.method != 'timerStopped') return null;
    final stop = PendingTimerStop.tryParse(call.arguments);
    if (stop == null) return null;
    for (final listener in List.of(_listeners)) {
      listener(stop);
    }
    return null;
  }
}
