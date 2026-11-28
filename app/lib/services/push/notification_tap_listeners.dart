// Ported from: src/lib/notification-taps.ts (installNotificationTapListeners; the queue itself is
//              shell/links/notification_taps.dart)
//
// Taps on remote pushes and on-device reminders, registered once at app start (before the backend is admitted).
// React kept the queue as module state; here it is one process-wide [processNotificationTapQueue] that the app
// root hands to the shell (`notificationTapQueueProvider.overrideWithValue(processNotificationTapQueue)`), so a tap
// that launched the app waits there until the shell attaches its router, across restarts of the provider scope.
// The plugins are [NotificationTapSources] (default: none, the web build).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/links/notification_taps.dart';
import '../native/mobile_host.dart';
import 'native_tap_sources.dart';

/// The tap events of the three plugins. Each stream emits the raw payload of one tap.
abstract interface class NotificationTapSources {
  /// `Capacitor.isNativePlatform()`.
  bool get isNative;

  /// FirebaseMessaging `notificationActionPerformed` → `event.notification.data`.
  Stream<Object?>? get messagingTaps;

  /// PushNotifications `pushNotificationActionPerformed` → `action.notification.data` (APNs / FCM fallback).
  Stream<Object?>? get pushFallbackTaps;

  /// LocalNotifications `localNotificationActionPerformed` → `action.notification.extra`.
  Stream<Object?>? get localTaps;
}

/// Web / no plugins: nothing to listen to.
class NoNotificationTapSources implements NotificationTapSources {
  const NoNotificationTapSources();
  @override
  bool get isNative => false;
  @override
  Stream<Object?>? get messagingTaps => null;
  @override
  Stream<Object?>? get pushFallbackTaps => null;
  @override
  Stream<Object?>? get localTaps => null;
}

/// The process-wide tap queue (module state of notification-taps.ts).
final NotificationTapQueue processNotificationTapQueue = NotificationTapQueue();

NotificationTapData? _asRecord(Object? value) => value is Map ? value.map((k, v) => MapEntry('$k', v as Object?)) : null;

/// Registers the tap listeners once (native only).
class NotificationTapListeners {
  NotificationTapListeners(this.queue);
  final NotificationTapQueue queue;

  bool _installed = false;
  final List<StreamSubscription<Object?>> _subs = [];

  bool get installed => _installed;

  /// `installNotificationTapListeners()`: every listener is registered synchronously; a plugin missing from the
  /// build is skipped.
  void install(NotificationTapSources sources) {
    if (_installed || !sources.isNative) return;
    _installed = true;
    void guard(Stream<Object?>? Function() stream, NotificationTapData? Function(Object? payload) map) {
      try {
        final s = stream();
        if (s == null) return;
        _subs.add(s.listen((payload) => queue.deliver(map(payload)), onError: (Object _) {}));
      } catch (_) {
        // plugin not in this build
      }
    }

    guard(() => sources.messagingTaps, _asRecord);
    guard(() => sources.pushFallbackTaps, _asRecord);
    guard(() => sources.localTaps, localTapData);
  }

  @visibleForTesting
  Future<void> reset() async {
    for (final s in _subs) {
      await s.cancel();
    }
    _subs.clear();
    _installed = false;
  }
}

final NotificationTapListeners processNotificationTapListeners = NotificationTapListeners(processNotificationTapQueue);

/// Called from `main()` before `runApp` (the plugins keep a launch tap until a listener exists).
void installNotificationTapListeners([NotificationTapSources sources = const NoNotificationTapSources()]) =>
    processNotificationTapListeners.install(sources);

/// The tap sources of this process (tests and diagnostics read it; listeners are installed from `main()`).
final notificationTapSourcesProvider = Provider<NotificationTapSources>((ref) => defaultNotificationTapSources());

/// The app build: Firebase Messaging + local notifications; anything else (tests, web): none.
NotificationTapSources defaultNotificationTapSources() =>
    isMobileHost ? const NativeNotificationTapSources() : const NoNotificationTapSources();
