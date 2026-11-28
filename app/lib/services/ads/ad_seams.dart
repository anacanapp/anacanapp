// Ported from: the `useAdExperience()` / `<AdSurface>` / `<AdInlineAnchor>` / `useAdExit` call sites of
//              src/pages/Index.tsx (home_banner surface), Dashboard.tsx, PartnerHomeScreen.tsx, ToolsHub.tsx,
//              BlogScreen.tsx, BlogPostDetail.tsx, Recipes.tsx, BabyNames.tsx, StoryViewer.tsx,
//              src/hooks/useGameAds.ts, src/components/ads/AdPreferencesScreen.tsx
//
// Implementations of the ad seams other features expose (docs/flutter/WIRING.md). The app root assigns them
// (field values of the slot objects, provider overrides).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/ads/ads_config.dart' show AdsConfiguration;
import '../../domain/ads/ads_policy.dart' as policy show AdDecision;
import '../../features/community_stories/data/story_ads.dart' show StoryAdBreaks, kStoryBreakPlacement;
import '../../features/games/ui_common/game_ads.dart' show GameAdsPlatform;
import '../../features/settings/ad_preferences_screen.dart' as prefs show AdDecision, AdPreferencesController;
import 'ad_experience.dart';
import 'ad_widgets.dart';
import 'ads_providers.dart';

/// `<AdSurface id />` builder (tools hub `tools_banner`, recipes `recipes_banner`, blog list `blog_list_banner`).
Widget adSurfaceSlot(BuildContext context, String id) => AdSurface(id: id);

/// `<AdInlineAnchor id />` builder (home / partner home `home_banner`, tools hub, recipes, blog).
Widget adInlineAnchorSlot(BuildContext context, String id) => AdInlineAnchor(id: id);

/// `HomeSlots.adInlineAnchor` / `PartnerHomeSlots.adInlineAnchor`: the dashboard's anchor plus Index's
/// `<AdSurface id="home_banner" />` of the home tab (the shell itself has no ad seam).
Widget homeAdInlineAnchorSlot(BuildContext context, String id) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AdSurface(id: id),
      AdInlineAnchor(id: id),
    ]);

/// Blog: the article banner surface also keeps `useAdExit('article_exit_interstitial')`'s surface for the
/// article's lifetime (BlogPostDetail mounts both).
Widget blogAdSurfaceSlot(BuildContext context, String id) => id == 'blog_article_banner'
    ? const Column(mainAxisSize: MainAxisSize.min, children: [AdSurface(id: 'blog_article_banner'), AdSurface(id: 'article_exit_interstitial')])
    : AdSurface(id: id);

/// Recipes: `recipes_banner` + `useAdExit('recipe_exit_interstitial', …, !!selectedRecipe)`'s surface. The seam
/// cannot tell list from detail, so the exit surface is registered with every `recipes_banner` surface (the list
/// surface unmounts when a recipe opens, so the detail's screen time still starts when it opens).
Widget healthAdSurfaceSlot(BuildContext context, String id) => id == 'recipes_banner'
    ? const Column(mainAxisSize: MainAxisSize.min, children: [AdSurface(id: 'recipes_banner'), AdSurface(id: 'recipe_exit_interstitial')])
    : AdSurface(id: id);

/// `useAdExit(placement, onLeave)`: the interstitial when ready and allowed, then [onLeave] (still mounted only).
Future<void> adExitSlot(BuildContext context, String placement, VoidCallback onLeave) async {
  final container = ProviderScope.containerOf(context, listen: false);
  try {
    await container.read(adExperienceProvider).showInterstitial(placement);
  } catch (_) {
    // Navigation never waits on an ad failure.
  } finally {
    if (context.mounted) onLeave();
  }
}

/// `PregnancyToolSlots.babyNamesAd`: `<AdSurface id="baby_names_banner" enabled />` + `<AdInlineAnchor />`.
Widget babyNamesAdSlot(BuildContext context, bool enabled) => Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AdSurface(id: 'baby_names_banner', enabled: enabled),
      const AdInlineAnchor(id: 'baby_names_banner'),
    ]);

/// [GameAdsPlatform] over the ad experience (`useGameAds`).
class ExperienceGameAdsPlatform implements GameAdsPlatform {
  ExperienceGameAdsPlatform(this.ads, {required this.isPremium});
  final AdExperienceController ads;
  final bool Function() isPremium;

  @override
  AdsConfiguration? get configuration => ads.configuration;
  @override
  bool get busy => ads.busy;
  @override
  bool get premium => ads.preview.enabled ? ads.preview.premium : isPremium();
  @override
  VoidCallback registerSurface(String placement) => ads.registerSurface(placement);
  @override
  bool opportunity(String placement, String key) => ads.opportunity(placement, key);
  @override
  Future<bool> showInterstitial(String placement) => ads.showInterstitial(placement);
  @override
  Future<bool> showRewarded(String placement) => ads.showRewarded(placement);
  @override
  policy.AdDecision decisionFor(String placement) => ads.decisionFor(placement);
}

/// [StoryAdBreaks] over the ad experience. StoryViewer mounts `<AdSurface id="community_story_break" />` and
/// marks itself `data-ad-block` allowing only the story break; the viewer has no mount hook for this seam, so the
/// surface and the block are held from the first break question (`opportunity`) until 60 s after the last one.
class ExperienceStoryAdBreaks implements StoryAdBreaks {
  ExperienceStoryAdBreaks(this.ads, {this.idle = const Duration(seconds: 60)});
  final AdExperienceController ads;
  final Duration idle;
  VoidCallback? _surface;
  VoidCallback? _block;
  Timer? _idle;

  void _touch() {
    _surface ??= ads.registerSurface(kStoryBreakPlacement);
    _block ??= ads.registerBlock(allow: const {kStoryBreakPlacement});
    _idle?.cancel();
    _idle = Timer(idle, release);
  }

  /// Ends the viewer session (surface + block).
  void release() {
    _idle?.cancel();
    _idle = null;
    _surface?.call();
    _surface = null;
    _block?.call();
    _block = null;
  }

  @override
  AdsConfiguration? get configuration => ads.configuration;
  @override
  bool get busy => ads.busy;
  @override
  bool opportunity(String placement, String key) {
    _touch();
    return ads.opportunity(placement, key);
  }

  @override
  Future<bool> showStory() async {
    _touch();
    try {
      return await ads.showStory();
    } finally {
      _touch();
    }
  }
}

/// The settings screen's [prefs.AdPreferencesController]. AdPreferencesScreen mounts
/// `<AdSurface id="ads_pause_rewarded" />`: the surface is held while the screen listens to [changes].
class ExperienceAdPreferencesController implements prefs.AdPreferencesController {
  ExperienceAdPreferencesController(this.ads) : changes = _SurfaceBoundListenable(ads, 'ads_pause_rewarded');
  final AdExperienceController ads;

  @override
  final Listenable changes;

  @override
  prefs.AdDecision rewardedDecision() {
    final d = ads.decisionFor('ads_pause_rewarded');
    return prefs.AdDecision(allowed: d.allowed, reason: d.reason, waitSeconds: d.waitSeconds);
  }

  @override
  bool get previewEnabled => ads.preview.enabled;
  @override
  bool get previewPremium => ads.preview.premium;
  @override
  int get pauseUntilMs => ads.pauseUntil;
  @override
  int get rewardPauseMinutes => ads.configuration?.settings.rewardPauseMinutes ?? 30;
  @override
  bool get busy => ads.busy;
  @override
  bool get nativeAvailable => ads.nativeAvailable;
  @override
  bool get privacyOptionsRequired => ads.consent.privacyOptionsRequired;
  @override
  Future<bool> showRewarded() => ads.showRewarded();
  @override
  Future<void> openPrivacy() => ads.openPrivacy();
}

class _SurfaceBoundListenable implements Listenable {
  _SurfaceBoundListenable(this.ads, this.id);
  final AdExperienceController ads;
  final String id;
  int _listeners = 0;
  VoidCallback? _release;

  @override
  void addListener(VoidCallback listener) {
    if (_listeners++ == 0) _release = ads.registerSurface(id);
    ads.addListener(listener);
  }

  @override
  void removeListener(VoidCallback listener) {
    ads.removeListener(listener);
    if (_listeners > 0 && --_listeners == 0) {
      _release?.call();
      _release = null;
    }
  }
}

/// Provider bodies for the app root (`gameAdsPlatformProvider.overrideWith(experienceGameAdsPlatform)` …).
GameAdsPlatform experienceGameAdsPlatform(Ref ref) =>
    ExperienceGameAdsPlatform(ref.watch(adExperienceProvider), isPremium: () => ref.read(adExperienceInputsProvider).isPremium);

StoryAdBreaks experienceStoryAdBreaks(Ref ref) {
  final breaks = ExperienceStoryAdBreaks(ref.watch(adExperienceProvider));
  ref.onDispose(breaks.release);
  return breaks;
}

prefs.AdPreferencesController experienceAdPreferencesController(Ref ref) => ExperienceAdPreferencesController(ref.watch(adExperienceProvider));
