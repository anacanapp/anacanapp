// Ported from: src/styles/anacan-design.css (.a-fade-in, .a-tag, .a-tag.on, .a-tabs, .a-tab, .a-trio*, .a-stat-tile*,
//              .a-inline-bar*, .a-cta-btn, .a-icon-btn, .a-section-head, .a-rank-*, .a-input, .a-today-info-eyebrow,
//              .a-legend-*, .a-teaser), src/components/ui/{switch,slider,input,textarea,button,alert-dialog,calendar}.tsx
//              (shadcn primitives used by the flow components; core.design-ui is not ported yet, so the flow
//              home carries local equivalents), framer-motion initial/animate entries of src/components/flow/*.tsx
import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import 'flow_common.dart' show azWeekdayShort, cssUpper, flowFormat;

/// CSS `ease` keyword.
const Cubic _ease = ACurves.cssEase;

/// `.a-fade-in`: `a-fade-in 460ms ease both` (opacity 0→1, translateY 10→0).
///
/// A CSS animation beats framer's inline transform/opacity, so an element carrying both `a-fade-in` and
/// framer `initial/animate` (most flow cards) shows only this animation; framer delays have no visible effect.
class AFadeIn extends StatefulWidget {
  const AFadeIn({super.key, required this.child});
  final Widget child;
  @override
  State<AFadeIn> createState() => _AFadeInState();
}

class _AFadeInState extends State<AFadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 460));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && !_c.isAnimating) {
      _c.forward();
    }
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
          final t = _ease.transform(_c.value);
          // Same tree shape at every frame (a swap would remount the subtree and restart nested entries).
          return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 10 * (1 - t)), child: child));
        },
      );
}

/// framer `initial={{ y: dy, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}`: opacity is a
/// 300 ms tween (`[0.25, 0.1, 0.35, 1]`), y framer's default transform spring (500 / 25), both after [delay].
class FramerEnter extends StatefulWidget {
  const FramerEnter({super.key, required this.child, this.dy = 20, this.dx = 0, this.delay = Duration.zero, this.fadeOnly = false});
  final Widget child;
  final double dy;
  final double dx;
  final Duration delay;
  final bool fadeOnly;
  @override
  State<FramerEnter> createState() => _FramerEnterState();
}

class _FramerEnterState extends State<FramerEnter> with TickerProviderStateMixin {
  late final AnimationController _o = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _o.value = 1;
      _y.value = 0;
      return;
    }
    Future<void>.delayed(widget.delay, () {
      if (!mounted) return;
      _o.forward();
      _y.animateWith(SpringSimulation(ASprings.transform, 1, 0, 0));
    });
  }

  @override
  void dispose() {
    _o.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: Listenable.merge([_o, _y]),
        child: widget.child,
        builder: (context, child) {
          final o = ACurves.framerDefault.transform(_o.value.clamp(0.0, 1.0));
          final k = widget.fadeOnly ? 0.0 : _y.value;
          return Opacity(
              opacity: o, child: Transform.translate(offset: Offset(rtlXOf(context, widget.dx) * k, widget.dy * k), child: child));
        },
      );
}

/// `animate-pulse` skeleton card used by the loading states (`.a-card` + soft bars).
class FlowSkeletonCard extends StatefulWidget {
  const FlowSkeletonCard({super.key, required this.bars, this.titleWidthFactor = 0.33});
  final List<({double height, double radius})> bars;
  final double titleWidthFactor;
  @override
  State<FlowSkeletonCard> createState() => _FlowSkeletonCardState();
}

class _FlowSkeletonCardState extends State<FlowSkeletonCard> with SingleTickerProviderStateMixin {
  // Tailwind animate-pulse: 2s cubic-bezier(0.4,0,0.6,1) infinite, opacity 1 → .5 → 1.
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
  Widget build(BuildContext context) {
    final a = context.a;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final v = const Cubic(0.4, 0, 0.6, 1).transform(_c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2);
        return Opacity(opacity: 1 - 0.5 * v, child: child);
      },
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          FractionallySizedBox(
            widthFactor: widget.titleWidthFactor,
            child: Container(height: 24, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(8))),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < widget.bars.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            Container(
                height: widget.bars[i].height,
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(widget.bars[i].radius))),
          ],
        ]),
      ),
    );
  }
}

/// `.a-tag` (`.on`): pill, 7×12 padding, 11.5/600, inline overrides for colours/weight.
class ATag extends StatelessWidget {
  const ATag({super.key, required this.child, this.on = false, this.background, this.color, this.weight, this.borderless = false, this.onTap});
  final Widget child;
  final bool on;
  final Color? background;
  final Color? color;
  final FontWeight? weight;
  final bool borderless;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = color ?? (on ? a.accentInk : a.inkSoft);
    Widget w = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: background ?? (on ? a.tagOnBg : a.surfaceSoft),
        borderRadius: BorderRadius.circular(999),
        border: borderless ? null : Border.all(color: on ? a.peach2 : const Color(0x00000000)),
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontSize: 11.5, fontWeight: weight ?? FontWeight.w600, color: fg, height: 1.5),
        child: IconTheme.merge(data: IconThemeData(color: fg), child: child),
      ),
    );
    if (onTap != null) w = GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: w);
    return w;
  }
}

/// `.a-trio-item` with the inline `border: none; box-shadow: none; background: var(--a-surface-soft)`.
class ATrioItem extends StatelessWidget {
  const ATrioItem({super.key, required this.value, required this.label, this.icon, this.padding = const EdgeInsets.symmetric(vertical: 14, horizontal: 8)});
  final String value;
  final String label;
  final Widget? icon;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusMd)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) Padding(padding: const EdgeInsets.only(bottom: 9), child: icon),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(value, textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: a.ink, height: 1.5)),
        ),
        Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
      ]),
    );
  }
}

/// `.a-trio-icon`: 38px, radius 12.
class ATrioIcon extends StatelessWidget {
  const ATrioIcon({super.key, required this.icon, required this.gradient, required this.color});
  final AIconData icon;
  final Gradient gradient;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(12)),
        child: AIcon(icon, size: 16, color: color),
      );
}

/// `.a-stat-tile` (+ icon/label/value).
class AStatTile extends StatelessWidget {
  const AStatTile({super.key, required this.icon, required this.label, required this.value});
  final Widget icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        icon,
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: a.ink, height: 1.5)),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// `.a-stat-tile-icon`: 30px, radius 9.
class AStatTileIcon extends StatelessWidget {
  const AStatTileIcon({super.key, required this.child, this.color, this.gradient, this.border});
  final Widget child;
  final Color? color;
  final Gradient? gradient;
  final BoxBorder? border;
  @override
  Widget build(BuildContext context) => Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, gradient: gradient, border: border, borderRadius: BorderRadius.circular(9)),
        child: child,
      );
}

/// `.a-grid-2` (two columns, gap 10, margin-top [top]).
class AGrid2 extends StatelessWidget {
  const AGrid2({super.key, required this.children, this.top = 14});
  final List<Widget> children;
  final double top;
  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      if (i > 0) rows.add(const SizedBox(height: 10));
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: children[i]),
          const SizedBox(width: 10),
          Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox()),
        ]),
      ));
    }
    return Padding(padding: EdgeInsets.only(top: top), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows));
  }
}

/// `.a-inline-bar` (6px, `--a-line-strong`) with a fill; [animate] = framer width 0 → pct over 0.8 s (easeOut).
class AInlineBar extends StatelessWidget {
  const AInlineBar({super.key, required this.percent, this.color, this.animate = false, this.top = 8});
  final double percent;
  final Color? color;
  final bool animate;
  final double top;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final f = (percent / 100).clamp(0.0, 1.0);
    Widget fill(double v) => FractionallySizedBox(
          alignment: AlignmentDirectional.centerStart,
          widthFactor: v,
          child: Container(
              decoration: BoxDecoration(
                  color: color, gradient: color == null ? a.gradPeach : null, borderRadius: BorderRadius.circular(999))),
        );
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Container(
        height: 6,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
        child: animate && !animationsDisabled(context)
            ? TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: f),
                duration: const Duration(milliseconds: 800),
                curve: ACurves.cssEaseInOut,
                builder: (context, v, _) => fill(v),
              )
            : fill(f),
      ),
    );
  }
}

/// `.a-cta-btn` with inline overrides (background / colour / height / flex).
class ACtaButton extends StatelessWidget {
  const ACtaButton({super.key, required this.label, this.icon, this.onTap, this.color, this.gradient, this.foreground, this.height, this.expand = false, this.tapScale = 0.97});
  final String label;
  final Widget? icon;
  final VoidCallback? onTap;
  final Color? color;
  final Gradient? gradient;
  final Color? foreground;
  final double? height;
  final bool expand;
  final double? tapScale;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = foreground ?? const Color(0xFFFFFFFF);
    Widget b = Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
      decoration: BoxDecoration(color: gradient == null ? (color ?? a.peach2) : null, gradient: gradient, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[IconTheme.merge(data: IconThemeData(color: fg), child: icon!), const SizedBox(width: 6)],
          Flexible(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: fg, height: 1.5)),
          ),
        ],
      ),
    );
    b = Semantics(button: true, label: label, excludeSemantics: true, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: b));
    if (tapScale != null) b = PressScale(scale: tapScale!, child: b);
    return b;
  }
}

/// `.a-icon-btn` (38px, radius 12, surface, btn border, peach shadow); [size] for inline overrides.
class AIconSquareButton extends StatelessWidget {
  const AIconSquareButton({super.key, required this.icon, required this.onTap, this.size = 38, this.semanticLabel});
  final Widget icon;
  final VoidCallback? onTap;
  final double size;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      container: true,
      label: semanticLabel,
      excludeSemantics: semanticLabel != null,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: a.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: a.btnBorder),
            boxShadow: const [BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
          ),
          child: IconTheme.merge(data: IconThemeData(color: a.ink), child: icon),
        ),
      ),
    );
  }
}

/// `.a-section` (margin-top 22) with an `.a-section-head` (title + trailing on the baseline, 12 below).
class ASectionHead extends StatelessWidget {
  const ASectionHead({super.key, required this.title, this.trailing});
  final String title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: Text(title, style: context.aText.aSectionTitle)),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      );
}

/// `.a-today-info-eyebrow` (upper-cased).
Text aTodayInfoEyebrow(BuildContext context, String text) => Text(cssUpper(text),
    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.05, color: context.a.inkSoft, height: 1.5));

/// `.a-section-link` text style with an optional colour override.
TextStyle aSectionLinkStyle(BuildContext context, {Color? color}) => context.aText.aSectionLink.copyWith(color: color);

/// `.a-rank-row` (+ `:first-child`).
class ARankRow extends StatelessWidget {
  const ARankRow({super.key, required this.first, required this.children});
  final bool first;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.only(top: first ? 2 : 13, bottom: 13),
        decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: context.a.line))),
        child: Row(children: children),
      );
}

/// `.a-rank-tag` (10.5/800, padding 5×11, pill).
class ARankTag extends StatelessWidget {
  const ARankTag({super.key, required this.text, required this.background, required this.color, this.maxWidth});
  final String text;
  final Color background;
  final Color color;
  final double? maxWidth;
  @override
  Widget build(BuildContext context) => Container(
        constraints: maxWidth == null ? null : BoxConstraints(maxWidth: maxWidth!),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Text(text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            softWrap: false,
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color, height: 1.5)),
      );
}

/// `.a-legend-item` + `.a-legend-dot`.
class ALegendItem extends StatelessWidget {
  const ALegendItem({super.key, required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: context.a.inkSoft, height: 1.5)),
      ]);
}

// ───────────────────────── shadcn primitives ─────────────────────────

/// shadcn `<Switch>`: 44×24, border 2 transparent, checked `--primary` / unchecked `--input`, thumb 20 `--background`
/// with shadow-lg; translate 20, transition-colors/transform 150ms.
class ShadSwitch extends StatelessWidget {
  const ShadSwitch({super.key, required this.checked, this.onChanged, this.checkedColor, this.semanticLabel});
  final bool checked;
  final ValueChanged<bool>? onChanged;
  final Color? checkedColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final disabled = onChanged == null;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    Widget w = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: ACurves.tailwind,
      width: 44,
      height: 24,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: checked ? (checkedColor ?? s.primary) : s.input, borderRadius: BorderRadius.circular(999)),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 150),
        curve: ACurves.tailwind,
        alignment: (checked != rtl) ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(color: s.background, shape: BoxShape.circle, boxShadow: const [
            BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
            BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
          ]),
        ),
      ),
    );
    if (disabled) w = Opacity(opacity: 0.5, child: w);
    return Semantics(
      toggled: checked,
      enabled: !disabled,
      label: semanticLabel,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: disabled ? null : () => onChanged!(!checked), child: w),
    );
  }
}

/// shadcn `<Slider>` (one thumb): track 8 `--secondary`, range `--primary`, thumb 20 with 2px primary border.
class ShadSlider extends StatelessWidget {
  const ShadSlider({super.key, required this.value, required this.max, required this.onChanged, this.step = 1});
  final double value;
  final double max;
  final double step;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth;
      final rtl = Directionality.of(context) == TextDirection.rtl;
      void set(double dx) {
        var f = ((dx - 10) / math.max(1, w - 20)).clamp(0.0, 1.0);
        if (rtl) f = 1 - f;
        final v = (f * max / step).round() * step;
        if (v != value) onChanged(v);
      }

      final f = (value / max).clamp(0.0, 1.0);
      final thumbX = 10 + f * (w - 20);
      final x = rtl ? w - thumbX : thumbX;
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (d) => set(d.localPosition.dx),
        onHorizontalDragUpdate: (d) => set(d.localPosition.dx),
        child: SizedBox(
          height: 20,
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned(
              left: 0,
              right: 0,
              top: 6,
              child: Container(
                height: 8,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: s.secondary, borderRadius: BorderRadius.circular(999)),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: FractionallySizedBox(widthFactor: (thumbX / w).clamp(0.0, 1.0), child: Container(color: s.primary)),
                ),
              ),
            ),
            Positioned(
              left: x - 10,
              top: 0,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(color: s.background, shape: BoxShape.circle, border: Border.all(color: s.primary, width: 2)),
              ),
            ),
          ]),
        ),
      );
    });
  }
}

/// shadcn `<Input>` / `<Textarea>`: rounded-md (radius 12 in this theme), 1px `--input`, `--background`,
/// px 3 py 2, text-base (16px; `md:text-sm` only applies from 768 px).
class ShadInput extends StatelessWidget {
  const ShadInput({
    super.key,
    required this.controller,
    this.placeholder,
    this.keyboardType,
    this.textAlign = TextAlign.start,
    this.maxLines = 1,
    this.minHeight = 40,
    this.onChanged,
    this.maxWidth,
  });
  final TextEditingController controller;
  final String? placeholder;
  final TextInputType? keyboardType;
  final TextAlign textAlign;
  final int maxLines;
  final double minHeight;
  final ValueChanged<String>? onChanged;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final style = TextStyle(fontSize: 16, color: s.foreground, height: 1.5);
    Widget w = Container(
      constraints: BoxConstraints(minHeight: minHeight),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(TwRadius.md), border: Border.all(color: s.input)),
      alignment: maxLines == 1 ? Alignment.centerLeft : Alignment.topLeft,
      child: EditableText(
        controller: controller,
        focusNode: _focus(controller),
        style: style,
        cursorColor: s.primary,
        backgroundCursorColor: s.mutedForeground,
        keyboardType: keyboardType,
        textAlign: textAlign,
        maxLines: maxLines,
        minLines: maxLines == 1 ? null : maxLines,
        onChanged: onChanged,
      ),
    );
    if (placeholder != null) {
      w = Stack(children: [
        w,
        Positioned.fill(
          child: IgnorePointer(
            child: ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, v, _) => v.text.isNotEmpty
                  ? const SizedBox()
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                      child: Align(
                        alignment: maxLines == 1 ? AlignmentDirectional.centerStart : AlignmentDirectional.topStart,
                        child: SizedBox(
                          width: double.infinity,
                          child: Text(placeholder!, textAlign: textAlign, style: style.copyWith(color: s.mutedForeground)),
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ]);
    }
    if (maxWidth != null) w = ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth!), child: w);
    return w;
  }

  static final Expando<FocusNode> _nodes = Expando<FocusNode>();
  static FocusNode _focus(TextEditingController c) => _nodes[c] ??= FocusNode();
}

/// shadcn `<Button>` default (h-10, rounded-md, 14/500) with a background override.
class ShadButton extends StatelessWidget {
  const ShadButton({super.key, required this.label, required this.onPressed, this.gradient, this.color, this.foreground, this.outline = false, this.height = 40});
  final String label;
  final VoidCallback? onPressed;
  final Gradient? gradient;
  final Color? color;
  final Color? foreground;
  final bool outline;
  final double height;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final fg = foreground ?? (outline ? s.foreground : s.primaryForeground);
    Widget w = Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: gradient != null ? null : (color ?? (outline ? s.background : s.primary)),
        gradient: gradient,
        borderRadius: BorderRadius.circular(TwRadius.md),
        border: outline ? Border.all(color: s.input) : null,
      ),
      child: Text(label, maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: fg, height: 20 / 14)),
    );
    if (onPressed == null) w = Opacity(opacity: 0.5, child: w);
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onPressed, child: w),
    );
  }
}

/// shadcn AlertDialog: `bg-black/80` overlay, centred `max-w-sm` panel, p-6, gap 4, border, shadow-lg; fade + zoom 95%
/// over 200 ms. On phones `sm:rounded-lg` does not apply (square corners), footer is a reversed column.
Future<T?> showFlowAlertDialog<T>(BuildContext context, {required Widget Function(BuildContext context) builder}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'dismiss',
    barrierColor: const Color(0xCC000000),
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => builder(ctx),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(anim), child: child),
    ),
  );
}

class ShadAlertDialogPanel extends StatelessWidget {
  const ShadAlertDialogPanel({super.key, required this.title, required this.description, required this.body, required this.actions});
  final String title;
  final String description;
  final List<Widget> body;

  /// Footer buttons in DOM order (cancel, action); shown as a reversed column on phones.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 384),
        margin: EdgeInsets.zero,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: s.background,
          border: Border.all(color: s.border),
          boxShadow: const [
            BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
            BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
          ],
        ),
        child: DefaultTextStyle(
          style: Theme.of(context).textTheme.bodyMedium!,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, height: 28 / 18, color: s.foreground)),
            const SizedBox(height: 8),
            Text(description, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: s.mutedForeground)),
            const SizedBox(height: 16),
            ...body,
            const SizedBox(height: 16),
            for (var i = actions.length - 1; i >= 0; i--) ...[
              actions[i],
              if (i > 0) const SizedBox(height: 8),
            ],
          ]),
        ),
      ),
    );
  }
}

/// shadcn `<Calendar>` (react-day-picker v8) in `single` / `multiple` mode: p-3, caption 14/500 with outline nav
/// buttons 28px, head cells 36 wide (12.8px muted), day cells 36×36 ghost buttons; selected `--primary`, today
/// `--accent`, outside days muted at 50%, disabled muted at 50%. [weekStartsOn] = the date-fns locale (az: Monday).
class ShadDayPicker extends StatefulWidget {
  const ShadDayPicker({
    super.key,
    required this.selected,
    required this.onSelect,
    required this.isDisabled,
    this.multiple = false,
    this.weekStartsOn = 1,
    this.initialMonth,
  });
  final List<DateTime> selected;
  final ValueChanged<List<DateTime>> onSelect;
  final bool Function(DateTime day) isDisabled;
  final bool multiple;
  final int weekStartsOn;
  final DateTime? initialMonth;

  @override
  State<ShadDayPicker> createState() => _ShadDayPickerState();
}

class _ShadDayPickerState extends State<ShadDayPicker> {
  late DateTime _month = () {
    final m = widget.initialMonth ?? (widget.selected.isNotEmpty ? widget.selected.first : DateTime.now());
    return DateTime(m.year, m.month);
  }();

  bool _same(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final now = DateTime.now();
    final first = DateTime(_month.year, _month.month, 1);
    final lead = (first.weekday % 7 - widget.weekStartsOn) % 7;
    final start = DateTime(first.year, first.month, 1 - lead);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final weeks = ((lead + daysInMonth) / 7).ceil();
    Widget nav(AIconData icon, int delta) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _month = DateTime(_month.year, _month.month + delta)),
          child: Opacity(
            opacity: 0.5,
            child: Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(border: Border.all(color: s.input), borderRadius: BorderRadius.circular(TwRadius.md)),
              child: AIcon(icon, size: 16, color: s.foreground, mirrorInRtl: true),
            ),
          ),
        );
    final weekdayNames = [
      for (var i = 0; i < 7; i++)
        currentLanguage() == 'az'
            ? azWeekdayShort[(widget.weekStartsOn + i) % 7]
            : formatDatePattern(DateTime(2024, 1, 7 + (widget.weekStartsOn + i) % 7), 'EEE'),
    ];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: s.border), borderRadius: BorderRadius.circular(12)),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          height: 32,
          child: Stack(alignment: Alignment.center, children: [
            Text(flowFormat(_month, 'MMMM y'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: s.foreground)),
            PositionedDirectional(start: 4, child: nav(AIcons.chevronLeft, -1)),
            PositionedDirectional(end: 4, child: nav(AIcons.chevronRight, 1)),
          ]),
        ),
        const SizedBox(height: 16),
        Row(mainAxisSize: MainAxisSize.min, children: [
          for (final n in weekdayNames)
            SizedBox(width: 36, child: Text(n, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.8, color: s.mutedForeground))),
        ]),
        for (var w = 0; w < weeks; w++)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              for (var d = 0; d < 7; d++) _day(DateTime(start.year, start.month, start.day + w * 7 + d), now, s),
            ]),
          ),
      ]),
    );
  }

  Widget _day(DateTime day, DateTime now, ShadcnTokens s) {
    final outside = day.month != _month.month;
    final disabled = widget.isDisabled(day);
    final selected = widget.selected.any((x) => _same(x, day));
    final today = _same(day, now);
    Color? bg;
    var fg = s.foreground;
    var opacity = 1.0;
    if (selected) {
      bg = s.primary;
      fg = s.primaryForeground;
      if (outside) {
        bg = s.accent.withValues(alpha: 0.5);
        fg = s.mutedForeground;
        opacity = 0.3;
      }
    } else if (today) {
      bg = s.accent;
      fg = s.accentForeground;
    }
    if (outside && !selected) {
      fg = s.mutedForeground;
      opacity = 0.5;
    }
    if (disabled) {
      fg = s.mutedForeground;
      opacity = 0.5;
    }
    return Semantics(
      button: true,
      selected: selected,
      enabled: !disabled,
      label: flowFormat(day, 'd MMMM yyyy'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: disabled
            ? null
            : () {
                if (widget.multiple) {
                  final next = selected ? widget.selected.where((x) => !_same(x, day)).toList() : [...widget.selected, day];
                  widget.onSelect(next);
                } else {
                  widget.onSelect([day]);
                }
              },
        child: Opacity(
          opacity: opacity,
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(TwRadius.md)),
            child: Text('${day.day}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: fg)),
          ),
        ),
      ),
    );
  }
}
