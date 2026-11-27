// Ported from: src/web-entry/policy.mjs (APP_ENTRY_HOSTS, store URLs, entryLanguage,
//              appLaunchDestination, appLaunchLinks, safeAdminNext, legalDocumentType — the parts the
//              native app's deeplink parser and the admin-web link need; the browser launcher is web-only)
import 'js_url.dart';

/// Public app hosts (`APP_ENTRY_HOSTS`).
const List<String> kAppEntryHosts = ['app.anacan.az', 'gcp.anacan.az', 'api.anacan.az'];
const String kAppStoreUrl = 'https://apps.apple.com/app/id6758301924';
const String kGooglePlayUrl = 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan';
const String kAdminWebQuery = 'web';
const String kAdminWebValue = 'admin';
const String kAppPackage = 'com.atlasoon.anacan';

/// policy.mjs `languages` (25 app languages).
const List<String> kEntryLanguages = [
  'az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl',
  'sv', 'ky', 'et', 'tk', 'uk',
];

/// policy.mjs `modules` (blog editorial modules).
const List<String> kEntryModules = ['sleep', 'feeding', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar'];

List<String> _segments(String path) {
  try {
    return path.split('/').where((s) => s.isNotEmpty).map(decodeUriComponent).toList();
  } on FormatException {
    return const [];
  }
}

/// `entryLanguage(input, fallback)`.
String entryLanguage(String input, [String fallback = 'az']) {
  final url = JsUrl.parse(input);
  if (url == null) return kEntryLanguages.contains(fallback) ? fallback : 'az';
  final path = _segments(url.pathname);
  if (path.isNotEmpty && path[0] == 'site') path.removeAt(0);
  final params = url.searchParams;
  String? code = _or(params.get('blog_language'), params.get('language'));
  code = _or(code, path.isNotEmpty && path[0] == 'blog' ? (path.length > 1 ? path[1] : null) : (path.isNotEmpty ? path[0] : null));
  return code != null && kEntryLanguages.contains(code) ? code : kEntryLanguages.contains(fallback) ? fallback : 'az';
}

/// JS `a || b` for optional strings.
String? _or(String? a, String? b) => (a != null && a.isNotEmpty) ? a : b;

/// Result of `appLaunchDestination`.
class AppLaunchDestination {
  const AppLaunchDestination({required this.path, required this.language, this.module});
  final String path;
  final String language;
  final String? module;

  @override
  bool operator ==(Object other) =>
      other is AppLaunchDestination && other.path == path && other.language == language && other.module == module;
  @override
  int get hashCode => Object.hash(path, language, module);
  @override
  String toString() => 'AppLaunchDestination($path, $language${module == null ? '' : ', $module'})';
}

final RegExp _slugBad = RegExp(r'[\s/\\\u0000-\u001f<>?#]', unicode: true);
final RegExp _idSegment = RegExp(r'^[A-Za-z0-9_-]{1,100}$');

/// `appLaunchDestination(input)`.
AppLaunchDestination appLaunchDestination(String input) {
  const fallback = AppLaunchDestination(path: '/', language: 'az');
  final url = JsUrl.parse(input, base: 'https://app.anacan.az');
  if (url == null) return fallback;
  final appScheme = url.protocol == 'anacan:' || url.protocol == 'com.atlasoon.anacan:';
  if (url.username.isNotEmpty || url.password.isNotEmpty || url.port.isNotEmpty ||
      !(appScheme || url.protocol == 'https:' && kAppEntryHosts.contains(url.hostname))) {
    return fallback;
  }
  final pathname = appScheme ? '/${url.hostname}${url.pathname}' : url.pathname;
  final module = url.searchParams.get('blog_module');
  final langUrl = JsUrl.parse(pathname + url.search, base: 'https://app.anacan.az');
  // The browser would throw here for `//…` (an empty special host); never reached from parseDeeplink.
  if (langUrl == null) return fallback;
  final language = entryLanguage(langUrl.href);
  if (module != null && kEntryModules.contains(module)) {
    final path = module == 'hospitalBag'
        ? '/tool/hospital'
        : module == 'babyGrowth'
            ? '/tool/baby-growth'
            : module == 'calendar'
                ? '/calendar'
                : '/';
    return AppLaunchDestination(path: path, language: language, module: module);
  }
  final path = _segments(pathname);
  final normalized = '/${path.map(encodeUriComponent).join('/')}';
  if (path.isNotEmpty && path[0] == 'blog') {
    if (path.length > 1 && kEntryLanguages.contains(path[1])) path.removeAt(1);
    if (path.length == 1) return AppLaunchDestination(path: '/blog', language: language);
    if (path.length == 2 && path[1].length <= 300 && !_slugBad.hasMatch(path[1]) && path[1] != '.' && path[1] != '..') {
      return AppLaunchDestination(path: '/blog/${encodeUriComponent(path[1])}', language: language);
    }
  }
  const single = [
    'tools', 'ai', 'community', 'profile', 'cakes', 'premium', 'settings', 'notifications', 'calendar', 'help',
    'edit-profile', 'appearance', 'messages',
  ];
  if (path.length == 1 && single.contains(path[0])) return AppLaunchDestination(path: normalized, language: language);
  if (path.length == 2 && const ['tool', 'user', 'messages'].contains(path[0]) && _idSegment.hasMatch(path[1])) {
    return AppLaunchDestination(path: normalized, language: language);
  }
  if (path.length == 3 && path[0] == 'community' && path[1] == 'post' && _idSegment.hasMatch(path[2])) {
    return AppLaunchDestination(path: normalized, language: language);
  }
  final tab = url.searchParams.get('tab');
  if (const ['home', 'tools', 'ai', 'community', 'profile'].contains(tab)) {
    return AppLaunchDestination(path: tab == 'home' ? '/' : '/$tab', language: language);
  }
  return AppLaunchDestination(path: '/', language: language);
}

/// Result of `appLaunchLinks`.
class AppLaunchLinks {
  const AppLaunchLinks({required this.destination, required this.scheme, required this.androidIntent});
  final AppLaunchDestination destination;
  final String scheme;
  final String androidIntent;
  String get appStore => kAppStoreUrl;
  String get googlePlay => kGooglePlayUrl;
}

/// `appLaunchLinks(input)`.
AppLaunchLinks appLaunchLinks(String input) {
  final destination = appLaunchDestination(input);
  final query = StringBuffer('language=${Uri.encodeQueryComponent(destination.language)}');
  if (destination.module != null) {
    query.write('&blog_module=${Uri.encodeQueryComponent(destination.module!)}');
    query.write('&blog_language=${Uri.encodeQueryComponent(destination.language)}');
  }
  final schemePath = destination.path == '/' ? '//' : destination.path;
  final scheme = 'anacan:/$schemePath?$query';
  return AppLaunchLinks(
    destination: destination,
    scheme: scheme,
    androidIntent: 'intent:/$schemePath?$query#Intent;scheme=anacan;package=$kAppPackage'
        ';S.browser_fallback_url=${encodeUriComponent(kGooglePlayUrl)};end',
  );
}

/// `safeAdminNext(value, origin)`: a same-origin admin return target that re-enters the staff gate.
String safeAdminNext(Object? value, String origin) {
  const fallback = '/admin?web=admin';
  if (value is! String || !value.startsWith('/') || value.startsWith('//') || RegExp(r'[\\\u0000-\u001f]').hasMatch(value)) {
    return fallback;
  }
  final url = JsUrl.parse(value, base: origin);
  if (url == null) return fallback;
  if (url.origin != origin || url.username.isNotEmpty || url.password.isNotEmpty ||
      RegExp(r'^/admin/login/?$').hasMatch(url.pathname) ||
      RegExp(r'(?:access_token|refresh_token|code)=').hasMatch(url.search)) {
    return fallback;
  }
  final params = JsSearchParams(url.search);
  final kept = <String>[];
  var replaced = false;
  for (final part in (url.search.isEmpty ? '' : url.search.substring(1)).split('&')) {
    if (part.isEmpty) continue;
    final key = JsSearchParams.formDecode(part.split('=').first);
    if (key == kAdminWebQuery) {
      if (!replaced) kept.add('$kAdminWebQuery=$kAdminWebValue');
      replaced = true;
    } else {
      kept.add(part);
    }
  }
  if (params.get(kAdminWebQuery) == null) kept.add('$kAdminWebQuery=$kAdminWebValue');
  return '${url.pathname}?${kept.join('&')}';
}
