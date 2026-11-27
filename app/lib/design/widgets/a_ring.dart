// Ported from: src/styles/anacan-design.css (.a3-ring svg/.track/.fill/.tip/.core, [dir=rtl] .a3-ring svg,
//              @keyframes a3-draw, .a3-enter .a3-ring .fill, .a3-mini-ring, .a-ring conic + .a-ring-inner),
//              src/components/Dashboard.tsx (ProgressRing: initial dashoffset = circumference, 1s easeOut),
//              src/components/tools/weaning/WeaningScreens.tsx (Ring)
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../motion.dart';
import '../theme.dart';

/// SVG stroke ring (`<circle>` track + `stroke-dasharray` fill, rotated -90deg).
///
/// * Starts at 12 o'clock, clockwise; in RTL `rotate(-90deg) scaleY(-1)` → counter-clockwise.
/// * [drawIn]: on first build the fill draws from empty (`a3-draw`: 1100ms `--a-spring`;
///   Dashboard ProgressRing: pass `drawInDuration: 1s, drawInCurve: ACurves.cssEaseOut`).
/// * Value changes animate (`transition: stroke-dashoffset 700ms var(--a-spring)`).
/// * Reduced motion disables both (anacan-design.css `prefers-reduced-motion`).
class ARing extends StatefulWidget {
  const ARing({
    super.key,
    required this.progress,
    this.size = 120,
    this.strokeWidth = 10,
    this.trackColor,
    this.fillColor,
    this.roundCap = true,
    this.tip = false,
    this.tipRadius,
    this.drawIn = true,
    this.drawInDuration = ADurations.ringDraw,
    this.drawInCurve,
    this.changeDuration = ADurations.ringChange,
    this.mirrorInRtl = true,
    this.child,
  });

  /// 0..1.
  final double progress;
  final double size;
  final double strokeWidth;

  /// Default `.a3-ring .track`: rgba(255, 90, 95, 0.16).
  final Color? trackColor;

  /// Default `.a3-ring .fill`: `--a-coral`.
  final Color? fillColor;
  final bool roundCap;

  /// `.a3-ring .tip`: dot at the arc end, fill `--a-coral`, stroke `--a-surface` 2.5.
  final bool tip;
  final double? tipRadius;
  final bool drawIn;
  final Duration drawInDuration;
  final Curve? drawInCurve;
  final Duration changeDuration;
  final bool mirrorInRtl;

  /// `.core` content (centred).
  final Widget? child;

  /// `.a3-ring .track` colour.
  static const Color defaultTrack = Color(0x29FF5A5F);

  @override
  State<ARing> createState() => _ARingState();
}

class _ARingState extends State<ARing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  double _from = 0;
  double _to = 0;
  Curve _curve = ACurves.spring;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _to = widget.progress;
    if (widget.drawIn && !animationsDisabled(context)) {
      _from = 0;
      _curve = widget.drawInCurve ?? ACurves.spring;
      _c.duration = widget.drawInDuration;
      _c.forward(from: 0);
    } else {
      _from = _to;
      _c.value = 1;
    }
  }

  @override
  void didUpdateWidget(ARing old) {
    super.didUpdateWidget(old);
    if (old.progress != widget.progress) {
      _from = _current;
      _to = widget.progress;
      if (animationsDisabled(context)) {
        _from = _to;
        _c.value = 1;
        return;
      }
      _curve = ACurves.spring;
      _c.duration = widget.changeDuration;
      _c.forward(from: 0);
    }
  }

  double get _current => _from + (_to - _from) * _curve.transform(_c.value);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final rtl = widget.mirrorInRtl && Directionality.maybeOf(context) == TextDirection.rtl;
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) => CustomPaint(
                painter: ARingPainter(
                  progress: _current,
                  strokeWidth: widget.strokeWidth,
                  trackColor: widget.trackColor ?? ARing.defaultTrack,
                  fillColor: widget.fillColor ?? t.coral,
                  roundCap: widget.roundCap,
                  counterClockwise: rtl,
                  tipRadius: widget.tip ? (widget.tipRadius ?? widget.strokeWidth / 2 + 1.25) : null,
                  tipFill: t.coral,
                  tipStroke: t.surface,
                ),
              ),
            ),
          ),
          if (widget.child != null)
            DefaultTextStyle.merge(textAlign: TextAlign.center, style: const TextStyle(height: 1), child: widget.child!),
        ],
      ),
    );
  }
}

/// Paints the SVG ring: circle radius = (size - strokeWidth) / 2.
class ARingPainter extends CustomPainter {
  ARingPainter({
    required this.progress,
    required this.strokeWidth,
    required this.trackColor,
    required this.fillColor,
    this.roundCap = true,
    this.counterClockwise = false,
    this.tipRadius,
    this.tipFill,
    this.tipStroke,
  });

  final double progress;
  final double strokeWidth;
  final Color trackColor;
  final Color fillColor;
  final bool roundCap;
  final bool counterClockwise;
  final double? tipRadius;
  final Color? tipFill;
  final Color? tipStroke;

  @override
  void paint(Canvas canvas, Size size) {
    final r = (math.min(size.width, size.height) - strokeWidth) / 2;
    final c = size.center(Offset.zero);
    final rect = Rect.fromCircle(center: c, radius: r);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = trackColor;
    canvas.drawCircle(c, r, track);
    final p = progress.clamp(0.0, 1.0);
    if (p <= 0) return;
    final sweep = 2 * math.pi * p * (counterClockwise ? -1 : 1);
    final fill = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = roundCap ? StrokeCap.round : StrokeCap.butt
      ..color = fillColor;
    canvas.drawArc(rect, -math.pi / 2, sweep, false, fill);
    if (tipRadius != null) {
      final a = -math.pi / 2 + sweep;
      final tc = c + Offset(math.cos(a), math.sin(a)) * r;
      canvas.drawCircle(tc, tipRadius!, Paint()..color = tipFill ?? fillColor);
      canvas.drawCircle(
        tc,
        tipRadius!,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..color = tipStroke ?? const Color(0xFFFFFFFF),
      );
    }
  }

  @override
  bool shouldRepaint(ARingPainter old) =>
      old.progress != progress ||
      old.strokeWidth != strokeWidth ||
      old.trackColor != trackColor ||
      old.fillColor != fillColor ||
      old.counterClockwise != counterClockwise ||
      old.tipRadius != tipRadius ||
      old.tipFill != tipFill ||
      old.tipStroke != tipStroke ||
      old.roundCap != roundCap;
}

/// `.a-ring`: 92px disc, `conic-gradient(var(--a-peach-2) calc(var(--pct) * 1%), var(--a-line) 0)`,
/// 6px padding, inner `--a-surface` disc with value (19/800) and label (9.5/700).
/// Conic gradients start at 12 o'clock, clockwise, and do not mirror in RTL. No animation.
class AConicRing extends StatelessWidget {
  const AConicRing({super.key, required this.percent, this.value, this.label, this.size = 92, this.padding = 6, this.fillColor, this.restColor, this.innerColor});

  /// `--pct` (0..100; CSS default 25).
  final double percent;
  final String? value;
  final String? label;
  final double size;
  final double padding;
  final Color? fillColor;
  final Color? restColor;

  /// Inner disc; `null` = `--a-surface`. `.a-par-ring` (ParentingScreens Ring) has none: pass
  /// [Color] `0x00000000` there.
  final Color? innerColor;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final x = context.aText;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _ConicPainter(percent / 100, fillColor ?? t.peach2, restColor ?? t.line),
        child: Padding(
          padding: EdgeInsets.all(padding),
          child: DecoratedBox(
            decoration: BoxDecoration(color: innerColor ?? t.surface, shape: BoxShape.circle),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                if (value != null) Text(value!, style: x.aRingValue),
                if (label != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(label!, style: x.aRingLabel)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ConicPainter extends CustomPainter {
  _ConicPainter(this.fraction, this.fill, this.rest);
  final double fraction;
  final Color fill;
  final Color rest;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2;
    canvas.drawCircle(c, r, Paint()..color = rest);
    final f = fraction.clamp(0.0, 1.0);
    if (f > 0) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2, 2 * math.pi * f, true, Paint()..color = fill);
    }
  }

  @override
  bool shouldRepaint(_ConicPainter old) => old.fraction != fraction || old.fill != fill || old.rest != rest;
}
