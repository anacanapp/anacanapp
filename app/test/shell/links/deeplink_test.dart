// Ported from: src/lib/deeplink.test.ts (+ table of every DEEPLINK_ROUTES pattern)
import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/shell/links/deeplink.dart';
import 'package:anacan/shell/links/entry_policy.dart';
import 'package:flutter_test/flutter_test.dart';

ParsedDeeplink p(String action, Map<String, String> params) => ParsedDeeplink(action, params);

void main() {
  test('carries module intent and locale from all three public hosts and the registered scheme', () {
    for (final host in ['app.anacan.az', 'gcp.anacan.az', 'api.anacan.az']) {
      expect(parseDeeplink('https://$host/?blog_module=sleep&blog_language=az'), p('blog-module', {'module': 'sleep', 'language': 'az'}));
    }
    expect(parseDeeplink('anacan:///?blog_module=feeding&blog_language=ru'), p('blog-module', {'module': 'feeding', 'language': 'ru'}));
    expect(parseDeeplink('anacan://blog/article?language=az'), p('screen', {'screen': 'blog/article', 'language': 'az'}));
  });

  test('round-trips every locale and module through the actual browser launch scheme', () {
    for (final language in kAppLanguageCodes) {
      final article = appLaunchLinks('https://gcp.anacan.az/blog/$language/article/');
      expect(parseDeeplink(article.scheme), p('screen', {'screen': 'blog/article', 'language': language}), reason: language);
      for (final module in ['sleep', 'feeding', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar']) {
        final links = appLaunchLinks('https://api.anacan.az/?blog_module=$module&blog_language=$language');
        expect(parseDeeplink(links.scheme), p('blog-module', {'module': module, 'language': language}), reason: '$language $module');
      }
    }
    expect(parseDeeplink('anacan://tool/baby-names?language=ja'), p('tool', {'tool_id': 'baby-names', 'language': 'ja'}));
    expect(parseDeeplink('anacan://blog/article?language=not-a-language'), p('screen', {'screen': 'blog/article'}));
  });

  test('keeps locale-prefixed articles exact and rejects deceptive destinations', () {
    expect(parseDeeplink('https://gcp.anacan.az/blog/ja/article/'), p('screen', {'screen': 'blog/article', 'language': 'ja'}));
    expect(parseDeeplink('https://gcp.anacan.az.evil.invalid/blog/article'), isNull);
    expect(parseDeeplink('https://gcp.anacan.az/blog/en/%2Fadmin'), isNull);
    expect(generateDeeplink('/', scheme: true), 'anacan:///');
  });

  test('opens the PDF book store and purchased books from app and banner deeplinks', () {
    expect(parseDeeplink('/books'), p('screen', {'screen': 'books'}));
    expect(parseDeeplink('anacan://books'), p('screen', {'screen': 'books'}));
    expect(parseDeeplink('https://app.anacan.az/my-books'), p('screen', {'screen': 'my-books'}));
    expect(parseDeeplink('/cakes'), p('tab', {'tab': 'cakes'}));
  });

  group('every route, every accepted form', () {
    // path → expected parse
    final table = <String, ParsedDeeplink>{
      '/': p('tab', {'tab': 'home'}),
      '/tools': p('tab', {'tab': 'tools'}),
      '/ai': p('tab', {'tab': 'ai'}),
      '/community': p('tab', {'tab': 'community'}),
      '/profile': p('tab', {'tab': 'profile'}),
      '/cakes': p('tab', {'tab': 'cakes'}),
      '/books': p('screen', {'screen': 'books'}),
      '/my-books': p('screen', {'screen': 'my-books'}),
      '/tool/names': p('tool', {'tool_id': 'names'}),
      '/tool/baby-tracker?widget_action=feed': p('tool', {'tool_id': 'baby-tracker', 'widget_action': 'feed'}),
      '/parenting/sos/shop-tantrum': p('tool', {'tool_id': 'parenting', 'parenting_kind': 'sos', 'parenting_id': 'shop-tantrum'}),
      '/parenting/article/a-1': p('tool', {'tool_id': 'parenting', 'parenting_kind': 'article', 'parenting_id': 'a-1'}),
      '/parenting/programme/tantrums-14': p('tool', {'tool_id': 'parenting', 'parenting_kind': 'programme', 'parenting_id': 'tantrums-14'}),
      '/premium': p('screen', {'screen': 'billing'}),
      '/settings': p('screen', {'screen': 'settings'}),
      '/notifications': p('screen', {'screen': 'notifications'}),
      '/calendar': p('screen', {'screen': 'calendar'}),
      '/help': p('screen', {'screen': 'help'}),
      '/edit-profile': p('screen', {'screen': 'edit-profile'}),
      '/appearance': p('screen', {'screen': 'appearance'}),
      '/blog': p('screen', {'screen': 'blog'}),
      '/blog/my-article': p('screen', {'screen': 'blog/my-article'}),
      '/blog/en': p('screen', {'screen': 'blog', 'language': 'en'}),
      '/blog/ru/my-article': p('screen', {'screen': 'blog/my-article', 'language': 'ru'}),
      '/messages': p('messages', {}),
      '/messages/abc-123': p('messages', {'user_id': 'abc-123'}),
      '/community/post/abc-123': p('community-post', {'post_id': 'abc-123'}),
      '/user/abc-123': p('user-profile', {'user_id': 'abc-123'}),
      '/legal/privacy': p('screen', {'screen': 'legal/privacy'}),
      '/?blog_module=calendar': p('blog-module', {'module': 'calendar', 'language': 'az'}),
    };
    for (final e in table.entries) {
      test(e.key, () {
        expect(parseDeeplink(e.key), e.value, reason: 'relative');
        expect(parseDeeplink('https://app.anacan.az${e.key}'), e.value, reason: 'universal');
        final schemePath = e.key == '/' ? '//' : e.key.startsWith('/?') ? '//${e.key.substring(1)}' : e.key;
        expect(parseDeeplink('anacan:/$schemePath'), e.value, reason: 'scheme');
        expect(parseDeeplink('com.atlasoon.anacan:/$schemePath'), e.value, reason: 'bundle scheme');
      });
    }

    test('every documented route example parses', () {
      for (final r in kDeeplinkRoutes) {
        expect(parseDeeplink(r.example), isNotNull, reason: r.key);
        expect(parseDeeplink(generateDeeplink(r.example, scheme: true)), parseDeeplink(r.example), reason: r.key);
      }
    });

    test('dot segments are resolved like the browser URL parser', () {
      expect(parseDeeplink('/blog/..'), p('tab', {'tab': 'home'}));
      expect(parseDeeplink('anacan://tool/x/../names'), p('tool', {'tool_id': 'names'}));
    });

    test('trailing slash and language query', () {
      expect(parseDeeplink('anacan://tools/'), p('tab', {'tab': 'tools'}));
      expect(parseDeeplink('anacan://tools?language=ar'), p('tab', {'tab': 'tools', 'language': 'ar'}));
      expect(parseDeeplink('anacan://tools?blog_language=ru&language=ar'), p('tab', {'tab': 'tools', 'language': 'ru'}));
    });
  });

  group('rejections', () {
    for (final url in [
      'https://evil.example/tools',
      'http://app.anacan.az/tools',
      'https://app.anacan.az:444/tools',
      'https://user:pw@app.anacan.az/tools',
      'anacan://user:pw@tools',
      'anacan://tools:99',
      'otherapp://tools',
      'tools',
      '//evil.example/tools',
      '/nope',
      '/tool',
      '/tool/a/b',
      '/blog/a%20b',
      '/blog/%E0%A4%A',
      '/parenting/sos/UPPER',
      '/parenting/other/x',
      'https://[invalid',
    ]) {
      test(url, () => expect(parseDeeplink(url), isNull));
    }
  });
}
