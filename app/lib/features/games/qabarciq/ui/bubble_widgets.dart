// Ported from: src/components/games/qabarciq/BubblePop.tsx (HeroBubbles, Avatar, bubbles / ghosts / bursts),
//              src/components/games/qabarciq/bubble-pop.css
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';

/// bubble-pop.css `.bp-screen` custom properties and the one-off literals of the stylesheet.
abstract final class BubbleColors {
  static const Color coral = Color(0xFFFF5A5F);
  static const Color coral2 = Color(0xFFFF7A6B);
  static const Color peach = Color(0xFFFFE3D8);
  static const Color cream = Color(0xFFFFF8F4);
  static const Color ink = Color(0xFF4A3A36);
  static const Color muted = Color(0xFF9A817A);
  static const Color line = Color(0xFFF3DDD3);
  static const Color white = Color(0xFFFFFFFF);
}

/// `[data-color="0…5"]`: `--base`, `--hi`, `--lo`.
const List<({Color base, Color hi, Color lo})> bubblePalette = [
  (base: Color(0xFFF47C7C), hi: Color(0xFFFFB3AD), lo: Color(0xFFD95A5C)),
  (base: Color(0xFFF9A66C), hi: Color(0xFFFFD0A8), lo: Color(0xFFE0834A)),
  (base: Color(0xFF6FCD9E), hi: Color(0xFFB5ECD0), lo: Color(0xFF46A97A)),
  (base: Color(0xFFB49BEA), hi: Color(0xFFDCCDFA), lo: Color(0xFF8D6FD3)),
  (base: Color(0xFF78B5F0), hi: Color(0xFFBFDCFA), lo: Color(0xFF4F90D6)),
  (base: Color(0xFFF5D061), hi: Color(0xFFFDEAAA), lo: Color(0xFFD9AE32)),
];

/// `.bp-bubble::before`: the glossy sphere (radial highlight at 33 % / 28 %, inner and drop shadow).
class BubblePainter extends CustomPainter {
  BubblePainter(this.color, {this.brightness = 1});
  final int color;
  final double brightness;

  @override
  void paint(Canvas canvas, Size size) {
    final p = bubblePalette[color];
    final rect = Offset.zero & size;
    final radius = size.width / 2;
    final center = rect.center;
    // box-shadow: 0 2px 4px -1px var(--lo)
    canvas.drawCircle(center.translate(0, 2), radius - 1, Paint()
      ..color = p.lo
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2));
    final gradient = RadialGradient(
      center: const Alignment(-0.34, -0.44),
      radius: 0.98, // farthest corner from (33 %, 28 %)
      colors: [BubbleColors.white, BubbleColors.white, p.hi, p.base, p.lo],
      stops: const [0, 0.09, 0.22, 0.64, 1],
    );
    canvas.drawCircle(center, radius, Paint()..shader = gradient.createShader(rect));
    // inset 0 -2px 4px #0000000d
    canvas.save();
    canvas.clipPath(Path()..addOval(rect));
    canvas.drawCircle(center.translate(0, 2 + radius * 2), radius * 2, Paint()
      ..color = const Color(0x0D000000)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2));
    canvas.restore();
    if (brightness != 1) {
      canvas.drawCircle(center, radius, Paint()..color = BubbleColors.white.withValues(alpha: (brightness - 1).clamp(0, 1).toDouble()));
    }
  }

  @override
  bool shouldRepaint(BubblePainter old) => old.color != color || old.brightness != brightness;
}

/// One `.bp-bubble` button: moves to its cell with the 260 ms overshoot transition, drops in from above when
/// freshly spawned, shakes on a lonely tap and pulses while a booster is armed.
class BubbleView extends StatefulWidget {
  const BubbleView({
    super.key,
    required this.color,
    required this.position,
    required this.cell,
    required this.drop,
    required this.shake,
    required this.picking,
    required this.onDown,
    required this.label,
    this.reduceMotion = false,
  });
  final int color;
  final Offset position;
  final double cell;

  /// Cells to fall from (0 = no drop animation).
  final int drop;
  final bool shake;
  final bool picking;
  final VoidCallback onDown;
  final String label;
  final bool reduceMotion;

  @override
  State<BubbleView> createState() => _BubbleViewState();
}

class _BubbleViewState extends State<BubbleView> with TickerProviderStateMixin {
  static const Curve _move = Cubic(0.34, 1.3, 0.64, 1);
  static const Curve _dropCurve = Cubic(0.34, 1.25, 0.64, 1);
  late final AnimationController _position = AnimationController(vsync: this, duration: const Duration(milliseconds: 260), value: 1);
  late final AnimationController _drop = AnimationController(vsync: this, duration: const Duration(milliseconds: 340), value: 1);
  late final AnimationController _nope = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
  late Offset _from = widget.position;
  late double _dropPx = widget.drop * widget.cell + widget.cell;

  @override
  void initState() {
    super.initState();
    if (widget.drop > 0 && !widget.reduceMotion) _drop.forward(from: 0);
    if (widget.picking && !widget.reduceMotion) _glow.repeat();
  }

  @override
  void didUpdateWidget(BubbleView old) {
    super.didUpdateWidget(old);
    if (old.position != widget.position) {
      _from = Offset.lerp(_from, old.position, _move.transform(_position.value))!;
      if (widget.reduceMotion) {
        _from = widget.position;
      } else {
        _position.forward(from: 0);
      }
    }
    if (widget.shake && !old.shake && !widget.reduceMotion) _nope.forward(from: 0);
    if (widget.picking != old.picking) {
      if (widget.picking && !widget.reduceMotion) {
        _glow.repeat();
      } else {
        _glow
          ..stop()
          ..value = 0;
      }
    }
    _dropPx = widget.drop * widget.cell + widget.cell;
  }

  @override
  void dispose() {
    _position.dispose();
    _drop.dispose();
    _nope.dispose();
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cell = widget.cell;
    return AnimatedBuilder(
      animation: Listenable.merge([_position, _drop, _nope, _glow]),
      builder: (context, _) {
        var pos = Offset.lerp(_from, widget.position, _move.transform(_position.value))!;
        if (_drop.isAnimating) pos = Offset(pos.dx, widget.position.dy - _dropPx * (1 - _dropCurve.transform(_drop.value)));
        final t = _nope.value;
        final nopeX = !_nope.isAnimating ? 0.0 : t < 0.25 ? -3 * t / 0.25 : t < 0.75 ? -3 + 6 * (t - 0.25) / 0.5 : 3 * (1 - (t - 0.75) / 0.25);
        final g = _glow.value, phase = g < 0.5 ? g * 2 : (1 - g) * 2;
        final glow = _glow.isAnimating ? ACurves.cssEaseInOut.transform(phase) : 0.0;
        return Positioned(
          left: pos.dx,
          top: pos.dy,
          width: cell,
          height: cell,
          child: Semantics(
            button: true,
            label: widget.label,
            child: Listener(
              behavior: HitTestBehavior.opaque,
              onPointerDown: (_) => widget.onDown(),
              child: Padding(
                padding: EdgeInsets.all(cell * 0.05),
                child: Transform.translate(
                  offset: Offset(nopeX, 0),
                  child: Transform.scale(
                    scale: 1 - 0.06 * glow,
                    child: CustomPaint(painter: BubblePainter(widget.color, brightness: 1 + 0.12 * glow), size: Size.infinite),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// `.bp-ghost`: the popped bubble scaling to 1.35 (opacity .6) then 1.6 (0) over 320 ms.
class BubbleGhost extends StatelessWidget {
  const BubbleGhost({super.key, required this.color, required this.position, required this.cell});
  final int color;
  final Offset position;
  final double cell;
  @override
  Widget build(BuildContext context) => Positioned(
        left: position.dx,
        top: position.dy,
        width: cell,
        height: cell,
        child: IgnorePointer(
          child: Padding(
            padding: EdgeInsets.all(cell * 0.05),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 320),
              curve: ACurves.cssEaseOut,
              builder: (context, t, child) {
                final scale = t < 0.6 ? 1 + 0.35 * t / 0.6 : 1.35 + 0.25 * (t - 0.6) / 0.4;
                final opacity = t < 0.6 ? 1 - 0.4 * t / 0.6 : 0.6 * (1 - (t - 0.6) / 0.4);
                return Opacity(opacity: opacity.clamp(0, 1).toDouble(), child: Transform.scale(scale: scale, child: child));
              },
              child: CustomPaint(painter: BubblePainter(color), size: Size.infinite),
            ),
          ),
        ),
      );
}

/// `.bp-burst`: eight sparks flying out (600 ms) and the rising `+N` (750 ms).
class BubbleBurst extends StatelessWidget {
  const BubbleBurst({super.key, required this.color, required this.center, required this.text});
  final int color;
  final Offset center;
  final String text;

  static const List<Offset> _sparks = [
    Offset(-34, -26), Offset(30, -30), Offset(38, 8), Offset(-36, 12), Offset(-8, -40), Offset(12, 36), Offset(-22, 32), Offset(24, 28),
  ];

  @override
  Widget build(BuildContext context) {
    final p = bubblePalette[color];
    Color sparkColor(int i) => i == 4 || i == 5 ? BubbleColors.white : i == 7 ? p.hi : p.base;
    return Positioned(
      left: center.dx,
      top: center.dy,
      child: IgnorePointer(
        child: SizedBox(
          width: 0,
          height: 0,
          child: Stack(clipBehavior: Clip.none, children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 600),
              curve: ACurves.cssEaseOut,
              builder: (context, t, _) => Stack(clipBehavior: Clip.none, children: [
                for (var i = 0; i < _sparks.length; i++)
                  Positioned(
                    left: -3.5 + _sparks[i].dx * t,
                    top: -3.5 + _sparks[i].dy * t,
                    child: Opacity(
                      opacity: (1 - t).clamp(0, 1).toDouble(),
                      child: Transform.scale(
                        scale: 1 - 0.7 * t,
                        child: Container(width: 7, height: 7, decoration: BoxDecoration(color: sparkColor(i), shape: BoxShape.circle)),
                      ),
                    ),
                  ),
              ]),
            ),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 750),
              curve: ACurves.cssEaseOut,
              builder: (context, t, child) {
                // 0 %: −30 % scale .6 opacity 0 · 20 %: −60 % scale 1.1 opacity 1 · 100 %: −160 % scale 1 opacity 0
                final double y, scale, opacity;
                if (t < 0.2) {
                  final k = t / 0.2;
                  y = -0.3 - 0.3 * k;
                  scale = 0.6 + 0.5 * k;
                  opacity = k;
                } else {
                  final k = (t - 0.2) / 0.8;
                  y = -0.6 - 1.0 * k;
                  scale = 1.1 - 0.1 * k;
                  opacity = 1 - k;
                }
                return FractionalTranslation(
                  translation: Offset(-0.5, y),
                  child: Opacity(opacity: opacity.clamp(0, 1).toDouble(), child: Transform.scale(scale: scale, child: child)),
                );
              },
              child: Stack(children: [
                Text(text,
                    softWrap: false,
                    style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                        foreground: Paint()
                          ..style = PaintingStyle.stroke
                          ..strokeWidth = 2
                          ..color = p.lo)),
                Text(text,
                    softWrap: false,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                      color: BubbleColors.white,
                      shadows: [Shadow(color: p.lo, offset: const Offset(0, 2)), const Shadow(color: Color(0x26000000), offset: Offset(0, 4), blurRadius: 10)],
                    )),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `HeroBubbles`: the 260 × 230 lobby illustration (floating bubbles, sparkles).
class HeroBubbles extends StatefulWidget {
  const HeroBubbles({super.key, required this.width});
  final double width;
  @override
  State<HeroBubbles> createState() => _HeroBubblesState();
}

class _HeroBubblesState extends State<HeroBubbles> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 3400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_controller.isAnimating) _controller.repeat();
    } else {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: SizedBox(
          width: widget.width,
          height: widget.width * 230 / 260,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => CustomPaint(painter: _HeroPainter(_controller.isAnimating ? _controller.value : null)),
          ),
        ),
      );
}

class _HeroPainter extends CustomPainter {
  _HeroPainter(this.t);
  final double? t;

  static const List<(double, double, double, int)> _circles = [
    (72, 88, 44, 0), (140, 70, 34, 2), (190, 100, 30, 3), (118, 130, 52, 1), (184, 160, 40, 5), (64, 158, 32, 0), (98, 196, 26, 4),
  ];
  static const List<Color> _colors = [Color(0xFFF47C7C), Color(0xFFF9A66C), Color(0xFF7FD1A8), Color(0xFFB79CEB), Color(0xFF7FB8F0), Color(0xFFF7D66B)];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 260, size.height / 230);
    canvas.drawCircle(const Offset(130, 125), 104, Paint()..color = BubbleColors.peach.withValues(alpha: 0.55));
    for (var i = 0; i < _circles.length; i++) {
      final (x, y, r, c) = _circles[i];
      var dy = 0.0, scale = 1.0;
      if (t != null) {
        // bp-float 3.4 s ease-in-out, delay i·0.35 s: 50 % → translateY(−5px) scale(1.03)
        var local = (t! - i * 0.35 / 3.4) % 1;
        if (local < 0) local += 1;
        final phase = local < 0.5 ? local * 2 : (1 - local) * 2;
        final k = ACurves.cssEaseInOut.transform(phase);
        dy = -5 * k;
        scale = 1 + 0.03 * k;
      }
      final center = Offset(x, y + dy);
      final radius = r * scale;
      final rect = Rect.fromCircle(center: center, radius: radius);
      final color = _colors[c];
      final shader = RadialGradient(
        center: const Alignment(-0.3, -0.4),
        radius: 0.7,
        colors: [const Color(0xF2FFFFFF), color.withValues(alpha: 0.75), color],
        stops: const [0, 0.22, 1],
      ).createShader(rect);
      canvas.drawCircle(center, radius, Paint()..shader = shader);
    }
    const sparkles = [(34.0, 70.0), (226.0, 64.0), (222.0, 190.0), (40.0, 206.0), (150.0, 24.0)];
    for (var i = 0; i < sparkles.length; i++) {
      final (x, y) = sparkles[i];
      final path = Path()
        ..moveTo(x, y - 7)
        ..relativeLineTo(2, 5)
        ..relativeLineTo(5, 2)
        ..relativeLineTo(-5, 2)
        ..relativeLineTo(-2, 5)
        ..relativeLineTo(-2, -5)
        ..relativeLineTo(-5, -2)
        ..relativeLineTo(5, -2)
        ..close();
      canvas.drawPath(path, Paint()..color = i.isOdd ? const Color(0xFFB79CEB) : const Color(0xFFF9A66C));
    }
  }

  @override
  bool shouldRepaint(_HeroPainter old) => old.t != t;
}

/// `Avatar`: the profile photo, or the first letter on one of six tones (`charCodeAt(0) % 6`).
class BubbleAvatar extends StatelessWidget {
  const BubbleAvatar({super.key, required this.name, required this.avatarUrl});
  final String name;
  final String? avatarUrl;

  static const List<Color> _tones = [Color(0xFFF47C7C), Color(0xFFF9A66C), Color(0xFF5FC596), Color(0xFFA98BE6), Color(0xFF6AA9EA), Color(0xFFE8BF3C)];

  @override
  Widget build(BuildContext context) {
    final label = name;
    final tone = label.isEmpty ? 0 : label.codeUnitAt(0) % 6;
    final initial = label.trim().isEmpty ? '' : String.fromCharCodes(label.trim().runes.take(1)).toUpperCase();
    final fallback = Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(color: _tones[tone], shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(initial, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: BubbleColors.white)),
    );
    if (avatarUrl == null) return ExcludeSemantics(child: fallback);
    return ClipOval(
      child: Image.network(avatarUrl!, width: 34, height: 34, fit: BoxFit.cover, excludeFromSemantics: true, errorBuilder: (_, _, _) => fallback),
    );
  }
}

/// `.bp-clock` ring: `stroke-dasharray = 2π·26`, offset by the elapsed share (rotated −90°).
class ClockRingPainter extends CustomPainter {
  ClockRingPainter(this.fraction);
  final double fraction;
  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 60;
    final center = size.center(Offset.zero);
    final radius = 26 * scale;
    final stroke = 5 * scale;
    canvas.drawCircle(center, radius, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0x40FFFFFF));
    final sweep = 2 * math.pi * fraction.clamp(0, 1);
    if (sweep <= 0) return;
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -math.pi / 2, sweep, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = BubbleColors.white);
  }

  @override
  bool shouldRepaint(ClockRingPainter old) => old.fraction != fraction;
}
