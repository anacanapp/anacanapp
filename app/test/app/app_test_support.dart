// Ported from: (test support — no React counterpart)
import 'dart:async';

import 'package:anacan/app/app_overrides.dart';
import 'package:anacan/app/device_tier.dart';
import 'package:anacan/core/admission/backend_config.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/offline/connectivity.dart';
import 'package:anacan/core/offline/offline_providers.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/session_store.dart';
import 'package:anacan/design/device_tier.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/legacy_state_importer.dart' show LegacyImportResult;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../core/net/support.dart' show FakeAuthGateway;
import '../shell/nav/shell_test_support.dart';

export '../shell/nav/shell_test_support.dart' show FakeGateActions, FakePlatform, TestUser, kWoman, readyInputs;

/// A [BackendHandle] over fakes (no SDK client).
BackendHandle fakeBackendHandle() {
  const backend = BackendConfig(url: 'https://api.anacan.az', publishableKey: 'k', azure: true, sourceFirst: true);
  const storage = AuthStorageSelection(storageKey: 'sb-x-auth-token', realm: 'https://x', allowLegacyFallback: false);
  final auth = FakeAuthGateway();
  final prefs = InMemoryLegacyPreferences();
  return BackendHandle(
    backend: backend,
    selector: BackendSelector(const BuildConfig()),
    sdk: SdkHandle(auth: auth, hasSession: () => true, dispose: () async {}),
    persistence: NativeSessionPersistence(auth: auth, preferences: prefs, authStorage: storage, warn: (_) {}),
    sessionStore: SessionStore(local: InMemoryLegacyPreferences(), legacy: prefs, authStorage: storage),
  );
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
    return results[i < results.length ? i : results.length - 1];
  }
}

Future<void> noPrepare(ProviderContainer container) async {}
