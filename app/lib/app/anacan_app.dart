// Ported from: src/main.tsx (bootstrap → admission error screen with retry = reload), src/bootstrap-app.tsx
//              (startApp: crash reporter after admission, watchBackendAdmission → reload), src/App.tsx (splash
//              hide after the first frame, language overlay, content-pack refresh)
//
// Root widget. It owns the ProviderContainer (one per "page load"): a retry or an admission change disposes it
// and starts over, which is what `window.location.reload()` did. Timeline: docs/flutter/APP_ROOT.md §1.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/app_bootstrap.dart';
import '../core/cache/providers.dart' show queryClientProvider;
import '../core/content_packs/content_translations.dart';
import '../core/i18n/language_controller.dart' show i18nRuntimeProvider;
import '../core/net/backend_client.dart' show BootstrapOpened;
import '../core/net/backend_providers.dart';
import '../core/net/build_config.dart';
import '../core/offline/connectivity.dart';
import '../core/offline/offline_providers.dart' show appResumeEventsProvider;
import '../features/startup/admission_screens.dart';
import '../features/startup/startup_screen.dart';
import '../shell/gates/gate_host.dart';
import '../state/persisted_store.dart' show localStoreProvider;
import 'app_overrides.dart';
import 'crash_reporter.dart';
import 'device_tier.dart';
import 'routed_app.dart';
import 'startup_language.dart';
import 'system_chrome.dart';

typedef StartupRunner = Future<StartupResult> Function(
  ProviderContainer container,
);

/// Wiring done on a fresh container before `runAppStartup` (overridable in tests).
typedef ContainerPreparer = Future<void> Function(ProviderContainer container);

/// Default [ContainerPreparer]: Preferences for the i18n runtime, the content-pack service.
Future<void> prepareAppContainer(ProviderContainer container) async {
  final runtime = container.read(i18nRuntimeProvider);
  runtime.preferences ??= LegacyLanguagePreferenceStore(
    container.read(backendClientProvider).legacyPreferences,
  );
  if (ContentTranslations.instance == null) {
    try {
      ContentTranslations.instance = await ContentTranslations.create();
    } catch (_) {
      // No support directory (tests / desktop): packs stay off, rows use the en/ru column fallback.
    }
  }
}

/// The app root (src/main.tsx → bootstrap-app → App).
class AnacanApp extends StatefulWidget {
  const AnacanApp({
    super.key,
    this.createContainer = createAppContainer,
    this.runStartup = runAppStartup,
    this.prepare = prepareAppContainer,
    this.watchAdmission = true,
    this.initialLocation = '/',
  });

  final ProviderContainer Function() createContainer;
  final StartupRunner runStartup;
  final ContainerPreparer prepare;

  /// `watchBackendAdmission` after the app opened (off in widget tests).
  final bool watchAdmission;
  final String initialLocation;

  /// The current root state (crash fallback retry). Null before the first build.
  static AnacanAppState? current;

  @override
  State<AnacanApp> createState() => AnacanAppState();
}

class AnacanAppState extends State<AnacanApp> {
  ProviderContainer? _container;
  StartupResult? _result;
  String _language = 'az';
  int _generation = 0;
  final List<void Function()> _teardown = [];

  /// The container of the running page (null while booting a fresh one).
  ProviderContainer? get container => _container;
  StartupResult? get result => _result;

  @override
  void initState() {
    super.initState();
    AnacanApp.current = this;
    unawaited(_boot());
  }

  @override
  void dispose() {
    if (AnacanApp.current == this) AnacanApp.current = null;
    _stopHooks();
    _container?.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    final gen = ++_generation;
    final container = widget.createContainer();
    _container = container;
    StartupResult result;
    try {
      await widget.prepare(container);
      // The device probe runs alongside startup (React computes the tier at App module load).
      final tier = container
          .read(deviceTierProvider.notifier)
          .probe(container.read(deviceHardwareProbeProvider));
      result = await widget.runStartup(container);
      await tier;
    } catch (error, stack) {
      debugPrint('[bootstrap] startup failed: $error\n$stack');
      result = const StartupRetry(StartupFailureReason.unexpected);
    }
    if (!mounted || gen != _generation) return;
    if (result is StartupOpened) {
      _onOpened(container, result);
    } else {
      _language = await _storedLanguage(container);
      if (!mounted || gen != _generation) return;
    }
    setState(() => _result = result);
  }

  Future<String> _storedLanguage(ProviderContainer container) async {
    try {
      final store = container.read(localStoreProvider);
      await store.load().timeout(const Duration(seconds: 1));
      return storedStartupLanguage(
        store: store,
        runtime: container.read(i18nRuntimeProvider),
      );
    } catch (_) {
      return 'az';
    }
  }

  void _onOpened(ProviderContainer container, StartupOpened result) {
    _installCrashReporter(result.backend);
    final store = container.read(localStoreProvider);
    final runtime = container.read(i18nRuntimeProvider);

    // App pause / hide: write the debounced local stores now (localStorage was synchronous).
    final lifecycle = AppLifecycleListener(
      onPause: () {
        unawaited(store.flush());
        unawaited(runtime.store.flushPersists());
      },
      onHide: () => unawaited(store.flush()),
    );
    _teardown.add(lifecycle.dispose);

    // Connectivity regained: content-pack retry (`online`), admission watcher wake.
    final connectivity = container.read(connectivitySourceProvider);
    final wakes = StreamController<void>.broadcast();
    _teardown.add(() => unawaited(wakes.close()));
    final online = connectivity.onlineChanges.listen((isOnline) {
      if (!isOnline) return;
      ContentTranslations.instance?.retry();
      if (!wakes.isClosed) wakes.add(null);
    });
    _teardown.add(() => unawaited(online.cancel()));
    final resumed = container.read(appResumeEventsProvider).listen((_) {
      if (!wakes.isClosed) wakes.add(null);
    });
    _teardown.add(() => unawaited(resumed.cancel()));

    // App.tsx: a shard arrival re-renders rows and invalidates queries keyed by the current language (300 ms).
    final packs = ContentTranslations.instance;
    if (packs != null) {
      _teardown.add(
        installContentTranslationRefresh(
          packs,
          language: () => runtime.language,
          onRefresh: (lang) {
            try {
              unawaited(
                container
                    .read(queryClientProvider)
                    .invalidateQueries(
                      predicate: (q) => q.queryKey.contains(lang),
                    ),
              );
            } catch (_) {}
          },
        ),
      );
    }

    if (widget.watchAdmission) {
      _teardown.add(
        container
            .read(backendClientProvider)
            .watchAdmission(restart, wakes: wakes.stream),
      );
    }
  }

  void _installCrashReporter(BootstrapOpened backend) {
    final client = backend.client;
    if (client == null) return;
    CrashReporting.reporter = DefaultCrashReporter(
      sink: SupabaseCrashReportSink(client),
      appVersion: BuildConfig.fromEnvironment.appVersion,
    );
  }

  void _stopHooks() {
    for (final stop in _teardown.reversed) {
      try {
        stop();
      } catch (_) {}
    }
    _teardown.clear();
  }

  /// `window.location.reload()`: retry button, admission change, root crash fallback.
  Future<void> restart() async {
    final old = _container;
    _stopHooks();
    CrashReporting.reporter = null;
    _generation++;
    if (mounted) {
      setState(() {
        _result = null;
        _container = null;
      });
    }
    if (old != null) {
      try {
        await old
            .read(localStoreProvider)
            .flush()
            .timeout(const Duration(seconds: 2));
      } catch (_) {}
      try {
        await old.read(backendClientProvider).restart();
      } catch (_) {}
      // Let the frame that removed the old tree finish before disposing its providers.
      await WidgetsBinding.instance.endOfFrame;
      old.dispose();
    }
    // A reload shows the brand splash again (module state is gone in the WebView).
    GateHost.brandSplashShown = false;
    if (mounted) await _boot();
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    final container = _container;
    if (result is StartupOpened && container != null) {
      return UncontrolledProviderScope(
        key: ValueKey('app:$_generation'),
        container: container,
        child: RoutedApp(initialLocation: widget.initialLocation),
      );
    }
    final Widget screen = switch (result) {
      null => const StartupScreen(dark: false),
      StartupUpdateRequired() => AdmissionScreen(
        kind: AdmissionScreenKind.updateRequired,
        language: _language,
        onRetry: restart,
      ),
      StartupMaintenance() ||
      StartupRetry() ||
      StartupOpened() => AdmissionScreen(
        kind: AdmissionScreenKind.connectionPending,
        language: _language,
        onRetry: restart,
      ),
    };
    return BootstrapFrame(child: screen);
  }
}

/// The pre-router frame (`index.html` + `#root`): media query, default directionality, WebView text scale.
class BootstrapFrame extends StatelessWidget {
  const BootstrapFrame({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return WidgetsApp(
      color: kStartupBackground,
      debugShowCheckedModeBanner: false,
      title: 'Anacan',
      builder: (context, _) => WebViewTextScale(child: child),
    );
  }
}
