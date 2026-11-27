// Ported from: the places React mounts the community stories: CommunityScreen.tsx (`<StoriesBar groupId={null}
//              autoOpenStoryId onAutoOpenConsumed />`), GroupFeed.tsx (`<StoriesBar groupId />`), UserProfileScreen.tsx
//              (the stories tab) and the dashboard StoryViewer's "Yüklə" (src/lib/story-export.ts)
//
// Nothing is registered in the shell: the stories live inside the community screens. The orchestrator spreads
// [communityStoriesWiringOverrides] into `featureWiringOverrides()`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/feature_registry.dart';
import '../community/community_slots.dart' show communityStoriesBarProvider;
import '../community/ui/user_profile_screen.dart' show communityProfileStoriesProvider;
import '../stories/story_viewer.dart' show storyExporterProvider;
import 'export/story_export.dart' show dashboardStoryExporterProvider;
import 'ui/profile_stories.dart' show buildProfileStories;
import 'ui/stories_bar.dart' show StoriesBar;

void registerCommunityStoriesFeature(FeatureRegistry r) {}

/// `<StoriesBar groupId autoOpenStoryId onAutoOpenConsumed />` for [communityStoriesBarProvider].
Widget buildCommunityStoriesBar(BuildContext context, {String? groupId, String? autoOpenStoryId, VoidCallback? onAutoOpenConsumed}) =>
    StoriesBar(key: ValueKey('stories-bar:$groupId'), groupId: groupId, autoOpenStoryId: autoOpenStoryId, onAutoOpenConsumed: onAutoOpenConsumed);

List<Override> communityStoriesWiringOverrides() => [
      communityStoriesBarProvider.overrideWithValue(buildCommunityStoriesBar),
      communityProfileStoriesProvider.overrideWithValue(buildProfileStories),
      storyExporterProvider.overrideWith((ref) => ref.watch(dashboardStoryExporterProvider)),
    ];
