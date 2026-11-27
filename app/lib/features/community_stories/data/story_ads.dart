// Ported from: the `useAdExperience()` surface StoryViewer.tsx reads (`configuration`, `busy`, `opportunity`,
//              `showStory`) and `<AdSurface id="community_story_break" />`
//
// Ads are not ported (phase 9). The default never offers a story break, so the viewer behaves like React with ads
// disabled; the ads port overrides [storyAdBreaksProvider].
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/ads/ads_config.dart' show AdsConfiguration;

const String kStoryBreakPlacement = 'community_story_break';

abstract interface class StoryAdBreaks {
  /// `ads.configuration` (null while not loaded).
  AdsConfiguration? get configuration;

  /// `ads.busy` (a full-screen ad is showing).
  bool get busy;

  /// `ads.opportunity(placement, key)`: whether this forward completion should show a break.
  bool opportunity(String placement, String key);

  /// `ads.showStory()`: resolves when the break closed.
  Future<bool> showStory();
}

class NoStoryAdBreaks implements StoryAdBreaks {
  const NoStoryAdBreaks();
  @override
  AdsConfiguration? get configuration => null;
  @override
  bool get busy => false;
  @override
  bool opportunity(String placement, String key) => false;
  @override
  Future<bool> showStory() async => false;
}

final storyAdBreaksProvider = Provider<StoryAdBreaks>((ref) => const NoStoryAdBreaks());

/// `min_screen_seconds` of the story break (2 when the configuration is missing).
int storyBreakMinSeconds(StoryAdBreaks ads) {
  for (final p in ads.configuration?.placements ?? const []) {
    if (p.id == kStoryBreakPlacement) return p.minScreenSeconds;
  }
  return 2;
}
