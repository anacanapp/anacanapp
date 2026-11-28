// Ported from: src/hooks/useSwipeNavigation.ts (edge start, RTL mirroring), src/lib/backButton.ts (dispatchBack
//              layer order). The interactive slide itself has no React source: it is the native iOS back swipe
//              (UINavigationController's interactive pop), which the WebView app never had.
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/design.dart';
import '../nav/back_button.dart';
import '../nav/shell_machine.dart' show edgeBackCanPopRoot;
import '../nav/shell_state.dart';
import '../nav/ids.dart' show ShellGuardContext;

/// A drag must start this close to the leading edge (trailing edge in RTL).
const double kEdgeBackWidth = 20;

/// Released past this fraction of the width → back.
const double kEdgeBackCommitFraction = 0.35;

/// A flick faster than this (px/s, towards back) commits, one the other way cancels.
const double kEdgeBackFlingVelocity = 700;

/// Where the interactive edge swipe is on: iOS. Android has the system back gesture (gesture navigation) or the
/// back button, both delivered to `AndroidBackScope`; a second in-app edge gesture would fight the system one.
final edgeSwipeBackPlatformProvider = Provider<bool>((ref) => defaultTargetPlatform == TargetPlatform.iOS);

/// True when an edge swipe would go back: an overlay/screen-layer handler is registered (sheets in the tree, the
/// blog article, a tool, a feature's inner view) or the shell has a visible layer to pop ([edgeBackCanPopRoot]).
/// Root tabs with nothing open, and gates (not rendered inside the shell), have nothing to go back to.
bool edgeSwipeCanGoBack(BackDispatcher back, ShellState state, ShellGuardContext guard) =>
    back.count(BackLayer.overlay) + back.count(BackLayer.screen) > 0 || edgeBackCanPopRoot(state, guard);

/// The edge swipe's back: the same handlers, guards and order as the back button ([BackDispatcher.dispatch]),
/// except that the root layer is asked only when it pops a visible layer (never a tab switch or the exit toast).
bool edgeSwipeBack(BackDispatcher back, ShellState state, ShellGuardContext guard) {
  if (back.dispatch(layers: const [BackLayer.overlay, BackLayer.screen])) return true;
  if (!edgeBackCanPopRoot(state, guard)) return false;
  return back.dispatch(layers: const [BackLayer.root]);
}

typedef EdgeSwipeBuilder = Widget Function(BuildContext context, Animation<double> progress);

/// Interactive edge swipe-back. A horizontal drag that starts within [edgeWidth] of the leading edge (trailing in
/// RTL) and moves towards the content drives [progress] (0 → 1 of the width); [builder] slides the top layer with
/// it ([EdgeSwipeSlide]). Released past [kEdgeBackCommitFraction] or flicked → the layer slides out, the keyboard
/// closes and [onBack] runs; otherwise it springs back. Pointers starting elsewhere are never claimed, so
/// carousels, the tab content and taps near the edge behave as before; vertical-first movement is left to the
/// scroll views.
class EdgeSwipeBack extends StatefulWidget {
  const EdgeSwipeBack({
    super.key,
    required this.builder,
    required this.canGoBack,
    required this.onBack,
    this.enabled = true,
    this.edgeWidth = kEdgeBackWidth,
  });

  final EdgeSwipeBuilder builder;

  /// Asked when a finger lands on the edge; false leaves the pointer alone.
  final bool Function() canGoBack;
  final VoidCallback onBack;
  final bool enabled;
  final double edgeWidth;

  @override
  State<EdgeSwipeBack> createState() => _EdgeSwipeBackState();
}

class _EdgeSwipeBackState extends State<EdgeSwipeBack> with SingleTickerProviderStateMixin {
  late final AnimationController _progress = AnimationController(vsync: this);
  bool _dragging = false;
  bool _rtl = false;

  double get _width {
    final box = context.findRenderObject();
    return box is RenderBox && box.hasSize && box.size.width > 0 ? box.size.width : 1;
  }

  @override
  void didUpdateWidget(EdgeSwipeBack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled && (_dragging || _progress.value != 0)) {
      _dragging = false;
      _progress.value = 0;
    }
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  bool _canStart(PointerDownEvent event) {
    if (!widget.enabled || _dragging || _progress.isAnimating || _progress.value != 0) return false;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return false;
    final x = box.globalToLocal(event.position).dx;
    final onEdge = _rtl ? x >= box.size.width - widget.edgeWidth : x <= widget.edgeWidth;
    return onEdge && widget.canGoBack();
  }

  void _start() => _dragging = true;

  void _update(double back) {
    if (_dragging) _progress.value = (back / _width).clamp(0.0, 1.0);
  }

  Duration _duration(double distance) => Duration(milliseconds: (300 * distance).round().clamp(90, 300));

  void _end(double velocity) {
    if (!_dragging) return;
    _dragging = false;
    final commit = velocity >= kEdgeBackFlingVelocity ||
        (velocity > -kEdgeBackFlingVelocity && _progress.value >= kEdgeBackCommitFraction);
    if (!commit) {
      _progress.animateTo(0, duration: _duration(_progress.value), curve: Curves.easeOut);
      return;
    }
    _progress.animateTo(1, duration: _duration(1 - _progress.value), curve: Curves.easeOut).whenCompleteOrCancel(() {
      // Stopped early (disabled, disposed): no back.
      if (!mounted || _progress.value < 1) return;
      FocusManager.instance.primaryFocus?.unfocus();
      try {
        widget.onBack();
      } finally {
        // The next layer (or the same one when a guard kept it, e.g. an unsaved-changes dialog) shows in place.
        if (mounted) _progress.value = 0;
      }
    });
  }

  void _cancel() {
    if (!_dragging) return;
    _dragging = false;
    _progress.animateTo(0, duration: _duration(_progress.value), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    _rtl = Directionality.maybeOf(context) == TextDirection.rtl;
    // Always the same detector (also while disabled), so the layers below are never remounted.
    return RawGestureDetector(
      behavior: HitTestBehavior.translucent,
      gestures: {
        _EdgeBackDragRecognizer: GestureRecognizerFactoryWithHandlers<_EdgeBackDragRecognizer>(
          () => _EdgeBackDragRecognizer(debugOwner: this),
          (r) => r
            ..canStart = _canStart
            ..rtl = _rtl
            ..onStart = _start
            ..onUpdate = _update
            ..onEnd = _end
            ..onCancel = _cancel,
        ),
      },
      child: widget.builder(context, _progress),
    );
  }
}

/// Moves [child] with the swipe ([active] = it is the top layer) and gives it the native leading-edge shadow.
/// The widget tree is the same at rest, so the layer keeps its state.
class EdgeSwipeSlide extends StatelessWidget {
  const EdgeSwipeSlide({super.key, required this.progress, required this.child, this.active = true});
  final Animation<double> progress;
  final bool active;
  final Widget child;

  // Native iOS pop shadow (no React source; one-off literal).
  static const BoxDecoration _shadow = BoxDecoration(
    boxShadow: [BoxShadow(color: Color(0x2E000000), blurRadius: 18)],
  );

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.maybeOf(context) == TextDirection.rtl;
    return AnimatedBuilder(
      animation: progress,
      child: child,
      builder: (context, child) {
        final p = active ? progress.value : 0.0;
        return FractionalTranslation(
          translation: Offset(rtl ? -p : p, 0),
          child: DecoratedBox(decoration: p > 0 ? _shadow : const BoxDecoration(), child: child),
        );
      },
    );
  }
}

/// What shows where the top layer moved away from: the app background, slightly dimmed at the start of the swipe.
class EdgeSwipeUnderlay extends StatelessWidget {
  const EdgeSwipeUnderlay({super.key, required this.progress});
  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final bg = AnacanTokens.of(context).a.bg;
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: progress,
        builder: (context, _) {
          final p = progress.value;
          if (p == 0) return const SizedBox.expand();
          // Native iOS dimming of the page below (no React source; one-off literal).
          return ColoredBox(
            color: Color.alphaBlend(Color.fromRGBO(0, 0, 0, 0.08 * (1 - p)), bg),
            child: const SizedBox.expand(),
          );
        },
      ),
    );
  }
}

/// Claims a pointer that lands on the back edge as soon as it moves [_slop] px towards the content (and more
/// sideways than vertically) — earlier than a carousel's or a scroll view's touch slop, so the edge wins there;
/// vertical-first or backwards movement gives it up at once.
class _EdgeBackDragRecognizer extends OneSequenceGestureRecognizer {
  _EdgeBackDragRecognizer({super.debugOwner});

  static const double _slop = 6;

  bool Function(PointerDownEvent event)? canStart;
  bool rtl = false;
  VoidCallback? onStart;
  ValueChanged<double>? onUpdate;
  ValueChanged<double>? onEnd;
  VoidCallback? onCancel;

  int? _pointer;
  Offset _origin = Offset.zero;
  bool _accepted = false;
  VelocityTracker? _velocity;

  double get _sign => rtl ? -1 : 1;

  @override
  bool isPointerAllowed(PointerDownEvent event) =>
      _pointer == null && super.isPointerAllowed(event) && (canStart?.call(event) ?? false);

  @override
  void addAllowedPointer(PointerDownEvent event) {
    super.addAllowedPointer(event);
    _pointer = event.pointer;
    _origin = event.position;
    _accepted = false;
    _velocity = VelocityTracker.withKind(event.kind)..addPosition(event.timeStamp, event.position);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event.pointer != _pointer) return;
    if (event is PointerMoveEvent) {
      _velocity?.addPosition(event.timeStamp, event.position);
      final d = event.position - _origin;
      final back = d.dx * _sign;
      if (_accepted) {
        onUpdate?.call(back);
      } else if (back > _slop && back > d.dy.abs() * 1.2) {
        _accepted = true;
        resolve(GestureDisposition.accepted);
        if (_accepted) {
          onStart?.call();
          onUpdate?.call(back);
        }
      } else if (d.dy.abs() > _slop || back < -_slop) {
        resolve(GestureDisposition.rejected);
      }
    } else if (event is PointerUpEvent) {
      if (_accepted) {
        final v = (_velocity?.getVelocity().pixelsPerSecond.dx ?? 0) * _sign;
        stopTrackingPointer(event.pointer);
        onEnd?.call(v);
      } else {
        resolve(GestureDisposition.rejected);
      }
    } else if (event is PointerCancelEvent) {
      if (_accepted) {
        stopTrackingPointer(event.pointer);
        onCancel?.call();
      } else {
        resolve(GestureDisposition.rejected);
      }
    }
  }

  @override
  void rejectGesture(int pointer) {
    final wasAccepted = _accepted;
    stopTrackingPointer(pointer);
    if (wasAccepted) onCancel?.call();
  }

  @override
  void didStopTrackingLastPointer(int pointer) {
    _pointer = null;
    _accepted = false;
    _velocity = null;
  }

  @override
  String get debugDescription => 'edge swipe back';
}
