// Ported from: src/integrations/supabase/auth-storage-key.ts, src/integrations/supabase/client.ts
// (the `authStorage` selection).

import '../storage/js_compat.dart';

const String legacyAuthStorageKey = 'sb-tntbjulojatnrqmylorp-auth-token';
const String sourceAuthRealm = 'https://tntbjulojatnrqmylorp.supabase.co';

/// Which SDK storage key holds the session and which realm its backup belongs to.
class AuthStorageSelection {
  const AuthStorageSelection({required this.storageKey, required this.realm, required this.allowLegacyFallback});

  final String storageKey;
  final String realm;

  /// Only the Source realm may read the unbound `anacan.auth.session.v1` backup.
  final bool allowLegacyFallback;

  @override
  bool operator ==(Object other) =>
      other is AuthStorageSelection &&
      other.storageKey == storageKey &&
      other.realm == realm &&
      other.allowLegacyFallback == allowLegacyFallback;

  @override
  int get hashCode => Object.hash(storageKey, realm, allowLegacyFallback);

  @override
  String toString() => 'AuthStorageSelection($storageKey, $realm, legacy: $allowLegacyFallback)';
}

/// Synchronous browser-like storage (`window.localStorage`). There is no such
/// store in the Flutter app; the abstraction keeps the React logic and tests intact.
abstract interface class SyncStorage {
  String? getItem(String key);
  void setItem(String key, String value);
}

/// The `Pick<Window, 'location' | 'localStorage'>` the React code reads.
/// [localStorage] may throw (blocked storage), exactly like the browser getter.
abstract interface class BrowserContext {
  String get hostname;
  SyncStorage get localStorage;
}

/// `${url.origin}${url.pathname without trailing slashes}` of a backend URL.
String authRealmOf(String supabaseUrl) {
  final url = Uri.parse(supabaseUrl);
  final path = url.path.replaceFirst(RegExp(r'/+$'), '');
  return '${url.origin}$path';
}

/// Select before the client is created; never move credentials or infer validity from a JWT.
AuthStorageSelection resolveAuthStorage(String supabaseUrl, {bool cutover = false, BrowserContext? browser}) {
  final url = Uri.parse(supabaseUrl);
  final realm = authRealmOf(supabaseUrl);
  final storageKey = 'sb-${url.host.split('.').first}-auth-token';
  final defaults = AuthStorageSelection(
    storageKey: storageKey,
    realm: realm,
    allowLegacyFallback: realm == sourceAuthRealm,
  );
  if (cutover != true || defaults.allowLegacyFallback || browser == null) return defaults;

  try {
    final host = browser.hostname;
    // No Lovable broker, localhost, or Azure preview host may opt itself in.
    if (host != 'anacan.az' && !host.endsWith('.anacan.az')) return defaults;

    final storage = browser.localStorage;
    final marker = 'anacan.auth-key.v1:${encodeUriComponent(realm)}';
    final pinned = storage.getItem(marker);
    if (pinned != null && pinned != storageKey && pinned != legacyAuthStorageKey) return defaults;
    final selected = pinned ?? (storage.getItem(storageKey) != null ? storageKey : legacyAuthStorageKey);
    // This non-secret pin survives logout; absence must not revive the other key.
    if (pinned == null) storage.setItem(marker, selected);
    return selected == legacyAuthStorageKey
        ? const AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true)
        : defaults;
  } catch (_) {
    // Without a durable choice, never expose a source session to the new backend.
    return defaults;
  }
}

/// `client.ts`: a source-first (store) build always uses the Source namespace and
/// realm for its SDK key and backup, whichever authority was admitted.
AuthStorageSelection selectAuthStorage({required String backendUrl, required bool sourceFirst, required bool cutover}) =>
    sourceFirst
        ? const AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true)
        : resolveAuthStorage(backendUrl, cutover: cutover);
