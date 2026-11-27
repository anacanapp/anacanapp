// Ported from: src/lib/celebrate.ts (confetti), the canvas-confetti calls of
//              src/components/partner/LevelUpCelebration.tsx (canvas-confetti 1.x particle model: startVelocity 45,
//              decay 0.9, gravity 1, ticks 200, square/circle shapes, wobble, fade-out)
//
// Two confetti effects drawn with a [CustomPainter] on a throwaway full-screen overlay layer (pointer-transparent):
// [showCelebrateConfetti] = `confetti()` of celebrate.ts, [ConfettiCannon] = canvas-confetti for the level-up.
import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';

// ── celebrate.ts ─────────────────────────────────────────────────────────────────────────────────────────────

class _Bit {
  _Bit({required this.x, required this.y, required this.vx, required this.vy, required this.s, required this.r, required this.vr, required this.c});
  double x, y, vx, vy, s, r, vr;
  final Color c;
}

/// Brand-coloured confetti burst on a throwaway full-screen layer (2.2 s). Skipped on reduced motion / lite.
/// [onStart] is the `hapticFeedback.medium()` of the original.
void showCelebrateConfetti(BuildContext context, {VoidCallback? onStart, math.Random? random}) {
  if (animationsDisabled(context) || AnacanTokens.of(context).lite) return;
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  final a = context.a;
  final colors = [a.coral, a.pinkInk, a.lavInk, a.yellow2, a.green2, a.blue2];
  late OverlayEntry entry;
  entry = OverlayEntry(builder: (_) => IgnorePointer(child: _CelebrateLayer(colors: colors, random: random ?? math.Random(), onDone: () => entry.remove())));
  overlay.insert(entry);
  onStart?.call();
}

class _CelebrateLayer extends StatefulWidget {
  const _CelebrateLayer({required this.colors, required this.random, required this.onDone});
  final List<Color> colors;
  final math.Random random;
  final VoidCallback onDone;

  @override
  State<_CelebrateLayer> createState() => _CelebrateLayerState();
}

class _CelebrateLayerState extends State<_CelebrateLayer> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker(_tick);
  List<_Bit>? _bits;
  Duration _last = Duration.zero;

  @override
  void initState() {
    super.initState();
    _ticker.start();
  }

  void _tick(Duration elapsed) {
    if (elapsed.inMilliseconds >= 2200) {
      _ticker.stop();
      widget.onDone();
      return;
    }
    final bits = _bits;
    if (bits != null) {
      // One step per 60 Hz frame, as requestAnimationFrame.
      final steps = ((elapsed - _last).inMicroseconds / 16667).round().clamp(1, 4);
      for (var i = 0; i < steps; i++) {
        for (final p in bits) {
          p.vy += 0.55;
          p.vx *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
        }
      }
    }
    _last = elapsed;
    setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, c) {
        final rnd = widget.random;
        _bits ??= List.generate(140, (_) => _Bit(
              x: c.maxWidth / 2,
              y: c.maxHeight * 0.35,
              vx: (rnd.nextDouble() - 0.5) * 18,
              vy: -rnd.nextDouble() * 16 - 6,
              s: 4 + rnd.nextDouble() * 5,
              r: rnd.nextDouble() * 6,
              vr: (rnd.nextDouble() - 0.5) * 0.4,
              c: widget.colors[rnd.nextInt(widget.colors.length)],
            ));
        return CustomPaint(size: Size(c.maxWidth, c.maxHeight), painter: _BitsPainter(_bits!));
      });
}

class _BitsPainter extends CustomPainter {
  _BitsPainter(this.bits);
  final List<_Bit> bits;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (final p in bits) {
      canvas.save();
      canvas.translate(p.x, p.y);
      canvas.rotate(p.r);
      paint.color = p.c;
      canvas.drawRect(Rect.fromLTWH(-p.s / 2, -p.s / 4, p.s, p.s / 2), paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_BitsPainter old) => true;
}

// ── canvas-confetti (level-up) ───────────────────────────────────────────────────────────────────────────────

class _Fetti {
  _Fetti({
    required this.x,
    required this.y,
    required this.angle2D,
    required this.velocity,
    required this.color,
    required this.circle,
    required this.wobble,
    required this.wobbleSpeed,
    required this.tiltAngle,
    required this.random,
  });
  double x, y, angle2D, velocity, wobble, wobbleSpeed, tiltAngle;
  final Color color;
  final bool circle;
  final double random;
  int tick = 0;
  static const int totalTicks = 200;
  static const double decay = 0.9;
  static const double gravity = 1;
  static const double scalar = 1;

  bool update() {
    x += math.cos(angle2D) * velocity;
    y += math.sin(angle2D) * velocity + gravity * 3;
    velocity *= decay;
    wobble += wobbleSpeed;
    tiltAngle += 0.1;
    tick++;
    return tick < totalTicks;
  }
}

/// A canvas-confetti emitter: [burst] fires `{particleCount, angle, spread, origin, colors}` like `confetti(opts)`.
class ConfettiCannonController extends ChangeNotifier {
  final List<_Fetti> _fetti = [];
  final math.Random _random;
  Size _size = Size.zero;

  ConfettiCannonController({math.Random? random}) : _random = random ?? math.Random();

  bool get active => _fetti.isNotEmpty;

  /// `confetti({ particleCount, angle, spread, origin: {x, y}, colors })` (startVelocity 45).
  void burst({required int particleCount, double angle = 90, double spread = 45, double originX = 0.5, double originY = 0.5, required List<Color> colors}) {
    if (_size.isEmpty) return;
    final rad = angle * math.pi / 180;
    final spreadRad = spread * math.pi / 180;
    for (var i = 0; i < particleCount; i++) {
      _fetti.add(_Fetti(
        x: originX * _size.width,
        y: originY * _size.height,
        angle2D: -rad + (0.5 * spreadRad - _random.nextDouble() * spreadRad),
        velocity: 45 * 0.5 + _random.nextDouble() * 45,
        color: colors[i % colors.length],
        circle: _random.nextBool(),
        wobble: _random.nextDouble() * 10,
        wobbleSpeed: math.min(0.11, _random.nextDouble() * 0.1 + 0.05),
        tiltAngle: (_random.nextDouble() * (0.75 - 0.25) + 0.25) * math.pi,
        random: _random.nextDouble() + 2,
      ));
    }
    notifyListeners();
  }

  void _step() {
    _fetti.removeWhere((f) => !f.update());
    notifyListeners();
  }

  @override
  void dispose() {
    _fetti.clear();
    super.dispose();
  }
}

/// Full-size, pointer-transparent canvas for a [ConfettiCannonController].
class ConfettiCannon extends StatefulWidget {
  const ConfettiCannon({super.key, required this.controller});
  final ConfettiCannonController controller;

  @override
  State<ConfettiCannon> createState() => _ConfettiCannonState();
}

class _ConfettiCannonState extends State<ConfettiCannon> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker((_) {
    if (widget.controller.active) widget.controller._step();
  });

  @override
  void initState() {
    super.initState();
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: LayoutBuilder(builder: (context, c) {
          widget.controller._size = Size(c.maxWidth, c.maxHeight);
          return CustomPaint(size: Size(c.maxWidth, c.maxHeight), painter: _FettiPainter(widget.controller));
        }),
      );
}

class _FettiPainter extends CustomPainter {
  _FettiPainter(this.controller) : super(repaint: controller);
  final ConfettiCannonController controller;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (final f in controller._fetti) {
      final progress = f.tick / _Fetti.totalTicks;
      final wobbleX = f.x + 10 * _Fetti.scalar * math.cos(f.wobble);
      final wobbleY = f.y + 10 * _Fetti.scalar * math.sin(f.wobble);
      final tiltSin = math.sin(f.tiltAngle);
      final tiltCos = math.cos(f.tiltAngle);
      paint.color = f.color.withValues(alpha: (1 - progress).clamp(0, 1));
      final x1 = f.x + f.random * tiltCos;
      final y1 = f.y + f.random * tiltSin;
      final x2 = wobbleX + f.random * tiltCos;
      final y2 = wobbleY + f.random * tiltSin;
      if (f.circle) {
        canvas.drawOval(Rect.fromCenter(center: Offset(f.x, f.y), width: (x2 - x1).abs() * 0.6 + 1, height: (y2 - y1).abs() * 0.6 + 1), paint);
      } else {
        final path = Path()
          ..moveTo(f.x, f.y)
          ..lineTo(wobbleX, y1)
          ..lineTo(x2, y2)
          ..lineTo(x1, wobbleY)
          ..close();
        canvas.drawPath(path, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_FettiPainter old) => true;
}
