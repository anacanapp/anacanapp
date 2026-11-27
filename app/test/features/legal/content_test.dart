// Ported from: src/lib/legalProse.test.ts (case names kept) + tests for the MarkdownContent / HtmlContent ports
//              (headings, lists, tables with horizontal scroll, links, images, RTL, sanitising)
import 'package:anacan/features/legal/content/content_typography.dart';
import 'package:anacan/features/legal/content/html_content.dart';
import 'package:anacan/features/legal/content/markdown_content.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

Widget img(String src, String? alt) => SizedBox(key: ValueKey<String>('img:$src'), width: 40, height: 40);

Iterable<RichText> richTexts(WidgetTester t) => t.widgetList<RichText>(find.byType(RichText));
String allText(WidgetTester t) => richTexts(t).map((r) => r.text.toPlainText()).join('\n');

TextStyle? styleOf(WidgetTester t, String text) {
  for (final r in richTexts(t)) {
    TextStyle? found;
    r.text.visitChildren((span) {
      if (span is TextSpan && (span.text ?? '').contains(text)) {
        found = span.style;
        return false;
      }
      return true;
    });
    if (found != null) return r.text.style?.merge(found) ?? found;
  }
  return null;
}

void main() {
  setUpAll(loadAnacanFonts);

  group('legal document layout', () {
    test('wraps every HTML table in its own horizontal scroller', () {
      const html = '<p>Intro</p><table class="x"><tr><td>a</td></tr></table><TABLE><tr><td>b</td></tr></TABLE>';
      final out = wrapLegalTables(html);
      expect(RegExp('<div class="legal-table-scroll"><table', caseSensitive: false).allMatches(out).length, 2);
      expect(RegExp('</table></div>', caseSensitive: false).allMatches(out).length, 2);
    });
    test('lets prose wrap to the viewport and keeps table words intact', () {
      // LEGAL_PROSE_CLASS → ContentTypography.legal: text-sm paragraphs / list items, text-lg h1.
      final t = ContentTypography.legal(ContentTypography.markdown);
      expect(t.p, (14, 20));
      expect(t.li, (14, 20));
      expect(t.h1, (18, 28));
    });
  });

  group('sanitizeHtml (DOMPurify config)', () {
    test('drops forbidden tags, event handlers, data attributes and javascript: URLs', () {
      final out = sanitizeHtml('<p onclick="x()" data-x="1">Hi</p><script>alert(1)</script><iframe src="e"></iframe><style>p{}</style><a href="javascript:evil()">l</a><input value="a">');
      expect(out, isNot(contains('script')));
      expect(out, isNot(contains('iframe')));
      expect(out, isNot(contains('style')));
      expect(out, isNot(contains('onclick')));
      expect(out, isNot(contains('data-x')));
      expect(out, isNot(contains('javascript')));
      expect(out, isNot(contains('<input')));
      expect(out, contains('<p>Hi</p>'));
    });
    test('detects HTML like the React check', () {
      expect(looksLikeHtml('<p>x</p>'), isTrue);
      expect(looksLikeHtml('text with <b>bold</b>'), isTrue);
      expect(looksLikeHtml('# Title\n\n- item'), isFalse);
    });
  });

  group('MarkdownContent', () {
    const md = '# Başlıq\n\nAbzas **qalın** və [keçid](https://anacan.az).\n\n## Alt\n\n- bir\n- iki\n\n1. birinci\n\n![şəkil](https://x.test/a.png)\n\n| Sütun A | Sütun B uzun mətn uzun mətn uzun mətn | C |\n|---|---|---|\n| hüceyrə 1 hüceyrə 1 hüceyrə 1 | hüceyrə 2 hüceyrə 2 hüceyrə 2 hüceyrə 2 | hüceyrə 3 hüceyrə 3 hüceyrə 3 |\n';

    screenTest('headings, lists, links and images use the React element styles', (tester) async {
      final links = <String>[];
      await pumpApp(tester, Padding(padding: const EdgeInsets.all(16), child: MarkdownContent(content: md, onTapLink: links.add, imageBuilder: img, selectable: false)), overrides: baseOverrides());
      await tester.pumpAndSettle();
      expect(styleOf(tester, 'Başlıq')?.fontSize, 20);
      expect(styleOf(tester, 'Başlıq')?.fontWeight, FontWeight.w700);
      expect(styleOf(tester, 'Alt')?.fontSize, 18);
      expect(styleOf(tester, 'qalın')?.fontWeight, FontWeight.w600);
      expect(styleOf(tester, 'keçid')?.decoration, TextDecoration.underline);
      expect(allText(tester), contains('bir'));
      expect(allText(tester), contains('•'));
      expect(allText(tester), contains('1.'));
      expect(find.byKey(const ValueKey<String>('img:https://x.test/a.png')), findsOneWidget);
    });

    screenTest('wide tables scroll horizontally inside their own box', (tester) async {
      await pumpApp(tester, Padding(padding: const EdgeInsets.all(16), child: MarkdownContent(content: md, imageBuilder: img, selectable: false)), overrides: baseOverrides());
      await tester.pumpAndSettle();
      final scroll = find.byWidgetPredicate((w) => w is SingleChildScrollView && w.scrollDirection == Axis.horizontal);
      expect(scroll, findsOneWidget);
      final table = tester.getSize(find.byType(Table));
      expect(table.width, greaterThan(390 - 32));
    });

    screenTest('legal typography shrinks headings and paragraphs', (tester) async {
      await pumpApp(tester, MarkdownContent(content: '# H\n\nP text', typography: ContentTypography.legal(ContentTypography.markdown), selectable: false), overrides: baseOverrides());
      await tester.pumpAndSettle();
      expect(styleOf(tester, 'H')?.fontSize, 18);
      expect(styleOf(tester, 'P text')?.fontSize, 14);
    });

    screenTest('RTL lays out lists from the right', (tester) async {
      await pumpApp(tester, const SizedBox(width: 390, child: MarkdownContent(content: '- عنصر', selectable: false)), overrides: baseOverrides(), rtl: true);
      await tester.pumpAndSettle();
      final bullet = tester.getTopRight(find.text('•'));
      expect(bullet.dx, greaterThan(300));
    });

    screenTest('chat variant uses text-sm leading-relaxed', (tester) async {
      await pumpApp(tester, const MarkdownContent(content: 'salam', variant: ContentVariant.chat, selectable: false), overrides: baseOverrides());
      await tester.pumpAndSettle();
      expect(styleOf(tester, 'salam')?.fontSize, 14);
    });
  });

  group('HtmlContent', () {
    screenTest('renders headings, lists, tables (scrolling) and links', (tester) async {
      final links = <String>[];
      const html = '<h1>Böyük</h1><p>Mətn <a href="https://anacan.az">keçid</a></p><ul><li>bir</li></ul><table><thead><tr><th>A uzun başlıq uzun başlıq uzun başlıq</th><th>B uzun başlıq uzun başlıq uzun başlıq</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table><img src="https://x.test/i.png" alt="i">';
      await pumpApp(tester, Padding(padding: const EdgeInsets.all(16), child: HtmlContent(content: html, onTapLink: links.add, imageBuilder: img)), overrides: baseOverrides());
      await tester.pumpAndSettle();
      expect(allText(tester), contains('Böyük'));
      expect(styleOf(tester, 'Böyük')?.fontSize, 24);
      expect(allText(tester), contains('bir'));
      expect(find.byKey(const ValueKey<String>('img:https://x.test/i.png')), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w is SingleChildScrollView && w.scrollDirection == Axis.horizontal), findsWidgets);
    });

    screenTest('plain text falls back to pre-wrapped text', (tester) async {
      await pumpApp(tester, const HtmlContent(content: 'line 1\nline 2'), overrides: baseOverrides());
      expect(find.text('line 1\nline 2'), findsOneWidget);
    });
  });
}
