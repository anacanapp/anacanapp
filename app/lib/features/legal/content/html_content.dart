// Ported from: src/components/ui/HtmlContent.tsx (DOMPurify config + `[&_tag]:…` rich-text styles),
//              src/lib/legalProse.ts (wrapLegalTables)
//
// Sanitised HTML (rich-text editor output) with the React element styles; tables scroll horizontally in their own
// box. Non-HTML input renders as pre-wrapped text, like the React fallback.
//
//   HtmlContent(content: html)
//   HtmlContent(content: html, typography: ContentTypography.legal(ContentTypography.html))
import 'package:flutter/widgets.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';

import 'content_typography.dart';
import 'markdown_content.dart' show contentImage, openContentLink;

/// `content.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(content)`.
bool looksLikeHtml(String content) => content.trim().startsWith('<') || RegExp(r'<[a-z][\s\S]*>', caseSensitive: false).hasMatch(content);

const List<String> _forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'];

/// DOMPurify with `FORBID_TAGS` / `FORBID_ATTR`, no data-* attributes and no `javascript:` URLs.
String sanitizeHtml(String html) {
  var out = html;
  for (final tag in _forbiddenTags) {
    out = out.replaceAll(RegExp('<$tag\\b[^>]*>[\\s\\S]*?</$tag\\s*>', caseSensitive: false), '');
    out = out.replaceAll(RegExp('<$tag\\b[^>]*/?>', caseSensitive: false), '');
  }
  out = out.replaceAll(RegExp(r'''\s(on[a-z]+|data-[\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)''', caseSensitive: false), '');
  out = out.replaceAllMapped(RegExp(r'''(\s(?:href|src)\s*=\s*)("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)''', caseSensitive: false), (m) => '${m[1]}""');
  return out;
}

/// `wrapLegalTables(html)`: each table in its own horizontal scroller.
String wrapLegalTables(String html) => html
    .replaceAll(RegExp(r'<table\b', caseSensitive: false), '<div class="legal-table-scroll"><table')
    .replaceAll(RegExp(r'</table>', caseSensitive: false), '</table></div>');

String _hex(Color c) => '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';
String _rgba(Color c) => 'rgba(${(c.r * 255).round()}, ${(c.g * 255).round()}, ${(c.b * 255).round()}, ${c.a.toStringAsFixed(3)})';

class HtmlContent extends StatelessWidget {
  const HtmlContent({super.key, required this.content, this.typography, this.onTapLink, this.textColor, this.imageBuilder});
  final String content;

  /// Element sizes (default [ContentTypography.html]).
  final ContentTypography? typography;
  final void Function(String href)? onTapLink;
  final Color? textColor;
  final Widget Function(String src, String? alt)? imageBuilder;

  @override
  Widget build(BuildContext context) {
    var base = DefaultTextStyle.of(context).style;
    if (textColor != null) base = base.copyWith(color: textColor);
    if (!looksLikeHtml(content)) {
      return Text(content, style: base);
    }
    final t = typography ?? ContentTypography.html;
    final c = ContentColors.of(context);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    String size((double, double) s) => 'font-size: ${s.$1}px; line-height: ${s.$2}px;';
    return HtmlWidget(
      sanitizeHtml(content),
      textStyle: base,
      onTapUrl: (url) {
        (onTapLink ?? (h) => openContentLink(h))(url);
        return true;
      },
      customWidgetBuilder: (element) {
        if (element.localName == 'img') {
          final src = element.attributes['src'] ?? '';
          return (imageBuilder ?? (s, a) => contentImage(s, alt: a, margin: const EdgeInsets.symmetric(vertical: 16)))(src, element.attributes['alt']);
        }
        return null;
      },
      customStylesBuilder: (element) {
        final fg = _hex(c.foreground);
        switch (element.localName) {
          case 'h1':
            return _css('${size(t.h1)} font-weight: 700; color: $fg; margin: ${t.h1Margin.$1}px 0 ${t.h1Margin.$2}px 0;');
          case 'h2':
            return _css('${size(t.h2)} font-weight: 700; color: $fg; margin: ${t.h2Margin.$1}px 0 ${t.h2Margin.$2}px 0;');
          case 'h3':
            return _css('${size(t.h3)} font-weight: 600; color: $fg; margin: ${t.h3Margin.$1}px 0 ${t.h3Margin.$2}px 0;');
          case 'h4' || 'h5' || 'h6':
            return _css('font-weight: 700; margin: 0;');
          case 'p':
            return _css('margin: ${t.pMargin}px 0;${t.p != null ? ' font-size: ${t.p!.$1}px;' : ''}${t.pRelaxed ? ' line-height: 1.625;' : ''}');
          case 'ul':
            return _css('list-style-type: disc; padding-${rtl ? 'right' : 'left'}: ${t.listIndent}px; margin: ${t.listMargin}px 0;');
          case 'ol':
            return _css('list-style-type: decimal; padding-${rtl ? 'right' : 'left'}: ${t.listIndent}px; margin: ${t.listMargin}px 0;');
          case 'li':
            return _css('font-size: ${t.li.$1}px; line-height: 1.625; margin-bottom: 4px;');
          case 'blockquote':
            return _css('border-${rtl ? 'right' : 'left'}: 4px solid ${_rgba(c.primary.withValues(alpha: 0.5))}; padding-${rtl ? 'right' : 'left'}: 16px; margin: 12px 0; font-style: italic; color: ${_hex(c.muted)};');
          case 'a':
            return _css('color: ${_hex(c.primary)}; text-decoration: underline;');
          case 'strong' || 'b':
            return _css('font-weight: 600;');
          case 'code':
            return _css('background-color: ${_hex(c.mutedBg)}; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace;');
          case 'pre':
            return _css('white-space: pre-wrap;');
          case 'hr':
            return _css('margin: 24px 0; border-top: 1px solid ${_hex(c.border)};');
          case 'table':
            return _css('font-size: 14px; border: 1px solid ${_hex(c.border)}; border-collapse: collapse; margin: 0;');
          case 'thead':
            return _css('background-color: ${_rgba(c.mutedBg.withValues(alpha: 0.7))};');
          case 'th':
            return _css('padding: 8px 12px; text-align: start; font-weight: 600; color: $fg; font-size: 12px; border-bottom: 1px solid ${_hex(c.border)};');
          case 'td':
            return _css('padding: 8px 12px; color: ${_hex(c.muted)}; font-size: 12px; border-bottom: 1px solid ${_hex(c.border)};');
          case 'div':
            if (element.classes.contains('legal-table-scroll')) return _css('margin: 12px 0;');
            return null;
          default:
            return null;
        }
      },
    );
  }

  static Map<String, String> _css(String css) {
    final map = <String, String>{};
    for (final decl in css.split(';')) {
      final i = decl.indexOf(':');
      if (i <= 0) continue;
      map[decl.substring(0, i).trim()] = decl.substring(i + 1).trim();
    }
    return map;
  }
}
