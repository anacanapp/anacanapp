// Ported from: (helpers for the programme tool ports) — CSS rules are named where they are used:
//              `button` / `[aria-pressed]` semantics, `text-transform: uppercase`, CSS text styles in px.
//
// Small building blocks shared by the sleep-training, weaning and Tərbiyə screens.
import 'package:flutter/widgets.dart';

/// A CSS text style: [size] px, weight, line height (CSS `line-height` number), colour, letter spacing in em.
TextStyle css(double size, {FontWeight weight = FontWeight.w400, double height = 1.5, Color? color, double? em, FontStyle? style, TextDecoration? decoration}) =>
    TextStyle(
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: em == null ? null : em * size,
      fontStyle: style,
      decoration: decoration,
      leadingDistribution: TextLeadingDistribution.even,
    );

/// `<button type="button">`: an opaque tap target with button semantics; [pressed] = `aria-pressed` /
/// `aria-checked`, [enabled] = not `:disabled`.
class Tap extends StatelessWidget {
  const Tap({super.key, required this.child, this.onTap, this.label, this.pressed, this.enabled = true, this.excludeSemantics = false});
  final Widget child;
  final VoidCallback? onTap;
  final String? label;
  final bool? pressed;
  final bool enabled;
  final bool excludeSemantics;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: enabled && onTap != null,
        toggled: pressed,
        label: label,
        excludeSemantics: excludeSemantics,
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: enabled ? onTap : null, child: child),
      );
}

/// Children separated by [gap] (CSS `display: flex; flex-direction: column; gap`), stretched.
class Gap extends StatelessWidget {
  const Gap({super.key, required this.gap, required this.children, this.crossAxisAlignment = CrossAxisAlignment.stretch});
  final double gap;
  final List<Widget> children;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: crossAxisAlignment,
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
        ],
      );
}

/// `display: grid; grid-template-columns: repeat(n, minmax(0, 1fr)); gap` without unbounded height.
class Grid extends StatelessWidget {
  const Grid({super.key, required this.columns, required this.gap, required this.children, this.rowGap});
  final int columns;
  final double gap;
  final double? rowGap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      final cells = <Widget>[];
      for (var c = 0; c < columns; c++) {
        if (c > 0) cells.add(SizedBox(width: gap));
        cells.add(Expanded(child: i + c < children.length ? children[i + c] : const SizedBox.shrink()));
      }
      if (rows.isNotEmpty) rows.add(SizedBox(height: rowGap ?? gap));
      rows.add(IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells)));
    }
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

/// `flex-wrap: wrap; gap`.
class WrapRow extends StatelessWidget {
  const WrapRow({super.key, required this.gap, required this.children, this.runGap, this.crossAxisAlignment = WrapCrossAlignment.center});
  final double gap;
  final double? runGap;
  final List<Widget> children;
  final WrapCrossAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) => Wrap(spacing: gap, runSpacing: runGap ?? gap, crossAxisAlignment: crossAxisAlignment, children: children);
}
