// Ported from: src/components/games/saglam-sebet/SaglamSebetGame.tsx, src/components/games/birlesdir/BirlesdirGame.tsx
//              (shared markup: portal frame, HUD, intro / paused / won / lost overlays, motion buttons),
//              src/components/games/tierLabels.ts, src/styles/game-surface.css
//
// The two arcade games render the same frame with Tailwind classes; these widgets are that markup once.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import '../../../../design/design.dart';
import '../../ui_common/game_widgets.dart' show GameFilledIcon, GamePortal;

export '../../ui_common/tier_labels.dart' show trTierName;

/// `src/styles/game-surface.css`: no rubber-band overscroll on game screens (Flutter text is never selectable,
/// so the user-select / callout rules need nothing).
class GameSurface extends StatelessWidget {
  const GameSurface({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => ScrollConfiguration(behavior: const _NoOverscrollBehavior(), child: child);
}

class _NoOverscrollBehavior extends ScrollBehavior {
  const _NoOverscrollBehavior();
  @override
  Widget buildOverscrollIndicator(BuildContext context, Widget child, ScrollableDetails details) => child;
  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const ClampingScrollPhysics();
}

/// `createPortal(<div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b …">)` with the safe-area
/// spacers above and below.
class ArcadeFrame extends StatelessWidget {
  const ArcadeFrame({super.key, required this.light, required this.dark, required this.hud, required this.body});
  final List<Color> light;
  final List<Color> dark;
  final Widget hud;
  final Widget body;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final padding = MediaQuery.paddingOf(context);
    return GamePortal(
      child: GameSurface(
        child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: tokens.isDark ? dark : light),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: tokens.shadcn.foreground),
          child: Column(children: [
            SizedBox(height: padding.top),
            hud,
            Expanded(child: ClipRect(child: body)),
            SizedBox(height: padding.bottom),
          ]),
        ),
      ),
      ),
    );
  }
}

/// `px-3 pt-2 pb-2 bg-background/70 backdrop-blur-md border-b border-border/40`.
class ArcadeHud extends StatelessWidget {
  const ArcadeHud({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final content = Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: BoxDecoration(
        color: tokens.shadcn.background.withValues(alpha: 0.7),
        border: Border(bottom: BorderSide(color: tokens.shadcn.border.withValues(alpha: 0.4))),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
    if (!tokens.blurEnabled) return content;
    return ClipRect(child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12), child: content));
  }
}

/// The HUD's pause / back button (`w-9 h-9 rounded-xl bg-muted`, whileTap 0.9).
class ArcadeHudButton extends StatelessWidget {
  const ArcadeHudButton({super.key, required this.playing, required this.onTap, required this.label});
  final bool playing;
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return Semantics(
      button: true,
      label: label,
      child: PressScale(
        scale: 0.9,
        spring: ASprings.tapScale,
        onTap: onTap,
        child: Container(
          key: const ValueKey('arcade-hud-button'),
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: tokens.shadcn.muted, borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center,
          child: AIcon(playing ? AIcons.pause : AIcons.arrowLeft, size: 16, color: tokens.shadcn.foreground, mirrorInRtl: !playing),
        ),
      ),
    );
  }
}

/// `h-2 rounded-full bg-muted` progress track with the fill width animated (`easeOut`, 250 ms).
class ArcadeProgressBar extends StatelessWidget {
  const ArcadeProgressBar({super.key, required this.percent, required this.fill});
  final int percent;
  final Gradient fill;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(9999),
      child: Container(
        height: 8,
        color: tokens.shadcn.muted,
        alignment: AlignmentDirectional.centerStart,
        child: TweenAnimationBuilder<double>(
          tween: Tween(end: percent / 100),
          duration: const Duration(milliseconds: 250),
          curve: ACurves.cssEaseOut,
          builder: (context, value, _) => FractionallySizedBox(
            widthFactor: value.clamp(0, 1).toDouble(),
            heightFactor: 1,
            child: DecoratedBox(decoration: BoxDecoration(gradient: fill, borderRadius: BorderRadius.circular(9999))),
          ),
        ),
      ),
    );
  }
}

/// `absolute inset-0 bg-background/{opacity} backdrop-blur-sm flex flex-col items-center justify-center z-30`.
class ArcadeOverlay extends StatelessWidget {
  const ArcadeOverlay({super.key, required this.children, this.opacity = 0.9, this.blur = 4, this.gap = 12, this.horizontalPadding = 24});
  final List<Widget> children;
  final double opacity;
  final double blur;
  final double gap;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    Widget content = Container(
      color: tokens.shadcn.background.withValues(alpha: opacity),
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
      child: Center(
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
          ]),
        ),
      ),
    );
    if (tokens.blurEnabled && blur > 0) {
      content = ClipRect(child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: content));
    }
    return Positioned.fill(child: content);
  }
}

enum ArcadeButtonStyle { primary, muted, faint }

/// `motion.button whileTap={{ scale: 0.95 }}` with the three button looks of the arcade overlays:
/// primary (gradient + shadow-button), `bg-muted text-foreground font-semibold`, `bg-muted/60 text-muted-foreground font-medium`.
class ArcadeButton extends StatelessWidget {
  const ArcadeButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.style = ArcadeButtonStyle.primary,
    this.gradient,
    this.width,
    this.horizontalPadding = 0,
  });
  final String label;
  final VoidCallback? onTap;
  final AIconData? icon;
  final ArcadeButtonStyle style;
  final Gradient? gradient;
  final double? width;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final primary = style == ArcadeButtonStyle.primary;
    final fg = primary
        ? const Color(0xFFFFFFFF)
        : style == ArcadeButtonStyle.muted
            ? tokens.shadcn.foreground
            : tokens.shadcn.mutedForeground;
    final weight = primary ? FontWeight.w700 : style == ArcadeButtonStyle.muted ? FontWeight.w600 : FontWeight.w500;
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: PressScale(
        scale: 0.95,
        spring: ASprings.tapScale,
        enabled: onTap != null,
        onTap: onTap,
        child: Container(
          width: width,
          padding: EdgeInsets.symmetric(vertical: 12, horizontal: horizontalPadding),
          decoration: BoxDecoration(
            gradient: primary ? (gradient ?? tokens.shadcn.gradientPrimary) : null,
            color: primary
                ? null
                : style == ArcadeButtonStyle.muted
                    ? tokens.shadcn.muted
                    : tokens.shadcn.muted.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(24),
            boxShadow: primary ? tokens.shadcn.shadowButton : null,
          ),
          child: Row(mainAxisSize: width == null && horizontalPadding > 0 ? MainAxisSize.min : MainAxisSize.max, mainAxisAlignment: MainAxisAlignment.center, children: [
            if (icon != null) ...[AIcon(icon!, size: 16, color: fg), const SizedBox(width: 8)],
            Flexible(
              child: Text(label,
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.5, fontWeight: weight, color: fg)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `w-16 h-16 rounded-2xl` gradient tile with a white icon and `shadow-glow` (intro emblem).
class ArcadeEmblem extends StatelessWidget {
  const ArcadeEmblem({super.key, required this.icon, required this.gradient});
  final AIconData icon;
  final Gradient gradient;
  @override
  Widget build(BuildContext context) => Container(
        width: 64,
        height: 64,
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(16), boxShadow: AnacanTokens.of(context).shadcn.shadowGlow),
        alignment: Alignment.center,
        child: AIcon(icon, size: 32, color: const Color(0xFFFFFFFF)),
      );
}

/// `px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground` tier chip.
class ArcadeChip extends StatelessWidget {
  const ArcadeChip(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(color: tokens.shadcn.muted, borderRadius: BorderRadius.circular(9999)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: tokens.shadcn.mutedForeground)),
    );
  }
}

/// `text-xl font-bold text-foreground` (overlay headings) / `text-lg` for the paused title.
class ArcadeTitle extends StatelessWidget {
  const ArcadeTitle(this.text, {super.key, this.large = true});
  final String text;
  final bool large;
  @override
  Widget build(BuildContext context) => Semantics(
        header: true,
        child: Text(text,
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: large ? 20 : 18, height: 28 / (large ? 20 : 18), fontWeight: FontWeight.w700, color: AnacanTokens.of(context).shadcn.foreground)),
      );
}

/// A framer `type: 'spring'` scale-in (from [from] to 1) after [delay], with an optional rotate-in.
class ArcadeSpringIn extends StatefulWidget {
  const ArcadeSpringIn({
    super.key,
    required this.child,
    required this.spring,
    this.delay = Duration.zero,
    this.fromRotateDeg = 0,
  });
  final Widget child;
  final SpringDescription spring;
  final Duration delay;
  final double fromRotateDeg;

  @override
  State<ArcadeSpringIn> createState() => _ArcadeSpringInState();
}

class _ArcadeSpringInState extends State<ArcadeSpringIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController.unbounded(vsync: this);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.delay, () {
      if (mounted) _controller.animateWith(SpringSimulation(widget.spring, 0, 1, 0));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (animationsDisabled(context)) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final v = _controller.value;
        return Transform.rotate(
          angle: (1 - v) * widget.fromRotateDeg * math.pi / 180,
          child: Transform.scale(scale: math.max(0, v), child: child),
        );
      },
      child: widget.child,
    );
  }
}

/// The round trophy medal of the won overlay (`w-20 h-20 rounded-full` gradient, spring 200/12).
class ArcadeTrophy extends StatelessWidget {
  const ArcadeTrophy({super.key, required this.gradient});
  final Gradient gradient;
  @override
  Widget build(BuildContext context) => ArcadeSpringIn(
        spring: ASprings.spring(stiffness: 200, damping: 12),
        child: Container(
          width: 80,
          height: 80,
          margin: const EdgeInsets.only(bottom: 4),
          decoration: BoxDecoration(shape: BoxShape.circle, gradient: gradient, boxShadow: AnacanTokens.of(context).shadcn.shadowGlow),
          alignment: Alignment.center,
          child: const AIcon(AIcons.trophy, size: 40, color: Color(0xFFFFFFFF)),
        ),
      );
}

/// Three 36px stars, springing in one after another (delay 0.15 + i·0.15 s, 260/14, rotate −30° → 0).
class ArcadeStars extends StatelessWidget {
  const ArcadeStars({super.key, required this.stars});
  final int stars;
  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          ArcadeSpringIn(
            spring: ASprings.spring(stiffness: 260, damping: 14),
            delay: Duration(milliseconds: 150 + i * 150),
            fromRotateDeg: -30,
            child: i < stars
                ? const GameFilledIcon(AIcons.star, size: 36, color: TwColors.amber400)
                : AIcon(AIcons.star, size: 36, color: tokens.shadcn.mutedForeground.withValues(alpha: 0.25)),
          ),
        ],
      ]),
    );
  }
}

/// `w-20 h-20 rounded-full bg-muted` with the 😔 of the lost overlay.
class ArcadeSadFace extends StatelessWidget {
  const ArcadeSadFace({super.key});
  @override
  Widget build(BuildContext context) => Container(
        width: 80,
        height: 80,
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(shape: BoxShape.circle, color: AnacanTokens.of(context).shadcn.muted),
        alignment: Alignment.center,
        child: const Text('😔', style: TextStyle(fontSize: 36, height: 1.1)),
      );
}

/// `text-sm text-muted-foreground` line with a bold foreground score (`Xalınız: <b>123</b>[ / 400]`).
class ArcadeScoreLine extends StatelessWidget {
  const ArcadeScoreLine({super.key, required this.prefix, required this.score, this.target});
  final String prefix;
  final int score;
  final int? target;
  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: '$prefix: '),
        TextSpan(text: '$score', style: TextStyle(fontWeight: FontWeight.w700, color: tokens.shadcn.foreground)),
        if (target != null) TextSpan(text: ' / $target'),
      ]),
      textAlign: TextAlign.center,
      style: TextStyle(fontSize: 14, height: 20 / 14, color: tokens.shadcn.mutedForeground),
    );
  }
}

/// The intro's stat row (`flex items-center gap-4 text-xs text-muted-foreground`): icon + text pairs.
class ArcadeStatRow extends StatelessWidget {
  const ArcadeStatRow({super.key, required this.items});
  final List<(AIconData, Color?, String)> items;
  @override
  Widget build(BuildContext context) {
    final muted = AnacanTokens.of(context).shadcn.mutedForeground;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(alignment: WrapAlignment.center, spacing: 16, runSpacing: 4, children: [
        for (final (icon, color, text) in items)
          Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(icon, size: 14, color: color ?? muted),
            const SizedBox(width: 4),
            Text(text, style: TextStyle(fontSize: 12, height: 16 / 12, color: muted)),
          ]),
      ]),
    );
  }
}

/// `w-full max-w-[260px] mt-3 flex flex-col gap-2` action column of the won / lost overlays.
class ArcadeActions extends StatelessWidget {
  const ArcadeActions({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 260),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 8), children[i]],
          ]),
        ),
      );
}
