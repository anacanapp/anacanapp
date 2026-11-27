// Ported from: src/hooks/useBlog.compact.test.ts
import 'package:anacan/features/blog/data/use_blog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('compactBlogPost', () {
    test('keeps localized fields and the active locale, drops other translations', () {
      final post = <String, dynamic>{
        'id': '1', 'title': 'Başlıq', 'content': 'Mətn', 'title_en': 'Title', 'content_en': 'Text', 'content_ru': 'Текст', 'excerpt_tr': 'Özet',
        'tags': ['a'], 'tags_en': ['b'],
        'editorial_metadata': {
          'schema': 'anacan-blog-editorial-v1',
          'locales': {'az': {'seoTitle': 'az'}, 'en': {'seoTitle': 'en'}, 'ru': {'seoTitle': 'ru'}},
          'lifeStages': <String>[], 'modules': <String>[], 'relatedSlugs': <String>[],
        },
      };
      final out = compactBlogPost(post, 'en');
      expect(out, containsPair('id', '1'));
      expect(out, containsPair('title', 'Başlıq'));
      expect(out, containsPair('content', 'Mətn'));
      expect(out['tags'], ['a']);
      expect(out['tags_en'], ['b']);
      expect(out.containsKey('content_en'), isFalse);
      expect(out.containsKey('content_ru'), isFalse);
      expect(out.containsKey('excerpt_tr'), isFalse);
      expect((out['editorial_metadata']['locales'] as Map).keys.toList()..sort(), ['az', 'en']);
      expect(out['editorial_metadata']['schema'], 'anacan-blog-editorial-v1');
    });
  });
}
