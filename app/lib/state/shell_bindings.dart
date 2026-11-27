// Ported from: src/pages/Index.tsx (e-mail gate effect, PENDING_FUNNEL_KEY check, the store/auth reads that feed
// the gate order), src/store/userStore.ts (setters used by the gates).
//
// Wires the shell's read-only inputs (app/lib/shell/shell_inputs.dart, docs/flutter/SHELL.md §2) from the auth
// controller and the stores. `shellStateOverrides()` returns the overrides for the root ProviderScope; inputs owned
// by features that are not ported yet (update centre, legacy force update, consent gate, onboarding journey,
// unread counters, bottom-nav style) stay at their neutral values and are exposed as overridable providers here.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../core/auth/auth_controller.dart';
import '../core/auth/auth_providers.dart';
import '../core/auth/email_verification.dart';
import '../core/data/app_settings.dart' show appSettingProvider;
import '../core/net/backend_client.dart' show BootstrapOpened;
import '../core/net/backend_providers.dart';
import '../shell/gates/gate_sequence.dart';
import '../shell/shell_inputs.dart';
import 'persisted_store.dart';
import 'user_store.dart';

/// `getBackendConfig().url` of the admitted backend ('' before startup opened it).
final backendUrlProvider = Provider<String>((ref) {
  final result = ref.watch(backendBootstrapProvider).value;
  return result is BootstrapOpened ? result.backend.url : '';
});

String _backendUrl(Ref ref) => ref.watch(backendUrlProvider);

/// `ShellUser` from useUserStore + useAuth + backend config.
final shellUserFromStateProvider = Provider<ShellUser>((ref) {
  final store = ref.watch(userStoreProvider);
  final auth = ref.watch(authControllerProvider);
  final profile = auth.profile;
  return ShellUser(
    isAuthenticated: store.isAuthenticated,
    authLoading: auth.loading,
    profileLoaded: auth.profileLoaded,
    language: store.language,
    backendUrl: _backendUrl(ref),
    userId: auth.user?.id,
    role: store.role,
    lifeStage: store.lifeStage,
    isAdmin: auth.isAdmin,
    isModerator: auth.isModerator,
    profileCountryCode: profile?.countryCode,
    storedCountryCode: store.countryCode,
    linkedPartnerId: profile?.linkedPartnerId,
    avatarUrl: profile?.avatarUrl,
    displayName: profile?.name ?? store.name,
  );
});

class UserStoreGateActions implements GateActions {
  UserStoreGateActions(this.store);
  final UserStore store;
  @override
  void setFunnelCompleted(bool value) => store.setFunnelCompleted(value);
  @override
  void setHasSeenIntro(bool value) => store.setHasSeenIntro(value);
  @override
  void setHasSelectedLanguage(bool value) => store.setHasSelectedLanguage(value);
}

/// Index's e-mail gate: onboarded → not required; cached `anacan_email_verified_v1:<uid>` → not required; else
/// `email_verification_state_v1` with a 4 s "not required" fallback. [markVerified] = EmailVerificationScreen done.
final emailGateProvider = NotifierProvider<EmailGateController, EmailGateStatus>(EmailGateController.new);

class EmailGateController extends Notifier<EmailGateStatus> {
  String? _userId;

  @override
  EmailGateStatus build() {
    final isAuthenticated = ref.watch(userStoreProvider.select((s) => s.isAuthenticated));
    final isOnboarded = ref.watch(userStoreProvider.select((s) => s.isOnboarded));
    final userId = ref.watch(authUserProvider)?.id;
    _userId = userId;
    if (!isAuthenticated || userId == null) return const EmailGateUndecided();
    if (isOnboarded) return const EmailGateDecided(required: false);
    final store = ref.read(localStoreProvider);
    final key = emailVerifiedCacheKey(userId);
    if (store.getItem(key) == '1') return const EmailGateDecided(required: false);
    var alive = true;
    final timer = Timer(emailGateDecisionTimeout, () {
      if (alive && state is EmailGateUndecided) state = const EmailGateDecided(required: false);
    });
    ref.onDispose(() {
      alive = false;
      timer.cancel();
    });
    unawaited(() async {
      final result = await fetchEmailVerificationState(ref.read(supabaseClientProvider));
      if (!alive) return;
      timer.cancel();
      if (result.answered && !result.required) store.setItem(key, '1');
      state = EmailGateDecided(required: result.required, email: result.email);
    }());
    return const EmailGateUndecided();
  }

  void markVerified() {
    final userId = _userId;
    if (userId == null) return;
    ref.read(localStoreProvider).setItem(emailVerifiedCacheKey(userId), '1');
    state = const EmailGateDecided(required: false);
  }
}

/// Inputs from features not ported yet; override when they land.
final updateCentreForceProvider = Provider<bool>((ref) => false);
final legacyForceUpdateProvider = Provider<bool>((ref) => false);
final consentGateInputProvider = Provider<({ConsentGateStatus status, String? version})>(
  (ref) => (status: ConsentGateStatus.skip, version: null),
);

/// `hasPendingOnboarding(user.id, backendUrl, profile.onboarding_answers)` (onboarding feature).
final hasPendingOnboardingProvider = Provider<bool>((ref) => false);

/// LS `anacan_pending_funnel` = `{userId, backend}` of this user and backend.
final legacyFunnelFlagMatchesProvider = Provider<bool>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final store = ref.watch(localStoreProvider);
  final sub = store.changes.where((c) => c.key == 'anacan_pending_funnel').listen((_) => ref.invalidateSelf());
  ref.onDispose(sub.cancel);
  final value = store.readJson('anacan_pending_funnel');
  return value is Map && value['userId'] == userId && value['backend'] == _backendUrl(ref);
});

/// `GateInputs` from the stores, auth, the active block query and the e-mail gate.
final gateInputsFromStateProvider = Provider<GateInputs>((ref) {
  final store = ref.watch(userStoreProvider);
  final auth = ref.watch(authControllerProvider);
  final block = auth.user == null ? null : ref.watch(activeBlockQuery).data;
  final consent = ref.watch(consentGateInputProvider);
  return GateInputs(
    hasSelectedLanguage: store.hasSelectedLanguage,
    hasSeenIntro: store.hasSeenIntro,
    isOnboarded: store.isOnboarded,
    isAuthenticated: store.isAuthenticated,
    authLoading: auth.loading,
    hasUser: auth.user != null,
    updateCentreForce: ref.watch(updateCentreForceProvider),
    legacyForceUpdate: ref.watch(legacyForceUpdateProvider),
    fullBlock: block?.blockType == 'full',
    emailGate: auth.user == null ? const EmailGateDecided(required: false) : ref.watch(emailGateProvider),
    consent: consent.status,
    consentVersion: consent.version,
    profileLoaded: auth.profileLoaded,
    hasProfile: auth.profile != null,
    profileCountryCode: auth.profile?.countryCode,
    profileName: auth.profile?.name,
    role: store.role,
    lifeStage: store.lifeStage,
    hasPendingOnboarding: ref.watch(hasPendingOnboardingProvider),
    legacyFunnelFlagMatches: ref.watch(legacyFunnelFlagMatchesProvider),
    hasCompletedFunnel: store.hasCompletedFunnel,
  );
});

/// `useAppSetting('bottom_nav_style') === 'capsule'` (classic otherwise, also while loading).
final bottomNavStyleFromSettingsProvider = Provider<BottomNavStyle>(
  (ref) => ref.watch(appSettingProvider('bottom_nav_style')) == 'capsule' ? BottomNavStyle.capsule : BottomNavStyle.classic,
);

/// Overrides for the root ProviderScope: shell user, gate inputs, gate actions and the bottom-nav style from this
/// state layer; unread counters stay 0 until the chat / community features are ported.
List<Override> shellStateOverrides() => [
      shellUserProvider.overrideWith((ref) => ref.watch(shellUserFromStateProvider)),
      gateInputsProvider.overrideWith((ref) => ref.watch(gateInputsFromStateProvider)),
      gateActionsProvider.overrideWith((ref) => UserStoreGateActions(ref.read(userStoreProvider.notifier))),
      unreadMessagesCountProvider.overrideWithValue(0),
      unreadCommunityPostsCountProvider.overrideWithValue(0),
      bottomNavStyleProvider.overrideWith((ref) => ref.watch(bottomNavStyleFromSettingsProvider)),
    ];
