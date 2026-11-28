// Ported from: src/components/tools/weaning/useWeaningState.ts
//
// Device-first weaning state: every change is applied and stored locally at once (optimistic, offline-safe) and
// pushed to the server in the background (400 ms after a change, on mount, and when the phone comes back online).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/offline/connectivity.dart' show ConnectivitySource;
import '../../../domain/weaning/weaning.dart';
import '../../../state/local_store.dart';
import 'weaning_sync.dart';

class WeaningStateController extends ChangeNotifier {
  WeaningStateController({
    required this.store,
    required this.remote,
    required this.uid,
    required this.childId,
    ConnectivitySource? connectivity,
    this.syncDelay = const Duration(milliseconds: 400),
  }) : online = connectivity?.isOnline ?? true {
    _state = readLocal(store, uid);
    _sub = connectivity?.onlineChanges.listen((on) {
      online = on;
      if (!_disposed) notifyListeners();
      if (on) unawaited(sync());
    });
    scheduleMicrotask(() => unawaited(sync()));
  }

  final LocalStore store;
  final WeaningRemote remote;
  final String? uid;
  final String? childId;
  final Duration syncDelay;
  bool online;

  late WeaningLocal _state;
  bool _syncing = false;
  bool _again = false;
  bool _disposed = false;
  Timer? _timer;
  StreamSubscription<bool>? _sub;

  WeaningLocal get state => _state;

  /// Changes not on the server yet.
  bool get pending => _state.planDirty || _state.checkins.any((c) => !c.synced);

  void _commit(WeaningLocal next) {
    _state = next;
    writeLocal(store, uid, next);
    if (!_disposed) notifyListeners();
  }

  Future<void> sync() async {
    if (uid == null || _disposed) return;
    if (_syncing) {
      _again = true;
      return;
    }
    _syncing = true;
    try {
      final snap = _state;
      final res = (await syncWeaning(remote, uid!, childId, snap)).state;
      if (_disposed) return;
      final cur = _state;
      // Changes made while syncing stay; only the parts of the snapshot that were reconciled are applied.
      final syncedIds = {for (final c in res.checkins) if (c.synced) c.id};
      var next = identical(cur.plan, snap.plan) ? cur.copyWith(plan: res.plan, planDirty: res.planDirty) : cur;
      next = next.copyWith(checkins: [for (final c in cur.checkins) syncedIds.contains(c.id) && !c.synced ? c.withSynced() : c]);
      _commit(next);
    } finally {
      _syncing = false;
      if (_again && !_disposed) {
        _again = false;
        unawaited(sync());
      }
    }
  }

  /// Apply a change locally now and queue it for the server.
  void update(WeaningLocal Function(WeaningLocal s) fn) {
    _commit(fn(_state));
    _timer?.cancel();
    _timer = Timer(syncDelay, () => unawaited(sync()));
  }

  /// Replace the plan (marks it for upload).
  void setPlan(WeaningPlan? plan) => update((s) => s.copyWith(plan: plan, planDirty: plan != null));

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    unawaited(_sub?.cancel());
    super.dispose();
  }
}
