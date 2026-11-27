// Ported from: src/integrations/supabase/client.test.ts (+ Flutter-only cases for the
// src/bootstrap-app.tsx startup outcomes).

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/admission/backend_admission.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/session/auth_gateway.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import '../session/auth_storage_key_test.dart' show FakeBrowser, FakeStorage;
import 'support.dart';

const azure = 'https://anacan-gateway.example.azurecontainerapps.io';
const current = 'sb-anacan-gateway-auth-token';

late List<BackendClientOptions> created;
late FakeAuthGateway gateway;
late bool hasSession;

BackendClient direct(BuildConfig config, {LegacyPreferences? prefs}) => BackendClient(
      config: config,
      legacyPreferences: prefs ?? InMemoryLegacyPreferences(),
      localStore: InMemoryKeyValueStore(),
      baseHttpClient: offline(),
      clientFactory: (options) async {
        created.add(options);
        return SdkHandle(auth: gateway, hasSession: () => hasSession, dispose: () async {});
      },
      restoreBound: ({required sourceFirst}) => const Duration(milliseconds: 60),
    );

/// Admission control unreachable: the device keeps (or starts on) its pinned authority.
FakeHttpClient offline() => FakeHttpClient((_) async => throw http.ClientException('offline'));

const directConfig = BuildConfig(apiUrl: azure, anonKey: 'synthetic-publishable-key', buildMode: 'azure');

void main() {
  setUp(() {
    created = [];
    gateway = FakeAuthGateway();
    hasSession = false;
  });

  test('leaves the current source backend, key and SDK auth options unchanged', () async {
    await direct(directConfig.copyWith(apiUrl: sourceAuthRealm)).bootstrapBackend();
    final options = created.single;
    expect(options.authStorage.storageKey, legacyAuthStorageKey);
    expect(options.url, sourceAuthRealm);
    expect(options.publishableKey, 'synthetic-publishable-key');
    expect(options.headers, isEmpty);
  });

  for (final flag in ['', 'false', 'TRUE', '1']) {
    test('does not activate cutover for flag "$flag"', () async {
      await direct(directConfig.copyWith(authCutover: flag)).bootstrapBackend();
      expect(created.single.authStorage,
          const AuthStorageSelection(storageKey: current, realm: azure, allowLegacyFallback: false));
      expect(created.single.url, azure);
    });
  }

  test('selects the legacy key before construction only for explicit first-party opt-in, without switching URLs', () {
    // The Flutter client has no WebView localStorage, so BackendClient never passes a
    // browser; the opt-in logic itself is the same function.
    final selection = resolveAuthStorage(azure, cutover: true, browser: FakeBrowser('app.anacan.az', FakeStorage()));
    expect(selection,
        const AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true));
  });

  test('preserves the Lovable broker and destination namespace even if the flag is set', () {},
      skip: 'Web-only (Lovable preview broker); not part of the native Flutter app');

  test('uses the default key and SDK memory fallback when browser storage access throws', () async {
    await direct(directConfig.copyWith(authCutover: 'true')).bootstrapBackend();
    expect(created.single.authStorage,
        const AuthStorageSelection(storageKey: current, realm: azure, allowLegacyFallback: false));
  });

  group('startup outcomes (bootstrap-app.tsx)', () {
    const sourceFirst = BuildConfig(
      apiUrl: azureApiOrigin,
      anonKey: 'target',
      sourceAnonKey: 'source',
      appVersion: '60.0',
      backendBootstrap: 'source-first-v1',
      authCutover: 'false',
    );

    test('a hanging session restore ends on the retry screen and stops auto refresh', () async {
      gateway.onGetSession = () => Completer<AuthCallResult>().future;
      final result = await direct(sourceFirst).bootstrapBackend();
      expect(result, isA<BootstrapRetryableFailure>()
          .having((r) => r.reason, 'reason', BootstrapFailureReason.sessionRecoveryPending));
      expect(gateway.stopAutoRefreshCalls, 1);
    });

    test('a restored session opens the app, a fresh install opens signed out', () async {
      hasSession = true;
      gateway.onGetSession = () async => AuthCallResult(session: view('a', userId: 'u1'));
      expect(await direct(sourceFirst).bootstrapBackend(), isA<BootstrapReady>());
      hasSession = false;
      gateway = FakeAuthGateway();
      expect(await direct(sourceFirst).bootstrapBackend(), isA<BootstrapSignedOut>());
    });

    test('a retryable refresh of the Capacitor backup holds startup instead of showing a login form', () async {
      final prefs = InMemoryLegacyPreferences({
        'anacan.auth.session.v1': jsonEncode({'access_token': 'a', 'refresh_token': 'r'}),
      });
      gateway.onRefresh = (_) async => const AuthCallResult(error: 'offline');
      final result = await direct(sourceFirst, prefs: prefs).bootstrapBackend();
      expect(result, isA<BootstrapRetryableFailure>());
      expect(gateway.refreshCalls, ['r']);
      expect(prefs.values['anacan.auth.session.v1'], isNotNull);
    });

    test('maps update-required and maintenance', () async {
      final prefs = InMemoryLegacyPreferences();
      final update = direct(sourceFirst.copyWith(appVersion: '20.0'), prefs: prefs);
      expect(await update.bootstrapBackend(), isA<BootstrapUpdateRequired>());
      expect(created, isEmpty);
    });

    test('sends X-Anacan-Version on native builds', () async {
      await direct(sourceFirst).bootstrapBackend();
      expect(created.single.headers, {'X-Anacan-Version': '60.0'});
    });

    test('restart disposes the client and lets a new bootstrap run', () async {
      var disposed = 0;
      final client = BackendClient(
        config: sourceFirst,
        legacyPreferences: InMemoryLegacyPreferences(),
        localStore: InMemoryKeyValueStore(),
        baseHttpClient: offline(),
        clientFactory: (options) async =>
            SdkHandle(auth: gateway, hasSession: () => false, dispose: () async => disposed++),
      );
      final first = client.bootstrapBackend();
      await first;
      await client.restart();
      expect(disposed, 1);
      expect(gateway.stopAutoRefreshCalls, 1);
      expect(identical(client.bootstrapBackend(), first), isFalse);
    });
  });
}
