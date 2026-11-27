// Ported from: src/lib/native-auth-adoption.test.ts

import 'dart:convert';

import 'package:anacan/core/admission/backend_admission.dart';
import 'package:anacan/core/admission/backend_config.dart';
import 'package:anacan/core/session/auth_gateway.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthApiException, AuthRetryableFetchException;

import '../net/support.dart';

const api = 'https://api.anacan.az', source = 'https://tntbjulojatnrqmylorp.supabase.co';
const key = 'anacan.auth.adoption.v1:https%3A%2F%2Fapi.anacan.az';
const backup = 'anacan.auth.session.v2:https%3A%2F%2Ftntbjulojatnrqmylorp.supabase.co';
final handoff = 'a' * 64;
const user = '10000000-0000-4000-8000-000000000001';

AuthSessionView session(String origin, [String id = user]) =>
    AuthSessionView(accessToken: '$origin-access', refreshToken: '$origin-refresh', userId: id);
Map<String, String> pair(AuthSessionView value) =>
    {'access_token': value.accessToken!, 'refresh_token': value.refreshToken!};

late InMemoryLegacyPreferences prefs;
late FakeAuthGateway auth;
late AuthSessionView? local;
late BackendConfig backend;
late NativeSessionPersistence module;

BackendConfig managedBackend() {
  final policy = parseBackendAdmission(
      initialSourceAdmission.copyJson(generation: 2, phase: 'azure', handoffSha256: handoff));
  return BackendConfig(
    url: api,
    publishableKey: 'k',
    azure: true,
    sourceFirst: true,
    admission: advanceAdmission(null, policy),
  );
}

NativeSessionPersistence load() => module = NativeSessionPersistence(
      auth: auth,
      preferences: prefs,
      authStorage: const AuthStorageSelection(
          storageKey: 'sb-tntbjulojatnrqmylorp-auth-token', realm: source, allowLegacyFallback: true),
      warn: (_) {},
    );

Future<void> run() => module.restoreAdmittedNativeSession(backend);

Map<String, dynamic> json(String k) => jsonDecode(prefs.values[k]!) as Map<String, dynamic>;

Matcher get pending => throwsA(isA<NativeSessionRecoveryPendingException>());

void main() {
  setUp(() {
    prefs = InMemoryLegacyPreferences();
    auth = FakeAuthGateway();
    local = session('source');
    backend = managedBackend();
    auth.onGetSession = () async => AuthCallResult(session: local);
    auth.onRefresh = (_) async {
      local = session('azure');
      auth.emit(AuthEventKind.tokenRefreshed, local);
      return AuthCallResult(session: local);
    };
    load();
  });

  test('exchanges an unexpired cached Source JWT before completing the first target handoff', () async {
    await run();
    expect(auth.refreshCalls, [null]);
    expect(json(key), {'schema': 'anacan-auth-adoption-v1', 'state': 'complete', 'handoff': handoff, 'userId': user});
    expect(json(backup)['session'], pair(session('azure')));
  });

  test('keeps normal offline-capable cached startup after the same handoff is complete', () async {
    await run();
    load();
    auth.refreshCalls.clear();
    await run();
    expect(auth.refreshCalls, isEmpty);
    expect(pair(local!), pair(session('azure')));
  });

  test('requires a new grant for a different handoff receipt', () async {
    prefs.values[key] = jsonEncode(
        {'schema': 'anacan-auth-adoption-v1', 'state': 'complete', 'handoff': 'b' * 64, 'userId': user});
    await run();
    expect(auth.refreshCalls, hasLength(1));
  });

  for (final error in <Object>[
    AuthRetryableFetchException(message: 'offline', statusCode: '503'),
    const AuthApiException('missing migration row', statusCode: '400', code: 'refresh_token_not_found'),
    const AuthApiException('unrecognized source JWT', statusCode: '403', code: 'bad_jwt'),
  ]) {
    test('blocks the app and preserves a source candidate on initial adoption failure: ${(error as dynamic).code}',
        () async {
      auth.refreshOnce.add((_) async => AuthCallResult(error: error));
      await expectLater(run(), pending);
      expect(json(backup)['session'], pair(session('source')));
      expect(json(key)['state'], 'pending');
      await run();
      expect(json(key)['state'], 'complete');
    });
  }

  test('does not erase a backup when the SDK initial refresh reports a missing target session', () async {
    prefs.values[backup] = jsonEncode({'realm': source, 'session': pair(session('source'))});
    auth.getSessionOnce.add(() async =>
        const AuthCallResult(error: AuthApiException('missing', statusCode: '400', code: 'session_not_found')));
    await expectLater(run(), pending);
    expect(json(backup)['session'], pair(session('source')));
    expect(prefs.values.containsKey(key), isFalse);
  });

  test('recovers a source backup with a real grant and completes adoption before use', () async {
    local = null;
    prefs.values['anacan.auth.session.v1'] = jsonEncode(pair(session('source')));
    await run();
    expect(auth.refreshCalls.first, 'source-refresh');
    expect(auth.refreshCalls.last, isNull);
    expect(json(key)['state'], 'complete');
  });

  test('does not restore a logged-out source backup or require a grant for a fresh install', () async {
    local = null;
    prefs.values[backup] = jsonEncode({'realm': source, 'session': null});
    prefs.values['anacan.auth.session.v1'] = jsonEncode(pair(session('source')));
    await run();
    expect(auth.refreshCalls, isEmpty);
    expect(json(key), containsPair('state', 'complete'));
    expect(json(key), containsPair('userId', null));
  });

  test('never commits a target handoff into a different account and keeps the expected UUID on retry', () async {
    auth.refreshOnce.add((_) async {
      local = session('wrong', '10000000-0000-4000-8000-000000000002');
      auth.emit(AuthEventKind.tokenRefreshed, local);
      return AuthCallResult(session: local);
    });
    await expectLater(run(), pending);
    expect(json(key), containsPair('state', 'pending'));
    expect(json(key), containsPair('userId', user));
    await expectLater(run(), pending);
    expect(auth.refreshCalls, hasLength(1));
  });

  test('requires a durable rotated backup before recording completion', () async {
    prefs.onSet = (k, value) async {
      if (k == backup && value.contains('azure-refresh')) throw Exception('private storage failure');
      prefs.values[k] = value;
    };
    await expectLater(run(), pending);
    expect(json(key)['state'], 'pending');
  });

  for (final value in ['not-json', jsonEncode({'schema': 'unknown', 'state': 'complete', 'handoff': handoff})]) {
    test('fails closed on corrupt completion state: $value', () async {
      prefs.values[key] = value;
      await expectLater(run(), pending);
      expect(auth.refreshCalls, isEmpty);
    });
  }

  test('coalesces concurrent first-handoff boot requests', () async {
    await Future.wait([run(), run()]);
    expect(auth.refreshCalls, hasLength(1));
  });

  test('leaves the existing source boot path outside target adoption', () async {
    backend = BackendConfig(url: source, publishableKey: 'k', azure: false, sourceFirst: true, admission: backend.admission);
    await run();
    expect(auth.refreshCalls, isEmpty);
    expect(prefs.values.containsKey(key), isFalse);
  });
}
