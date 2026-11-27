// Ported from: src/components/BlogScreen.tsx, src/components/blog/BlogPostDetail.tsx, src/components/blog/RelatedPosts.tsx,
//              src/components/blog/ModuleArticles.tsx (behaviour checks; React has no vitest for these screens)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/blog/data/use_blog.dart';
import 'package:anacan/features/blog/ui/blog_screen.dart';
import 'package:anacan/features/blog/ui/blog_sections.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../shell/nav/shell_test_support.dart' show FakePlatform;
import '../settings/support/harness.dart';
import 'support.dart';

const _editorial = {
  'schema': 'anacan-blog-editorial-v1',
  'lifeStages': ['bump'],
  'modules': ['hospitalBag'],
  'relatedSlugs': ['post-3'],
  'locales': {
    'az': {'seoTitle': 'S', 'seoDescription': 'D', 'coverAlt': 'A', 'tags': ['çanta'], 'faq': [{'question': 'Nə vaxt?', 'answer': '36-cı həftə.'}]},
  },
};

Future<void> _pumpScreen(WidgetTester tester, FakeBlogBackend backend, {String? slug, String? lifeStage, VoidCallback? onBack, FakePlatform? platform}) async {
  await pumpApp(
    tester,
    BlogScreen(onBack: onBack ?? () {}, initialSlug: slug, lifeStage: lifeStage),
    overrides: blogOverrides(backend, platform: platform),
    scroll: false,
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  setUpAll(() async {
    await loadAnacanFonts();
    await ensureDateLocales();
  });

  screenTest('lists posts (stage first), filters by category and search, opens an article and counts the view', (tester) async {
    final backend = FakeBlogBackend(
      posts: [blogPost('1', lifeStage: 'flow'), blogPost('2', category: 'feeding', lifeStage: 'mommy', featured: true), blogPost('3', lifeStage: 'mommy')],
      categories: [
        {'id': 'k1', 'slug': 'baby', 'name': 'Körpə', 'icon': '👶', 'sort_order': 1},
        {'id': 'k2', 'slug': 'feeding', 'name': 'Qidalanma', 'icon': '🍼', 'sort_order': 2},
      ],
    );
    final platform = FakePlatform();
    await _pumpScreen(tester, backend, lifeStage: 'mommy', platform: platform);
    expect(platform.views, [('Blog', 'Content')]);
    expect(find.text('⭐ Önə Çıxan'), findsOneWidget);
    expect(find.byKey(const ValueKey('featured-2')), findsOneWidget);
    final order = [
      for (final e in find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.startsWith('blog-row-')).evaluate())
        '${(e.widget.key as ValueKey).value}',
    ];
    expect(order, ['blog-row-2', 'blog-row-3', 'blog-row-1'], reason: 'current life stage first, stable');

    await tester.tap(find.byKey(const ValueKey('blog-category-feeding')));
    await tester.pump();
    expect(find.byKey(const ValueKey('blog-row-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('blog-row-1')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('blog-filter-all')));
    await tester.enterText(find.byKey(const ValueKey('blog-search')), 'tag3');
    await tester.pump();
    expect(find.byKey(const ValueKey('blog-row-3')), findsOneWidget);
    expect(find.byKey(const ValueKey('blog-row-2')), findsNothing);
    expect(find.text('"tag3" üçün nəticələr'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('blog-row-3')));
    await tester.pump();
    await tester.pump();
    expect(backend.calls, contains('view:3'));
    expect(find.text('Title 3'), findsWidgets);
    expect(find.text('Məqalə müəllifi'), findsOneWidget);
  });

  screenTest('opens a linked slug directly, counts the view once and its back leaves the screen', (tester) async {
    final backend = FakeBlogBackend(posts: [blogPost('1', slug: 'exact')]);
    var backs = 0;
    await _pumpScreen(tester, backend, slug: 'exact', onBack: () => backs++);
    await tester.pump();
    expect(backend.calls.where((c) => c == 'view:1'), hasLength(1));
    expect(find.text('Title 1'), findsWidgets);
    await tester.tap(find.bySemanticsLabel('Geri').first);
    await tester.pump();
    expect(backs, 1);
  });

  screenTest('a missing or country-hidden article shows the unavailable note', (tester) async {
    final backend = FakeBlogBackend(posts: [blogPost('1', slug: 'hidden', extra: {'countries_include': ['TR']})]);
    await _pumpScreen(tester, backend, slug: 'hidden');
    await tester.pump();
    expect(find.text('Bu məqalə əlçatan deyil.'), findsOneWidget);
  });

  screenTest('likes, saves and comments through the backend', (tester) async {
    final backend = FakeBlogBackend(posts: [blogPost('1', slug: 'a')]);
    await _pumpScreen(tester, backend, slug: 'a');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('blog-like')));
    await tester.pump();
    expect(backend.calls, contains('like:1'));
    expect(find.text('4'), findsOneWidget, reason: 'like count +1');
    await tester.tap(find.byKey(const ValueKey('blog-save')));
    await tester.pump();
    expect(find.text('Saxlanıldı'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('blog-new-comment')), '  Çox faydalı  ');
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('blog-send-comment')));
    await tester.tap(find.byKey(const ValueKey('blog-send-comment')));
    await tester.pump();
    await tester.pump();
    expect(backend.calls, contains('comment:1:Çox faydalı:-'));
    expect(find.text('Çox faydalı'), findsOneWidget);
    expect(find.text('Şərhlər (1)'), findsOneWidget);
    await tester.pump(const Duration(seconds: 6));
  });

  test('related posts: explicit slugs, modules, category, tags and author, topped up with recent posts', () {
    final current = blogPost('1', extra: {'editorial_metadata': _editorial, 'tags': ['A', 'b']});
    final all = [
      current,
      blogPost('2', category: 'other', extra: {'author_name': 'Someone', 'tags': <String>[]}),
      blogPost('3', category: 'other', extra: {'author_name': 'Someone', 'tags': <String>[]}),
      blogPost('4', extra: {'tags': ['a']}),
      blogPost('5', category: 'other', extra: {'author_name': 'X', 'tags': <String>[], 'is_published': false}),
    ];
    expect([for (final p in relatedBlogPosts(current, all)) p['id']], ['3', '4', '2'], reason: '3: related slug (20); 4: category+tag+author (5); 2: recent top-up');
  });

  screenTest('module articles list up to three posts of the module for the current stage', (tester) async {
    final backend = FakeBlogBackend(posts: [
      for (var i = 1; i <= 5; i++) blogPost('$i', extra: {'editorial_metadata': _editorial}),
      blogPost('6', extra: {'editorial_metadata': {..._editorial, 'lifeStages': ['mommy']}}),
    ]);
    final store = seededStore(user: {'lifeStage': 'bump'});
    await pumpApp(tester, const ModuleArticles(module: 'hospitalBag'), overrides: blogOverrides(backend, store: store));
    await tester.pump();
    await tester.pump();
    expect(find.text('Əlaqəli məqalələr'), findsOneWidget);
    expect(find.textContaining('Title '), findsNWidgets(3));
    expect(find.text('Title 6'), findsNothing);
  });

  test('country filter: include list requires the country, exclude list hides it', () {
    expect(passesCountryFilter({'countries_include': ['AZ']}, 'AZ'), isTrue);
    expect(passesCountryFilter({'countries_include': ['AZ']}, null), isFalse);
    expect(passesCountryFilter({'countries_exclude': ['TR']}, 'TR'), isFalse);
    expect(passesCountryFilter({'countries_exclude': ['TR']}, null), isTrue);
    expect(passesCountryFilter(const {}, 'AZ'), isTrue);
  });
}
