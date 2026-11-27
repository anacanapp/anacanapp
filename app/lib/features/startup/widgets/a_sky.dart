// Ported from: src/styles/anacan-design.css (.a-sky, .dark .a-sky, .a-cloud, .a-cloud.c1–c7, .a-cloud.deep,
//              @keyframes a-cloud-drift, prefers-reduced-motion / html.a-lite: no drift)
//
// The watercolour hero backdrop (`<div className="a-sky"><span className="a-cloud c1" />…</div>`). Used by the
// force-update screen here; other features can import it until it moves to app/lib/design.
import 'dart:ui' as ui;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../design/motion.dart' show ACurves, infiniteAnimationsAllowed;
import '../../../design/theme.dart' show AnacanTokens;

/// One `.a-cloud.cN` rule.
@immutable
class ACloudSpec {
  const ACloudSpec({
    required this.width,
    required this.height,
    required this.top,
    this.start,
    this.startFraction,
    this.end,
    this.endFraction,
    this.opacity = 1,
    this.delay = Duration.zero,
    this.deep = false,
  });

  final double width;
  final double height;
  final double top;

  /// `inset-inline-start` in px or as a fraction of the sky width.
  final double? start;
  final double? startFraction;

  /// `inset-inline-end` in px or as a fraction of the sky width.
  final double? end;
  final double? endFraction;
  final double opacity;
  final Duration delay;

  /// `.a-cloud.deep` (peach tint).
  final bool deep;

  static const c1 = ACloudSpec(width: 160, height: 48, top: 34, start: -34);
  static const c2 = ACloudSpec(width: 120, height: 38, top: 84, end: -22, opacity: 0.9, delay: Duration(milliseconds: 2600));
  static const c3 = ACloudSpec(width: 92, height: 30, top: 156, startFraction: 0.12, opacity: 0.7, delay: Duration(milliseconds: 5200));
  static const c4 = ACloudSpec(width: 130, height: 40, top: 196, endFraction: 0.08, opacity: 0.55, delay: Duration(milliseconds: 7400));
  static const c5 = ACloudSpec(width: 72, height: 26, top: 118, startFraction: 0.44, opacity: 0.55, delay: Duration(milliseconds: 3800));
  static const c6 = ACloudSpec(width: 110, height: 36, top: 58, startFraction: 0.30, delay: Duration(milliseconds: 6300));
  static const c7 = ACloudSpec(width: 84, height: 30, top: 232, startFraction: 0.34, opacity: 0.4, delay: Duration(milliseconds: 1400));
}

/// `.a-sky`: 330 px tall, full width, behind the content (position it at the top of a [Stack]).
class ASky extends StatefulWidget {
  const ASky({super.key, this.clouds = const [ACloudSpec.c1, ACloudSpec.c2, ACloudSpec.c3]});
  final List<ACloudSpec> clouds;

  static const double height = 330;

  /// `a-cloud-drift 12s ease-in-out infinite`.
  static const Duration drift = Duration(seconds: 12);

  /// Translation of a cloud [elapsed] after mount (`0%,100% translate(0,0)`, `50% translate(16px,-7px)`).
  static Offset driftOffset(Duration elapsed, Duration delay) {
    final local = elapsed - delay;
    if (local <= Duration.zero) return Offset.zero;
    final p = (local.inMicroseconds % drift.inMicroseconds) / drift.inMicroseconds;
    final k = p < 0.5 ? ACurves.cssEaseInOut.transform(p * 2) : 1 - ACurves.cssEaseInOut.transform((p - 0.5) * 2);
    return Offset(16 * k, -7 * k);
  }

  @override
  State<ASky> createState() => _ASkyState();
}

class _ASkyState extends State<ASky> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker((elapsed) => setState(() => _elapsed = elapsed));
  Duration _elapsed = Duration.zero;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final animate = infiniteAnimationsAllowed(context);
    if (animate && !_ticker.isActive) {
      _ticker.start();
    } else if (!animate && _ticker.isActive) {
      _ticker.stop();
      _elapsed = Duration.zero;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = AnacanTokens.of(context).isDark;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return IgnorePointer(
      child: SizedBox(
        height: ASky.height,
        width: double.infinity,
        child: ClipRect(
          child: LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(child: CustomPaint(painter: _SkyPainter(dark: dark))),
                for (final cloud in widget.clouds) _cloud(cloud, w, dark, rtl),
              ],
            );
          }),
        ),
      ),
    );
  }

  Widget _cloud(ACloudSpec s, double w, bool dark, bool rtl) {
    final start = s.start ?? (s.startFraction != null ? s.startFraction! * w : null);
    final end = s.end ?? (s.endFraction != null ? s.endFraction! * w : null);
    // inset-inline-start/end → physical left/right.
    final left = rtl ? end : start;
    final right = rtl ? start : end;
    final color = s.deep
        ? (dark ? const Color(0x1AF59E80) : const Color(0x66F59E80))
        : (dark ? const Color(0x12FFFFFF) : const Color(0xD9FFFFFF));
    // translate() is physical: the drift goes right in both directions.
    final offset = ASky.driftOffset(_elapsed, s.delay);
    return Positioned(
      top: s.top,
      left: left,
      right: right,
      width: s.width,
      height: s.height,
      child: Transform.translate(
        offset: offset,
        child: Opacity(
          opacity: s.opacity,
          // filter: blur(13px)
          child: ImageFiltered(
            imageFilter: ui.ImageFilter.blur(sigmaX: 13, sigmaY: 13, tileMode: TileMode.decal),
            child: DecoratedBox(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999))),
          ),
        ),
      ),
    );
  }
}

/// CSS `radial-gradient(<rx> <ry> at <cx> <cy>, stops)`, all as fractions of the box.
class _Radial {
  const _Radial(this.rx, this.ry, this.cx, this.cy, this.colors, this.stops);
  final double rx;
  final double ry;
  final double cx;
  final double cy;
  final List<Color> colors;
  final List<double> stops;
}

const _light = <_Radial>[
  // Painted back to front (CSS lists the top layer first).
  _Radial(0.40, 0.26, 0.68, 0.02, [Color(0x47F49476), Color(0x00F49476)], [0, 0.72]),
  _Radial(0.48, 0.30, 0.90, 0.10, [Color(0x73FFFFFF), Color(0x00FFFFFF)], [0, 0.70]),
  _Radial(0.52, 0.34, 0.10, 0.04, [Color(0x8CFFFFFF), Color(0x00FFFFFF)], [0, 0.70]),
  _Radial(1.20, 0.85, 0.50, -0.30, [Color(0x80F69E7E), Color(0x61F9BBA2), Color(0x00FFE7E1)], [0, 0.42, 0.78]),
];

const _dark = <_Radial>[
  _Radial(0.48, 0.30, 0.90, 0.10, [Color(0x0AFFFFFF), Color(0x00FFFFFF)], [0, 0.70]),
  _Radial(0.52, 0.34, 0.10, 0.04, [Color(0x0DFFFFFF), Color(0x00FFFFFF)], [0, 0.70]),
  _Radial(1.20, 0.85, 0.50, -0.30, [Color(0x29F69E7E), Color(0x1AF9BBA2), Color(0x00201512)], [0, 0.42, 0.78]),
];

class _SkyPainter extends CustomPainter {
  const _SkyPainter({required this.dark});
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    for (final g in dark ? _dark : _light) {
      final rx = g.rx * size.width;
      final ry = g.ry * size.height;
      if (rx <= 0 || ry <= 0) continue;
      canvas.save();
      canvas.clipRect(Offset.zero & size);
      canvas.translate(g.cx * size.width, g.cy * size.height);
      canvas.scale(rx, ry);
      final paint = Paint()..shader = ui.Gradient.radial(Offset.zero, 1, g.colors, g.stops);
      // Cover the whole box in the scaled space.
      canvas.drawRect(Rect.fromLTRB(-g.cx * size.width / rx, -g.cy * size.height / ry, (1 - g.cx) * size.width / rx,
          (1 - g.cy) * size.height / ry), paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_SkyPainter old) => old.dark != dark;
}
