// Ported from: src/components/MarkdownContent.tsx (react-markdown + remark-gfm with the element class map)
//
// GFM markdown (headings, lists, task lists, tables with their own horizontal scroller, links, images, code,
// blockquotes) with the React element styles. Reused by AI chat (variant chat), blog and tools.
//
//   MarkdownContent(content: text)                                  // default
//   MarkdownContent(content: text, variant: ContentVariant.chat)    // chat bubbles
//   MarkdownContent(content: text, typography: ContentTypography.legal(ContentTypography.markdown))
//
// Margins: CSS collapses adjacent vertical margins; Flutter pads. Paddings are chosen so the common sequences
// (p→p, h→p, p→h, list→p) give the CSS gaps (see README "Rich text").
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:material_ui/material_ui.dart' show Theme;
import 'package:url_launcher/url_launcher.dart';

import 'content_typography.dart';

/// Default link handler: `target="_blank"` → external browser.
Future<void> openContentLink(String href) async {
  final uri = Uri.tryParse(href);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {}
}

/// `<img className="rounded-xl my-3 max-w-full h-auto">` (network images are cached).
Widget contentImage(String src, {String? alt, double radius = 12, EdgeInsets margin = const EdgeInsets.symmetric(vertical: 12)}) => Padding(
      padding: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: src.startsWith('http')
            ? CachedNetworkImage(imageUrl: src, fit: BoxFit.contain, errorWidget: (_, _, _) => Semantics(label: alt, child: const SizedBox.shrink()))
            : Semantics(label: alt, child: const SizedBox.shrink()),
      ),
    );

class MarkdownContent extends StatelessWidget {
  const MarkdownContent({
    super.key,
    required this.content,
    this.variant = ContentVariant.markdown,
    this.typography,
    this.onTapLink,
    this.textColor,
    this.selectable = true,
    this.imageBuilder,
  });

  final String content;
  final ContentVariant variant;

  /// Element sizes (default [ContentTypography.markdown]).
  final ContentTypography? typography;

  /// Link taps; default opens the external browser.
  final void Function(String href)? onTapLink;

  /// Inherited text colour (`style={{ color }}` of the wrapper); default: ambient [DefaultTextStyle].
  final Color? textColor;

  /// `.prose *` is user-selectable in the native app.
  final bool selectable;

  /// Image rendering override (tests).
  final Widget Function(String src, String? alt)? imageBuilder;

  @override
  Widget build(BuildContext context) {
    final t = typography ?? ContentTypography.markdown;
    final c = ContentColors.of(context);
    var base = DefaultTextStyle.of(context).style;
    if (textColor != null) base = base.copyWith(color: textColor);
    if (variant == ContentVariant.chat) base = base.copyWith(fontSize: 14, height: 1.625);
    final p = t.p == null ? base : base.merge(sizeStyle(t.p!));
    final li = base.merge(sizeStyle(t.li));
    final xs = base.merge(const TextStyle(fontSize: 12, height: 16 / 12));
    final mono = TextStyle(fontFamily: 'monospace', fontFamilyFallback: const <String>['Courier'], fontSize: 12, height: 16 / 12, backgroundColor: c.mutedBg);
    final sheet = MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
      p: p,
      pPadding: EdgeInsets.only(bottom: t.pMargin),
      a: TextStyle(color: c.primary, decoration: TextDecoration.underline, decorationColor: c.primary),
      h1: base.merge(sizeStyle(t.h1, weight: FontWeight.w700, color: c.foreground)),
      h1Padding: EdgeInsets.only(top: (t.h1Margin.$1 - t.pMargin).clamp(0, 99), bottom: (t.h1Margin.$2 - t.pMargin).clamp(0, 99)),
      h2: base.merge(sizeStyle(t.h2, weight: FontWeight.w700, color: c.foreground)),
      h2Padding: EdgeInsets.only(top: (t.h2Margin.$1 - t.pMargin).clamp(0, 99), bottom: (t.h2Margin.$2 - t.pMargin).clamp(0, 99)),
      h3: base.merge(sizeStyle(t.h3, weight: FontWeight.w600, color: c.foreground)),
      h3Padding: EdgeInsets.only(top: (t.h3Margin.$1 - t.pMargin).clamp(0, 99), bottom: (t.h3Margin.$2 - t.pMargin).clamp(0, 99)),
      h4: p.copyWith(fontWeight: FontWeight.w700),
      h5: p.copyWith(fontWeight: FontWeight.w700),
      h6: p.copyWith(fontWeight: FontWeight.w700),
      strong: const TextStyle(fontWeight: FontWeight.w600),
      em: const TextStyle(fontStyle: FontStyle.italic),
      del: TextStyle(decoration: TextDecoration.lineThrough, color: c.muted),
      code: mono,
      codeblockPadding: const EdgeInsets.all(12),
      codeblockDecoration: BoxDecoration(color: c.mutedBg, borderRadius: BorderRadius.circular(8)),
      blockquote: p.copyWith(fontStyle: FontStyle.italic, color: c.muted),
      blockquotePadding: const EdgeInsetsDirectional.only(start: 12).resolve(Directionality.of(context)),
      blockquoteDecoration: BoxDecoration(
        border: Directionality.of(context) == TextDirection.rtl ? Border(right: BorderSide(color: c.primary, width: 2)) : Border(left: BorderSide(color: c.primary, width: 2)),
      ),
      listIndent: t.listIndent,
      listBullet: li,
      listBulletPadding: const EdgeInsets.only(right: 4),
      blockSpacing: 0,
      horizontalRuleDecoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
      tableHead: xs.copyWith(fontWeight: FontWeight.w600, color: c.foreground),
      tableBody: xs.copyWith(color: c.muted),
      tableHeadAlign: TextAlign.start,
      // `overflow-x-auto my-3 rounded-lg border border-border`, rows `border-b … last:border-b-0`
      tableBorder: TableBorder.all(color: c.border, borderRadius: BorderRadius.circular(8)),
      tableColumnWidth: const IntrinsicColumnWidth(),
      tableCellsPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      tableHeadCellsPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      tableHeadCellsDecoration: BoxDecoration(color: c.mutedBg.withValues(alpha: 0.7)),
      tablePadding: const EdgeInsets.symmetric(vertical: 12),
      tableVerticalAlignment: TableCellVerticalAlignment.top,
      checkbox: li.copyWith(color: c.primary),
    );
    return DefaultTextStyle.merge(
      style: base,
      child: MarkdownBody(
        data: content,
        selectable: selectable,
        styleSheet: sheet,
        onTapLink: (text, href, title) {
          if (href == null) return;
          (onTapLink ?? (h) => openContentLink(h))(href);
        },
        imageBuilder: (uri, title, alt) => (imageBuilder ?? (s, a) => contentImage(s, alt: a))(uri.toString(), alt),
        listItemCrossAxisAlignment: MarkdownListItemCrossAxisAlignment.start,
      ),
    );
  }
}

