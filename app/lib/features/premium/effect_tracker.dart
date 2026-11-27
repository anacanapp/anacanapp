// Ported from: React `useEffect(fn, deps)` semantics used by the paywalls (no React file of its own)
//
// Runs a callback after the frame when its dependency list changed since the last build (always on the first
// build), so ported effects keep React's "after render, when deps change" timing.

import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/scheduler.dart';

class EffectTracker {
  final Map<String, List<Object?>> _deps = {};
  bool disposed = false;

  /// Schedules [effect] after this frame when [deps] differ from the previous build's.
  void effect(String id, List<Object?> deps, void Function() effect) {
    final previous = _deps[id];
    if (previous != null && listEquals(previous, deps)) return;
    _deps[id] = List<Object?>.of(deps);
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!disposed) effect();
    });
  }
}
