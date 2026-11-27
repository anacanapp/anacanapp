// Ported from: src/web-entry/policy.test.mjs (the launch-link / destination / admin-next cases; entryDecision
//              and entryPlatform are web-entry only), src/web-entry/admin.ts (admin web link)
import 'package:anacan/shell/links/entry_policy.dart';
import 'package:anacan/shell/nav/admin_web.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('selects the verified store destinations', () {
    final links = appLaunchLinks('https://gcp.anacan.az/?blog_module=sleep&blog_language=az');
    expect(links.scheme, 'anacan:///?language=az&blog_module=sleep&blog_language=az');
    expect(links.androidIntent, contains('package=com.atlasoon.anacan;'));
    expect(links.appStore, 'https://apps.apple.com/app/id6758301924');
    expect(links.androidIntent, contains(Uri.encodeComponent(links.googlePlay)));
  });

  test('keeps the requested legal and preview language after the site prefix', () {
    for (final language in ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv']) {
      expect(entryLanguage('https://gcp.anacan.az/site/$language/privacy-policy/'), language);
      expect(entryLanguage('https://api.anacan.az/site/$language/terms-of-use/'), language);
    }
    expect(entryLanguage('https://gcp.anacan.az/site/ar/privacy-policy/?language=ja'), 'ja');
  });

  test('preserves intended module/article identity without copying arbitrary queries or credentials', () {
    expect(appLaunchDestination('https://api.anacan.az/blog/ar/real-article/?web=admin&access_token=private'),
        const AppLaunchDestination(path: '/blog/real-article', language: 'ar'));
    expect(appLaunchDestination('https://app.anacan.az/?blog_module=hospitalBag').path, '/tool/hospital');
    expect(appLaunchDestination('https://evil.invalid/?blog_module=sleep').path, '/');
    expect(appLaunchDestination('https://app.anacan.az/blog/%2Fadmin').path, '/');
    expect(appLaunchLinks('https://api.anacan.az/?next=https://evil.invalid&access_token=private').scheme, isNot(contains('private')));
  });

  test('admin return targets are same-origin and re-enter through the server-verified gate', () {
    for (final target in ['https://evil.invalid', '//evil.invalid', r'/\evil.invalid', '/admin/login', '/?code=private']) {
      expect(safeAdminNext(target, 'https://app.anacan.az'), '/admin?web=admin');
    }
    expect(safeAdminNext('/?blog_module=sleep', 'https://app.anacan.az'), '/?blog_module=sleep&web=admin');
  });

  test('admin web link uses the admitted public host, else app.anacan.az', () {
    expect(adminWebUri().toString(), 'https://app.anacan.az/admin?web=admin');
    expect(adminWebUri(backendUrl: 'https://gcp.anacan.az').toString(), 'https://gcp.anacan.az/admin?web=admin');
    expect(adminWebUri(backendUrl: 'https://api.anacan.az/').toString(), 'https://api.anacan.az/admin?web=admin');
    expect(adminWebUri(backendUrl: 'https://x.azurecontainerapps.io').toString(), 'https://app.anacan.az/admin?web=admin');
    expect(adminWebUri(backendUrl: 'http://gcp.anacan.az').toString(), 'https://app.anacan.az/admin?web=admin');
  });
}
