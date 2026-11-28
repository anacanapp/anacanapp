// Ported from: src/styles/pregnancy-loss.css (.loss-scope variables, .loss-page, .loss-card, .loss-tag, .loss-body,
//              .loss-cta, .loss-ghost, .loss-row, .loss-row-icon, .loss-row-title, .loss-row-sub, .loss-bar,
//              .loss-alert, .loss-chip)
//
// The calm lavender variant of the a-* theme. The `--loss-*` values are this stylesheet's own literals (light and
// dark), kept here as the source has them.
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper, px;

/// `.loss-scope` variables.
@immutable
class LossTokens {
  const LossTokens({
    required this.bg,
    required this.accent,
    required this.accentInk,
    required this.soft,
    required this.cta,
    required this.ctaInk,
    required this.onBgSoft,
    required this.onBgFaint,
  });
  final Color bg;
  final Color accent;
  final Color accentInk;
  final Color soft;
  final Gradient cta;
  final Color ctaInk;
  final Color onBgSoft;
  final Color onBgFaint;

  static const LossTokens light = LossTokens(
    bg: Color(0xFFF4EFFB),
    accent: Color(0xFFAB84EE),
    accentInk: Color(0xFF5B3AA5),
    soft: Color(0xFFECE3FB),
    cta: LinearGradient(begin: Alignment(-0.77, -0.64), end: Alignment(0.77, 0.64), colors: [Color(0xFFEFE6FD), Color(0xFFC9B0F5), Color(0xFFAB84EE)], stops: [0, 0.55, 1]),
    ctaInk: Color(0xFF3D2575),
    onBgSoft: Color(0xFF7B62A8),
    onBgFaint: Color(0xFFB4A2D6),
  );

  static const LossTokens dark = LossTokens(
    bg: Color(0xFF1A1724),
    accent: Color(0xFF9B7AE0),
    accentInk: Color(0xFFD9C8FF),
    soft: Color(0xFF2F2940),
    cta: LinearGradient(begin: Alignment(-0.77, -0.64), end: Alignment(0.77, 0.64), colors: [Color(0xFF3A2D58), Color(0xFF5B45A0), Color(0xFF7A5CC9)], stops: [0, 0.6, 1]),
    ctaInk: Color(0xFFF3EDFF),
    onBgSoft: Color(0xFFB9A8DE),
    onBgFaint: Color(0xFF7D6FA0),
  );

  static LossTokens of(BuildContext context) => context.tokens.isDark ? dark : light;
}

/// `.loss-card` (radius `--a-radius-md`, padding 15 16, `0 14px 30px -18px rgba(120,90,170,.35)`).
class LossCard extends StatelessWidget {
  const LossCard({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(16, 15, 16, 15), this.onTap, this.tapScale});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double? tapScale;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(a.radiusMd),
        boxShadow: const [BoxShadow(color: Color(0x59785AAA), offset: Offset(0, 14), blurRadius: 30, spreadRadius: -18)],
      ),
      child: child,
    );
    if (onTap != null) {
      card = Semantics(button: true, child: PressScale(scale: tapScale ?? 0.98, onTap: onTap, child: card));
    }
    return card;
  }
}

/// `.loss-tag`.
TextStyle lossTag(BuildContext context, [Color? color]) => px(11, weight: FontWeight.w800, color: color ?? LossTokens.of(context).accentInk, ls: 0.05);

/// `.loss-body`.
TextStyle lossBody(BuildContext context, [double size = 13.5]) => px(size, color: context.a.bodyText, height: 1.55);

/// `.loss-row-title` / `.loss-row-sub`.
TextStyle lossRowTitle(BuildContext context) => px(14, weight: FontWeight.w700, color: context.a.ink, height: 1.4);
TextStyle lossRowSub(BuildContext context, [double size = 12]) => px(size, color: context.a.inkSoft, height: 1.4);

/// `.loss-row-icon` (36, radius 12, `--loss-soft`).
class LossRowIcon extends StatelessWidget {
  const LossRowIcon({super.key, this.emoji, this.icon, this.color, this.size = 36, this.radius = 12});
  final String? emoji;
  final AIconData? icon;
  final Color? color;
  final double size;
  final double radius;
  @override
  Widget build(BuildContext context) {
    final l = LossTokens.of(context);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color ?? l.soft, borderRadius: BorderRadius.circular(radius)),
      child: icon != null
          ? AIcon(icon!, size: size <= 30 ? 15 : 17, color: l.accentInk)
          : ExcludeSemantics(child: Text(emoji ?? '', style: const TextStyle(fontSize: 17, height: 1.2))),
    );
  }
}

/// `.loss-row` (row button, padding 12 2, bottom border except the last): icon, title / sub, chevron.
class LossRow extends StatelessWidget {
  const LossRow({super.key, required this.leading, required this.title, required this.sub, required this.onTap, this.last = false, this.expanded});
  final Widget leading;
  final String title;
  final String sub;
  final VoidCallback onTap;
  final bool last;

  /// `aria-expanded` (a ChevronDown that rotates) or null (ChevronRight).
  final bool? expanded;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      expanded: expanded,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
          decoration: BoxDecoration(border: last ? null : Border(bottom: BorderSide(color: a.line))),
          child: Row(children: [
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: lossRowTitle(context)),
                Text(sub, style: lossRowSub(context)),
              ]),
            ),
            const SizedBox(width: 12),
            expanded == null
                ? AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true)
                : AnimatedRotation(
                    turns: expanded! ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: AIcon(AIcons.chevronDown, size: 16, color: a.inkFaint),
                  ),
          ]),
        ),
      ),
    );
  }
}

/// `.loss-cta` / `.loss-ghost` buttons.
class LossButton extends StatelessWidget {
  const LossButton({super.key, required this.label, required this.onTap, this.ghost = false, this.busy = false, this.padding = 14, this.fontSize, this.background});
  final String label;
  final VoidCallback? onTap;
  final bool ghost;
  final bool busy;
  final double padding;
  final double? fontSize;
  final Color? background;
  @override
  Widget build(BuildContext context) {
    final l = LossTokens.of(context);
    final a = context.a;
    final disabled = onTap == null;
    Widget body = Container(
      width: double.infinity,
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        gradient: ghost ? null : l.cta,
        color: ghost ? background : null,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        if (busy) ...[SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: l.ctaInk)), const SizedBox(width: 8)],
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: px(fontSize ?? (ghost ? 14 : 14.5), weight: ghost ? FontWeight.w700 : FontWeight.w800, color: ghost ? a.inkSoft : l.ctaInk, height: 1.3),
          ),
        ),
      ]),
    );
    if (disabled && !ghost) body = Opacity(opacity: 0.6, child: body);
    return Semantics(button: true, enabled: !disabled, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body));
  }
}

/// `.loss-alert` with the bold title line.
class LossAlert extends StatelessWidget {
  const LossAlert({super.key, required this.title, required this.body});
  final String title;
  final String body;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(title, style: px(13.5, weight: FontWeight.w700, color: a.alertInk))),
        Text(body, style: px(12.5, color: a.alertInk, height: 1.5)),
      ]),
    );
  }
}

/// `.loss-bar` (7px, `--loss-soft`, accent fill).
class LossBar extends StatelessWidget {
  const LossBar({super.key, required this.fraction});
  final double fraction;
  @override
  Widget build(BuildContext context) {
    final l = LossTokens.of(context);
    return ExcludeSemantics(
      child: Container(
        height: 7,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(9)),
        child: FractionallySizedBox(
          alignment: AlignmentDirectional.centerStart,
          widthFactor: fraction.clamp(0, 1),
          child: Container(decoration: BoxDecoration(color: l.accent, borderRadius: BorderRadius.circular(9))),
        ),
      ),
    );
  }
}

/// `.loss-chip` (`aria-selected` / `aria-pressed` accent).
class LossChip extends StatelessWidget {
  const LossChip({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final l = LossTokens.of(context);
    final a = context.a;
    return Semantics(
      selected: selected,
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(color: selected ? l.accent : a.surface, borderRadius: BorderRadius.circular(999)),
          child: Text(label, style: px(12.5, weight: FontWeight.w800, color: selected ? const Color(0xFFFFFFFF) : a.ink, height: 1.2)),
        ),
      ),
    );
  }
}

/// `.a-scope.loss-scope.loss-page` sub-screen: lavender page, `.a-shell` padding 20, the `.a-topbar` with the back
/// button and titles; scrolls itself (pb-24).
class LossPage extends StatelessWidget {
  const LossPage({super.key, required this.onBack, required this.backLabel, required this.title, this.eyebrow, required this.children});
  final VoidCallback onBack;
  final String backLabel;
  final String title;
  final String? eyebrow;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final l = LossTokens.of(context);
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: l.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(children: [
                  Semantics(
                    button: true,
                    label: backLabel,
                    child: PressScale(
                      scale: 0.95,
                      onTap: onBack,
                      child: Container(
                        width: 38,
                        height: 38,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: a.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: a.btnBorder),
                          boxShadow: const [BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
                        ),
                        child: AIcon(AIcons.arrowLeft, size: 16, color: a.ink, mirrorInRtl: true),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (eyebrow != null) Text(cssUpper(eyebrow!), style: px(11, weight: FontWeight.w700, color: l.onBgSoft, ls: 0.1)),
                      Text(title, style: px(16, weight: FontWeight.w700, color: a.onBg, ls: -0.01, height: 1.35)),
                    ]),
                  ),
                ]),
              ),
            ),
            ...children,
          ]),
        ),
      ),
    );
  }
}

/// Tailwind `space-y-[gap]` column.
Widget lossStack(List<Widget> children, {double gap = 12}) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
    ]);
