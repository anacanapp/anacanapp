// Ported from: src/lib/session-persistence.test.ts
//
// `mocks.auth` is FakeAuthGateway; `mocks.auth.signOut()` (the wrapped SDK call) is
// NativeSessionPersistence.signOut(); a module reload is a new NativeSessionPersistence.

import 'dart:convert';

import 'package:anacan/core/session/auth_gateway.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthApiException, AuthRetryableFetchException, AuthSessionMissingException;

import '../net/support.dart';

const legacy = 'anacan.auth.session.v1';
const azure = 'https://anacan-gateway.example.azurecontainerapps.io';

late InMemoryLegacyPreferences prefs;
late FakeAuthGateway auth;
late AuthStorageSelection config;
late Map<String, String> localStorage;
late List<String> warnings;
late List<String> removedLocal;
late bool native;

String backupKey([String? realm]) => sessionBackupKey(realm ?? config.realm);
Map<String, String> pair(String id) => {'access_token': 'access-$id', 'refresh_token': 'refresh-$id'};
final old = pair('old');
final fresh = pair('fresh');
final oldView = view('old');
final freshView = view('fresh');

Object? stored() => jsonDecode(prefs.values[backupKey()] ?? 'null');
Object? storedSession() => (stored() as Map?)?['session'];
void putBackup(Object? session, [String? realm]) =>
    prefs.values[backupKey(realm ?? config.realm)] = jsonEncode({'realm': realm ?? config.realm, 'session': session});

NativeSessionPersistence load() => NativeSessionPersistence(
      auth: auth,
      preferences: prefs,
      authStorage: config,
      isNativePlatform: native,
      removeLocalAuthItem: (key) async {
        removedLocal.add(key);
        localStorage.remove(key);
      },
      warn: warnings.add,
    );

void emit(AuthEventKind event, [AuthSessionView? session]) => auth.emit(event, session);

/// The next `prefs.get` uses [handler]; later reads use the store again.
void getOnce(LegacyGetHandler handler) {
  prefs.onGet = (key) {
    prefs.onGet = null;
    return handler(key);
  };
}

void setOnce(LegacySetHandler handler) {
  prefs.onSet = (key, value) {
    prefs.onSet = null;
    return handler(key, value);
  };
}

List<Object?> setSessions() => [for (final call in prefs.setCalls) (jsonDecode(call.value) as Map)['session']];

void main() {
  setUp(() {
    prefs = InMemoryLegacyPreferences();
    auth = FakeAuthGateway();
    config = const AuthStorageSelection(
        storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true);
    localStorage = {};
    warnings = [];
    removedLocal = [];
    native = true;
    auth.onRefresh = (_) async {
      emit(AuthEventKind.tokenRefreshed, freshView);
      return AuthCallResult(session: freshView);
    };
  });

  test('does nothing on web and preserves the SDK signOut API', () async {
    native = false;
    final persistence = load();
    persistence.startNativeSessionSync();
    await persistence.restoreNativeSession();
    await persistence.signOut();
    expect(auth.signOutCalls, [false]);
    expect(auth.subscribeCount, 0);
    expect(auth.getSessionCalls, 0);
    expect(prefs.getCalls, isEmpty);
    expect(prefs.setCalls, isEmpty);
  });

  test('keeps the current SDK session ahead of any backup and stores only the token pair', () async {
    prefs.values[legacy] = jsonEncode(old);
    auth.onGetSession = () async => AuthCallResult(session: view('fresh', userId: 'u1'));
    final persistence = load();
    await persistence.restoreNativeSession();
    persistence.startNativeSessionSync();
    expect(stored(), {'realm': sourceAuthRealm, 'session': fresh});
    expect(prefs.values.containsKey(legacy), isFalse);
    expect(auth.refreshCalls, isEmpty);
    expect(auth.subscribeCount, 1);
  });

  test('recovers the eligible v1 backup only through a real refresh grant and saves the rotated pair', () async {
    prefs.values[legacy] = jsonEncode(old);
    await load().restoreNativeSession();
    expect(auth.refreshCalls, [old['refresh_token']]);
    expect(stored(), {'realm': sourceAuthRealm, 'session': fresh});
    expect(prefs.values.containsKey(legacy), isFalse);
  });

  test('uses the realm-bound backup ahead of the legacy fallback', () async {
    putBackup(fresh);
    prefs.values[legacy] = jsonEncode(old);
    await load().restoreNativeSession();
    expect(auth.refreshCalls, [fresh['refresh_token']]);
  });

  test('never restores source backups into standalone Azure preview', () async {
    putBackup(old, sourceAuthRealm);
    prefs.values[legacy] = jsonEncode(old);
    config = const AuthStorageSelection(storageKey: 'sb-anacan-gateway-auth-token', realm: azure, allowLegacyFallback: false);
    final persistence = load();
    await persistence.restoreNativeSession();
    emit(AuthEventKind.initialSession);
    expect(prefs.getCalls, [backupKey(azure)]);
    expect(auth.refreshCalls, isEmpty);
    expect(prefs.values.length, 2);
  });

  test('maintains an Azure realm backup without erasing the old source backup', () async {
    prefs.values[legacy] = jsonEncode(old);
    config = const AuthStorageSelection(storageKey: 'sb-anacan-gateway-auth-token', realm: azure, allowLegacyFallback: false);
    auth.onGetSession = () async => AuthCallResult(session: freshView);
    await load().restoreNativeSession();
    expect(stored(), {'realm': azure, 'session': fresh});
    expect(prefs.values[legacy], jsonEncode(old));
  });

  for (final value in [
    'null', 'not-json', jsonEncode({'realm': azure, 'session': old}),
    jsonEncode({'realm': sourceAuthRealm, 'session': null}),
    jsonEncode({'realm': sourceAuthRealm, 'session': {'access_token': 'a', 'refresh_token': 7}}),
  ]) {
    test('does not fall back from a tombstone or malformed/mismatched realm record: $value', () async {
      prefs.values[backupKey()] = value;
      prefs.values[legacy] = jsonEncode(old);
      await load().restoreNativeSession();
      expect(auth.refreshCalls, isEmpty);
      expect(prefs.getCalls, hasLength(1));
      expect(prefs.values[backupKey()], value);
      expect(prefs.values.containsKey(legacy), isTrue);
    });
  }

  test('fails closed on Preferences read errors without trying v1 or removing credentials', () async {
    prefs.values[legacy] = jsonEncode(old);
    getOnce((_) async => throw Exception('private error payload'));
    await load().restoreNativeSession();
    expect(auth.refreshCalls, isEmpty);
    expect(prefs.removeCalls, isEmpty);
    expect(prefs.setCalls, isEmpty);
  });

  for (final stage in ['query', 'refresh']) {
    group('$stage nonterminal errors', () {
      for (final error in <Object>[
        AuthRetryableFetchException(message: 'network', statusCode: '0'),
        AuthRetryableFetchException(message: 'maintenance', statusCode: '502'),
        AuthRetryableFetchException(message: 'maintenance', statusCode: '503'),
        AuthRetryableFetchException(message: 'maintenance', statusCode: '504'),
        const AuthApiException('invalid refresh secret-in-message', statusCode: '500', code: 'unexpected_failure'),
        const AuthApiException('rate limited', statusCode: '429', code: 'refresh_token_not_found'),
        const AuthApiException('signature configuration', statusCode: '401', code: 'bad_jwt'),
      ]) {
        test('retains the backup for ${error.runtimeType} / ${(error as dynamic).statusCode} and ignores null events',
            () async {
          prefs.values[legacy] = jsonEncode(old);
          if (stage == 'query') {
            auth.getSessionOnce.add(() async => AuthCallResult(error: error));
          } else {
            auth.refreshOnce.add((_) async => AuthCallResult(error: error));
          }
          final persistence = load();
          await persistence.restoreNativeSession();
          emit(AuthEventKind.initialSession);
          emit(AuthEventKind.signedOut);
          expect(prefs.values[legacy], jsonEncode(old));
          expect(prefs.setCalls, isEmpty);
          expect(prefs.removeCalls, isEmpty);
          expect(warnings, isEmpty);
          if (stage == 'query') expect(auth.refreshCalls, isEmpty);
        });
      }
    });
  }

  test('allows a later recovery after a retryable maintenance failure', () async {
    putBackup(old);
    auth.refreshOnce.add((_) async => AuthCallResult(error: AuthRetryableFetchException(message: 'maintenance', statusCode: '503')));
    final persistence = load();
    await persistence.restoreNativeSession();
    expect(storedSession(), old);
    await persistence.restoreNativeSession();
    expect(storedSession(), fresh);
  });

  for (final code in [
    'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found',
    'session_expired', 'user_banned', 'user_not_found',
  ]) {
    test('blocks replay after an authoritative $code', () async {
      prefs.values[legacy] = jsonEncode(old);
      auth.refreshOnce.add((_) async {
        emit(AuthEventKind.signedOut);
        return AuthCallResult(error: AuthApiException('sensitive server detail', statusCode: '400', code: code));
      });
      final persistence = load();
      await persistence.restoreNativeSession();
      expect(stored(), {'realm': sourceAuthRealm, 'session': null});
      expect(prefs.values.containsKey(legacy), isFalse);
      await persistence.restoreNativeSession();
      expect(auth.refreshCalls, hasLength(1));
    });
  }

  test('does not mistake a code-less local query error for revocation', () async {
    putBackup(old);
    auth.getSessionOnce.add(() async => AuthCallResult(error: AuthSessionMissingException()));
    await load().restoreNativeSession();
    expect(storedSession(), old);
    expect(auth.refreshCalls, isEmpty);
  });

  test('never installs a backup on a code-less grant error, whose SDK provenance is ambiguous', () async {
    putBackup(old);
    auth.refreshOnce.add((_) async => AuthCallResult(error: AuthSessionMissingException()));
    await load().restoreNativeSession();
    expect(storedSession(), old);
    expect(prefs.setCalls, isEmpty);
  });

  test('handles a terminal getSession refresh failure without replaying a different backup', () async {
    putBackup(old);
    auth.getSessionOnce.add(() async =>
        const AuthCallResult(error: AuthApiException('revoked', statusCode: '400', code: 'refresh_token_already_used')));
    await load().restoreNativeSession();
    expect(storedSession(), isNull);
    expect(auth.refreshCalls, isEmpty);
  });

  for (final outcome in ['success', 'error', 'throw']) {
    test('honors explicit logout on $outcome, including offline local cleanup', () async {
      prefs.values[legacy] = jsonEncode(old);
      putBackup(old);
      for (final suffix in ['', '-user', '-code-verifier']) {
        localStorage[config.storageKey + suffix] = 'old';
      }
      localStorage['anacan.auth-key.v1:pin'] = config.storageKey;
      localStorage['sb-alternate-auth-token'] = 'do-not-touch';
      final failure = AuthRetryableFetchException(message: 'offline', statusCode: '503');
      // gotrue signals a failed remote logout by throwing; 'error' and 'throw' are the same here.
      if (outcome != 'success') auth.signOutOnce.add((_) async => throw failure);
      final persistence = load();
      persistence.startNativeSessionSync();
      if (outcome == 'success') {
        await persistence.signOut();
      } else {
        await expectLater(persistence.signOut(), throwsA(same(failure)));
      }
      emit(AuthEventKind.initialSession, oldView);
      emit(AuthEventKind.tokenRefreshed, oldView);
      await persistence.restoreNativeSession();
      expect(storedSession(), isNull);
      expect(prefs.values.containsKey(legacy), isFalse);
      expect(localStorage[config.storageKey], isNull);
      expect(localStorage['anacan.auth-key.v1:pin'], config.storageKey);
      expect(localStorage['sb-alternate-auth-token'], 'do-not-touch');
      expect(auth.refreshCalls, isEmpty);
    });
  }

  test('retains a durable logout tombstone across a module restart, even if v1 reappears', () async {
    final persistence = load();
    persistence.startNativeSessionSync();
    await persistence.signOut();
    prefs.values[legacy] = jsonEncode(old);
    await load().restoreNativeSession();
    expect(auth.refreshCalls, isEmpty);
    expect(storedSession(), isNull);
  });

  test('does not clear this session for signOut scope others', () async {
    putBackup(old);
    final persistence = load()..startNativeSessionSync();
    await persistence.signOut(others: true);
    expect(auth.signOutCalls, [true]);
    expect(storedSession(), old);
    expect(prefs.setCalls, isEmpty);
    expect(removedLocal, isEmpty);
  });

  test('serializes writes so a slow old save cannot overwrite refresh or logout', () async {
    final firstWrite = Deferred<void>();
    setOnce((key, value) async {
      await firstWrite.future;
      prefs.values[key] = value;
    });
    final persistence = load()..startNativeSessionSync();
    emit(AuthEventKind.signedIn, oldView);
    await waitFor(() => prefs.setCalls.length == 1);
    emit(AuthEventKind.tokenRefreshed, freshView);
    var finished = false;
    final logout = persistence.signOut().then((_) => finished = true);
    await flush();
    expect(prefs.setCalls, hasLength(1));
    expect(finished, isFalse);
    firstWrite.resolve(null);
    await logout;
    expect(setSessions(), [old, fresh, null]);
    expect(storedSession(), isNull);
  });

  test('recovers the write queue after an error without logging credentials', () async {
    setOnce((_, _) async => throw Exception('private ${old['refresh_token']}'));
    load().startNativeSessionSync();
    emit(AuthEventKind.signedIn, oldView);
    emit(AuthEventKind.tokenRefreshed, freshView);
    await waitFor(() => storedSession() != null && (storedSession() as Map)['refresh_token'] == 'refresh-fresh');
    expect(warnings, ['[session-persistence] backup write failed']);
  });

  test('coalesces concurrent boot restores into a single grant', () async {
    prefs.values[legacy] = jsonEncode(old);
    final query = Deferred<AuthCallResult>();
    auth.getSessionOnce.add(() => query.future);
    final persistence = load();
    final first = persistence.restoreNativeSession();
    final second = persistence.restoreNativeSession();
    query.resolve(const AuthCallResult());
    await Future.wait([first, second]);
    expect(auth.getSessionCalls, 1);
    expect(auth.refreshCalls, hasLength(1));
  });

  test('does not overwrite a newer event with a stale getSession result', () async {
    final query = Deferred<AuthCallResult>();
    auth.getSessionOnce.add(() => query.future);
    final restoring = load().restoreNativeSession();
    emit(AuthEventKind.tokenRefreshed, freshView);
    query.resolve(AuthCallResult(session: oldView));
    await restoring;
    expect(storedSession(), fresh);
    expect(prefs.setCalls, hasLength(1));
  });

  test('does not erase a newer session when an older query reports revocation', () async {
    final query = Deferred<AuthCallResult>();
    auth.getSessionOnce.add(() => query.future);
    final restoring = load().restoreNativeSession();
    emit(AuthEventKind.signedIn, freshView);
    query.resolve(const AuthCallResult(error: AuthApiException('old session revoked', statusCode: '400', code: 'session_expired')));
    await restoring;
    expect(storedSession(), fresh);
  });

  for (final event in ['refresh', 'logout']) {
    test('abandons an old Preferences read after a newer $event', () async {
      final read = Deferred<String?>();
      getOnce((_) => read.future);
      final persistence = load();
      final restoring = persistence.restoreNativeSession();
      await waitFor(() => prefs.getCalls.length == 1);
      if (event == 'logout') {
        await persistence.signOut();
      } else {
        emit(AuthEventKind.tokenRefreshed, freshView);
      }
      read.resolve(jsonEncode({'realm': sourceAuthRealm, 'session': old}));
      await restoring;
      expect(auth.refreshCalls, isEmpty);
      expect(storedSession(), event == 'logout' ? isNull : fresh);
    });
  }

  test('does not save a refresh completing during explicit logout', () async {
    putBackup(old);
    final grant = Deferred<AuthCallResult>();
    auth.refreshOnce.add((_) => grant.future);
    final persistence = load();
    final restoring = persistence.restoreNativeSession();
    await waitFor(() => auth.refreshCalls.length == 1);
    final logout = persistence.signOut();
    emit(AuthEventKind.tokenRefreshed, freshView);
    grant.resolve(AuthCallResult(session: freshView));
    await Future.wait([logout, restoring]);
    expect(storedSession(), isNull);
  });

  test('allows a genuine later sign-in after explicit logout', () async {
    final persistence = load()..startNativeSessionSync();
    await persistence.signOut();
    emit(AuthEventKind.signedIn, freshView);
    await waitFor(() => storedSession() != null);
    expect(storedSession(), fresh);
    emit(AuthEventKind.initialSession);
    expect(storedSession(), fresh);
  });

  test('holds transition boot on a retryable backup refresh instead of displaying a login form', () async {
    putBackup(old);
    auth.refreshOnce.add((_) async => AuthCallResult(error: AuthRetryableFetchException(message: 'offline', statusCode: '503')));
    await expectLater(load().restoreNativeSession(requireRecovery: true),
        throwsA(isA<NativeSessionRecoveryPendingException>()));
    expect(storedSession(), old);
  });

  test('holds transition boot on a malformed successful grant without installing unverified backup claims', () async {
    putBackup(old);
    auth.refreshOnce.add((_) async => const AuthCallResult());
    await expectLater(load().restoreNativeSession(requireRecovery: true),
        throwsA(isA<NativeSessionRecoveryPendingException>()));
    expect(storedSession(), old);
  });

  test('still admits a genuinely signed-out device after a terminal revocation in transition mode', () async {
    putBackup(old);
    auth.refreshOnce.add((_) async =>
        const AuthCallResult(error: AuthApiException('revoked', statusCode: '400', code: 'session_expired')));
    await load().restoreNativeSession(requireRecovery: true);
    expect(storedSession(), isNull);
  });

  test('does not require a refresh for a fresh install with no stored credentials', () async {
    await load().restoreNativeSession(requireRecovery: true);
    expect(auth.refreshCalls, isEmpty);
  });

  // Flutter-only: byte compatibility of the backup written for the Capacitor app.
  test('writes the exact Capacitor backup JSON', () async {
    await load().saveSession(const PersistedSession(accessToken: 'a', refreshToken: 'r'));
    expect(prefs.values['anacan.auth.session.v2:https%3A%2F%2Ftntbjulojatnrqmylorp.supabase.co'],
        '{"realm":"https://tntbjulojatnrqmylorp.supabase.co","session":{"access_token":"a","refresh_token":"r"}}');
    await load().saveSession(null);
    expect(prefs.values[backupKey()], '{"realm":"https://tntbjulojatnrqmylorp.supabase.co","session":null}');
  });
}
