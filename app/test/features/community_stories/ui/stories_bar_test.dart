// Ported from: (no vitest file) src/components/community/StoriesBar.tsx rings + viewer hand-off and the
//              UserProfileScreen stories tab
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/ui/profile_stories.dart';
import 'package:anacan/features/community_stories/ui/stories_bar.dart';
import 'package:anacan/features/community_stories/ui/story_viewer.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

final List<CRow> rows = [
  {'id': 'm1', 'user_id': 'b', 'media_type': 'image', 'media_url': '/m1.png', 'created_at': '2026-11-27T10:00:00Z', 'likes_count': 0, 'view_count': 0},
  {'id': 'own', 'user_id': 'viewer', 'media_type': 'image', 'media_url': '/own.png', 'created_at': '2026-11-27T09:00:00Z', 'likes_count': 0, 'view_count': 0},
];

FakeCommunityBackend backendFor() {
  final backend = FakeCommunityBackend()
    ..onProfileCards = (ids) async => {
          'b': {'user_id': 'b', 'name': 'Maya Əliyeva', 'avatar_url': null},
          'viewer': {'user_id': 'viewer', 'name': 'Me', 'avatar_url': null},
        };
  backend.onSelect = (q) async => q.table == 'community_stories' ? rows : const <CRow>[];
  return backend;
}

void main() {
  testWidgets('shows the own ring first, opens an author ring in the viewer and refreshes the rings on close', (tester) async {
    final backend = backendFor();
    await pumpCommunity(
      tester,
      const SingleChildScrollView(child: Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: StoriesBar())),
      overrides: [
        ...communityOverrides(backend: backend, userId: 'viewer', profile: Profile({'user_id': 'viewer', 'name': 'Me'})),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    for (var i = 0; i < 5; i++) {
      await tester.pump();
    }
    expect(find.text('Sizin'), findsOneWidget);
    expect(find.text('Maya'), findsOneWidget);
    final before = backend.selects('community_stories').length;
    await tester.tap(find.text('Maya'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(find.byKey(CommunityStoryViewer.storyKey('m1')), findsOneWidget);
    expect(backend.named('upsert').single.args[1], [
      {'story_id': 'm1', 'user_id': 'viewer'},
    ]);
    await tester.tap(find.bySemanticsLabel('Bağla').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byKey(CommunityStoryViewer.storyKey('m1')), findsNothing);
    for (var i = 0; i < 5; i++) {
      await tester.pump();
    }
    expect(backend.selects('community_stories').length, greaterThan(before));
    await flushCommunity(tester);
  }, semanticsEnabled: true);

  testWidgets('the profile tab shows the author’s stories as 9:16 tiles', (tester) async {
    await pumpCommunity(
      tester,
      const SingleChildScrollView(child: ProfileStories(userId: 'b')),
      overrides: [
        ...communityOverrides(backend: backendFor(), userId: 'viewer'),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
      ],
    );
    for (var i = 0; i < 5; i++) {
      await tester.pump();
    }
    final tile = find.byKey(const ValueKey('profile-story:m1'));
    expect(tile, findsOneWidget);
    final size = tester.getSize(tile);
    expect(size.height / size.width, closeTo(16 / 9, 0.01));
    await flushCommunity(tester);
  });
}
