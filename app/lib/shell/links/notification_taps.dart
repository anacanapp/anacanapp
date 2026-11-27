// Ported from: src/lib/notification-taps.ts (deliverNotificationTap, attachNotificationTapHandler,
//              clearQueuedNotificationTaps, localTapData)
//
// The native plugin listeners (FCM / APNs / local notifications) are registered by the native layer at
// boot and call [NotificationTapQueue.deliver]; the shell attaches the router when it mounts.
import 'dart:convert';

import 'package:flutter/foundation.dart';

typedef NotificationTapData = Map<String, Object?>;
typedef NotificationTapHandler = void Function(NotificationTapData data);

/// Taps queued until the router attaches; only the latest is kept; duplicates within 2 s are dropped.
class NotificationTapQueue {
  NotificationTapQueue({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  /// The same tap can be reported by two plugins (FCM and the push fallback).
  static const Duration duplicateWindow = Duration(milliseconds: 2000);

  final DateTime Function() _clock;
  NotificationTapHandler? _handler;
  NotificationTapData? _queued;
  String _lastKey = '';
  int _lastAt = 0;
  bool _hasLast = false;

  /// `deliverNotificationTap(data, now)`. [nowMs] overrides the clock (milliseconds) for tests.
  void deliver(NotificationTapData? data, {int? nowMs}) {
    if (data == null) return;
    final now = nowMs ?? _clock().millisecondsSinceEpoch;
    String key;
    try {
      key = jsonEncode(data);
    } catch (_) {
      key = '$now';
    }
    if (_hasLast && key == _lastKey && now - _lastAt < duplicateWindow.inMilliseconds) return;
    _lastKey = key;
    _lastAt = now;
    _hasLast = true;
    final handler = _handler;
    if (handler != null) {
      try {
        handler(data);
      } catch (e) {
        debugPrint('[notification-taps] routing failed: $e');
      }
      return;
    }
    _queued = data;
  }

  /// `attachNotificationTapHandler(next)`: a queued tap is delivered right away. Returns the detach
  /// function; taps after detaching are queued again.
  VoidCallback attach(NotificationTapHandler next) {
    _handler = next;
    final pending = _queued;
    _queued = null;
    if (pending != null) {
      try {
        next(pending);
      } catch (e) {
        debugPrint('[notification-taps] routing failed: $e');
      }
    }
    return () {
      if (identical(_handler, next)) _handler = null;
    };
  }

  /// Logout: a tap queued for the old account is dropped.
  void clearQueued() => _queued = null;

  /// Tests only.
  @visibleForTesting
  void reset() {
    _handler = null;
    _queued = null;
    _lastKey = '';
    _lastAt = 0;
    _hasLast = false;
  }
}

/// `localTapData(extra)`: push-style data of a local reminder, only when it carries a route.
NotificationTapData? localTapData(Object? extra) {
  if (extra is! Map) return null;
  final data = extra.map((k, v) => MapEntry('$k', v));
  return data['type'] is String || data['deeplink'] is String ? data : null;
}
