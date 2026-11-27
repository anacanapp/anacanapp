// Ported from: src/styles/anacan-design.css (.a-trio, .a-trio-item, .a-trio-icon, .a-trio-value, .a-trio-label,
//              .a-alert-card, .a-alert-eyebrow, .a-alert-text, .a-search, .a-today-info-tip, .a-rank-tag, .a-cta,
//              .a-cta-top, .a-cta-badge, .a-pbar, .a-list-row, .a-list-icon, .a-list-trail, .a-list-value,
//              .a-list-time, .a-chart-axis), the shared overlay shapes of the pregnancy tools (centred confirm card,
//              bottom add sheet with the peach hero), `window.confirm`
//
// Small building blocks shared by the pregnancy tools (no CSS class of their own elsewhere in the port).
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px, showShadDialog, ShadDialogFrame, shadDescription;

/// `.a-trio` (3 equal columns, gap 10).
class PTrio extends StatelessWidget {
  const PTrio({super.key, required this.children, this.marginTop = 0});
  final List<Widget> children;
  final double marginTop;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(top: marginTop),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 10), Expanded(child: children[i])],
          ]),
        ),
      );
}

/// `.a-trio-item` with its `.a-trio-icon` (38px, radius 12), `.a-trio-value` (inline 17px) and `.a-trio-label`.
class PTrioItem extends StatelessWidget {
  const PTrioItem({super.key, required this.icon, required this.iconGradient, required this.iconColor, required this.value, required this.label});
  final AIconData icon;
  final Gradient iconGradient;
  final Color iconColor;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
      decoration: BoxDecoration(
        color: a.surface,
        border: Border.all(color: a.line),
        borderRadius: BorderRadius.circular(a.radiusMd),
        boxShadow: a.cardShadow,
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 38,
          height: 38,
          margin: const EdgeInsets.only(bottom: 9),
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: iconGradient, borderRadius: BorderRadius.circular(12)),
          child: AIcon(icon, size: 17, strokeWidth: 2, color: iconColor),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(value, textAlign: TextAlign.center, style: px(17, weight: FontWeight.w800, color: a.ink)),
        ),
        Text(label, textAlign: TextAlign.center, style: px(11, weight: FontWeight.w700, color: a.inkSoft)),
      ]),
    );
  }
}

/// `.a-rank-tag` with inline colours (10.5/800, padding 5×11, pill).
class PTag extends StatelessWidget {
  const PTag({super.key, required this.child, required this.background, required this.color, this.fontSize = 10.5, this.gradient});
  final Widget child;
  final Color? background;
  final Gradient? gradient;
  final Color color;
  final double fontSize;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(color: gradient == null ? background : null, gradient: gradient, borderRadius: BorderRadius.circular(999)),
        child: DefaultTextStyle.merge(
          style: px(fontSize, weight: FontWeight.w800, color: color),
          child: IconTheme.merge(data: IconThemeData(color: color), child: child),
        ),
      );
}

/// `.a-alert-card` with `.a-alert-eyebrow` and `.a-alert-text`.
class PAlertCard extends StatelessWidget {
  const PAlertCard({super.key, required this.eyebrow, required this.text, this.icon = AIcons.circleAlert});
  final String eyebrow;
  final String text;
  final AIconData icon;

  /// `.a-alert-eyebrow { color: #c23c56 }` (literal in anacan-design.css).
  static const Color eyebrowColor = Color(0xFFC23C56);

  /// `border: 1px solid rgba(216, 66, 92, 0.14)` (literal).
  static const Color borderColor = Color(0x24D8425C);

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: borderColor)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(icon, size: 13, strokeWidth: 2.3, color: eyebrowColor),
            const SizedBox(width: 6),
            Flexible(
              child: Text(upperCss(eyebrow),
                  style: px(11, weight: FontWeight.w800, color: eyebrowColor).copyWith(letterSpacing: 0.06 * 11)),
            ),
          ]),
        ),
        Text(text, style: px(12.5, color: a.alertSoft, height: 1.6)),
      ]),
    );
  }
}

/// CSS `text-transform: uppercase` with the document language (az / tr dotted i → İ).
String upperCss(String text) {
  final lang = currentLanguage();
  if (lang == 'az' || lang == 'tr') return text.replaceAll('i', 'İ').toUpperCase();
  return text.toUpperCase();
}

/// `.a-search` pill with a search icon and a borderless input.
class PSearchBox extends StatelessWidget {
  const PSearchBox({super.key, required this.controller, required this.placeholder, this.onChanged, this.iconSize = 15, this.fieldKey});
  final TextEditingController controller;
  final String placeholder;
  final ValueChanged<String>? onChanged;
  final double iconSize;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(13.5, weight: FontWeight.w600, color: a.ink);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: a.line),
        boxShadow: a.cardShadow,
      ),
      child: Row(children: [
        AIcon(AIcons.search, size: iconSize, strokeWidth: 2, color: a.inkFaint),
        const SizedBox(width: 10),
        Expanded(
          child: Material(
            type: MaterialType.transparency,
            child: TextField(
              key: fieldKey,
              controller: controller,
              onChanged: onChanged,
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `.a-today-info-tip` (surface-soft row, 12/600, line-height 1.6).
class PInfoTip extends StatelessWidget {
  const PInfoTip({super.key, required this.leading, required this.child, this.marginTop = 14});
  final Widget leading;
  final Widget child;
  final double marginTop;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(top: marginTop),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusSm)),
      child: DefaultTextStyle.merge(
        style: px(12, weight: FontWeight.w600, color: a.ink, height: 1.6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTheme.merge(data: IconThemeData(color: a.ink), child: leading),
          const SizedBox(width: 9),
          Expanded(child: child),
        ]),
      ),
    );
  }
}

/// `.a-cta` card with an inline gradient background.
class PCta extends StatelessWidget {
  const PCta({super.key, required this.child, this.gradient, this.marginTop = 0});
  final Widget child;
  final Gradient? gradient;
  final double marginTop;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(top: marginTop),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: gradient == null ? a.surface : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(a.radiusLg),
        border: Border.all(color: a.line),
        boxShadow: a.cardShadow,
      ),
      child: child,
    );
  }
}

/// `.a-cta-badge` with inline colours.
class PCtaBadge extends StatelessWidget {
  const PCtaBadge({super.key, required this.child, this.background, this.color, this.fontSize = 11, this.padding});
  final Widget child;
  final Color? background;
  final Color? color;
  final double fontSize;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = color ?? a.accentInk;
    return Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(color: background ?? a.peach1, borderRadius: BorderRadius.circular(999)),
      child: DefaultTextStyle.merge(
        style: px(fontSize, weight: FontWeight.w800, color: fg).copyWith(letterSpacing: 0.03 * fontSize),
        child: IconTheme.merge(data: IconThemeData(color: fg), child: child),
      ),
    );
  }
}

/// `.a-list-row` (padding 14×16, top border unless first) with free children: leading, body, trailing.
class PListRow extends StatelessWidget {
  const PListRow({super.key, this.leading, required this.body, this.trailing, this.first = false, this.onTap, this.padding});
  final Widget? leading;
  final Widget body;
  final Widget? trailing;
  final bool first;
  final VoidCallback? onTap;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget row = Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
      child: Row(children: [
        if (leading != null) ...[leading!, const SizedBox(width: 13)],
        Expanded(child: body),
        if (trailing != null) ...[const SizedBox(width: 13), trailing!],
      ]),
    );
    if (onTap != null) row = GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: row);
    return row;
  }
}

/// `.a-list-icon` (40×40, radius 13) with an optional gradient.
class PListIcon extends StatelessWidget {
  const PListIcon({super.key, required this.child, this.background, this.gradient, this.color, this.border});
  final Widget child;
  final Color? background;
  final Gradient? gradient;
  final Color? color;
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) => Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: gradient == null ? background : null, gradient: gradient, borderRadius: BorderRadius.circular(13), border: border),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: color),
          child: IconTheme.merge(data: IconThemeData(color: color), child: child),
        ),
      );
}

/// `.a-pbar` + `.a-pbar-track` (8px) + `.a-pbar-fill` (`--a-grad-yellow`).
class PProgressBar extends StatelessWidget {
  const PProgressBar({super.key, required this.percent, this.height = 8, this.fill});
  final double percent;
  final double height;
  final Gradient? fill;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: height,
        color: a.lineStrong,
        alignment: AlignmentDirectional.centerStart,
        child: FractionallySizedBox(
          widthFactor: (percent / 100).clamp(0.0, 1.0),
          heightFactor: 1,
          child: DecoratedBox(decoration: BoxDecoration(gradient: fill ?? a.gradYellow, borderRadius: BorderRadius.circular(999))),
        ),
      ),
    );
  }
}

/// Press feedback (`whileTap={{ scale }}`).
class PTap extends StatelessWidget {
  const PTap({super.key, required this.child, this.onTap, this.scale = 0.95, this.semanticLabel, this.selected});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? semanticLabel;
  final bool? selected;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: semanticLabel,
        selected: selected,
        child: PressScale(scale: scale, onTap: onTap, enabled: onTap != null, child: child),
      );
}

/// `window.confirm(text)`: OK / Cancel dialog; true when confirmed. Tests override [confirmPromptProvider].
final confirmPromptProvider = Provider<Future<bool> Function(BuildContext context, String text)>((ref) => showConfirmPrompt);

Future<bool> showConfirmPrompt(BuildContext context, String text) async {
  final ok = await showShadDialog<bool>(
    context,
    builder: (ctx) => ShadDialogFrame(maxWidth: 384, inset: 16, radius: 12, children: [
      Text(text, style: shadDescription(ctx)),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(tr('common_legv_et', 'Ləğv et'))),
        const SizedBox(width: 8),
        TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('OK')),
      ]),
    ]),
  );
  return ok ?? false;
}

/// The centred confirm card of WeightTracker / FetalGrowthTracker (`bg-black/60` backdrop, `max-w-sm p-6`, surface,
/// `--a-radius-lg`, 64px pink trash tile, soft cancel + pink CTA).
Future<bool> showTrashConfirm(BuildContext context, {String? title, required String text, required String cancel, required String confirm}) async {
  final ok = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'dialog',
    barrierColor: const Color(0x99000000),
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => Center(
      child: AScope(
        child: Builder(builder: (ctx) {
          final a = ctx.a;
          return Material(
            type: MaterialType.transparency,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 384),
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 64,
                  height: 64,
                  margin: const EdgeInsets.only(bottom: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
                  child: AIcon(AIcons.trash2, size: 26, color: a.pinkInk),
                ),
                if (title != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(title, textAlign: TextAlign.center, style: ctx.aText.heading(px(18, color: a.ink))),
                  ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Text(text, textAlign: TextAlign.center, style: ctx.aText.aListSub),
                ),
                Row(children: [
                  Expanded(
                    child: PTap(
                      onTap: () => Navigator.of(ctx).pop(false),
                      child: AButton(variant: AButtonVariant.pillSoft, block: true, onPressed: () => Navigator.of(ctx).pop(false), child: Text(cancel)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: PCtaButton(
                      key: const ValueKey('confirm-delete'),
                      background: a.pink2,
                      onTap: () => Navigator.of(ctx).pop(true),
                      child: Text(confirm),
                    ),
                  ),
                ]),
              ]),
            ),
          );
        }),
      ),
    ),
  );
  return ok ?? false;
}

/// `.a-cta-btn` with inline overrides (height, background, full width when inside an Expanded / [block]).
class PCtaButton extends StatelessWidget {
  const PCtaButton({super.key, required this.child, this.onTap, this.leading, this.background, this.height, this.block = true, this.tapScale = 0.98, this.foreground});
  final Widget child;
  final VoidCallback? onTap;
  final AIconData? leading;
  final Color? background;
  final Color? foreground;
  final double? height;
  final bool block;
  final double tapScale;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = foreground ?? const Color(0xFFFFFFFF);
    return PTap(
      scale: tapScale,
      onTap: onTap,
      child: Container(
        height: height,
        width: block ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        alignment: height != null || block ? Alignment.center : null,
        decoration: BoxDecoration(color: background ?? a.peach2, borderRadius: BorderRadius.circular(999)),
        child: DefaultTextStyle.merge(
          style: context.aText.aCtaBtn.copyWith(color: fg),
          child: Row(mainAxisSize: block ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
            if (leading != null) ...[AIcon(leading!, size: 15, strokeWidth: 2.2, color: fg), const SizedBox(width: 6)],
            Flexible(child: child),
          ]),
        ),
      ),
    );
  }
}

/// The bottom add sheet of WeightTracker / FetalGrowthTracker: radius 30 30 0 0, an 80px `--a-grad-peach` hero with a
/// 64px chip-overlay tile and the icon, `p-6` body; bottom padding = safe area + 94.
Future<T?> showPeachSheet<T>(BuildContext context, {required AIconData icon, required WidgetBuilder builder}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'sheet',
    barrierColor: const Color(0x99000000),
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (ctx, _, _) => Align(
      alignment: Alignment.bottomCenter,
      child: AScope(
        child: Builder(builder: (ctx) {
          final a = ctx.a;
          final bottom = MediaQuery.paddingOf(ctx).bottom;
          return Material(
            type: MaterialType.transparency,
            child: SingleChildScrollView(
              child: Container(
                width: double.infinity,
                clipBehavior: Clip.antiAlias,
                padding: EdgeInsets.only(bottom: (bottom > 0 ? bottom : 20) + 94 + MediaQuery.viewInsetsOf(ctx).bottom),
                decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(30))),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    height: 80,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: a.gradPeach),
                    child: Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(16)),
                      child: AIcon(icon, size: 28, color: a.accentInk),
                    ),
                  ),
                  Padding(padding: const EdgeInsets.all(24), child: builder(ctx)),
                ]),
              ),
            ),
          );
        }),
      ),
    ),
    transitionBuilder: (ctx, anim, _, child) => SlideTransition(
      position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
      child: child,
    ),
  );
}

/// `.a-input` with a large centred value (weight / EFW sheets: height 60, 28/800, radius 18) and a trailing unit.
class PBigInput extends StatelessWidget {
  const PBigInput({super.key, required this.controller, required this.placeholder, required this.unit, this.onChanged, this.decimal = true, this.invalid = false, this.fieldKey});
  final TextEditingController controller;
  final String placeholder;
  final String unit;
  final ValueChanged<String>? onChanged;
  final bool decimal;
  final bool invalid;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(28, weight: FontWeight.w800, color: a.ink, height: 1.2);
    return Stack(alignment: Alignment.center, children: [
      Container(
        height: 60,
        padding: const EdgeInsets.symmetric(horizontal: 40),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: a.lineStrong)),
        child: Material(
          type: MaterialType.transparency,
          child: TextField(
            key: fieldKey,
            controller: controller,
            onChanged: onChanged,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.numberWithOptions(decimal: decimal),
            inputFormatters: decimal ? null : [FilteringTextInputFormatter.digitsOnly],
            style: style,
            cursorColor: a.peach2,
            decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
          ),
        ),
      ),
      PositionedDirectional(end: 16, child: Text(unit, style: context.aText.aListValue.copyWith(color: a.inkSoft))),
    ]);
  }
}

/// Pick-a-date field (`<input type="date" class="a-input a-date-input">`), value `YYYY-MM-DD`.
class PDateInput extends StatelessWidget {
  const PDateInput({super.key, required this.value, required this.onChanged, this.max, this.fieldKey, this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 10), this.fontSize = 13});
  final String value;
  final ValueChanged<String> onChanged;
  final DateTime? max;
  final Key? fieldKey;
  final EdgeInsets padding;
  final double fontSize;

  static String _two(int v) => v.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final parsed = DateTime.tryParse(value);
    final shown = parsed == null ? 'dd.mm.yyyy' : '${_two(parsed.day)}.${_two(parsed.month)}.${parsed.year}';
    return GestureDetector(
      key: fieldKey,
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final now = DateTime.now();
        final last = max ?? DateTime(now.year + 2, 12, 31);
        final init = parsed ?? now;
        final picked = await showDatePicker(
          context: context,
          initialDate: init.isAfter(last) ? last : init,
          firstDate: DateTime(1990),
          lastDate: last,
        );
        if (picked != null) onChanged('${picked.year}-${_two(picked.month)}-${_two(picked.day)}');
      },
      child: Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
        child: Text(shown, style: px(fontSize, color: parsed == null ? a.inkFaint : a.ink)),
      ),
    );
  }
}

/// `.a-list-sub` with `white-space: normal` (wrapping) — the default `.a-list-sub` keeps one line in CSS only where
/// the TSX says so.
TextStyle listSub(BuildContext context) => context.aText.aListSub;
