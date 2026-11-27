// Ported from: src/styles/anacan-design.css (.a-tabs/.a-tab/.a-tab.active, .a3-seg/.a3-seg button[aria-selected],
//              .a-tool-tabs/.a-tool-tab/.a-tool-tab.on)
import 'package:flutter/widgets.dart';

import '../motion.dart';
import '../theme.dart';

enum ASegmentedStyle {
  /// `.a-tabs`: inline pill row on `--a-surface-soft`, scrolls when too wide; active tab
  /// `--a-peach-1` / `--a-accent-ink`; 150ms ease colour transition.
  aTabs,

  /// `.a3-seg`: full-width equal segments; selected = surface + `--a-card-shadow`, ink, w600.
  a3Seg,

  /// `.a-tool-tabs`: `--a-line` track, 36px tabs, selected = surface + 0 1px 6px rgba(0,0,0,.08).
  toolTabs,
}

class ASegmentItem<T> {
  const ASegmentItem(this.value, this.label, {this.icon});
  final T value;
  final String label;
  final Widget? icon;
}

class ASegmentedTabs<T> extends StatelessWidget {
  const ASegmentedTabs({
    super.key,
    required this.items,
    required this.selected,
    required this.onChanged,
    this.style = ASegmentedStyle.a3Seg,
  });

  final List<ASegmentItem<T>> items;
  final T selected;
  final ValueChanged<T> onChanged;
  final ASegmentedStyle style;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final x = context.aText;
    final reduce = animationsDisabled(context);

    Widget tab(ASegmentItem<T> item) {
      final on = item.value == selected;
      late final BoxDecoration deco;
      late final TextStyle ts;
      late final EdgeInsets pad;
      double minH = 0;
      Duration dur;
      switch (style) {
        case ASegmentedStyle.aTabs:
          deco = BoxDecoration(color: on ? t.peach1 : const Color(0x00000000), borderRadius: BorderRadius.circular(999));
          ts = x.aTab.copyWith(color: on ? t.accentInk : t.inkSoft);
          pad = const EdgeInsets.symmetric(horizontal: 13, vertical: 6);
          dur = const Duration(milliseconds: 150);
        case ASegmentedStyle.a3Seg:
          deco = BoxDecoration(
            color: on ? t.surface : const Color(0x00000000),
            borderRadius: BorderRadius.circular(999),
            boxShadow: on ? t.cardShadow : const <BoxShadow>[],
          );
          ts = x.a3Seg.copyWith(color: on ? t.ink : t.inkSoft, fontWeight: on ? FontWeight.w600 : FontWeight.w500);
          pad = const EdgeInsets.symmetric(horizontal: 8);
          minH = 34;
          dur = ADurations.press;
        case ASegmentedStyle.toolTabs:
          deco = BoxDecoration(
            color: on ? t.surface : const Color(0x00000000),
            borderRadius: BorderRadius.circular(999),
            boxShadow: on ? const <BoxShadow>[BoxShadow(color: Color(0x14000000), offset: Offset(0, 1), blurRadius: 4.33)] : const <BoxShadow>[],
          );
          ts = x.aToolTab.copyWith(color: on ? t.ink : t.inkSoft);
          pad = const EdgeInsets.symmetric(horizontal: 14);
          minH = 36;
          dur = Duration.zero;
      }
      if (reduce) dur = Duration.zero;
      return Semantics(
        selected: on,
        button: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onChanged(item.value),
          child: AnimatedContainer(
            duration: dur,
            curve: ACurves.cssEase,
            constraints: BoxConstraints(minHeight: minH),
            padding: pad,
            alignment: Alignment.center,
            decoration: deco,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (item.icon != null) ...<Widget>[IconTheme.merge(data: IconThemeData(color: ts.color), child: item.icon!), const SizedBox(width: 4)],
                Flexible(child: Text(item.label, style: ts, maxLines: 1, softWrap: false, overflow: TextOverflow.visible)),
              ],
            ),
          ),
        ),
      );
    }

    final tabs = items.map(tab).toList();
    switch (style) {
      case ASegmentedStyle.a3Seg:
        return Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: Row(children: _gap(tabs.map((w) => Expanded(child: w)).toList(), 2)),
        );
      case ASegmentedStyle.aTabs:
        return Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(mainAxisSize: MainAxisSize.min, children: _gap(tabs, 2)),
          ),
        );
      case ASegmentedStyle.toolTabs:
        return Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: t.line, borderRadius: BorderRadius.circular(999)),
          child: LayoutBuilder(
            builder: (context, c) => SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: c.maxWidth),
                // `flex: 1 0 auto`: approximated with equal Expanded slots (basis 0, not auto) —
                // differs from the web only when labels have very different widths.
                child: IntrinsicWidth(child: Row(children: _gap(tabs.map((w) => Expanded(child: w)).toList(), 4))),
              ),
            ),
          ),
        );
    }
  }

  static List<Widget> _gap(List<Widget> w, double g) => <Widget>[
        for (var i = 0; i < w.length; i++) ...<Widget>[if (i > 0) SizedBox(width: g), w[i]],
      ];
}
