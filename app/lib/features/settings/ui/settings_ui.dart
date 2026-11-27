// Ported from: src/styles/anacan-design.css (.a-topbar, .a-eyebrow, .a-wordmark, .a-topbar-actions, .a-icon-btn,
//              .a-tag.on, .a-tabs/.a-tab, .a-section-head), src/components/ui/{switch,button,input,dialog,alert-dialog,
//              date-field,select}.tsx (shadcn primitives used by the profile/settings/security/support/legal screens)
//
// Small widget kit shared by the profile, settings, security, support and legal ports. Only the looks these
// screens use; numbers are the CSS/Tailwind values.
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';

/// Tailwind font sizes with their line heights (`text-xs` 12/16 … `text-lg` 18/28).
abstract final class Tw {
  static const TextStyle xs = TextStyle(fontSize: 12, height: 16 / 12);
  static const TextStyle sm = TextStyle(fontSize: 14, height: 20 / 14);
  static const TextStyle base = TextStyle(fontSize: 16, height: 24 / 16);
  static const TextStyle lg = TextStyle(fontSize: 18, height: 28 / 18);
}

/// Inline `style={{ fontSize, fontWeight, color }}` text (inherits the scope font, line-height 1.5).
TextStyle px(double size, {FontWeight weight = FontWeight.w400, Color? color, double height = 1.5, double? ls}) => TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: ls == null ? null : ls * size,
      leadingDistribution: TextLeadingDistribution.even,
    );

/// `.a-icon-btn` (38×38, radius 12, surface, 1px `--a-btn-border`, `0 6px 14px -8px rgba(217,108,74,.35)`) with
/// framer `whileTap={{ scale }}`.
class AIconBtn extends StatelessWidget {
  const AIconBtn({super.key, required this.icon, this.onTap, this.size = 38, this.tapScale = 0.9, this.semanticLabel, this.background, this.foreground, this.border = true, this.radius = 12});
  final Widget icon;
  final VoidCallback? onTap;
  final double size;
  final double tapScale;
  final String? semanticLabel;
  final Color? background;
  final Color? foreground;
  final bool border;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: PressScale(
        scale: tapScale,
        enabled: onTap != null,
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background ?? a.surface,
            borderRadius: BorderRadius.circular(radius),
            border: border ? Border.all(color: a.btnBorder) : null,
            // 0 6px 14px -8px rgba(217, 108, 74, 0.35)
            boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
          ),
          child: IconTheme.merge(data: IconThemeData(color: foreground ?? a.ink), child: icon),
        ),
      ),
    );
  }
}

/// `.a-eyebrow` (upper-cased).
class AEyebrow extends StatelessWidget {
  const AEyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Text(text.toUpperCase(), style: px(11, weight: FontWeight.w700, color: context.a.onBgSoft, ls: 0.1)),
      );
}

/// `.a-wordmark` with an inline font size.
class AWordmark extends StatelessWidget {
  const AWordmark(this.text, {super.key, this.fontSize = 15, this.maxLines});
  final String text;
  final double fontSize;
  final int? maxLines;
  @override
  Widget build(BuildContext context) => Text(text,
      maxLines: maxLines,
      overflow: maxLines == null ? null : TextOverflow.ellipsis,
      style: px(fontSize, weight: FontWeight.w700, color: context.a.onBg, ls: -0.01, height: 1.35));
}

/// `.a-topbar` (flex, space-between, gap 12, min-height 64, padding-block 12 — startup.css overrides the 16/6 of
/// anacan-design.css) with the usual back button (44px min in the top bar) + titles of the sub-screens.
class ATopbar extends StatelessWidget {
  const ATopbar({super.key, this.onBack, this.eyebrow, required this.title, this.titleSize = 16, this.actions = const <Widget>[], this.backScale = 0.95, this.leading});
  final VoidCallback? onBack;
  final String? eyebrow;
  final String title;
  final double titleSize;
  final List<Widget> actions;
  final double backScale;

  /// Replaces the title block (custom headers).
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: <Widget>[
            Expanded(
              child: leading ??
                  Row(children: <Widget>[
                    if (onBack != null) ...<Widget>[
                      AIconBtn(
                        onTap: onBack,
                        tapScale: backScale,
                        size: 44,
                        semanticLabel: tr('common_geri', 'Geri'),
                        icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          if (eyebrow != null) AEyebrow(eyebrow!),
                          AWordmark(title, fontSize: titleSize),
                        ],
                      ),
                    ),
                  ]),
            ),
            if (actions.isNotEmpty) ...<Widget>[const SizedBox(width: 12), Row(mainAxisSize: MainAxisSize.min, children: _gap(actions, 8))],
          ],
        ),
      ),
    );
  }
}

List<Widget> _gap(List<Widget> items, double gap) => <Widget>[
      for (var i = 0; i < items.length; i++) ...<Widget>[if (i > 0) SizedBox(width: gap), items[i]],
    ];

/// Children separated by a fixed vertical gap (Tailwind `space-y-*`).
class VGap extends StatelessWidget {
  const VGap({super.key, required this.gap, required this.children, this.crossAxisAlignment = CrossAxisAlignment.stretch});
  final double gap;
  final List<Widget> children;
  final CrossAxisAlignment crossAxisAlignment;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: crossAxisAlignment,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (var i = 0; i < children.length; i++) ...<Widget>[if (i > 0) SizedBox(height: gap), children[i]],
        ],
      );
}

/// `.a-tag.on` badge with the inline `padding: 4px 9px; fontSize: 10`.
class ATagOn extends StatelessWidget {
  const ATagOn(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: a.tagOnBg, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.peach2)),
      child: Text(text, style: px(10, weight: FontWeight.w600, color: a.accentInk)),
    );
  }
}

/// shadcn `<Switch>` (h-6 w-11, thumb 20, border-2 transparent) with the `data-[state=checked]:bg-[…]` colour.
class ShadSwitch extends StatelessWidget {
  const ShadSwitch({super.key, required this.checked, required this.onChanged, this.checkedColor, this.disabled = false, this.semanticLabel});
  final bool checked;
  final ValueChanged<bool>? onChanged;
  final Color? checkedColor;
  final bool disabled;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final on = checkedColor ?? t.shadcn.primary;
    final enabled = !disabled && onChanged != null;
    Widget body = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: ACurves.tailwind,
      width: 44,
      height: 24,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: checked ? on : t.shadcn.input, borderRadius: BorderRadius.circular(999)),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 150),
        curve: ACurves.tailwind,
        alignment: checked ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: t.shadcn.background,
            shape: BoxShape.circle,
            // shadow-lg
            boxShadow: const <BoxShadow>[
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
            ],
          ),
        ),
      ),
    );
    if (!enabled) body = Opacity(opacity: disabled ? 0.5 : 1, child: body);
    return Semantics(
      toggled: checked,
      enabled: enabled,
      label: semanticLabel,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: enabled ? () => onChanged!(!checked) : null, child: body),
    );
  }
}

enum ShadButtonVariant { primary, destructive, outline, secondary, ghost }

/// shadcn `<Button>` (h-10 px-4, text-sm 500, rounded-md unless [pill]).
class ShadButton extends StatelessWidget {
  const ShadButton({super.key, required this.child, this.onPressed, this.variant = ShadButtonVariant.primary, this.pill = false, this.expand = false, this.icon = false, this.height = 40, this.background, this.foreground});
  final Widget child;
  final VoidCallback? onPressed;
  final ShadButtonVariant variant;
  final bool pill;
  final bool expand;

  /// `size="icon"` (40×40).
  final bool icon;
  final double height;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final (Color bg, Color fg, Border? border) = switch (variant) {
      ShadButtonVariant.primary => (s.primary, s.primaryForeground, null),
      ShadButtonVariant.destructive => (s.destructive, s.destructiveForeground, null),
      ShadButtonVariant.outline => (s.background, s.foreground, Border.all(color: s.input)),
      ShadButtonVariant.secondary => (s.secondary, s.secondaryForeground, null),
      ShadButtonVariant.ghost => (const Color(0x00000000), s.foreground, null),
    };
    final disabled = onPressed == null;
    Widget body = Container(
      height: height,
      width: icon ? height : null,
      padding: icon ? null : const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: background ?? bg, borderRadius: BorderRadius.circular(pill ? 999 : 6), border: border),
      child: DefaultTextStyle.merge(
        style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: foreground ?? fg),
        child: IconTheme.merge(
          data: IconThemeData(color: foreground ?? fg, size: 16),
          child: Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[Flexible(child: child)]),
        ),
      ),
    );
    if (disabled) body = Opacity(opacity: 0.5, child: body);
    return Semantics(button: true, enabled: !disabled, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onPressed, child: body));
  }
}

/// shadcn `<Input>` (h-10, rounded-md, 1px `--input`, px-3, text-base) with inline overrides.
class ShadInput extends StatelessWidget {
  const ShadInput({
    super.key,
    this.controller,
    this.placeholder,
    this.onChanged,
    this.height = 40,
    this.radius = 6,
    this.background,
    this.borderColor,
    this.textColor,
    this.enabled = true,
    this.keyboardType,
    this.maxLines = 1,
    this.textAlign = TextAlign.start,
    this.style,
    this.inputFormatters,
    this.fieldKey,
    this.autofocus = false,
  });
  final TextEditingController? controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final double? height;
  final double radius;
  final Color? background;
  final Color? borderColor;
  final Color? textColor;
  final bool enabled;
  final TextInputType? keyboardType;
  final int? maxLines;
  final TextAlign textAlign;
  final TextStyle? style;
  final List<TextInputFormatter>? inputFormatters;
  final Key? fieldKey;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final base = DefaultTextStyle.of(context).style.merge(Tw.base).copyWith(color: textColor ?? s.foreground).merge(style);
    final field = TextField(
      key: fieldKey,
      controller: controller,
      onChanged: onChanged,
      enabled: enabled,
      autofocus: autofocus,
      keyboardType: keyboardType,
      maxLines: maxLines,
      minLines: maxLines == null ? 3 : null,
      textAlign: textAlign,
      inputFormatters: inputFormatters,
      style: base,
      cursorColor: s.primary,
      decoration: InputDecoration(
        isCollapsed: true,
        border: InputBorder.none,
        hintText: placeholder,
        hintStyle: base.copyWith(color: s.mutedForeground),
      ),
    );
    Widget box = Container(
      height: maxLines == 1 ? height : null,
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: maxLines == 1 ? 0 : 8),
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(
        color: background ?? s.background,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? s.input),
      ),
      child: field,
    );
    if (!enabled) box = Opacity(opacity: 0.5, child: box);
    return Material(type: MaterialType.transparency, child: box);
  }
}

/// `animate-spin` ring (`border: 3px solid <c>; border-top-color: transparent`).
class ARingSpinner extends StatefulWidget {
  const ARingSpinner({super.key, this.size = 32, this.color, this.width = 3});
  final double size;
  final Color? color;
  final double width;
  @override
  State<ARingSpinner> createState() => _ARingSpinnerState();
}

class _ARingSpinnerState extends State<ARingSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void initState() {
    super.initState();
    if (!_disabled) _c.repeat();
  }

  bool get _disabled => WidgetsBinding.instance.platformDispatcher.accessibilityFeatures.disableAnimations;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(size: Size.square(widget.size), painter: _RingPainter(widget.color ?? context.a.peach2, widget.width)),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.color, this.width);
  final Color color;
  final double width;
  @override
  void paint(Canvas canvas, Size size) {
    final r = (Offset.zero & size).deflate(width / 2);
    // three visible quarter-borders (top transparent)
    canvas.drawArc(r, -0.75 * 3.14159265, 1.5 * 3.14159265, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color || old.width != width;
}

/// lucide `Loader2` + `animate-spin`.
class ALoader extends StatefulWidget {
  const ALoader({super.key, this.size = 16, this.color});
  final double size;
  final Color? color;
  @override
  State<ALoader> createState() => _ALoaderState();
}

class _ALoaderState extends State<ALoader> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  @override
  void initState() {
    super.initState();
    if (!WidgetsBinding.instance.platformDispatcher.accessibilityFeatures.disableAnimations) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RotationTransition(turns: _c, child: AIcon(AIcons.loaderCircle, size: widget.size, color: widget.color));
}

/// Radix Dialog / AlertDialog content (overlay `bg-black/80`, `max-w-lg`, `p-6`, `gap-4`, border, shadow-lg,
/// background; [radius] for the `rounded-[22px]` callers; `mx-4` adds a 16px inset).
class ShadDialogFrame extends StatelessWidget {
  const ShadDialogFrame({super.key, required this.children, this.radius = 0, this.maxWidth = 512, this.scope = true, this.inset = 0});
  final List<Widget> children;
  final double radius;
  final double maxWidth;
  final bool scope;
  final double inset;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    Widget body = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      margin: EdgeInsets.symmetric(horizontal: inset),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: s.background,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: s.border),
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
        ],
      ),
      child: VGap(gap: 16, children: children),
    );
    if (scope) body = AScope(child: body);
    return Material(type: MaterialType.transparency, child: body);
  }
}

/// Opens a centered Radix dialog (fade + zoom 95, 200 ms). Tapping the overlay closes it when [barrierDismissible].
Future<T?> showShadDialog<T>(BuildContext context, {required WidgetBuilder builder, bool barrierDismissible = true}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: 'dialog',
    barrierColor: const Color(0xCC000000),
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => Center(child: SingleChildScrollView(child: builder(ctx))),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(anim), child: child),
    ),
  );
}

/// shadcn DialogTitle / AlertDialogTitle (`text-lg font-semibold`).
TextStyle shadTitle(BuildContext context) => Tw.lg.copyWith(fontWeight: FontWeight.w600, color: context.tokens.shadcn.foreground);

/// shadcn Description (`text-sm text-muted-foreground`).
TextStyle shadDescription(BuildContext context) => Tw.sm.copyWith(color: context.tokens.shadcn.mutedForeground);

/// `<DateField>`: shadcn input showing `yyyy-mm-dd` values in the platform date format, `dd/mm/yyyy` placeholder
/// in `--a-ink-faint` when empty; opens the date picker.
class DateFieldBox extends StatelessWidget {
  const DateFieldBox({super.key, required this.value, required this.onChanged, this.max, this.height = 44, this.radius = 12, this.background, this.borderColor, this.textColor, this.placeholder = 'dd/mm/yyyy', this.fieldKey});
  final String value;
  final ValueChanged<String> onChanged;
  final DateTime? max;
  final double height;
  final double radius;
  final Color? background;
  final Color? borderColor;
  final Color? textColor;
  final String placeholder;
  final Key? fieldKey;

  static String _two(int v) => v.toString().padLeft(2, '0');
  static String keyOf(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final parsed = DateTime.tryParse(value);
    final shown = parsed == null ? null : '${_two(parsed.day)}.${_two(parsed.month)}.${parsed.year}';
    return GestureDetector(
      key: fieldKey,
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final now = DateTime.now();
        final last = max ?? DateTime(now.year + 2, 12, 31);
        final init = parsed ?? (now.isAfter(last) ? last : now);
        final picked = await showDatePicker(context: context, initialDate: init.isAfter(last) ? last : init, firstDate: DateTime(1990), lastDate: last);
        if (picked != null) onChanged(keyOf(picked));
      },
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: AlignmentDirectional.centerStart,
        decoration: BoxDecoration(
          color: background ?? s.background,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: borderColor ?? s.input),
        ),
        child: Text(shown ?? placeholder, style: Tw.sm.copyWith(color: shown == null ? context.a.inkFaint : (textColor ?? s.foreground))),
      ),
    );
  }
}

/// shadcn `<Select>` trigger (h-10 rounded-md border px-3, value + chevron-down) that opens the options as a
/// popup list (`SelectContent`, max-h 300).
class ShadSelect<T> extends StatelessWidget {
  const ShadSelect({super.key, required this.value, required this.options, required this.onChanged, this.placeholder, this.height = 44, this.radius = 12, this.background, this.borderColor, this.textColor, this.fieldKey});
  final T? value;
  final List<(T, Widget)> options;
  final ValueChanged<T> onChanged;
  final String? placeholder;
  final double height;
  final double radius;
  final Color? background;
  final Color? borderColor;
  final Color? textColor;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final selected = options.where((o) => o.$1 == value).firstOrNull;
    return GestureDetector(
      key: fieldKey,
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final picked = await showShadDialog<T>(
          context,
          builder: (ctx) => Container(
            constraints: const BoxConstraints(maxHeight: 300, maxWidth: 360),
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: s.popover, borderRadius: BorderRadius.circular(6), border: Border.all(color: s.border)),
            child: AScope(
              child: Material(
                type: MaterialType.transparency,
                child: ListView(shrinkWrap: true, children: <Widget>[
                  for (final o in options)
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => Navigator.of(ctx).pop(o.$1),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(32, 6, 8, 6),
                        child: Stack(clipBehavior: Clip.none, children: <Widget>[
                          if (o.$1 == value) const PositionedDirectional(start: -24, top: 2, child: AIcon(AIcons.check, size: 16)),
                          DefaultTextStyle.merge(style: Tw.sm.copyWith(color: s.popoverForeground), child: o.$2),
                        ]),
                      ),
                    ),
                ]),
              ),
            ),
          ),
        );
        if (picked != null) onChanged(picked);
      },
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: background ?? s.background, borderRadius: BorderRadius.circular(radius), border: Border.all(color: borderColor ?? s.input)),
        child: Row(children: <Widget>[
          Expanded(
            child: DefaultTextStyle.merge(
              style: Tw.sm.copyWith(color: selected == null ? s.mutedForeground : (textColor ?? s.foreground)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              child: selected?.$2 ?? Text(placeholder ?? ''),
            ),
          ),
          Opacity(opacity: 0.5, child: AIcon(AIcons.chevronDown, size: 16, color: textColor ?? s.foreground)),
        ]),
      ),
    );
  }
}

/// The toast controller of the nearest [AToastHost] (sonner `toast.*` and shadcn `useToast().toast`).
AToastController toasts(BuildContext context) => AToastHost.of(context);

/// `{ background: var(--a-disclaimer-bg); border: 1px solid var(--a-disclaimer-border); radius: --a-radius-md;
/// padding: 16 }` info box with centred 12.5px text.
class ADisclaimerBox extends StatelessWidget {
  const ADisclaimerBox({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(a.radiusMd)),
      child: DefaultTextStyle.merge(style: px(12.5, color: a.disclaimerInk), textAlign: TextAlign.center, child: child),
    );
  }
}

/// framer `initial={{ y, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}` with the default
/// tween (300 ms `[0.25, 0.1, 0.35, 1]` for opacity; y uses the same tween here). Skipped under reduced motion.
class FadeRise extends StatefulWidget {
  const FadeRise({super.key, required this.child, this.dy = 20, this.dx = 0, this.delay = Duration.zero, this.scaleFrom});
  final Widget child;
  final double dy;
  final double dx;
  final Duration delay;
  final double? scaleFrom;
  @override
  State<FadeRise> createState() => _FadeRiseState();
}

class _FadeRiseState extends State<FadeRise> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: ACurves.framerDefault);
  bool _started = false;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return AnimatedBuilder(
      animation: _t,
      builder: (context, child) {
        final v = _t.value;
        Widget w = Transform.translate(offset: Offset((rtl ? -widget.dx : widget.dx) * (1 - v), widget.dy * (1 - v)), child: child);
        if (widget.scaleFrom != null) w = Transform.scale(scale: widget.scaleFrom! + (1 - widget.scaleFrom!) * v, child: w);
        return Opacity(opacity: v.clamp(0, 1), child: w);
      },
      child: widget.child,
    );
  }
}

/// `.a-sky` watercolor backdrop (330px, radial gradients) with `.a-cloud.c1…` (blur 13, drift 12s ease-in-out
/// infinite, skipped in lite mode / reduced motion).
class ASky extends StatefulWidget {
  const ASky({super.key, this.clouds = 3});

  /// How many of c1…c3 to render.
  final int clouds;
  @override
  State<ASky> createState() => _ASkyState();
}

class _ASkyState extends State<ASky> with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(vsync: this, duration: const Duration(seconds: 12));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_drift.isAnimating) _drift.repeat();
    } else {
      _drift.stop();
    }
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = context.tokens.isDark;
    // (width, height, top, insetStart?, insetEnd?, opacity, delay s)
    const clouds = <(double, double, double, double?, double?, double, double)>[
      (160, 48, 34, -34, null, 1, 0),
      (120, 38, 84, null, -22, 0.9, 2.6),
      (92, 30, 156, null, null, 0.7, 5.2), // inset-inline-start: 12%
    ];
    return IgnorePointer(
      child: SizedBox(
        height: 330,
        child: LayoutBuilder(builder: (context, c) {
          final w = c.maxWidth;
          return Stack(clipBehavior: Clip.hardEdge, children: <Widget>[
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0, -1.6), // 50% -30%
                    radius: 1.1,
                    colors: dark
                        ? const <Color>[Color(0x29F69E7E), Color(0x1AF9BBA2), Color(0x00201512)]
                        : const <Color>[Color(0x80F69E7E), Color(0x61F9BBA2), Color(0x00FFE7E1)],
                    stops: const <double>[0, 0.42, 0.78],
                  ),
                ),
              ),
            ),
            for (var i = 0; i < widget.clouds && i < clouds.length; i++)
              AnimatedBuilder(
                animation: _drift,
                builder: (context, child) {
                  final cl = clouds[i];
                  final period = (_drift.value * 12 - cl.$7) / 12;
                  final p = (1 - math.cos(2 * math.pi * period)) / 2; // ease-in-out 0→1→0
                  return PositionedDirectional(
                    top: cl.$3,
                    start: cl.$4 ?? (i == 2 ? w * 0.12 : null),
                    end: cl.$5,
                    child: Transform.translate(offset: Offset(16 * p, -7 * p), child: child),
                  );
                },
                child: Opacity(
                  opacity: clouds[i].$6,
                  child: ImageFiltered(
                    imageFilter: ImageFilter.blur(sigmaX: 6.5, sigmaY: 6.5),
                    child: Container(
                      width: clouds[i].$1,
                      height: clouds[i].$2,
                      decoration: BoxDecoration(
                        color: dark ? const Color(0x12FFFFFF) : const Color(0xD9FFFFFF),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ),
          ]);
        }),
      ),
    );
  }
}

/// `.a-input` (padding 10 14, radius 12, 1px `--a-line-strong`, surface, 13px, focus `--a-peach-2`).
class AInput extends StatefulWidget {
  const AInput({super.key, this.controller, this.placeholder, this.onChanged, this.height, this.style, this.textAlign = TextAlign.start, this.inputFormatters, this.fieldKey, this.obscure = false, this.keyboardType});
  final TextEditingController? controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final double? height;
  final TextStyle? style;
  final TextAlign textAlign;
  final List<TextInputFormatter>? inputFormatters;
  final Key? fieldKey;
  final bool obscure;
  final TextInputType? keyboardType;
  @override
  State<AInput> createState() => _AInputState();
}

class _AInputState extends State<AInput> {
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
    final style = DefaultTextStyle.of(context).style.merge(px(13, color: a.ink)).merge(widget.style);
    return Material(
      type: MaterialType.transparency,
      child: Container(
        height: widget.height,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        alignment: AlignmentDirectional.centerStart,
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: _focus.hasFocus ? a.peach2 : a.lineStrong)),
        child: TextField(
          key: widget.fieldKey,
          controller: widget.controller,
          focusNode: _focus,
          onChanged: widget.onChanged,
          obscureText: widget.obscure,
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

/// `.a-today-info-eyebrow` (10.5/800, 0.1em, upper-case, `--a-ink-soft`).
TextStyle todayInfoEyebrow(BuildContext context) => px(10.5, weight: FontWeight.w800, color: context.a.inkSoft, ls: 0.1);
