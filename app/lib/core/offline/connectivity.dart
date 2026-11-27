// Ported from: src/hooks/useOnlineStatus.ts (navigator.onLine + 'online'/'offline' events),
// the `online` triggers in src/lib/offline-outbox.ts and src/contexts/AuthContext.tsx.
//
// connectivity_plus behind an interface: "online" = some network interface is up (the same
// meaning as `navigator.onLine`, which is also not a reachability check).

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract interface class ConnectivitySource {
  /// Last known state (`navigator.onLine`). True until the first check says otherwise.
  bool get isOnline;

  /// Distinct online/offline transitions (`online` / `offline` events).
  Stream<bool> get onlineChanges;
}

/// Manually driven source (tests, previews).
class ManualConnectivitySource implements ConnectivitySource {
  ManualConnectivitySource({bool online = true}) : _online = online; // ignore: prefer_initializing_formals
  bool _online;
  final StreamController<bool> _controller = StreamController<bool>.broadcast(sync: true);

  @override
  bool get isOnline => _online;

  @override
  Stream<bool> get onlineChanges => _controller.stream;

  void setOnline(bool online) {
    if (online == _online) return;
    _online = online;
    _controller.add(online);
  }
}

bool _anyUp(List<ConnectivityResult> results) => results.any((r) => r != ConnectivityResult.none);

/// connectivity_plus implementation.
class ConnectivityPlusSource implements ConnectivitySource {
  ConnectivityPlusSource([Connectivity? connectivity]) : _connectivity = connectivity ?? Connectivity() {
    _subscription = _connectivity.onConnectivityChanged.listen(_set, onError: (Object _) {});
    unawaited(_connectivity.checkConnectivity().then(_set, onError: (Object _) {}));
  }

  final Connectivity _connectivity;
  late final StreamSubscription<List<ConnectivityResult>> _subscription;
  final StreamController<bool> _controller = StreamController<bool>.broadcast(sync: true);
  bool _online = true;

  void _set(List<ConnectivityResult> results) {
    final online = _anyUp(results);
    if (online == _online) return;
    _online = online;
    _controller.add(online);
  }

  @override
  bool get isOnline => _online;

  @override
  Stream<bool> get onlineChanges => _controller.stream;

  Future<void> dispose() async {
    await _subscription.cancel();
    await _controller.close();
  }
}

/// The device connectivity. Override with a [ManualConnectivitySource] in tests.
final connectivitySourceProvider = Provider<ConnectivitySource>((ref) {
  final source = ConnectivityPlusSource();
  ref.onDispose(() => unawaited(source.dispose()));
  return source;
});

/// `useOnlineStatus()`.
final onlineStatusProvider = NotifierProvider<OnlineStatus, bool>(OnlineStatus.new);

class OnlineStatus extends Notifier<bool> {
  @override
  bool build() {
    final source = ref.watch(connectivitySourceProvider);
    final sub = source.onlineChanges.listen((online) => state = online);
    ref.onDispose(sub.cancel);
    return source.isOnline;
  }
}
