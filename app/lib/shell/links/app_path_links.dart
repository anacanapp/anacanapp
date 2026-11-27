// Ported from: src/lib/app-path-links.ts (appLinkForPath, rememberAppLink, takeAppLink, APP_LINK_TTL_MS)
import '../../core/i18n/app_languages.dart' show isAppLanguage;
import 'deeplink.dart';
import 'js_url.dart';

final RegExp _segment = RegExp(r'^[A-Za-z0-9_-]{1,100}$');

/// A sign-in (including a provider redirect) normally finishes well inside this window.
const Duration kAppLinkTtl = Duration(minutes: 30);

/// `appLinkForPath(pathname, search)`: `anacan://<path>[?language=…]` for a path the app knows, else null
/// (null for `/`, blog and legal pages, which have their own routes, and blog-module links).
String? appLinkForPath(String pathname, [String search = '']) {
  final parts = pathname.split('/').where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty || !parts.every(_segment.hasMatch)) return null;
  final language = JsSearchParams(search).get('language');
  final href = 'anacan://${parts.join('/')}${language != null && isAppLanguage(language) ? '?language=$language' : ''}';
  final parsed = parseDeeplink(href);
  if (parsed == null || parsed.action == 'blog-module') return null;
  if (parsed.action == 'screen' && RegExp(r'^(?:blog|legal)(?:/|$)').hasMatch(parsed.params['screen'] ?? '')) return null;
  return href;
}

/// sessionStorage `anacan_pending_app_link` `{href, at}` (process memory natively).
class AppLinkStore {
  ({String href, int at})? _raw;

  /// `rememberAppLink(href, now)`.
  void remember(String href, {required int nowMs}) => _raw = (href: href, at: nowMs);

  /// `takeAppLink(now)`: the link if still fresh; removed either way.
  String? take({required int nowMs}) {
    final raw = _raw;
    if (raw == null) return null;
    _raw = null;
    if (nowMs - raw.at > kAppLinkTtl.inMilliseconds || nowMs < raw.at) return null;
    return raw.href.startsWith('anacan://') && parseDeeplink(raw.href) != null ? raw.href : null;
  }

  /// Test hook: store a tampered value as sessionStorage could hold it.
  void putRaw(String href, int at) => _raw = (href: href, at: at);
}
