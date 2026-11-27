// Ported from: src/lib/recap/render.ts (the CanvasRenderingContext2D subset the renderer uses)
//
// A small Canvas 2D context on top of dart:ui, so render.ts ports line by line: state stack (alpha, styles,
// line width/cap/join/dash, shadow, font, text align/baseline, composite), path building, fill / stroke / clip,
// fillRect, fillText with maxWidth, measureText, drawImage, linear / radial gradients and repeat patterns.
// [RecordingRecapCtx] logs every drawing call instead (the vitest "recording context"), for determinism tests.
import 'dart:collection';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart' show TextStyle, FontWeight, FontVariation, Shadow;

import 'recap_fonts.dart';

/// Canvas font: `${weight} ${round(size)}px ${family}`.
class RecapFont {
  const RecapFont(this.weight, this.size, this.family);
  final int weight;

  /// Pixel size (already rounded like the CSS shorthand).
  final double size;
  final RecapFamily family;
  String get css => '$weight ${size.toStringAsFixed(0)}px ${family.primary}';
}

/// An image the renderer can draw (a logo or the grain tile).
abstract class RecapImage {
  int get width;
  int get height;
}

class UiRecapImage implements RecapImage {
  UiRecapImage(this.image);
  final ui.Image image;
  @override
  int get width => image.width;
  @override
  int get height => image.height;
}

/// `createLinearGradient` / `createRadialGradient`.
class RecapGradient {
  RecapGradient.linear(double x0, double y0, double x1, double y1)
      : radial = false,
        args = [x0, y0, x1, y1];
  RecapGradient.radial(double x0, double y0, double r0, double x1, double y1, double r1)
      : radial = true,
        args = [x0, y0, r0, x1, y1, r1];
  final bool radial;
  final List<double> args;
  final List<double> offsets = [];
  final List<String> colors = [];
  void addColorStop(double offset, String color) {
    offsets.add(offset);
    colors.add(color);
  }
}

/// `createPattern(image, 'repeat')`.
class RecapPattern {
  RecapPattern(this.image);
  final RecapImage image;
}

class _State {
  double alpha = 1;
  String composite = 'source-over';
  Object fillStyle = '#000000';
  Object strokeStyle = '#000000';
  double lineWidth = 1;
  String lineCap = 'butt';
  String lineJoin = 'miter';
  List<double> dash = const [];
  String shadowColor = 'rgba(0,0,0,0)';
  double shadowBlur = 0;
  double shadowOffsetY = 0;
  RecapFont font = const RecapFont(400, 10, RecapFamily('sans-serif', []));
  String textAlign = 'start';
  String textBaseline = 'alphabetic';

  _State copy() => _State()
    ..alpha = alpha
    ..composite = composite
    ..fillStyle = fillStyle
    ..strokeStyle = strokeStyle
    ..lineWidth = lineWidth
    ..lineCap = lineCap
    ..lineJoin = lineJoin
    ..dash = dash
    ..shadowColor = shadowColor
    ..shadowBlur = shadowBlur
    ..shadowOffsetY = shadowOffsetY
    ..font = font
    ..textAlign = textAlign
    ..textBaseline = textBaseline;
}

sealed class _Op {
  const _Op();
}

class _Move extends _Op {
  const _Move(this.x, this.y);
  final double x, y;
}

class _Line extends _Op {
  const _Line(this.x, this.y);
  final double x, y;
}

class _Cubic extends _Op {
  const _Cubic(this.a, this.b, this.c, this.d, this.x, this.y);
  final double a, b, c, d, x, y;
}

class _Quad extends _Op {
  const _Quad(this.a, this.b, this.x, this.y);
  final double a, b, x, y;
}

class _Arc extends _Op {
  const _Arc(this.x, this.y, this.r, this.a0, this.a1, this.ccw);
  final double x, y, r, a0, a1;
  final bool ccw;
}

class _Rect extends _Op {
  const _Rect(this.x, this.y, this.w, this.h, this.r);
  final double x, y, w, h;

  /// Corner radius (0 for `rect`).
  final double r;
}

class _Close extends _Op {
  const _Close();
}

/// The Canvas 2D subset used by the recap renderer.
abstract class RecapCtx {
  _State _s = _State();
  final List<_State> _stack = [];
  final List<_Op> _path = [];

  double get globalAlpha => _s.alpha;
  set globalAlpha(double v) {
    if (v.isFinite && v >= 0 && v <= 1) _s.alpha = v;
  }

  String get globalCompositeOperation => _s.composite;
  set globalCompositeOperation(String v) => _s.composite = v;
  Object get fillStyle => _s.fillStyle;
  set fillStyle(Object v) => _s.fillStyle = v;
  Object get strokeStyle => _s.strokeStyle;
  set strokeStyle(Object v) => _s.strokeStyle = v;
  double get lineWidth => _s.lineWidth;
  set lineWidth(double v) {
    if (v.isFinite && v > 0) _s.lineWidth = v;
  }

  String get lineCap => _s.lineCap;
  set lineCap(String v) => _s.lineCap = v;
  String get lineJoin => _s.lineJoin;
  set lineJoin(String v) => _s.lineJoin = v;
  String get shadowColor => _s.shadowColor;
  set shadowColor(String v) => _s.shadowColor = v;
  double get shadowBlur => _s.shadowBlur;
  set shadowBlur(double v) {
    if (v.isFinite && v >= 0) _s.shadowBlur = v;
  }

  double get shadowOffsetY => _s.shadowOffsetY;
  set shadowOffsetY(double v) {
    if (v.isFinite) _s.shadowOffsetY = v;
  }

  RecapFont get font => _s.font;
  set font(RecapFont v) => _s.font = v;
  String get textAlign => _s.textAlign;
  set textAlign(String v) => _s.textAlign = v;
  String get textBaseline => _s.textBaseline;
  set textBaseline(String v) => _s.textBaseline = v;
  void setLineDash(List<double> segments) => _s.dash = List.unmodifiable(segments.length.isOdd ? [...segments, ...segments] : segments);

  void save() {
    _stack.add(_s.copy());
    onSave();
  }

  void restore() {
    if (_stack.isEmpty) return;
    _s = _stack.removeLast();
    onRestore();
  }

  void beginPath() => _path.clear();
  void moveTo(double x, double y) => _path.add(_Move(x, y));
  void lineTo(double x, double y) => _path.add(_Line(x, y));
  void bezierCurveTo(double a, double b, double c, double d, double x, double y) => _path.add(_Cubic(a, b, c, d, x, y));
  void quadraticCurveTo(double a, double b, double x, double y) => _path.add(_Quad(a, b, x, y));
  void arc(double x, double y, double r, double a0, double a1, [bool ccw = false]) => _path.add(_Arc(x, y, r, a0, a1, ccw));
  void rect(double x, double y, double w, double h) => _path.add(_Rect(x, y, w, h, 0));

  /// The renderer's `roundRect` helper (four `arcTo`s with the radius already clamped).
  void roundRectPath(double x, double y, double w, double h, double r) => _path.add(_Rect(x, y, w, h, r));
  void closePath() => _path.add(const _Close());

  // Backend hooks.
  void onSave();
  void onRestore();
  void translate(double x, double y);
  void scale(double x, double y);
  void rotate(double angle);
  void fill();
  void stroke();
  void clip({bool evenOdd = false});
  void fillRect(double x, double y, double w, double h);
  void fillText(String text, double x, double y, [double? maxWidth]);
  double measureText(String text);
  void drawImage(RecapImage image, double x, double y, double w, double h);
}

// ── Colours ───────────────────────────────────────────────────────────────────────────────────

final Map<String, ui.Color> _colorCache = {};

/// `#rgb`, `#rrggbb`, `rgba(r,g,b,a)` / `rgb(r,g,b)` → Color (transparent black if unknown).
ui.Color parseCssColor(String css) {
  final hit = _colorCache[css];
  if (hit != null) return hit;
  if (_colorCache.length > 4096) _colorCache.clear();
  var c = const ui.Color(0x00000000);
  final s = css.trim();
  if (s.startsWith('#')) {
    var h = s.substring(1);
    if (h.length == 3) h = h.split('').map((x) => '$x$x').join();
    final n = int.tryParse(h, radix: 16);
    if (n != null && h.length == 6) c = ui.Color(0xFF000000 | n);
  } else {
    final m = RegExp(r'^rgba?\(([^)]*)\)$').firstMatch(s);
    if (m != null) {
      final p = m[1]!.split(',').map((x) => double.tryParse(x.trim()) ?? 0).toList();
      if (p.length >= 3) {
        c = ui.Color.fromRGBO(p[0].round().clamp(0, 255), p[1].round().clamp(0, 255), p[2].round().clamp(0, 255), p.length > 3 ? p[3].clamp(0, 1).toDouble() : 1);
      }
    }
  }
  _colorCache[css] = c;
  return c;
}

// ── dart:ui backend ───────────────────────────────────────────────────────────────────────────

/// Draws on a [ui.Canvas] (the player's CustomPainter and the PNG export).
class UiRecapCtx extends RecapCtx {
  UiRecapCtx(this.canvas);
  final ui.Canvas canvas;

  static final LinkedHashMap<String, double> _measureCache = LinkedHashMap();

  @override
  void onSave() => canvas.save();
  @override
  void onRestore() => canvas.restore();
  @override
  void translate(double x, double y) => canvas.translate(x, y);
  @override
  void scale(double x, double y) => canvas.scale(x, y);
  @override
  void rotate(double angle) => canvas.rotate(angle);

  ui.Path _build({bool evenOdd = false}) {
    final p = ui.Path()..fillType = evenOdd ? ui.PathFillType.evenOdd : ui.PathFillType.nonZero;
    var has = false;
    var cx = 0.0, cy = 0.0, sx = 0.0, sy = 0.0;
    void ensure(double x, double y) {
      if (!has) {
        p.moveTo(x, y);
        has = true;
        cx = sx = x;
        cy = sy = y;
      }
    }

    for (final op in _path) {
      switch (op) {
        case _Move(:final x, :final y):
          p.moveTo(x, y);
          has = true;
          cx = sx = x;
          cy = sy = y;
        case _Line(:final x, :final y):
          if (!has) {
            ensure(x, y);
          } else {
            p.lineTo(x, y);
          }
          cx = x;
          cy = y;
        case _Cubic(:final a, :final b, :final c, :final d, :final x, :final y):
          ensure(a, b);
          p.cubicTo(a, b, c, d, x, y);
          cx = x;
          cy = y;
        case _Quad(:final a, :final b, :final x, :final y):
          ensure(a, b);
          p.quadraticBezierTo(a, b, x, y);
          cx = x;
          cy = y;
        case _Arc(:final x, :final y, :final r, :final a0, :final a1, :final ccw):
          if (r <= 0) break;
          const tau = math.pi * 2;
          double sweep;
          if (!ccw && a1 - a0 >= tau) {
            sweep = tau;
          } else if (ccw && a0 - a1 >= tau) {
            sweep = -tau;
          } else if (!ccw) {
            sweep = (a1 - a0) % tau;
          } else {
            sweep = -((a0 - a1) % tau);
          }
          final startX = x + math.cos(a0) * r, startY = y + math.sin(a0) * r;
          if (has) {
            p.lineTo(startX, startY);
          } else {
            ensure(startX, startY);
          }
          final oval = ui.Rect.fromCircle(center: ui.Offset(x, y), radius: r);
          if (sweep.abs() >= tau - 1e-9) {
            p.arcTo(oval, a0, sweep / 2, false);
            p.arcTo(oval, a0 + sweep / 2, sweep / 2, false);
          } else if (sweep != 0) {
            p.arcTo(oval, a0, sweep, false);
          }
          cx = x + math.cos(a0 + sweep) * r;
          cy = y + math.sin(a0 + sweep) * r;
        case _Rect(:final x, :final y, :final w, :final h, :final r):
          final rect = ui.Rect.fromPoints(ui.Offset(x, y), ui.Offset(x + w, y + h));
          if (r > 0) {
            p.addRRect(ui.RRect.fromRectAndRadius(rect, ui.Radius.circular(r)));
          } else {
            p.addRect(rect);
          }
          p.moveTo(x, y);
          has = true;
          cx = sx = x;
          cy = sy = y;
        case _Close():
          if (has) p.close();
          cx = sx;
          cy = sy;
      }
    }
    // cx/cy track the current point like the canvas does; only the path is needed here.
    if (cx.isNaN || cy.isNaN) return ui.Path();
    return p;
  }

  ui.BlendMode get _blend => _s.composite == 'overlay' ? ui.BlendMode.overlay : ui.BlendMode.srcOver;

  ui.Paint _paint(Object style) {
    final paint = ui.Paint()
      ..isAntiAlias = true
      ..blendMode = _blend;
    if (style is String) {
      final c = parseCssColor(style);
      paint.color = c.withValues(alpha: c.a * _s.alpha);
    } else {
      paint.color = ui.Color.fromRGBO(0, 0, 0, _s.alpha);
      paint.shader = _shader(style);
    }
    return paint;
  }

  ui.Shader? _shader(Object style) {
    if (style is RecapGradient) {
      if (style.colors.isEmpty) return null;
      final colors = [for (final c in style.colors) parseCssColor(c)];
      final stops = [for (final o in style.offsets) o.clamp(0, 1).toDouble()];
      final a = style.args;
      if (!style.radial) return ui.Gradient.linear(ui.Offset(a[0], a[1]), ui.Offset(a[2], a[3]), colors, stops);
      return ui.Gradient.radial(ui.Offset(a[3], a[4]), math.max(a[5], 1e-6), colors, stops, ui.TileMode.clamp, null, ui.Offset(a[0], a[1]), a[2]);
    }
    if (style is RecapPattern && style.image is UiRecapImage) {
      final identity = Float64List4x4.identity;
      return ui.ImageShader((style.image as UiRecapImage).image, ui.TileMode.repeated, ui.TileMode.repeated, identity);
    }
    return null;
  }

  bool get _hasShadow {
    final c = parseCssColor(_s.shadowColor);
    return c.a > 0 && (_s.shadowBlur > 0 || _s.shadowOffsetY != 0);
  }

  ui.Color get _shadowPaintColor {
    final c = parseCssColor(_s.shadowColor);
    return c.withValues(alpha: c.a * _s.alpha);
  }

  double get _shadowSigma => _s.shadowBlur / 2;

  void _withShadow(void Function(ui.Paint paint) draw) {
    if (!_hasShadow) return;
    final paint = ui.Paint()
      ..color = _shadowPaintColor
      ..blendMode = _blend;
    if (_shadowSigma > 0) paint.maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, _shadowSigma);
    canvas.save();
    canvas.translate(0, _s.shadowOffsetY);
    draw(paint);
    canvas.restore();
  }

  @override
  void fill() {
    final path = _build();
    _withShadow((p) => canvas.drawPath(path, p));
    canvas.drawPath(path, _paint(_s.fillStyle));
  }

  @override
  void clip({bool evenOdd = false}) => canvas.clipPath(_build(evenOdd: evenOdd));

  @override
  void stroke() {
    var path = _build();
    if (_s.dash.isNotEmpty && _s.dash.any((d) => d > 0)) path = _dashed(path, _s.dash);
    final paint = _paint(_s.strokeStyle)
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = _s.lineWidth
      ..strokeCap = switch (_s.lineCap) { 'round' => ui.StrokeCap.round, 'square' => ui.StrokeCap.square, _ => ui.StrokeCap.butt }
      ..strokeJoin = switch (_s.lineJoin) { 'round' => ui.StrokeJoin.round, 'bevel' => ui.StrokeJoin.bevel, _ => ui.StrokeJoin.miter };
    _withShadow((p) => canvas.drawPath(
        path,
        p
          ..style = ui.PaintingStyle.stroke
          ..strokeWidth = paint.strokeWidth
          ..strokeCap = paint.strokeCap
          ..strokeJoin = paint.strokeJoin));
    canvas.drawPath(path, paint);
  }

  static ui.Path _dashed(ui.Path source, List<double> dash) {
    final out = ui.Path();
    for (final metric in source.computeMetrics()) {
      var d = 0.0, i = 0;
      var on = true;
      while (d < metric.length) {
        final len = dash[i % dash.length];
        if (on && len > 0) out.addPath(metric.extractPath(d, math.min(d + len, metric.length)), ui.Offset.zero);
        d += len;
        on = !on;
        i++;
        if (i > 100000) break;
      }
    }
    return out;
  }

  @override
  void fillRect(double x, double y, double w, double h) {
    final rect = ui.Rect.fromPoints(ui.Offset(x, y), ui.Offset(x + w, y + h));
    _withShadow((p) => canvas.drawRect(rect, p));
    canvas.drawRect(rect, _paint(_s.fillStyle));
  }

  TextStyle _style(RecapFont f, {ui.Paint? foreground, List<Shadow>? shadows}) => TextStyle(
        fontFamily: f.family.primary,
        fontFamilyFallback: f.family.fallback,
        fontSize: f.size,
        fontWeight: FontWeight.values[(f.weight ~/ 100 - 1).clamp(0, 8)],
        fontVariations: [FontVariation('wght', f.weight.toDouble())],
        foreground: foreground,
        shadows: shadows,
        height: null,
      );

  ui.Paragraph _paragraph(String text, TextStyle style) {
    final b = ui.ParagraphBuilder(ui.ParagraphStyle(textDirection: ui.TextDirection.ltr, maxLines: 1))
      ..pushStyle(style.getTextStyle())
      ..addText(text);
    return b.build()..layout(const ui.ParagraphConstraints(width: double.infinity));
  }

  double _rawMeasure(String text) {
    final key = '${_s.font.css}|$text';
    final hit = _measureCache.remove(key);
    if (hit != null) {
      _measureCache[key] = hit;
      return hit;
    }
    final w = _paragraph(text, _style(_s.font)).maxIntrinsicWidth;
    _measureCache[key] = w;
    if (_measureCache.length > 6000) _measureCache.remove(_measureCache.keys.first);
    return w;
  }

  @override
  double measureText(String text) {
    if (text.isEmpty) return 0;
    // Trailing whitespace is not part of a paragraph's intrinsic width; canvas counts its advance.
    if (text.trim().isEmpty) return _rawMeasure('x${text}x') - _rawMeasure('xx');
    return _rawMeasure(text);
  }

  @override
  void fillText(String text, double x, double y, [double? maxWidth]) {
    if (text.isEmpty) return;
    if (maxWidth != null && !(maxWidth > 0)) return;
    final foreground = _paint(_s.fillStyle);
    final shadows = _hasShadow
        ? [Shadow(color: _shadowPaintColor, offset: ui.Offset(0, _s.shadowOffsetY), blurRadius: math.max(0, (_shadowSigma - 0.5) / 0.57735))]
        : null;
    final para = _paragraph(text, _style(_s.font, foreground: foreground, shadows: shadows));
    final w = measureText(text);
    final align = _s.textAlign;
    final dx = align == 'center' ? -w / 2 : (align == 'right' || align == 'end') ? -w : 0.0;
    var dy = -para.alphabeticBaseline;
    if (_s.textBaseline == 'middle') {
      final lines = para.computeLineMetrics();
      if (lines.isNotEmpty) dy += (lines.first.ascent - lines.first.descent) / 2;
    }
    final k = maxWidth != null && w > maxWidth ? maxWidth / w : 1.0;
    canvas.save();
    canvas.translate(x, y);
    if (k != 1) canvas.scale(k, 1);
    canvas.drawParagraph(para, ui.Offset(dx, dy));
    canvas.restore();
  }

  @override
  void drawImage(RecapImage image, double x, double y, double w, double h) {
    if (image is! UiRecapImage) return;
    final img = image.image;
    final src = ui.Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble());
    final dst = ui.Rect.fromLTWH(x, y, w, h);
    if (_hasShadow) {
      final paint = ui.Paint()
        ..colorFilter = ui.ColorFilter.mode(_shadowPaintColor, ui.BlendMode.srcIn)
        ..filterQuality = ui.FilterQuality.medium;
      if (_shadowSigma > 0) paint.imageFilter = ui.ImageFilter.blur(sigmaX: _shadowSigma, sigmaY: _shadowSigma);
      canvas.drawImageRect(img, src, dst.shift(ui.Offset(0, _s.shadowOffsetY)), paint);
    }
    canvas.drawImageRect(
        img,
        src,
        dst,
        ui.Paint()
          ..color = ui.Color.fromRGBO(0, 0, 0, _s.alpha)
          ..blendMode = _blend
          ..filterQuality = ui.FilterQuality.medium);
  }
}

/// Column-major identity matrix for ImageShader.
abstract final class Float64List4x4 {
  static final Float64List identity = Float64List(16)
    ..[0] = 1
    ..[5] = 1
    ..[10] = 1
    ..[15] = 1;
}

// ── Recording backend (tests) ─────────────────────────────────────────────────────────────────

/// Logs every drawing call (recap.test.ts `recordingContext`); text is measured as
/// `codePoints × fontSize × 0.55` like the vitest stub.
class RecordingRecapCtx extends RecapCtx {
  final List<String> log = [];

  /// Numbers as rounded thousandths (`Math.floor(v * 1000 + 0.5)`), so a JavaScript recorder prints the same text.
  static String fmt(Object? v) {
    if (v is num) {
      final d = v.toDouble();
      if (!d.isFinite) return d.isNaN ? 'NaN' : (d > 0 ? 'Infinity' : '-Infinity');
      return '${(d * 1000 + 0.5).floor()}';
    }
    if (v is RecapGradient) return '${v.radial ? 'rg' : 'lg'} ${v.args.map(fmt).join(',')} ${[for (var i = 0; i < v.colors.length; i++) '${fmt(v.offsets[i])} ${v.colors[i]}'].join(';')}';
    if (v is RecapPattern) return '[pattern]';
    if (v is RecapFont) return v.css;
    return '$v';
  }

  void _log(String name, List<Object?> args) => log.add('$name(${args.map(fmt).join(',')})');
  String get _state => 'a=${fmt(_s.alpha)} c=${_s.composite} lw=${fmt(_s.lineWidth)} cap=${_s.lineCap} dash=${_s.dash.map(fmt).join('/')} '
      'sh=${_s.shadowColor}/${fmt(_s.shadowBlur)}/${fmt(_s.shadowOffsetY)} font=${_s.font.css} ta=${_s.textAlign} tb=${_s.textBaseline}';

  @override
  void beginPath() {
    super.beginPath();
    _log('beginPath', const []);
  }

  @override
  void moveTo(double x, double y) {
    super.moveTo(x, y);
    _log('moveTo', [x, y]);
  }

  @override
  void lineTo(double x, double y) {
    super.lineTo(x, y);
    _log('lineTo', [x, y]);
  }

  @override
  void bezierCurveTo(double a, double b, double c, double d, double x, double y) {
    super.bezierCurveTo(a, b, c, d, x, y);
    _log('bezierCurveTo', [a, b, c, d, x, y]);
  }

  @override
  void quadraticCurveTo(double a, double b, double x, double y) {
    super.quadraticCurveTo(a, b, x, y);
    _log('quadraticCurveTo', [a, b, x, y]);
  }

  @override
  void arc(double x, double y, double r, double a0, double a1, [bool ccw = false]) {
    super.arc(x, y, r, a0, a1, ccw);
    _log('arc', [x, y, r, a0, a1, ccw]);
  }

  @override
  void rect(double x, double y, double w, double h) {
    super.rect(x, y, w, h);
    _log('rect', [x, y, w, h]);
  }

  /// Logged as the web helper draws it (moveTo + four arcTo + closePath).
  @override
  void roundRectPath(double x, double y, double w, double h, double r) {
    super.roundRectPath(x, y, w, h, r);
    _log('moveTo', [x + r, y]);
    _log('arcTo', [x + w, y, x + w, y + h, r]);
    _log('arcTo', [x + w, y + h, x, y + h, r]);
    _log('arcTo', [x, y + h, x, y, r]);
    _log('arcTo', [x, y, x + w, y, r]);
    _log('closePath', const []);
  }

  @override
  void closePath() {
    super.closePath();
    _log('closePath', const []);
  }

  @override
  void onSave() => _log('save', const []);
  @override
  void onRestore() => _log('restore', const []);
  @override
  void translate(double x, double y) => _log('translate', [x, y]);
  @override
  void scale(double x, double y) => _log('scale', [x, y]);
  @override
  void rotate(double angle) => _log('rotate', [angle]);
  @override
  void fill() => _log('fill', [_s.fillStyle, _state]);
  @override
  void stroke() => _log('stroke', [_s.strokeStyle, _state]);
  @override
  void clip({bool evenOdd = false}) => _log('clip', [evenOdd]);
  @override
  void fillRect(double x, double y, double w, double h) => _log('fillRect', [x, y, w, h, _s.fillStyle, _state]);
  @override
  void fillText(String text, double x, double y, [double? maxWidth]) => _log('fillText', [text, x, y, maxWidth, _s.fillStyle, _state]);
  @override
  double measureText(String text) => text.runes.length * _s.font.size * 0.55;
  @override
  void drawImage(RecapImage image, double x, double y, double w, double h) => _log('drawImage', [image.width, image.height, x, y, w, h, _state]);
}
