// Ported from: src/main.tsx, src/bootstrap-app.tsx (startApp, restorePreferences, prepareStartupLanguage),
// src/App.tsx (module-load language sync + overlay load, PersistQueryClientProvider restore),
// src/pages/Index.tsx (InitialLanguageScreen condition).
//
// One startup sequence, no UI. Order and parallelism (docs/flutter/SERVICES.md §1):
//
//   ┌ LocalStore.load ─┬─ language: restorePreferences (≤ 3 s) → normalize → ensureLanguageReady ─┐
//   └ backend: admission → SDK client → session restore (8 s / 15 s bound) ───────────────────────┤
//        failure → updateRequired / maintenance / retry (React: main.tsx, before startApp)         │
//   → legacy state import (once: 53.0 export, else hidden-WebView read) + privacy consent restore  │
//   → stores hydrate (+ Preferences flags)                                                          │
//   → query cache restore (buster of the admitted backend) + persistence/lifecycle wiring          │
//   → await language (failure → retry screen) ←────────────────────────────────────────────────────┘
//   → runtime wiring: LocalStore `language`, DB overlay for non-az, content packs
//
// The language preparation runs in parallel with the whole backend bootstrap (React starts it after
// admission, in parallel with the session restore; Flutter's BackendClient does both in one call).

import 'dart:async';

import 'package:flutter/foundation.dart' show TargetPlatform, debugPrint, defaultTargetPlatform, kIsWeb;
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/cake_cart_store.dart';
import '../state/child_store.dart';
import '../state/legacy_state_importer.dart';
import '../state/persisted_store.dart';
import '../state/timer_store.dart';
import '../state/user_store.dart';
import 'cache/deferred_persister.dart';
import 'cache/persist_policy.dart';
import 'cache/providers.dart';
import 'cache/query_client.dart';
import 'cache/query_persistence.dart';
import 'content_packs/content_translations.dart';
import 'data/privacy_consent.dart' show restorePrivacyConsent;
import 'i18n/app_languages.dart';
import 'i18n/language_controller.dart';
import 'net/backend_client.dart';
import 'net/backend_providers.dart';
import 'offline/connectivity.dart';
import 'storage/legacy_web_storage.dart';
import 'storage/migration_import.dart';

/// Why the retry screen is shown.
enum StartupFailureReason {
  admissionInvalid,
  admissionRollback,
  admissionStorage,
  admissionConfiguration,
  sessionRecoveryPending,
  unexpected,

  /// The bundled dictionary of the startup language could not be loaded.
  languageUnavailable,
}

sealed class StartupResult {
  const StartupResult();
}

/// The app can render (React: `startApp` finished, App mounted).
sealed class StartupOpened extends StartupResult {
  const StartupOpened({required this.backend, required this.language, required this.legacyImport});
  final BootstrapOpened backend;

  /// The normalized startup language (already ready for `tr`).
  final String language;
  final LegacyImportResult legacyImport;
}

/// Signed in (session restored / refreshed / adopted).
final class StartupReady extends StartupOpened {
  const StartupReady({required super.backend, required super.language, required super.legacyImport});
}

/// No session → login flow.
final class StartupSignedOut extends StartupOpened {
  const StartupSignedOut({required super.backend, required super.language, required super.legacyImport});
}

/// No session and no language chosen yet (Index: `!hasSelectedLanguage && !(hasSeenIntro || isOnboarded)`)
/// → InitialLanguageScreen (after the brand splash).
final class StartupNeedsLanguage extends StartupOpened {
  const StartupNeedsLanguage({required super.backend, required super.language, required super.legacyImport});
}

/// `updateRequired` text + retry.
final class StartupUpdateRequired extends StartupResult {
  const StartupUpdateRequired();
}

/// `connectionPending` text + retry (maintenance latched).
final class StartupMaintenance extends StartupResult {
  const StartupMaintenance();
}

/// `connectionPending` text + retry. Storage stays intact.
final class StartupRetry extends StartupResult {
  const StartupRetry(this.reason);
  final StartupFailureReason reason;
}

/// Flags restored from Capacitor Preferences.
class StartupPreferences {
  const StartupPreferences({this.hasSeenIntro = false});
  final bool hasSeenIntro;
}

/// The individual steps; [DefaultStartupSteps] wires the real services, tests pass fakes.
abstract interface class StartupSteps {
  Future<void> loadLocalStore();

  /// restorePreferences + normalize + ensureLanguageReady. Throws when the language cannot be prepared.
  Future<String> prepareLanguage();
  Future<BootstrapResult> bootstrapBackend();
  Future<LegacyImportResult> importLegacyState(String? currentUserId);
  Future<StartupPreferences> readStartupPreferences();

  /// Re-reads every persisted store and applies the Preferences flags; returns the user store state.
  UserState hydrateStores({required String language, required StartupPreferences preferences});
  Future<void> restoreQueryCache(BootstrapOpened backend);
  void wireRuntime(String language);

  /// Current user id of the opened backend (null when signed out).
  String? currentUserId(BootstrapOpened backend);
}

class AppBootstrap {
  AppBootstrap(this.steps);
  final StartupSteps steps;

  static StartupResult _failure(BootstrapResult result) => switch (result) {
        BootstrapUpdateRequired() => const StartupUpdateRequired(),
        BootstrapMaintenance() => const StartupMaintenance(),
        BootstrapRetryableFailure(:final reason) => StartupRetry(switch (reason) {
            BootstrapFailureReason.admissionInvalid => StartupFailureReason.admissionInvalid,
            BootstrapFailureReason.admissionRollback => StartupFailureReason.admissionRollback,
            BootstrapFailureReason.admissionStorage => StartupFailureReason.admissionStorage,
            BootstrapFailureReason.admissionConfiguration => StartupFailureReason.admissionConfiguration,
            BootstrapFailureReason.sessionRecoveryPending => StartupFailureReason.sessionRecoveryPending,
            BootstrapFailureReason.unexpected => StartupFailureReason.unexpected,
          }),
        BootstrapOpened() => const StartupRetry(StartupFailureReason.unexpected),
      };

  /// Runs the startup once. Never throws.
  Future<StartupResult> run() async {
    try {
      final storeLoaded = steps.loadLocalStore();
      // Language preparation does not depend on the session: run it alongside the backend.
      final languageReady = storeLoaded.then((_) => steps.prepareLanguage());
      languageReady.ignore();
      final backend = await steps.bootstrapBackend();
      if (backend is! BootstrapOpened) return _failure(backend);
      await storeLoaded;
      final legacy = await steps.importLegacyState(steps.currentUserId(backend));
      final preferences = await steps.readStartupPreferences();
      String language;
      try {
        language = await languageReady;
      } catch (_) {
        debugPrint('[bootstrap] local language preparation failed');
        return const StartupRetry(StartupFailureReason.languageUnavailable);
      }
      final user = steps.hydrateStores(language: language, preferences: preferences);
      await steps.restoreQueryCache(backend);
      steps.wireRuntime(language);
      if (backend is BootstrapReady) {
        return StartupReady(backend: backend, language: language, legacyImport: legacy);
      }
      if (!user.hasSelectedLanguage && !(user.hasSeenIntro || user.isOnboarded)) {
        return StartupNeedsLanguage(backend: backend, language: language, legacyImport: legacy);
      }
      return StartupSignedOut(backend: backend, language: language, legacyImport: legacy);
    } catch (_) {
      return const StartupRetry(StartupFailureReason.unexpected);
    }
  }
}

/// Keeps the query client's online/focus managers in step with connectivity and the app lifecycle
/// (React Query: `online` event and `visibilitychange`). Returns a dispose function.
void Function() bindQueryClientLifecycle(QueryClient client, ConnectivitySource connectivity) {
  client.onlineManager.setOnline(connectivity.isOnline);
  final sub = connectivity.onlineChanges.listen(client.onlineManager.setOnline);
  final lifecycle = AppLifecycleListener(
    onResume: () => client.focusManager.setFocused(true),
    onHide: () => client.focusManager.setFocused(false),
    onPause: () => client.focusManager.setFocused(false),
  );
  return () {
    unawaited(sub.cancel());
    lifecycle.dispose();
  };
}

/// Real services, read from the [ProviderContainer] the shell renders with.
class DefaultStartupSteps implements StartupSteps {
  DefaultStartupSteps(this.container, {this.preferencesTimeout = const Duration(seconds: 3)});

  final ProviderContainer container;
  final Duration preferencesTimeout;
  QueryCachePersistence? persistence;
  void Function()? _unbindLifecycle;

  @override
  Future<void> loadLocalStore() => container.read(localStoreProvider).load();

  @override
  Future<String> prepareLanguage() {
    final runtime = container.read(i18nRuntimeProvider);
    final store = container.read(localStoreProvider);
    final translations = ContentTranslations.instance;
    if (translations != null) runtime.prepareContent ??= (lang) => unawaited(translations.prepare(lang));
    return runtime.bootstrap(
      timeout: preferencesTimeout,
      fallbackLanguage: languageFromWebStorage(
        userStoreJson: store.getItem(userStoreEnvelope.name),
        languageKey: store.getItem('language'),
      ),
    );
  }

  @override
  Future<BootstrapResult> bootstrapBackend() => container.read(backendBootstrapProvider.future);

  @override
  String? currentUserId(BootstrapOpened backend) => backend.client?.auth.currentUser?.id;

  @override
  Future<LegacyImportResult> importLegacyState(String? currentUserId) async {
    final preferences = container.read(backendClientProvider).legacyPreferences;
    final store = container.read(localStoreProvider);
    final result = await LegacyStateImporter(
      migration: MigrationImport(preferences, webStorage: container.read(legacyWebStorageReaderProvider)),
      store: store,
    ).run(currentUserId: currentUserId);
    // Preferences-only keys the stores read from the LocalStore (React restores them on every start).
    await restorePrivacyConsent(store, preferences);
    return result;
  }

  @override
  Future<StartupPreferences> readStartupPreferences() async {
    final prefs = container.read(i18nRuntimeProvider).preferences;
    if (prefs == null) return const StartupPreferences();
    try {
      final intro = await prefs.read('anacan_has_seen_intro').timeout(preferencesTimeout);
      return StartupPreferences(hasSeenIntro: intro == 'true');
    } catch (_) {
      return const StartupPreferences();
    }
  }

  @override
  UserState hydrateStores({required String language, required StartupPreferences preferences}) {
    final runtime = container.read(i18nRuntimeProvider);
    final user = container.read(userStoreProvider.notifier)..rehydrate();
    container.read(childStoreProvider.notifier).rehydrate();
    container.read(timerStoreProvider.notifier).rehydrate();
    container.read(cakeCartProvider.notifier).rehydrate();
    user.restorePreferences(
      language: language,
      hasSelectedLanguage: runtime.hasSelectedLanguage,
      hasSeenIntro: preferences.hasSeenIntro,
    );
    return container.read(userStoreProvider);
  }

  @override
  Future<void> restoreQueryCache(BootstrapOpened backend) async {
    final client = container.read(queryClientProvider);
    final storage = FileQueryPersistStorage();
    defaultQueryPersistStorage = storage;
    final config = backend.backend;
    final persistence = this.persistence = QueryCachePersistence(
      client: client,
      persister: DeferredQueryPersister(storage: storage),
      buster: queryCacheBuster(
        sourceFirst: config.sourceFirst,
        azure: config.azure,
        handoffSha256: config.admission?.policy.handoffSha256,
      ),
    );
    await persistence.restore();
    persistence.start();
    _unbindLifecycle?.call();
    _unbindLifecycle = bindQueryClientLifecycle(client, container.read(connectivitySourceProvider));
  }

  @override
  void wireRuntime(String language) {
    final runtime = container.read(i18nRuntimeProvider);
    final store = container.read(localStoreProvider);
    // App.tsx module load: LS `language` = store language (or az); DB overlay for non-az.
    store.setItem('language', language.isEmpty ? 'az' : language);
    if (language != 'az') unawaited(runtime.loadTranslations(language).catchError((Object _) {}));
  }
}

/// Hidden-WebView reader of the Capacitor app's localStorage (52 → 60 upgrades); a no-op off Android/iOS.
final legacyWebStorageReaderProvider = Provider<LegacyWebStorageReader>((ref) =>
    !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS)
        ? const MethodChannelLegacyWebStorageReader()
        : const NoLegacyWebStorageReader());

/// `appStartupProvider`: the shell awaits it once per process (retry = `BackendClient.restart()` +
/// `container.invalidate(backendClientProvider)` + `container.invalidate(appStartupProvider)`).
final appStartupProvider = FutureProvider<StartupResult>(
  (ref) => AppBootstrap(ref.watch(startupStepsProvider)).run(),
  retry: (_, _) => null,
);

/// Overridable in tests. Needs the container: the shell overrides it with
/// `startupStepsProvider.overrideWith((ref) => DefaultStartupSteps(container))`, or calls
/// [runAppStartup].
final startupStepsProvider = Provider<StartupSteps>((ref) => throw UnimplementedError('override startupStepsProvider'));

/// Shell entry point: runs the startup on [container] with the real services.
Future<StartupResult> runAppStartup(ProviderContainer container) => AppBootstrap(DefaultStartupSteps(container)).run();
