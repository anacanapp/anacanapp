// Ported from: src/pages/Index.tsx gate order (no vitest suite; exhaustive table over decideGate)
import 'package:anacan/shell/gates/gate_sequence.dart';
import 'package:flutter_test/flutter_test.dart';

GateInputs gi({
  bool hasSelectedLanguage = true,
  bool hasSeenIntro = true,
  bool isOnboarded = true,
  bool isAuthenticated = true,
  bool authLoading = false,
  bool hasUser = true,
  bool updateCentreForce = false,
  bool legacyForceUpdate = false,
  bool fullBlock = false,
  EmailGateStatus emailGate = const EmailGateDecided(required: false),
  ConsentGateStatus consent = ConsentGateStatus.skip,
  String? consentVersion = '2.0',
  bool profileLoaded = true,
  bool hasProfile = true,
  String? country = 'AZ',
  String? name = 'Aysel',
  String? role = 'woman',
  String? lifeStage = 'bump',
  bool pendingOnboarding = false,
  bool legacyFlag = false,
  bool hasCompletedFunnel = true,
}) =>
    GateInputs(
      hasSelectedLanguage: hasSelectedLanguage,
      hasSeenIntro: hasSeenIntro,
      isOnboarded: isOnboarded,
      isAuthenticated: isAuthenticated,
      authLoading: authLoading,
      hasUser: hasUser,
      updateCentreForce: updateCentreForce,
      legacyForceUpdate: legacyForceUpdate,
      fullBlock: fullBlock,
      emailGate: emailGate,
      consent: consent,
      consentVersion: consentVersion,
      profileLoaded: profileLoaded,
      hasProfile: hasProfile,
      profileCountryCode: country,
      profileName: name,
      role: role,
      lifeStage: lifeStage,
      hasPendingOnboarding: pendingOnboarding,
      legacyFunnelFlagMatches: legacyFlag,
      hasCompletedFunnel: hasCompletedFunnel,
    );

typedef Row = (String, GateInputs, bool splash, bool intro, bool countrySet, GateId gate, GateReason? reason);

void main() {
  final rows = <Row>[
    ('splash wins over everything', gi(authLoading: true, isAuthenticated: false), true, true, false, GateId.splash, null),
    ('first launch: language screen', gi(hasSelectedLanguage: false, hasSeenIntro: false, isOnboarded: false, isAuthenticated: false, hasUser: false),
        false, false, false, GateId.initialLanguage, null),
    ('language screen beats the intro', gi(hasSelectedLanguage: false, hasSeenIntro: false, isOnboarded: false, isAuthenticated: false, hasUser: false),
        false, true, false, GateId.initialLanguage, null),
    ('seen intro bypasses language', gi(hasSelectedLanguage: false, isAuthenticated: false, hasUser: false, isOnboarded: false),
        false, false, false, GateId.auth, null),
    ('signed in bypasses language', gi(hasSelectedLanguage: false, hasSeenIntro: false), false, false, false, GateId.shell, null),
    ('intro after the language', gi(hasSeenIntro: false, isAuthenticated: false, hasUser: false), false, true, false, GateId.intro, null),
    ('auth loading → startup', gi(authLoading: true, updateCentreForce: true), false, false, false, GateId.startup, GateReason.authLoading),
    ('update centre force beats legacy', gi(updateCentreForce: true, legacyForceUpdate: true, isAuthenticated: false),
        false, false, false, GateId.forceUpdate, GateReason.updateCentre),
    ('legacy force_update', gi(legacyForceUpdate: true, isAuthenticated: false), false, false, false, GateId.forceUpdate, GateReason.legacyForceUpdate),
    ('force update before auth', gi(legacyForceUpdate: true, fullBlock: true), false, false, false, GateId.forceUpdate, GateReason.legacyForceUpdate),
    ('signed out → auth', gi(isAuthenticated: false, hasUser: false, fullBlock: true), false, false, false, GateId.auth, null),
    ('full block before e-mail/consent', gi(fullBlock: true, isOnboarded: false, emailGate: const EmailGateUndecided(), consent: ConsentGateStatus.show),
        false, false, false, GateId.blocked, null),
    ('new account waits for the e-mail decision', gi(isOnboarded: false, emailGate: const EmailGateUndecided()),
        false, false, false, GateId.startup, GateReason.emailPending),
    ('onboarded account never waits for the e-mail decision', gi(emailGate: const EmailGateUndecided()), false, false, false, GateId.shell, null),
    ('e-mail code required', gi(isOnboarded: false, emailGate: const EmailGateDecided(required: true, email: 'a@b.c'), consent: ConsentGateStatus.show),
        false, false, false, GateId.emailVerification, null),
    ('e-mail required without an address continues', gi(emailGate: const EmailGateDecided(required: true)), false, false, false, GateId.shell, null),
    ('consent loading → startup', gi(consent: ConsentGateStatus.loading, country: ''), false, false, false, GateId.startup, GateReason.consentLoading),
    ('consent shown before country and onboarding', gi(consent: ConsentGateStatus.show, country: '', isOnboarded: false),
        false, false, false, GateId.consent, null),
    ('consent without a version is skipped', gi(consent: ConsentGateStatus.show, consentVersion: null), false, false, false, GateId.shell, null),
    ('consent needs a user', gi(hasUser: false, consent: ConsentGateStatus.loading), false, false, false, GateId.shell, null),
    ('empty country → country gate', gi(country: '  ', isOnboarded: false), false, false, false, GateId.country, null),
    ('null country → country gate', gi(country: null), false, false, false, GateId.country, null),
    ('country just set hides it', gi(country: ''), false, false, true, GateId.shell, null),
    ('country gate needs the loaded profile', gi(country: '', profileLoaded: false), false, false, false, GateId.shell, null),
    ('not onboarded → onboarding', gi(isOnboarded: false), false, false, false, GateId.onboarding, null),
    ('onboarding waits for the profile', gi(isOnboarded: false, profileLoaded: false, hasProfile: false),
        false, false, false, GateId.startup, GateReason.profileLoading),
    ('partner (role) skips onboarding', gi(isOnboarded: false, role: 'partner', lifeStage: null), false, false, false, GateId.shell, null),
    ('partner (life stage) skips onboarding', gi(isOnboarded: false, role: 'woman', lifeStage: 'partner'), false, false, false, GateId.shell, null),
    ('placeholder name forces onboarding, partners too', gi(name: 'İstifadəçi', role: 'partner'), false, false, false, GateId.onboarding, null),
    ('empty name forces onboarding', gi(name: '  '), false, false, false, GateId.onboarding, null),
    ('no profile: no name check', gi(name: null, hasProfile: false), false, false, false, GateId.shell, null),
    ('pending journey', gi(pendingOnboarding: true), false, false, false, GateId.onboarding, null),
    ('pending journey ignored for partners', gi(pendingOnboarding: true, role: 'partner'), false, false, false, GateId.shell, null),
    ('legacy funnel flag of this user', gi(legacyFlag: true, hasCompletedFunnel: false), false, false, false, GateId.onboarding, null),
    ('legacy flag ignored once the funnel is complete', gi(legacyFlag: true), false, false, false, GateId.shell, null),
    ('everything clear → shell', gi(), false, false, false, GateId.shell, null),
  ];

  for (final (name, inputs, splash, intro, countrySet, gate, reason) in rows) {
    test(name, () {
      final d = decideGate(inputs, showSplash: splash, showIntro: intro, countryJustSet: countrySet);
      expect(d.gate, gate);
      expect(d.reason, reason);
    });
  }

  test('side effects: language bypass and funnel completion', () {
    expect(decideGate(gi(hasSelectedLanguage: false), showSplash: true, showIntro: false).markLanguageSelected, isTrue);
    expect(decideGate(gi(hasSelectedLanguage: false, hasSeenIntro: false, isOnboarded: false, isAuthenticated: false, hasUser: false),
            showSplash: false, showIntro: false).markLanguageSelected, isFalse);
    expect(decideGate(gi(hasCompletedFunnel: false), showSplash: false, showIntro: false).markFunnelCompleted, isTrue);
    expect(decideGate(gi(hasCompletedFunnel: false, isOnboarded: false), showSplash: false, showIntro: false).markFunnelCompleted, isFalse);
    expect(decideGate(gi(), showSplash: false, showIntro: false).markFunnelCompleted, isFalse);
  });

  test('every gate is reachable', () {
    final reached = {for (final r in rows) r.$6};
    expect(reached, GateId.values.toSet());
  });
}
