// Ported from: src/components/games/color-sort/ColorTube.tsx, src/components/games/color-sort/color-sort.css
// (.colorsort-screen variables, .colorsort-tube*, .colorsort-glass)
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../engine/session.dart';

/// `LIQUID_COLORS`.
const List<Color> liquidColors = [
  Color(0xFFE85E87), Color(0xFF4D88E5), Color(0xFF28AA80), Color(0xFFE4B13B),
  Color(0xFF9364D5), Color(0xFF27A8B8), Color(0xFFEB8740), Color(0xFF56628E),
];

/// color-sort.css `.colorsort-screen` / `.dark .colorsort-screen` custom properties (one-off literals).
class ColorSortPalette {
  const ColorSortPalette._({
    required this.ink,
    required this.muted,
    required this.panel,
    required this.line,
    required this.glass,
    required this.glassLine,
    required this.hidden,
    required this.hiddenInk,
    required this.lockCover,
    required this.background,
    required this.backgroundGlow,
    required this.overlay,
  });
  final Color ink, muted, panel, line, glass, glassLine, hidden, hiddenInk, lockCover;
  final Gradient background;
  final Gradient backgroundGlow;
  final Color overlay;

  static const ColorSortPalette light = ColorSortPalette._(
    ink: Color(0xFF163F43),
    muted: Color(0xFF597479),
    panel: Color(0xE0FFFFFF), // rgba(255,255,255,.88)
    line: Color(0x2E3F7D85), // rgba(63,125,133,.18)
    glass: Color(0x8CFFFFFF), // rgba(255,255,255,.55)
    glassLine: Color(0xFF739AAB),
    hidden: Color(0xFFBAC3D3),
    hiddenInk: Color(0xFF344861),
    lockCover: Color(0xA1D9E2EB), // rgba(217,226,235,.63)
    background: CssLinearGradient(angle: 150, colors: [Color(0xFFE8F6F2), Color(0xFFE2EFF9)]),
    backgroundGlow: RadialGradient(center: Alignment.topLeft, radius: 1.3, colors: [Color(0xFFFDF4E8), Color(0x00FDF4E8)], stops: [0, 0.65]),
    overlay: Color(0xEDECF5F2), // rgba(236,245,242,.93)
  );

  static const ColorSortPalette dark = ColorSortPalette._(
    ink: Color(0xFFE1F3F1),
    muted: Color(0xFFAFC7CA),
    panel: Color(0xFF21363F),
    line: Color(0xFF36535C),
    glass: Color(0x6641586B), // rgba(65,88,107,.4)
    glassLine: Color(0xFF91ADBA),
    hidden: Color(0xFF56667A),
    hiddenInk: Color(0xFFEBF1F8),
    lockCover: Color(0xB8192F40), // rgba(25,47,64,.72)
    background: CssLinearGradient(angle: 150, colors: [Color(0xFF142B31), Color(0xFF1C263F)]),
    backgroundGlow: RadialGradient(center: Alignment.topLeft, radius: 1.3, colors: [Color(0xFF273C42), Color(0x00273C42)], stops: [0, 0.65]),
    overlay: Color(0xF211252D), // rgba(17,37,45,.95)
  );

  static ColorSortPalette of(BuildContext context) => AnacanTokens.of(context).isDark ? dark : light;
}

/// One tube button: status row (lock count / check), the SVG glass with liquid units, and its number.
class ColorTube extends StatelessWidget {
  const ColorTube({
    super.key,
    required this.units,
    required this.revealed,
    required this.index,
    required this.label,
    required this.number,
    required this.selected,
    required this.complete,
    required this.locked,
    required this.disabled,
    required this.markers,
    required this.hint,
    required this.pouring,
    required this.direction,
    required this.onTap,
    required this.glassHeight,
    this.reduceMotion = false,
  });
  final List<Unit> units;
  final Set<int> revealed;
  final int index;
  final String label;
  final String Function(num value) number;
  final bool selected;
  final bool complete;
  final int locked;
  final bool disabled;
  final bool markers;

  /// 'from' | 'to' | null
  final String? hint;
  final bool pouring;
  final int direction;
  final VoidCallback onTap;
  final double glassHeight;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    final palette = ColorSortPalette.of(context);
    final borderColor = selected
        ? const Color(0xFF37B4B2)
        : hint == 'from'
            ? const Color(0xFF3096E0)
            : hint == 'to'
                ? const Color(0xFFD6A121)
                : const Color(0x00000000);
    final background = selected
        ? const Color(0x57FFFFFF) // rgba(255,255,255,.34)
        : hint == 'from'
            ? const Color(0x215AAEEB) // rgba(90,174,235,.13)
            : hint == 'to'
                ? const Color(0x30F7CE62) // rgba(247,206,98,.19)
                : const Color(0x00000000);
    final statusColor = complete && locked == 0 ? const Color(0xFF13A77E) : palette.muted;
    final body = Container(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          height: 22,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (locked > 0) ...[
              AIcon(AIcons.lockKeyhole, size: 13, color: statusColor),
              const SizedBox(width: 3),
              Text(number(locked), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: statusColor)),
            ] else if (complete)
              AIcon(AIcons.check, size: 17, color: statusColor),
          ]),
        ),
        SizedBox(
          height: glassHeight,
          child: LayoutBuilder(builder: (context, constraints) {
            final width = math.min(constraints.maxWidth, 67.0);
            return Center(
              child: SizedBox(
                width: width,
                height: glassHeight,
                child: CustomPaint(
                  painter: ColorTubePainter(
                    units: units,
                    revealed: revealed,
                    markers: markers,
                    complete: complete,
                    locked: locked > 0,
                    palette: palette,
                    number: number,
                    textDirection: Directionality.of(context),
                  ),
                ),
              ),
            );
          }),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(number(index + 1),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: palette.muted, fontFeatures: const [FontFeature.tabularFigures()])),
        ),
      ]),
    );
    final dy = pouring ? -14.0 : selected ? -9.0 : 0.0;
    final angle = pouring ? direction * 16 * math.pi / 180 : 0.0;
    return Semantics(
      button: true,
      enabled: !disabled,
      selected: selected,
      label: label,
      child: ExcludeSemantics(
        child: GestureDetector(
          key: ValueKey('colorsort-tube-$index'),
          behavior: HitTestBehavior.opaque,
          onTap: disabled ? null : onTap,
          child: Opacity(
            opacity: disabled ? 0.48 : 1,
            child: TweenAnimationBuilder<Offset>(
              tween: Tween(end: Offset(dy, angle)),
              duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 200),
              curve: ACurves.cssEase,
              builder: (context, value, child) =>
                  Transform.translate(offset: Offset(0, value.dx), child: Transform.rotate(angle: value.dy, child: child)),
              child: body,
            ),
          ),
        ),
      ),
    );
  }
}

/// The 60 × 156 SVG of ColorTube.tsx, scaled to fit (`preserveAspectRatio` xMidYMid meet).
class ColorTubePainter extends CustomPainter {
  ColorTubePainter({
    required this.units,
    required this.revealed,
    required this.markers,
    required this.complete,
    required this.locked,
    required this.palette,
    required this.number,
    required this.textDirection,
  });
  final List<Unit> units;
  final Set<int> revealed;
  final bool markers;
  final bool complete;
  final bool locked;
  final ColorSortPalette palette;
  final String Function(num value) number;
  final TextDirection textDirection;

  static Path _glass() => Path()
    ..moveTo(8, 20)
    ..lineTo(52, 20)
    ..lineTo(52, 130)
    ..quadraticBezierTo(52, 151, 30, 151)
    ..quadraticBezierTo(8, 151, 8, 130)
    ..close();

  static Path _clip() => Path()
    ..moveTo(10, 24)
    ..lineTo(50, 24)
    ..lineTo(50, 130)
    ..quadraticBezierTo(50, 148, 30, 148)
    ..quadraticBezierTo(10, 148, 10, 130)
    ..close();

  Paint _stroke(Color color, double width, {bool round = false}) => Paint()
    ..style = PaintingStyle.stroke
    ..color = color
    ..strokeWidth = width
    ..strokeCap = round ? StrokeCap.round : StrokeCap.butt;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / 60, size.height / 156);
    canvas.save();
    canvas.translate((size.width - 60 * scale) / 2, (size.height - 156 * scale) / 2);
    canvas.scale(scale);
    final glass = _glass();
    // filter: drop-shadow(0 8px 8px rgba(36,82,104,.09))
    canvas.drawPath(
        glass.shift(const Offset(0, 8)),
        Paint()
          ..color = const Color(0x17245268)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
    canvas.drawPath(glass, Paint()..color = palette.glass);
    canvas.drawPath(glass, _stroke(palette.glassLine, 2));
    canvas.save();
    canvas.clipPath(_clip());
    for (var depth = 0; depth < units.length; depth++) {
      final unit = units[depth];
      final color = (unit['color'] as num).toInt();
      final visible = revealed.contains((unit['id'] as num).toInt());
      final y = 143.0 - (depth + 1) * 27;
      final rect = Rect.fromLTWH(10, y, 40, 27);
      final paint = Paint();
      if (visible) {
        final base = liquidColors[color];
        // linearGradient x1=0 x2=1 y1=0 y2=0.5 (objectBoundingBox)
        paint.shader = LinearGradient(
          begin: Alignment.topLeft,
          end: const Alignment(1, 0),
          colors: [base, base.withValues(alpha: 0.8)],
        ).createShader(rect);
      } else {
        paint.color = palette.hidden;
      }
      canvas.drawRect(rect, paint);
      final wave = Path()
        ..moveTo(10, y + 1)
        ..quadraticBezierTo(20, y - 1, 30, y + 1)
        ..quadraticBezierTo(40, y + 3, 50, y + 1);
      canvas.drawPath(wave, _stroke(const Color(0x66FFFFFF), 1.3));
      if (!visible || markers) {
        final ink = !visible ? palette.hiddenInk : color == 7 ? const Color(0xFFFFFFFF) : const Color(0xFF10283B);
        final text = TextPainter(
          text: TextSpan(
            text: visible ? number(color + 1) : '?',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: ink, fontFamily: 'Inter', height: 1),
          ),
          textDirection: textDirection,
        )..layout();
        // SVG text y is the baseline.
        final baseline = text.computeDistanceToActualBaseline(TextBaseline.alphabetic);
        text.paint(canvas, Offset(30 - text.width / 2, y + 18 - baseline));
      }
    }
    final shine = Path()
      ..moveTo(14, 27)
      ..lineTo(14, 129)
      ..quadraticBezierTo(14, 140, 23, 143);
    canvas.drawPath(shine, _stroke(const Color(0x61FFFFFF), 3, round: true));
    canvas.restore();
    canvas.drawLine(const Offset(8, 20), const Offset(52, 20),
        _stroke(complete ? const Color(0xFF38B58A) : palette.glassLine, complete ? 5 : 3, round: true));
    canvas.drawLine(const Offset(12, 12), const Offset(48, 12), _stroke(palette.glassLine.withValues(alpha: palette.glassLine.a * 0.55), 3, round: true));
    if (locked) {
      canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(10, 24, 40, 121), const Radius.circular(18)), Paint()..color = palette.lockCover);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(ColorTubePainter old) =>
      !identical(old.units, units) ||
      old.revealed.length != revealed.length ||
      !old.revealed.containsAll(revealed) ||
      old.markers != markers ||
      old.complete != complete ||
      old.locked != locked ||
      old.palette != palette ||
      old.textDirection != textDirection;
}
