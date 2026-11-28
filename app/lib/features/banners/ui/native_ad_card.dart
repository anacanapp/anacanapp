// Ported from: src/components/banners/NativeAdCard.tsx, src/styles/native-ads.css
//
// anacan-brand-ads-v3 native templates (classic, spotlight, split, minimal, offer, expert). Holds no literal UI
// copy: the sponsor and code labels come from the caller. Only safe http(s) images are drawn. No blur and no
// infinite animation (low-end devices).
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../brand_ads.dart';
import '../brand_targeting.dart';

/// The creative fields the card reads (`NativeAdContent`).
class NativeAdContent {
  const NativeAdContent({
    required this.title,
    this.description,
    this.buttonText,
    this.imageUrl,
    this.backgroundColor,
    this.textColor,
    this.nativeTemplate,
    this.creativeOptions = const {},
    this.linkType,
    this.sponsorLogo,
  });
  final String title;
  final String? description;
  final String? buttonText;
  final String? imageUrl;
  final String? backgroundColor;
  final String? textColor;
  final String? nativeTemplate;
  final Map<String, dynamic> creativeOptions;
  final String? linkType;
  final String? sponsorLogo;
}

final RegExp _hex = RegExp(r'^#[0-9a-f]{6}$', caseSensitive: false);

double _luminance(String hex) {
  double channel(int offset) {
    final value = int.parse(hex.substring(offset, offset + 2), radix: 16) / 255;
    return value <= 0.03928 ? value / 12.92 : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

double contrastRatio(String a, String b) {
  final la = _luminance(a), lb = _luminance(b);
  final high = math.max(la, lb), low = math.min(la, lb);
  return (high + 0.05) / (low + 0.05);
}

/// Text colour for a brand-coloured surface: the brand's choice when legible (≥ 4.5:1), else black/white.
String readableOn(String background, [String? preferred]) {
  if (preferred != null && _hex.hasMatch(preferred) && contrastRatio(background, preferred) >= 4.5) return preferred;
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#1A1A1A') ? '#FFFFFF' : '#1A1A1A';
}

String nativeTemplate(String? value) => kNativeTemplates.contains(value) ? value! : 'classic';

/// `adjust(color, amount)` (each channel + amount, clamped).
String adjustHex(String color, int amount) {
  final value = int.parse(color.substring(1), radix: 16);
  int part(int shift) => (((value >> shift) & 0xff) + amount).clamp(0, 255);
  return '#${(1 << 24 | part(16) << 16 | part(8) << 8 | part(0)).toRadixString(16).substring(1)}';
}

Color hexColor(String hex) => Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));

class NativeAdCard extends StatefulWidget {
  const NativeAdCard({super.key, required this.ad, this.sponsorLabel, this.codeLabel, this.onTap});
  final NativeAdContent ad;
  final String? sponsorLabel;
  final String? codeLabel;
  final VoidCallback? onTap;

  @override
  State<NativeAdCard> createState() => _NativeAdCardState();
}

class _NativeAdCardState extends State<NativeAdCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final ad = widget.ad;
    final s = context.tokens.shadcn;
    final template = nativeTemplate(ad.nativeTemplate);
    final accentHex = ad.backgroundColor != null && _hex.hasMatch(ad.backgroundColor!) ? ad.backgroundColor! : '#F48155';
    final onAccentHex = readableOn(accentHex, ad.textColor);
    final accent = hexColor(accentHex), onAccent = hexColor(onAccentHex);
    final image = safeAdUrl(ad.imageUrl), logo = safeAdUrl(ad.sponsorLogo);
    final external = ad.linkType == 'external';
    final classic = template == 'classic';
    final ink = classic ? onAccent : s.cardForeground;
    final muted = classic ? onAccent.withValues(alpha: 0.88) : s.mutedForeground;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final options = ad.creativeOptions;

    Widget arrow({double size = 18, Color? color}) => AIcon(external ? AIcons.externalLink : AIcons.chevronRight, size: size, color: color ?? ink, mirrorInRtl: !external);
    Widget? sponsor() => widget.sponsorLabel == null
        ? null
        : Text(widget.sponsorLabel!, style: TextStyle(fontSize: 10, height: 1.3, letterSpacing: 0.2, color: muted));
    Widget title() => Text(ad.title, style: TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: ink));
    Widget? text(int lines) {
      final d = ad.description;
      if (d == null || d.isEmpty) return null;
      return Text(d, maxLines: lines, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 1.45, color: muted));
    }

    Widget cta() => ad.buttonText != null && ad.buttonText!.isNotEmpty
        ? Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Flexible(child: Text(ad.buttonText!, style: TextStyle(fontSize: 13, height: 1.2, fontWeight: FontWeight.w600, color: onAccent))),
              const SizedBox(width: 6),
              arrow(size: 15, color: onAccent),
            ]),
          )
        : Align(alignment: AlignmentDirectional.centerEnd, child: arrow(color: accent));
    Widget? media({double? width, double? height, double? aspect, BoxShape shape = BoxShape.rectangle}) {
      if (image == null) return null;
      Widget img = Image.network(image, key: const ValueKey<String>('creative-image'), fit: BoxFit.cover, width: width, height: height, errorBuilder: (_, _, _) => const SizedBox.shrink());
      img = ColoredBox(color: s.border, child: img);
      if (aspect != null) img = AspectRatio(aspectRatio: aspect, child: img);
      if (shape == BoxShape.circle) img = ClipOval(child: img);
      return img;
    }

    Widget body(List<Widget?> children, {int gap = 6}) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            for (final (i, c) in children.nonNulls.indexed) ...[if (i > 0) SizedBox(height: gap.toDouble()), c],
          ]),
        );
    Widget grow(List<Widget?> children) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            for (final (i, c) in children.nonNulls.indexed) ...[if (i > 0) const SizedBox(height: 3), c],
          ]),
        );

    late final Widget content;
    switch (template) {
      case 'spotlight':
        content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [?media(aspect: 16 / 9), body([sponsor(), title(), text(2), cta()])]);
      case 'split':
        content = IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (image != null) ConstrainedBox(constraints: const BoxConstraints(minHeight: 104), child: media(width: 104)!),
            Expanded(child: body([sponsor(), title(), text(2), cta()])),
          ]),
        );
      case 'minimal':
        // `.nad-minimal { border-inline-start: 4px solid accent }`: an accent rail inside the uniform 1 px border
        // (Flutter cannot round a border whose sides differ).
        content = Stack(children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(19, 14, 16, 14),
            child: Row(children: [grow([sponsor(), title(), text(1)]), const SizedBox(width: 12), arrow(color: accent)]),
          ),
          PositionedDirectional(start: 0, top: 0, bottom: 0, width: 3, child: ColoredBox(color: accent)),
        ]);
      case 'offer':
        final code = options['offer_code'];
        content = body([
          sponsor(),
          Row(children: [AIcon(AIcons.ticket, size: 22, color: accent), const SizedBox(width: 12), Expanded(child: title())]),
          text(2),
          Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 8, children: [
            if (code is String && code.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: s.border)),
                child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text(widget.codeLabel ?? '', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: s.mutedForeground)),
                  const SizedBox(width: 6),
                  Text(code, textDirection: TextDirection.ltr, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 0.84, fontFamily: 'monospace', color: ink)),
                ]),
              ),
            if (ad.buttonText != null && ad.buttonText!.isNotEmpty) cta() else arrow(color: accent),
          ]),
        ]);
      case 'expert':
        final name = options['expert_name'], role = options['expert_role'];
        content = body([
          sponsor(),
          Transform.flip(flipX: rtl, child: AIcon(AIcons.quote, size: 22, color: accent)),
          title(),
          text(3),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(children: [
              SizedBox(
                width: 40,
                height: 40,
                child: image != null
                    ? media(width: 40, height: 40, shape: BoxShape.circle)!
                    : DecoratedBox(decoration: BoxDecoration(color: accent.withValues(alpha: 0.25), shape: BoxShape.circle)),
              ),
              const SizedBox(width: 12),
              grow([
                if (name is String && name.isNotEmpty) Text(name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: ink)),
                if (role is String && role.isNotEmpty) Text(role, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 1.45, color: muted)),
              ]),
              const SizedBox(width: 12),
              if (ad.buttonText != null && ad.buttonText!.isNotEmpty) cta() else arrow(color: accent),
            ]),
          ),
        ]);
      default:
        final wide = MediaQuery.sizeOf(context).width >= 640;
        content = Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: logo != null
                  ? Image.network(logo, width: 48, height: 48, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())
                  : AIcon(AIcons.sparkles, size: 24, color: onAccent),
            ),
            const SizedBox(width: 12),
            grow([sponsor(), title(), text(1)]),
            if (wide && ad.buttonText != null && ad.buttonText!.isNotEmpty) ...[
              const SizedBox(width: 12),
              Text(ad.buttonText!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: onAccent)),
            ],
            const SizedBox(width: 12),
            arrow(color: onAccent),
          ]),
        );
    }

    final border = switch (template) {
      'classic' => null,
      // native-ads.css `.nad-offer { border: 1.5px dashed }` — drawn solid (no dashed borders in Flutter).
      'offer' => Border.all(color: accent, width: 1.5),
      _ => Border.all(color: s.border),
    };
    final lite = MediaQuery.maybeDisableAnimationsOf(context) == true;
    return Semantics(
      button: true,
      container: true,
      child: GestureDetector(
        key: ValueKey<String>('native-ad-$template'),
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _pressed && !lite ? 0.985 : 1,
          duration: lite ? Duration.zero : const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: Container(
            width: double.infinity,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: classic ? null : s.card,
              gradient: classic
                  ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [accent, hexColor(adjustHex(accentHex, -20))])
                  : null,
              border: border,
              boxShadow: classic ? const [BoxShadow(color: Color(0x59000000), offset: Offset(0, 6), blurRadius: 16, spreadRadius: -8)] : null,
            ),
            child: DefaultTextStyle.merge(style: TextStyle(color: ink), child: content),
          ),
        ),
      ),
    );
  }
}
