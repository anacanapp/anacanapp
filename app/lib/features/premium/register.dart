// Ported from: src/App.tsx (<PremiumEntitlementMonitor />), the public surface of src/components/PremiumModal.tsx and
// src/components/premium/*
//
// Other features use:
//   showPremiumModal(context, feature: 'ai_chat', source: 'ai_chat');
//   PremiumGate(title: …, child: …) · PremiumBlurGate(feature: …, child: …) · PremiumToolBoundary(onClose: …, child: …)
//   AdFreePremiumOffer(position: 'top' | 'bottom') on the dashboards
//   ref.watch(subscriptionProvider).isPremium / ref.read(subscriptionUsageProvider).checkAndConsume('ai_chat')

import '../../native/purchases/purchases.dart' show PremiumEntitlementMonitor;
import '../../shell/feature_registry.dart';

export 'ad_free_premium_offer.dart' show AdFreePremiumOffer, adFreeOfferVisibilityProvider;
export 'paywall_core.dart' show PaywallCore;
export 'paywall_extensions.dart';
export 'premium_gates.dart';
export 'premium_modal.dart' show showPremiumModal, PremiumModalView, PremiumModalRoute;

void registerPremiumFeature(FeatureRegistry r) {
  // App.tsx mounts the monitor for the whole signed-in app. The shell frame is the nearest registry slot; the
  // app root may mount `const PremiumEntitlementMonitor()` itself instead (then drop this line).
  r.registerFrameOverlay('premium-entitlement-monitor', (context) => const PremiumEntitlementMonitor());
}
