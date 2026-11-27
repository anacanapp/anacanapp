// Ported from: src/styles/anacan-design.css (.a-fade-in, .a-section-head, .a-btn-soft/.a-btn-solid, .a-choice,
//              .a-inset-panel, .a-input, .a-tag, .a-tag-row, .a-icon-btn, .a-stat-tile*, .a-inline-bar*, .a-teaser,
//              .a-tabs/.a-tab, .a-rank-*, .a-hero-eyebrow, .a-today-info-eyebrow, .a-mini-dots), framer-motion defaults
//              (initial/animate y + opacity: y spring 500/25, opacity 300 ms [0.25, 0.1, 0.35, 1])
//
// Small CSS-class widgets shared by the mommy home sections. Only classes that the design package does not
// already provide live here (ACard / AListRow / AListIcon / AButton / ASection come from design/).
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../core/i18n/tr.dart' show currentLanguage;
import '../../../design/design.dart';

/// `.a-fade-in`: 460 ms `ease`, opacity 0 → 1 and translateY(10px) → 0 (`animation-fill-mode: both`).
/// Wins over a framer `initial/animate` on the same element (CSS animations override inline styles), so
/// `motion.div className="a-card a-fade-in"` ports to just [AFadeIn].
class AFadeIn extends StatefulWidget {
  const AFadeIn({super.key, required this.child});
  final Widget child;

  static const Duration duration = Duration(milliseconds: 460);

  @override
  State<AFadeIn> createState() => _AFadeInState();
}

class _AFadeInState extends State<AFadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: AFadeIn.duration)..forward();

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
          final t = ACurves.cssEase.transform(_c.value);
          if (t >= 1) return child!;
          return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 10 * (1 - t)), child: child));
        },
      );
}

/// framer `initial={{ y, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}` with framer's
/// default transitions (y: spring 500/25, opacity: 300 ms tween).
class FramerEnter extends StatefulWidget {
  const FramerEnter({super.key, required this.child, this.y = 20, this.delay = Duration.zero});
  final Widget child;
  final double y;
  final Duration delay;

  @override
  State<FramerEnter> createState() => _FramerEnterState();
}

class _FramerEnterState extends State<FramerEnter> with TickerProviderStateMixin {
  late final AnimationController _opacity = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: widget.y);
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (!mounted) return;
      _opacity.forward();
      _y.animateWith(SpringSimulation(ASprings.transform, widget.y, 0, 0));
    });
  }

  @override
  void dispose() {
    _opacity.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: Listenable.merge([_opacity, _y]),
        child: widget.child,
        builder: (context, child) {
          final o = ACurves.framerDefault.transform(_opacity.value.clamp(0.0, 1.0));
          return Opacity(opacity: o, child: Transform.translate(offset: Offset(0, _y.value), child: child));
        },
      );
}

/// framer `initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={…}`
/// (AnimatePresence): 300 ms tween in both directions.
class FramerExpand extends StatelessWidget {
  const FramerExpand({super.key, required this.open, required this.child, this.duration = const Duration(milliseconds: 300)});
  final bool open;
  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) => AnimatedSize(
        duration: duration,
        curve: ACurves.framerDefault,
        alignment: AlignmentDirectional.topStart,
        child: AnimatedOpacity(
          opacity: open ? 1 : 0,
          duration: duration,
          curve: ACurves.framerDefault,
          child: open ? child : const SizedBox(width: double.infinity),
        ),
      );
}

/// `.a-section-head` + `.a-section-title.a-heading` + `.a-section-link` (12px below).
class ASectionHead extends StatelessWidget {
  const ASectionHead({super.key, required this.title, this.link});
  final String title;
  final Widget? link;

  @override
  Widget build(BuildContext context) {
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Flexible(child: Text(title, style: x.aSectionTitle)), ?link],
      ),
    );
  }
}

/// `.a-section-link` text.
class ASectionLinkText extends StatelessWidget {
  const ASectionLinkText(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final s = context.aText.aSectionLink;
    return Text(text, style: color == null ? s : s.copyWith(color: color));
  }
}

/// `.a-btn-soft` / `.a-btn-solid` with framer `whileTap={{ scale }}`.
class APillButton extends StatelessWidget {
  const APillButton({super.key, required this.child, this.onPressed, this.solid = false, this.tapScale = 0.95, this.block = false});
  final Widget child;
  final VoidCallback? onPressed;
  final bool solid;
  final double tapScale;

  /// `width: 100%; justify-content: center`.
  final bool block;

  @override
  Widget build(BuildContext context) => PressScale(
        scale: tapScale,
        enabled: onPressed != null,
        child: AButton(
          variant: solid ? AButtonVariant.pillSolid : AButtonVariant.pillSoft,
          block: block,
          onPressed: onPressed,
          child: child,
        ),
      );
}

/// `.a-choice` tile (+ tint class, `.running`).
class AChoice extends StatelessWidget {
  const AChoice({super.key, required this.children, required this.tint, this.running = false, this.onTap});
  final List<Widget> children;

  /// `--a-*-1` background of `.pink/.blue/.yellow/.lav/.peach`.
  final Color Function(ATokens t) tint;
  final bool running;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final fg = running ? const Color(0xFFFFFFFF) : t.ink;
    return PressScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: running ? null : tint(t),
          gradient: running ? t.gradPink : null,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: running ? const Color(0x00000000) : t.line, width: 1.5),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg),
          textAlign: TextAlign.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 4), children[i]],
            ],
          ),
        ),
      ),
    );
  }
}

/// `.a-inset-panel` (radius sm, surface-soft, 1px line, padding 12/14, margin-bottom 10).
class AInsetPanel extends StatelessWidget {
  const AInsetPanel({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(t.radiusSm), border: Border.all(color: t.line)),
      child: child,
    );
  }
}

/// `.a-input` (flex 1; padding 10/14; radius 12; 1px line-strong; focus border peach-2; 13px).
/// Built on [EditableText] (no Material dependency).
class AInput extends StatefulWidget {
  const AInput({super.key, required this.controller, this.placeholder, this.number = false, this.onChanged, this.decimal = false});
  final TextEditingController controller;
  final String? placeholder;
  final bool number;
  final bool decimal;
  final ValueChanged<String>? onChanged;

  @override
  State<AInput> createState() => _AInputState();
}

class _AInputState extends State<AInput> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_changed);
    widget.controller.addListener(_changed);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final style = TextStyle(fontSize: 13, color: t.ink, height: 1.5);
    return GestureDetector(
      onTap: _focus.requestFocus,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _focus.hasFocus ? t.peach2 : t.lineStrong),
        ),
        child: Stack(children: [
          if (widget.controller.text.isEmpty && widget.placeholder != null)
            Text(widget.placeholder!, maxLines: 1, overflow: TextOverflow.clip, style: style.copyWith(color: t.inkFaint)),
          EditableText(
            controller: widget.controller,
            focusNode: _focus,
            style: style,
            cursorColor: t.peach2,
            backgroundCursorColor: t.inkFaint,
            onChanged: widget.onChanged,
            keyboardType: widget.number ? TextInputType.numberWithOptions(decimal: widget.decimal) : TextInputType.text,
            inputFormatters: widget.number ? [FilteringTextInputFormatter.allow(RegExp(widget.decimal ? r'[0-9.,]' : r'[0-9]'))] : null,
          ),
        ]),
      ),
    );
  }
}

/// `.a-tag` (+ `.on`).
class ATag extends StatelessWidget {
  const ATag({super.key, required this.child, this.on = false, this.onTap, this.background});
  final Widget child;
  final bool on;
  final VoidCallback? onTap;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    Widget body = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: ACurves.cssEase,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: background ?? (on ? t.tagOnBg : t.surfaceSoft),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: on ? t.peach2 : const Color(0x00000000)),
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: on ? t.accentInk : t.inkSoft, height: 1.5),
        child: child,
      ),
    );
    if (onTap != null) body = PressScale(onTap: onTap, child: body);
    return body;
  }
}

/// `.a-icon-btn` (38px default; inline 30×30 in the TSX), radius 12, surface, btn-border, warm shadow.
class AIconBtn extends StatelessWidget {
  const AIconBtn({super.key, required this.icon, this.onTap, this.size = 30, this.semanticLabel});
  final Widget icon;
  final VoidCallback? onTap;
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.btnBorder),
            // `0 6px 14px -8px rgba(217, 108, 74, 0.35)` (anacan-design.css:294)
            boxShadow: const [BoxShadow(offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8, color: Color(0x59D96C4A))],
          ),
          child: IconTheme.merge(data: IconThemeData(color: t.ink), child: icon),
        ),
      ),
    );
  }
}

/// `.a-stat-tile` (+ icon square 30, radius 9).
class AStatTile extends StatelessWidget {
  const AStatTile({super.key, required this.icon, required this.iconBg, required this.iconFg, required this.lines, this.background});
  final AIconData icon;
  final Color iconBg;
  final Color iconFg;
  final List<Widget> lines;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: background ?? t.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(9)),
            child: AIcon(icon, size: 14, color: iconFg),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: lines)),
        ],
      ),
    );
  }
}

/// `.a-stat-tile-label` / `.a-stat-tile-value` styles.
abstract final class AStatText {
  static TextStyle label(ATokens t) => TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: t.inkSoft, height: 1.5);
  static TextStyle value(ATokens t) => TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: t.ink, height: 1.5);
}

/// `.a-grid-2` / `.a-grid-3` (equal columns, gap 10, margin-top 14).
class AGrid extends StatelessWidget {
  const AGrid({super.key, required this.columns, required this.children, this.marginTop = 14});
  final int columns;
  final List<Widget> children;
  final double marginTop;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      final cells = <Widget>[];
      for (var c = 0; c < columns; c++) {
        if (c > 0) cells.add(const SizedBox(width: 10));
        cells.add(Expanded(child: i + c < children.length ? children[i + c] : const SizedBox.shrink()));
      }
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 10));
      rows.add(IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells)));
    }
    return Padding(padding: EdgeInsets.only(top: marginTop), child: Column(children: rows));
  }
}

/// `.a-inline-bar` + `.a-inline-bar-fill` (6px, line-strong track, grad-peach fill).
class AInlineBar extends StatelessWidget {
  const AInlineBar({super.key, required this.percent, this.marginTop = 8, this.fill});
  final double percent;
  final double marginTop;
  final Gradient? fill;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Padding(
      padding: EdgeInsets.only(top: marginTop),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Container(
          height: 6,
          color: t.lineStrong,
          alignment: AlignmentDirectional.centerStart,
          child: FractionallySizedBox(
            widthFactor: (percent / 100).clamp(0.0, 1.0),
            heightFactor: 1,
            child: DecoratedBox(decoration: BoxDecoration(gradient: fill ?? t.gradPeach, borderRadius: BorderRadius.circular(999))),
          ),
        ),
      ),
    );
  }
}

/// `.a-teaser` (margin/padding-top 14, dashed top border line-strong, 12px ink-soft, line-height 1.55).
class ATeaser extends StatelessWidget {
  const ATeaser({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: CustomPaint(
        painter: _DashedTopBorder(t.lineStrong),
        child: Padding(
          padding: const EdgeInsets.only(top: 14),
          child: DefaultTextStyle.merge(style: TextStyle(fontSize: 12, color: t.inkSoft, height: 1.55), child: child),
        ),
      ),
    );
  }
}

class _DashedTopBorder extends CustomPainter {
  _DashedTopBorder(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1;
    // Chromium dashes a 1px border with 3px dashes and 3px gaps.
    for (double x = 0; x < size.width; x += 6) {
      canvas.drawLine(Offset(x, 0.5), Offset((x + 3).clamp(0, size.width), 0.5), p);
    }
  }

  @override
  bool shouldRepaint(_DashedTopBorder old) => old.color != color;
}

/// `.a-tabs` + `.a-tab` (+ `.active`).
class ATabs extends StatelessWidget {
  const ATabs({super.key, required this.labels, required this.active, required this.onSelect});
  final List<String> labels;
  final int active;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            GestureDetector(
              onTap: () => onSelect(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                decoration: BoxDecoration(color: i == active ? t.peach1 : null, borderRadius: BorderRadius.circular(999)),
                child: Text(labels[i],
                    style: context.aText.aTab.copyWith(color: i == active ? t.accentInk : t.inkSoft), maxLines: 1, softWrap: false),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// `.a-rank-row` (gap 12, padding 13/0, top border; `first`: no border, padding-top 2).
class ARankRow extends StatelessWidget {
  const ARankRow({super.key, required this.children, this.first = false, this.padding});
  final List<Widget> children;
  final bool first;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Container(
      padding: padding ?? (first ? const EdgeInsets.only(top: 2, bottom: 13) : const EdgeInsets.symmetric(vertical: 13)),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: t.line))),
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 12), children[i]],
        ],
      ),
    );
  }
}

/// `.a-rank-avatar` (42×42, radius 13).
class ARankAvatar extends StatelessWidget {
  const ARankAvatar({super.key, required this.child, required this.background, this.foreground, this.fontSize});
  final Widget child;
  final Color background;
  final Color? foreground;
  final double? fontSize;
  @override
  Widget build(BuildContext context) => Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(13)),
        child: DefaultTextStyle.merge(
          style: TextStyle(fontSize: fontSize, color: foreground, height: 1.5),
          child: IconTheme.merge(data: IconThemeData(color: foreground), child: child),
        ),
      );
}

/// `.a-rank-title` / `.a-rank-sub` styles.
abstract final class ARankText {
  static TextStyle title(ATokens t) => TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.ink, height: 1.5);
  static TextStyle sub(ATokens t) => TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: t.inkSoft, height: 1.5);
}

/// `.a-rank-tag` (+ `.mild` / `.medium` / `.intensive`).
class ARankTag extends StatelessWidget {
  const ARankTag({super.key, required this.label, required this.severityClass});
  final String label;

  /// 'mild' | 'medium' | 'intensive'.
  final String severityClass;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final dark = AnacanTokens.of(context).isDark;
    final (Color bg, Color fg) = switch (severityClass) {
      // `.a-rank-tag.mild { color: #946200 }`, `.dark .a-rank-tag.mild { color: #ffffff }` (anacan-design.css:1413-1420)
      'mild' => (t.yellow1, dark ? const Color(0xFFFFFFFF) : const Color(0xFF946200)),
      'medium' => (t.surfaceSoft, t.inkSoft),
      _ => (t.peach1, t.accentInk),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: fg, height: 1.5)),
    );
  }
}

/// `.a-today-info-eyebrow` (10.5/800, letter-spacing .1em, uppercase, ink-soft).
TextStyle aTodayInfoEyebrow(ATokens t) =>
    TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: em(0.1, 10.5), color: t.inkSoft, height: 1.5);

/// `animate-pulse` dot (opacity 1 → .5 → 1, 2 s cubic-bezier(.4,0,.6,1), infinite; lite: 3 iterations).
class APulseDot extends StatefulWidget {
  const APulseDot({super.key, required this.color, this.size = 12});
  final Color color;
  final double size;
  @override
  State<APulseDot> createState() => _APulseDotState();
}

class _APulseDotState extends State<APulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.forward(); // reduced motion: one iteration (animation-iteration-count: 1)
    } else if (AnacanTokens.of(context).lite) {
      _c.repeat(count: 3);
    } else {
      _c.repeat();
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
        builder: (context, _) {
          final v = const Cubic(0.4, 0, 0.6, 1).transform(_c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2);
          return Opacity(
            opacity: _c.isAnimating ? 1 - 0.5 * v : 1,
            child: Container(width: widget.size, height: widget.size, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle)),
          );
        },
      );
}

/// `text-transform: uppercase` with the document language (`<html lang>`): Azerbaijani / Turkish dotted
/// i → İ (the web renders "AYLİN", "GÜNDƏLİK").
String upper(String s, [String? language]) {
  final lang = language ?? currentLanguage();
  final src = lang == 'az' || lang == 'tr' ? s.replaceAll('i', 'İ') : s;
  return src.toUpperCase();
}
