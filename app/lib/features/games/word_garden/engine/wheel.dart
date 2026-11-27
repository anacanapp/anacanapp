// Ported from: src/components/games/word-garden/wheel.ts
library;

import 'dart:math' as math;

import '../../common/engine/fdlibm.dart';
import '../../common/engine/js.dart';

class WheelPoint {
  const WheelPoint(this.x, this.y);
  final double x;
  final double y;
  Map<String, Object?> toJson() => {'x': x, 'y': y};
}

List<int> selectWheelLetter(List<int> selected, int index) {
  if (selected.isNotEmpty && selected.last == index) return selected;
  if (selected.length > 1 && selected[selected.length - 2] == index) return selected.sublist(0, selected.length - 1);
  return selected.contains(index) ? selected : [...selected, index];
}

List<WheelPoint> wheelPoints(int count) => [
      for (var index = 0; index < count; index++)
        WheelPoint(150 + jsSin(index * 2 * math.pi / count) * 105, 150 - jsCos(index * 2 * math.pi / count) * 105),
    ];

/// V8's `Math.hypot` (scaled, Kahan-compensated sum).
double jsHypot(List<double> values) {
  var max = 0.0;
  for (final value in values) {
    final abs = value.abs();
    if (abs.isInfinite) return double.infinity;
    if (abs.isNaN) return double.nan;
    if (abs > max) max = abs;
  }
  if (max == 0) return 0;
  var sum = 0.0, compensation = 0.0;
  for (final value in values) {
    final n = value.abs() / max;
    final summand = n * n - compensation;
    final preliminary = sum + summand;
    compensation = (preliminary - sum) - summand;
    sum = preliminary;
  }
  return math.sqrt(sum) * max;
}

List<int> crossedLetters(WheelPoint from, WheelPoint to, List<WheelPoint> points) {
  final dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  final hits = <({int index, double position, double distance})>[];
  for (var index = 0; index < points.length; index++) {
    final point = points[index];
    final position = length != 0 ? math.max(0.0, math.min(1.0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length)) : 0.0;
    final distance = jsHypot([from.x + dx * position - point.x, from.y + dy * position - point.y]);
    if (distance <= 24) hits.add((index: index, position: position, distance: distance));
  }
  stableSort(hits, (a, b) => a.position - b.position);
  return [for (final hit in hits) hit.index];
}
