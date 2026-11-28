// Ported from: src/components/illness/TempChart.tsx, src/styles/care.css (.cx-chart, .cx-tip)
//
// Temperature line of the episode with medicine markers; tap a point to see its value and time. The SVG viewBox
// (330 x 132, preserveAspectRatio none) is stretched to the card width; text is drawn unscaled.
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../common/health_format.dart';
import 'illness.dart';

const double _w = 330, _h = 132, _padX = 14, _top = 14, _bottom = 26;

// TempChart.tsx one-off literals.
const Color _coral = Color(0xFFFF5A5F);
const Color _feverLine = Color(0xFFFF8A8E);
const Color _feverText = Color(0xFFC92A2A);

class TempChart extends StatefulWidget {
  const TempChart({super.key, required this.entries, required this.locale, required this.language, this.unit = 'C', required this.feverLabel, required this.emptyLabel});
  final List<IllnessEntry> entries;
  final String locale;
  final String language;
  final TempUnit unit;
  final String feverLabel;
  final String emptyLabel;
  @override
  State<TempChart> createState() => _TempChartState();
}

class _Point {
  const _Point(this.x, this.y, this.e);
  final double x;
  final double y;
  final IllnessEntry e;
}

int _ms(String iso) => jsParseDate(iso)?.millisecondsSinceEpoch ?? 0;

class _TempChartState extends State<TempChart> {
  int? _picked;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final temps = widget.entries.where((e) => e.kind == 'temp' && e.tempC != null).take(24).toList().reversed.toList();
    if (temps.length < 2) {
      return Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
        child: Text(widget.emptyLabel, textAlign: TextAlign.center, style: px(13, color: a.inkSoft, height: 1.45)),
      );
    }
    final t0 = _ms(temps.first.at);
    final t1Raw = _ms(temps.last.at);
    final t1 = t1Raw > t0 + 1 ? t1Raw : t0 + 1;
    final values = [for (final e in temps) e.tempC!];
    final lo = [36.0, ...values].reduce((m, v) => v < m ? v : m) - 0.3;
    final hi = [39.0, ...values].reduce((m, v) => v > m ? v : m) + 0.3;
    double x(String iso) => _padX + (_ms(iso) - t0) / (t1 - t0) * (_w - _padX * 2);
    double y(double v) => _top + (hi - v) / (hi - lo) * (_h - _top - _bottom);
    final points = [for (final e in temps) _Point(x(e.at), y(e.tempC!), e)];
    final meds = widget.entries.where((e) => e.kind == 'med' && _ms(e.at) >= t0 && _ms(e.at) <= t1).toList();
    String label(String iso) => fmtWeekdayShortTime(DateTime.fromMillisecondsSinceEpoch(_ms(iso)), widget.language);
    final sel = _picked != null && _picked! < points.length ? points[_picked!] : null;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: LayoutBuilder(builder: (context, c) {
        final width = c.maxWidth;
        final sx = width / _w;
        return Stack(clipBehavior: Clip.none, children: [
          Semantics(
            image: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) {
                final px0 = d.localPosition.dx / width * _w;
                var best = 0;
                for (var i = 0; i < points.length; i++) {
                  if ((points[i].x - px0).abs() < (points[best].x - px0).abs()) best = i;
                }
                setState(() => _picked = best);
              },
              child: CustomPaint(
                size: Size(width, _h),
                painter: _ChartPainter(
                  sx: sx,
                  points: points,
                  medXs: [for (final m in meds) x(m.at)],
                  feverY: y(38),
                  picked: _picked,
                  surface: a.surface,
                  green: a.green2,
                  faint: a.inkFaint,
                  feverLabel: widget.feverLabel,
                  startLabel: label(temps.first.at),
                  endLabel: label(temps.last.at),
                  directionality: Directionality.of(context),
                ),
              ),
            ),
          ),
          if (sel != null)
            Positioned(
              left: sel.x * sx,
              top: (sel.y + 10) / _h * _h,
              child: FractionalTranslation(
                translation: const Offset(-0.5, -1.1),
                child: IgnorePointer(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(color: a.ink, borderRadius: BorderRadius.circular(10)),
                    child: Text(
                      '${formatTemp(sel.e.tempC!, widget.unit, widget.locale)} · ${fmtTime(DateTime.fromMillisecondsSinceEpoch(_ms(sel.e.at)), widget.language)}',
                      style: px(11.5, weight: FontWeight.w700, color: a.surface, height: 1.2),
                    ),
                  ),
                ),
              ),
            ),
        ]);
      }),
    );
  }
}

class _ChartPainter extends CustomPainter {
  _ChartPainter({
    required this.sx,
    required this.points,
    required this.medXs,
    required this.feverY,
    required this.picked,
    required this.surface,
    required this.green,
    required this.faint,
    required this.feverLabel,
    required this.startLabel,
    required this.endLabel,
    required this.directionality,
  });
  final double sx;
  final List<_Point> points;
  final List<double> medXs;
  final double feverY;
  final int? picked;
  final Color surface;
  final Color green;
  final Color faint;
  final String feverLabel;
  final String startLabel;
  final String endLabel;
  final TextDirection directionality;

  void _dashed(Canvas canvas, Offset a, Offset b, Paint p, double dash, double gap) {
    final total = (b - a).distance;
    final dir = (b - a) / total;
    var d = 0.0;
    while (d < total) {
      final e = (d + dash).clamp(0, total).toDouble();
      canvas.drawLine(a + dir * d, a + dir * e, p);
      d += dash + gap;
    }
  }

  void _text(Canvas canvas, String text, double x, double baseline, double size, Color color, {TextAlign align = TextAlign.left}) {
    final tp = TextPainter(text: TextSpan(text: text, style: TextStyle(fontSize: size, color: color)), textDirection: directionality)..layout();
    final left = align == TextAlign.right ? x - tp.width : (align == TextAlign.center ? x - tp.width / 2 : x);
    tp.paint(canvas, Offset(left, baseline - tp.computeDistanceToActualBaseline(TextBaseline.alphabetic)));
  }

  @override
  void paint(Canvas canvas, Size size) {
    Offset p(double x, double y) => Offset(x * sx, y);
    // Fever zone and line.
    canvas.drawRect(Rect.fromLTWH(0, _top, size.width, (feverY - _top).clamp(0, double.infinity)), Paint()..color = _coral.withValues(alpha: 0.05));
    _dashed(canvas, Offset(0, feverY), Offset(size.width, feverY), Paint()
      ..color = _feverLine
      ..strokeWidth = 1, 4, 4);
    _text(canvas, feverLabel, 4 * sx, feverY - 4, 9, _feverText);
    // Area and line.
    final line = Path();
    for (var i = 0; i < points.length; i++) {
      final o = p(points[i].x, points[i].y);
      i == 0 ? line.moveTo(o.dx, o.dy) : line.lineTo(o.dx, o.dy);
    }
    final area = Path.from(line)
      ..lineTo(points.last.x * sx, _h - _bottom)
      ..lineTo(points.first.x * sx, _h - _bottom)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_coral.withValues(alpha: 0.28), _coral.withValues(alpha: 0)])
            .createShader(Rect.fromLTWH(0, 0, size.width, _h)),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = _coral
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
    // Medicine markers.
    for (final mx in medXs) {
      _dashed(canvas, p(mx, _top), p(mx, _h - _bottom), Paint()
        ..color = green
        ..strokeWidth = 1, 2, 3);
      _text(canvas, '💊', mx * sx, _top + 2, 11, faint, align: TextAlign.center);
    }
    // Points.
    for (var i = 0; i < points.length; i++) {
      final o = p(points[i].x, points[i].y);
      final r = picked == i ? 5.5 : 3.8;
      canvas.drawCircle(o, r, Paint()..color = surface);
      canvas.drawCircle(o, r, Paint()
        ..color = bandColor[tempBand(points[i].e.tempC!)]!
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5);
    }
    _text(canvas, startLabel, _padX * sx, _h - 8, 9, faint);
    _text(canvas, endLabel, (_w - _padX) * sx, _h - 8, 9, faint, align: TextAlign.right);
  }

  @override
  bool shouldRepaint(_ChartPainter old) => true;
}
