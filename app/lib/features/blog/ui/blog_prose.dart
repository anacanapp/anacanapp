// Ported from: src/components/blog/BlogContent.tsx, src/components/blog/usePreparedBlogContent.ts,
//              src/styles/blog-content.css (.blog-prose, .blog-article .blog-prose typography, figure / img /
//              figcaption / pre / code, .blog-table-scroll local horizontal scroll with min-width 28rem tables)
//
// The prepared article HTML (blog_content.dart) rendered with flutter_widget_from_html and the blog stylesheet.
// Tables and code blocks scroll horizontally in their own box; headings carry their `section-N` anchors
// ([scrollToBlogHeading] for the table of contents).
// ignore_for_file: depend_on_referenced_packages
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import 'package:html/dom.dart' as dom;
import 'package:url_launcher/url_launcher.dart';

import '../../../design/design.dart';
import '../../../shell/shell.dart';
import '../content/blog_content.dart';
import '../data/blog_editorial.dart' show kBlogCanonicalOrigin;

String _hex(Color c) => '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';

Map<String, String> _css(String css) {
  final map = <String, String>{};
  for (final decl in css.split(';')) {
    final i = decl.indexOf(':');
    if (i <= 0) continue;
    map[decl.substring(0, i).trim()] = decl.substring(i + 1).trim();
  }
  return map;
}

/// Resolves an article URL the way the WebView did (relative to the app origin).
Uri? resolveBlogUrl(String href) {
  try {
    return Uri.parse(kBlogCanonicalOrigin).resolve(href.trim());
  } catch (_) {
    return null;
  }
}

/// Opens an article link: in-app article links open the reader, app paths go through the shell, the rest opens in
/// the browser (`target="_blank"`).
typedef BlogLinkHandler = Future<void> Function(String href);

final blogLinkHandlerProvider = Provider<BlogLinkHandler>((ref) => (href) async {
      final uri = resolveBlogUrl(href);
      if (uri == null) return;
      final shell = ref.read(shellProvider.notifier);
      if (shell.openAppBlogLink(uri.toString())) return;
      final relative = !RegExp(r'^[a-z][a-z0-9+.\-]*:|^//', caseSensitive: false).hasMatch(href.trim());
      if (relative && shell.openUrl(uri.toString())) return;
      try {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {}
    }, name: 'blogLinkHandlerProvider');

/// `<BlogContent content className="prose …" />` inside `.blog-article`.
class BlogProse extends ConsumerWidget {
  const BlogProse({super.key, required this.content, this.htmlKey, this.imageBuilder});

  /// The stored article body (Markdown / HTML / mixed); prepared here like `usePreparedBlogContent`.
  final String content;
  final GlobalKey<HtmlWidgetState>? htmlKey;

  /// Image override (tests).
  final Widget Function(String src, String? alt)? imageBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prepared = prepareBlogContent(content);
    return BlogProseHtml(html: prepared.content, htmlKey: htmlKey, imageBuilder: imageBuilder, onLink: ref.read(blogLinkHandlerProvider));
  }
}

/// Renders already prepared article HTML.
class BlogProseHtml extends StatelessWidget {
  const BlogProseHtml({super.key, required this.html, this.htmlKey, this.imageBuilder, this.onLink});
  final String html;
  final GlobalKey<HtmlWidgetState>? htmlKey;
  final Widget Function(String src, String? alt)? imageBuilder;
  final BlogLinkHandler? onLink;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final base = DefaultTextStyle.of(context).style.copyWith(fontSize: 16, height: 1.75, color: a.ink);
    return HtmlWidget(
      html,
      key: htmlKey,
      textStyle: base,
      onTapUrl: (url) {
        if (url.startsWith('#')) return false;
        final handler = onLink;
        if (handler != null) handler(url);
        return true;
      },
      customStylesBuilder: (element) => blogProseStyles(context, element),
      customWidgetBuilder: (element) => _widget(context, element),
    );
  }

  Widget? _widget(BuildContext context, dom.Element element) {
    final a = context.a;
    final tag = element.localName;
    if (tag == 'img') {
      final src = element.attributes['src'] ?? '';
      final alt = element.attributes['alt'];
      return (imageBuilder ?? _image)(src, alt);
    }
    if (tag == 'pre') {
      // `.blog-prose pre`: own horizontal scroll, white-space: pre, padding .875rem, radius 10, surface-soft.
      return Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.all(14),
          child: Text(
            element.text.replaceAll(RegExp(r'\n$'), ''),
            softWrap: false,
            style: TextStyle(fontFamily: 'monospace', fontFamilyFallback: const ['Courier'], fontSize: 14, height: 1.75, color: a.ink),
          ),
        ),
      );
    }
    if (tag == 'div' && element.classes.contains('blog-table-scroll')) {
      final inner = element.innerHtml;
      // `.blog-table-scroll`: margin 1.25rem 0, 1px line border, radius 12, overflow-x auto; table min-width 28rem.
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 20),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(border: Border.all(color: a.line), borderRadius: BorderRadius.circular(12)),
        child: LayoutBuilder(
          builder: (context, c) => SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: math.max(c.maxWidth, 448),
              child: HtmlWidget(
                inner,
                textStyle: DefaultTextStyle.of(context).style.copyWith(fontSize: 14, height: 1.75, color: a.ink),
                onTapUrl: (url) {
                  if (url.startsWith('#')) return false;
                  onLink?.call(url);
                  return true;
                },
                customStylesBuilder: (e) => blogProseStyles(context, e),
                customWidgetBuilder: (e) => e.localName == 'img' ? _widget(context, e) : null,
              ),
            ),
          ),
        ),
      );
    }
    return null;
  }

  Widget _image(String src, String? alt) {
    final uri = src.isEmpty ? null : resolveBlogUrl(src);
    if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http')) return Semantics(label: alt, child: const SizedBox.shrink());
    // `.blog-prose img`: block, max-width 100%, height auto, radius 14.
    return Semantics(
      image: true,
      label: alt,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: CachedNetworkImage(imageUrl: uri.toString(), fit: BoxFit.contain, errorWidget: (_, _, _) => const SizedBox.shrink()),
      ),
    );
  }
}

/// `blog-content.css` element rules for flutter_widget_from_html.
Map<String, String>? blogProseStyles(BuildContext context, dom.Element element) {
  final a = context.a;
  final rtl = Directionality.of(context) == TextDirection.rtl;
  final start = rtl ? 'right' : 'left';
  final tag = element.localName;
  final parent = element.parent;
  final inBody = parent != null && (parent.classes.contains('blog-content-body') || parent.classes.contains('blog-native-content'));
  final siblings = inBody ? parent.children : const [];
  final first = inBody && siblings.isNotEmpty && identical(siblings.first, element);
  final last = inBody && siblings.isNotEmpty && identical(siblings.last, element);
  String edges(double top, double bottom) => 'margin-top: ${first ? 0 : top}px; margin-bottom: ${last ? 0 : bottom}px;';
  final inCell = _inTableCell(element);
  switch (tag) {
    case 'h2':
      return _css('font-size: 20px; font-weight: 800; line-height: 1.4; ${edges(24, 10)} color: ${_hex(a.ink)};');
    case 'h3':
      return _css('font-size: 18px; font-weight: 700; line-height: 1.4; ${edges(20, 8)} color: ${_hex(a.ink)};');
    case 'h4' || 'h5' || 'h6':
      return _css('font-size: 16px; font-weight: 700; line-height: 1.45; ${edges(18, 8)}');
    case 'p':
      if (inCell) return _css('margin-top: 0; margin-bottom: ${_isLastChild(element) ? 0 : 10}px;');
      if (parent?.localName == 'li') return _css('margin: 6px 0;');
      return _css(edges(0, 14));
    case 'ul':
      return _css('list-style-type: disc; padding-$start: 24px; ${edges(12, 16)}');
    case 'ol':
      return _css('list-style-type: decimal; padding-$start: 24px; ${edges(12, 16)}');
    case 'li':
      return _css('margin: 6px 0;');
    case 'strong' || 'b':
      return _css('font-weight: 700;');
    case 'em' || 'i':
      return _css('font-style: italic;');
    case 'a':
      return _css('color: ${_hex(a.accentInk)}; text-decoration: underline;');
    case 'blockquote':
      return _css('border-$start: 3px solid ${_hex(a.peach2)}; padding-$start: 16px; ${edges(16, 16)} margin-left: 0; margin-right: 0; color: ${_hex(a.inkSoft)};');
    case 'hr':
      return _css('border-top: 1px solid ${_hex(a.line)}; ${edges(24, 24)}');
    case 'code':
      return _css('font-family: monospace; font-size: 0.875em;');
    case 'figure':
      return _css('${edges(20, 20)} margin-left: 0; margin-right: 0;');
    case 'figcaption':
      return _css('font-size: 13px; line-height: 1.6; color: ${_hex(a.inkSoft)}; margin: 10px 0;');
    case 'table':
      return _css('width: 100%; margin: 0; border-collapse: collapse; font-size: 14px;');
    case 'th':
      return _css('padding: 10px 12px; vertical-align: top; text-align: start; border: 1px solid ${_hex(a.line)}; background-color: ${_hex(a.surfaceSoft)}; font-weight: 600;');
    case 'td':
      return _css('padding: 10px 12px; vertical-align: top; text-align: start; border: 1px solid ${_hex(a.line)};');
    default:
      return null;
  }
}

bool _inTableCell(dom.Element element) {
  for (var e = element.parent; e != null; e = e.parent) {
    final tag = e.localName;
    if (tag == 'td' || tag == 'th') return true;
  }
  return false;
}

bool _isLastChild(dom.Element element) {
  final parent = element.parent;
  if (parent == null) return true;
  final children = parent.children;
  return children.isNotEmpty && identical(children.last, element);
}

/// `BlogContents` scrolling: the heading anchor of the rendered article.
Future<bool> scrollToBlogHeading(GlobalKey<HtmlWidgetState> key, String id) async => await key.currentState?.scrollToAnchor(id) ?? false;

/// The headings of an article body (`usePreparedBlogContent(content).headings`).
List<BlogHeading> blogHeadings(String content) => prepareBlogContent(content).headings;
