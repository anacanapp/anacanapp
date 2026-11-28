// Ported from: src/lib/home-widgets.ts (`pushWidgetSnapshot`, registerPlugin('AnacanWidgets'))
//
// The `anacan/widgets` method channel: `update {snapshot}`. Native side: Android `AnacanWidgetsPlugin.kt` (private
// SharedPreferences "AnacanHomeWidgets"/"snapshot_v1" + widget broadcast), iOS `HomeWidgetsChannel.swift` (App Group
// `group.com.atlasoon.anacan`, key `anacan.widget.snapshot.v1`, WidgetCenter reload).
import 'package:flutter/services.dart';

import 'home_widget_snapshot.dart';

class HomeWidgetsChannel {
  HomeWidgetsChannel({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/widgets';
  final MethodChannel _channel;

  /// `lastSent`: the last delivered snapshot without `updatedAt`.
  String _lastSent = '';

  /// Sends [snapshot] when it changed since the last delivery; a failure (older native build, App Group missing) is
  /// swallowed and retried with the next snapshot. Returns whether the native side accepted it.
  Future<bool> push(WidgetSnapshot snapshot) async {
    final key = snapshot.stableKey();
    if (key == _lastSent) return false;
    // Claimed before the call so a second push of the same content while this one is in flight is skipped.
    final previous = _lastSent;
    _lastSent = key;
    try {
      await _channel.invokeMethod<Object?>('update', <String, Object?>{'snapshot': snapshot.encode()});
      return true;
    } catch (_) {
      if (_lastSent == key) _lastSent = previous;
      return false;
    }
  }
}
