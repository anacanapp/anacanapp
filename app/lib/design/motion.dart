// Ported from: src/styles/anacan-design.css (--a-ease/--a-spring/--a-bounce, .a3-enter, .a3-btn:active,
//              html.a-lite, prefers-reduced-motion), src/index.css (.btn-press), src/lib/rtl.ts (rtlX),
//              framer-motion spring configs across src/**/*.tsx (see ASprings), vaul 0.9.9 TRANSITIONS,
//              node_modules/motion-dom/dist/es/animation/utils/default-transitions.mjs (whileTap default)
import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import 'tokens/anacan_tokens.dart';

/// CSS timing functions.
abstract final class ACurves {
  /// `--a-ease: cubic-bezier(0.22, 1, 0.36, 1)`
  static final Cubic ease = ATokens.light.ease;

  /// `--a-spring: cubic-bezier(0.32, 0.72, 0, 1)` (also vaul's sheet transition).
  static final Cubic spring = ATokens.light.spring;

  /// `--a-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoots).
  static final Cubic bounce = ATokens.light.bounce;

  /// CSS keyword `ease`.
  static const Cubic cssEase = Cubic(0.25, 0.1, 0.25, 1);

  /// CSS keyword `ease-out` (framer `easeOut` is the same curve).
  static const Cubic cssEaseOut = Cubic(0, 0, 0.58, 1);

  /// CSS keyword `ease-in-out`.
  static const Cubic cssEaseInOut = Cubic(0.42, 0, 0.58, 1);

  /// CSS keyword `ease-in`.
  static const Cubic cssEaseIn = Cubic(0.42, 0, 1, 1);

  /// Tailwind `transition-*` default `cubic-bezier(0.4, 0, 0.2, 1)`.
  static const Cubic tailwind = Cubic(0.4, 0, 0.2, 1);

  /// framer-motion default tween for non-transform values (`[0.25, 0.1, 0.35, 1]`, 300ms).
  static const Cubic framerDefault = Cubic(0.25, 0.1, 0.35, 1);
}

/// Durations written in the CSS rules.
abstract final class ADurations {
  /// `.a3-btn`, `.a3-icon-btn`, `.a3-tk`, `.a3-q .sq` transform transition.
  static const Duration press = Duration(milliseconds: 160);

  /// `.btn-press` (index.css): `transform 0.15s ease`.
  static const Duration btnPress = Duration(milliseconds: 150);

  /// `.a3-enter > *`: `a3-rise 560ms var(--a-spring) backwards`.
  static const Duration enterRise = Duration(milliseconds: 560);

  /// `.a3-enter` nth-child delay step and cap (50ms … 250ms).
  static const Duration enterStagger = Duration(milliseconds: 50);
  static const Duration enterStaggerMax = Duration(milliseconds: 250);

  /// `.a3-enter .a3-ring .fill`: `a3-draw 1100ms var(--a-spring)`.
  static const Duration ringDraw = Duration(milliseconds: 1100);

  /// `.a3-ring .fill`: `stroke-dashoffset 700ms var(--a-spring)`.
  static const Duration ringChange = Duration(milliseconds: 700);

  /// `.a-nav-ind`: `transform 480ms var(--a-bounce)`.
  static const Duration navIndicator = Duration(milliseconds: 480);

  /// vaul `TRANSITIONS.DURATION` (0.5s, cubic-bezier(0.32, 0.72, 0, 1)).
  static const Duration sheet = Duration(milliseconds: 500);

  /// `.a3-tri i b` width transition.
  static const Duration triFill = Duration(milliseconds: 800);

  /// `.a3-tk.bump`: `a3-pop 420ms var(--a-bounce)`.
  static const Duration pop = Duration(milliseconds: 420);

  /// `.a3-check`: background 220ms spring, transform 220ms bounce.
  static const Duration check = Duration(milliseconds: 220);
}

/// framer-motion `transition={{ type: 'spring', … }}` as Flutter [SpringDescription]s.
///
/// Recurring configurations in consumer code (src/**/*.tsx excluding admin/website/brand-portal/
/// public-blog; counted 2026-11, 67 spring transitions). framer defaults: stiffness 100,
/// damping 10, mass 1.
///
/// | uses | stiffness | damping | helper |
/// |---:|---:|---:|---|
/// | 9 | 300 | 25 | [standard] |
/// | 9 | 100 | 10 | [framerDefault] (`type: 'spring'` alone) |
/// | 5 | 100 | 25 | [soft] |
/// | 4 | 200 | 10 | [bouncy200] |
/// | 3 | 100 | 26 | `spring(damping: 26)` |
/// | 2 each | 300/26, 300/28, 200/12, 260/14, 200/20, 300/10, 100/13, 100/12, 100/18 | | `spring(...)` |
abstract final class ASprings {
  /// `{ type: 'spring', stiffness, damping, mass }` with framer defaults.
  static SpringDescription spring({double stiffness = 100, double damping = 10, double mass = 1}) =>
      SpringDescription(mass: mass, stiffness: stiffness, damping: damping);

  /// `{ type: 'spring', damping: 25, stiffness: 300 }` — the common one.
  static final SpringDescription standard = spring(stiffness: 300, damping: 25);

  /// `{ type: 'spring' }` (framer defaults 100 / 10 / 1).
  static final SpringDescription framerDefault = spring();

  /// `{ type: 'spring', damping: 25 }`.
  static final SpringDescription soft = spring(damping: 25);

  /// `{ type: 'spring', stiffness: 200 }`.
  static final SpringDescription bouncy200 = spring(stiffness: 200);

  /// framer's default transition for `scale` targets (whileTap/whileHover without a transition):
  /// `criticallyDampedSpring` = stiffness 550, damping 30 (2·√550 when the target is 0), restSpeed 10.
  static final SpringDescription tapScale = spring(stiffness: 550, damping: 30);

  /// framer's default for x/y/rotate targets: `underDampedSpring` 500 / 25.
  static final SpringDescription transform = spring(stiffness: 500, damping: 25);
}

/// True when the OS asks for reduced motion (`prefers-reduced-motion: reduce`).
bool animationsDisabled(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Decorative infinite animations (clouds, bob, drift, pulse) run only when neither
/// `html.a-lite` nor reduced motion is active.
bool infiniteAnimationsAllowed(BuildContext context) => !AnacanTokens.of(context).lite && !animationsDisabled(context);

/// Port of `rtlX(value, isRtl)` for numbers: mirrors a horizontal motion offset.
double rtlX(double value, bool isRtl) => isRtl ? -value : value;

/// Port of `rtlX` for strings (`'20%'`, `'-12px'`); other values pass through unchanged.
Object rtlXValue(Object value, bool isRtl) {
  if (!isRtl) return value;
  if (value is num) return -value;
  if (value is String) {
    final m = RegExp(r'^(-?[\d.]+)(.*)$').firstMatch(value);
    if (m != null) {
      final n = -double.parse(m.group(1)!);
      final s = n == n.roundToDouble() ? n.toInt().toString() : n.toString();
      return '$s${m.group(2)}';
    }
  }
  return value;
}

/// [rtlX] using the ambient [Directionality].
double rtlXOf(BuildContext context, double value) => rtlX(value, Directionality.maybeOf(context) == TextDirection.rtl);

/// Scale-on-press feedback: framer `whileTap={{ scale }}` or CSS `:active { transform: scale() }`.
///
/// * `PressScale(scale: 0.95)` — framer whileTap; default transition is framer's
///   critically-damped scale spring ([ASprings.tapScale]). Pass [spring] for an explicit one.
/// * `PressScale.css(scale: 0.97)` — `.btn-press` (150ms `ease`); for `.a3-btn:active` use
///   `PressScale.css(scale: 0.97, duration: ADurations.press, curve: ACurves.ease)`.
///
/// Uses a [Listener], so it never competes with the child's own gesture recognisers.
class PressScale extends StatefulWidget {
  const PressScale({
    super.key,
    required this.child,
    this.scale = 0.95,
    this.spring,
    this.enabled = true,
    this.onTap,
  })  : duration = null,
        curve = null;

  const PressScale.css({
    super.key,
    required this.child,
    this.scale = 0.97,
    Duration this.duration = ADurations.btnPress,
    Curve this.curve = ACurves.cssEase,
    this.enabled = true,
    this.onTap,
  }) : spring = null;

  final Widget child;
  final double scale;
  final SpringDescription? spring;
  final Duration? duration;
  final Curve? curve;
  final bool enabled;

  /// Optional tap callback (wraps the child in a [GestureDetector]).
  final VoidCallback? onTap;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 1);

  void _to(double target) {
    if (!mounted) return;
    if (animationsDisabled(context)) {
      _c.value = target;
      return;
    }
    if (widget.duration != null) {
      _c.animateTo(target, duration: widget.duration, curve: widget.curve ?? ACurves.cssEase);
    } else {
      _c.animateWith(SpringSimulation(widget.spring ?? ASprings.tapScale, _c.value, target, _c.velocity));
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget child = AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Transform.scale(scale: _c.value, child: child),
      child: widget.child,
    );
    if (widget.onTap != null) {
      child = GestureDetector(behavior: HitTestBehavior.opaque, onTap: widget.enabled ? widget.onTap : null, child: child);
    }
    if (!widget.enabled) return child;
    return Listener(
      onPointerDown: (_) => _to(widget.scale),
      onPointerUp: (_) => _to(1),
      onPointerCancel: (_) => _to(1),
      child: child,
    );
  }
}

/// `.a3-enter` choreography: every direct child rises 16px → 0 over 560ms `--a-spring`,
/// staggered 0/50/100/150/200/250ms (6th child onward 250ms), `animation-fill-mode: backwards`
/// (transform only — content is never hidden). Disabled under reduced motion; html.a-lite
/// does not disable it on the web, so it runs in lite mode too.
class AEnter extends StatefulWidget {
  const AEnter({super.key, required this.children, this.layout});

  final List<Widget> children;

  /// Lays out the wrapped children; defaults to a stretched [Column].
  final Widget Function(List<Widget> children)? layout;

  /// Delay for the child at [index] (0-based), as `.a3-enter > *:nth-child(n)`.
  static Duration delayFor(int index) {
    final ms = (index * ADurations.enterStagger.inMilliseconds).clamp(0, ADurations.enterStaggerMax.inMilliseconds);
    return Duration(milliseconds: ms);
  }

  /// Rise offset (px) for [index] at controller time [elapsed].
  static double offsetAt(int index, Duration elapsed) {
    final start = delayFor(index).inMicroseconds;
    final t = ((elapsed.inMicroseconds - start) / ADurations.enterRise.inMicroseconds).clamp(0.0, 1.0);
    return 16 * (1 - ACurves.spring.transform(t));
  }

  @override
  State<AEnter> createState() => _AEnterState();
}

class _AEnterState extends State<AEnter> with SingleTickerProviderStateMixin {
  static final Duration _total = ADurations.enterStaggerMax + ADurations.enterRise;
  late final AnimationController _c = AnimationController(vsync: this, duration: _total);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wrapped = <Widget>[
      for (var i = 0; i < widget.children.length; i++)
        AnimatedBuilder(
          animation: _c,
          child: widget.children[i],
          builder: (context, child) {
            final dy = AEnter.offsetAt(i, _total * _c.value);
            return dy == 0 ? child! : Transform.translate(offset: Offset(0, dy), child: child);
          },
        ),
    ];
    return (widget.layout ?? (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: c))(wrapped);
  }
}
