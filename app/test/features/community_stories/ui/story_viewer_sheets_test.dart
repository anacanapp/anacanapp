// Ported from: (no vitest file) src/components/community/StoryViewer.tsx viewers / replies sheets with
//              src/hooks/useStoryViewers.ts (likers first) and src/hooks/useStoryReplies.ts (live while open)
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community_stories/data/stories.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/ui/story_viewer.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

void main() {
  testWidgets('own story: viewers sheet lists likers first and pauses the story; replies load live', (tester) async {
    final backend = FakeCommunityBackend()
      ..onProfileCards = (ids) async => {
            'u1': {'user_id': 'u1', 'name': 'Aynur', 'avatar_url': null},
            'u2': {'user_id': 'u2', 'name': 'Leyla', 'avatar_url': null},
          };
    backend.onSelect = (q) async => switch (q.table) {
          'story_views' => [
              {'user_id': 'u1', 'viewed_at': '2026-11-27T10:00:00Z'},
              {'user_id': 'u2', 'viewed_at': '2026-11-27T09:00:00Z'},
            ],
          'story_likes' => [
              {'user_id': 'u2'},
            ],
          'story_replies' => [
              {'id': 'r1', 'story_id': 's', 'user_id': 'u1', 'content': 'Gözəl', 'created_at': '2026-11-27T10:00:00Z'},
            ],
          _ => <CRow>[],
        };
    var closed = 0;
    await pumpCommunity(
      tester,
      CommunityStoryViewer(
        storyGroups: [
          UserStoryGroup(userId: 'viewer', userName: 'Me', userAvatar: null, hasUnviewed: false, stories: [
            {'id': 's', 'user_id': 'viewer', 'media_type': 'image', 'media_url': '/x.png', 'created_at': '2026-11-27T08:00:00Z', 'view_count': 2, 'replies_count': 1},
          ]),
        ],
        initialGroupIndex: 0,
        onClose: () => closed++,
        onViewed: (_) => fail('own stories are not marked viewed'),
      ),
      overrides: [
        ...communityOverrides(backend: backend, userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    await tester.tap(find.text('2 baxış'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Baxışlar'), findsOneWidget);
    expect(tester.getTopLeft(find.text('Leyla')).dy, lessThan(tester.getTopLeft(find.text('Aynur')).dy));
    for (var i = 0; i < 70; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(closed, 0);

    await tester.tapAt(const Offset(10, 10));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Baxışlar'), findsNothing);
    await tester.tap(find.text('1 cavab'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Cavablar'), findsOneWidget);
    expect(find.textContaining('Gözəl', findRichText: true), findsOneWidget);
    expect(backend.subscriptions.where((s) => s.table == 'story_replies' && s.filter == 'story_id=eq.s'), hasLength(1));
    final replies = backend.selects('story_replies').single;
    expect(replies.filter('eq', 'is_active'), true);
    expect(replies.orders, [('created_at', true)]);
    await flushCommunity(tester);
  });
}
