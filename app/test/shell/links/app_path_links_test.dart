// Ported from: src/lib/app-path-links.test.ts
import 'package:anacan/shell/links/app_path_links.dart';
import 'package:anacan/shell/links/deeplink.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('appLinkForPath', () {
    final ok = <(String, String, ParsedDeeplink)>[
      ('/tools', 'anacan://tools', const ParsedDeeplink('tab', {'tab': 'tools'})),
      ('/tools/', 'anacan://tools', const ParsedDeeplink('tab', {'tab': 'tools'})),
      ('/premium', 'anacan://premium', const ParsedDeeplink('screen', {'screen': 'billing'})),
      ('/tool/kick-counter', 'anacan://tool/kick-counter', const ParsedDeeplink('tool', {'tool_id': 'kick-counter'})),
      ('/community/post/7f1c2d9e-1b2a-4c3d-9e8f-001122334455', 'anacan://community/post/7f1c2d9e-1b2a-4c3d-9e8f-001122334455',
          const ParsedDeeplink('community-post', {'post_id': '7f1c2d9e-1b2a-4c3d-9e8f-001122334455'})),
      ('/community', 'anacan://community', const ParsedDeeplink('tab', {'tab': 'community'})),
      ('/books', 'anacan://books', const ParsedDeeplink('screen', {'screen': 'books'})),
      ('/parenting/sos/shop-tantrum', 'anacan://parenting/sos/shop-tantrum',
          const ParsedDeeplink('tool', {'tool_id': 'parenting', 'parenting_kind': 'sos', 'parenting_id': 'shop-tantrum'})),
      ('/user/abc-123', 'anacan://user/abc-123', const ParsedDeeplink('user-profile', {'user_id': 'abc-123'})),
    ];
    for (final (path, href, parsed) in ok) {
      test('$path opens the app screen', () {
        expect(appLinkForPath(path), href);
        expect(parseDeeplink(href), parsed);
      });
    }

    test('keeps a supported language and drops every other query value', () {
      expect(appLinkForPath('/tools', '?language=ru&next=https://evil.example'), 'anacan://tools?language=ru');
      expect(appLinkForPath('/tools', '?language=xx'), 'anacan://tools');
    });

    for (final path in [
      '/', '', '/nope', '/tool', '/tool/a/b', '/community/post', '/community/post/a/b', '/tools/extra',
      '/blog', '/legal/privacy', '/tool/%3Cscript%3E', '/tool/..', '/community/post/a.b', '/wp-admin.php',
      '/tool/${'a' * 101}',
    ]) {
      test('$path stays a 404', () => expect(appLinkForPath(path), isNull));
    }
  });

  group('remembered app link', () {
    test('is handed over once', () {
      final s = AppLinkStore()..remember('anacan://tools', nowMs: 1000);
      expect(s.take(nowMs: 2000), 'anacan://tools');
      expect(s.take(nowMs: 2000), isNull);
    });

    test('expires and ignores tampered values', () {
      final s = AppLinkStore()..remember('anacan://premium', nowMs: 0);
      expect(s.take(nowMs: kAppLinkTtl.inMilliseconds + 1), isNull);
      s.putRaw('https://evil.example', 0);
      expect(s.take(nowMs: 1), isNull);
      s.putRaw('anacan://nope-nope', 0);
      expect(s.take(nowMs: 1), isNull);
    });
  });
}
