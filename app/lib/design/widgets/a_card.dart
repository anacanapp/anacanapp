// Ported from: src/styles/anacan-design.css (.a-card, .a-card-head, .a-card-title, .a-list-card,
//              .a-list-row, .a3-card, .a3-pad, .a-cta)
import 'package:flutter/widgets.dart';

import '../theme.dart';

enum ACardVariant {
  /// `.a-card`: surface, 1px `--a-line` border, `--a-radius-lg`, padding 18, `--a-card-shadow`.
  a,

  /// `.a3-card` (+ `.a3-pad` when [ACard.padding] is null): no border, padding 16, gap 10.
  a3,

  /// `.a-list-card`: like `.a-card` without padding, clips children (`overflow: hidden`).
  list,

  /// `.a-cta`: `.a-card` look with padding 20 20 22 and clipping.
  cta,
}

/// Generic redesign card surface.
class ACard extends StatelessWidget {
  const ACard({super.key, required this.child, this.variant = ACardVariant.a, this.padding, this.color});

  final Widget child;
  final ACardVariant variant;

  /// Overrides the CSS padding (pass [EdgeInsets.zero] for a bare `.a3-card`).
  final EdgeInsetsGeometry? padding;

  /// Overrides `background: var(--a-surface)` (inline `style={{ background }}` in TSX).
  final Color? color;

  static EdgeInsetsGeometry defaultPadding(ACardVariant v) => switch (v) {
        ACardVariant.a => const EdgeInsets.all(18),
        ACardVariant.a3 => const EdgeInsets.all(16),
        ACardVariant.list => EdgeInsets.zero,
        ACardVariant.cta => const EdgeInsets.fromLTRB(20, 20, 20, 22),
      };

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final radius = BorderRadius.circular(t.radiusLg);
    final bordered = variant != ACardVariant.a3;
    return Container(
      clipBehavior: variant == ACardVariant.list || variant == ACardVariant.cta ? Clip.antiAlias : Clip.none,
      padding: padding ?? defaultPadding(variant),
      decoration: BoxDecoration(
        color: color ?? t.surface,
        borderRadius: radius,
        border: bordered ? Border.all(color: t.line) : null,
        boxShadow: t.cardShadow,
      ),
      // `.a3-pad` is also `display:flex; flex-direction:column; gap:10px` — lay out children
      // with a Column + SizedBox(height: 10) at the call site.
      child: child,
    );
  }
}

/// `.a-card-head` + `.a-card-title.a-heading`: title row with an optional trailing widget, 14px below.
class ACardHead extends StatelessWidget {
  const ACardHead({super.key, required this.title, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Flexible(child: Text(title, style: context.aText.heading(context.aText.aCardTitle))),
          ?trailing,
        ],
      ),
    );
  }
}

/// `.a-list-row` (+ `:first-child` without top border): icon square, title/sub, trailing.
class AListRow extends StatelessWidget {
  const AListRow({super.key, required this.title, this.subtitle, this.leading, this.trailing, this.first = false, this.onTap});
  final String title;
  final String? subtitle;

  /// Usually an [AListIcon].
  final Widget? leading;
  final Widget? trailing;

  /// `:first-child` — no top border.
  final bool first;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final x = context.aText;
    Widget row = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: t.line))),
      child: Row(
        children: <Widget>[
          if (leading != null) ...<Widget>[leading!, const SizedBox(width: 13)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(title, style: x.aListTitle),
                if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: x.aListSub)),
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[const SizedBox(width: 13), trailing!],
        ],
      ),
    );
    if (onTap != null) row = GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: row);
    return row;
  }
}

/// `.a-list-icon` (40×40, radius 13) / `.a3-ico-sq` (40, r13; `.sm` 34, r11) with a tint pair
/// such as `.c-peach` (`--a-peach-1` background, `--a-peach-ink` foreground).
class AListIcon extends StatelessWidget {
  const AListIcon({super.key, required this.child, required this.background, this.foreground, this.small = false});
  final Widget child;
  final Color background;
  final Color? foreground;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final size = small ? 34.0 : 40.0;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(small ? 11 : 13)),
      child: IconTheme.merge(
        data: IconThemeData(color: foreground),
        child: DefaultTextStyle.merge(style: TextStyle(color: foreground), child: child),
      ),
    );
  }
}

/// The `.c-*` tint pairs (background, colour) from anacan-design.css.
enum ATint { peach, pink, lav, blue, green, yellow, coral, ink }

extension ATintColors on ATint {
  (Color, Color) of(ATokens t) => switch (this) {
        ATint.peach => (t.peach1, t.peachInk),
        ATint.pink => (t.pink1, t.pinkInk),
        ATint.lav => (t.lav1, t.lavInk),
        ATint.blue => (t.blue1, t.blueInk),
        ATint.green => (t.green1, t.greenInk),
        ATint.yellow => (t.yellow1, t.yellowInk),
        ATint.coral => (t.coralStrong, t.onCoral),
        ATint.ink => (t.deep, t.onDeep),
      };
}

/// Recurring inline-style surfaces from TSX (no CSS class exists for them).
abstract final class ASurfaces {
  /// `{ background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)',
  /// color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)' }` — selected state in
  /// src/components/tools/{Recipes,WhiteNoise,NoiseMeter,SecondHandMarket}.tsx. Shape is per call site.
  static BoxDecoration gradCta(ATokens t, {BorderRadiusGeometry? borderRadius, BoxShape shape = BoxShape.rectangle}) =>
      BoxDecoration(
        gradient: t.gradCta,
        border: Border.all(color: t.btnBorder),
        boxShadow: t.cardShadow,
        borderRadius: shape == BoxShape.circle ? null : borderRadius,
        shape: shape,
      );
}
