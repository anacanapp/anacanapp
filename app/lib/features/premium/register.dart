// Ported from: src/App.tsx (<PremiumEntitlementMonitor />), the public surface of src/components/PremiumModal.tsx and
// src/components/premium/*
//
// Other features use:
//   showPremiumModal(context, feature: 'ai_chat', source: 'ai_chat');
//   PremiumGate(title: …, child: …) · PremiumBlurGate(feature: …, child: …) · PremiumToolBoundary(onClose: …, child: …)
//   AdFreePremiumOffer(position: 'top' | 'bottom') on the dashboards
//   ref.watch(subscriptionProvider).isPremium / ref.read(subscriptionUsageProvider).checkAndConsume('ai_chat')

import '../../shell/feature_registry.dart';

export 'ad_free_premium_offer.dart' show AdFreePremiumOffer, adFreeOfferVisibilityProvider;
export 'paywall_core.dart' show PaywallCore;
export 'paywall_extensions.dart';
export 'premium_gates.dart';
export 'premium_modal.dart' show showPremiumModal, PremiumModalView, PremiumModalRoute;

/// Nothing to register in the shell today: App.tsx mounts `<PremiumEntitlementMonitor />` for the whole signed-in
/// app, so the app root mounts it (app/lib/app/session_hosts.dart) instead of a shell frame overlay (which is
/// unmounted while a sub-screen shows). BillingScreen (`ScreenId.billing`) is not ported yet.
void registerPremiumFeature(FeatureRegistry r) {}
