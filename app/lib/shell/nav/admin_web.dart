// Ported from: src/web-entry/policy.mjs (APP_ENTRY_HOSTS, ADMIN_WEB_QUERY/VALUE, safeAdminNext default
//              `/admin?web=admin`), src/web-entry/admin.ts (mountAdminWebBar panel link),
//              src/components/ProfileScreen.tsx (`admin` row → activeScreen 'admin'), src/pages/Index.tsx
//              (activeScreen 'admin' && isAdmin → admin panel)
//
// Product decision for the native app: the admin panel is the web admin (server-verified staff login at
// `/admin/login`, then `/admin?web=admin`), opened in the external browser.
import '../links/entry_policy.dart';
import '../links/js_url.dart';

/// The web admin entry for the backend the app is admitted to. The admin entry is served on every
/// public app host; any other backend URL (preview, Azure gateway) falls back to `app.anacan.az`.
Uri adminWebUri({String? backendUrl}) {
  var host = kAppEntryHosts.first;
  final parsed = backendUrl == null ? null : JsUrl.parse(backendUrl);
  if (parsed != null && parsed.protocol == 'https:' && kAppEntryHosts.contains(parsed.hostname) && parsed.port.isEmpty) {
    host = parsed.hostname;
  }
  return Uri.parse('https://$host/admin?$kAdminWebQuery=$kAdminWebValue');
}
