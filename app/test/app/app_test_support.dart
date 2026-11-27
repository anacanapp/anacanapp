// Ported from: (test support — no React counterpart)
import 'dart:async';
import 'dart:convert';

import 'package:anacan/app/app_overrides.dart';
import 'package:anacan/app/device_tier.dart';
import 'package:anacan/core/admission/backend_config.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/backend_providers.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/offline/connectivity.dart';
import 'package:anacan/core/offline/offline_providers.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/session_store.dart';
import 'package:anacan/design/device_tier.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/legacy_state_importer.dart' show LegacyImportResult;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthClientOptions, AuthFlowType, SupabaseClient;

import '../core/net/support.dart' show FakeAuthGateway;
import '../shell/nav/shell_test_support.dart';

export '../shell/nav/shell_test_support.dart' show FakeGateActions, FakePlatform, TestUser, kWoman, readyInputs;

/// A signed-out SDK client over an in-process fake server: every PostgREST read answers `[]`, RPCs and
/// functions answer `null` / `{}`, auth endpoints refuse. Nothing leaves the process (no network in tests), so
/// the real feature registry runs against an opened backend exactly like after a production startup.
SupabaseClient fakeSupabaseClient() {
  http.Response json(http.Request request, Object? body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'}, request: request);
  return SupabaseClient(
    'https://api.anacan.az',
    'k',
    httpClient: MockClient((request) async {
      final path = request.url.path;
      if (path.startsWith('/auth/v1/')) return json(request, {'code': 'unexpected', 'msg': 'no fake auth'}, 400);
      if (path.startsWith('/functions/v1/')) return json(request, const <String, Object?>{});
      if (path.startsWith('/rest/v1/rpc/')) return json(request, null);
      if (request.method == 'GET' || request.method == 'HEAD') return json(request, const <Object?>[]);
      return json(request, const <Object?>[], 201);
    }),
    authOptions: const AuthClientOptions(autoRefreshToken: false, authFlowType: AuthFlowType.implicit),
  );
}

/// A [BackendHandle] over fakes, with a [fakeSupabaseClient].
BackendHandle fakeBackendHandle() {
  const backend = BackendConfig(url: 'https://api.anacan.az', publishableKey: 'k', azure: true, sourceFirst: true);
  const storage = AuthStorageSelection(storageKey: 'sb-x-auth-token', realm: 'https://x', allowLegacyFallback: false);
  final auth = FakeAuthGateway();
  final prefs = InMemoryLegacyPreferences();
  final client = fakeSupabaseClient();
  return BackendHandle(
    backend: backend,
    selector: BackendSelector(const BuildConfig()),
    sdk: SdkHandle(auth: auth, client: client, hasSession: () => false, dispose: () async => client.dispose()),
    persistence: NativeSessionPersistence(auth: auth, preferences: prefs, authStorage: storage, warn: (_) {}),
    sessionStore: SessionStore(local: InMemoryLegacyPreferences(), legacy: prefs, authStorage: storage),
  );
}

/// [BackendClient] whose `bootstrapBackend()` resolves with the backend of the [FakeStartup] result, the way
/// `runAppStartup` admits the backend before the routed app exists (`backendBootstrapProvider.future`).
class FakeBackendClient extends BackendClient {
  FakeBackendClient()
      : super(legacyPreferences: InMemoryLegacyPreferences(), localStore: InMemoryKeyValueStore(), baseHttpClient: MockClient((_) async => http.Response('', 404)), isNativePlatform: false);

  Completer<BootstrapResult> _result = Completer<BootstrapResult>();

  void open(BootstrapResult result) {
    if (!_result.isCompleted) _result.complete(result);
  }

  @override
  Future<BootstrapResult> bootstrapBackend() => _result.future;

  @override
  Future<void> restart() async => _result = Completer<BootstrapResult>();
}

StartupReady fakeReady() => StartupReady(backend: BootstrapReady(fakeBackendHandle()), language: 'az', legacyImport: const LegacyImportResult());
StartupSignedOut fakeSignedOut() =>
    StartupSignedOut(backend: BootstrapSignedOut(fakeBackendHandle()), language: 'az', legacyImport: const LegacyImportResult());
StartupNeedsLanguage fakeNeedsLanguage() =>
    StartupNeedsLanguage(backend: BootstrapSignedOut(fakeBackendHandle()), language: 'az', legacyImport: const LegacyImportResult());

class FakeHardwareProbe implements DeviceHardwareProbe {
  FakeHardwareProbe([this.hardware = const DeviceHardware(cores: 8, memoryGb: 8)]);
  final DeviceHardware hardware;
  @override
  Future<DeviceHardware> probe() async => hardware;
}

/// Container for [AnacanApp] in widget tests: real app overrides minus the auth-backed shell inputs, which are
/// fixtures.
ProviderContainer testAppContainer({
  LocalStore? store,
  GateInputs inputs = readyInputs,
  ShellUser user = kWoman,
  ManualConnectivitySource? connectivity,
  FeatureRegistry? registry,
  List<Override> extra = const [],
}) {
  return ProviderContainer(
    overrides: appRootOverrides(
      includeShellState: false,
      registry: registry,
      extra: [
        localStoreProvider.overrideWithValue(store ?? LocalStore.memory()),
        backendClientProvider.overrideWith((ref) => FakeBackendClient()),
        shellUserProvider.overrideWithValue(user),
        gateInputsProvider.overrideWithValue(inputs),
        gateActionsProvider.overrideWithValue(FakeGateActions()),
        unreadMessagesCountProvider.overrideWithValue(0),
        unreadCommunityPostsCountProvider.overrideWithValue(0),
        bottomNavStyleProvider.overrideWithValue(BottomNavStyle.classic),
        shellPlatformProvider.overrideWithValue(FakePlatform()),
        connectivitySourceProvider.overrideWithValue(connectivity ?? ManualConnectivitySource()),
        offlineSyncIndicatorVisibleProvider.overrideWithValue(false),
        appResumeEventsProvider.overrideWithValue(const Stream<void>.empty()),
        deviceHardwareProbeProvider.overrideWithValue(FakeHardwareProbe()),
        ...extra,
      ],
    ),
  );
}

/// Records startup runs and answers them from a queue (a [Completer] keeps the splash up).
class FakeStartup {
  FakeStartup(this.results);
  final List<FutureOr<StartupResult>> results;
  int runs = 0;

  Future<StartupResult> call(ProviderContainer container) async {
    final i = runs++;
    final result = await results[i < results.length ? i : results.length - 1];
    // runAppStartup admits the backend through `backendBootstrapProvider.future` before the app opens.
    if (result is StartupOpened) {
      final client = container.read(backendClientProvider);
      if (client is FakeBackendClient) client.open(result.backend);
      await container.read(backendBootstrapProvider.future);
    }
    return result;
  }
}

Future<void> noPrepare(ProviderContainer container) async {}
