// Ported from: src/styles/anacan-design.css (.a-dash, .a-sky, .a-cloud c1–c7 + a-cloud-drift, .a-icon-btn, .a-tag,
//              .a-tag-row, .a-trio, .a-trio-item, .a-trio-icon, .dark .a-trio-icon, .a-fade-in, .a-float,
//              .a-eyebrow, .a-wordmark, .a-today-info-*), src/styles/startup.css (.a-topbar overrides),
//              framer-motion `initial`/`animate` entries of src/components/Dashboard.tsx
import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/physics.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';

/// CSS `text-transform: uppercase` with the Azerbaijani / Turkish dotted İ (`:lang(az)`).
String cssUppercase(String text, String language) {
  if (language == 'az' || language == 'tr') return text.replaceAll('i', 'İ').toUpperCase();
  return text.toUpperCase();
}

/// `.a-fade-in`: `a-fade-in 460ms ease both` (opacity 0 → 1, translateY 10 → 0). The animation's fill mode
/// keeps winning over framer's inline `initial/animate` on the same element, so those are not replayed.
class AFadeIn extends StatefulWidget {
  const AFadeIn({super.key, required this.child});
  final Widget child;

  static const Duration duration = Duration(milliseconds: 460);

  @override
  State<AFadeIn> createState() => _AFadeInState();
}

class _AFadeInState extends State<AFadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: AFadeIn.duration);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.value == 0 && !_c.isAnimating) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final v = ACurves.cssEase.transform(_c.value);
        if (v >= 1) return child!;
        return Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 10 * (1 - v)), child: child));
      },
    );
  }
}

/// framer `initial={{ x, y, scale, opacity: 0 }} animate={{ …1 }} transition={{ delay }}` with framer's default
/// transitions: x / y → spring 500 / 25, scale → spring 550 / 30 (or [scaleSpring]), opacity → 300 ms tween.
class FramerEnter extends StatefulWidget {
  const FramerEnter({
    super.key,
    required this.child,
    this.x = 0,
    this.y = 0,
    this.scale,
    this.fade = true,
    this.delay = Duration.zero,
    this.scaleSpring,
  });

  final Widget child;
  final double x;
  final double y;

  /// Initial scale (null = no scale animation).
  final double? scale;
  final bool fade;
  final Duration delay;
  final SpringDescription? scaleSpring;

  @override
  State<FramerEnter> createState() => _FramerEnterState();
}

class _FramerEnterState extends State<FramerEnter> with TickerProviderStateMixin {
  late final AnimationController _t = AnimationController.unbounded(vsync: this, value: 1);
  late final AnimationController _s = AnimationController.unbounded(vsync: this, value: 1);
  late final AnimationController _o = AnimationController(vsync: this, duration: const Duration(milliseconds: 300), value: 1);
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = animationsDisabled(context);
    if (reduce) return;
    _t.value = 0;
    if (widget.scale != null) _s.value = widget.scale!;
    if (widget.fade) _o.value = 0;
    void run() {
      if (!mounted) return;
      _t.animateWith(SpringSimulation(ASprings.transform, 0, 1, 0));
      if (widget.scale != null) _s.animateWith(SpringSimulation(widget.scaleSpring ?? ASprings.tapScale, widget.scale!, 1, 0));
      if (widget.fade) _o.animateTo(1, curve: ACurves.framerDefault);
    }

    if (widget.delay == Duration.zero) {
      run();
    } else {
      _timer = Timer(widget.delay, run);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _t.dispose();
    _s.dispose();
    _o.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_t, _s, _o]),
      child: widget.child,
      builder: (context, child) {
        final p = 1 - _t.value;
        Widget out = child!;
        if (widget.scale != null && _s.value != 1) out = Transform.scale(scale: _s.value, child: out);
        if (p != 0 && (widget.x != 0 || widget.y != 0)) out = Transform.translate(offset: Offset(widget.x * p, widget.y * p), child: out);
        if (widget.fade && _o.value < 1) out = Opacity(opacity: _o.value.clamp(0.0, 1.0), child: out);
        return out;
      },
    );
  }
}

/// Infinite CSS keyframe loop (`.a-float`, `a-cloud-drift`): off under html.a-lite / reduced motion.
class _Loop extends StatefulWidget {
  const _Loop({required this.period, required this.builder, this.delay = Duration.zero, required this.child});
  final Duration period;
  final Duration delay;
  final Widget Function(double t, Widget child) builder;
  final Widget child;

  @override
  State<_Loop> createState() => _LoopState();
}

class _LoopState extends State<_Loop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.period);
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final on = infiniteAnimationsAllowed(context);
    if (on && !_c.isAnimating && _timer == null) {
      _timer = Timer(widget.delay, () {
        if (mounted) _c.repeat();
      });
    } else if (!on) {
      _timer?.cancel();
      _timer = null;
      _c
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      AnimatedBuilder(animation: _c, child: widget.child, builder: (context, child) => widget.builder(_c.value, child!));
}

/// `ease-in-out` keyframe 0%, 100% → 0, 50% → 1.
double _pingPong(double t) {
  final half = t < 0.5 ? t * 2 : (1 - t) * 2;
  return ACurves.cssEaseInOut.transform(half);
}

/// `.a-float`: `a-float 4s ease-in-out infinite` (translateY 0 → -4px → 0).
class AFloat extends StatelessWidget {
  const AFloat({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => _Loop(
        period: const Duration(seconds: 4),
        builder: (t, child) {
          final dy = -4 * _pingPong(t);
          return dy == 0 ? child : Transform.translate(offset: Offset(0, dy), child: child);
        },
        child: child,
      );
}

/// One CSS `radial-gradient(<rx> <ry> at <cx> <cy>, stops)` layer, sizes as fractions of the box.
class _Radial {
  const _Radial(this.rx, this.ry, this.cx, this.cy, this.colors, this.stops);
  final double rx, ry, cx, cy;
  final List<Color> colors;
  final List<double> stops;
}

class _RadialLayersPainter extends CustomPainter {
  const _RadialLayersPainter(this.layers);
  final List<_Radial> layers;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.save();
    canvas.clipRect(rect);
    // CSS paints the first layer on top.
    for (final l in layers.reversed) {
      final rx = l.rx * size.width;
      final ry = l.ry * size.height;
      if (rx <= 0 || ry <= 0) continue;
      canvas.save();
      canvas.translate(l.cx * size.width, l.cy * size.height);
      canvas.scale(rx, ry);
      final paint = Paint()..shader = ui.Gradient.radial(Offset.zero, 1, l.colors, l.stops);
      canvas.drawRect(Rect.fromLTRB(-l.cx * size.width / rx, -l.cy * size.height / ry, (size.width - l.cx * size.width) / rx,
          (size.height - l.cy * size.height) / ry), paint);
      canvas.restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RadialLayersPainter oldDelegate) => oldDelegate.layers != layers;
}

/// `transparent` inside a CSS gradient (premultiplied interpolation) = the neighbour colour at alpha 0.
Color _clear(Color c) => c.withValues(alpha: 0);

/// `.a-sky` (330px watercolor backdrop) with the seven `.a-cloud`s.
class ASky extends StatelessWidget {
  const ASky({super.key});

  static const double height = 330;

  static List<_Radial> _layers(bool dark) {
    if (dark) {
      return const [
        _Radial(1.2, 0.85, 0.5, -0.3, [Color(0x29F69E7E), Color(0x1AF9BBA2), Color(0x00201512)], [0, 0.42, 0.78]),
        _Radial(0.52, 0.34, 0.1, 0.04, [Color(0x0DFFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
        _Radial(0.48, 0.30, 0.9, 0.10, [Color(0x0AFFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
      ];
    }
    return [
      const _Radial(1.2, 0.85, 0.5, -0.3, [Color(0x80F69E7E), Color(0x61F9BBA2), Color(0x00FFE7E1)], [0, 0.42, 0.78]),
      _Radial(0.52, 0.34, 0.1, 0.04, [const Color(0x8CFFFFFF), _clear(const Color(0xFFFFFFFF))], const [0, 0.7]),
      _Radial(0.48, 0.30, 0.9, 0.10, [const Color(0x73FFFFFF), _clear(const Color(0xFFFFFFFF))], const [0, 0.7]),
      _Radial(0.40, 0.26, 0.68, 0.02, [const Color(0x47F49476), _clear(const Color(0xFFF49476))], const [0, 0.72]),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final dark = tokens.isDark;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // c1–c7: width, height, top, start/end offset (px or %), opacity, delay (s), deep.
    final clouds = <(double w, double h, double top, double? start, double? startPct, double? end, double? endPct, double op, double delay, bool deep)>[
      (160, 48, 34, -34, null, null, null, 1, 0, false),
      (120, 38, 84, null, null, -22, null, 0.9, 2.6, false),
      (92, 30, 156, null, 0.12, null, null, 0.7, 5.2, false),
      (130, 40, 196, null, null, null, 0.08, 0.55, 7.4, false),
      (72, 26, 118, null, 0.44, null, null, 0.55, 3.8, false),
      (110, 36, 58, null, 0.30, null, null, 1, 6.3, true),
      (84, 30, 232, null, 0.34, null, null, 0.4, 1.4, true),
    ];
    return IgnorePointer(
      child: SizedBox(
        height: height,
        child: LayoutBuilder(builder: (context, c) {
          final w = c.maxWidth;
          return ClipRect(
            child: Stack(children: [
              Positioned.fill(child: CustomPaint(painter: _RadialLayersPainter(_layers(dark)))),
              for (final cl in clouds)
                Builder(builder: (context) {
                  final startPx = cl.$4 ?? (cl.$5 != null ? cl.$5! * w : null);
                  final endPx = cl.$6 ?? (cl.$7 != null ? cl.$7! * w : null);
                  final left = startPx != null ? (rtl ? w - startPx - cl.$1 : startPx) : (rtl ? endPx! : w - endPx! - cl.$1);
                  final color = cl.$10
                      ? (dark ? const Color(0x1AF59E80) : const Color(0x66F59E80))
                      : (dark ? const Color(0x12FFFFFF) : const Color(0xD9FFFFFF));
                  return Positioned(
                    left: left,
                    top: cl.$3,
                    width: cl.$1,
                    height: cl.$2,
                    child: _Loop(
                      period: const Duration(seconds: 12),
                      delay: Duration(milliseconds: (cl.$9 * 1000).round()),
                      builder: (t, child) {
                        final k = _pingPong(t);
                        if (k == 0) return child;
                        return Transform.translate(offset: Offset(16 * k, -7 * k), child: child);
                      },
                      child: Opacity(
                        opacity: cl.$8,
                        child: ImageFiltered(
                          imageFilter: ui.ImageFilter.blur(sigmaX: 13, sigmaY: 13, tileMode: TileMode.decal),
                          child: DecoratedBox(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999))),
                        ),
                      ),
                    ),
                  );
                }),
            ]),
          );
        }),
      ),
    );
  }
}

/// `.a-icon-btn` inside `.a-topbar` (startup.css: min 44×44).
class AIconBtn extends StatelessWidget {
  const AIconBtn({super.key, required this.child, this.onTap, this.semanticLabel, this.size = 44, this.tapScale});
  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final double size;

  /// framer `whileTap={{ scale }}`.
  final double? tapScale;

  static const List<BoxShadow> shadow = [BoxShadow(offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8, color: Color(0x59D96C4A))];

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    Widget box = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.btnBorder),
        boxShadow: shadow,
      ),
      child: IconTheme.merge(data: IconThemeData(color: t.ink), child: child),
    );
    if (tapScale != null) box = PressScale(scale: tapScale!, child: box);
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: box),
    );
  }
}

/// `.a-tag` (non-interactive chip).
class ATag extends StatelessWidget {
  const ATag(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: t.surfaceSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x00000000)),
      ),
      child: Text(text,
          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.inkSoft, height: 1.5, leadingDistribution: TextLeadingDistribution.even)),
    );
  }
}

/// `.a-trio-icon` (38×38, r12; dark: white background, coral glyph — `!important` beats inline styles).
class ATrioIcon extends StatelessWidget {
  const ATrioIcon({super.key, required this.child, this.gradient, this.color, this.foreground, this.width = 38, this.height = 38});
  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? foreground;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final t = tokens.a;
    final dark = tokens.isDark;
    final fg = dark ? t.peach2 : foreground;
    return Container(
      width: width,
      height: height,
      margin: const EdgeInsets.only(bottom: 9),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: dark ? const Color(0xFFFFFFFF) : color,
        gradient: dark ? null : gradient,
        borderRadius: BorderRadius.circular(12),
      ),
      child: IconTheme.merge(
        data: IconThemeData(color: fg),
        child: DefaultTextStyle.merge(style: TextStyle(color: fg), child: child),
      ),
    );
  }
}

/// `.a-trio-item` (surface, `--a-line` border, r20, padding 14 8, card shadow, centred).
class ATrioItem extends StatelessWidget {
  const ATrioItem({
    super.key,
    required this.icon,
    required this.label,
    this.labelColor,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
    this.color,
    this.shadow = true,
    this.onTap,
  });
  final Widget icon;
  final String label;
  final Color? labelColor;
  final EdgeInsets padding;
  final Color? color;
  final bool shadow;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    Widget item = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? t.surface,
        border: Border.all(color: t.line),
        borderRadius: BorderRadius.circular(t.radiusMd),
        boxShadow: shadow ? t.cardShadow : null,
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        icon,
        Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: labelColor ?? t.inkSoft, height: 1.5, leadingDistribution: TextLeadingDistribution.even)),
      ]),
    );
    if (onTap != null) {
      item = GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: PressScale(scale: 0.92, child: item));
    }
    return item;
  }
}

/// `.a-section` (margin-top 22) with an optional `.a-section-head` (title left, trailing right, 12 below).
class AHomeSection extends StatelessWidget {
  const AHomeSection({super.key, required this.child, this.title, this.trailing, this.centerTitle = false, this.marginTop = 22});
  final Widget child;
  final String? title;
  final Widget? trailing;
  final bool centerTitle;
  final double marginTop;

  @override
  Widget build(BuildContext context) {
    final x = context.aText;
    return Padding(
      padding: EdgeInsets.only(top: marginTop),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (title != null || trailing != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              mainAxisAlignment: centerTitle ? MainAxisAlignment.center : MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (title != null)
                  Flexible(child: Text(title!, textAlign: centerTitle ? TextAlign.center : TextAlign.start, style: x.aSectionTitle.copyWith(height: 1.5))),
                ?trailing,
              ],
            ),
          ),
        child,
      ]),
    );
  }
}

/// Card with a `.a-card-head` (`.a-card-title.a-heading`, font-size 15, 10 below) and a 12.5 / 1.65 paragraph.
class AHomeTextCard extends StatelessWidget {
  const AHomeTextCard({super.key, required this.title, required this.text, this.color});
  final String title;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final x = context.aText;
    return AFadeIn(
      child: ACard(
        color: color,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(title, style: x.heading(x.aCardTitle.copyWith(fontSize: 15)))),
          Text(text, style: TextStyle(fontSize: 12.5, height: 1.65, color: t.inkSoft, leadingDistribution: TextLeadingDistribution.even)),
        ]),
      ),
    );
  }
}

/// Unread count badge of the top-bar chat button (inline style in Dashboard.tsx).
class AUnreadBadge extends StatelessWidget {
  const AUnreadBadge(this.count, {super.key});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 15),
      height: 15,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xFFE05555), borderRadius: BorderRadius.circular(999)), // Dashboard.tsx literal
      child: Text(count > 9 ? '9+' : '$count',
          style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF), height: 1)),
    );
  }
}

/// Emoji glyph run (`"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"` stacks fall back to the
/// platform emoji font natively).
class AEmoji extends StatelessWidget {
  const AEmoji(this.emoji, {super.key, required this.size});
  final String emoji;
  final double size;

  @override
  Widget build(BuildContext context) =>
      Text(emoji, textAlign: TextAlign.center, style: TextStyle(fontSize: size, height: 1, fontWeight: FontWeight.w400));
}

/// `.a-list-icon` (40×40, r13; `.a-list-compact`: 32) with an inline `background: var(--a-grad-*)` / colour.
class AGradIcon extends StatelessWidget {
  const AGradIcon({super.key, required this.child, this.gradient, this.color, this.foreground, this.size = 40, this.radius = 13});
  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? foreground;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, gradient: gradient, borderRadius: BorderRadius.circular(radius)),
        child: IconTheme.merge(
          data: IconThemeData(color: foreground),
          child: DefaultTextStyle.merge(style: TextStyle(color: foreground), child: child),
        ),
      );
}

/// Tailwind `animate-pulse`: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` (opacity 1 → .5 → 1).
/// Skeletons keep pulsing under html.a-lite (not in the a-lite rule); reduced motion stops it.
class APulse extends StatelessWidget {
  const APulse({super.key, required this.child});
  final Widget child;

  static const Cubic curve = Cubic(0.4, 0, 0.6, 1);

  @override
  Widget build(BuildContext context) => animationsDisabled(context)
      ? child
      : _Loop(
          period: const Duration(seconds: 2),
          builder: (t, child) {
            final half = t < 0.5 ? t * 2 : (1 - t) * 2;
            return Opacity(opacity: 1 - 0.5 * curve.transform(half), child: child);
          },
          child: child,
        );
}
