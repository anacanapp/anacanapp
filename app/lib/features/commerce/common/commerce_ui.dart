// Ported from: src/styles/anacan-design.css (.a3-topbar, .a3-icon-btn(.solid), .a3-count, .a3-card, .a3-pad,
//              .a3-chip(.ac/.ok/.bad), .a3-ico-sq(.sm, .c-*), .a3-rail, .a3-search, .a3-empty, .a3-li, .a-btn-soft,
//              .a-btn-solid, .a-shell), src/components/anacan/Mascot.tsx
//
// Small shared pieces of the commerce screens (Aptek, QayğıCash, cakes, partner shop, partners).
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart' show TextInputAction, TextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show InputBorder, InputDecoration, Material, MaterialType, TextField;

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../onboarding/onboarding_companion.dart' show companionAsset;

const List<FontFeature> tabularFigures = [FontFeature.tabularFigures()];

/// Origin relative image paths (`/olivia/x.webp`, `/partners/olivia/logo.png`) are served from (the WebView
/// resolved them against its own origin, `https://app.anacan.az`).
const String kCommerceAssetOrigin = 'https://app.anacan.az';

/// Absolute URL of an image `src` as the WebView resolved it.
String resolveImageUrl(String src) {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  if (src.startsWith('//')) return 'https:$src';
  return '$kCommerceAssetOrigin${src.startsWith('/') ? '' : '/'}$src';
}

typedef CommerceImageBuilder = Widget Function(BuildContext context, String src, BoxFit fit);

/// `<img src alt="" />` of the commerce screens (tests override it with a placeholder).
final commerceImageProvider = Provider<CommerceImageBuilder>(
  (ref) =>
      (context, src, fit) => CachedNetworkImage(
        imageUrl: resolveImageUrl(src),
        fit: fit,
        fadeInDuration: Duration.zero,
        errorWidget: (_, _, _) => const SizedBox.shrink(),
        placeholder: (_, _) => const SizedBox.shrink(),
      ),
);

/// Image through [commerceImageProvider].
class CommerceImage extends ConsumerWidget {
  const CommerceImage(this.src, {super.key, this.fit = BoxFit.cover, this.width, this.height});
  final String src;
  final BoxFit fit;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final image = ref.watch(commerceImageProvider)(context, src, fit);
    return width == null && height == null ? image : SizedBox(width: width, height: height, child: image);
  }
}

/// `<Mascot stage pose width />`.
class CommerceMascot extends StatelessWidget {
  const CommerceMascot({super.key, required this.stage, this.pose = 'mode', this.width = 120});
  final String stage;
  final String pose;
  final double width;

  @override
  Widget build(BuildContext context) {
    final s = stage == 'flow' || stage == 'bump' || stage == 'mommy' ? stage : 'mommy';
    return ExcludeSemantics(
      child: Image.asset(
        companionAsset(s, pose),
        width: width,
        errorBuilder: (_, _, _) => SizedBox(width: width),
      ),
    );
  }
}

/// `.a3-icon-btn` (44 round, transparent; `.solid`: surface + card shadow) with an optional `.a3-count` badge.
class A3IconButton extends StatelessWidget {
  const A3IconButton({super.key, required this.icon, required this.onTap, this.label, this.solid = false, this.count, this.buttonKey});
  final AIconData icon;
  final VoidCallback onTap;
  final String? label;
  final bool solid;
  final int? count;
  final Key? buttonKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: label,
      child: PressScale.css(
        key: buttonKey,
        scale: 0.94,
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(shape: BoxShape.circle, color: solid ? a.surface : null, boxShadow: solid ? a.cardShadow : null),
                  child: Center(
                    child: AIcon(icon, size: 18, color: a.ink, mirrorInRtl: icon == AIcons.arrowLeft),
                  ),
                ),
              ),
              if (count != null && count! > 0)
                PositionedDirectional(
                  top: 4,
                  end: 2,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 18),
                    height: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: a.coralStrong,
                      borderRadius: BorderRadius.circular(9),
                      boxShadow: [BoxShadow(color: a.bg, spreadRadius: 2)],
                    ),
                    child: Text(count! > 99 ? '99+' : '$count', style: context.aText.a3Count.copyWith(fontFeatures: tabularFigures, height: 1)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `.a3-topbar`: back button, 22px page title, optional actions (min-height 60, padding 12 0 6).
class A3TopBar extends StatelessWidget {
  const A3TopBar({super.key, required this.title, required this.onBack, this.actions = const [], this.titleKey});
  final String title;
  final VoidCallback onBack;
  final List<Widget> actions;
  final Key? titleKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 60),
      child: Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: Row(
          children: [
            A3IconButton(icon: AIcons.arrowLeft, onTap: onBack, label: tr('common_back', 'Geri')),
            const SizedBox(width: 2),
            Expanded(
              child: Text(
                title,
                key: titleKey,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.03 * 22, color: a.ink, height: 1.3),
              ),
            ),
            for (final w in actions) ...[const SizedBox(width: 2), w],
          ],
        ),
      ),
    );
  }
}

/// `.a3-card` (+ `.a3-pad`: padding 16, column gap 10).
class A3Card extends StatelessWidget {
  const A3Card({super.key, required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
      child: child,
    );
  }
}

/// `.a3-chip` (`ac` / `ok` / `bad` / `warn` tones).
class A3Chip extends StatelessWidget {
  const A3Chip(this.text, {super.key, this.tone});
  final String text;
  final String? tone;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Color bg, Color fg) = switch (tone) {
      'ac' => (a.coralSoft, a.accentInk),
      'ok' => (a.green1, a.greenInk),
      'warn' => (a.yellow1, a.yellowInk),
      'bad' => (a.peach1, a.bad),
      _ => (a.surfaceSoft, a.inkSoft),
    };
    return Container(
      constraints: const BoxConstraints(minHeight: 24),
      padding: const EdgeInsets.symmetric(horizontal: 9),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        text,
        maxLines: 1,
        style: context.aText.a3Chip.copyWith(color: fg, fontFeatures: tabularFigures),
      ),
    );
  }
}

/// `.a3-ico-sq` tones (`c-peach`, `c-green`, …).
(Color, Color) toneColors(BuildContext context, String tone) {
  final a = context.a;
  return switch (tone) {
    'c-pink' => (a.pink1, a.pinkInk),
    'c-lav' => (a.lav1, a.lavInk),
    'c-blue' => (a.blue1, a.blueInk),
    'c-green' => (a.green1, a.greenInk),
    'c-yellow' => (a.yellow1, a.yellowInk),
    _ => (a.peach1, a.peachInk),
  };
}

/// `.a3-ico-sq` (40, radius 13; `.sm` 34 / 11).
class A3IcoSq extends StatelessWidget {
  const A3IcoSq({super.key, required this.tone, required this.child, this.small = true, this.padding = EdgeInsets.zero});
  final String tone;
  final Widget child;
  final bool small;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(context, tone);
    final size = small ? 34.0 : 40.0;
    return Container(
      width: size,
      height: size,
      padding: padding,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(small ? 11 : 13)),
      child: IconTheme.merge(
        data: IconThemeData(color: fg),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: fg),
          child: child,
        ),
      ),
    );
  }
}

/// `.a3-rail`: horizontal scroller bleeding into the 20px page gutter (gap 10, padding 2 20 10).
class A3Rail extends StatelessWidget {
  const A3Rail({super.key, required this.children, this.gutter = 20, this.gap = 10});
  final List<Widget> children;
  final double gutter;
  final double gap;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) => Transform.translate(
      offset: Offset(Directionality.of(context) == TextDirection.rtl ? gutter : -gutter, 0),
      child: SizedBox(
        width: c.maxWidth + gutter * 2,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.fromLTRB(gutter, 2, gutter, 10),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(width: gap), children[i]],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

/// `.a-btn-soft` / `.a-btn-solid` pill (padding 10 16, 12/700).
class APillButton extends StatelessWidget {
  const APillButton({super.key, required this.label, required this.onTap, this.solid = false, this.minHeight});
  final String label;
  final VoidCallback? onTap;
  final bool solid;
  final double? minHeight;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return PressScale.css(
      onTap: onTap,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight ?? 0),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: solid ? a.peach2 : a.peach1, borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: context.aText.aPillBtn.copyWith(color: solid ? const Color(0xFFFFFFFF) : a.accentInk)),
      ),
    );
  }
}

/// Horizontal rule between list rows (`.a3-list > * + *`).
class A3Divided extends StatelessWidget {
  const A3Divided({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < children.length; i++)
          if (i == 0)
            children[i]
          else
            DecoratedBox(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: a.line)),
              ),
              child: children[i],
            ),
      ],
    );
  }
}

/// Minimal borderless text field (`<input>`) used by the commerce search boxes.
class EditableTextField extends StatefulWidget {
  const EditableTextField({
    super.key,
    required this.controller,
    this.placeholder,
    this.onChanged,
    this.onSubmitted,
    this.style,
    this.fieldKey,
    this.keyboardType,
  });
  final TextEditingController controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextStyle? style;
  final Key? fieldKey;
  final TextInputType? keyboardType;

  @override
  State<EditableTextField> createState() => _EditableTextFieldState();
}

class _EditableTextFieldState extends State<EditableTextField> {
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final style = widget.style ?? TextStyle(fontSize: 14, color: s.foreground);
    return Stack(
      alignment: AlignmentDirectional.centerStart,
      children: [
        ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) => widget.controller.text.isEmpty && widget.placeholder != null
              ? IgnorePointer(
                  child: Text(
                    widget.placeholder!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: style.copyWith(color: s.mutedForeground),
                  ),
                )
              : const SizedBox.shrink(),
        ),
        EditableText(
          key: widget.fieldKey,
          controller: widget.controller,
          focusNode: _focus,
          style: style,
          cursorColor: s.primary,
          backgroundCursorColor: s.muted,
          keyboardType: widget.keyboardType,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
        ),
      ],
    );
  }
}

/// A boxed text input (.ap-field input/textarea, .ck-input, .a3-search input): [radius], [background],
/// 1px [borderColor] ring, 2px [focusColor] ring when focused, [invalidColor] when [invalid].
class CommerceTextField extends StatefulWidget {
  const CommerceTextField({
    super.key,
    required this.controller,
    this.placeholder,
    this.onChanged,
    this.onSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.minLines,
    this.maxLines = 1,
    this.minHeight = 48,
    this.radius = 14,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    this.background,
    this.borderColor,
    this.focusColor,
    this.invalid = false,
    this.invalidColor,
    this.fontSize = 16,
    this.inputFormatters,
    this.fieldKey,
    this.obscure = false,
    this.bare = false,
  });
  final TextEditingController controller;
  final String? placeholder;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final int? minLines;
  final int? maxLines;
  final double minHeight;
  final double radius;
  final EdgeInsetsGeometry padding;
  final Color? background;
  final Color? borderColor;
  final Color? focusColor;
  final bool invalid;
  final Color? invalidColor;
  final double fontSize;
  final List<TextInputFormatter>? inputFormatters;
  final Key? fieldKey;
  final bool obscure;

  /// No box (the field sits inside an existing pill such as .a3-search).
  final bool bare;

  @override
  State<CommerceTextField> createState() => _CommerceTextFieldState();
}

class _CommerceTextFieldState extends State<CommerceTextField> {
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
    final base = TextStyle(fontSize: widget.fontSize, color: a.ink, height: 1.3);
    // Single-line fields are `<input>`s, which keyboard.css lifts to 16px on phones over their class size; the
    // textareas keep their class size (`.ck-input` 15px).
    final style = widget.maxLines == 1 ? phoneInputStyle(context, base) : base;
    final field = Material(
      type: MaterialType.transparency,
      child: TextField(
        key: widget.fieldKey,
        controller: widget.controller,
        focusNode: _focus,
        onChanged: widget.onChanged,
        onSubmitted: widget.onSubmitted,
        keyboardType: widget.keyboardType ?? (widget.maxLines == 1 ? null : TextInputType.multiline),
        textInputAction: widget.textInputAction,
        minLines: widget.minLines,
        maxLines: widget.maxLines,
        obscureText: widget.obscure,
        inputFormatters: widget.inputFormatters,
        style: style,
        cursorColor: a.coralStrong,
        decoration: InputDecoration(
          isCollapsed: true,
          border: InputBorder.none,
          hintText: widget.placeholder,
          hintStyle: style.copyWith(color: a.inkFaint),
        ),
      ),
    );
    if (widget.bare) return field;
    final ring = widget.invalid
        ? (widget.invalidColor ?? a.bad)
        : _focus.hasFocus
        ? (widget.focusColor ?? a.coralStrong)
        : (widget.borderColor ?? a.line);
    final width = widget.invalid || _focus.hasFocus ? 2.0 : 1.0;
    return Container(
      constraints: BoxConstraints(minHeight: widget.minHeight),
      padding: widget.padding,
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(
        color: widget.background ?? a.surface,
        borderRadius: BorderRadius.circular(widget.radius),
        boxShadow: [BoxShadow(color: ring, spreadRadius: width)],
      ),
      child: field,
    );
  }
}
