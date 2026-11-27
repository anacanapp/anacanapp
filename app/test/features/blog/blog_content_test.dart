// Ported from: src/lib/blog-content.test.ts
// ignore_for_file: depend_on_referenced_packages
import 'package:anacan/features/blog/content/blog_content.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:html/dom.dart' as dom;

({String content, List<BlogHeading> headings, dom.Element element}) render(String source, [bool nativeCompatibility = false]) {
  final rendered = prepareBlogContent(source, nativeCompatibility: nativeCompatibility);
  final element = dom.Element.tag('div')..innerHtml = rendered.content;
  return (content: rendered.content, headings: rendered.headings, element: element);
}

String text(dom.Element e) => e.text;

void main() {
  group('app blog Markdown/HTML content', () {
    test('renders GFM headings, lists, inline HTML, links and locally scrollable tables', () {
      final r = render('# Guide\n\n## Clinical **notes**\n\n- First\n  - Nested\n\n3. Third\n4. Fourth\n\nText with <em>HTML</em> and <a href="https://www.nhs.uk">linked HTML</a>.\n\n| Unit | Value |\n| --- | --- |\n| **micrograms** | 400 |');
      expect(r.headings, [const BlogHeading('section-1', 'Guide'), const BlogHeading('section-2', 'Clinical notes')]);
      expect(r.element.querySelector('h1'), isNull);
      expect(r.element.querySelector('ul ul li')?.text, 'Nested');
      expect(r.element.querySelector('ol')?.attributes['start'], '3');
      expect(r.element.querySelector('em')?.text, 'HTML');
      expect(r.element.querySelector('a')?.text, 'linked HTML');
      expect(r.element.querySelector('a')?.attributes['rel'], 'noopener noreferrer');
      expect(r.element.querySelector('.blog-table-scroll[tabindex="0"] > table td strong')?.text, 'micrograms');
      expect(r.element.querySelector('.blog-table-scroll')?.attributes['aria-labelledby'], 'section-2');
    });

    test('repairs pasted Markdown inside rich-text paragraphs while retaining HTML media and captions', () {
      final r = render('<h2>Existing <em>heading</em></h2><p>## Pasted heading<br><br>- One<br>- Two</p><p>**Bold** and [guide](https://www.nhs.uk).</p><figure><img src="/photo.webp" width="1200" height="675" alt="Original"><figcaption>Photo <em>caption</em></figcaption></figure>');
      expect(r.headings.map((h) => h.title).toList(), ['Existing heading', 'Pasted heading']);
      expect(r.element.querySelectorAll('ul li'), hasLength(2));
      expect(r.element.querySelector('p strong')?.text, 'Bold');
      expect(r.element.querySelector('figure img')?.attributes['alt'], 'Original');
      expect(r.element.querySelector('figure img')?.attributes['width'], '1200');
      expect(r.element.querySelector('figure figcaption em')?.text, 'caption');
    });

    test('repairs old paragraphs containing inline HTML and CJK punctuation-bound emphasis', () {
      final r = render('<p>- Until 1.5 years: <strong>44 AZN</strong> per month.</p><p>- From 1.5 to 3 years: <strong>28 AZN</strong> per month.</p>\n\n- **标题：**正文\n- **項目：**説明\n\n**How is it performed?**1. First step');
      expect(r.element.querySelectorAll('ul li'), hasLength(4));
      expect(r.element.querySelectorAll('li strong'), hasLength(4));
      expect(r.element.querySelector('p strong')?.text, 'How is it performed?');
      expect(text(r.element), isNot(contains('**')));
      expect(text(r.element), contains('1.5 years: 44 AZN'));
    });

    test('combines rich-text table rows into one table without dropping inline cell text or numbers', () {
      final r = render('<h2>Dose</h2><p>| Product | Amount |</p><p>| --- | --- |</p><p>| <strong>Folic acid</strong> | <strong>400 micrograms</strong> = 0.4 mg |</p><p>| High risk | 5 mg only with a clinician |</p><p>&gt;</p>');
      expect(r.element.querySelectorAll('.blog-table-scroll table'), hasLength(1));
      expect(r.element.querySelectorAll('tbody tr'), hasLength(2));
      expect(r.element.querySelector('td strong')?.text, 'Folic acid');
      expect(text(r.element), contains('400 micrograms = 0.4 mg'));
      expect(text(r.element), isNot(contains('| ---')));
      expect(r.element.querySelectorAll('p').any((node) => node.text.trim() == '>'), isFalse);
    });

    test('unwraps article export fences and escaped HTML without treating ordinary code as prose', () {
      for (final source in ['```html\n<h2>Export</h2><p>Article</p>\n```', '```md\n## Export\n\nArticle\n```', '&lt;h2&gt;Export&lt;/h2&gt;&lt;p&gt;Article&lt;/p&gt;']) {
        final r = render(source);
        expect(r.headings.first.title, 'Export', reason: source);
        expect(r.element.querySelector('p')?.text, 'Article', reason: source);
        expect(r.element.querySelector('pre'), isNull, reason: source);
      }
      final r = render('```\n**literal**\n```');
      expect(r.element.querySelector('pre code')?.text, contains('**literal**'));
      expect(r.element.querySelector('strong'), isNull);
    });

    test('preserves escaped syntax, code examples and clinical numbers on repeated preparation', () {
      const source = '## Dose\n\n400 micrograms = 0.4 mg; first 12 weeks. Do **not** take 5 mg without advice.\n\n\\*\\*literal\\*\\* and `**code**`.\n\n```js\nconst dose = "400 mcg";\n```';
      final first = render(source), second = render(first.content);
      expect(first.element.querySelectorAll('strong'), hasLength(1));
      expect(text(first.element), contains('**literal**'));
      expect(text(first.element), contains('400 micrograms = 0.4 mg; first 12 weeks. Do not take 5 mg without advice.'));
      expect(second.content, first.content);
      expect(second.headings, first.headings);
    });

    test('strips executable markup, unsafe URLs, arbitrary layout classes and input styles', () {
      final r = render('<h2 id="location" class="fixed w-screen">Title</h2><p onclick="evil()" style="width:9999px">Text<script>evil()</script><a href="javascript:evil()">Unsafe</a><img src="data:image/svg+xml,bad" onerror="evil()"></p><iframe src="https://example.com"></iframe><form><input name="password"></form><svg onload="evil()"></svg>\n\n[Unsafe](javascript:evil())');
      expect(r.element.querySelector('script,iframe,form,input,svg,[onclick],[onerror],[style],.fixed,.w-screen'), isNull);
      expect(r.element.querySelectorAll('a').where((a) => (a.attributes['href'] ?? '').startsWith('javascript:')), isEmpty);
      expect(r.element.querySelectorAll('img').where((i) => (i.attributes['src'] ?? '').startsWith('data:')), isEmpty);
      expect(text(r.element), contains('Text'));
      expect(text(r.element), isNot(contains('evil()')));
    });

    test('keeps old heading links navigable and removes table width constraints', () {
      final r = render('<h1 id="intro">Intro</h1><a href="#intro">Jump</a><h2 id="table">Table</h2><table width="9000"><colgroup><col width="9000"></colgroup><tr><th width="9000">Heading</th><td height="500">Cell</td></tr></table>');
      expect(r.element.querySelector('a')?.attributes['href'], '#section-1');
      expect(r.element.querySelector('table[width],col[width],th[width],td[height]'), isNull);
      expect(r.element.querySelector('.blog-table-scroll')?.attributes['aria-labelledby'], 'section-2');
    });

    test('adds only finite owned native styles and keeps native/browser projections idempotent', () {
      const source = '<h2>Table</h2><table style="position:fixed"><tr><td>400 mcg</td><td>12 weeks</td></tr></table><figure style="width:9999px"><img src="/photo.webp" style="width:9999px"><figcaption>Caption</figcaption></figure>';
      final native = render(source, true), repeated = render(native.content, true), web = render(native.content);
      expect(native.element.querySelectorAll('.blog-native-content'), hasLength(1));
      expect(repeated.content, native.content);
      expect(native.element.querySelector('.blog-table-scroll')?.attributes['style'], contains('overflow-x:auto'));
      expect(native.element.querySelector('table')?.attributes['style'], isNot(contains('position')));
      expect(web.element.querySelector('[style]'), isNull);
      expect(text(web.element), text(native.element));
      expect(web.headings, native.headings);
    });
  });
}
