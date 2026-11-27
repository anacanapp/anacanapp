// Ported from: src/main.tsx, src/bootstrap-app.tsx, src/integrations/supabase/client.ts
//
// One entry point for the backend layer:
//   admission → backend selection → Supabase client (SessionStore + timeout client)
//   → adoption/restore of the native session (bounded) → sealed result.
// No UI here; the shell maps the result to its startup/retry/update screens exactly as
// src/main.tsx does (update-required text for [BootstrapUpdateRequired], the
// "connection pending" text with a retry button for every other failure).

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener, AppLifecycleState, WidgetsBinding;
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../admission/backend_admission.dart';
import '../admission/backend_bootstrap.dart';
import '../admission/backend_config.dart';
import '../session/auth_gateway.dart';
import '../session/auth_storage_key.dart';
import '../session/session_persistence.dart';
import '../storage/key_value_store.dart';
import '../storage/legacy_preferences.dart';
import '../storage/session_store.dart';
import 'build_config.dart';
import 'network_timeout.dart';

/// Why a startup could not open the app. Every reason shows the retry screen.
enum BootstrapFailureReason {
  admissionInvalid,
  admissionRollback,
  admissionStorage,
  admissionConfiguration,

  /// NATIVE_SESSION_RECOVERY_PENDING: a retained session could not be verified (offline,
  /// timeout, adoption pending). The backup is kept; never show the login form.
  sessionRecoveryPending,

  /// Anything else (React: any other startup exception).
  unexpected,
}

sealed class BootstrapResult {
  const BootstrapResult();
}

/// The app can open: the backend is selected and the session decision is made.
sealed class BootstrapOpened extends BootstrapResult {
  const BootstrapOpened(this.handle);
  final BackendHandle handle;

  BackendConfig get backend => handle.backend;
  SupabaseClient? get client => handle.client;
  NativeSessionPersistence get persistence => handle.persistence;
}

/// Opened with a session (restored, refreshed or adopted).
final class BootstrapReady extends BootstrapOpened {
  const BootstrapReady(super.handle);
}

/// Opened without a session: a fresh install, an explicit logout or a terminal
/// revocation. The login flow is the right next screen.
final class BootstrapSignedOut extends BootstrapOpened {
  const BootstrapSignedOut(super.handle);
}

/// ADMISSION_UPDATE_REQUIRED: the store build is older than the published minimum.
final class BootstrapUpdateRequired extends BootstrapResult {
  const BootstrapUpdateRequired();
}

/// ADMISSION_MAINTENANCE: a maintenance pin is latched (React shows the retry screen).
final class BootstrapMaintenance extends BootstrapResult {
  const BootstrapMaintenance();
}

/// Retry screen; storage stays intact. Retrying means a full new bootstrap.
final class BootstrapRetryableFailure extends BootstrapResult {
  const BootstrapRetryableFailure(this.reason);
  final BootstrapFailureReason reason;
}

/// Everything a factory needs to build the SDK client.
class BackendClientOptions {
  const BackendClientOptions({
    required this.url,
    required this.publishableKey,
    required this.headers,
    required this.authStorage,
    required this.sessionStore,
    required this.pkceStorage,
    required this.httpClient,
  });

  final String url;
  final String publishableKey;

  /// `X-Anacan-Version` (native builds tell the server their version).
  final Map<String, String> headers;
  final AuthStorageSelection authStorage;
  final SessionStore sessionStore;
  final GotrueAsyncStorage pkceStorage;
  final http.Client httpClient;
}

/// What a factory returns.
class SdkHandle {
  const SdkHandle({
    required this.auth,
    required this.hasSession,
    required this.dispose,
    this.client,
    this.removeAllChannels,
  });

  final SupabaseClient? client;
  final SessionAuthGateway auth;
  final bool Function() hasSession;
  final Future<void> Function() dispose;
  final Future<void> Function()? removeAllChannels;
}

typedef BackendClientFactory = Future<SdkHandle> Function(BackendClientOptions options);

/// The live backend of this process.
class BackendHandle {
  const BackendHandle({
    required this.backend,
    required this.selector,
    required this.sdk,
    required this.persistence,
    required this.sessionStore,
  });

  final BackendConfig backend;
  final BackendSelector selector;
  final SdkHandle sdk;
  final NativeSessionPersistence persistence;
  final SessionStore sessionStore;

  SupabaseClient? get client => sdk.client;
}

/// `X-Anacan-Version` header (client.ts: native only; Flutter is always native).
Map<String, String> versionHeaders(String appVersion, {bool isNativePlatform = true}) =>
    appVersion.isNotEmpty && isNativePlatform ? {'X-Anacan-Version': appVersion} : const {};

/// Default factory: `Supabase.initialize` with the app's storage and http client.
Future<SdkHandle> initializeSupabaseClient(BackendClientOptions options) async {
  final supabase = await Supabase.initialize(
    url: options.url,
    publishableKey: options.publishableKey,
    headers: options.headers,
    httpClient: options.httpClient,
    authOptions: FlutterAuthClientOptions(
      localStorage: options.sessionStore,
      pkceAsyncStorage: options.pkceStorage,
      autoRefreshToken: true,
      // supabase-js default; the server's redirect contract (auth-callback) is unchanged.
      authFlowType: AuthFlowType.implicit,
      // The WebView never parsed app deep links for sessions either; the auth feature
      // handles its callback explicitly.
      detectSessionInUri: false,
    ),
  );
  final client = supabase.client;
  return SdkHandle(
    client: client,
    auth: GoTrueSessionGateway(client.auth),
    hasSession: () => client.auth.currentSession != null,
    dispose: supabase.dispose,
    removeAllChannels: () async {
      await client.removeAllChannels();
    },
  );
}

/// Bound of the startup session decision (bootstrap-app.tsx).
Duration sessionRestoreBound({required bool sourceFirst}) =>
    sourceFirst ? const Duration(milliseconds: 8000) : const Duration(milliseconds: 15000);

class BackendClient {
  BackendClient({
    this.config = BuildConfig.fromEnvironment,
    LegacyPreferences? legacyPreferences,
    KeyValueStore? localStore,
    http.Client? baseHttpClient,
    BackendClientFactory? clientFactory,
    bool? isNativePlatform,
    this.probeTimeout = admissionProbeTimeout,
    Duration Function({required bool sourceFirst})? restoreBound,
    this.shutdownBound = const Duration(milliseconds: 1000),
  })  : legacyPreferences = legacyPreferences ?? const MethodChannelLegacyPreferences(),
        localStore = localStore ?? SharedPreferencesKeyValueStore(),
        baseHttpClient = baseHttpClient ?? http.Client(),
        clientFactory = clientFactory ?? initializeSupabaseClient,
        isNativePlatform = isNativePlatform ??
            (!kIsWeb &&
                (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS)),
        restoreBound = restoreBound ?? sessionRestoreBound;

  final BuildConfig config;
  final LegacyPreferences legacyPreferences;
  final KeyValueStore localStore;

  /// Plain client for the public admission document (never the SDK client).
  final http.Client baseHttpClient;
  final BackendClientFactory clientFactory;
  final bool isNativePlatform;
  final Duration probeTimeout;
  final Duration Function({required bool sourceFirst}) restoreBound;
  final Duration shutdownBound;

  Future<BootstrapResult>? _booting;
  BackendHandle? _handle;
  BackendSelector? _selector;

  BackendHandle? get handle => _handle;

  /// Coalesced: one admission, one client, one restore per [BackendClient].
  /// A restart (retry button, admission change) uses [restart].
  Future<BootstrapResult> bootstrapBackend() => _booting ??= _bootstrap();

  Future<BootstrapResult> _bootstrap() async {
    final selector = _selector = BackendSelector(config);
    final BackendConfig backend;
    try {
      backend = await AdmissionBootstrap(
        selector: selector,
        preferences: legacyPreferences,
        httpClient: baseHttpClient,
        isNativePlatform: isNativePlatform,
        probeTimeout: probeTimeout,
      ).bootstrapBackend();
    } on BackendAdmissionException catch (error) {
      // No SDK is constructed on admission failure. Storage stays intact.
      return switch (error.code) {
        BackendAdmissionCode.admissionUpdateRequired => const BootstrapUpdateRequired(),
        BackendAdmissionCode.admissionMaintenance => const BootstrapMaintenance(),
        BackendAdmissionCode.admissionInvalid =>
          const BootstrapRetryableFailure(BootstrapFailureReason.admissionInvalid),
        BackendAdmissionCode.admissionRollback =>
          const BootstrapRetryableFailure(BootstrapFailureReason.admissionRollback),
        BackendAdmissionCode.admissionStorage =>
          const BootstrapRetryableFailure(BootstrapFailureReason.admissionStorage),
        BackendAdmissionCode.admissionConfiguration =>
          const BootstrapRetryableFailure(BootstrapFailureReason.admissionConfiguration),
      };
    } catch (_) {
      return const BootstrapRetryableFailure(BootstrapFailureReason.unexpected);
    }

    final authStorage = selectAuthStorage(
      backendUrl: backend.url,
      sourceFirst: backend.sourceFirst,
      cutover: config.authCutover == 'true',
    );
    final sessionStore = SessionStore(local: localStore, legacy: legacyPreferences, authStorage: authStorage);
    final SdkHandle sdk;
    try {
      sdk = await clientFactory(BackendClientOptions(
        url: backend.url,
        publishableKey: backend.publishableKey,
        headers: versionHeaders(config.appVersion, isNativePlatform: isNativePlatform),
        authStorage: authStorage,
        sessionStore: sessionStore,
        pkceStorage: KeyValueGotrueAsyncStorage(localStore),
        httpClient: AnacanHttpClient(inner: baseHttpClient),
      ));
    } catch (_) {
      return const BootstrapRetryableFailure(BootstrapFailureReason.unexpected);
    }
    final persistence = NativeSessionPersistence(
      auth: sdk.auth,
      preferences: legacyPreferences,
      authStorage: authStorage,
      isNativePlatform: isNativePlatform,
      removeLocalAuthItem: sessionStore.removeAuthItem,
      onBackupObserved: sessionStore.noteBackup,
    );
    final handle = _handle = BackendHandle(
      backend: backend,
      selector: selector,
      sdk: sdk,
      persistence: persistence,
      sessionStore: sessionStore,
    );

    // A transient refresh failure must not open the login form. Always bounded: on a
    // slow/captive network an unbounded token refresh kept the startup screen up forever.
    try {
      await persistence
          .restoreAdmittedNativeSession(backend)
          .timeout(restoreBound(sourceFirst: config.usesSourceFirstBootstrap));
    } catch (_) {
      await _bounded(sdk.auth.stopAutoRefresh());
      return const BootstrapRetryableFailure(BootstrapFailureReason.sessionRecoveryPending);
    }
    persistence.startNativeSessionSync();
    return sdk.hasSession() ? BootstrapReady(handle) : BootstrapSignedOut(handle);
  }

  Future<void> _bounded(Future<void> work) =>
      work.then((_) {}, onError: (Object _) {}).timeout(shutdownBound, onTimeout: () {});

  /// Watches the published admission (60 s, on resume, on [wakes] such as connectivity
  /// regained). On a change it stops the SDK (no sign-out, no credential deletion) and
  /// calls [onRestartRequired]; the shell then calls [restart] and re-runs startup so
  /// all REST/Functions/Storage/Realtime callers choose together.
  void Function() watchAdmission(
    FutureOr<void> Function() onRestartRequired, {
    Stream<void>? ticks,
    Stream<void>? wakes,
    bool Function()? isVisible,
  }) {
    final selector = _selector;
    if (selector == null || _handle == null) return () {};
    AppLifecycleListener? lifecycle;
    StreamController<void>? resumed;
    if (wakes == null && isVisible == null) {
      resumed = StreamController<void>.broadcast();
      lifecycle = AppLifecycleListener(onResume: () => resumed!.add(null));
    }
    final stop = watchBackendAdmission(
      selector: selector,
      httpClient: baseHttpClient,
      ticks: ticks,
      wakes: wakes ?? resumed?.stream,
      isVisible: isVisible ??
          () => WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused &&
              WidgetsBinding.instance.lifecycleState != AppLifecycleState.hidden,
      probeTimeout: probeTimeout,
      onChange: () async {
        await shutdownForRestart();
        await onRestartRequired();
      },
    );
    return () {
      stop();
      lifecycle?.dispose();
      unawaited(resumed?.close());
    };
  }

  /// Stop auto refresh and realtime, bounded to [shutdownBound]. Credentials stay.
  Future<void> shutdownForRestart() async {
    final sdk = _handle?.sdk;
    if (sdk == null) return;
    await _bounded(Future.wait([
      sdk.auth.stopAutoRefresh(),
      if (sdk.removeAllChannels != null) sdk.removeAllChannels!(),
    ]).then((_) {}));
  }

  /// Dispose this process's client so a fresh [BackendClient] can bootstrap again
  /// (React: `window.location.reload()`).
  Future<void> restart() async {
    await shutdownForRestart();
    final sdk = _handle?.sdk;
    _handle = null;
    _booting = null;
    _selector = null;
    if (sdk != null) await _bounded(sdk.dispose());
  }
}
