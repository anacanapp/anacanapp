// Ported from: src/styles/anacan-design.css (.a3-btn, .a3-btn.accent/.ghost/.soft/.sm/.block/:disabled/:active,
//              .a3-appt-bar .a3-btn.danger, .a-cta-btn, .a-btn-soft, .a-btn-solid)
import 'package:flutter/widgets.dart';

import '../motion.dart';
import '../theme.dart';

/// Only the button looks that exist as CSS classes.
enum AButtonVariant {
  /// `.a3-btn` default: `--a-ink` background, `--a-surface` text.
  ink,

  /// `.a3-btn.accent`: `--a-coral-strong`, `--a-on-coral`, `--a-coral-shadow`.
  accent,

  /// `.a3-btn.ghost`: surface + 1px `--a-line-strong` ring.
  ghost,

  /// `.a3-btn.soft`: `--a-coral-soft` / `--a-accent-ink`.
  soft,

  /// `.a3-appt-bar .a3-btn.danger`: `--a-peach-1` / `--a-bad`, no shadow.
  danger,

  /// `.a-cta-btn`: `--a-peach-2` pill, white 12.5/700, padding 11×18, gap 6.
  cta,

  /// `.a-btn-soft`: `--a-peach-1` / `--a-accent-ink`, 12/700, padding 10×16, gap 6.
  pillSoft,

  /// `.a-btn-solid`: `--a-peach-2` / white, 12/700, padding 10×16, gap 6.
  pillSolid,
}

enum AButtonSize {
  /// min-height 48, padding 0 20, 15px.
  md,

  /// `.a3-btn.sm`: min-height 36, padding 0 14, 13.5px.
  sm,
}

class AButton extends StatelessWidget {
  const AButton({
    super.key,
    required this.child,
    this.onPressed,
    this.variant = AButtonVariant.ink,
    this.size = AButtonSize.md,
    this.block = false,
    this.leading,
    this.trailing,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final AButtonVariant variant;

  /// a3 variants only.
  final AButtonSize size;

  /// `.a3-btn.block`: width 100%.
  final bool block;
  final Widget? leading;
  final Widget? trailing;

  bool get _isA3 => index < 5;
  int get index => variant.index;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final x = context.aText;
    final disabled = onPressed == null;
    final (Color bg, Color fg, List<BoxShadow> shadow) = switch (variant) {
      AButtonVariant.ink => (t.ink, t.surface, const <BoxShadow>[]),
      AButtonVariant.accent => (t.coralStrong, t.onCoral, t.coralShadow),
      AButtonVariant.ghost => (t.surface, t.ink, <BoxShadow>[BoxShadow(color: t.lineStrong, spreadRadius: 1)]),
      AButtonVariant.soft => (t.coralSoft, t.accentInk, const <BoxShadow>[]),
      AButtonVariant.danger => (t.peach1, t.bad, const <BoxShadow>[]),
      AButtonVariant.cta => (t.peach2, const Color(0xFFFFFFFF), const <BoxShadow>[]),
      AButtonVariant.pillSoft => (t.peach1, t.accentInk, const <BoxShadow>[]),
      AButtonVariant.pillSolid => (t.peach2, const Color(0xFFFFFFFF), const <BoxShadow>[]),
    };
    final sm = size == AButtonSize.sm;
    final TextStyle style;
    final EdgeInsets padding;
    final double gap;
    final double minHeight;
    if (_isA3) {
      style = (sm ? x.a3BtnSm : x.a3Btn).copyWith(color: fg);
      padding = EdgeInsets.symmetric(horizontal: sm ? 14 : 20);
      gap = 8;
      minHeight = sm ? 36 : 48;
    } else if (variant == AButtonVariant.cta) {
      style = x.aCtaBtn.copyWith(color: fg);
      padding = const EdgeInsets.symmetric(horizontal: 18, vertical: 11);
      gap = 6;
      minHeight = 0;
    } else {
      style = x.aPillBtn.copyWith(color: fg);
      padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10);
      gap = 6;
      minHeight = 0;
    }
    Widget body = Container(
      constraints: BoxConstraints(minHeight: minHeight),
      padding: padding,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), boxShadow: shadow),
      child: DefaultTextStyle.merge(
        style: style,
        textAlign: TextAlign.center,
        child: IconTheme.merge(
          data: IconThemeData(color: fg),
          child: Row(
            mainAxisSize: block ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (leading != null) ...<Widget>[leading!, SizedBox(width: gap)],
              Flexible(child: child),
              if (trailing != null) ...<Widget>[SizedBox(width: gap), trailing!],
            ],
          ),
        ),
      ),
    );
    if (disabled && _isA3) body = Opacity(opacity: 0.45, child: body);
    body = Semantics(button: true, enabled: !disabled, child: body);
    body = GestureDetector(behavior: HitTestBehavior.opaque, onTap: onPressed, child: body);
    if (_isA3) {
      // `.a3-btn { transition: transform 160ms var(--a-ease) } .a3-btn:active { transform: scale(0.97) }`
      body = PressScale.css(scale: 0.97, duration: ADurations.press, curve: ACurves.ease, enabled: !disabled, child: body);
    }
    return block ? SizedBox(width: double.infinity, child: body) : body;
  }
}

/// `.a3-icon-btn` (44px circle, transparent) / `.a3-icon-btn.solid` (surface + `--a-card-shadow`);
/// `:active { transform: scale(0.94) }` with `transition: transform 160ms var(--a-ease)`.
class AIconButton extends StatelessWidget {
  const AIconButton({super.key, required this.icon, required this.onPressed, this.solid = false, this.semanticLabel, this.badge});
  final Widget icon;
  final VoidCallback? onPressed;
  final bool solid;
  final String? semanticLabel;

  /// `.a3-dot` / `.a3-count` overlay.
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: PressScale.css(
        scale: 0.94,
        duration: ADurations.press,
        curve: ACurves.ease,
        enabled: onPressed != null,
        onTap: onPressed,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: solid ? t.surface : null,
            boxShadow: solid ? t.cardShadow : null,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: <Widget>[
              IconTheme.merge(data: IconThemeData(color: t.ink), child: icon),
              ?badge,
            ],
          ),
        ),
      ),
    );
  }
}
