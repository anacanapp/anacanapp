// Ported from: src/lib/blog-links.ts (validBlogSlug, blogLinks, appBlogSlug, isWebsiteBlogLink,
//              rememberBlog/pendingBlog/clearPendingBlog), src/lib/blog-module-navigation.ts,
//              src/lib/blog-editorial.ts (BLOG_MODULES)
//
// sessionStorage (`anacan-pending-blog-v1`, `anacan-blog-module-navigation-v1`) is per WebView process;
// natively these hand-offs live in memory for the process lifetime, which is the same scope.
import 'js_url.dart';

final RegExp _slugBad = RegExp(r'[\s/\\\u0000-\u001f<>]', unicode: true);
const String _blogLocales = 'az|en|tr|ru|de|ar|ka|kk|uz|zh|id|fr|es|pt|vi|hi|ja|ko|pl|nl|sv';
final RegExp _blogPath = RegExp('^/blog/(?:(?:$_blogLocales)/)?([^/]+)/?\$');

/// `validBlogSlug(value)`.
bool validBlogSlug(Object? value) =>
    value is String && value.isNotEmpty && value.length <= 300 && value != '.' && value != '..' && !_slugBad.hasMatch(value);

/// `blogLinks(slug, language)`: the public website link and the app hand-off link.
({String website, String app}) blogLinks(String slug, [String? language]) {
  if (!validBlogSlug(slug)) throw ArgumentError('BLOG_SLUG_INVALID');
  final locale = language != null && RegExp('^(?:$_blogLocales)\$').hasMatch(language) ? language : '';
  final hasLanguage = language != null && language.isNotEmpty;
  final path = '/blog${locale.isNotEmpty && locale != 'az' ? '/$locale' : ''}/${encodeUriComponent(slug)}${hasLanguage ? '/' : ''}';
  return (
    website: 'https://${hasLanguage ? 'app.anacan.az' : 'anacan.az'}$path',
    app: 'https://${hasLanguage ? 'app.anacan.az' : 'api.anacan.az'}/blog/${encodeUriComponent(slug)}',
  );
}

/// `appBlogSlug(value)`: the article slug of an app link (`anacan://blog/…`, app hosts), else null.
String? appBlogSlug(String value) {
  final url = JsUrl.parse(value);
  if (url == null || url.username.isNotEmpty || url.password.isNotEmpty || url.port.isNotEmpty) return null;
  String path;
  if (url.protocol == 'anacan:' && url.hostname == 'blog') {
    path = '/blog${url.pathname}';
  } else if (url.protocol == 'https:' && const ['api.anacan.az', 'app.anacan.az', 'gcp.anacan.az'].contains(url.hostname)) {
    path = url.pathname;
  } else {
    return null;
  }
  final match = _blogPath.firstMatch(path);
  if (match == null) return null;
  try {
    final slug = decodeUriComponent(match.group(1)!);
    return validBlogSlug(slug) ? slug : null;
  } on FormatException {
    return null;
  }
}

/// `isWebsiteBlogLink(value)`.
bool isWebsiteBlogLink(String value) {
  final u = JsUrl.parse(value);
  if (u == null) return false;
  final match = _blogPath.firstMatch(u.pathname);
  if (u.protocol != 'https:' || !const ['anacan.az', 'app.anacan.az'].contains(u.hostname) || u.username.isNotEmpty ||
      u.password.isNotEmpty || u.port.isNotEmpty || match == null) {
    return false;
  }
  try {
    return validBlogSlug(decodeUriComponent(match.group(1)!));
  } on FormatException {
    return false;
  }
}

/// `rememberBlog` / `pendingBlog` / `clearPendingBlog` (24 h hand-off across sign-in).
class PendingBlogStore {
  PendingBlogStore({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  final DateTime Function() _clock;
  ({String slug, DateTime at})? _value;

  void remember(String slug) {
    if (!validBlogSlug(slug)) return;
    _value = (slug: slug, at: _clock());
  }

  String? pending() {
    final v = _value;
    if (v == null) return null;
    final age = _clock().difference(v.at);
    return !age.isNegative && age < const Duration(days: 1) ? v.slug : null;
  }

  void clear() => _value = null;
}

/// `BLOG_MODULES`.
const List<String> kBlogModules = ['feeding', 'sleep', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar'];

/// `isBlogModule(value)`.
bool isBlogModule(Object? value) => value is String && kBlogModules.contains(value);

/// `rememberBlogModule` / `consumeBlogModule` (24 h hand-off until the profile is ready).
class BlogModuleStore {
  BlogModuleStore({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  final DateTime Function() _clock;
  ({String module, DateTime at})? _value;

  void remember(String module) {
    if (!isBlogModule(module)) return;
    _value = (module: module, at: _clock());
  }

  /// Removes the stored module either way; returns it when still fresh.
  String? consume() {
    final v = _value;
    _value = null;
    if (v == null) return null;
    final age = _clock().difference(v.at);
    return !age.isNegative && age < const Duration(days: 1) ? v.module : null;
  }
}
