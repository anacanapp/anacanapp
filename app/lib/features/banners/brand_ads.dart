// Ported from: src/lib/brand-ads.ts (safeAdUrl — the only consumer-side helper; the rest of the module is the
//              web-only brand portal, which stays out of native bundles)
import '../../shell/links/js_url.dart';

/// `safeAdUrl(value)`: an absolute http(s) URL without credentials (normalised like `new URL().href`), else null.
String? safeAdUrl(Object? value) {
  if (value is! String) return null;
  final url = JsUrl.parse(value);
  if (url == null) return null;
  return (url.protocol == 'https:' || url.protocol == 'http:') && url.username.isEmpty && url.password.isEmpty ? url.href : null;
}
