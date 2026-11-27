// Ported from: src/lib/live-timer.ts
//
// Lock-screen timer bridge between the timer store and the native LiveActivity plugin ([LiveTimerBridge]).
// iOS: Live Activity (Lock Screen + Dynamic Island); Android: foreground-service chronometer notification.
// When the native activity cannot start → ongoing local notification fallback ([TimerNotifications]).
//
// Wiring: the app root overrides [liveTimerBridgeProvider] (method-channel implementation),
// [timerNotificationSchedulerProvider] (central local-notification scheduler) and, to connect the timer store,
// `timerNativeHooksProvider.overrideWith((ref) => ref.watch(liveTimerNativeHooksProvider))`.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../state/timer_store.dart';
import 'live_timer_bridge.dart';
import 'timer_notifications.dart';

export 'live_timer_bridge.dart';
export 'timer_notifications.dart';

/// The native plugin (no-op until the native layer overrides it).
final liveTimerBridgeProvider = Provider<LiveTimerBridge>((ref) => const NoopLiveTimerBridge());

/// Central local-notification scheduler used by the fallback notification (no-op default).
final timerNotificationSchedulerProvider =
    Provider<TimerNotificationScheduler>((ref) => const NoopTimerNotificationScheduler());

/// iOS-only diagnostic toast (`toast.error('LiveActivity başlamadı: …', { duration: 8000 })`). Wired by the app root;
/// null = no toast.
final liveTimerIosFailureToastProvider = Provider<void Function(String message)?>((ref) => null);

/// Platform check (`Capacitor.getPlatform() === 'ios'`); overridable in tests.
final liveTimerIsIosProvider = Provider<bool>((ref) => defaultTargetPlatform == TargetPlatform.iOS);

class LiveTimer {
  LiveTimer({required this.bridge, required this.notifications, this.isIos = false, this.onIosFailure});

  final LiveTimerBridge bridge;
  final TimerNotifications notifications;
  final bool isIos;
  final void Function(String message)? onIosFailure;

  bool get isNative => bridge.isNative;

  /// Timers whose native activity was obtained (fallback decisions).
  final Set<String> nativeActive = <String>{};

  /// `startNativeTimer(timer)`.
  Future<void> startNativeTimer(ActiveTimer timer) async {
    if (!isNative) return;
    final base = timer.label ?? timerTypeLabels()[timer.type] ?? 'Timer';
    final childPrefix = timer.childName != null ? '${timer.childName} — ' : '';
    try {
      await bridge.startActivity(LiveActivityStart(
        id: timer.id,
        type: timer.type,
        label: '$childPrefix$base${feedSideSuffix(timer.feedType)}',
        subLabel: tr('livetimer_davam_edir', 'Davam edir — dayandırmaq üçün düyməyə basın'),
        stopLabel: tr('livetimer_dayandir', 'Dayandır'),
        startTime: timer.startTime,
        feedType: timer.feedType,
        channelName: tr('livetimer_channel_name', 'Taymerlər'),
        channelDesc: tr('livetimer_channel_desc', 'Aktiv taymerlər'),
      ));
      nativeActive.add(timer.id);
    } catch (e) {
      // Live Activity impossible → old ongoing notification.
      if (isIos) onIosFailure?.call('LiveActivity başlamadı: ${_reason(e)}');
      await notifications.show(timer.id, timer.type, label: '$childPrefix$base', feedType: timer.feedType);
    }
  }

  static String _reason(Object e) {
    try {
      final dynamic d = e;
      final m = d.message;
      if (m is String && m.isNotEmpty) return m;
    } catch (_) {}
    return e.toString();
  }

  /// `stopNativeTimer(timerId)`.
  Future<void> stopNativeTimer(String timerId) async {
    if (!isNative) return;
    if (nativeActive.remove(timerId)) {
      try {
        await bridge.stopActivity(timerId: timerId);
        return;
      } catch (_) {
        // LiveActivity stop error → fall through
      }
    }
    // Clear the fallback notification (harmless either way).
    await notifications.clear(timerId);
    // After a restart nativeActive may be empty: still ask the native side.
    try {
      await bridge.stopActivity(timerId: timerId);
    } catch (_) {}
  }

  /// `processPendingStops(save)`: calls [save] for each stop written by the widget / notification; the list is
  /// cleared ONLY when every save returned true (false or a throw = retry on the next call). Returns the count.
  Future<int> processPendingStops(FutureOr<bool> Function(PendingTimerStop stop) save) async {
    if (!isNative) return 0;
    try {
      final stops = await bridge.getPendingStops();
      if (stops.isEmpty) return 0;
      var allOk = true;
      for (final s in stops) {
        nativeActive.remove(s.id);
        try {
          final ok = await save(s);
          if (!ok) allOk = false;
        } catch (_) {
          allOk = false;
        }
      }
      if (allOk) await bridge.clearPendingStops();
      return stops.length;
    } catch (_) {
      return 0;
    }
  }

  /// `onNativeTimerStopped(cb)`: Android live `timerStopped` event. Returns the cleanup; a listener that resolves
  /// after cleanup is removed at once.
  void Function() onNativeTimerStopped(void Function() cb) {
    if (!isNative) return () {};
    void Function()? handle;
    var cancelled = false;
    bridge.addTimerStoppedListener((_) => cb()).then((remove) {
      if (cancelled) {
        remove();
        return;
      }
      handle = remove;
    }, onError: (Object _) {});
    return () {
      cancelled = true;
      handle?.call();
      handle = null;
    };
  }
}

final liveTimerProvider = Provider<LiveTimer>((ref) {
  final bridge = ref.watch(liveTimerBridgeProvider);
  return LiveTimer(
    bridge: bridge,
    notifications: TimerNotifications(ref.watch(timerNotificationSchedulerProvider), isNative: bridge.isNative),
    isIos: ref.watch(liveTimerIsIosProvider),
    onIosFailure: ref.watch(liveTimerIosFailureToastProvider),
  );
});

/// [TimerNativeHooks] for the timer store (timerStore.ts calls startNativeTimer / stopNativeTimer /
/// clearAllTimerNotifications without awaiting).
class LiveTimerNativeHooks implements TimerNativeHooks {
  LiveTimerNativeHooks(this.liveTimer);
  final LiveTimer liveTimer;

  @override
  void startNativeTimer(ActiveTimer timer) => unawaited(liveTimer.startNativeTimer(timer));

  @override
  void stopNativeTimer(String id) => unawaited(liveTimer.stopNativeTimer(id));

  @override
  void clearAllTimerNotifications(List<String> ids) => unawaited(liveTimer.notifications.clearAll(ids));
}

final liveTimerNativeHooksProvider = Provider<TimerNativeHooks>((ref) => LiveTimerNativeHooks(ref.watch(liveTimerProvider)));
