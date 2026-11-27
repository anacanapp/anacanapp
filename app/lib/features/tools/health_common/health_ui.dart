// Ported from: src/styles/anacan-design.css (.a-input as <textarea>, .a-tabs/.a-tab with the inline `flex: 1`,
//              .a-today-info-tip, .a-alert-card, .a-search, .a-rank-tag), src/components/ui/dialog.tsx (DialogContent
//              with the tools' `a-scope rounded-[26px] max-h-[85dvh] overflow-y-auto` classes), Tailwind
//              `animate-pulse` / `animate-spin`, lucide icons with an inline `fill` (Heart / Star / Droplet)
//
// Small look primitives the health tools share and that no design / feature kit offers yet.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px, ARingSpinner;

/// CSS `box-shadow` blur → Flutter `blurRadius`.
double cssBlur(double blur) => (blur / 2 - 0.5) / 0.57735;

List<Widget> _gap(List<Widget> w, double g, {bool horizontal = false}) => [
      for (var i = 0; i < w.length; i++) ...[if (i > 0) horizontal ? SizedBox(width: g) : SizedBox(height: g), w[i]],
    ];

/// Children with a fixed vertical gap (Tailwind `space-y-*`).
Widget vgap(double g, List<Widget> children, {CrossAxisAlignment cross = CrossAxisAlignment.stretch}) =>
    Column(crossAxisAlignment: cross, mainAxisSize: MainAxisSize.min, children: _gap(children, g));

/// Children with a fixed horizontal gap.
List<Widget> hgap(double g, List<Widget> children) => _gap(children, g, horizontal: true);

/// `.a-input` used as a `<textarea>` (padding 10 14, radius 12, 1px `--a-line-strong`, focus `--a-peach-2`, 13px).
class ATextArea extends StatefulWidget {
  const ATextArea({super.key, required this.controller, this.placeholder, this.onChanged, this.height = 64, this.fieldKey, this.fontSize = 13});
  final TextEditingController controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final double height;
  final Key? fieldKey;
  final double fontSize;

  @override
  State<ATextArea> createState() => _ATextAreaState();
}

class _ATextAreaState extends State<ATextArea> {
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
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(widget.fontSize, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        height: widget.height,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong),
        ),
        child: TextField(
          key: widget.fieldKey,
          controller: widget.controller,
          focusNode: _focus,
          onChanged: widget.onChanged,
          maxLines: null,
          expands: true,
          textAlignVertical: TextAlignVertical.top,
          keyboardType: TextInputType.multiline,
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: widget.placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
        ),
      ),
    );
  }
}

/// `.a-input` single line with options the shared [AInput] lacks (number keyboard, centre text, big font).
class AField extends StatefulWidget {
  const AField({
    super.key,
    required this.controller,
    this.placeholder,
    this.onChanged,
    this.onSubmitted,
    this.onBlur,
    this.keyboardType,
    this.textAlign = TextAlign.start,
    this.fontSize = 13,
    this.fontWeight = FontWeight.w400,
    this.height,
    this.fieldKey,
    this.inputFormatters,
  });
  final TextEditingController controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onBlur;
  final TextInputType? keyboardType;
  final TextAlign textAlign;
  final double fontSize;
  final FontWeight fontWeight;
  final double? height;
  final Key? fieldKey;
  final List<TextInputFormatter>? inputFormatters;

  @override
  State<AField> createState() => _AFieldState();
}

class _AFieldState extends State<AField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) widget.onBlur?.call(widget.controller.text);
      setState(() {});
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(widget.fontSize, color: a.ink, weight: widget.fontWeight));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        height: widget.height,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong),
        ),
        child: TextField(
          key: widget.fieldKey,
          controller: widget.controller,
          focusNode: _focus,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          keyboardType: widget.keyboardType,
          textAlign: widget.textAlign,
          inputFormatters: widget.inputFormatters,
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: widget.placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
        ),
      ),
    );
  }
}

/// One tab of [AFlexTabs].
class AFlexTab<T> {
  const AFlexTab(this.value, this.label, {this.icon});
  final T value;
  final String label;
  final AIconData? icon;
}

/// `.a-tabs` (`display: flex; width: 100%`) whose `.a-tab`s are `flex: 1` (pill row on `--a-surface-soft`, padding 3,
/// gap 2; active tab `--a-peach-1` / `--a-accent-ink`; 13px icon + gap 5).
class AFlexTabs<T> extends StatelessWidget {
  const AFlexTabs({super.key, required this.tabs, required this.selected, required this.onChanged});
  final List<AFlexTab<T>> tabs;
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
        for (var i = 0; i < tabs.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(child: _tab(context, tabs[i], x, a)),
        ],
      ]),
    );
  }

  Widget _tab(BuildContext context, AFlexTab<T> t, ATextStyles x, ATokens a) {
    final on = t.value == selected;
    final color = on ? a.accentInk : a.inkSoft;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(t.value),
        child: AnimatedContainer(
          duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
          decoration: BoxDecoration(color: on ? a.peach1 : const Color(0x00000000), borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
            if (t.icon != null) ...[AIcon(t.icon!, size: 13, strokeWidth: 2.2, color: color), const SizedBox(width: 5)],
            Flexible(child: Text(t.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aTab.copyWith(color: color))),
          ]),
        ),
      ),
    );
  }
}

/// `.a-today-info-tip` (flex start, gap 9, padding 12 14, `--a-radius-sm`, surface-soft, 12px / 1.6 body text; the
/// icon is `#d97a33` with 2px top margin) with inline background / colour overrides.
class AInfoTip extends StatelessWidget {
  const AInfoTip({super.key, required this.icon, required this.child, this.background, this.color, this.iconColor});
  final AIconData icon;
  final Widget child;
  final Color? background;
  final Color? color;

  /// Defaults to the CSS `#d97a33` (an inline `color` on the tip does not reach the svg rule).
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = color ?? a.bodyText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: background ?? a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusSm)),
      child: DefaultTextStyle.merge(
        style: px(12, color: fg, height: 1.6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // `.a-today-info-tip svg { color: #d97a33 }` (anacan-design.css literal)
          Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(icon, size: 14, color: iconColor ?? const Color(0xFFD97A33))),
          const SizedBox(width: 9),
          Expanded(child: child),
        ]),
      ),
    );
  }
}

/// `.a-alert-card` (alert gradient, 1px rgba(216,66,92,.14) border, `--a-radius-lg`, padding 20).
class AAlertCard extends StatelessWidget {
  const AAlertCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(20),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: a.alertBg,
        borderRadius: BorderRadius.circular(a.radiusLg),
        border: Border.all(color: const Color(0x24D8425C)), // .a-alert-card rgba(216, 66, 92, 0.14)
      ),
      child: child,
    );
  }

  /// `.a-alert-eyebrow` (11/800, 0.06em, upper-case, `#c23c56` literal, 8 below).
  static TextStyle eyebrow(BuildContext context) => px(11, weight: FontWeight.w800, color: const Color(0xFFC23C56), ls: 0.06);

  /// `.a-alert-headline.a-heading` (21px, `--a-alert-ink`, 8 below).
  static TextStyle headline(BuildContext context) => context.aText.heading(px(21, color: context.a.alertInk, height: 1.25));

  /// `.a-alert-text` (12.5 / 1.6, `--a-alert-soft`, 16 below).
  static TextStyle text(BuildContext context) => px(12.5, color: context.a.alertSoft, height: 1.6);
}

/// `.a-search` (surface pill, 1px line, card shadow, padding 12 16, gap 10, search icon + borderless 13px input).
class ASearchField extends StatelessWidget {
  const ASearchField({super.key, required this.controller, this.placeholder, this.onChanged, this.fieldKey, this.iconSize = 16});
  final double iconSize;
  final TextEditingController controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(13, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line), boxShadow: a.cardShadow),
        child: Row(children: [
          AIcon(AIcons.search, size: iconSize, color: a.inkFaint),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              key: fieldKey,
              controller: controller,
              onChanged: onChanged,
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `.a-rank-tag` (10.5/800, padding 5 11, pill) with inline background / colour.
class ARankTagBox extends StatelessWidget {
  const ARankTagBox(this.text, {super.key, required this.background, required this.color, this.gradient});
  final String text;
  final Color? background;
  final Gradient? gradient;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(color: background, gradient: gradient, borderRadius: BorderRadius.circular(999)),
        child: Text(text, maxLines: 1, softWrap: false, style: px(10.5, weight: FontWeight.w800, color: color)),
      );
}

/// A small pill (`padding: …; border-radius: 999; font-size: …; font-weight: …`) used for status / level labels.
class APill extends StatelessWidget {
  const APill(this.text, {super.key, required this.background, required this.color, this.padding = const EdgeInsets.symmetric(horizontal: 9, vertical: 3), this.fontSize = 10, this.weight = FontWeight.w800, this.icon});
  final String text;
  final Color background;
  final Color color;
  final EdgeInsets padding;
  final double fontSize;
  final FontWeight weight;
  final Widget? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[IconTheme.merge(data: IconThemeData(color: color), child: icon!), const SizedBox(width: 4)],
          Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(fontSize, weight: weight, color: color))),
        ]),
      );
}

/// `animate-pulse` (2s, opacity 1 → .5 → 1) around a skeleton.
class APulse extends StatefulWidget {
  const APulse({super.key, required this.child});
  final Widget child;
  @override
  State<APulse> createState() => _APulseState();
}

class _APulseState extends State<APulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final v = const Cubic(0.4, 0, 0.6, 1).transform(_c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2);
          return Opacity(opacity: 1 - 0.5 * v, child: child);
        },
      );
}

/// A rounded skeleton bar.
class ABar extends StatelessWidget {
  const ABar({super.key, required this.height, this.widthFactor = 1, this.radius = 8});
  final double height;
  final double widthFactor;
  final double radius;
  @override
  Widget build(BuildContext context) => FractionallySizedBox(
        alignment: AlignmentDirectional.centerStart,
        widthFactor: widthFactor,
        child: Container(height: height, decoration: BoxDecoration(color: context.a.surfaceSoft, borderRadius: BorderRadius.circular(radius))),
      );
}

/// The inline 3px `--a-peach-2` ring spinner (`animate-spin`), centred with vertical padding.
class ACenterSpinner extends StatelessWidget {
  const ACenterSpinner({super.key, this.size = 32, this.padding = 40});
  final double size;
  final double padding;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.symmetric(vertical: padding),
        child: Center(child: ARingSpinner(size: size, width: 3, color: context.a.peach2)),
      );
}

/// A tappable surface with framer `whileTap={{ scale }}`.
class ATap extends StatelessWidget {
  const ATap({super.key, required this.child, this.onTap, this.scale = 0.98, this.semanticLabel, this.selected, this.button = true});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? semanticLabel;
  final bool? selected;
  final bool button;

  @override
  Widget build(BuildContext context) => Semantics(
        button: button,
        label: semanticLabel,
        selected: selected,
        enabled: onTap != null,
        child: PressScale(scale: scale, enabled: onTap != null, onTap: onTap, child: child),
      );
}

/// A lucide icon drawn with `fill: currentColor` (React: `style={{ fill, color }}` / `fill-current`).
class LucideFilled extends StatelessWidget {
  const LucideFilled(this.icon, {super.key, required this.size, required this.color, this.strokeWidth = 2});
  final AIconData icon;
  final double size;
  final Color color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: SvgPicture(_FilledLoader(icon.asset, strokeWidth, theme: SvgTheme(currentColor: color)), width: size, height: size),
      );
}

class _FilledLoader extends SvgLoader<String> {
  const _FilledLoader(this.asset, this.strokeWidth, {super.theme});
  final String asset;
  final double strokeWidth;
  static final Map<String, String> _sources = {};

  @override
  Future<String?> prepareMessage(BuildContext? context) {
    final cached = _sources[asset];
    if (cached != null) return SynchronousFuture<String?>(cached);
    final bundle = context != null ? DefaultAssetBundle.of(context) : rootBundle;
    return bundle.loadString(asset).then((s) => _sources[asset] = s);
  }

  @override
  bool get provideSvgInIsolate => false;

  @override
  String provideSvg(String? message) {
    var src = (message ?? '').replaceFirst('fill="none"', 'fill="currentColor"');
    if (strokeWidth != 2) src = src.replaceFirst('stroke-width="2"', 'stroke-width="$strokeWidth"');
    return src;
  }

  @override
  SvgCacheKey cacheKey(BuildContext? context) => SvgCacheKey(keyData: ('filled', asset, strokeWidth), theme: getTheme(context), colorMapper: null);

  @override
  bool operator ==(Object other) => other is _FilledLoader && other.asset == asset && other.strokeWidth == strokeWidth && other.theme == theme;

  @override
  int get hashCode => Object.hash(asset, strokeWidth, theme);
}

/// Radix `<Dialog>` with the tools' `DialogContent className="a-scope max-w-md rounded-[26px] max-h-[85dvh]
/// overflow-y-auto"` (surface, 1px line border, p-6, black/80 overlay, fade + zoom 95 over 200 ms, close ✕).
Future<T?> showToolDialog<T>(BuildContext context, {required WidgetBuilder builder, bool dismissible = true, bool showClose = true}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: dismissible,
    barrierLabel: 'dialog',
    barrierColor: const Color(0xCC000000),
    transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => _ToolDialogFrame(showClose: showClose, child: Builder(builder: builder)),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(anim), child: child),
    ),
  );
}

class _ToolDialogFrame extends StatelessWidget {
  const _ToolDialogFrame({required this.child, required this.showClose});
  final Widget child;
  final bool showClose;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return SafeArea(
      child: Center(
        child: AScope(
          child: Builder(builder: (context) {
            final a = context.a;
            return Material(
              type: MaterialType.transparency,
              child: Container(
                constraints: BoxConstraints(maxWidth: 448, maxHeight: mq.size.height * 0.85),
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: a.line),
                  boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(children: [
                  SingleChildScrollView(padding: const EdgeInsets.all(24), child: child),
                  if (showClose)
                    PositionedDirectional(
                      top: 16,
                      end: 16,
                      child: Semantics(
                        button: true,
                        label: 'Close',
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => Navigator.of(context).maybePop(),
                          child: Opacity(opacity: 0.7, child: AIcon(AIcons.x, size: 16, color: a.ink)),
                        ),
                      ),
                    ),
                ]),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// `DialogTitle className="flex items-center gap-2 a-heading"` (18/600 heading, `--a-ink`).
class ToolDialogTitle extends StatelessWidget {
  const ToolDialogTitle(this.text, {super.key, this.icon, this.center = false});
  final String text;
  final Widget? icon;
  final bool center;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 24, bottom: 16),
        child: Row(mainAxisAlignment: center ? MainAxisAlignment.center : MainAxisAlignment.start, children: [
          if (icon != null) ...[icon!, const SizedBox(width: 8)],
          Flexible(child: Text(text, textAlign: center ? TextAlign.center : TextAlign.start, style: context.aText.heading(px(18, weight: FontWeight.w600, color: context.a.ink, height: 28 / 18)))),
        ]),
      );
}

/// `.a-stat-tile` (flex, gap 10, padding 12, radius 16, surface-soft) with `.a-stat-tile-label` / `-value` and
/// inline overrides (background, label colour, value size, extra lines).
class AStatTileBox extends StatelessWidget {
  const AStatTileBox({super.key, required this.icon, required this.label, required this.value, this.background, this.labelColor, this.valueSize = 14, this.extra});
  final Widget icon;
  final String label;
  final String value;
  final Color? background;
  final Color? labelColor;
  final double valueSize;
  final String? extra;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final labelStyle = px(10, weight: FontWeight.w700, color: labelColor ?? a.inkSoft);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: background ?? a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        icon,
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: labelStyle),
            Padding(padding: const EdgeInsets.only(top: 1), child: Text(value, style: px(valueSize, weight: FontWeight.w800, color: a.ink))),
            if (extra != null) Text(extra!, style: px(10, weight: FontWeight.w700, color: a.inkSoft)),
          ]),
        ),
      ]),
    );
  }
}

/// `.a-stat-tile-icon` (30px, radius 9) with an inline background / gradient and icon colour.
class AStatIcon extends StatelessWidget {
  const AStatIcon({super.key, required this.icon, required this.color, this.background, this.gradient});
  final AIconData icon;
  final Color color;
  final Color? background;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, gradient: gradient, borderRadius: BorderRadius.circular(9)),
        child: AIcon(icon, size: 15, color: color),
      );
}

/// `.a-grid-2` / `.a-grid-3` / Tailwind `grid grid-cols-N gap-X`: equal columns, rows of equal height.
class AGridCols extends StatelessWidget {
  const AGridCols({super.key, required this.columns, required this.children, this.gap = 10, this.rowGap});
  final int columns;
  final List<Widget> children;
  final double gap;
  final double? rowGap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      if (i > 0) rows.add(SizedBox(height: rowGap ?? gap));
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var c = 0; c < columns; c++) ...[
            if (c > 0) SizedBox(width: gap),
            Expanded(child: i + c < children.length ? children[i + c] : const SizedBox()),
          ],
        ]),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }
}

/// `.a-tag` (`.on`): pill, padding 7 12, gap 6, 11.5/600, 1px transparent border; on = `--a-tag-on-bg`, peach-2
/// border, accent ink. Inline overrides for padding / size / colours.
class ATagChip extends StatelessWidget {
  const ATagChip({super.key, required this.children, this.on = false, this.onTap, this.background, this.color, this.padding, this.fontSize = 11.5, this.gap = 6, this.semanticLabel, this.pressScale = 0.95});
  final List<Widget> children;
  final bool on;
  final VoidCallback? onTap;
  final Color? background;
  final Color? color;
  final EdgeInsets? padding;
  final double fontSize;
  final double gap;
  final String? semanticLabel;
  final double? pressScale;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = color ?? (on ? a.accentInk : a.inkSoft);
    Widget w = AnimatedContainer(
      duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 150),
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: background ?? (on ? a.tagOnBg : a.surfaceSoft),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: on ? a.peach2 : const Color(0x00000000)),
      ),
      child: DefaultTextStyle.merge(
        style: px(fontSize, weight: FontWeight.w600, color: fg),
        child: IconTheme.merge(
          data: IconThemeData(color: fg),
          child: Row(mainAxisSize: MainAxisSize.min, children: _gap(children, gap, horizontal: true)),
        ),
      ),
    );
    if (onTap != null) {
      w = Semantics(
        button: true,
        selected: on,
        label: semanticLabel,
        child: pressScale == null
            ? GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: w)
            : PressScale(scale: pressScale!, onTap: onTap, child: w),
      );
    }
    return w;
  }
}

/// `.a-cta-btn` (peach-2 pill, white 12.5/700, padding 11 18, gap 6) / `.a-btn-soft` (peach-1, accent ink, 12/700,
/// padding 10 16) / `.a-btn-solid` (peach-2, white, 12/700) with inline overrides. A disabled button keeps the
/// inline `opacity` the React code sets.
enum APillKind { cta, soft, solid }

class APillButton extends StatelessWidget {
  const APillButton({
    super.key,
    required this.label,
    this.onTap,
    this.kind = APillKind.cta,
    this.icon,
    this.trailingIcon,
    this.height,
    this.padding,
    this.fontSize,
    this.background,
    this.gradient,
    this.foreground,
    this.expand = false,
    this.disabledOpacity = 0.5,
    this.opacity,
    this.tapScale,
    this.semanticLabel,
    this.buttonKey,
  });
  final String label;
  final VoidCallback? onTap;
  final APillKind kind;
  final Widget? icon;
  final Widget? trailingIcon;
  final double? height;
  final EdgeInsets? padding;
  final double? fontSize;
  final Color? background;
  final Gradient? gradient;
  final Color? foreground;
  final bool expand;
  final double disabledOpacity;

  /// Explicit inline opacity (overrides the disabled one).
  final double? opacity;
  final double? tapScale;
  final String? semanticLabel;
  final Key? buttonKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Color bg, Color fg, double size, EdgeInsets pad) = switch (kind) {
      APillKind.cta => (a.peach2, const Color(0xFFFFFFFF), 12.5, const EdgeInsets.symmetric(horizontal: 18, vertical: 11)),
      APillKind.soft => (a.peach1, a.accentInk, 12.0, const EdgeInsets.symmetric(horizontal: 16, vertical: 10)),
      APillKind.solid => (a.peach2, const Color(0xFFFFFFFF), 12.0, const EdgeInsets.symmetric(horizontal: 16, vertical: 10)),
    };
    final color = foreground ?? fg;
    Widget body = Container(
      key: buttonKey,
      height: height,
      padding: height != null ? EdgeInsets.symmetric(horizontal: (padding ?? pad).left) : (padding ?? pad),
      decoration: BoxDecoration(color: gradient == null ? (background ?? bg) : null, gradient: gradient, borderRadius: BorderRadius.circular(999)),
      child: IconTheme.merge(
        data: IconThemeData(color: color),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[icon!, const SizedBox(width: 6)],
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(fontSize ?? size, weight: FontWeight.w700, color: color))),
            if (trailingIcon != null) ...[const SizedBox(width: 6), trailingIcon!],
          ],
        ),
      ),
    );
    final o = opacity ?? (onTap == null ? disabledOpacity : 1.0);
    if (o != 1) body = Opacity(opacity: o, child: body);
    body = Semantics(
      button: true,
      enabled: onTap != null,
      label: semanticLabel ?? label,
      excludeSemantics: true,
      child: tapScale == null ? GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body) : PressScale(scale: tapScale!, enabled: onTap != null, onTap: onTap, child: body),
    );
    return body;
  }
}

/// `.a-list-icon` (40px, radius 13) with an inline background / gradient and emoji or icon content.
class AListIconBox extends StatelessWidget {
  const AListIconBox({super.key, required this.child, this.background, this.gradient, this.size = 40, this.radius = 13, this.color});
  final Widget child;
  final Color? background;
  final Gradient? gradient;
  final double size;
  final double radius;
  final Color? color;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, gradient: gradient, borderRadius: BorderRadius.circular(radius)),
        child: DefaultTextStyle.merge(
          style: TextStyle(fontSize: 18, color: color, height: 1.2),
          child: IconTheme.merge(data: IconThemeData(color: color), child: child),
        ),
      );
}

/// `.a-list-row` with free content (flex, gap 13, padding 14 16, top border unless first).
class AListRowBox extends StatelessWidget {
  const AListRowBox({super.key, required this.children, this.first = false, this.onTap, this.background, this.crossAxisAlignment = CrossAxisAlignment.center, this.padding, this.semanticLabel});
  final List<Widget> children;
  final bool first;
  final VoidCallback? onTap;
  final Color? background;
  final CrossAxisAlignment crossAxisAlignment;
  final EdgeInsets? padding;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget w = Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: background, border: first ? null : Border(top: BorderSide(color: a.line))),
      child: Row(crossAxisAlignment: crossAxisAlignment, children: _gap(children, 13, horizontal: true)),
    );
    if (onTap != null) w = Semantics(button: true, label: semanticLabel, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: w));
    return w;
  }
}

/// `.a-list-card` children separated like `.a-list-row` (first without top border).
class AListCardBox extends StatelessWidget {
  const AListCardBox({super.key, required this.children, this.bottomPadding = 0});
  final List<Widget> children;
  final double bottomPadding;
  @override
  Widget build(BuildContext context) => ACard(
        variant: ACardVariant.list,
        child: Padding(
          padding: EdgeInsets.only(bottom: bottomPadding),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children),
        ),
      );
}

/// Text styles of the `.a-*` classes used inline.
abstract final class AStyles {
  static TextStyle listTitle(BuildContext c, {Color? color, double? size}) => px(size ?? 13.5, weight: FontWeight.w700, color: color ?? c.a.ink);
  static TextStyle listSub(BuildContext c, {Color? color}) => px(11.5, weight: FontWeight.w500, color: color ?? c.a.inkSoft);
  static TextStyle listValue(BuildContext c, {Color? color}) => px(11, weight: FontWeight.w700, color: color ?? c.a.inkSoft);
  static TextStyle listTime(BuildContext c) => px(10, weight: FontWeight.w600, color: c.a.inkFaint);
  static TextStyle cardTitle(BuildContext c, {double size = 14.5, Color? color}) => c.aText.heading(px(size, weight: FontWeight.w700, color: color ?? c.a.ink));
  static TextStyle sectionTitle(BuildContext c, {double size = 15}) => c.aText.heading(px(size, color: c.a.onBg));
  static TextStyle ctaText(BuildContext c) => px(13, color: c.a.bodyText, height: 1.7);
  static TextStyle statLabel(BuildContext c) => px(10, weight: FontWeight.w700, color: c.a.inkSoft);
  static TextStyle heading(BuildContext c, double size, {Color? color, FontWeight weight = FontWeight.w700}) => c.aText.heading(px(size, weight: weight, color: color ?? c.a.ink, height: 1.25));
}

/// `.a-section-head` with a 15px `.a-section-title.a-heading` and a trailing widget (baseline, 12 below).
class ASectionHeadRow extends StatelessWidget {
  const ASectionHeadRow({super.key, required this.title, this.trailing, this.bottom = 12, this.top = 0});
  final String title;
  final Widget? trailing;
  final double bottom;
  final double top;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: bottom, top: top),
        child: Row(children: [
          Expanded(child: Text(title, style: AStyles.sectionTitle(context))),
          ?trailing,
        ]),
      );
}

/// A one-shot timer that is cancelled with its owner (`setTimeout` + cleanup).
class OneShot {
  Timer? _t;
  void run(Duration d, VoidCallback f) {
    _t?.cancel();
    _t = Timer(d, f);
  }

  void cancel() => _t?.cancel();
}
