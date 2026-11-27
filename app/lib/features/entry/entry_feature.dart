// Ported from: src/pages/Index.tsx (the entry-gate render branches: InitialLanguageScreen, AppIntroduction,
//              AuthScreen, BlockedScreen, EmailVerificationScreen, ConsentGateScreen, CountryGate), src/App.tsx
//              (`/reset-password` route element)
//
// `registerEntryFeature(registry)` plugs the entry gates into the shell's GateHost (docs/flutter/SHELL.md §9/§11).
// The app root also applies [entryOverrides] so the consent decision and the native social sign-in reach the
// shell and the auth controller.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../core/auth/auth.dart';
import '../../shell/feature_registry.dart';
import '../../shell/gates/gate_sequence.dart';
import '../../state/shell_bindings.dart' show consentGateInputProvider, emailGateProvider;
import '../../state/user_store.dart';
import '../../native/social_auth/native_social_auth.dart';
import 'auth/auth_screen.dart';
import 'auth/reset_password_page.dart';
import 'blocked/blocked_screen.dart';
import 'consent/consent_gate_controller.dart';
import 'consent/consent_gate_screen.dart';
import 'country/country_gate.dart';
import 'email/email_verification_screen.dart';
import 'entry_services.dart';
import 'intro/app_introduction.dart';
import 'language/initial_language_screen.dart';

void registerEntryFeature(FeatureRegistry r) {
  r.registerGate(GateId.initialLanguage, (context, a) => const InitialLanguageScreen());
  r.registerGate(GateId.intro, (context, a) => AppIntroduction(onComplete: a.onIntroComplete ?? () {}));
  r.registerGate(GateId.auth, (context, a) => const AuthScreen());
  r.registerGate(GateId.blocked, (context, a) => const _BlockedGate());
  r.registerGate(GateId.emailVerification, (context, a) {
    final gate = a.inputs.emailGate;
    return _EmailGate(email: gate is EmailGateDecided ? gate.email ?? '' : '');
  });
  r.registerGate(GateId.consent, (context, a) => _ConsentGateHost(profileCountryCode: a.inputs.profileCountryCode));
  r.registerGate(GateId.country, (context, a) => CountryGate(onDone: a.onCountryDone ?? () {}));
  r.registerRoutePage(OuterRouteId.resetPassword, (context, a) => const ResetPasswordPage());
}

/// Root ProviderScope overrides owned by the entry feature:
/// * the shell's consent gate input ← `useConsentGate` ([consentGateInputFromStateProvider]);
/// * the auth controller's social sign-in ← [NativeSocialAuthProvider] (native builds only).
List<Override> entryOverrides({bool nativeSocialAuth = true}) => [
      consentGateInputProvider.overrideWith((ref) => ref.watch(consentGateInputFromStateProvider)),
      if (nativeSocialAuth) socialAuthProviderProvider.overrideWithValue(NativeSocialAuthProvider()),
    ];

class _BlockedGate extends ConsumerWidget {
  const _BlockedGate();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final block = ref.watch(activeBlockQuery).data;
    if (block == null) return const SizedBox.expand();
    return BlockedScreen(block: block);
  }
}

class _EmailGate extends ConsumerWidget {
  const _EmailGate({required this.email});
  final String email;
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      EmailVerificationScreen(email: email, onVerified: () => ref.read(emailGateProvider.notifier).markVerified());
}

class _ConsentGateHost extends ConsumerWidget {
  const _ConsentGateHost({this.profileCountryCode});
  final String? profileCountryCode;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ConsentGate(
        profileCountryCode: profileCountryCode,
        language: ref.watch(userStoreProvider.select((s) => s.language)),
        onSignOut: () => ref.read(entryAuthActionsProvider).signOut(),
      );
}
