// Ported from: src/pages/Index.tsx (lazy screen imports), src/App.tsx (route elements)
//
// The one place that lists every feature's `registerX(FeatureRegistry r)` (docs/flutter/SHELL.md §11). A feature
// lands by adding its import and uncommenting / adding its line in its alphabetical slot. Anything not
// registered renders the shell's placeholder.
import '../features/entry/entry_feature.dart';
import '../features/startup/startup.dart';
import '../shell/feature_registry.dart';

// Slots (alphabetical). Uncomment the import with the call when the feature lands:
// import '../features/blog/blog.dart';
// import '../features/chat/chat.dart';
// import '../features/commerce/commerce.dart';
// import '../features/community/community.dart';
// import '../features/games/games.dart';
// import '../features/home/home.dart';
// import '../features/onboarding/onboarding.dart';
// import '../features/partner/partner.dart';
// import '../features/premium/premium.dart';
// import '../features/profile/profile.dart';
// import '../features/settings/settings.dart';
// import '../features/tools/tools.dart';

/// Registers every landed feature on [r].
void registerAllFeatures(FeatureRegistry r) {
  // registerBlogFeature(r);
  // registerChatFeature(r);
  // registerCommerceFeature(r);
  // registerCommunityFeature(r);
  registerEntryFeature(r);
  // registerGamesFeature(r);
  // registerHomeFeature(r);
  // registerOnboardingFeature(r);
  // registerPartnerFeature(r);
  // registerPremiumFeature(r);
  // registerProfileFeature(r);
  // registerSettingsFeature(r);
  registerStartupFeature(r);
  // registerToolsFeature(r);
}

/// The registry the app root installs (`featureRegistryProvider`).
FeatureRegistry buildFeatureRegistry() =>
    FeatureRegistry()..registerAll([registerAllFeatures]);
