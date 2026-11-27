// Ported from: src/styles/anacan-design.css (inset box-shadows: --nav-glass-shadow / --nav-bubble-shadow
//              `inset 0 1px 0 …`, .a3-check `inset 0 0 0 1.5px var(--a-line-strong)`)
import 'package:flutter/widgets.dart';

/// Paints CSS `box-shadow: inset …` layers (Flutter's BoxShadow has no inset) over [child].
/// Use with the generated `*Inset` token lists, e.g. `NavCapsuleTokens.glassShadowInset`.
class AInsetShadow extends StatelessWidget {
  const AInsetShadow({super.key, required this.shadows, required this.borderRadius, required this.child});
  final List<BoxShadow> shadows;
  final BorderRadius borderRadius;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(foregroundPainter: _InsetPainter(shadows, borderRadius), child: child);
}

class _InsetPainter extends CustomPainter {
  _InsetPainter(this.shadows, this.radius);
  final List<BoxShadow> shadows;
  final BorderRadius radius;

  @override
  void paint(Canvas canvas, Size size) {
    final outer = radius.toRRect(Offset.zero & size);
    canvas.save();
    canvas.clipRRect(outer);
    for (final s in shadows) {
      // Inner edge of the shadow = the box shrunk by spread, moved by offset; everything
      // between a large outer rect and that hole is painted (blurred), clipped to the box.
      final hole = outer.shift(s.offset).deflate(s.spreadRadius);
      final path = Path()
        ..fillType = PathFillType.evenOdd
        ..addRect((Offset.zero & size).inflate(s.blurRadius * 2 + s.offset.distance + 50))
        ..addRRect(hole);
      canvas.drawPath(path, s.toPaint());
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_InsetPainter old) => old.shadows != shadows || old.radius != radius;
}
