// Ported from: src/styles/babycare.css (.bt-stat, .bt-stat-value, .bt-tabs, .bt-periods, .bt-stack, .bt-card,
//              .bt-card-title, .bt-row, .bt-two, .bt-three, .bt-breast, .bt-diaper, .bt-inline, .bt-input, .bt-sleep,
//              .bt-sleep-clock, .bt-bars, .bt-bar, .bt-history, .bt-hrow, .bt-hscroll, .bt-entries, .bt-del),
//              src/styles/anacan-design.css (.a3-chips, .a3-chip-btn(.on), .a3-seg, .a3-ico-sq.sm),
//              src/components/tools/BabyTracker.tsx (StatTile, Row, Card, Bars, History, Entries, BreastButton)
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialType, TextField, InputDecoration, InputBorder;

import '../../../design/design.dart';

const List<FontFeature> _tabular = [FontFeature.tabularFigures()];

/// `.a3-chips` (horizontal scroll, gap 8, bleeding into the 16px gutter) with `.a3-chip-btn` children.
class A3Chips extends StatelessWidget {
  const A3Chips({super.key, required this.children, this.marginTop = 12, this.height = 36});
  final List<Widget> children;
  final double marginTop;

  /// Chip height (`.a3-chip-btn` 36; the row adds its 2px vertical padding).
  final double height;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(top: marginTop),
        // `margin: 0 -16px; padding: 2px 16px`: the row scrolls into the page gutter, content stays aligned.
        child: LayoutBuilder(
          builder: (context, c) => SizedBox(
            height: height + 4,
            child: OverflowBox(
            alignment: Alignment.center,
            minWidth: c.maxWidth + 32,
            maxWidth: c.maxWidth + 32,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              child: Row(children: [for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 8), children[i]]]),
            ),
          ),
          ),
        ),
      );
}

/// `.a3-chip-btn` (height 36, padding 0 16, 14/600) / `.on` (ink background, bg text). [small]: `sfg-small`.
class A3ChipButton extends StatelessWidget {
  const A3ChipButton({super.key, required this.label, required this.on, required this.onTap, this.height = 36, this.padding = 16, this.fontSize = 14, this.semanticsRadio = false});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final double height;
  final double padding;
  final double fontSize;
  final bool semanticsRadio;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: on,
      checked: semanticsRadio ? on : null,
      child: PressScale.css(
        scale: 0.96,
        duration: ADurations.press,
        curve: ACurves.ease,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: ACurves.cssEase,
          height: height,
          padding: EdgeInsets.symmetric(horizontal: padding),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? a.ink : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: on ? a.ink : a.line),
          ),
          child: Text(label, maxLines: 1, style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600, height: 1.2, color: on ? a.bg : a.inkSoft)),
        ),
      ),
    );
  }
}

/// `.a3-seg` with icon + label buttons (`.bt-tabs button { gap: 6px }`).
class BtSeg<T> extends StatelessWidget {
  const BtSeg({super.key, required this.items, required this.selected, required this.onChanged});
  final List<({T value, String label, AIconData icon})> items;
  final T selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(
            child: Semantics(
              selected: items[i].value == selected,
              button: true,
              child: GestureDetector(
                key: ValueKey('bt-tab-${items[i].value}'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(items[i].value),
                child: AnimatedContainer(
                  duration: animationsDisabled(context) ? Duration.zero : ADurations.press,
                  curve: ACurves.cssEase,
                  constraints: const BoxConstraints(minHeight: 34),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: items[i].value == selected ? a.surface : const Color(0x00000000),
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: items[i].value == selected ? a.cardShadow : const [],
                  ),
                  child: Builder(builder: (context) {
                    final on = items[i].value == selected;
                    final color = on ? a.ink : a.inkSoft;
                    return Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      AIcon(items[i].icon, size: 15, color: color),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(items[i].label,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: x.a3Seg.copyWith(color: color, fontWeight: on ? FontWeight.w600 : FontWeight.w500)),
                      ),
                    ]);
                  }),
                ),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// `StatTile`: `.a3-card.a3-pad.bt-stat` (padding 12, gap 4).
class BtStatTile extends StatelessWidget {
  const BtStatTile({super.key, required this.icon, required this.tint, required this.label, required this.value, this.sub});
  final AIconData icon;
  final ATint tint;
  final String label;
  final String value;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final (bg, fg) = tint.of(a);
    return ACard(
      variant: ACardVariant.a3,
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        AListIcon(small: true, background: bg, foreground: fg, child: AIcon(icon, size: 16, color: fg)),
        const SizedBox(height: 4),
        Text(label, style: x.a3Meta),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: em(-0.02, 19), color: a.ink, height: 1.5, fontFeatures: _tabular)),
        ),
        if (sub != null) ...[const SizedBox(height: 4), Text(sub!, style: x.a3Meta)],
      ]),
    );
  }
}

/// `Card`: `.a3-card.a3-pad.bt-card` with `.bt-card-title`.
class BtCard extends StatelessWidget {
  const BtCard({super.key, required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => ACard(
        variant: ACardVariant.a3,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: em(-0.01, 16), color: context.a.ink, height: 1.5)),
          const SizedBox(height: 10),
          child,
        ]),
      );
}

/// `.bt-row` list (border between rows, none after the last).
class BtRows extends StatelessWidget {
  const BtRows({super.key, required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < rows.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(border: i < rows.length - 1 ? Border(bottom: BorderSide(color: a.line)) : null),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(child: Text(rows[i].$1, style: TextStyle(fontSize: 14, color: a.inkSoft, height: 1.5))),
            const SizedBox(width: 12),
            Flexible(
              child: Text(rows[i].$2,
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink, height: 1.5, fontFeatures: _tabular)),
            ),
          ]),
        ),
    ]);
  }
}

/// `.bt-input` (min-height 44, radius 14, surface-soft, inset 1px line; focus 2px coral).
class BtInput extends StatefulWidget {
  const BtInput({super.key, required this.controller, required this.placeholder, this.decimal = false, this.maxLength, this.onSubmitted, this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final bool decimal;
  final int? maxLength;
  final VoidCallback? onSubmitted;
  final ValueChanged<String>? onChanged;

  @override
  State<BtInput> createState() => _BtInputState();
}

class _BtInputState extends State<BtInput> {
  final _focus = FocusNode();
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
    final a = context.a;
    final style = TextStyle(fontSize: 16, color: a.ink, height: 1.5);
    return Semantics(
      label: widget.placeholder,
      textField: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        alignment: AlignmentDirectional.centerStart,
        decoration: BoxDecoration(
          color: a.surfaceSoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _focus.hasFocus ? a.coralStrong : a.line, width: _focus.hasFocus ? 2 : 1),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: TextField(
            controller: widget.controller,
            focusNode: _focus,
            onChanged: widget.onChanged,
            onSubmitted: (_) => widget.onSubmitted?.call(),
            keyboardType: widget.decimal ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
            inputFormatters: [if (widget.maxLength != null) LengthLimitingTextInputFormatter(widget.maxLength)],
            style: style,
            cursorColor: a.coralStrong,
            decoration: InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              hintText: widget.placeholder,
              hintStyle: style.copyWith(color: a.inkFaint),
            ),
          ),
        ),
      ),
    );
  }
}

/// `.bt-breast` / `.bt-diaper` pressable tile (min-height 64, radius 18, scale 0.97 on press).
class BtTile extends StatelessWidget {
  const BtTile({super.key, required this.children, required this.onTap, required this.background, required this.foreground, this.shadow, this.selected});
  final List<Widget> children;
  final VoidCallback? onTap;
  final Color background;
  final Color foreground;
  final List<BoxShadow>? shadow;
  final bool? selected;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: onTap != null,
        toggled: selected,
        child: PressScale.css(
          scale: 0.97,
          duration: ADurations.press,
          curve: ACurves.ease,
          enabled: onTap != null,
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(18), boxShadow: shadow),
            child: DefaultTextStyle.merge(
              style: TextStyle(color: foreground, height: 1.5),
              textAlign: TextAlign.center,
              child: Opacity(
                opacity: onTap == null ? 0.6 : 1,
                child: Column(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
                  for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 2), children[i]],
                ]),
              ),
            ),
          ),
        ),
      );
}

/// `.a-cta-btn` / `.a-btn-soft` with an inline background (`style={{ background, justifyContent: 'center', height }}`).
class ACtaButton extends StatelessWidget {
  const ACtaButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.background,
    this.foreground = const Color(0xFFFFFFFF),
    this.height,
    this.soft = false,
    this.block = true,
  });
  final String label;
  final VoidCallback? onPressed;
  final AIconData? icon;
  final Color? background;
  final Color foreground;
  final double? height;

  /// `.a-btn-soft` (peach-1 / accent ink, 12px, padding 10 16) instead of `.a-cta-btn` (12.5px, padding 11 18).
  final bool soft;
  final bool block;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bg = background ?? (soft ? a.peach1 : a.peach2);
    final fg = soft ? a.accentInk : foreground;
    final body = Container(
      height: height,
      padding: soft ? const EdgeInsets.symmetric(horizontal: 16, vertical: 10) : const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: block ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
        if (icon != null) ...[AIcon(icon!, size: 15, strokeWidth: 2.2, color: fg), const SizedBox(width: 6)],
        Flexible(child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: soft ? 12 : 12.5, fontWeight: FontWeight.w700, color: fg, height: 1.5))),
      ]),
    );
    return Semantics(
      button: true,
      enabled: onPressed != null,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onPressed, child: onPressed == null ? Opacity(opacity: 0.5, child: body) : body),
    );
  }
}

/// `.a-rank-tag` (10.5/800, padding 5 11, pill) with inline colours.
class ARankTag extends StatelessWidget {
  const ARankTag({super.key, required this.text, required this.background, required this.color, this.padding = const EdgeInsets.symmetric(horizontal: 11, vertical: 5)});
  final String text;
  final Color background;
  final Color color;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color, height: 1.5)),
      );
}

/// `.a-list-title` / `.a-list-sub` with the CSS margins (`margin: 2px 0 0` on the sub).
TextStyle aListTitle(BuildContext context) => context.aText.aListTitle;
TextStyle aListSub(BuildContext context) => context.aText.aListSub;

/// `Bars`: `.bt-bars` (120 high, equal columns, gap 4); the last bar is `.now`.
class BtBars extends StatelessWidget {
  const BtBars({super.key, required this.values, required this.labels, required this.format, required this.label});
  final List<num> values;
  final List<String> labels;
  final String Function(num v) format;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final max = values.fold<num>(1, (m, v) => v > m ? v : m);
    final last = values.length - 1;
    final small = TextStyle(fontSize: 9.5, color: a.inkSoft, height: 1.2, fontFeatures: _tabular);
    return Semantics(
      label: label,
      image: true,
      excludeSemantics: true,
      child: SizedBox(
        height: 120,
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (var i = 0; i < values.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 12),
                  child: Text(values[i] != 0 ? format(values[i]) : '', maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: small),
                ),
                const SizedBox(height: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 28),
                  child: Container(
                    height: (values[i] / max * 72).round().clamp(4, 1 << 30).toDouble(),
                    decoration: BoxDecoration(color: i == last ? a.coralStrong : a.surfaceSoft, borderRadius: BorderRadius.circular(6)),
                  ),
                ),
                const SizedBox(height: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 12),
                  child: Text(labels[i], maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: small),
                ),
              ]),
            ),
          ],
        ]),
      ),
    );
  }
}
