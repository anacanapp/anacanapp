// Ported from: src/index.css, src/styles/anacan-design.css, tailwind.config.ts
// (value types the generated *.g.dart token files are expressed in)
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/animation.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

/// A CSS `linear-gradient(<angle>, …)` with the exact CSS gradient-line geometry.
///
/// CSS: 0deg points up, angles run clockwise, and the gradient line passes through the
/// centre of the box with length `|w·sinθ| + |h·cosθ|`, so the first/last stops touch
/// opposite corners for any aspect ratio. Flutter's [LinearGradient] with alignments
/// would only match for square boxes. CSS gradients do not mirror in RTL.
@immutable
class CssLinearGradient extends LinearGradient {
  const CssLinearGradient({
    required this.angle,
    required super.colors,
    super.stops,
    super.tileMode,
  });

  /// CSS angle in degrees (`135deg`, `to bottom` = 180).
  final double angle;

  /// Start/end points of the CSS gradient line for [rect].
  (Offset, Offset) linePoints(Rect rect) {
    final rad = angle * math.pi / 180;
    final dx = math.sin(rad);
    final dy = -math.cos(rad);
    final len = (rect.width * dx).abs() + (rect.height * dy).abs();
    final half = Offset(dx, dy) * (len / 2);
    return (rect.center - half, rect.center + half);
  }

  @override
  ui.Shader createShader(Rect rect, {TextDirection? textDirection}) {
    final (start, end) = linePoints(rect);
    return ui.Gradient.linear(start, end, colors, stops, tileMode);
  }

  @override
  CssLinearGradient scale(double factor) => CssLinearGradient(
        angle: angle,
        colors: colors.map((c) => Color.lerp(null, c, factor)!).toList(),
        stops: stops,
        tileMode: tileMode,
      );

  /// True when every stop is the same colour (dark-theme "flat" gradients).
  bool get isFlat => colors.every((c) => c == colors.first);

  @override
  bool operator ==(Object other) =>
      other is CssLinearGradient &&
      other.angle == angle &&
      listEquals(other.colors, colors) &&
      listEquals(other.stops, stops) &&
      other.tileMode == tileMode;

  @override
  int get hashCode => Object.hash(angle, Object.hashAll(colors), stops == null ? null : Object.hashAll(stops!), tileMode);
}

/// Tailwind `text-*` entry: font size and line height in logical px.
@immutable
class TwTextSize {
  const TwTextSize(this.fontSize, this.lineHeightPx);
  final double fontSize;
  final double lineHeightPx;

  /// Flutter [TextStyle.height] multiplier.
  double get height => lineHeightPx / fontSize;
}

/// One frame of a CSS `@keyframes` block. Missing properties keep the element's value.
@immutable
class CssKeyframe {
  const CssKeyframe({
    required this.offset,
    this.opacity,
    this.translateX,
    this.translateY,
    this.translateIsPercent = false,
    this.scale,
    this.rotateDeg,
    this.implicit = false,
    this.raw = const <String, String>{},
  });

  /// 0..1 (`from` = 0, `to` = 1, `50%` = 0.5).
  final double offset;
  final double? opacity;

  /// px, or % of the element's own size when [translateIsPercent].
  final double? translateX;
  final double? translateY;
  final bool translateIsPercent;
  final double? scale;
  final double? rotateDeg;

  /// Frame not written in CSS (implicit 0%/100% = element's own value).
  final bool implicit;

  /// Properties the generator kept verbatim (see app/tool/design/token_report.md).
  final Map<String, String> raw;
}

/// A Tailwind `animate-*` utility: keyframes + timing.
@immutable
class CssAnimationSpec {
  const CssAnimationSpec({
    required this.name,
    required this.duration,
    required this.curve,
    required this.infinite,
    required this.frames,
  });
  final String name;
  final Duration duration;
  final Curve curve;
  final bool infinite;
  final List<CssKeyframe> frames;
}
