// Ported from: src/hooks/useSleepTrainingPlan.ts
//
// The sleep-training plan of one child: read from and written to the phone at once, synced with the account copy
// (public.sleep_training_plans) in the background — after load, ~1.5 s after a change and when the phone comes back
// online. Guests (no user) and a missing child stay local-only. One controller per (owner, child): the screen makes
// a new one when the child changes, so a late answer for the previous child is dropped (React's scope check).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/offline/connectivity.dart' show ConnectivitySource;
import '../../../domain/js_compat.dart';
import '../../../domain/sleep/sleep_training.dart';
import '../../../state/local_store.dart';
import 'sleep_training_sync.dart';

class SleepTrainingPlanController extends ChangeNotifier {
  SleepTrainingPlanController({
    required this.store,
    required this.remote,
    required this.userId,
    required this.childId,
    ConnectivitySource? connectivity,
    this.syncDelay = const Duration(milliseconds: 1500),
  }) : owner = userId ?? 'guest' {
    _stored = readLocalPlan(store, owner, childId, localDateKey(DomainClock.now()));
    loaded = true;
    if (canSync) {
      _online = connectivity?.onlineChanges.listen((online) {
        if (online) unawaited(sync());
      });
      scheduleMicrotask(() => unawaited(sync()));
    }
  }

  final LocalStore? store;
  final SleepPlanRemote remote;
  final String? userId;
  final String? childId;
  final String owner;
  final Duration syncDelay;

  late StoredPlan _stored;
  bool loaded = false;
  bool _syncing = false;
  bool _again = false;
  bool _disposed = false;
  Timer? _timer;
  StreamSubscription<bool>? _online;

  bool get canSync => userId != null && childId != null;
  PlanState get state => _stored.plan;

  /// Changed on this device and not uploaded yet.
  bool get pending => _stored.dirty;

  void _commit(StoredPlan next) {
    _stored = next;
    writeLocalPlan(store, owner, childId, next);
    if (!_disposed) notifyListeners();
  }

  Future<void> sync() async {
    if (!canSync || _disposed) return;
    if (_syncing) {
      _again = true;
      return;
    }
    _syncing = true;
    try {
      final snap = _stored;
      final res = await syncPlan(db: remote, userId: userId!, childId: childId, local: snap, todayKey: localDateKey(DomainClock.now()));
      if (!res.ok || _disposed) return;
      // A change made while syncing stays (and stays dirty); the next round uploads it.
      if (identical(_stored, snap)) {
        _commit(res.state);
      } else {
        _again = true;
      }
    } finally {
      _syncing = false;
      if (_again && !_disposed) {
        _again = false;
        unawaited(sync());
      }
    }
  }

  /// Apply a change now (pruned to the last 30 days) and queue it for the account copy.
  void update(PlanState Function(PlanState s) fn) {
    final cur = _stored;
    final next = applyLocalChange(cur, prunePlanState(fn(cur.plan), localDateKey(DomainClock.now())));
    if (identical(next, cur)) return;
    _commit(next);
    _timer?.cancel();
    _timer = Timer(syncDelay, () => unawaited(sync()));
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    unawaited(_online?.cancel());
    super.dispose();
  }
}
