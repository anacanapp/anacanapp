// Ported from: src/integrations/supabase/backend-bootstrap.test.ts
//
// `createClient` is the BackendClient factory; `boot()` runs BackendClient.bootstrapBackend
// (admission → selection → client → restore). The vitest `rejects.toThrow(CODE)` cases map
// to the sealed BootstrapResult for that code.

import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/admission/backend_admission.dart';
import 'package:anacan/core/admission/backend_bootstrap.dart';
import 'package:anacan/core/admission/backend_config.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import '../net/support.dart';

const pinKey = admissionPinKey;
const azureOrigin = azureApiOrigin;
final source = initialSourceAdmission;
final azure = parseBackendAdmission(source.copyJson(generation: 2, phase: 'azure', handoffSha256: 'a' * 64));
final paused = parseBackendAdmission(source.copyJson(generation: 1, phase: 'maintenance'));

const baseConfig = BuildConfig(
  buildMode: 'azure',
  backendBootstrap: 'source-first-v1',
  apiUrl: azureOrigin,
  anonKey: 'synthetic-target-public',
  sourceAnonKey: 'synthetic-source-public',
  appVersion: '28.0',
  authCutover: 'false',
  azurePartnerPairing: 'true',
);

http.StreamedResponse response([Object? value = _source, int status = 200, Map<String, String>? headers]) =>
    jsonResponse(identical(value, _source) ? source.toJson() : value, status: status, headers: headers);
const Object _source = Object();

late InMemoryLegacyPreferences prefs;
late FakeHttpClient fetch;
late List<BackendClientOptions> createClient;
late List<String> writes;
late BuildConfig config;
late bool native;

BackendClient client({Duration probeTimeout = admissionProbeTimeout}) => BackendClient(
      config: config,
      legacyPreferences: prefs,
      localStore: InMemoryKeyValueStore(),
      baseHttpClient: fetch,
      isNativePlatform: native,
      probeTimeout: probeTimeout,
      clientFactory: (options) async {
        writes.add('client');
        createClient.add(options);
        return SdkHandle(auth: FakeAuthGateway(), hasSession: () => false, dispose: () async {});
      },
    );

Future<BootstrapResult> boot([BackendClient? instance]) => (instance ?? client()).bootstrapBackend();

Map<String, dynamic> storedPin() => jsonDecode(prefs.values[pinKey]!) as Map<String, dynamic>;

Matcher failure(BootstrapFailureReason reason) =>
    isA<BootstrapRetryableFailure>().having((r) => r.reason, 'reason', reason);

void main() {
  setUp(() {
    prefs = InMemoryLegacyPreferences();
    fetch = FakeHttpClient((_) async => response());
    createClient = [];
    writes = [];
    config = baseConfig;
    native = true;
  });

  test('does not construct or refresh a client before admission, including indirect early imports', () {
    expect(
      () => BackendSelector(config).getBackendConfig(),
      throwsA(isA<BackendAdmissionException>()
          .having((e) => e.code, 'code', BackendAdmissionCode.admissionConfiguration)),
    );
    expect(createClient, isEmpty);
    expect(fetch.calls, isEmpty);
  });

  test('source-first uses the source URL/key/namespace and leaves destination credentials untouched', () async {
    prefs.values['anacan.auth.session.v1'] = 'synthetic-backup';
    final backend = client();
    // The opaque synthetic v1 value is not a token pair: the restore keeps it untouched.
    await boot(backend);
    expect(createClient, hasLength(1));
    final options = createClient.single;
    expect(options.url, sourceAuthRealm);
    expect(options.publishableKey, 'synthetic-source-public');
    expect(options.authStorage,
        const AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true));
    // Native builds send their version (src/integrations/supabase/client.ts).
    expect(options.headers, {'X-Anacan-Version': '28.0'});
    final selector = backend.handle!.selector;
    expect(selector.isAzureBackend(), isFalse);
    expect(selector.isAzurePairingBackend(), isFalse);
    expect(prefs.values['anacan.auth.session.v1'], 'synthetic-backup');
    expect(fetch.calls, hasLength(1));
    final request = fetch.calls.single;
    expect(request.method, 'GET');
    expect(request.url.toString(), admissionUrl);
    expect(request.followRedirects, isFalse);
    expect(request.headers, isEmpty);
    expect(storedPin()['authority'], 'source');
  });

  test('pins a verified target decision before constructing the SDK and preserves the same source namespace', () async {
    fetch.handler = (_) async => response(azure.toJson());
    prefs.onSet = (key, value) async {
      if (key == pinKey) writes.add('pin');
      prefs.values[key] = value;
    };
    final backend = client();
    await boot(backend);
    expect(writes, ['pin', 'client']);
    final options = createClient.single;
    expect(options.url, azureOrigin);
    expect(options.publishableKey, 'synthetic-target-public');
    expect(options.authStorage.storageKey, legacyAuthStorageKey);
    expect(options.headers, {'X-Anacan-Version': '28.0'});
    expect(backend.handle!.selector.isAzurePairingBackend(), isTrue);
  });

  test('retains Azure on offline restart when only the native pin survived WebView eviction', () async {
    prefs.values[pinKey] = advanceAdmission(null, azure).encode();
    fetch.handler = (_) async => throw http.ClientException('offline');
    await boot();
    expect(createClient.single.url, azureOrigin);
    expect(prefs.values[pinKey], advanceAdmission(null, azure).encode());
  });

  for (final status in [401, 403, 404, 408, 429, 503]) {
    test('retains source on a control-plane $status without probing Azure Auth', () async {
      fetch.handler = (_) async => response(null, status);
      await boot();
      expect(createClient.single.url, sourceAuthRealm);
      expect(fetch.calls, hasLength(1));
    });
  }
  for (final status in [401, 403, 503]) {
    test('does not roll an admitted Azure device back to Source during a $status outage', () async {
      prefs.values[pinKey] = advanceAdmission(null, azure).encode();
      fetch.handler = (_) async => response(null, status);
      await boot();
      expect(createClient.single.url, azureOrigin);
    });
  }
  test('starts a new Source-first installation when Azure DNS/network is unavailable', () async {
    fetch.handler = (_) async => throw http.ClientException('network unavailable');
    await boot();
    expect(createClient.single.url, sourceAuthRealm);
    expect(storedPin()['authority'], 'source');
  });
  test('starts a future Google-native installation on its verified bundled managed admission when control is offline',
      () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    fetch.handler = (_) async => throw http.ClientException('offline');
    await boot();
    expect(createClient.single.url, azureOrigin);
    expect(storedPin()['authority'], 'azure');
  });
  test('keeps a previously observed maintenance decision ahead of a future bundled managed default', () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    prefs.values[pinKey] = advanceAdmission(null, paused).encode();
    fetch.handler = (_) async => throw http.ClientException('offline');
    expect(await boot(), isA<BootstrapMaintenance>());
    expect(createClient, isEmpty);
  });
  test('moves an existing Source-only installation to the verified Google-native default during a control outage',
      () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    prefs.values[pinKey] = advanceAdmission(null, source).encode();
    fetch.handler = (_) async => throw http.ClientException('offline');
    await boot();
    expect(createClient.single.url, azureOrigin);
    expect(storedPin()['authority'], 'azure');
  });
  test('rejects an obsolete Source control response in a post-cutover Google-native build', () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    fetch.handler = (_) async => response(source.toJson());
    expect(await boot(), failure(BootstrapFailureReason.admissionRollback));
    expect(createClient, isEmpty);
    expect(prefs.setCalls, isEmpty);
  });
  test('blocks an incompatible Source pin instead of choosing Source during an offline Google-default startup', () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    prefs.values[pinKey] =
        advanceAdmission(null, parseBackendAdmission(source.copyJson(generation: azure.generation))).encode();
    fetch.handler = (_) async => throw http.ClientException('offline');
    expect(await boot(), failure(BootstrapFailureReason.admissionRollback));
    expect(createClient, isEmpty);
    expect(prefs.setCalls, isEmpty);
  });
  test('rejects a newer Source response after an older maintenance pin in a Google-default build', () async {
    config = config.copyWith(initialManagedAdmission: jsonEncode(azure.toJson()));
    prefs.values[pinKey] = advanceAdmission(null, paused).encode();
    fetch.handler = (_) async => response(source.copyJson(generation: azure.generation));
    expect(await boot(), failure(BootstrapFailureReason.admissionRollback));
    expect(createClient, isEmpty);
    expect(prefs.setCalls, isEmpty);
  });

  test('keeps maintenance latched on offline restart without importing Auth or clearing sessions', () async {
    fetch.handler = (_) async => response(paused.toJson());
    prefs.values['anacan.auth.session.v2:x'] = 'unchanged-session';
    expect(await boot(), isA<BootstrapMaintenance>());
    fetch.handler = (_) async => throw http.ClientException('offline');
    expect(await boot(), isA<BootstrapMaintenance>());
    expect(createClient, isEmpty);
    expect(prefs.values['anacan.auth.session.v2:x'], 'unchanged-session');
  });

  test('refuses a newer source policy after a device has attempted Azure', () async {
    prefs.values[pinKey] = advanceAdmission(null, azure).encode();
    fetch.handler = (_) async => response(source.copyJson(generation: 3));
    expect(await boot(), failure(BootstrapFailureReason.admissionRollback));
    expect(prefs.setCalls, isEmpty);
    expect(createClient, isEmpty);
  });

  // React also mirrors the pin in WebView localStorage ('corrupt-browser', 'browser-write');
  // Flutter has only the Preferences copy, so only the native cases apply.
  for (final failureKind in ['corrupt-native', 'native-read', 'native-write']) {
    test('blocks on $failureKind instead of guessing another account/authority', () async {
      prefs.values['anacan.auth.session.v2:x'] = 'unchanged-session';
      if (failureKind == 'corrupt-native') prefs.values[pinKey] = 'corrupt';
      if (failureKind == 'native-read') prefs.onGet = (_) async => throw Exception('private-payload');
      if (failureKind == 'native-write') prefs.onSet = (_, _) async => throw Exception('private-payload');
      expect(await boot(), failure(BootstrapFailureReason.admissionStorage));
      expect(createClient, isEmpty);
      expect(prefs.values['anacan.auth.session.v2:x'], 'unchanged-session');
    });
  }
  for (final failureKind in ['corrupt-browser', 'browser-write']) {
    test('blocks on $failureKind instead of guessing another account/authority', () {},
        skip: 'No WebView localStorage pin mirror in the Flutter app');
  }

  test('refuses an invalid published decision without persisting it', () async {
    fetch.handler = (_) async => response(azure.copyJson(handoffSha256: null));
    expect(await boot(), failure(BootstrapFailureReason.admissionInvalid));
    expect(prefs.setCalls, isEmpty);
    expect(createClient, isEmpty);
  });
  for (final (label, reply) in <(String, http.StreamedResponse Function())>[
    ('text/html', () => response(azure.toJson(), 200, {'content-type': 'text/html', 'cache-control': 'no-store'})),
    ('cache-control public', () => response(azure.toJson(), 200, {'content-type': 'application/json', 'cache-control': 'public'})),
    ('302', () => response(azure.toJson(), 302)),
  ]) {
    test('treats a non-control answer like offline: no new decision, pinned authority kept ($label)', () async {
      fetch.handler = (_) async => reply();
      await boot();
      // A Source installation is not moved to the azure document the portal/proxy carried.
      expect(createClient.single.url, sourceAuthRealm);
      expect(storedPin()['authority'], 'source');
    });
  }

  test('coalesces concurrent startup and performs only one authority selection', () async {
    final backend = client();
    final first = backend.bootstrapBackend(), second = backend.bootstrapBackend();
    expect(identical(first, second), isTrue);
    await Future.wait([first, second]);
    expect(fetch.calls, hasLength(1));
    expect(prefs.setCalls.where((call) => call.key == pinKey), hasLength(1));
  });

  test('never imports an older candidate after the minimum-version gate is observed', () async {
    fetch.handler = (_) async => response(source.copyJson(generation: 1, minNativeVersion: '29.0'));
    expect(await boot(), isA<BootstrapUpdateRequired>());
    expect(createClient, isEmpty);
    expect(prefs.values.containsKey(pinKey), isTrue);
  });

  test('does not opt a browser/Lovable preview into native session handoff', () async {
    native = false;
    expect(await boot(), failure(BootstrapFailureReason.admissionConfiguration));
    expect(prefs.getCalls, isEmpty);
    expect(fetch.calls, isEmpty);
  });

  test('leaves non-transition builds on their existing direct backend without control requests', () async {
    config = config.copyWith(backendBootstrap: '');
    await boot();
    expect(fetch.calls, isEmpty);
    expect(prefs.getCalls.where((key) => key == pinKey), isEmpty);
    expect(createClient.single.url, azureOrigin);
  });

  test('bounds an unavailable control request and retains source rather than trying Azure', () async {
    fetch.handler = (_) => Completer<http.StreamedResponse>().future;
    final backend = client(probeTimeout: const Duration(milliseconds: 40));
    await boot(backend);
    expect(fetch.calls, hasLength(1));
    expect(backend.handle!.selector.getBackendConfig().url, sourceAuthRealm);
  });

  group('watcher', () {
    late StreamController<void> ticks;
    late BackendClient backend;
    var restarts = 0;
    late void Function() stop;

    Future<void> tick([int times = 1]) async {
      for (var i = 0; i < times; i++) {
        ticks.add(null);
        await flush();
      }
    }

    Future<void> start() async {
      backend = client();
      await boot(backend);
      restarts = 0;
      ticks = StreamController<void>.broadcast();
      stop = backend.watchAdmission(() => restarts++, ticks: ticks.stream, isVisible: () => true);
    }

    tearDown(() async {
      stop();
      await ticks.close();
    });

    test('requests one full restart on a published change without rebinding or pinning a live SDK', () async {
      await start();
      fetch.handler = (_) async => throw http.ClientException('offline');
      await tick();
      expect(restarts, 0);
      fetch.handler = (_) async => response(azure.toJson());
      await tick();
      expect(restarts, 1);
      expect(backend.handle!.selector.getBackendConfig().url, sourceAuthRealm);
      expect(storedPin()['authority'], 'source');
      await tick();
      expect(restarts, 1);
    });

    http.StreamedResponse htmlPortal() => textResponse(
        '<html><body>Sign in to the hotel Wi-Fi</body></html>', 200,
        headers: const {'content-type': 'text/html; charset=utf-8'});
    for (final (label, reply) in <(String, http.StreamedResponse Function())>[
      ('a captive portal HTML page', htmlPortal),
      ('JSON without no-store', () => response(source.toJson(), 200, {'content-type': 'application/json', 'cache-control': 'public'})),
      ('an unparseable JSON body', () => textResponse('{"schema":', 200,
          headers: const {'content-type': 'application/json', 'cache-control': 'no-store'})),
      ('a truncated read', () => brokenBodyResponse()),
      ('an outage status', () => response(null, 503)),
    ]) {
      test('keeps the running app on $label and retries later instead of restarting', () async {
        await start();
        final before = fetch.calls.length;
        fetch.handler = (_) async => reply();
        await tick(3);
        expect(restarts, 0);
        // The same unchanged validated policy later: still no restart.
        fetch.handler = (_) async => response();
        await tick();
        expect(restarts, 0);
        expect(fetch.calls.length - before + 1, greaterThanOrEqualTo(5));
      });
    }

    test('restarts once a JSON no-store control document fails validation on two consecutive reads', () async {
      await start();
      fetch.handler = (_) async => response(azure.copyJson(handoffSha256: null));
      await tick();
      expect(restarts, 0);
      await tick();
      expect(restarts, 1);
    });

    test('native startup behind a captive portal opens on the pinned authority (like offline), without a restart loop',
        () async {
      prefs.values[pinKey] = advanceAdmission(null, azure).encode();
      fetch.handler = (_) async => htmlPortal();
      await start();
      expect(createClient.single.url, azureOrigin);
      expect(storedPin()['policy'], containsPair('phase', 'azure'));
      expect(storedPin()['policy'], containsPair('generation', 2));
      await tick(3);
      expect(restarts, 0);
    });
  });
}
