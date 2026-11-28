// Ported from: the shared markup of src/components/partner/v2/*Screen.tsx (`.a-scope.safe-top.min-h-screen.pb-24`
//              page + `.a-shell` + `.a-topbar` with the back `.a-icon-btn`, the `.a-card text-center` empty state with
//              a 64px circle, the `animate-spin` ring and RefreshCw loaders), src/styles/anacan-design.css
//              (.a-btn-soft, .a-btn-solid)
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ARingSpinner, ATopbar;
import '../ui/partner_ui.dart';

/// A partner sub-screen: `--a-bg` page, `.a-shell` padding (20 / bottom 96 = `pb-24`), top bar, content.
class PartnerSubScreen extends StatelessWidget {
  const PartnerSubScreen({
    super.key,
    required this.onBack,
    required this.title,
    this.eyebrow,
    this.actions = const <Widget>[],
    required this.children,
    this.bottom = 96,
    this.background,
    this.floating,
  });
  final VoidCallback onBack;
  final String title;
  final String? eyebrow;
  final List<Widget> actions;
  final List<Widget> children;
  final double bottom;

  /// Page background (default `--a-bg`).
  final Color? background;

  /// A `position: fixed` element drawn over the page (e.g. the birth plan's save button).
  final Widget? floating;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget page = ColoredBox(
      color: background ?? a.bg,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 0, 20, bottom),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ATopbar(onBack: onBack, eyebrow: eyebrow, title: title, actions: actions),
          ...children,
        ]),
      ),
    );
    if (floating != null) page = Stack(children: [Positioned.fill(child: page), floating!]);
    return AScope(child: page);
  }
}

/// The full-page loader (`min-h-screen flex items-center justify-center`).
class PartnerPageLoader extends StatelessWidget {
  const PartnerPageLoader({super.key, this.color, this.icon = AIcons.refreshCw, this.size = 32});
  final Color? color;
  final AIconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Center(child: PartnerSpin(child: AIcon(icon, size: size, color: color ?? a.blue2))),
      ),
    );
  }
}

/// `animate-spin` (1 s linear) for any child; still under reduced motion.
class PartnerSpin extends StatefulWidget {
  const PartnerSpin({super.key, required this.child});
  final Widget child;
  @override
  State<PartnerSpin> createState() => _PartnerSpinState();
}

class _PartnerSpinState extends State<PartnerSpin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}

/// `<div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full animate-spin" … /></div>`.
class PartnerRingLoader extends StatelessWidget {
  const PartnerRingLoader({super.key, this.color});
  final Color? color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 64),
        child: Center(child: ARingSpinner(size: 32, width: 3, color: color ?? context.a.blue2)),
      );
}

/// `.a-card text-center` (padding 38 / 18) with a 64px round icon, `.a-list-title` and `.a-list-sub`.
class PartnerEmptyCard extends StatelessWidget {
  const PartnerEmptyCard({super.key, required this.icon, required this.title, this.sub, this.circle, this.iconColor, this.padding = const EdgeInsets.symmetric(vertical: 38, horizontal: 18)});
  final AIconData icon;
  final String title;
  final String? sub;
  final Color? circle;
  final Color? iconColor;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return PartnerCard(
      padding: padding,
      child: Column(children: [
        Container(
          width: 64,
          height: 64,
          margin: const EdgeInsets.only(bottom: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: circle ?? a.surfaceSoft, shape: BoxShape.circle),
          child: AIcon(icon, size: 26, color: iconColor ?? a.inkFaint),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(title, textAlign: TextAlign.center, style: x.aListTitle),
        ),
        if (sub != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub!, textAlign: TextAlign.center, style: x.aListSub)),
      ]),
    );
  }
}

/// `.a-btn-soft` / `.a-btn-solid` (pill, padding 10 / 16, 12px 700, gap 6).
class PartnerPillButton extends StatelessWidget {
  const PartnerPillButton({super.key, required this.label, this.icon, this.onTap, this.solid = false, this.expand = false, this.padding, this.semanticLabel, this.fontSize = 12});
  final String label;
  final Widget? icon;
  final VoidCallback? onTap;
  final bool solid;
  final bool expand;
  final EdgeInsets? padding;
  final String? semanticLabel;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = solid ? const Color(0xFFFFFFFF) : a.accentInk;
    Widget body = Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(color: solid ? a.peach2 : a.peach1, borderRadius: BorderRadius.circular(999)),
      child: IconTheme.merge(
        data: IconThemeData(color: fg),
        child: Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
          if (icon != null) ...[icon!, const SizedBox(width: 6)],
          Flexible(child: Text(label, style: pText(fontSize, weight: FontWeight.w700, color: fg))),
        ]),
      ),
    );
    // `:disabled` has no style in the CSS; a disabled button just ignores taps.
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: semanticLabel,
      excludeSemantics: semanticLabel != null,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body),
    );
  }
}

/// `.a-tabs` / `.a-tab(.active)` with free-form tab content (badges, icons, counts).
class PartnerATabs<T> extends StatelessWidget {
  const PartnerATabs({super.key, required this.items, required this.selected, required this.onChanged, this.keyPrefix});
  final List<(T, Widget)> items;
  final T selected;
  final ValueChanged<T> onChanged;
  final String? keyPrefix;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final reduce = animationsDisabled(context);
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            () {
              final on = items[i].$1 == selected;
              final color = on ? a.accentInk : a.inkSoft;
              return Semantics(
                key: keyPrefix == null ? null : ValueKey('$keyPrefix-${items[i].$1}'),
                selected: on,
                button: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(items[i].$1),
                  child: AnimatedContainer(
                    duration: reduce ? Duration.zero : const Duration(milliseconds: 150),
                    curve: ACurves.cssEase,
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                    decoration: BoxDecoration(color: on ? a.peach1 : const Color(0x00000000), borderRadius: BorderRadius.circular(999)),
                    child: DefaultTextStyle.merge(
                      style: x.aTab.copyWith(color: color),
                      maxLines: 1,
                      softWrap: false,
                      child: IconTheme.merge(data: IconThemeData(color: color), child: items[i].$2),
                    ),
                  ),
                ),
              );
            }(),
          ],
        ]),
      ),
    );
  }
}

/// `whileTap` press + an `a-card` look.
Widget partnerPlainCard(BuildContext context, {required Widget child, EdgeInsetsGeometry padding = const EdgeInsets.all(16), Color? color, Border? border}) {
  final a = context.a;
  return Container(
    padding: padding,
    decoration: BoxDecoration(color: color ?? a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow, border: border),
    child: child,
  );
}
