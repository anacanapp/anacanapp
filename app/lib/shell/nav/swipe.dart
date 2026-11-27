// Ported from: src/hooks/useSwipeNavigation.ts (edge detection, settle rules, fast-flick fallback,
//              RTL mirroring), src/pages/Index.tsx (edgeWidth 55, threshold 35)

/// Result of a finished edge gesture.
enum SwipeOutcome { none, back, forward }

/// Pure port of the touch handlers of `useSwipeNavigation`.
class SwipeGestureTracker {
  SwipeGestureTracker({this.edgeWidth = 55, this.threshold = 35});

  /// Index passes 55 / 35 (the hook defaults are 50 / 40).
  final double edgeWidth;
  final double threshold;

  double _startX = 0;
  double _startY = 0;
  double _maxDeltaX = 0;
  String? _edge;
  bool _settled = false;

  bool get tracking => _edge != null;

  void _reset() {
    _edge = null;
    _settled = false;
    _maxDeltaX = 0;
  }

  /// `touchstart` at ([x], [y]) on a screen [screenWidth] wide.
  void start(double x, double y, double screenWidth) {
    if (x <= edgeWidth) {
      _edge = 'left';
    } else if (x >= screenWidth - edgeWidth) {
      _edge = 'right';
    } else {
      _reset();
      return;
    }
    _startX = x;
    _startY = y;
    _maxDeltaX = 0;
    _settled = false;
  }

  /// `touchmove`.
  void move(double x, double y) {
    if (_edge == null) return;
    final dx = (x - _startX).abs();
    final dy = (y - _startY).abs();
    if (!_settled && (dx > 10 || dy > 10)) {
      if (dy >= dx) {
        // Vertical first: this is a scroll, drop the gesture.
        _reset();
        return;
      }
      if (dx > dy * 1.5) _settled = true;
    }
    if (dx > _maxDeltaX) _maxDeltaX = dx;
  }

  /// `touchcancel`.
  void cancel() => _reset();

  /// `touchend` at ([x], [y]).
  SwipeOutcome end(double x, double y, {required bool rtl}) {
    final edge = _edge;
    if (edge == null) {
      _reset();
      return SwipeOutcome.none;
    }
    final deltaX = x - _startX;
    final deltaY = y - _startY;
    final absX = deltaX.abs();
    final absY = deltaY.abs();
    if (!_settled) {
      if (absX < 12 && _maxDeltaX < 12) {
        _reset();
        return SwipeOutcome.none;
      }
      if (absX <= absY * 1.5) {
        _reset();
        return SwipeOutcome.none;
      }
      _settled = true;
    }
    if (absY > absX) {
      _reset();
      return SwipeOutcome.none;
    }
    if (absX < threshold && _maxDeltaX < threshold) {
      _reset();
      return SwipeOutcome.none;
    }
    final effective = absX >= threshold ? deltaX : (edge == 'left' ? _maxDeltaX : -_maxDeltaX);
    final backEdge = rtl ? 'right' : 'left';
    final forwardEdge = rtl ? 'left' : 'right';
    final backDelta = rtl ? effective < 0 : effective > 0;
    final forwardDelta = rtl ? effective > 0 : effective < 0;
    _reset();
    if (edge == backEdge && backDelta) return SwipeOutcome.back;
    if (edge == forwardEdge && forwardDelta) return SwipeOutcome.forward;
    return SwipeOutcome.none;
  }
}
