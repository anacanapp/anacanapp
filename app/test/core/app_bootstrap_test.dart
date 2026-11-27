// Ported from: src/main.tsx + src/bootstrap-app.tsx startup order (no vitest file; ordering checked with fakes)

import 'dart:async';

import 'package:anacan/core/admission/backend_config.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/session_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';

import 'net/support.dart';

BackendHandle handle() {
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

class FakeSteps implements StartupSteps {
  final log = <String>[];
  final backend = Completer<BootstrapResult>();
  final language = Completer<String>();
  String? userId = 'u1';
  UserState user = const UserState();

  @override
  Future<void> loadLocalStore() async => log.add('store');
  @override
  Future<String> prepareLanguage() {
    log.add('language:start');
    return language.future.then((l) {
      log.add('language:done');
      return l;
    });
  }

  @override
  Future<BootstrapResult> bootstrapBackend() {
    log.add('backend:start');
    return backend.future.then((r) {
      log.add('backend:done');
      return r;
    });
  }

  @override
  String? currentUserId(BootstrapOpened backend) => userId;
  @override
  Future<LegacyImportResult> importLegacyState(String? currentUserId) async {
    log.add('import:$currentUserId');
    return const LegacyImportResult();
  }

  @override
  Future<StartupPreferences> readStartupPreferences() async {
    log.add('prefs');
    return const StartupPreferences();
  }

  @override
  UserState hydrateStores({required String language, required StartupPreferences preferences}) {
    log.add('stores:$language');
    return user;
  }

  @override
  Future<void> restoreQueryCache(BootstrapOpened backend) async => log.add('queryCache');
  @override
  void wireRuntime(String language) => log.add('runtime:$language');
}

void main() {
  test('runs the language preparation in parallel with the backend, then import → stores → query cache → runtime', () async {
    final steps = FakeSteps();
    final run = AppBootstrap(steps).run();
    await Future<void>.delayed(Duration.zero);
    expect(steps.log, ['store', 'backend:start', 'language:start']);
    steps.language.complete('ru');
    await Future<void>.delayed(Duration.zero);
    steps.backend.complete(BootstrapReady(handle()));
    final result = await run;
    expect(result, isA<StartupReady>());
    expect((result as StartupReady).language, 'ru');
    expect(steps.log, [
      'store', 'backend:start', 'language:start', 'language:done', 'backend:done',
      'import:u1', 'prefs', 'stores:ru', 'queryCache', 'runtime:ru',
    ]);
  });

  test('admission failures map to the shell results without touching stores', () async {
    for (final (backend, expected) in [
      (const BootstrapUpdateRequired(), isA<StartupUpdateRequired>()),
      (const BootstrapMaintenance(), isA<StartupMaintenance>()),
      (const BootstrapRetryableFailure(BootstrapFailureReason.sessionRecoveryPending),
          isA<StartupRetry>().having((r) => r.reason, 'reason', StartupFailureReason.sessionRecoveryPending)),
    ]) {
      final steps = FakeSteps()..language.complete('az');
      steps.backend.complete(backend);
      expect(await AppBootstrap(steps).run(), expected);
      expect(steps.log.where((e) => e.startsWith('import') || e.startsWith('stores')), isEmpty);
    }
  });

  test('a language that cannot be prepared shows the retry screen', () async {
    final steps = FakeSteps();
    final run = AppBootstrap(steps).run();
    await Future<void>.delayed(Duration.zero);
    steps.language.completeError(StateError('chunk'));
    steps.backend.complete(BootstrapSignedOut(handle()));
    expect(await run,
        isA<StartupRetry>().having((r) => r.reason, 'reason', StartupFailureReason.languageUnavailable));
  });

  test('signed out: needs language unless chosen, seen intro or onboarded', () async {
    var steps = FakeSteps()
      ..userId = null
      ..language.complete('az');
    steps.backend.complete(BootstrapSignedOut(handle()));
    expect(await AppBootstrap(steps).run(), isA<StartupNeedsLanguage>());
    expect(steps.log, contains('import:null'));
    steps = FakeSteps()
      ..user = const UserState(hasSeenIntro: true)
      ..language.complete('az');
    steps.backend.complete(BootstrapSignedOut(handle()));
    expect(await AppBootstrap(steps).run(), isA<StartupSignedOut>());
  });
}
