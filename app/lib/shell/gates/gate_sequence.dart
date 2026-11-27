// Ported from: src/pages/Index.tsx (render order before the shell: splash, initial language, intro,
//              auth loading, update-centre force, legacy force_update, auth, full block, e-mail gate,
//              consent gate, country gate, onboarding / funnel), src/components/SplashScreen.tsx (350 ms),
//              docs/CONSENT_GATE.md, docs/APP_UPDATE_CENTRE.md, docs/flutter/SERVICES.md §1.4
import 'package:flutter/foundation.dart';

/// Splash completes after 350 ms (`SplashScreen`), once per process.
const Duration kBrandSplashDuration = Duration(milliseconds: 350);

/// Index's independent 1 500 ms timer: hides the splash and shows the intro if not seen yet.
const Duration kIntroTimer = Duration(milliseconds: 1500);

/// E-mail verification gate state (`emailGate` in Index; decided within 4 s, see SERVICES.md §1.4).
@immutable
sealed class EmailGateStatus {
  const EmailGateStatus();
}

/// No decision yet for the current user (`emailGate?.userId !== user.id`).
class EmailGateUndecided extends EmailGateStatus {
  const EmailGateUndecided();
}

/// Decided; [required] with an [email] shows the code screen.
class EmailGateDecided extends EmailGateStatus {
  const EmailGateDecided({required this.required, this.email});
  final bool required;
  final String? email;
}

/// `useConsentGate().status`.
enum ConsentGateStatus { loading, show, skip }

/// Everything the gate order reads (Index + its hooks). Splash/intro/countryJustSet are local
/// [GateHost] state and passed separately.
@immutable
class GateInputs {
  const GateInputs({
    required this.hasSelectedLanguage,
    required this.hasSeenIntro,
    required this.isOnboarded,
    required this.isAuthenticated,
    required this.authLoading,
    required this.hasUser,
    this.updateCentreForce = false,
    this.legacyForceUpdate = false,
    this.fullBlock = false,
    this.emailGate = const EmailGateDecided(required: false),
    this.consent = ConsentGateStatus.skip,
    this.consentVersion,
    this.profileLoaded = false,
    this.hasProfile = false,
    this.profileCountryCode,
    this.profileName,
    this.role,
    this.lifeStage,
    this.hasPendingOnboarding = false,
    this.legacyFunnelFlagMatches = false,
    this.hasCompletedFunnel = true,
  });

  /// userStore `hasSelectedLanguage`.
  final bool hasSelectedLanguage;

  /// userStore `hasSeenIntro`.
  final bool hasSeenIntro;

  /// userStore `isOnboarded`.
  final bool isOnboarded;

  /// userStore `isAuthenticated`.
  final bool isAuthenticated;

  /// useAuth `loading`.
  final bool authLoading;

  /// useAuth `user` present.
  final bool hasUser;

  /// Update centre: `appUpdate.forceRequired && appUpdate.decision`.
  final bool updateCentreForce;

  /// Legacy: `!forceUpdateLoading && updateRequired && forceUpdate`.
  final bool legacyForceUpdate;

  /// `activeBlock?.block_type === 'full'`.
  final bool fullBlock;
  final EmailGateStatus emailGate;
  final ConsentGateStatus consent;

  /// `consentGate.consent?.gate.version` (the gate shows only with a version).
  final String? consentVersion;
  final bool profileLoaded;

  /// useAuth `profile` present.
  final bool hasProfile;

  /// `profile.country_code`.
  final String? profileCountryCode;

  /// `profile.name` (needsName).
  final String? profileName;
  final String? role;
  final String? lifeStage;

  /// `hasPendingOnboarding(user.id, backendUrl, profile.onboarding_answers)` (onboarding-model).
  final bool hasPendingOnboarding;

  /// LS `anacan_pending_funnel` = `{userId, backend}` of this user and backend.
  final bool legacyFunnelFlagMatches;

  /// userStore `hasCompletedFunnel`.
  final bool hasCompletedFunnel;

  bool get isPartnerUser => role == 'partner' || lifeStage == 'partner';

  /// Apple/Google sign-ups got the placeholder name `İstifadəçi`.
  bool get needsName {
    if (!hasProfile) return false;
    final n = profileName;
    return n == null || n.trim().isEmpty || n == 'İstifadəçi';
  }

  bool get pendingJourney => hasUser && !isPartnerUser && hasPendingOnboarding;
  bool get legacyPending => isOnboarded && !hasCompletedFunnel && !isPartnerUser && legacyFunnelFlagMatches;
  bool get needsCountry => profileLoaded && hasProfile && (profileCountryCode ?? '').trim().isEmpty;

  /// Existing users (seen intro / onboarded / signed in) skip the language screen.
  bool get bypassLanguage => hasSeenIntro || isOnboarded || isAuthenticated;
}

/// The screen Index shows before (or instead of) the shell.
enum GateId {
  splash,
  initialLanguage,
  intro,
  startup,
  forceUpdate,
  auth,
  blocked,
  emailVerification,
  consent,
  country,
  onboarding,

  /// Gates passed: the tab shell.
  shell,
}

/// Why a [GateId.startup] / [GateId.forceUpdate] is shown.
enum GateReason {
  authLoading,
  emailPending,
  consentLoading,
  profileLoading,
  updateCentre,
  legacyForceUpdate,
}

@immutable
class GateDecision {
  const GateDecision(this.gate, {this.reason, this.markLanguageSelected = false, this.markFunnelCompleted = false});
  final GateId gate;
  final GateReason? reason;

  /// Effect: `setHasSelectedLanguage(true)` for a user who bypasses the language screen.
  final bool markLanguageSelected;

  /// Effect: `setFunnelCompleted(true)` when the shell is reached without a pending funnel.
  final bool markFunnelCompleted;

  @override
  bool operator ==(Object other) =>
      other is GateDecision &&
      other.gate == gate &&
      other.reason == reason &&
      other.markLanguageSelected == markLanguageSelected &&
      other.markFunnelCompleted == markFunnelCompleted;
  @override
  int get hashCode => Object.hash(gate, reason, markLanguageSelected, markFunnelCompleted);
  @override
  String toString() => 'GateDecision(${gate.name}${reason == null ? '' : ', ${reason!.name}'}'
      '${markLanguageSelected ? ', +language' : ''}${markFunnelCompleted ? ', +funnel' : ''})';
}

/// Index's gate order, first match wins.
GateDecision decideGate(GateInputs i, {required bool showSplash, required bool showIntro, bool countryJustSet = false}) {
  final markLanguage = !i.hasSelectedLanguage && i.bypassLanguage;
  GateDecision d(GateId g, [GateReason? r]) => GateDecision(g, reason: r, markLanguageSelected: markLanguage);

  if (showSplash) return d(GateId.splash);
  if (!i.hasSelectedLanguage && !i.bypassLanguage) return d(GateId.initialLanguage);
  if (showIntro) return d(GateId.intro);
  if (i.authLoading) return d(GateId.startup, GateReason.authLoading);
  if (i.updateCentreForce) return d(GateId.forceUpdate, GateReason.updateCentre);
  if (i.legacyForceUpdate) return d(GateId.forceUpdate, GateReason.legacyForceUpdate);
  if (!i.isAuthenticated) return d(GateId.auth);
  if (i.fullBlock) return d(GateId.blocked);
  if (i.hasUser && !i.isOnboarded && i.emailGate is EmailGateUndecided) return d(GateId.startup, GateReason.emailPending);
  final email = i.emailGate;
  if (i.hasUser && email is EmailGateDecided && email.required && email.email != null) return d(GateId.emailVerification);
  // The admin panel never opens in-app natively, so the "not while the admin panel is open" exception is gone.
  if (i.hasUser) {
    if (i.consent == ConsentGateStatus.loading) return d(GateId.startup, GateReason.consentLoading);
    if (i.consent == ConsentGateStatus.show && (i.consentVersion ?? '').isNotEmpty) return d(GateId.consent);
  }
  if (i.needsCountry && !countryJustSet) return d(GateId.country);
  if ((!i.isOnboarded && !i.isPartnerUser) || i.needsName || i.pendingJourney || i.legacyPending) {
    if (!i.profileLoaded) return d(GateId.startup, GateReason.profileLoading);
    return d(GateId.onboarding);
  }
  return GateDecision(GateId.shell, markLanguageSelected: markLanguage, markFunnelCompleted: !i.hasCompletedFunnel);
}
