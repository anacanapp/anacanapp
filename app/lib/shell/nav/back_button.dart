// Ported from: src/lib/backButton.ts (pushBackHandler, dispatchBack, layer order, exit on second press
//              within 2 s), src/hooks/useOverlayBackHandler.ts
import 'package:flutter/foundation.dart';

/// True = the press was consumed (the app stays open).
typedef BackHandler = bool Function();

/// Layers asked in this order: open dialogs/sheets/drawers, then screen/tool-internal navigation,
/// then Index's screen hierarchy.
enum BackLayer { overlay, screen, root }

/// The layered handler stack of backButton.ts. Inside a layer the most recently registered handler is
/// asked first. Flutter `Navigator` routes (dialogs, [showASheet]) are popped by the framework before
/// this stack is consulted, so they behave as the top of the `overlay` layer.
class BackDispatcher {
  final Map<BackLayer, List<BackHandler>> _handlers = {for (final l in BackLayer.values) l: <BackHandler>[]};

  /// `pushBackHandler(handler, layer)`; returns the unregister function.
  VoidCallback push(BackHandler handler, [BackLayer layer = BackLayer.screen]) {
    final list = _handlers[layer]!;
    list.add(handler);
    return () {
      final i = list.lastIndexOf(handler);
      if (i != -1) list.removeAt(i);
    };
  }

  /// `dispatchBack()`: true when someone consumed the press. A throwing handler is skipped.
  bool dispatch() {
    for (final layer in BackLayer.values) {
      final list = _handlers[layer]!;
      for (var i = list.length - 1; i >= 0; i--) {
        try {
          if (list[i]()) return true;
        } catch (e) {
          debugPrint('Back handler error: $e');
        }
      }
    }
    return false;
  }

  /// Registered handler count (tests, debug).
  int count([BackLayer? layer]) =>
      layer == null ? _handlers.values.fold(0, (n, l) => n + l.length) : _handlers[layer]!.length;

  @visibleForTesting
  void reset() {
    for (final l in _handlers.values) {
      l.clear();
    }
  }
}

/// What the root of the app does with an unconsumed back press.
enum BackExitDecision { showToast, exit }

/// Second press within 2 s exits; otherwise the "press again" toast (1 800 ms).
class BackExitPolicy {
  BackExitPolicy({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  static const Duration window = Duration(milliseconds: 2000);
  static const Duration toastDuration = Duration(milliseconds: 1800);
  static const String toastKey = 'back_press_again';
  static const String toastAz = 'Çıxmaq üçün yenidən basın';

  final DateTime Function() _clock;
  int _lastPress = 0;

  BackExitDecision press() {
    final now = _clock().millisecondsSinceEpoch;
    if (now - _lastPress < window.inMilliseconds) return BackExitDecision.exit;
    _lastPress = now;
    return BackExitDecision.showToast;
  }
}
