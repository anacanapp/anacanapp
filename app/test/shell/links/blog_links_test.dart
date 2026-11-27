// Ported from: src/lib/blog-links.test.ts (+ blog-module-navigation hand-off)
import 'package:anacan/shell/links/blog_links.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps exact article identity and distinguishes the public website from the app', () {
    final links = blogLinks('körpənin-yuxusu');
    expect(links.website, 'https://anacan.az/blog/k%C3%B6rp%C9%99nin-yuxusu');
    expect(appBlogSlug(links.website), isNull);
    expect(isWebsiteBlogLink(links.website), isTrue);
    expect(appBlogSlug(links.app), 'körpənin-yuxusu');
    expect(appBlogSlug('anacan://blog/k%C3%B6rp%C9%99nin-yuxusu'), 'körpənin-yuxusu');
  });

  for (final value in [
    'https://api.anacan.az.evil.com/blog/a', 'https://api.anacan.az@evil.com/blog/a', 'https://evil.com/?url=https://api.anacan.az/blog/a',
    'https://api.anacan.az/blog/%2fadmin', 'javascript:alert(1)', 'https://api.anacan.az:444/blog/a', 'https://api.anacan.az/blog/%00',
  ]) {
    test('rejects unsafe or non-app destinations: $value', () => expect(appBlogSlug(value), isNull));
  }

  test('dispatches the article event and retains an expiring cold-start/auth handoff', () {
    var now = DateTime.utc(2026, 9, 24, 12);
    final store = PendingBlogStore(clock: () => now);
    final slug = appBlogSlug(blogLinks('sleep-guide').app);
    expect(slug, 'sleep-guide');
    store.remember(slug!);
    expect(store.pending(), 'sleep-guide');
    now = now.add(const Duration(milliseconds: 86400001));
    expect(store.pending(), isNull);
    store.remember('../admin');
    expect(store.pending(), isNull);
  });

  test('localized links carry the language and the app link stays unlocalized', () {
    final links = blogLinks('a', 'ru');
    expect(links.website, 'https://app.anacan.az/blog/ru/a/');
    expect(links.app, 'https://app.anacan.az/blog/a');
    expect(blogLinks('a', 'az').website, 'https://app.anacan.az/blog/a/');
    expect(() => blogLinks('a/b'), throwsArgumentError);
  });

  test('blog module hand-off is consumed once and expires after a day', () {
    var now = DateTime.utc(2026, 1, 1);
    final store = BlogModuleStore(clock: () => now);
    store.remember('sleep');
    expect(store.consume(), 'sleep');
    expect(store.consume(), isNull);
    store.remember('nope');
    expect(store.consume(), isNull);
    store.remember('calendar');
    now = now.add(const Duration(days: 1));
    expect(store.consume(), isNull);
    expect(kBlogModules.every(isBlogModule), isTrue);
  });
}
