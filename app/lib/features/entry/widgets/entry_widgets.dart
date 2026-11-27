// Ported from: src/styles/anacan-design.css (.a-sky, .a-cloud c1–c5, @keyframes a-cloud-drift, .a-icon-btn,
//              .a-card), src/components/ui/input.tsx (shadcn Input), framer-motion initial/animate/exit props
//              used by the entry screens (InitialLanguageScreen, AuthScreen, ResetPassword, consent gate …)
//
// Small building blocks shared by the entry-flow gates.
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';

/// `@/assets/brand-mark.png`.
const String kBrandMarkAsset = 'assets/images/entry/brand-mark.png';

/// `public/brand-mark*.png` are not used here; flags live in `assets/images/entry/flags/<iso>.png`.
String flagAsset(String iso) => 'assets/images/entry/flags/${iso.toLowerCase()}.png';

/// Inline `style={{ fontSize, fontWeight, letterSpacing: 'Xem', lineHeight }}` → [TextStyle].
/// Default line height 1.5 (Tailwind preflight, inherited), CSS half-leading.
TextStyle css(double size, FontWeight weight, {Color? color, double? lsEm, double? lsPx, double height = 1.5}) =>
    TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      leadingDistribution: TextLeadingDistribution.even,
      letterSpacing: lsPx ?? (lsEm == null ? null : lsEm * size),
    );

/// CSS `box-shadow: x y blur spread color` (Flutter's blurRadius = CSS blur / 2 sigma-wise is handled by
/// [BoxShadow] itself: blurRadius equals the CSS blur length).
BoxShadow cssShadow(double y, double blur, double spread, Color color, {double x = 0}) =>
    BoxShadow(offset: Offset(x, y), blurRadius: blur, spreadRadius: spread, color: color);

// ── Watercolor sky ──────────────────────────────────────────────────────────────────────────────

class _Cloud {
  const _Cloud(this.w, this.h, this.top, {this.start, this.end, this.startPct, this.endPct, this.opacity = 1, this.delay = 0});
  final double w, h, top;
  final double? start, end, startPct, endPct;
  final double opacity;
  final double delay; // seconds
}

/// `.a-cloud.c1` … `.c5` (anacan-design.css:231-235).
const List<_Cloud> _clouds = [
  _Cloud(160, 48, 34, start: -34),
  _Cloud(120, 38, 84, end: -22, opacity: 0.9, delay: 2.6),
  _Cloud(92, 30, 156, startPct: 0.12, opacity: 0.7, delay: 5.2),
  _Cloud(130, 40, 196, endPct: 0.08, opacity: 0.55, delay: 7.4),
  _Cloud(72, 26, 118, startPct: 0.44, opacity: 0.55, delay: 3.8),
];

/// `<div className="a-sky"><span className="a-cloud c1" />…</div>`: 330px watercolor backdrop at the top of
/// the screen with [clouds] drifting clouds (12 s `a-cloud-drift`, off in lite mode / reduced motion).
class EntrySky extends StatefulWidget {
  const EntrySky({super.key, this.clouds = 4});

  /// How many of c1…c5 the screen renders.
  final int clouds;

  @override
  State<EntrySky> createState() => _EntrySkyState();
}

class _EntrySkyState extends State<EntrySky> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(days: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_c.isAnimating) _c.forward();
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// `a-cloud-drift`: 0%,100% translate(0,0); 50% translate(16px,-7px); ease-in-out per segment.
  static Offset drift(double seconds, double delay) {
    if (seconds < delay) return Offset.zero;
    final t = ((seconds - delay) % 12) / 12;
    final half = t < 0.5 ? t * 2 : (1 - t) * 2;
    final eased = ACurves.cssEaseInOut.transform(t < 0.5 ? half : 1 - half);
    final k = t < 0.5 ? eased : 1 - eased;
    return Offset(16 * k, -7 * k);
  }

  @override
  Widget build(BuildContext context) {
    final dark = context.tokens.isDark;
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: 330,
      child: IgnorePointer(
        child: ClipRect(
          child: LayoutBuilder(builder: (context, box) {
            final width = box.maxWidth;
            return Stack(clipBehavior: Clip.none, children: [
              Positioned.fill(child: CustomPaint(painter: _SkyPainter(dark: dark))),
              for (final cloud in _clouds.take(widget.clouds))
                PositionedDirectional(
                  top: cloud.top,
                  start: cloud.start ?? (cloud.startPct == null ? null : cloud.startPct! * width),
                  end: cloud.end ?? (cloud.endPct == null ? null : cloud.endPct! * width),
                  width: cloud.w,
                  height: cloud.h,
                  child: AnimatedBuilder(
                    animation: _c,
                    builder: (context, child) {
                      final seconds = (_c.lastElapsedDuration ?? Duration.zero).inMicroseconds / 1e6;
                      final offset = _c.isAnimating ? drift(seconds, cloud.delay) : Offset.zero;
                      return Transform.translate(offset: offset, child: child);
                    },
                    child: Opacity(
                      opacity: cloud.opacity,
                      child: ImageFiltered(
                        imageFilter: ui.ImageFilter.blur(sigmaX: 13, sigmaY: 13, tileMode: TileMode.decal),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            // .a-cloud rgba(255,255,255,.85) / .dark .a-cloud rgba(255,255,255,.07) (anacan-design.css:222,228)
                            color: dark ? const Color(0x12FFFFFF) : const Color(0xD9FFFFFF),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ]);
          }),
        ),
      ),
    );
  }
}

class _Radial {
  const _Radial(this.rx, this.ry, this.cx, this.cy, this.colors, this.stops);
  final double rx, ry, cx, cy; // fractions of the box
  final List<Color> colors;
  final List<double> stops;
}

/// The `.a-sky` / `.dark .a-sky` radial-gradient stacks (anacan-design.css:205-216), painted bottom → top.
class _SkyPainter extends CustomPainter {
  const _SkyPainter({required this.dark});
  final bool dark;

  static const _light = <_Radial>[
    _Radial(1.2, 0.85, 0.5, -0.3, [Color(0x80F69E7E), Color(0x61F9BBA2), Color(0x00FFE7E1)], [0, 0.42, 0.78]),
    _Radial(0.52, 0.34, 0.10, 0.04, [Color(0x8CFFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
    _Radial(0.48, 0.30, 0.90, 0.10, [Color(0x73FFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
    _Radial(0.40, 0.26, 0.68, 0.02, [Color(0x47F49476), Color(0x00F49476)], [0, 0.72]),
  ];
  static const _dark = <_Radial>[
    _Radial(1.2, 0.85, 0.5, -0.3, [Color(0x29F69E7E), Color(0x1AF9BBA2), Color(0x00201512)], [0, 0.42, 0.78]),
    _Radial(0.52, 0.34, 0.10, 0.04, [Color(0x0DFFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
    _Radial(0.48, 0.30, 0.90, 0.10, [Color(0x0AFFFFFF), Color(0x00FFFFFF)], [0, 0.7]),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final layers = dark ? _dark : _light;
    // CSS: the first background layer is on top.
    for (final r in layers.reversed) {
      // CSS `radial-gradient(120% 85% at 50% -30%, …)`: an ellipse whose radii are % of the box; drawn as a
      // unit circle gradient in a scaled canvas.
      canvas.save();
      canvas.translate(r.cx * size.width, r.cy * size.height);
      canvas.scale(r.rx * size.width, r.ry * size.height);
      final paint = Paint()..shader = ui.Gradient.radial(Offset.zero, 1, r.colors, r.stops);
      canvas.drawRect(Rect.fromLTRB(-r.cx / r.rx, -r.cy / r.ry, (1 - r.cx) / r.rx, (1 - r.cy) / r.ry), paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_SkyPainter old) => old.dark != dark;
}

// ── Buttons, fields ────────────────────────────────────────────────────────────────────────────

/// `.a-icon-btn`: 38×38, radius 12, surface, 1px `--a-btn-border`, shadow 0 6 14 -8 rgba(217,108,74,.35).
class EntryIconButton extends StatelessWidget {
  const EntryIconButton({super.key, required this.child, required this.onTap, this.size = 38, this.semanticLabel});
  final Widget child;
  final VoidCallback? onTap;
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.4 : 1,
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: a.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: a.btnBorder),
              // anacan-design.css:296
              boxShadow: [cssShadow(6, 14, -8, const Color(0x59D96C4A))],
            ),
            child: IconTheme.merge(data: IconThemeData(color: a.ink), child: child),
          ),
        ),
      ),
    );
  }
}

/// AuthScreen / ResetPassword input: `ps-11 h-12 rounded-xl border-2 border-transparent text-base
/// bg-[var(--a-surface-soft)] text-[var(--a-ink)] focus:border-[accent]` with a leading icon at start-4.
class EntryField extends StatefulWidget {
  const EntryField({
    super.key,
    required this.icon,
    this.controller,
    this.placeholder,
    this.obscure = false,
    this.trailing,
    this.focusColor,
    this.height = 48,
    this.radius = 12,
    this.paddingStart = 44,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
    this.style,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.enabled = true,
    this.semanticLabel,
    this.autofillHints,
    this.fieldKey,
  });

  final AIconData icon;
  final TextEditingController? controller;
  final String? placeholder;
  final bool obscure;
  final Widget? trailing;

  /// `focus:border-[…]` (peach-2 on the main form, #63acdf on the partner form).
  final Color? focusColor;
  final double height;
  final double radius;
  final double paddingStart;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final TextStyle? style;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final bool enabled;
  final String? semanticLabel;
  final Iterable<String>? autofillHints;
  final Key? fieldKey;

  @override
  State<EntryField> createState() => _EntryFieldState();
}

class _EntryFieldState extends State<EntryField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final a = t.a;
    final focused = _focus.hasFocus;
    final accent = widget.focusColor ?? a.peach2;
    final base = widget.style ?? css(16, FontWeight.w400, color: a.ink, height: 1.25);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: ACurves.tailwind,
      height: widget.height,
      decoration: BoxDecoration(
        color: a.surfaceSoft,
        borderRadius: BorderRadius.circular(widget.radius),
        border: Border.all(color: focused ? accent : const Color(0x00000000), width: 2),
      ),
      child: Stack(alignment: Alignment.center, children: [
        Positioned.fill(
          child: Padding(
            padding: EdgeInsetsDirectional.only(start: widget.paddingStart - 2, end: widget.trailing != null ? 42 : 10),
            child: Center(
              child: TextField(
                key: widget.fieldKey,
                controller: widget.controller,
                focusNode: _focus,
                enabled: widget.enabled,
                obscureText: widget.obscure,
                keyboardType: widget.keyboardType,
                textCapitalization: widget.textCapitalization,
                inputFormatters: widget.inputFormatters,
                onChanged: widget.onChanged,
                onSubmitted: widget.onSubmitted,
                textInputAction: widget.textInputAction,
                autofillHints: widget.autofillHints,
                autocorrect: false,
                enableSuggestions: !widget.obscure,
                style: base,
                cursorColor: a.ink,
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  hintText: widget.placeholder,
                  // shadcn input placeholder:text-muted-foreground
                  hintStyle: base.copyWith(color: t.shadcn.mutedForeground),
                  semanticCounterText: widget.semanticLabel,
                ),
              ),
            ),
          ),
        ),
        PositionedDirectional(
          start: 14,
          child: IgnorePointer(
            child: AIcon(widget.icon, size: 20, color: focused ? accent : a.inkFaint),
          ),
        ),
        if (widget.trailing != null) PositionedDirectional(end: 14, child: widget.trailing!),
      ]),
    );
  }
}

/// `w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full` rotating 0.8 s linear (framer) or
/// `animate-spin` (1 s) — [period] picks which.
class EntryRingSpinner extends StatefulWidget {
  const EntryRingSpinner({
    super.key,
    this.size = 24,
    this.stroke = 3,
    this.color = const Color(0xFFFFFFFF),
    this.trackColor = const Color(0x4DFFFFFF),
    this.period = const Duration(milliseconds: 800),
    this.topGap = false,
  });

  /// `border-white border-t-transparent` (ResetPassword): the top quarter is the gap instead of the accent.
  final bool topGap;
  final double size, stroke;
  final Color color, trackColor;
  final Duration period;

  @override
  State<EntryRingSpinner> createState() => _EntryRingSpinnerState();
}

class _EntryRingSpinnerState extends State<EntryRingSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.period);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(
          size: Size.square(widget.size),
          painter: _RingPainter(widget.stroke, widget.color, widget.trackColor, topGap: widget.topGap),
        ),
      );
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.stroke, this.color, this.track, {this.topGap = false});
  final bool topGap;
  final double stroke;
  final Color color, track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    if (topGap) {
      canvas.drawArc(rect, -math.pi / 4, math.pi * 3 / 2, false, p..color = color);
      return;
    }
    canvas.drawArc(rect, 0, math.pi * 2, false, p..color = track);
    // border-top only: the top quarter (−135° … −45°).
    canvas.drawArc(rect, -math.pi * 3 / 4, math.pi / 2, false, p..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color || old.track != track || old.stroke != stroke;
}

/// lucide `Loader2` + `animate-spin` (1 s linear).
class EntryLoader extends StatefulWidget {
  const EntryLoader({super.key, this.size = 16, this.color});
  final double size;
  final Color? color;

  @override
  State<EntryLoader> createState() => _EntryLoaderState();
}

class _EntryLoaderState extends State<EntryLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RotationTransition(turns: _c, child: AIcon(AIcons.loaderCircle, size: widget.size, color: widget.color));
}

// ── framer-motion helpers ─────────────────────────────────────────────────────────────────────

/// framer `initial={{opacity, x, y, scale}} animate={{opacity: 1, x: 0, y: 0, scale: 1}}`.
///
/// * [duration] given → one tween over every property with framer's default ease.
/// * otherwise → x/y/scale follow [spring] (framer default for transforms: 500/25, or `type: 'spring'`
///   configs), opacity a 300 ms tween.
///
/// Reduced motion → rendered in the final state.
class MotionIn extends StatefulWidget {
  const MotionIn({
    super.key,
    required this.child,
    this.opacity = 0,
    this.offset = Offset.zero,
    this.scale = 1,
    this.delay = Duration.zero,
    this.duration,
    this.spring,
  });

  final Widget child;
  final double opacity;
  final Offset offset;
  final double scale;
  final Duration delay;
  final Duration? duration;
  final SpringDescription? spring;

  @override
  State<MotionIn> createState() => _MotionInState();
}

class _MotionInState extends State<MotionIn> with TickerProviderStateMixin {
  late final AnimationController _fade =
      AnimationController(vsync: this, duration: widget.duration ?? const Duration(milliseconds: 300));
  late final AnimationController _move = AnimationController.unbounded(vsync: this, value: 0);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _fade.value = 1;
      _move.value = 1;
      return;
    }
    Future<void>.delayed(widget.delay, () {
      if (!mounted) return;
      _fade.forward();
      if (widget.duration != null) {
        _move.animateTo(1, duration: widget.duration, curve: ACurves.framerDefault);
      } else {
        _move.animateWith(SpringSimulation(widget.spring ?? ASprings.transform, 0, 1, 0));
      }
    });
  }

  @override
  void dispose() {
    _fade.dispose();
    _move.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: Listenable.merge([_fade, _move]),
        child: widget.child,
        builder: (context, child) {
          final f = widget.duration != null ? ACurves.framerDefault.transform(_fade.value) : _fade.value;
          final m = _move.value;
          final o = widget.opacity + (1 - widget.opacity) * f;
          final offset = widget.offset * (1 - m);
          final s = widget.scale + (1 - widget.scale) * m;
          Widget out = child!;
          if (s != 1) out = Transform.scale(scale: s, child: out);
          if (offset != Offset.zero) out = Transform.translate(offset: offset, child: out);
          return o >= 1 ? out : Opacity(opacity: o.clamp(0.0, 1.0), child: out);
        },
      );
}

/// `<AnimatePresence mode="wait">` around one keyed child: the old child plays [exitOffset]/fade over
/// [exitDuration], then the new child mounts (its own [MotionIn] plays the enter animation).
class PresenceSwitcher extends StatefulWidget {
  const PresenceSwitcher({
    super.key,
    required this.childKey,
    required this.child,
    this.exitOffset = Offset.zero,
    this.exitDuration = const Duration(milliseconds: 300),
  });

  final Object childKey;
  final Widget child;
  final Offset exitOffset;
  final Duration exitDuration;

  @override
  State<PresenceSwitcher> createState() => _PresenceSwitcherState();
}

class _PresenceSwitcherState extends State<PresenceSwitcher> with SingleTickerProviderStateMixin {
  late Object _shownKey = widget.childKey;
  late Widget _shown = widget.child;
  late final AnimationController _exit = AnimationController(vsync: this, duration: widget.exitDuration);

  @override
  void didUpdateWidget(PresenceSwitcher old) {
    super.didUpdateWidget(old);
    if (widget.childKey == _shownKey) {
      _shown = widget.child;
      return;
    }
    if (animationsDisabled(context)) {
      _swap();
      return;
    }
    if (!_exit.isAnimating) {
      _exit.forward(from: 0).whenComplete(() {
        if (mounted) setState(_swap);
      });
    }
  }

  void _swap() {
    _shownKey = widget.childKey;
    _shown = widget.child;
    _exit.value = 0;
  }

  @override
  void dispose() {
    _exit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _exit,
        child: KeyedSubtree(key: ValueKey(_shownKey), child: _shown),
        builder: (context, child) {
          final v = ACurves.framerDefault.transform(_exit.value);
          if (v == 0) return child!;
          return Opacity(
            opacity: 1 - v,
            child: Transform.translate(offset: widget.exitOffset * v, child: child),
          );
        },
      );
}

/// Brand mark image (`<img src={logoImage}>`).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, required this.size});
  final double size;
  @override
  Widget build(BuildContext context) =>
      Image.asset(kBrandMarkAsset, width: size, height: size, fit: BoxFit.contain, semanticLabel: 'Anacan');
}

/// CSS `text-transform: uppercase` under `lang` = az / tr (and Crimean Tatar): `i` → `İ` (dotted capital), like
/// the browser does; other languages use the default mapping.
String cssUppercase(String text, String language) {
  final l = language.toLowerCase();
  if (l == 'az' || l == 'tr' || l == 'crh') return text.replaceAll('i', 'İ').toUpperCase();
  return text.toUpperCase();
}
