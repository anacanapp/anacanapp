// Ported from: src/components/ui/dialog.tsx (DialogContent: fixed centre, max-w-lg, grid gap-4, p-6, border,
//              shadow-lg, black/80 overlay, fade + zoom 95, close ✕ top-4 end-4 opacity-70) with the tools'
//              `a-scope rounded-[26px] max-h-[85vh|90vh] overflow-y-auto` / `p-0` / `max-w-md|sm` classes, the empty
//              state box `rounded-[26px] p-8 text-center` with `border: 2px dashed var(--a-line-strong)` of
//              SecondHandMarket.tsx / MomFriendlyMap.tsx, framer `motion.button whileTap={{ scale }}`
//
// Look primitives shared by the second-hand market, the mom-friendly places, the smart play box and the affiliate
// products (phase 4, "more tools").
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;

/// Radix `<Dialog>` with the tools' DialogContent classes. [padded] false = `p-0` (the content draws its own hero);
/// [maxWidth] 448 = `max-w-md`, 384 = `max-w-sm`, 512 = shadcn default `max-w-lg`. Children of the content are
/// spaced by the caller (DialogContent is a `grid gap-4`).
Future<T?> showMoreDialog<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool padded = true,
  bool showClose = true,
  double maxWidth = 512,
  double maxHeightFactor = 0.9,
  bool dismissible = true,
  Key? key,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: dismissible,
    barrierLabel: 'dialog',
    barrierColor: const Color(0xCC000000),
    transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => MoreDialogFrame(
      key: key,
      padded: padded,
      showClose: showClose,
      maxWidth: maxWidth,
      maxHeightFactor: maxHeightFactor,
      child: Builder(builder: builder),
    ),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(anim), child: child),
    ),
  );
}

class MoreDialogFrame extends StatelessWidget {
  const MoreDialogFrame({super.key, required this.child, this.padded = true, this.showClose = true, this.maxWidth = 512, this.maxHeightFactor = 0.9});
  final Widget child;
  final bool padded;
  final bool showClose;
  final double maxWidth;
  final double maxHeightFactor;

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
                constraints: BoxConstraints(maxWidth: maxWidth, maxHeight: mq.size.height * maxHeightFactor),
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: a.line),
                  boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(children: [
                  SingleChildScrollView(padding: padded ? const EdgeInsets.all(24) : EdgeInsets.zero, child: child),
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

/// `DialogHeader` with `DialogTitle className="flex items-center gap-2 a-heading"` (icon + title) and an optional
/// `DialogDescription` (18/600 heading in `--a-ink`, 24 clear of the close ✕; description text-sm muted, 6 below).
class MoreDialogHeader extends StatelessWidget {
  const MoreDialogHeader({super.key, required this.title, this.icon, this.description, this.titleWidget});
  final String title;
  final Widget? icon;
  final String? description;

  /// Replaces the title text (e.g. a truncated name).
  final Widget? titleWidget;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = context.aText.heading(px(18, weight: FontWeight.w600, color: a.ink, height: 28 / 18));
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          if (icon != null) ...[icon!, const SizedBox(width: 8)],
          Flexible(child: DefaultTextStyle.merge(style: style, child: titleWidget ?? Text(title, style: style))),
        ]),
        if (description != null)
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(description!, style: px(14, color: context.tokens.shadcn.mutedForeground, height: 20 / 14))),
      ]),
    );
  }
}

/// `rounded-[26px] p-8 text-center` on `--a-surface` with a `2px dashed var(--a-line-strong)` border: a 64px
/// gradient tile with an icon, the title, the text and an optional action.
class DashedEmptyCard extends StatelessWidget {
  const DashedEmptyCard({super.key, required this.gradient, required this.icon, required this.title, this.text, this.action});
  final Gradient gradient;
  final Widget icon;
  final String title;
  final String? text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return CustomPaint(
      painter: _DashedRRect(color: a.lineStrong, fill: a.surface, radius: 26),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64,
            height: 64,
            margin: const EdgeInsets.only(bottom: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(16)),
            child: icon,
          ),
          Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(title, textAlign: TextAlign.center, style: x.aListTitle)),
          if (text != null) Padding(padding: EdgeInsets.only(bottom: action != null ? 16 : 0), child: Text(text!, textAlign: TextAlign.center, style: x.aListSub)),
          ?action,
        ]),
      ),
    );
  }
}

/// A `2px dashed` rounded rectangle (Chromium dash pattern: 6 on / 6 off for a 2px border).
class _DashedRRect extends CustomPainter {
  _DashedRRect({required this.color, required this.fill, required this.radius});
  final Color color;
  final Color fill;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(1);
    canvas.drawRRect(rrect, Paint()..color = fill);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final path = Path()..addRRect(rrect);
    for (final metric in path.computeMetrics()) {
      for (double d = 0; d < metric.length; d += 12) {
        canvas.drawPath(metric.extractPath(d, (d + 6).clamp(0, metric.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRect old) => old.color != color || old.fill != fill || old.radius != radius;
}

/// `text-sm font-bold mb-1.5 block` field label (14/700 ink, 6 below).
class MoreFieldLabel extends StatelessWidget {
  const MoreFieldLabel(this.text, {super.key, this.bottom = 6});
  final String text;
  final double bottom;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: EdgeInsets.only(bottom: bottom), child: Text(text, style: px(14, weight: FontWeight.w700, color: context.a.ink, height: 20 / 14)));
}

/// A pill chip button (`px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5`) with inline colours,
/// an optional border and gradient, `whileTap={{ scale: 0.95 }}`.
class MorePillChip extends StatelessWidget {
  const MorePillChip({
    super.key,
    required this.children,
    required this.onTap,
    this.background,
    this.gradient,
    this.color,
    this.borderColor,
    this.shadow,
    this.padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    this.fontSize = 14,
    this.weight = FontWeight.w600,
    this.gap = 6,
    this.selected,
    this.semanticLabel,
  });
  final List<Widget> children;
  final VoidCallback? onTap;
  final Color? background;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final List<BoxShadow>? shadow;
  final EdgeInsets padding;
  final double fontSize;
  final FontWeight weight;
  final double gap;
  final bool? selected;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final fg = color ?? context.a.ink;
    return Semantics(
      button: true,
      selected: selected,
      enabled: onTap != null,
      label: semanticLabel,
      child: PressScale(
        scale: 0.95,
        enabled: onTap != null,
        onTap: onTap,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: gradient == null ? background : null,
            gradient: gradient,
            borderRadius: BorderRadius.circular(999),
            border: borderColor == null ? null : Border.all(color: borderColor!),
            boxShadow: shadow,
          ),
          child: DefaultTextStyle.merge(
            style: px(fontSize, weight: weight, color: fg, height: 20 / 14),
            child: IconTheme.merge(
              data: IconThemeData(color: fg),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                // A label longer than the line wraps inside the pill (a shrinking flex item in CSS).
                for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(width: gap), children[i] is Text ? Flexible(child: children[i]) : children[i]],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
