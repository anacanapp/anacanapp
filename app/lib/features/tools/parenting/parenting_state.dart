// Ported from: src/components/tools/parenting/useParentingState.ts
//
// Tərbiyə state per account (programme progress, quiz results, bookmarks, chosen age band): every change is applied
// and stored on the phone at once and merged with the account copy (public.parenting_state) in the background
// (800 ms after a change, on mount, when the phone comes back online). `sync: false` reads the device copy only
// (dashboard teaser).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/offline/connectivity.dart' show ConnectivitySource;
import '../../../state/local_store.dart';
import 'parenting_store.dart';
import 'parenting_sync.dart';

class ParentingStateController extends ChangeNotifier {
  ParentingStateController({
    required this.store,
    required this.remote,
    required this.uid,
    this.doSync = true,
    ConnectivitySource? connectivity,
    this.syncDelay = const Duration(milliseconds: 800),
  }) : online = connectivity?.isOnline ?? true {
    _state = readParenting(store, uid);
    if (doSync) {
      _sub = connectivity?.onlineChanges.listen((on) {
        online = on;
        if (!_disposed) notifyListeners();
        if (on) unawaited(sync());
      });
      scheduleMicrotask(() => unawaited(sync()));
    } else {
      // The teaser follows the tool's writes on this phone.
      _sub2 = store.changes.listen((c) {
        if (c.key == storageKey(uid) && !_disposed) {
          _state = readParenting(store, uid);
          notifyListeners();
        }
      });
    }
  }

  final LocalStore store;
  final ParentingRemote remote;
  final String? uid;
  final bool doSync;
  final Duration syncDelay;
  bool online;

  late ParentingLocal _state;
  bool _syncing = false;
  bool _again = false;
  bool _disposed = false;
  Timer? _timer;
  StreamSubscription<bool>? _sub;
  StreamSubscription<LocalStoreChange>? _sub2;

  ParentingLocal get state => _state;
  bool get pending => _state.dirty;

  void _commit(ParentingLocal next) {
    _state = next;
    writeParenting(store, uid, next);
    if (!_disposed) notifyListeners();
  }

  Future<void> sync() async {
    if (uid == null || !doSync || _disposed) return;
    if (_syncing) {
      _again = true;
      return;
    }
    _syncing = true;
    try {
      final snap = _state;
      final res = await syncParenting(remote, uid!, snap);
      if (!res.ok || _disposed) return;
      final cur = _state;
      // Changes made while syncing stay (and stay dirty); the merge is idempotent.
      _commit(identical(cur, snap) ? res.state : mergeParenting(cur, res.state).copyState(dirty: true));
      if (!identical(cur, snap)) _again = true;
    } finally {
      _syncing = false;
      if (_again && !_disposed) {
        _again = false;
        unawaited(sync());
      }
    }
  }

  /// Apply a change locally now and queue it for the account copy.
  void update(ParentingLocal Function(ParentingLocal s) fn) {
    _commit(fn(_state).copyState(dirty: true));
    _timer?.cancel();
    _timer = Timer(syncDelay, () => unawaited(sync()));
  }

  /// Device-only change (reminder preference): stored, not marked for upload.
  void updateLocal(ParentingLocal Function(ParentingLocal s) fn) => _commit(fn(_state));

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    unawaited(_sub?.cancel());
    unawaited(_sub2?.cancel());
    super.dispose();
  }
}
