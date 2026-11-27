// Ported from: (Flutter-only) SessionStore — the supabase_flutter LocalStorage that keeps the
// Capacitor-format backup authoritative across Capacitor ⇄ Flutter upgrades and rollbacks.

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/net/network_timeout.dart';
import 'package:anacan/core/session/auth_gateway.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthChangeEvent, GoTrueClient;

import '../net/support.dart';

const selection =
    AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true);
final backupKey = sessionBackupKey(sourceAuthRealm);

String sdkSession(String refresh, {int? exp}) => jsonEncode({
      'access_token': jwt(exp ?? DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600),
      'expires_in': 3600,
      'refresh_token': refresh,
      'token_type': 'bearer',
      'user': user,
    });
String backup(String? refresh) => jsonEncode({
      'realm': sourceAuthRealm,
      'session': refresh == null ? null : {'access_token': 'a-$refresh', 'refresh_token': refresh},
    });

const user = {
  'id': '00000000-0000-4000-8000-000000000011', 'aud': 'authenticated', 'app_metadata': <String, Object>{},
  'user_metadata': <String, Object>{}, 'created_at': '1970-01-01T00:00:00.000Z',
};
String jwt(int exp) {
  String b64(Object value) => base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${b64({'alg': 'HS256', 'typ': 'JWT'})}.${b64({'exp': exp, 'sub': user['id']})}.sig';
}

late InMemoryKeyValueStore local;
late InMemoryLegacyPreferences legacy;

SessionStore store() => SessionStore(local: local, legacy: legacy, authStorage: selection);

void main() {
  setUp(() {
    local = InMemoryKeyValueStore();
    legacy = InMemoryLegacyPreferences();
  });

  test('first launch after the upgrade has no SDK copy: the restore uses the Capacitor backup', () async {
    legacy.values[backupKey] = backup('cap');
    final s = store();
    await s.initialize();
    expect(await s.hasAccessToken(), isFalse);
    expect(await s.accessToken(), isNull);
  });

  test('keeps its own SDK copy when the backup is the one it last wrote', () async {
    local.values[legacyAuthStorageKey] = sdkSession('r2');
    final s = store();
    await s.noteBackup(backup('r1')); // e.g. the later backup write failed
    legacy.values[backupKey] = backup('r1');
    await s.initialize();
    expect(await s.accessToken(), sdkSession('r2'));
  });

  test('keeps an SDK copy whose refresh token matches the backup', () async {
    local.values[legacyAuthStorageKey] = sdkSession('same');
    legacy.values[backupKey] = backup('same');
    final s = store();
    await s.initialize();
    expect(await s.hasAccessToken(), isTrue);
  });

  test('drops a stale SDK copy after a rollback build rotated the tokens', () async {
    local.values[legacyAuthStorageKey] = sdkSession('flutter-era');
    local.values[store().seenKey] = backup('flutter-era');
    legacy.values[backupKey] = backup('capacitor-rotated');
    final s = store();
    await s.initialize();
    expect(await s.hasAccessToken(), isFalse);
    expect(local.values.containsKey(legacyAuthStorageKey), isFalse);
    expect(local.values.containsKey(s.seenKey), isFalse);
  });

  test('drops the SDK copy after a rollback build logged out (tombstone)', () async {
    local.values[legacyAuthStorageKey] = sdkSession('flutter-era');
    local.values[store().seenKey] = backup('flutter-era');
    legacy.values[backupKey] = backup(null);
    final s = store();
    await s.initialize();
    expect(await s.hasAccessToken(), isFalse);
  });

  test('keeps the SDK copy when the Capacitor store cannot be read', () async {
    local.values[legacyAuthStorageKey] = sdkSession('r');
    legacy.onGet = (_) async => throw Exception('bridge');
    final s = store();
    await s.initialize();
    expect(await s.hasAccessToken(), isTrue);
  });

  test('persists, removes and serves the logout cleanup keys', () async {
    final s = store();
    await s.initialize();
    await s.persistSession('json');
    expect(local.values[legacyAuthStorageKey], 'json');
    expect(await s.readPersisted(), 'json');
    local.values['$legacyAuthStorageKey-code-verifier'] = 'v';
    await s.removeAuthItem(legacyAuthStorageKey);
    await s.removeAuthItem('$legacyAuthStorageKey-code-verifier');
    expect(local.values, isEmpty);
    expect(await s.hasAccessToken(), isFalse);
  });

  group('upgrade with the real SDK (gotrue) and the app http client', () {
    late FakeHttpClient server;
    late GoTrueClient auth;
    late SessionStore sessionStore;
    late NativeSessionPersistence persistence;

    /// What supabase_flutter's SupabaseAuth does with the LocalStorage.
    Future<void> boot() async {
      sessionStore = store();
      await sessionStore.initialize();
      auth = GoTrueClient(
          url: 'https://api.anacan.az/auth/v1', httpClient: AnacanHttpClient(inner: server), autoRefreshToken: false);
      auth.onAuthStateChange.listen((state) {
        if (state.session != null) {
          unawaited(sessionStore.persistSession(jsonEncode(state.session!.toJson())));
        } else if (state.event == AuthChangeEvent.signedOut) {
          unawaited(sessionStore.removePersistedSession());
        }
      }, onError: (_) {});
      if (await sessionStore.hasAccessToken()) await auth.setInitialSession((await sessionStore.accessToken())!);
      persistence = NativeSessionPersistence(
        auth: GoTrueSessionGateway(auth),
        preferences: legacy,
        authStorage: selection,
        removeLocalAuthItem: sessionStore.removeAuthItem,
        onBackupObserved: sessionStore.noteBackup,
        warn: (_) {},
      );
    }

    setUp(() {
      server = FakeHttpClient((request) async {
        final body = jsonDecode(await request.finalize().bytesToString()) as Map;
        final rotated = 'rotated-from-${body['refresh_token']}';
        return textResponse(sdkSession(rotated), 200, headers: const {'content-type': 'application/json'});
      });
    });

    test('Capacitor 52/53 → Flutter: one refresh grant with the backup refresh token, backup rewritten', () async {
      legacy.values[backupKey] = backup('cap-refresh');
      await boot();
      await persistence.restoreNativeSession(requireRecovery: true);
      final grant = server.calls.single;
      expect(grant.method, 'POST');
      expect(grant.url.toString(), 'https://api.anacan.az/auth/v1/token?grant_type=refresh_token');
      expect(auth.currentSession!.refreshToken, 'rotated-from-cap-refresh');
      await flush();
      expect(jsonDecode(legacy.values[backupKey]!)['session']['refresh_token'], 'rotated-from-cap-refresh');
      expect(jsonDecode(local.values[legacyAuthStorageKey]!)['refresh_token'], 'rotated-from-cap-refresh');

      // Next Flutter launch: the SDK copy is current, no grant needed.
      server.calls.clear();
      await boot();
      await persistence.restoreNativeSession(requireRecovery: true);
      expect(server.calls, isEmpty);
      expect(auth.currentSession!.refreshToken, 'rotated-from-cap-refresh');
    });

    test('Flutter → Capacitor rollback → Flutter: the rotated Capacitor backup wins', () async {
      legacy.values[backupKey] = backup('cap-refresh');
      await boot();
      await persistence.restoreNativeSession(requireRecovery: true);
      await flush();
      // The rollback build refreshes and writes its own pair.
      legacy.values[backupKey] = backup('cap-again');
      server.calls.clear();
      await boot();
      await persistence.restoreNativeSession(requireRecovery: true);
      expect(server.calls, hasLength(1));
      expect(auth.currentSession!.refreshToken, 'rotated-from-cap-again');
    });

    test('logout in Flutter leaves the tombstone a rollback build honours', () async {
      legacy.values[backupKey] = backup('cap-refresh');
      legacy.values['anacan.auth.session.v1'] = jsonEncode({'access_token': 'a', 'refresh_token': 'old'});
      await boot();
      await persistence.restoreNativeSession(requireRecovery: true);
      await persistence.signOut();
      await flush();
      expect(legacy.values[backupKey], backup(null));
      expect(legacy.values.containsKey('anacan.auth.session.v1'), isFalse);
      expect(local.values.containsKey(legacyAuthStorageKey), isFalse);
    });
  });
}
