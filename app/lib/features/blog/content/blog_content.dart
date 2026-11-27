// Ported from: src/lib/blog-content.mjs (articleSource, blogMarkup, prepareBlogContent)
//
// Session-free article formatting of the app reader: Markdown (marked 15 GFM, `breaks: true`) and sanitized HTML,
// mixed legacy rich text, export fences, escaped HTML, H1→H2, deterministic `section-N` headings, local table
// scrollers. marked → package:markdown (GitHub-flavoured set without footnotes, a `\n` → `<br>` inline syntax for
// `breaks`, raw HTML blocks routed through `rawHtml` like `renderer.html`); the browser DOM → package:html.
// ignore_for_file: depend_on_referenced_packages
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;
import 'package:markdown/markdown.dart' as md;

import 'blog_sanitize.dart';

/// A `<h2>` of the prepared article (`{ id, title }`).
class BlogHeading {
  const BlogHeading(this.id, this.title);
  final String id;
  final String title;

  @override
  bool operator ==(Object other) => other is BlogHeading && other.id == id && other.title == title;
  @override
  int get hashCode => Object.hash(id, title);
  @override
  String toString() => '{id: $id, title: $title}';
}

/// `{ content, headings }` of `prepareBlogContent`.
class PreparedBlogContent {
  const PreparedBlogContent({required this.content, required this.headings});
  final String content;
  final List<BlogHeading> headings;
}

final RegExp _fence = RegExp(r'^```(html|markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$', caseSensitive: false, unicode: true);
final RegExp _innerFence = RegExp(r'^\s*```', multiLine: true, unicode: true);
final RegExp _htmlStart = RegExp(r'^\s*<(?:p|h[1-6]|div|section|table|figure|ul|ol|blockquote)\b', caseSensitive: false, unicode: true);
final RegExp _escapedHtmlStart = RegExp(r'^\s*&lt;(?:p|h[1-6]|div|section|table|figure|ul|ol|blockquote)(?:\s|&gt;)', caseSensitive: false, unicode: true);
final RegExp _blockMarkdown = RegExp(r'(?:^|\n)\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|```|\|.+\|\s*\n\s*\|?\s*:?-{2,})', unicode: true);
final RegExp _inlineMarkdown = RegExp(r'\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^\s]+\)|`[^`\n]+`|(?:^|\s)\*[^*\n]+\*(?:\s|$)', unicode: true);
final RegExp _tableRow = RegExp(r'^\s*\|.*\|\s*$', unicode: true);
final RegExp _br = RegExp(r'<br\s*\/?\s*>', caseSensitive: false, unicode: true);
final RegExp _orphanMarker = RegExp(r'^\s*(?:>|#{1,6})\s*$', unicode: true);
final RegExp _emphasis = RegExp(r'(?<!\\)(\*\*|__|~~)(?=\S)([^\n]+?\S)\1', unicode: true);
final RegExp _leadingBold = RegExp(r'^\*\*\S', unicode: true);
final RegExp _doubleStar = RegExp(r'\*\*', unicode: true);
final RegExp _languageClass = RegExp(r'^language-[\w-]+$');
final RegExp _inlineImageSrc = RegExp(r'^(?:data|blob):', caseSensitive: false, unicode: true);
final RegExp _absoluteLink = RegExp(r'^(?:https?:)?\/\/', caseSensitive: false, unicode: true);

/// `articleSource(value)`: trims and unwraps an article export fence (```html / ```md, or an unlabelled fence that
/// holds HTML).
String articleSource(Object? value) {
  var source = value is String ? value.trim() : '';
  final fenced = _fence.firstMatch(source);
  if (fenced != null) {
    final body = fenced.group(2)!;
    if (!_innerFence.hasMatch(body) && (fenced.group(1) != null || _htmlStart.hasMatch(body))) source = body.trim();
  }
  return source;
}

// ── marked ──

/// `breaks: true`: a newline inside a paragraph is a `<br>`.
class _BreaksSyntax extends md.InlineSyntax {
  _BreaksSyntax() : super(r' *\n');
  @override
  bool onMatch(md.InlineParser parser, Match match) {
    parser.addNode(md.Element.empty('br'));
    parser.addNode(md.Text('\n'));
    return true;
  }
}

/// `renderer.html = token => token.block ? rawHtml(token.text) : token.text`.
class _RawHtmlBlockSyntax extends md.HtmlBlockSyntax {
  const _RawHtmlBlockSyntax(this.rawHtml);
  final String Function(String text) rawHtml;
  @override
  md.Node parse(md.BlockParser parser) {
    final node = super.parse(parser);
    return md.Text(rawHtml(node.textContent));
  }
}

/// marked's GFM: tables, task lists, strikethrough, autolinks, inline HTML (no footnotes).
final md.ExtensionSet _gfm = md.ExtensionSet(
  const <md.BlockSyntax>[
    md.FencedCodeBlockSyntax(),
    md.TableSyntax(),
    md.UnorderedListWithCheckboxSyntax(),
    md.OrderedListWithCheckboxSyntax(),
  ],
  <md.InlineSyntax>[md.InlineHtmlSyntax(), md.StrikethroughSyntax(), md.AutolinkExtensionSyntax()],
);

String _markedParse(String source, {String Function(String text)? rawHtml}) => md.markdownToHtml(
      source,
      extensionSet: _gfm,
      inlineSyntaxes: [_BreaksSyntax()],
      blockSyntaxes: rawHtml == null ? const <md.BlockSyntax>[] : <md.BlockSyntax>[_RawHtmlBlockSyntax(rawHtml)],
    );

String _markedParseInline(String source) => md.markdownToHtml(source, extensionSet: _gfm, inlineSyntaxes: [_BreaksSyntax()], inlineOnly: true);

/// `blogMarkup(value)`: plain marked output of the article source.
String blogMarkup(Object? value) => _markedParse(articleSource(value));

// ── DOM helpers ──

dom.Element _div([String html = '']) => dom.Element.tag('div')..innerHtml = html;

bool _contains(dom.Node root, dom.Node node) {
  for (dom.Node? n = node; n != null; n = n.parentNode) {
    if (identical(n, root)) return true;
  }
  return false;
}

dom.Element? _closest(dom.Node? node, Set<String> tags) {
  for (var n = node; n != null; n = n.parentNode) {
    if (n is dom.Element && tags.contains(n.localName)) return n;
  }
  return null;
}

List<dom.Text> _textNodes(dom.Node root) {
  final out = <dom.Text>[];
  void walk(dom.Node n) {
    for (final c in n.nodes) {
      if (c is dom.Text) {
        out.add(c);
      } else {
        walk(c);
      }
    }
  }

  walk(root);
  return out;
}

List<dom.Element> _elements(dom.Node root, Set<String> tags) {
  final out = <dom.Element>[];
  void walk(dom.Node n) {
    for (final c in n.nodes) {
      if (c is dom.Element) {
        if (tags.contains(c.localName)) out.add(c);
        walk(c);
      }
    }
  }

  walk(root);
  return out;
}

void _replaceWith(dom.Node node, List<dom.Node> nodes) {
  final parent = node.parentNode;
  if (parent == null) return;
  for (final n in nodes) {
    n.remove();
    parent.insertBefore(n, node);
  }
  node.remove();
}

dom.Node? _nextSibling(dom.Node node) {
  final parent = node.parentNode;
  if (parent == null) return null;
  final i = parent.nodes.indexOf(node);
  return i >= 0 && i + 1 < parent.nodes.length ? parent.nodes[i + 1] : null;
}

const Set<String> _codeLike = {'pre', 'code'};
const Set<String> _codeOrLink = {'pre', 'code', 'a'};
const Set<String> _blockHosts = {'p', 'div', 'section', 'article', 'blockquote'};
const Set<String> _blockInner = {'p', 'div', 'section', 'article', 'blockquote', 'table', 'pre', 'ul', 'ol', 'figure'};

/// Rendered checkbox of a GFM task item (`renderer.checkbox`): ☑ / ☐ instead of an `<input>`.
void _checkboxesToText(dom.Element root) {
  for (final input in _elements(root, const {'input'})) {
    final li = _closest(input.parentNode, const {'li'});
    if (input.attributes['type'] != 'checkbox' || li == null || !li.classes.contains('task-list-item')) continue;
    _replaceWith(input, [dom.Text(input.attributes.containsKey('checked') ? '☑ ' : '☐ ')]);
  }
}

/// `sanitize(markup)` as nodes; [checkboxes] for the main parse (its renderer prints task boxes as text; nested
/// parses use the default renderer, whose `<input>` the sanitizer drops).
List<dom.Node> _sanitizedMarkup(String markup, {bool checkboxes = false}) {
  final holder = _div(markup);
  if (checkboxes) _checkboxesToText(holder);
  sanitizeBlogNode(holder);
  return List<dom.Node>.of(holder.nodes);
}

/// Reparse text only inside raw HTML tokens. Reparsing an already rendered Markdown document would turn escaped
/// literal syntax into formatting.
String _rawHtml(String text) {
  final fragment = _div(sanitizeBlogHtml(text));
  // Older rich-text imports exported each GFM table row as a separate <p>. Parse consecutive rows together so the
  // header separator remains visible to the Markdown parser; keep inline HTML already present in each cell.
  for (final node in _elements(fragment, const {'p'})) {
    if (!_contains(fragment, node) || !_tableRow.hasMatch(node.text)) continue;
    final group = <dom.Element>[node];
    var next = _nextSibling(node);
    while (next != null) {
      if (next is dom.Text && next.text.trim().isEmpty) {
        next = _nextSibling(next);
        continue;
      }
      if (next is! dom.Element || next.localName != 'p' || !_tableRow.hasMatch(next.text)) break;
      group.add(next);
      next = _nextSibling(next);
    }
    if (group.length < 2) continue;
    final markup = _markedParse(group.map((row) => row.innerHtml).join('\n'));
    if (!markup.contains('<table>')) continue;
    _replaceWith(node, _sanitizedMarkup(markup));
    for (final row in group.skip(1)) {
      row.remove();
    }
  }
  for (final node in _elements(fragment, _blockHosts)) {
    if (!_contains(fragment, node) || _closest(node, _codeLike) != null || _elements(node, _blockInner).isNotEmpty) continue;
    final plain = node.innerHtml.replaceAll(_br, '\n');
    if (!_blockMarkdown.hasMatch(node.text) && !_blockMarkdown.hasMatch(plain)) continue;
    _replaceWith(node, _sanitizedMarkup(_markedParse(plain)));
  }
  for (final node in _elements(fragment, const {'p'})) {
    if (node.children.isEmpty && _orphanMarker.hasMatch(node.text)) node.remove();
  }
  for (final node in _textNodes(fragment)) {
    if (_closest(node.parentNode, _codeOrLink) != null || !_inlineMarkdown.hasMatch(node.text)) continue;
    _replaceWith(node, _sanitizedMarkup(_markedParseInline(node.text)));
  }
  return fragment.innerHtml;
}

/// Document order of every node under [root] (`compareDocumentPosition`).
Map<dom.Node, int> _order(dom.Node root) {
  final order = <dom.Node, int>{};
  var i = 0;
  void walk(dom.Node n) {
    for (final c in n.nodes) {
      order[c] = i++;
      walk(c);
    }
  }

  walk(root);
  return order;
}

/// `prepareBlogContent(value, { nativeCompatibility })`.
PreparedBlogContent prepareBlogContent(Object? value, {bool nativeCompatibility = false}) {
  var source = articleSource(value);
  if (_escapedHtmlStart.hasMatch(source)) {
    source = html_parser.parseFragment(source, container: 'textarea').text ?? source;
  }
  final root = _div(sanitizeBlogHtml(source));
  final children = root.children;
  final only = children.length == 1 && root.nodes.every((n) => n is dom.Element || (n.text ?? '').trim().isEmpty) ? children.first : null;
  final prepared = only != null && (only.classes.contains('blog-content-body') || only.classes.contains('blog-native-content'));
  if (prepared) {
    root.innerHtml = only.innerHtml;
  } else {
    root.innerHtml = '';
    root.nodes.addAll(_sanitizedMarkup(_markedParse(source, rawHtml: _rawHtml), checkboxes: true));
    // Some legacy translations place punctuation at both emphasis boundaries, e.g. **标题：**正文. CommonMark leaves
    // those delimiters literal. Repair only exact unescaped source phrases, outside links/code, after the first parse.
    final candidates = {for (final m in _emphasis.allMatches(source)) m.group(0)!};
    for (final node in _textNodes(root)) {
      if (_closest(node.parentNode, _codeOrLink) != null) continue;
      final text = node.text;
      var start = 0;
      final replacement = <dom.Node>[];
      for (final match in _emphasis.allMatches(text)) {
        if (!candidates.contains(match.group(0))) continue;
        replacement.add(dom.Text(text.substring(start, match.start)));
        final emphasis = dom.Element.tag(match.group(1) == '~~' ? 'del' : 'strong');
        emphasis.nodes.addAll(_sanitizedMarkup(_markedParseInline(match.group(2)!)));
        replacement.add(emphasis);
        start = match.end;
      }
      if (start > 0) {
        replacement.add(dom.Text(text.substring(start)));
        _replaceWith(node, replacement);
      }
    }
    for (final node in _elements(root, const {'p'})) {
      final first = node.nodes.isEmpty ? null : node.nodes.first;
      if (first is dom.Text &&
          _leadingBold.hasMatch(first.text) &&
          _elements(node, const {'strong'}).isNotEmpty &&
          _doubleStar.allMatches(node.text).length == 1) {
        first.text = first.text.substring(2);
      }
    }
  }
  root.innerHtml = sanitizeBlogHtml(root.innerHtml);
  for (final node in _allElements(root)) {
    if (!node.attributes.containsKey('class')) continue;
    final keep = node.classes.where((name) => name == 'blog-table-scroll' || (node.localName == 'code' && _languageClass.hasMatch(name))).toList();
    if (keep.isNotEmpty) {
      node.attributes['class'] = keep.join(' ');
    } else {
      node.attributes.remove('class');
    }
  }
  for (final node in _elements(root, const {'h1'})) {
    final heading = dom.Element.tag('h2')..innerHtml = node.innerHtml;
    final id = node.attributes['id'];
    if (id != null && id.isNotEmpty) heading.attributes['id'] = id;
    _replaceWith(node, [heading]);
  }
  final anchors = <String, String>{};
  final h2s = _elements(root, const {'h2'});
  for (var index = 0; index < h2s.length; index++) {
    final node = h2s[index];
    final id = 'section-${index + 1}';
    final old = node.attributes['id'];
    if (old != null && old.isNotEmpty) anchors[old] = id;
    node.attributes['id'] = id;
  }
  final headings = [for (final node in h2s) BlogHeading(node.attributes['id']!, node.text)];
  for (final image in _elements(root, const {'img'})) {
    if (_inlineImageSrc.hasMatch(image.attributes['src'] ?? '')) image.attributes.remove('src');
    image.attributes['loading'] = 'lazy';
    image.attributes['decoding'] = 'async';
    if (!image.attributes.containsKey('alt')) image.attributes['alt'] = '';
  }
  for (final link in _elements(root, const {'a'})) {
    final href = link.attributes['href'];
    if (href == null) continue;
    if (href.startsWith('#') && anchors.containsKey(href.substring(1))) link.attributes['href'] = '#${anchors[href.substring(1)]}';
    if (_absoluteLink.hasMatch(href)) {
      link.attributes['rel'] = 'noopener noreferrer';
      link.attributes['target'] = '_blank';
    }
  }
  for (final table in _elements(root, const {'table'})) {
    for (final element in [table, ..._elements(table, const {'th', 'td', 'col', 'colgroup'})]) {
      element.attributes.remove('width');
      element.attributes.remove('height');
    }
    var wrapper = table.parentNode;
    if (wrapper is! dom.Element || !wrapper.classes.contains('blog-table-scroll')) {
      final created = dom.Element.tag('div')..attributes['class'] = 'blog-table-scroll';
      table.parentNode!.insertBefore(created, table);
      table.remove();
      created.nodes.add(table);
      wrapper = created;
    }
    wrapper.attributes['tabindex'] = '0';
    final order = _order(root);
    String? label;
    for (final heading in _elements(root, const {'h2'})) {
      if (order[heading]! < order[table]! && !_contains(heading, table)) label = heading.attributes['id'];
    }
    if (label != null && label.isNotEmpty) {
      wrapper.attributes['role'] = 'region';
      wrapper.attributes['aria-labelledby'] = label;
    }
  }
  if (nativeCompatibility) {
    // Old delivered native readers retain style attributes but have fixed CSS. These finite app-owned rules are
    // materialized only after stripping input styles. Web readers strip them and use the shared responsive stylesheet.
    for (final node in _elements(root, const {'div'}).where((e) => e.classes.contains('blog-table-scroll'))) {
      node.attributes['style'] = 'display:block;max-width:100%;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch';
    }
    for (final node in _elements(root, const {'table'})) {
      node.attributes['style'] = 'width:100%;min-width:28rem;border-collapse:collapse';
    }
    for (final node in _elements(root, const {'img'})) {
      node.attributes['style'] = 'display:block;max-width:100%;height:auto';
    }
    for (final node in _elements(root, const {'figure'})) {
      node.attributes['style'] = 'max-width:100%;min-width:0;margin:1rem 0';
    }
    for (final node in _elements(root, const {'pre'})) {
      node.attributes['style'] = 'max-width:100%;overflow-x:auto;white-space:pre';
    }
    return PreparedBlogContent(
      content: '<div class="blog-native-content" style="min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal">${root.innerHtml}</div>',
      headings: headings,
    );
  }
  return PreparedBlogContent(content: '<div class="blog-content-body">${root.innerHtml}</div>', headings: headings);
}

List<dom.Element> _allElements(dom.Node root) {
  final out = <dom.Element>[];
  void walk(dom.Node n) {
    for (final c in n.nodes) {
      if (c is dom.Element) {
        out.add(c);
        walk(c);
      }
    }
  }

  walk(root);
  return out;
}
