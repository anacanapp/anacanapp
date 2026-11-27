// Ported from: src/hooks/useSwipeNavigation.ts (no vitest suite; table of gestures over the pure tracker)
import 'package:anacan/shell/nav/swipe.dart';
import 'package:flutter_test/flutter_test.dart';

/// (name, rtl, start, moves, end, expected)
typedef Gesture = (String, bool, (double, double), List<(double, double)>, (double, double), SwipeOutcome);

void main() {
  const w = 390.0;
  final cases = <Gesture>[
    ('left edge → right = back', false, (10, 300), [(30, 302), (80, 303)], (120, 304), SwipeOutcome.back),
    ('right edge → left = forward', false, (380, 300), [(340, 300)], (300, 301), SwipeOutcome.forward),
    ('start outside the 55 px edge', false, (60, 300), [(120, 300)], (200, 300), SwipeOutcome.none),
    ('edge at exactly 55 px counts', false, (55, 300), [(100, 300)], (120, 300), SwipeOutcome.back),
    ('vertical first → scroll, dropped', false, (10, 300), [(15, 320)], (120, 330), SwipeOutcome.none),
    ('below the 35 px threshold', false, (10, 300), [(30, 300)], (40, 300), SwipeOutcome.none),
    ('fast flick without moves', false, (10, 300), [], (60, 305), SwipeOutcome.back),
    ('flick too diagonal (dx ≤ 1.5·dy)', false, (10, 300), [], (40, 280), SwipeOutcome.none),
    ('tiny flick', false, (10, 300), [], (20, 300), SwipeOutcome.none),
    ('left edge going left is nothing', false, (40, 300), [(20, 300)], (0, 300), SwipeOutcome.none),
    ('ends vertical after settling', false, (10, 300), [(40, 302)], (60, 400), SwipeOutcome.none),
    ('went far then came back: max delta counts', false, (10, 300), [(30, 300), (60, 301)], (30, 300), SwipeOutcome.back),
    ('RTL: right edge → left = back', true, (380, 300), [(340, 300)], (300, 300), SwipeOutcome.back),
    ('RTL: left edge → right = forward', true, (10, 300), [(50, 300)], (90, 300), SwipeOutcome.forward),
    ('RTL: left edge → right is not back', true, (10, 300), [(80, 300)], (120, 300), SwipeOutcome.forward),
  ];

  for (final (name, rtl, start, moves, end, expected) in cases) {
    test(name, () {
      final t = SwipeGestureTracker();
      t.start(start.$1, start.$2, w);
      for (final m in moves) {
        t.move(m.$1, m.$2);
      }
      expect(t.end(end.$1, end.$2, rtl: rtl), expected);
      expect(t.tracking, isFalse);
    });
  }

  test('cancel drops the gesture', () {
    final t = SwipeGestureTracker()..start(10, 300, w);
    t.move(80, 300);
    t.cancel();
    expect(t.end(120, 300, rtl: false), SwipeOutcome.none);
  });

  test('Index thresholds', () {
    final t = SwipeGestureTracker();
    expect((t.edgeWidth, t.threshold), (55, 35));
  });
}
