// Ported from: src/pages/Index.tsx (onboarding gate render: <PremiumOnboarding key legacyPending offerEnabled onComplete />,
// <OnboardingTourHost blocked onNavigate onRunningChange />)
//
//   final registry = FeatureRegistry()..registerAll([registerOnboardingFeature, registerPremiumFeature, …]);
//
// Also override in the root ProviderScope: `hasPendingOnboardingProvider.overrideWith((ref) =>
// ref.watch(onboardingPendingProvider))` (gate input), and — when those features land —
// notificationPermissionProvider, tourToolConfigsProvider, tourConsentDecidedProvider, tourBlockedProvider.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../native/purchases/purchases.dart';
import '../../shell/feature_registry.dart';
import '../../shell/gates/gate_sequence.dart';
import '../../shell/shell_inputs.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;
import 'onboarding_journey.dart';
import 'onboarding_tour_host.dart';

export 'birth_onboarding_modal.dart' show BirthOnboardingModal, showBirthOnboardingModal;
export 'glass_tour.dart' show TourTargets;
export 'onboarding_companion.dart' show companionAsset, OnboardingCompanion, CompanionSize;
export 'onboarding_journey.dart' show OnboardingJourney;
export 'onboarding_ports.dart';
export 'onboarding_tour_host.dart' show OnboardingTourHost, TourToolConfig, tourToolConfigsProvider, tourBlockedProvider, tourConsentDecidedProvider, tourRunningProvider;

void registerOnboardingFeature(FeatureRegistry r) {
  r.registerGate(GateId.onboarding, (context, args) => OnboardingGateScreen(args: args));
  r.registerFrameOverlay('onboarding-tour-host', (context) => const OnboardingTourHost());
}

/// The onboarding gate: `<PremiumOnboarding key={backend:user} legacyPending offerEnabled onComplete={setFunnelCompleted(true)} />`.
class OnboardingGateScreen extends ConsumerWidget {
  const OnboardingGateScreen({super.key, required this.args});
  final GateArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(authUserProvider.select((u) => u?.id));
    final backend = ref.watch(backendUrlProvider);
    // Premium onboarding (funnel) is on unless app_settings.premium_onboarding_enabled is false.
    final offerEnabled = ref.watch(appSettingProvider('premium_onboarding_enabled')) != false;
    return OnboardingJourney(
      key: ValueKey('$backend:$userId'),
      legacyPending: args.inputs.legacyPending,
      offerEnabled: offerEnabled,
      onComplete: () => ref.read(gateActionsProvider).setFunnelCompleted(true),
    );
  }
}
