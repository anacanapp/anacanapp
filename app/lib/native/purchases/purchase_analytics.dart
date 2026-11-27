// Ported from: the paywall/purchase calls into src/lib/analytics.ts (logPaywallShown, logPaywallClicked,
// logPremiumSubscribed, logTrialStarted) made by PremiumModal.tsx, PaywallCore.tsx and useInAppPurchase.ts.
//
// app/lib/core has no analytics port yet, so purchases, paywalls and onboarding talk to this minimal sink.
// The app root wires it to the analytics service (Firebase/GA4 + Meta) once that is ported; the default
// drops events (consent-gated product analytics are optional, never required for a purchase).

abstract interface class AnalyticsSink {
  /// `analytics.logPaywallShown(source)`.
  void logPaywallShown(String source);

  /// `analytics.logPaywallClicked(source, plan)`.
  void logPaywallClicked(String source, String plan);

  /// `analytics.logPremiumSubscribed(packageId, price, currency)` (real store price/currency).
  void logPremiumSubscribed(String packageId, double price, String currency);

  /// `analytics.logTrialStarted(packageId, price, currency)`.
  void logTrialStarted(String packageId, double price, String currency);

  /// Any other named event (onboarding/tour events when they are added).
  void logEvent(String name, [Map<String, Object?> params = const {}]);
}

class NoopAnalyticsSink implements AnalyticsSink {
  const NoopAnalyticsSink();
  @override
  void logPaywallShown(String source) {}
  @override
  void logPaywallClicked(String source, String plan) {}
  @override
  void logPremiumSubscribed(String packageId, double price, String currency) {}
  @override
  void logTrialStarted(String packageId, double price, String currency) {}
  @override
  void logEvent(String name, [Map<String, Object?> params = const {}]) {}
}

/// Records every call (tests).
class RecordingAnalyticsSink implements AnalyticsSink {
  final List<(String, List<Object?>)> events = [];
  @override
  void logPaywallShown(String source) => events.add(('paywall_shown', [source]));
  @override
  void logPaywallClicked(String source, String plan) => events.add(('paywall_clicked', [source, plan]));
  @override
  void logPremiumSubscribed(String packageId, double price, String currency) => events.add(('premium_subscribed', [packageId, price, currency]));
  @override
  void logTrialStarted(String packageId, double price, String currency) => events.add(('trial_started', [packageId, price, currency]));
  @override
  void logEvent(String name, [Map<String, Object?> params = const {}]) => events.add((name, [params]));
}
