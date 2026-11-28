// Ported from: src/styles/care.css (.cx-page, .cx-wrap, .cx-head, .cx-eyebrow, .cx-title, .cx-pill, .cx-card,
//              .cx-gap, .cx-section, .cx-sub, .cx-row, .cx-icon, .cx-chip(s), .cx-seg, .cx-field, .cx-input, .cx-stack,
//              .cx-grid2/3/4, .cx-tile, .cx-warn, .cx-alert, .cx-call, .cx-disc, .cx-list, .cx-li, .cx-x, .cx-link,
//              .cx-tabs, .cx-check), src/styles/anacan-design.css (.a-icon-btn in the cx head)
//
// The care screens' widget kit (illness journal, postpartum recovery). Sizes are the CSS values.
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, ASky, cssUpper, px;

/// `.cx-page` + `.cx-wrap` (max 28rem, padding 0 18 110) over the `.a-sky` with two clouds; scrolls itself.
class CxPage extends StatelessWidget {
  const CxPage({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AScope(
      child: ColoredBox(
        color: context.a.bg,
        child: Stack(children: [
          const Positioned(top: 0, left: 0, right: 0, child: ASky(clouds: 2)),
          Positioned.fill(
            child: SingleChildScrollView(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 110),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `.cx-head`: 44px back button, eyebrow + title, optional trailing pill.
class CxHead extends StatelessWidget {
  const CxHead({super.key, required this.onBack, required this.eyebrow, required this.title, this.trailing, this.backLabel = '‹'});
  final VoidCallback onBack;
  final String eyebrow;
  final String title;
  final Widget? trailing;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 18, 0, 14),
      child: Row(children: [
        AIconBtn(size: 44, semanticLabel: backLabel, onTap: onBack, icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            CxEyebrow(eyebrow),
            Text(title, style: cxTitle(context)),
          ]),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ]),
    );
  }
}

/// `.cx-title` (21/800, -0.02em, line-height 1.2).
TextStyle cxTitle(BuildContext context, [double size = 21]) => px(size, weight: FontWeight.w800, color: context.a.ink, ls: -0.02, height: 1.2);

/// `.cx-sub`.
TextStyle cxSub(BuildContext context, [double size = 13]) => px(size, color: context.a.inkSoft, height: 1.45);

/// `.cx-eyebrow`.
class CxEyebrow extends StatelessWidget {
  const CxEyebrow(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Text(cssUpper(text), style: px(11, weight: FontWeight.w800, color: color ?? context.a.inkSoft, ls: 0.07));
}

/// `.cx-section` (margin 22 4 8; 12/800 upper-case).
class CxSection extends StatelessWidget {
  const CxSection(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
        child: Text(cssUpper(text), style: px(12, weight: FontWeight.w800, color: context.a.inkSoft, ls: 0.05)),
      );
}

/// `.cx-field` (12.5/700, margin-bottom 6).
class CxField extends StatelessWidget {
  const CxField(this.text, {super.key, this.bottom = 6});
  final String text;
  final double bottom;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: EdgeInsets.only(bottom: bottom), child: Text(text, style: px(12.5, weight: FontWeight.w700, color: context.a.inkSoft)));
}

/// `.cx-disc` (margin 16 8 0, centred 11.5 `--a-ink-faint`).
class CxDisc extends StatelessWidget {
  const CxDisc(this.text, {super.key, this.top = 16});
  final String text;
  final double top;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(8, top, 8, 0),
        child: Text(text, textAlign: TextAlign.center, style: px(11.5, color: context.a.inkFaint, height: 1.45)),
      );
}

/// `.cx-card` (+ `.cx-gap` margin-top 12 when [gap]).
class CxCard extends StatelessWidget {
  const CxCard({super.key, required this.child, this.gap = false, this.padding = const EdgeInsets.all(16), this.color, this.gradient, this.border = true, this.clip = false, this.onTap, this.tapScale});
  final Widget child;
  final bool gap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Gradient? gradient;

  /// `border: 0` overrides drop the 1px line.
  final bool border;
  final bool clip;
  final VoidCallback? onTap;
  final double? tapScale;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget card = Container(
      width: double.infinity,
      padding: padding,
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? a.surface) : null,
        gradient: gradient,
        border: border ? Border.all(color: a.line) : null,
        borderRadius: BorderRadius.circular(a.radiusLg),
        boxShadow: a.cardShadow,
      ),
      child: child,
    );
    if (onTap != null) {
      card = Semantics(
        button: true,
        child: tapScale != null
            ? PressScale(scale: tapScale!, onTap: onTap, child: card)
            : GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: card),
      );
    }
    return gap ? Padding(padding: const EdgeInsets.only(top: 12), child: card) : card;
  }
}

/// `.cx-icon` (42, radius 14, emoji 20).
class CxIcon extends StatelessWidget {
  const CxIcon({super.key, this.emoji, this.icon, required this.color, this.size = 42, this.fontSize = 20, this.radius = 14});
  final String? emoji;
  final Widget? icon;
  final Color color;
  final double size;
  final double fontSize;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(radius)),
        child: icon ?? Text(emoji ?? '', style: TextStyle(fontSize: fontSize, height: 1.2)),
      );
}

/// `.cx-pill` (padding 5 11, 12/800); [dot] = the `<i />` 8px current-colour dot.
class CxPill extends StatelessWidget {
  const CxPill({super.key, required this.label, this.background, this.color, this.dot = false, this.leading});
  final String label;
  final Color? background;
  final Color? color;
  final bool dot;
  final Widget? leading;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = color ?? a.inkSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(color: background ?? a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (dot) ...[Container(width: 8, height: 8, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)), const SizedBox(width: 6)],
        if (leading != null) ...[IconTheme.merge(data: IconThemeData(color: fg, size: 12), child: leading!), const SizedBox(width: 6)],
        Text(label, maxLines: 1, style: px(12, weight: FontWeight.w800, color: fg, height: 1.2)),
      ]),
    );
  }
}

/// `.cx-chip` (`[aria-pressed=true]` peach).
class CxChip extends StatelessWidget {
  const CxChip({super.key, required this.label, required this.pressed, required this.onTap});
  final String label;
  final bool pressed;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: pressed,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 38),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: pressed ? a.peach1 : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: pressed ? a.peach2 : a.lineStrong, width: 1.5),
          ),
          child: Text(label, style: px(13.5, weight: FontWeight.w700, color: pressed ? a.accentInk : a.ink, height: 1.2)),
        ),
      ),
    );
  }
}

/// `.cx-chips` (wrap, gap 8).
class CxChips extends StatelessWidget {
  const CxChips({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: children);
}

/// `.cx-seg`: equal buttons, `[aria-pressed=true]` on surface with a soft shadow.
class CxSeg extends StatelessWidget {
  const CxSeg({super.key, required this.items, this.semanticLabel});
  final List<({String label, bool pressed, VoidCallback onTap, Color? color})> items;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      label: semanticLabel,
      container: semanticLabel != null,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                button: true,
                selected: items[i].pressed,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: items[i].onTap,
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 38),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: items[i].pressed ? a.surface : null,
                      borderRadius: BorderRadius.circular(12),
                      // 0 2px 8px rgba(0,0,0,.08)
                      boxShadow: items[i].pressed ? const [BoxShadow(color: Color(0x14000000), offset: Offset(0, 2), blurRadius: 8)] : null,
                    ),
                    child: Text(
                      items[i].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: px(13, weight: FontWeight.w700, color: items[i].color ?? (items[i].pressed ? a.ink : a.inkSoft), height: 1.2),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

/// `.cx-grid2/3/4`: equal columns ([columns]) with [gap].
class CxGrid extends StatelessWidget {
  const CxGrid({super.key, required this.columns, required this.children, this.gap = 8});
  final int columns;
  final List<Widget> children;
  final double gap;
  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var c = 0; c < columns; c++) ...[
            if (c > 0) SizedBox(width: gap),
            Expanded(child: i + c < children.length ? children[i + c] : const SizedBox.shrink()),
          ],
        ]),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var r = 0; r < rows.length; r++) ...[if (r > 0) SizedBox(height: gap), rows[r]],
    ]);
  }
}

/// `.cx-tile` (column, min-height [minHeight], radius 20, 12.5/700; pressed: 2.5px peach inset ring;
/// `:active` scale 0.96).
class CxTile extends StatelessWidget {
  const CxTile({super.key, required this.emoji, required this.label, required this.background, required this.pressed, required this.onTap, this.minHeight = 84, this.emojiSize = 24, this.fontSize = 12.5, this.tapScale = 0.96});
  final String emoji;
  final String label;
  final Color background;
  final bool pressed;
  final VoidCallback onTap;
  final double minHeight;
  final double emojiSize;
  final double fontSize;
  final double tapScale;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      selected: pressed,
      child: PressScale(
        scale: tapScale,
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: minHeight),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(20),
            border: pressed ? Border.all(color: a.peach2, width: 2.5) : null,
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(emoji, style: TextStyle(fontSize: emojiSize, height: 1)),
            const SizedBox(height: 6),
            Text(label, textAlign: TextAlign.center, style: px(fontSize, weight: FontWeight.w700, color: a.ink, height: 1.25)),
          ]),
        ),
      ),
    );
  }
}

/// `.cx-alert` (radius 20, padding 14 16, `--a-alert-bg`, 1px rgba(201,42,42,.22)); [title] is the `<b>`.
class CxAlert extends StatelessWidget {
  const CxAlert({super.key, this.title, this.children = const []});
  final String? title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        gradient: a.alertBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x38C92A2A)), // rgba(201, 42, 42, .22)
      ),
      child: DefaultTextStyle.merge(
        style: px(13, color: a.alertInk, height: 1.45),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (title != null) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(title!, style: px(14.5, weight: FontWeight.w700, color: a.alertInk, height: 1.45))),
          ...children,
        ]),
      ),
    );
  }
}

/// `.cx-warn` (radius 18, padding 12 14, `--a-yellow-1` / `--a-warn-ink`, 12.5).
class CxWarn extends StatelessWidget {
  const CxWarn({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(18)),
      child: DefaultTextStyle.merge(style: px(12.5, color: a.warnInk, height: 1.45), child: child),
    );
  }
}

/// `.cx-call` (`<a href="tel:…">`: full-width #e03131 pill, 50 high, 15.5/800 white, Phone 17).
class CxCallButton extends StatelessWidget {
  const CxCallButton({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Semantics(
          link: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 50),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xFFE03131), borderRadius: BorderRadius.circular(999)), // care.css .cx-call
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const AIcon(AIcons.phone, size: 17, color: Color(0xFFFFFFFF)),
                const SizedBox(width: 8),
                Flexible(child: Text(label, style: px(15.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF), height: 1.2))),
              ]),
            ),
          ),
        ),
      );
}

/// `.cx-list`: children separated by a 1px `--a-line` top border.
class CxList extends StatelessWidget {
  const CxList({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final line = context.a.line;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var i = 0; i < children.length; i++)
        if (i == 0) children[i] else DecoratedBox(decoration: BoxDecoration(border: Border(top: BorderSide(color: line))), child: children[i]),
    ]);
  }
}

/// `.cx-li` (row, gap 12, padding 12 0): leading icon, `<b>` title + `<small>` lines, trailing.
class CxLi extends StatelessWidget {
  const CxLi({super.key, this.leading, required this.title, this.titleColor, this.subs = const [], this.trailing, this.onTap, this.padding = const EdgeInsets.symmetric(vertical: 12)});
  final Widget? leading;
  final String title;
  final Color? titleColor;
  final List<String> subs;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget body = Padding(
      padding: padding,
      child: Row(children: [
        if (leading != null) ...[leading!, const SizedBox(width: 12)],
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(title, style: px(14, weight: FontWeight.w700, color: titleColor ?? a.ink, height: 1.35)),
            for (final s in subs) Padding(padding: const EdgeInsets.only(top: 1), child: Text(s, style: px(12, color: a.inkSoft, height: 1.35))),
          ]),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ]),
    );
    if (onTap != null) body = Semantics(button: true, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body));
    return body;
  }
}

/// `.cx-link` (full-width row button, padding 14 16, surface).
class CxLink extends StatelessWidget {
  const CxLink({super.key, required this.children, required this.onTap, this.topBorder = false});
  final List<Widget> children;
  final VoidCallback onTap;
  final bool topBorder;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: a.surface, border: topBorder ? Border(top: BorderSide(color: a.line)) : null),
          child: DefaultTextStyle.merge(
            style: px(14, weight: FontWeight.w700, color: a.ink),
            child: Row(children: [
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 12), children[i]],
            ]),
          ),
        ),
      ),
    );
  }
}

/// `.cx-input` / textarea (min-height 48, radius 14, 2px `--a-line-strong`, focus `--a-peach-2`, 15px).
class CxInput extends StatefulWidget {
  const CxInput({super.key, required this.controller, this.placeholder, this.maxLength, this.minLines = 1, this.maxLines = 1, this.autofocus = false, this.keyboardType, this.inputFormatters, this.onChanged, this.semanticLabel});
  final TextEditingController controller;
  final String? placeholder;
  final int? maxLength;
  final int minLines;
  final int maxLines;
  final bool autofocus;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final String? semanticLabel;
  @override
  State<CxInput> createState() => _CxInputState();
}

class _CxInputState extends State<CxInput> {
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
    final base = px(15, color: a.ink, height: 1.4);
    // `.cx-input` on an `<input>` loses to keyboard.css on phones (16px); a `textarea.cx-input` keeps 15px.
    final style = widget.maxLines > 1 ? base : phoneInputStyle(context, base);
    return Material(
      type: MaterialType.transparency,
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: widget.maxLines > 1 ? 12 : 0),
        alignment: widget.maxLines > 1 ? AlignmentDirectional.topStart : AlignmentDirectional.centerStart,
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong, width: 2),
        ),
        child: TextField(
          controller: widget.controller,
          focusNode: _focus,
          autofocus: widget.autofocus,
          minLines: widget.minLines,
          maxLines: widget.maxLines,
          keyboardType: widget.keyboardType,
          onChanged: widget.onChanged,
          inputFormatters: [
            if (widget.maxLength != null) LengthLimitingTextInputFormatter(widget.maxLength),
            ...?widget.inputFormatters,
          ],
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            hintText: widget.placeholder,
            hintStyle: style.copyWith(color: a.inkFaint),
            semanticCounterText: widget.semanticLabel,
          ),
        ),
      ),
    );
  }
}

/// `.cx-tabs` (scrolling pills; selected `--a-ink` / `--a-surface`).
class CxTabs extends StatelessWidget {
  const CxTabs({super.key, required this.tabs, required this.selected, required this.onSelect});
  final List<(String, String)> tabs;
  final String selected;
  final ValueChanged<String> onSelect;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        child: Row(children: [
          for (var i = 0; i < tabs.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Semantics(
              selected: tabs[i].$1 == selected,
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSelect(tabs[i].$1),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 38),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tabs[i].$1 == selected ? a.ink : a.surface,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [BoxShadow(color: a.line, spreadRadius: 1)],
                  ),
                  child: Text(tabs[i].$2, style: px(13.5, weight: FontWeight.w800, color: tabs[i].$1 == selected ? a.surface : a.inkSoft, height: 1.2)),
                ),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

/// `.cx-check` (24 circle, 2px `--a-ink-faint`; [fill] colours the done state).
class CxCheck extends StatelessWidget {
  const CxCheck({super.key, required this.on, this.fill});
  final bool on;
  final Color? fill;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final c = on ? (fill ?? const Color(0xFFE03131)) : null; // care.css .cx-flag[aria-pressed] .cx-check
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, color: c, border: Border.all(color: c ?? a.inkFaint, width: 2)),
      child: on ? Text('✓', style: px(13, color: const Color(0xFFFFFFFF), height: 1)) : null,
    );
  }
}

/// framer `initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }}` entrance.
class CxEnter extends StatelessWidget {
  const CxEnter({super.key, required this.child, this.dy = 12});
  final Widget child;
  final double dy;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: animationsDisabled(context) ? 1 : 0, end: 1),
        duration: const Duration(milliseconds: 300),
        curve: ACurves.framerDefault,
        builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, dy * (1 - v)), child: child)),
        child: child,
      );
}
