// Ported from: src/pages/Index.tsx (lazy screen imports), src/App.tsx (route elements)
//
// The one place that lists every feature's `registerX(FeatureRegistry r)` (docs/flutter/SHELL.md §11). A feature
// lands by adding its import and its line in alphabetical order. Anything not registered renders the shell's
// placeholder.
import '../features/billing/register.dart';
import '../features/entry/entry_feature.dart';
import '../features/home/register_home.dart';
import '../features/home_flow/home_flow.dart';
import '../features/home_mommy/register_home_mommy.dart';
import '../features/legal/register.dart';
import '../features/moderation/register.dart';
import '../features/onboarding/register.dart';
import '../features/premium/register.dart';
import '../features/profile/register.dart';
import '../features/recap/register.dart';
import '../features/security/register.dart';
import '../features/settings/register.dart';
import '../features/startup/startup.dart';
import '../features/support/register.dart';
import '../features/tools/register.dart';
import '../shell/feature_registry.dart';

// Not landed yet (add in order when they exist): blog, chat, commerce, community, games (UI), partner, individual tools.

/// Registers every landed feature on [r].
void registerAllFeatures(FeatureRegistry r) {
  registerBillingFeature(r);
  registerEntryFeature(r);
  registerHomeFeature(r);
  registerHomeFlowFeature(r);
  registerHomeMommyFeature(r);
  registerLegalFeature(r);
  registerModerationFeature(r);
  registerOnboardingFeature(r);
  registerPremiumFeature(r);
  registerProfileFeature(r);
  registerRecapFeature(r);
  registerSecurityFeature(r);
  registerSettingsFeature(r);
  registerStartupFeature(r);
  registerSupportFeature(r);
  registerToolsFeature(r);
}

/// The registry the app root installs (`featureRegistryProvider`).
FeatureRegistry buildFeatureRegistry() =>
    FeatureRegistry()..registerAll([registerAllFeatures]);
