// Ported from: src/components/games/leaf-flight/FlightCanvas.tsx
//
// The flight canvas as a CustomPainter: sky, sun, drifting clouds, two hill layers, wind bands with arrows,
// branches with their gaps (moving ones follow `flightGateGaps`), dashed secret passages, stars, the flag and
// Tumurcuq under the leaf parachute (blinking while shielded), lift streaks and the wind marker. Drawn in the
// 720-unit-high world scaled to the canvas height; it repaints on every frame of [repaint].
library;

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../engine/engine.dart';

class FlightPainter extends CustomPainter {
  FlightPainter({required this.level, required this.state, required this.lifting, required this.image, required Listenable repaint}) : super(repaint: repaint);
  final FlightLevel level;

  /// The live round (read on every paint, like the canvas reading `state.current`).
  final FlightState? Function() state;
  final bool Function() lifting;
  final ui.Image? Function() image;

  static Paint _fill(Color color) => Paint()..color = color;
  static Paint _stroke(Color color, double width) => Paint()
    ..color = color
    ..style = PaintingStyle.stroke
    ..strokeWidth = width;

  static void _ellipse(Canvas canvas, double x, double y, double rx, double ry, double rotation, Paint paint) {
    canvas.save();
    canvas.translate(x, y);
    if (rotation != 0) canvas.rotate(rotation);
    canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: rx * 2, height: ry * 2), paint);
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;
    final scale = size.height / flightHeight, width = size.width / scale;
    final round = state();
    final distance = round?.distance ?? 0, time = round?.time ?? 0, y = round?.y ?? 360;
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.scale(scale);

    final skyRect = Rect.fromLTWH(0, 0, width, flightHeight);
    canvas.drawRect(
      skyRect,
      Paint()
        ..shader = ui.Gradient.linear(Offset.zero, const Offset(0, flightHeight),
            const [Color(0xFFE9EDF5), Color(0xFFF6EEDA), Color(0xFFD5E4C2)], const [0, .6, 1]),
    );
    canvas.drawCircle(Offset(width - 65, 95), 44, _fill(const Color(0xFFFFF4C3)));
    for (var i = 0; i < 6; i++) {
      final span = width + 230;
      final x = ((i * 230 - distance * .18) % span + span) % span - 110;
      final cy = 110.0 + i % 3 * 60;
      _ellipse(canvas, x, cy, 63, 14, 0, _fill(const Color(0xA6FFFDF3)));
    }
    for (var layer = 0; layer < 2; layer++) {
      final path = Path()..moveTo(0, flightHeight);
      for (var x = 0.0; x <= width + 20; x += 20) {
        path.lineTo(x, 615 + layer * 45 + math.sin((x + distance * (.1 + layer * .06)) / (110 - layer * 30)) * 38);
      }
      path
        ..lineTo(width, flightHeight)
        ..close();
      canvas.drawPath(path, _fill(layer == 1 ? const Color(0x7AA1BEA2) : const Color(0x7AC1D1B1)));
    }
    for (final wind in level.winds) {
      final x = wind.from - distance, span = wind.to - wind.from;
      if (x > width || x + span < 0) continue;
      canvas.drawRect(Rect.fromLTWH(x, 0, span, flightHeight), _fill(const Color(0x38C7DFD3)));
      final line = _stroke(const Color(0x5C89B1A2), 2);
      for (var j = 0; j < 6; j++) {
        final py = ((j * 128 + time * (wind.force < 0 ? -35 : 35)) % 760 + 760) % 760;
        canvas.drawPath(
          Path()
            ..moveTo(x + 24, py + 6)
            ..quadraticBezierTo(x + span / 2, py - 15, x + span - 20, py),
          line,
        );
        final ax = x + span / 2, up = wind.force < 0;
        canvas.drawPath(
          Path()
            ..moveTo(ax - 6, py + (up ? 5 : -5))
            ..lineTo(ax, py + (up ? -3 : 3))
            ..lineTo(ax + 6, py + (up ? 5 : -5)),
          line,
        );
      }
    }
    void branch(double x, double from, double to, double breadth) {
      if (to <= from) return;
      canvas.drawRect(Rect.fromLTWH(x + 7, from, breadth - 14, to - from), _fill(const Color(0xFFAA947A)));
      canvas.drawLine(Offset(x + breadth / 2, from + 5), Offset(x + breadth / 2 - 5, to - 5), _stroke(const Color(0x45796B53), 3));
      final cap = math.min(16.0, to - from);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, math.max(from, to - 16), breadth, cap), const Radius.circular(8)), _fill(const Color(0xFF8EAE78)));
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, from, breadth, cap), const Radius.circular(8)), _fill(const Color(0xFFA9C78E)));
      for (var py = from + 30; py < to - 25; py += 54) {
        final odd = py % 2 != 0;
        _ellipse(canvas, x + 3, py, 17, 10, -.5, _fill(odd ? const Color(0xFF89A872) : const Color(0xFF95B77C)));
      }
    }

    for (final gate in level.gates) {
      final x = gate.x - distance;
      if (x > width + 20 || x + gate.width < -20) continue;
      final gaps = flightGateGaps(gate, time)..sort((a, b) => a.center.compareTo(b.center));
      var previous = 0.0;
      for (final gap in gaps) {
        branch(x, previous, gap.center - gap.height / 2, gate.width);
        previous = gap.center + gap.height / 2;
      }
      branch(x, previous, flightHeight, gate.width);
      final secret = gate.secret;
      if (secret != null) {
        final oval = Path()..addOval(Rect.fromCenter(center: Offset(x + gate.width / 2, secret.center), width: (gate.width / 2 + 12) * 2, height: (secret.height / 2 - 7) * 2));
        final dash = _stroke(const Color(0x88B6A34E), 1.5);
        for (final metric in oval.computeMetrics()) {
          for (var d = 0.0; d < metric.length; d += 12) {
            canvas.drawPath(metric.extractPath(d, math.min(d + 4, metric.length)), dash);
          }
        }
      }
    }
    for (final star in level.stars) {
      final x = star.x - distance;
      if (x < -20 || x > width + 20 || (round?.collected.contains(star.id) ?? false)) continue;
      final path = Path();
      for (var i = 0; i < 10; i++) {
        final angle = i * math.pi / 5 - math.pi / 2, radius = i.isOdd ? 6.0 : 13.0;
        final sx = x + math.cos(angle) * radius, sy = star.y + math.sin(angle) * radius;
        if (i == 0) {
          path.moveTo(sx, sy);
        } else {
          path.lineTo(sx, sy);
        }
      }
      path.close();
      canvas.drawPath(path, _fill(star.secret ? const Color(0xFFBA96E2) : const Color(0xFFE1B957)));
      canvas.drawPath(path, _stroke(const Color(0xFFFFF7D3), 2));
    }
    final finishX = level.distance + flightPlayerX - distance;
    if (finishX < width + 70) {
      canvas.drawLine(Offset(finishX, 140), Offset(finishX, 600), _stroke(const Color(0xFFA79BC0), 8));
      canvas.drawPath(
        Path()
          ..moveTo(finishX, 140)
          ..lineTo(finishX + 70, 165)
          ..lineTo(finishX, 190)
          ..close(),
        _fill(const Color(0xFFE4C3D1)),
      );
    }

    canvas.save();
    canvas.translate(flightPlayerX, y);
    canvas.rotate(math.max(-.15, math.min(.15, (round?.velocity ?? 0) / 1300)));
    final alpha = round != null && round.shield > 0 && round.hearts < 3 ? (.65 + math.sin(time * 20) * .25).clamp(0.0, 1.0) : 1.0;
    if (alpha < 1) canvas.saveLayer(null, Paint()..color = Color.fromRGBO(0, 0, 0, alpha));
    canvas.drawPath(
      Path()
        ..moveTo(-48, -53)
        ..lineTo(-9, 10)
        ..moveTo(48, -53)
        ..lineTo(9, 10),
      _stroke(const Color(0xFF8D8773), 1.8),
    );
    canvas.drawPath(
      Path()
        ..moveTo(-59, -54)
        ..quadraticBezierTo(-19, -110, 61, -57)
        ..quadraticBezierTo(15, -28, -59, -54),
      Paint()..shader = ui.Gradient.linear(const Offset(-55, -80), const Offset(55, -40), const [Color(0xFFBADB8D), Color(0xFF6DA26D)]),
    );
    canvas.drawPath(
      Path()
        ..moveTo(-54, -56)
        ..quadraticBezierTo(0, -74, 55, -58),
      _stroke(const Color(0x886B9664), 2),
    );
    final picture = image();
    if (picture != null) {
      canvas.drawImageRect(picture, Rect.fromLTWH(0, 0, picture.width.toDouble(), picture.height.toDouble()), const Rect.fromLTWH(-37, -25, 74, 78),
          Paint()..filterQuality = FilterQuality.medium);
    } else {
      _ellipse(canvas, 0, 13, 17, 24, 0, _fill(const Color(0xFFB77AD7)));
    }
    if (alpha < 1) canvas.restore();
    canvas.restore();
    if (lifting()) {
      canvas.drawPath(
        Path()
          ..moveTo(flightPlayerX - 10, y + 65)
          ..lineTo(flightPlayerX - 10, y + 88)
          ..moveTo(flightPlayerX + 10, y + 58)
          ..lineTo(flightPlayerX + 10, y + 78),
        _stroke(const Color(0x8CFFFFFF), 3),
      );
    }
    if (flightWind(level, distance + flightPlayerX) != 0) _ellipse(canvas, width - 30, 38, 8, 4, -.5, _fill(const Color(0xFF6C9B81)));
    canvas.restore();
  }

  @override
  bool shouldRepaint(FlightPainter oldDelegate) => oldDelegate.level != level;
}
