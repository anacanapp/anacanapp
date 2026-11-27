// Ported from: src/integrations/supabase/client.ts (auth `storage` / `storageKey`),
// src/lib/session-persistence.ts (backup compatibility).
//
// supabase_flutter `LocalStorage` for the SDK session.
//
// Two copies exist, with different jobs:
// 1. The SDK copy: the full supabase_flutter persisted-session JSON (`Session.toJson()`:
//    access_token, expires_in, expires_at, refresh_token, token_type, provider_token,
//    provider_refresh_token, user). It lives in the Flutter-owned store under the same
//    key supabase-js used in WebView localStorage (`sb-tntbjulojatnrqmylorp-auth-token`
//    for store builds). The Capacitor app never reads it.
// 2. The Capacitor-format backup `anacan.auth.session.v2:<realm>` = `{realm, session:
//    {access_token, refresh_token}}` (or the `session:null` tombstone) in the Capacitor
//    Preferences store. NativeSessionPersistence writes it on every session change; it is
//    what a Capacitor rollback, and the first Flutter launch after an upgrade, restore from.
//
// The backup is the authority across builds. On start the SDK copy is used only when it
// is provably ours and current: its refresh token equals the backup's, or the backup
// still holds exactly the value this app last wrote or consumed ("seen" marker). Any
// other backup (a Capacitor build ran in between and rotated tokens or logged out)
// discards the SDK copy, and NativeSessionPersistence restores from the backup with a
// refresh grant.

import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart' show GotrueAsyncStorage, LocalStorage;

import '../session/auth_storage_key.dart';
import 'js_compat.dart';
import 'key_value_store.dart';
import 'legacy_preferences.dart';

String _backupKey(String realm) => 'anacan.auth.session.v2:${encodeUriComponent(realm)}';

class SessionStore extends LocalStorage {
  SessionStore({required this.local, required this.legacy, required this.authStorage});

  /// Flutter-owned store for the SDK copy and the seen marker.
  final KeyValueStore local;

  /// Capacitor Preferences (the backup).
  final LegacyPreferences legacy;
  final AuthStorageSelection authStorage;

  String get sessionKey => authStorage.storageKey;
  String get seenKey => 'anacan.flutter.auth.backup-seen.v1:${encodeUriComponent(authStorage.realm)}';

  String? _session;
  bool _initialized = false;

  @override
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    final raw = await local.get(sessionKey);
    if (raw == null) return;
    if (await _currentAgainstBackup(raw)) {
      _session = raw;
    } else {
      await local.remove(sessionKey);
      await local.remove(seenKey);
    }
  }

  Future<bool> _currentAgainstBackup(String raw) async {
    String? backup;
    try {
      backup = await legacy.get(_backupKey(authStorage.realm));
    } catch (_) {
      // Cannot compare: keep the SDK copy rather than signing out on a bridge failure.
      return true;
    }
    final seen = await local.get(seenKey);
    if (seen != null && seen == (backup ?? '')) return true;
    if (backup == null) return false;
    try {
      final record = jsonDecode(backup);
      final sdk = jsonDecode(raw);
      if (record is! Map || record['realm'] != authStorage.realm) return false;
      final pair = record['session'];
      final refresh = pair is Map ? pair['refresh_token'] : null;
      return refresh is String && refresh.isNotEmpty && sdk is Map && sdk['refresh_token'] == refresh;
    } catch (_) {
      return false;
    }
  }

  /// Called by NativeSessionPersistence with each backup value it wrote, and with the
  /// backup it is about to consume (null when the unbound v1 key was used).
  Future<void> noteBackup(String? rawBackup) => local.set(seenKey, rawBackup ?? '');

  @override
  Future<bool> hasAccessToken() async => _session != null;

  /// The persisted-session JSON string (the supabase_flutter contract, despite the name).
  @override
  Future<String?> accessToken() async => _session;

  @override
  Future<void> persistSession(String persistSessionString) async {
    _session = persistSessionString;
    await local.set(sessionKey, persistSessionString);
  }

  @override
  Future<void> removePersistedSession() async {
    _session = null;
    await local.remove(sessionKey);
  }

  /// `authStorage.storage.removeItem(key)` used by the logout cleanup
  /// (`<key>`, `<key>-user`, `<key>-code-verifier`).
  Future<void> removeAuthItem(String key) async {
    if (key == sessionKey) return removePersistedSession();
    await local.remove(key);
  }

  /// Raw SDK copy for the offline-open decision.
  Future<String?> readPersisted() async => _session ?? await local.get(sessionKey);
}

/// PKCE code-verifier storage in the same Flutter-owned store, so the logout cleanup
/// reaches it. (Store builds use the implicit flow, like supabase-js; this is a safety net.)
class KeyValueGotrueAsyncStorage extends GotrueAsyncStorage {
  const KeyValueGotrueAsyncStorage(this.store);

  final KeyValueStore store;

  @override
  Future<String?> getItem({required String key}) => store.get(key);

  @override
  Future<void> removeItem({required String key}) => store.remove(key);

  @override
  Future<void> setItem({required String key, required String value}) => store.set(key, value);
}
