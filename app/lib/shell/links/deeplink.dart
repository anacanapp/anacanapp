// Ported from: src/lib/deeplink.ts (parseDeeplink, generateDeeplink, DEEPLINK_ROUTES keys/patterns)
import 'package:flutter/foundation.dart';

import '../../core/i18n/app_languages.dart' show isAppLanguage;
import 'entry_policy.dart';
import 'js_url.dart';

/// `ParsedDeeplink`: `{ action, params }` exactly as the React router receives it.
///
/// Actions: `tab`, `tool`, `screen`, `messages`, `user-profile`, `community-post`, `blog-module`.
@immutable
class ParsedDeeplink {
  const ParsedDeeplink(this.action, [this.params = const {}]);
  final String action;
  final Map<String, String> params;

  ParsedDeeplink withParam(String key, String value) => ParsedDeeplink(action, {...params, key: value});

  @override
  bool operator ==(Object other) => other is ParsedDeeplink && other.action == action && mapEquals(other.params, params);
  @override
  int get hashCode => Object.hash(action, Object.hashAllUnordered(params.entries.map((e) => Object.hash(e.key, e.value))));
  @override
  String toString() => 'ParsedDeeplink($action, $params)';
}

/// One documented route (`DEEPLINK_ROUTES`; labels are admin-only and not ported).
class DeeplinkRoute {
  const DeeplinkRoute(this.key, this.pattern, this.example);
  final String key;
  final String pattern;
  final String example;
}

/// `DEEPLINK_ROUTES` (keys, patterns, examples).
const List<DeeplinkRoute> kDeeplinkRoutes = [
  DeeplinkRoute('home', '/', '/'),
  DeeplinkRoute('tools', '/tools', '/tools'),
  DeeplinkRoute('ai', '/ai', '/ai'),
  DeeplinkRoute('community', '/community', '/community'),
  DeeplinkRoute('profile', '/profile', '/profile'),
  DeeplinkRoute('cakes', '/cakes', '/cakes'),
  DeeplinkRoute('books', '/books', '/books'),
  DeeplinkRoute('my-books', '/my-books', '/my-books'),
  DeeplinkRoute('tool', '/tool/{tool_id}', '/tool/names'),
  DeeplinkRoute('parenting-item', '/parenting/{kind}/{id}', '/parenting/sos/shop-tantrum'),
  DeeplinkRoute('premium', '/premium', '/premium'),
  DeeplinkRoute('settings', '/settings', '/settings'),
  DeeplinkRoute('notifications', '/notifications', '/notifications'),
  DeeplinkRoute('calendar', '/calendar', '/calendar'),
  DeeplinkRoute('help', '/help', '/help'),
  DeeplinkRoute('edit-profile', '/edit-profile', '/edit-profile'),
  DeeplinkRoute('appearance', '/appearance', '/appearance'),
  DeeplinkRoute('blog', '/blog', '/blog'),
  DeeplinkRoute('blog-post', '/blog/{slug}', '/blog/my-article'),
  DeeplinkRoute('messages', '/messages', '/messages'),
  DeeplinkRoute('messages-user', '/messages/{user_id}', '/messages/abc-123'),
  DeeplinkRoute('community-post', '/community/post/{post_id}', '/community/post/abc-123'),
  DeeplinkRoute('user-profile', '/user/{user_id}', '/user/abc-123'),
  DeeplinkRoute('legal', '/legal/{doc_type}', '/legal/privacy'),
];

const List<String> _blogModules = ['sleep', 'feeding', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar'];
final RegExp _localizedBlog =
    RegExp(r'^/blog/(az|en|tr|ru|de|ar|ka|kk|uz|zh|id|fr|es|pt|vi|hi|ja|ko|pl|nl|sv)(?:/([^/]+))?$');
final RegExp _localizedSlugBad = RegExp(r'[\s/\\\u0000-\u001f<>?#]', unicode: true);
final RegExp _slugBad = RegExp(r'[\s/\\\u0000-\u001f<>]');

ParsedDeeplink? _parseRoute(String url) {
  String path;
  String query;
  if (url.startsWith('anacan://') || url.startsWith('com.atlasoon.anacan://')) {
    final parsed = JsUrl.parse(url);
    if (parsed == null) return null;
    if (parsed.username.isNotEmpty || parsed.password.isNotEmpty || parsed.port.isNotEmpty) return null;
    path = '/${parsed.hostname}${parsed.pathname}';
    query = parsed.search;
  } else if (url.startsWith('https://')) {
    final parsed = JsUrl.parse(url);
    if (parsed == null) return null;
    if (!kAppEntryHosts.contains(parsed.hostname) ||
        parsed.username.isNotEmpty ||
        parsed.password.isNotEmpty ||
        parsed.port.isNotEmpty) {
      return null;
    }
    path = parsed.pathname;
    query = parsed.search;
  } else if (url.startsWith('/')) {
    final parsed = JsUrl.parse(url, base: 'https://app.anacan.az');
    if (parsed == null || parsed.origin != 'https://app.anacan.az') return null;
    path = parsed.pathname;
    query = parsed.search;
  } else {
    return null;
  }

  // Remove trailing slash
  path = path.replaceFirst(RegExp(r'/$'), '');
  if (path.isEmpty) path = '/';

  final parameters = JsSearchParams(query);
  final requestedModule = parameters.get('blog_module');
  if (requestedModule != null && requestedModule.isNotEmpty && _blogModules.contains(requestedModule)) {
    final destination = appLaunchDestination('https://app.anacan.az$path$query');
    return ParsedDeeplink('blog-module', {'module': requestedModule, 'language': destination.language});
  }
  final localized = _localizedBlog.firstMatch(path);
  if (localized != null) {
    try {
      final slug = localized.group(2) != null ? decodeUriComponent(localized.group(2)!) : '';
      if (slug.isNotEmpty && _localizedSlugBad.hasMatch(slug)) return null;
      return ParsedDeeplink('screen', {'screen': slug.isNotEmpty ? 'blog/$slug' : 'blog', 'language': localized.group(1)!});
    } on FormatException {
      return null;
    }
  }

  switch (path) {
    case '/':
      return const ParsedDeeplink('tab', {'tab': 'home'});
    case '/tools':
      return const ParsedDeeplink('tab', {'tab': 'tools'});
    case '/ai':
      return const ParsedDeeplink('tab', {'tab': 'ai'});
    case '/community':
      return const ParsedDeeplink('tab', {'tab': 'community'});
    case '/profile':
      return const ParsedDeeplink('tab', {'tab': 'profile'});
    case '/cakes':
      return const ParsedDeeplink('tab', {'tab': 'cakes'});
    case '/books':
      return const ParsedDeeplink('screen', {'screen': 'books'});
    case '/my-books':
      return const ParsedDeeplink('screen', {'screen': 'my-books'});
  }

  final tool = RegExp(r'^/tool/([^/]+)$').firstMatch(path);
  if (tool != null) {
    final widgetAction = parameters.get('widget_action');
    return ParsedDeeplink('tool', {
      'tool_id': tool.group(1)!,
      if (widgetAction != null && widgetAction.isNotEmpty) 'widget_action': widgetAction,
    });
  }

  final parenting = RegExp(r'^/parenting/(sos|article|programme)/([a-z0-9-]{1,60})$').firstMatch(path);
  if (parenting != null) {
    return ParsedDeeplink('tool', {'tool_id': 'parenting', 'parenting_kind': parenting.group(1)!, 'parenting_id': parenting.group(2)!});
  }

  switch (path) {
    case '/premium':
      return const ParsedDeeplink('screen', {'screen': 'billing'});
    case '/settings':
      return const ParsedDeeplink('screen', {'screen': 'settings'});
    case '/notifications':
      return const ParsedDeeplink('screen', {'screen': 'notifications'});
    case '/calendar':
      return const ParsedDeeplink('screen', {'screen': 'calendar'});
    case '/help':
      return const ParsedDeeplink('screen', {'screen': 'help'});
    case '/edit-profile':
      return const ParsedDeeplink('screen', {'screen': 'edit-profile'});
    case '/appearance':
      return const ParsedDeeplink('screen', {'screen': 'appearance'});
    case '/blog':
      return const ParsedDeeplink('screen', {'screen': 'blog'});
  }

  final blog = RegExp(r'^/blog/([^/]+)$').firstMatch(path);
  if (blog != null) {
    try {
      final slug = decodeUriComponent(blog.group(1)!);
      if (_slugBad.hasMatch(slug) || slug == '.' || slug == '..') return null;
      return ParsedDeeplink('screen', {'screen': 'blog/$slug'});
    } on FormatException {
      return null;
    }
  }

  if (path == '/messages') return const ParsedDeeplink('messages', {});
  final msg = RegExp(r'^/messages/([^/]+)$').firstMatch(path);
  if (msg != null) return ParsedDeeplink('messages', {'user_id': msg.group(1)!});

  final post = RegExp(r'^/community/post/([^/]+)$').firstMatch(path);
  if (post != null) return ParsedDeeplink('community-post', {'post_id': post.group(1)!});

  final user = RegExp(r'^/user/([^/]+)$').firstMatch(path);
  if (user != null) return ParsedDeeplink('user-profile', {'user_id': user.group(1)!});

  final legal = RegExp(r'^/legal/([^/]+)$').firstMatch(path);
  if (legal != null) return ParsedDeeplink('screen', {'screen': 'legal/${legal.group(1)!}'});

  return null;
}

/// `parseDeeplink(url)`: `anacan://`, `com.atlasoon.anacan://`, `https://<APP_ENTRY_HOSTS>/…` and
/// app-relative `/…`; null for anything else. A supported `blog_language`/`language` query is
/// copied into `params.language`.
ParsedDeeplink? parseDeeplink(String url) {
  final parsed = _parseRoute(url);
  if (parsed == null) return null;
  final query = JsUrl.parse(url, base: 'https://app.anacan.az')?.searchParams;
  final blogLanguage = query?.get('blog_language');
  final language = (blogLanguage != null && blogLanguage.isNotEmpty) ? blogLanguage : query?.get('language');
  if (language != null && isAppLanguage(language)) return parsed.withParam('language', language);
  return parsed;
}

/// `generateDeeplink(pattern, params, format)`.
String generateDeeplink(String pattern, {Map<String, String> params = const {}, bool scheme = false}) {
  var path = pattern;
  for (final e in params.entries) {
    path = path.replaceFirst('{${e.key}}', e.value);
  }
  if (scheme) return path == '/' ? 'anacan:///' : 'anacan:/$path';
  return 'https://app.anacan.az$path';
}
