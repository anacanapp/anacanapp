// Ported from: src/lib/blog-editorial.test.ts
import 'package:anacan/features/blog/data/blog_editorial.dart';
import 'package:anacan/shell/links/blog_links.dart' show BlogModuleStore, isBlogModule;
import 'package:flutter_test/flutter_test.dart';

const Map<String, dynamic> metadata = {
  'schema': 'anacan-blog-editorial-v1',
  'lifeStages': ['mommy', 'bump'],
  'modules': ['feeding'],
  'relatedSlugs': <String>[],
  'locales': {
    'az': {'seoTitle': 'Ana südü', 'seoDescription': 'Qidalanma', 'coverAlt': 'Şəkil', 'tags': ['süd'], 'faq': <Object>[]},
  },
};

void main() {
  test('uses explicit multi-stage editorial targeting and preserves legacy all-stage content', () {
    expect(blogMatchesStage({'life_stage': 'mommy', 'editorial_metadata': metadata}, 'bump'), isTrue);
    expect(blogMatchesStage({'life_stage': 'mommy', 'editorial_metadata': metadata}, 'flow'), isFalse);
    expect(blogMatchesStage({'life_stage': 'all'}, 'flow'), isTrue);
  });

  test('does not silently project an absent SEO locale and provides stable crawlable paths', () {
    expect(blogLocale(metadata, 'ja'), isNull);
    expect(blogLocale(metadata, 'az')?.seoTitle, 'Ana südü');
    expect(blogPath('süd', 'en'), '/blog/en/s%C3%BCd/');
  });

  test('retains only known expiring module navigation across authentication', () {
    final store = BlogModuleStore();
    expect(isBlogModule('admin'), isFalse);
    store.remember('feeding');
    expect(store.consume(), 'feeding');
    expect(store.consume(), isNull);
  });
}
