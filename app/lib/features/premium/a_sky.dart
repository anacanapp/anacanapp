// Ported from: src/styles/anacan-design.css (.a-sky, .dark .a-sky, .a-cloud c1–c5, @keyframes a-cloud-drift,
// html.a-lite / reduced-motion .a-cloud { animation: none })
//
// The cloudy brand background of the Premium modal: 330 px of radial washes with five blurred drifting clouds.

import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../../design/design.dart';

class ASky extends StatefulWidget {
  const ASky({super.key});
  @override
  State<ASky> createState() => _ASkyState();
}

/// `.a-cloud.cN`: width, height, top, start/end inset (px or % of width), opacity, animation delay (s).
const List<({double w, double h, double top, double? start, double? end, bool pct, double opacity, double delay})> _clouds = [
  (w: 160, h: 48, top: 34, start: -34, end: null, pct: false, opacity: 1, delay: 0),
  (w: 120, h: 38, top: 84, start: null, end: -22, pct: false, opacity: 0.9, delay: 2.6),
  (w: 92, h: 30, top: 156, start: 12, end: null, pct: true, opacity: 0.7, delay: 5.2),
  (w: 130, h: 40, top: 196, start: null, end: 8, pct: true, opacity: 0.55, delay: 7.4),
  (w: 72, h: 26, top: 118, start: 44, end: null, pct: true, opacity: 0.55, delay: 3.8),
];

class _ASkyState extends State<ASky> with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(vsync: this, duration: const Duration(seconds: 12));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_drift.isAnimating) _drift.repeat();
    } else {
      _drift.stop();
    }
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = AnacanTokens.of(context).isDark;
    final moving = infiniteAnimationsAllowed(context);
    // anacan-design.css .a-sky / .dark .a-sky radial gradients (literal rgba values from the CSS).
    // (center x%, center y%, radius x% of width, radius y% of height, colors, stops)
    final washes = dark
        ? const [
            (0.5, -0.3, 1.2, 0.85, [Color.fromRGBO(246, 158, 126, 0.16), Color.fromRGBO(249, 187, 162, 0.1), Color.fromRGBO(32, 21, 18, 0)], [0.0, 0.42, 0.78]),
            (0.1, 0.04, 0.52, 0.34, [Color.fromRGBO(255, 255, 255, 0.05), Color.fromRGBO(255, 255, 255, 0)], [0.0, 0.7]),
            (0.9, 0.1, 0.48, 0.30, [Color.fromRGBO(255, 255, 255, 0.04), Color.fromRGBO(255, 255, 255, 0)], [0.0, 0.7]),
          ]
        : const [
            (0.5, -0.3, 1.2, 0.85, [Color.fromRGBO(246, 158, 126, 0.5), Color.fromRGBO(249, 187, 162, 0.38), Color.fromRGBO(255, 231, 225, 0)], [0.0, 0.42, 0.78]),
            (0.1, 0.04, 0.52, 0.34, [Color.fromRGBO(255, 255, 255, 0.55), Color.fromRGBO(255, 255, 255, 0)], [0.0, 0.7]),
            (0.9, 0.1, 0.48, 0.30, [Color.fromRGBO(255, 255, 255, 0.45), Color.fromRGBO(255, 255, 255, 0)], [0.0, 0.7]),
            (0.68, 0.02, 0.40, 0.26, [Color.fromRGBO(244, 148, 118, 0.28), Color.fromRGBO(244, 148, 118, 0)], [0.0, 0.72]),
          ];
    // `.a-cloud` background rgba(255,255,255,.85) / dark .07, blur(13px).
    final cloud = dark ? const Color.fromRGBO(255, 255, 255, 0.07) : const Color.fromRGBO(255, 255, 255, 0.85);
    return IgnorePointer(
      child: SizedBox(
        height: 330,
        child: LayoutBuilder(builder: (context, c) {
          final width = c.maxWidth;
          return ClipRect(
            child: Stack(children: [
              Positioned.fill(child: CustomPaint(painter: _WashPainter(washes))),
              for (final cl in _clouds)
                PositionedDirectional(
                  top: cl.top,
                  start: cl.start == null ? null : (cl.pct ? width * cl.start! / 100 : cl.start),
                  end: cl.end == null ? null : (cl.pct ? width * cl.end! / 100 : cl.end),
                  width: cl.w,
                  height: cl.h,
                  child: AnimatedBuilder(
                    animation: _drift,
                    builder: (context, child) {
                      if (!moving) return child!;
                      // @keyframes a-cloud-drift: 0/100% (0,0), 50% (16px,-7px), ease-in-out, delayed per cloud.
                      final phase = ((_drift.value * 12 - cl.delay) % 12) / 12;
                      final half = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
                      final k = ACurves.cssEaseInOut.transform(half.clamp(0.0, 1.0));
                      return Transform.translate(offset: Offset(16 * k, -7 * k), child: child);
                    },
                    child: Opacity(
                      opacity: cl.opacity,
                      child: ImageFiltered(
                        imageFilter: ui.ImageFilter.blur(sigmaX: 13 / 2, sigmaY: 13 / 2),
                        child: DecoratedBox(decoration: BoxDecoration(color: cloud, borderRadius: BorderRadius.circular(999))),
                      ),
                    ),
                  ),
                ),
            ]),
          );
        }),
      ),
    );
  }
}

typedef _Wash = (double, double, double, double, List<Color>, List<double>);

/// CSS `radial-gradient(<rx>% <ry>% at <cx>% <cy>%, …)`: an ellipse sized relative to the box.
class _WashPainter extends CustomPainter {
  _WashPainter(this.washes);
  final List<_Wash> washes;
  @override
  void paint(Canvas canvas, Size size) {
    for (final (cx, cy, rx, ry, colors, stops) in washes) {
      canvas.save();
      canvas.clipRect(Offset.zero & size);
      canvas.translate(size.width * cx, size.height * cy);
      canvas.scale(size.width * rx, size.height * ry);
      final paint = Paint()..shader = ui.Gradient.radial(Offset.zero, 1, colors, stops);
      canvas.drawRect(Rect.fromLTRB(-cx / rx - 1, -cy / ry - 1, (1 - cx) / rx + 1, (1 - cy) / ry + 1), paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_WashPainter old) => !identical(old.washes, washes);
}
