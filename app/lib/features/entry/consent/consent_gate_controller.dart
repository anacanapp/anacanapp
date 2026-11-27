// Ported from: src/hooks/useConsentGate.ts, src/pages/Index.tsx (consent gate inputs: backend url, user id)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../shell/gates/gate_sequence.dart' show ConsentGateStatus;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/shell_bindings.dart' show backendUrlProvider;
import '../entry_services.dart';
import 'consent_gate.dart';

/// [ConsentService] over the app LocalStore and the backend RPC.
final consentServiceProvider = Provider<ConsentService>((ref) {
  final platform = ref.watch(consentPlatformProvider);
  return ConsentService(
    store: ref.watch(localStoreProvider),
    rpc: ref.watch(entryRpcProvider),
    source: platform.source,
    appVersion: platform.appVersion,
    deviceOffline: ref.watch(deviceOfflineProvider),
  );
});

/// `(userId, backend)` the gate is decided for.
final consentGateScopeProvider = Provider<({String? userId, String backend})>((ref) {
  final userId = ref.watch(authUserProvider.select((u) => u?.id));
  String backend = '';
  try {
    backend = ref.watch(backendUrlProvider);
  } catch (_) {}
  return (userId: userId, backend: backend);
});

class ConsentGateView {
  const ConsentGateView({required this.status, this.consent});
  final ConsentGateStatus status;
  final ConsentState? consent;
}

/// `useConsentGate(userId, backend)`.
final consentGateProvider = NotifierProvider<ConsentGateController, ConsentGateView>(ConsentGateController.new);

class ConsentGateController extends Notifier<ConsentGateView> {
  @override
  ConsentGateView build() {
    final scope = ref.watch(consentGateScopeProvider);
    final userId = scope.userId;
    if (userId == null) return const ConsentGateView(status: ConsentGateStatus.skip);
    final service = ref.watch(consentServiceProvider);
    final backend = scope.backend;
    var alive = true;
    ref.onDispose(() => alive = false);
    final local = service.readAcceptedVersion(backend, userId);
    unawaited(() async {
      if (local != null) await service.flushPendingConsents(backend, userId);
      final consent = await service.fetchConsentState();
      if (!alive) return;
      final localNow = service.readAcceptedVersion(backend, userId);
      final decision = decideConsentGate(consent, localAcceptedVersion: localNow);
      final terms = consent?.consents['terms'];
      final version = consent?.gate.version;
      if (version != null && terms != null && terms.granted && terms.documentVersion == version) {
        service.rememberAcceptedVersion(backend, userId, version);
      }
      state = ConsentGateView(
        status: decision == ConsentGateDecision.show ? ConsentGateStatus.show : ConsentGateStatus.skip,
        consent: consent,
      );
    }());
    return ConsentGateView(status: local != null ? ConsentGateStatus.skip : ConsentGateStatus.loading);
  }

  /// `markAccepted()`.
  void markAccepted() => state = ConsentGateView(status: ConsentGateStatus.skip, consent: state.consent);
}

/// Value for the shell's `consentGateInputProvider` (app/lib/state/shell_bindings.dart):
/// `consentGateInputProvider.overrideWith((ref) => ref.watch(consentGateInputFromStateProvider))`.
final consentGateInputFromStateProvider = Provider<({ConsentGateStatus status, String? version})>((ref) {
  final view = ref.watch(consentGateProvider);
  return (status: view.status, version: view.consent?.gate.version);
});
