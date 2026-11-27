// Ported from: src/integrations/supabase/backend-bootstrap.ts

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../storage/legacy_preferences.dart';
import 'backend_admission.dart';
import 'backend_config.dart';

/// Outcome of one control read.
/// - [AdmissionProbeUnavailable]: offline, timeout, outage status; nothing was decided.
/// - [AdmissionProbeMalformed]: not the control document at all (non-200, non-JSON such as a
///   captive portal or proxy HTML page, missing no-store, oversized or unparseable body).
/// - [AdmissionProbeInvalid]: a JSON no-store document from the control URL that is not an
///   acceptable policy.
sealed class AdmissionProbe {
  const AdmissionProbe();
}

final class AdmissionProbePolicy extends AdmissionProbe {
  const AdmissionProbePolicy(this.policy);
  final BackendAdmission policy;
}

final class AdmissionProbeUnavailable extends AdmissionProbe {
  const AdmissionProbeUnavailable();
}

final class AdmissionProbeMalformed extends AdmissionProbe {
  const AdmissionProbeMalformed();
}

final class AdmissionProbeInvalid extends AdmissionProbe {
  const AdmissionProbeInvalid();
}

/// Bound of one control request (headers and body).
const Duration admissionProbeTimeout = Duration(seconds: 4);

/// Largest accepted control document, in UTF-16 code units (JS `text.length`).
const int admissionMaxBodyLength = 2048;

/// Public control request only. Never send an API key, session or device/user ID.
///
/// The request carries no headers of its own and does not follow redirects (React:
/// `credentials: 'omit'`, `redirect: 'error'`, `referrerPolicy: 'no-referrer'`,
/// `cache: 'no-store'`; `dart:io` keeps no cookies and no HTTP cache).
Future<AdmissionProbe> probeBackendAdmission(http.Client client, {Duration timeout = admissionProbeTimeout}) async {
  final abort = Completer<void>();
  final request = http.AbortableRequest('GET', Uri.parse(admissionUrl), abortTrigger: abort.future)
    ..followRedirects = false;

  Future<AdmissionProbe> read() async {
    http.StreamedResponse response;
    try {
      response = await client.send(request);
    } catch (_) {
      // Offline: retain the last authority; never invent Azure readiness.
      return const AdmissionProbeUnavailable();
    }
    final status = response.statusCode;
    // A disabled/blocked subscription may return 401/403 rather than 5xx. The control
    // document is public: these are availability failures, not new authority decisions.
    if (const [401, 403, 404, 408, 429].contains(status) || status >= 500) {
      unawaited(response.stream.drain<void>().catchError((_) {}));
      return const AdmissionProbeUnavailable();
    }
    final contentType = response.headers['content-type'];
    final cacheControl = response.headers['cache-control'];
    if (status != 200 ||
        contentType == null ||
        !contentType.contains('application/json') ||
        cacheControl == null ||
        !cacheControl.split(',').any((value) => value.trim() == 'no-store')) {
      unawaited(response.stream.drain<void>().catchError((_) {}));
      return const AdmissionProbeMalformed();
    }
    String text;
    try {
      text = utf8.decode(await response.stream.toBytes(), allowMalformed: true);
    } catch (_) {
      return const AdmissionProbeUnavailable();
    }
    if (text.length > admissionMaxBodyLength) return const AdmissionProbeMalformed();
    Object? parsed;
    try {
      parsed = jsonDecode(text);
    } catch (_) {
      return const AdmissionProbeMalformed();
    }
    try {
      return AdmissionProbePolicy(parseBackendAdmission(parsed));
    } on BackendAdmissionException {
      return const AdmissionProbeInvalid();
    }
  }

  try {
    return await read().timeout(timeout);
  } on TimeoutException {
    return const AdmissionProbeUnavailable();
  } finally {
    if (!abort.isCompleted) abort.complete();
  }
}

/// Startup read. A control document that fails validation blocks startup (ADMISSION_INVALID).
/// Something that is not the control document at all (captive portal / proxy HTML, a redirect,
/// a cacheable or unparseable body) carries no decision: it is handled exactly like offline,
/// so the device keeps its pinned authority and opens instead of stopping on the retry screen.
/// It can never select or advance an authority.
Future<BackendAdmission?> fetchBackendAdmission(http.Client client, {Duration timeout = admissionProbeTimeout}) async {
  final probe = await probeBackendAdmission(client, timeout: timeout);
  return switch (probe) {
    AdmissionProbePolicy(:final policy) => policy,
    AdmissionProbeUnavailable() || AdmissionProbeMalformed() => null,
    AdmissionProbeInvalid() => throw const BackendAdmissionException(BackendAdmissionCode.admissionInvalid),
  };
}

/// Startup admission: reads and advances the device pin, then selects the backend.
/// Must finish before any Supabase client exists.
class AdmissionBootstrap {
  AdmissionBootstrap({
    required this.selector,
    required this.preferences,
    required this.httpClient,
    this.isNativePlatform = true,
    this.probeTimeout = admissionProbeTimeout,
  });

  final BackendSelector selector;
  final LegacyPreferences preferences;
  final http.Client httpClient;

  /// React: `Capacitor.isNativePlatform()` and the `app.anacan.az` WebView origin.
  /// The Flutter app is always the native app; false only on web/desktop test hosts.
  final bool isNativePlatform;
  final Duration probeTimeout;

  Future<BackendConfig>? _booting;

  /// Coalesced: concurrent callers share one admission and one selection.
  /// Throws [BackendAdmissionException].
  Future<BackendConfig> bootstrapBackend() {
    if (!selector.usesSourceFirstBootstrap) return Future.sync(selector.getBackendConfig);
    return _booting ??= _boot();
  }

  Future<BackendConfig> _boot() async {
    // This protocol is for the existing native app, never a web preview.
    if (!isNativePlatform) throw const BackendAdmissionException(BackendAdmissionCode.admissionConfiguration);

    AdmissionPin? pin;
    try {
      // React also mirrors the pin in WebView localStorage and reconciles both copies.
      // Flutter has no WebView storage: the Preferences copy is the only one.
      final native = await preferences.get(admissionPinKey);
      pin = reconcileAdmissionPins(null, parseAdmissionPin(native));
    } catch (_) {
      throw const BackendAdmissionException(BackendAdmissionCode.admissionStorage);
    }

    final remote = await fetchBackendAdmission(httpClient, timeout: probeTimeout);
    var initial = initialSourceAdmission;
    final bundled = selector.config.initialManagedAdmission;
    if (bundled.isNotEmpty) {
      Object? decoded;
      try {
        decoded = jsonDecode(bundled);
      } on FormatException {
        throw const BackendAdmissionException(BackendAdmissionCode.admissionConfiguration);
      }
      initial = parseBackendAdmission(decoded);
      if (initial.phase != AdmissionPhase.azure) {
        throw const BackendAdmissionException(BackendAdmissionCode.admissionConfiguration);
      }
    }
    if (initial.phase == AdmissionPhase.azure && remote?.phase == AdmissionPhase.source) {
      throw const BackendAdmissionException(BackendAdmissionCode.admissionRollback);
    }
    // A verified post-cutover native default is an authority floor. A stale
    // Source control response cannot move a new installation back to Source.
    // Keep an observed maintenance pin latched until a newer live decision.
    final retainedPin = initial.phase == AdmissionPhase.azure &&
            (pin == null ||
                pin.policy.phase == AdmissionPhase.source ||
                (pin.policy.phase == AdmissionPhase.azure && pin.policy.generation < initial.generation))
        ? advanceAdmission(pin, initial)
        : pin;
    final next = advanceAdmission(retainedPin, remote ?? retainedPin?.policy ?? initial);
    try {
      // Preferences survives upgrades. Write it before any SDK/token rotation.
      // A failed write blocks boot.
      await preferences.set(admissionPinKey, next.encode());
    } catch (_) {
      throw const BackendAdmissionException(BackendAdmissionCode.admissionStorage);
    }
    assertAdmissionReady(next, selector.config.appVersion);
    return selector.selectAdmittedBackend(next);
  }
}

/// Interval of the admission watcher.
const Duration admissionWatchInterval = Duration(seconds: 60);

/// Changes take effect only after a full bootstrap, never by rebinding a live SDK.
/// Server-side source freeze/drain is still required for in-flight/older clients.
///
/// [ticks] replaces `setInterval(60 s)`; [wakes] replaces the `online` and
/// `visibilitychange` events (connectivity regained, app resumed); [isVisible]
/// replaces `document.visibilityState !== 'hidden'`.
/// Returns a stop function.
void Function() watchBackendAdmission({
  required BackendSelector selector,
  required http.Client httpClient,
  required FutureOr<void> Function() onChange,
  Stream<void>? ticks,
  Stream<void>? wakes,
  bool Function()? isVisible,
  Duration probeTimeout = admissionProbeTimeout,
}) {
  if (!selector.usesSourceFirstBootstrap) return () {};
  final current = selector.getBackendConfig().admission!;
  var stopped = false, checking = false, invalidStreak = 0;

  Future<void> check() async {
    if (stopped || checking || !(isVisible?.call() ?? true)) return;
    checking = true;
    var changed = false;
    try {
      final probe = await probeBackendAdmission(httpClient, timeout: probeTimeout);
      switch (probe) {
        case AdmissionProbePolicy(:final policy):
          invalidStreak = 0;
          changed = !sameAdmission(current.policy, policy);
        case AdmissionProbeInvalid():
          // A JSON control document that fails validation must not leave a live writer
          // running forever; require it on two consecutive reads so one odd answer
          // (a JSON-speaking proxy) cannot restart the app. Startup then blocks on it.
          invalidStreak += 1;
          changed = invalidStreak >= 2;
        case AdmissionProbeUnavailable() || AdmissionProbeMalformed():
          // Offline/outage, captive portal or proxy HTML, truncated body: no decision.
          invalidStreak = 0;
      }
    } catch (_) {
      invalidStreak = 0;
    } finally {
      checking = false;
    }
    if (changed && !stopped) {
      stopped = true;
      await onChange();
    }
  }

  final subscriptions = <StreamSubscription<void>>[
    (ticks ?? Stream<void>.periodic(admissionWatchInterval)).listen((_) => unawaited(check())),
    if (wakes != null) wakes.listen((_) => unawaited(check())),
  ];
  return () {
    stopped = true;
    for (final subscription in subscriptions) {
      unawaited(subscription.cancel());
    }
  };
}
