// Ported from: src/components/community/StoryViewer.likes.test.tsx
import 'dart:ui' as ui;

import 'package:anacan/features/community_stories/data/stories.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/ui/story_viewer.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

List<UserStoryGroup> groups({bool liked = false}) => [
      UserStoryGroup(userId: 'author', userName: 'Author', userAvatar: null, hasUnviewed: false, stories: [
        {
          'id': 'story', 'user_id': 'author', 'media_type': 'image', 'media_url': '/fixture.png', //
          'created_at': '2026-09-21T10:00:00Z', 'is_liked': liked, 'likes_count': 27, 'is_viewed': true, 'view_count': 3,
        },
      ]),
    ];

void main() {
  testWidgets('animates only a newly requested like, clears the animation, and does not advance the story', (tester) async {
    final semantics = tester.ensureSemantics();
    final toggles = <(String, bool)>[];
    var closed = 0;
    final live = ValueNotifier(groups());
    await pumpCommunity(
      tester,
      ValueListenableBuilder<List<UserStoryGroup>>(
        valueListenable: live,
        builder: (context, value, _) => CommunityStoryViewer(
          storyGroups: value,
          initialGroupIndex: 0,
          onClose: () => closed++,
          onViewed: (_) {},
          onToggleLike: (id, liked) => toggles.add((id, liked)),
        ),
      ),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend(), userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    expect(find.byKey(CommunityStoryViewer.likeAnimationKey), findsNothing);
    await tester.tap(find.bySemanticsLabel('Bəyən'));
    await tester.pump();
    expect(toggles, [('story', false)]);
    expect(find.byKey(CommunityStoryViewer.likeAnimationKey), findsOneWidget);
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.byKey(CommunityStoryViewer.likeAnimationKey), findsNothing);
    expect(closed, 0);
    live.value = groups(liked: true);
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Bəyənməni geri götür'));
    await tester.pump();
    expect(toggles.last, ('story', true));
    expect(find.byKey(CommunityStoryViewer.likeAnimationKey), findsNothing);
    await flushCommunity(tester);
    semantics.dispose();
  });

  testWidgets('does not replay hearts on existing likes and blocks duplicate pending writes', (tester) async {
    final semantics = tester.ensureSemantics();
    final toggles = <(String, bool)>[];
    await pumpCommunity(
      tester,
      CommunityStoryViewer(
        storyGroups: groups(liked: true),
        initialGroupIndex: 0,
        onClose: () {},
        onViewed: (_) {},
        onToggleLike: (id, liked) => toggles.add((id, liked)),
        likePending: true,
      ),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend(), userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    final like = find.bySemanticsLabel('Bəyənməni geri götür');
    expect(tester.getSemantics(like).getSemanticsData().flagsCollection.isEnabled, ui.Tristate.isFalse);
    await tester.tap(like, warnIfMissed: false);
    await tester.pump();
    expect(toggles, isEmpty);
    expect(find.byKey(CommunityStoryViewer.likeAnimationKey), findsNothing);
    expect(find.text('27'), findsNothing);
    await flushCommunity(tester);
    semantics.dispose();
  });
}
