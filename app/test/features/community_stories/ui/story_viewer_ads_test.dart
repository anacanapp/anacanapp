// Ported from: src/components/community/StoryViewer.ads.test.tsx
import 'dart:async';

import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/features/community_stories/data/stories.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/data/story_ads.dart';
import 'package:anacan/features/community_stories/ui/story_viewer.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

class FakeAds implements StoryAdBreaks {
  FakeAds(this.configuration);
  @override
  final AdsConfiguration configuration;
  int count = 0;
  int shows = 0;
  Completer<bool>? pending;
  @override
  bool get busy => false;
  @override
  bool opportunity(String placement, String key) => ++count % 2 == 0;
  @override
  Future<bool> showStory() {
    shows++;
    pending = Completer<bool>();
    return pending!.future;
  }
}

/// `vi.advanceTimersByTimeAsync(ms)` in frame-sized steps.
Future<void> advance(WidgetTester tester, int ms) async {
  for (var t = 0; t < ms; t += 100) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

String? shown(WidgetTester tester) {
  for (final id in const ['one', 'two', 'three']) {
    if (find.byKey(CommunityStoryViewer.storyKey(id)).evaluate().isNotEmpty) return id;
  }
  return null;
}

void main() {
  testWidgets('inserts a story break after two forward completions and preserves the next story while an ad is open', (tester) async {
    final config = defaultAdsConfiguration();
    config.placements.firstWhere((p) => p.id == kStoryBreakPlacement).minScreenSeconds = 0;
    final ads = FakeAds(config);
    final viewed = <String>[];
    final stories = [
      for (final id in const ['one', 'two', 'three'])
        <String, dynamic>{
          'id': id, 'user_id': 'author', 'media_type': 'image', 'media_url': 'https://example.test/image.jpg', //
          'created_at': DateTime.now().toUtc().toIso8601String(), 'is_viewed': false, 'text_overlay': null,
        },
    ];
    await pumpCommunity(
      tester,
      CommunityStoryViewer(
        storyGroups: [UserStoryGroup(userId: 'author', userName: 'Fixture', userAvatar: null, stories: stories, hasUnviewed: true)],
        initialGroupIndex: 0,
        onClose: () {},
        onViewed: viewed.add,
      ),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend(), userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
        storyAdBreaksProvider.overrideWithValue(ads),
      ],
    );
    await advance(tester, 6200);
    expect(shown(tester), 'two');
    expect(ads.shows, 0);
    await advance(tester, 6200);
    expect(ads.shows, 1);
    expect(shown(tester), 'two');
    ads.pending!.complete(true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(shown(tester), 'three');
    expect(viewed, ['one', 'two', 'three']);
    await flushCommunity(tester);
  });
}
