// Ported from: src/styles/blog-content.css (.blog-table-scroll / pre local horizontal scroll), src/components/blog/
//              BlogEditorialSections.tsx (BlogContents → heading anchors) — rendering checks of the Flutter reader
import 'package:anacan/features/blog/content/blog_content.dart';
import 'package:anacan/features/blog/ui/blog_prose.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart' show HtmlWidgetState;

import '../settings/support/harness.dart';

void main() {
  setUpAll(loadAnacanFonts);

  screenTest('tables and code blocks scroll in their own box; headings keep their section anchors', (tester) async {
    final prepared = prepareBlogContent('## Dose\n\nIntro text.\n\n| Unit | Value |\n| --- | --- |\n| **micrograms** | 400 |\n\n```js\nconst dose = "400 mcg";\n```\n\n## Later');
    final key = GlobalKey<HtmlWidgetState>();
    await pumpApp(tester, BlogProseHtml(html: prepared.content, htmlKey: key, imageBuilder: (src, alt) => const SizedBox()), scroll: false);
    await tester.pump();
    await tester.pump();
    final horizontal = find.byWidgetPredicate((w) => w is SingleChildScrollView && w.scrollDirection == Axis.horizontal);
    expect(horizontal, findsAtLeastNWidgets(2), reason: 'the table box (28rem minimum) and the pre block scroll on their own');
    expect(find.textContaining('micrograms', findRichText: true), findsOneWidget);
    expect(find.text('const dose = "400 mcg";'), findsOneWidget);
    expect(prepared.headings.map((h) => h.id).toList(), ['section-1', 'section-2']);
    expect(key.currentState, isNotNull, reason: 'the TOC scrolls through HtmlWidgetState.scrollToAnchor');
  });
}
