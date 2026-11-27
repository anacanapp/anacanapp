// Ported from: src/hooks/usePendingTimerStops.ts
//
// Saves timers stopped from the lock-screen widget (iOS Live Activity) / notification (Android FGS) as baby_logs.
// Rules (unchanged):
//  * only `sleep` / `feeding`; a stop shorter than 3 s is an accidental tap (counted as processed);
//  * while the user or the children list is not ready → `false` (retry later, the native list is kept);
//  * child_id from the persisted timer (twins) else the selected child; the store timer is removed;
//  * duplicate guard: a log with the same user + type + start already exists → processed;
//  * feeding side → `breast_left` / `breast_right`; the native list is cleared only when every stop succeeded.
// Triggers: on mount and whenever user / children readiness changes, on the Android `timerStopped` event and on
// app resume. Mount [PendingTimerStopsHost] (or watch [pendingTimerStopsHostProvider]) once at the app level, as
// Index.tsx did.
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/backend_providers.dart';
import 'package:anacan/shell/shell_inputs.dart';

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/js_compat.dart';
import '../../../state/timer_store.dart';
import '../data/baby_repository.dart';
import '../live_timer/live_timer.dart';
import 'use_baby_logs.dart';
import 'use_children.dart';

/// Readiness inputs of `saveStop` (the useCallback deps).
class PendingStopDeps {
  const PendingStopDeps({
    this.userId,
    this.childrenLoading = true,
    this.selectedChildId,
  });
  final String? userId;
  final bool childrenLoading;
  final String? selectedChildId;
}

class PendingTimerStops {
  PendingTimerStops(this._ref);
  final Ref _ref;

  PendingStopDeps deps = const PendingStopDeps();
  bool _processing = false;

  LiveTimer get _liveTimer => _ref.read(liveTimerProvider);
  bool get isNative => _liveTimer.isNative;

  /// `saveStop(stop)`: true = written or deliberately skipped, false = retry later.
  Future<bool> saveStop(PendingTimerStop stop) async {
    if (stop.type != 'sleep' && stop.type != 'feeding') return true;
    if (stop.stoppedAt - stop.startTime < 3000) return true;
    final userId = deps.userId;
    if (userId == null || deps.childrenLoading) return false;

    final store = _ref.read(timerStoreProvider.notifier);
    ActiveTimer? storeTimer;
    for (final t in _ref.read(timerStoreProvider).activeTimers) {
      if (t.id == stop.id) storeTimer = t;
    }
    final childId = storeTimer?.childId ?? deps.selectedChildId;
    if (storeTimer != null) store.stopTimer(stop.id);

    final startIso = jsToIsoString(
      DateTime.fromMillisecondsSinceEpoch(stop.startTime),
    );
    try {
      if (await _ref
          .read(babyRepositoryProvider)
          .babyLogExists(userId, stop.type, startIso))
        return true;
    } catch (_) {
      // the check failed: continue with the insert
    }

    final result = await _ref
        .read(babyLogsActionsProvider)
        .addLog(
          logType: stop.type,
          feedType: stop.type == 'feeding' && stop.feedType != null
              ? (stop.feedType == 'left' ? 'breast_left' : 'breast_right')
              : null,
          startTime: startIso,
          endTime: jsToIsoString(
            DateTime.fromMillisecondsSinceEpoch(stop.stoppedAt),
          ),
          childId: childId,
        );
    return result.error == null;
  }

  /// `handlePending()` (one run at a time).
  Future<void> handlePending() async {
    if (_processing) return;
    _processing = true;
    try {
      await _liveTimer.processPendingStops(saveStop);
    } finally {
      _processing = false;
    }
  }
}

final pendingTimerStopsProvider = Provider<PendingTimerStops>(
  PendingTimerStops.new,
);

/// Listeners subscribed once (`timerStopped` + app resume) calling the latest handler.
final _pendingStopListeners = Provider.autoDispose<void>((ref) {
  final processor = ref.read(pendingTimerStopsProvider);
  if (!processor.isNative) return;
  final offEvent = ref
      .read(liveTimerProvider)
      .onNativeTimerStopped(() => unawaited(processor.handlePending()));
  final sub = ref
      .read(appResumeEventsProvider)
      .listen((_) => unawaited(processor.handlePending()));
  ref.onDispose(() {
    offEvent();
    unawaited(sub.cancel());
  });
});

/// `usePendingTimerStops()`: keep watched while signed in (Index level).
final pendingTimerStopsHostProvider = Provider.autoDispose<void>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final children = ref.watch(childrenProvider);
  final processor = ref.read(pendingTimerStopsProvider);
  processor.deps = PendingStopDeps(
    userId: userId,
    childrenLoading: children.loading,
    selectedChildId: children.selectedChild?.id,
  );
  if (!processor.isNative) return;
  ref.watch(_pendingStopListeners);
  // Mount + whenever auth / children readiness changes.
  unawaited(processor.handlePending());
});

/// Invisible widget that keeps [pendingTimerStopsHostProvider] alive.
class PendingTimerStopsHost extends ConsumerWidget {
  const PendingTimerStopsHost({super.key, this.child});
  final Widget? child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // usePendingTimerStops runs for signed-in users only; before sign-in the backend may not be open yet.
    final signedIn = ref.watch(
      shellUserProvider.select((u) => u.isAuthenticated),
    );
    final backendOpen = ref.watch(
      backendBootstrapProvider.select((b) => b.value is BootstrapOpened),
    );
    if (signedIn && backendOpen) {
      ref.watch(pendingTimerStopsHostProvider);
    }
    return child ?? const SizedBox.shrink();
  }
}
