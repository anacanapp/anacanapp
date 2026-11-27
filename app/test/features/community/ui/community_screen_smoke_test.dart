// Ported from: (smoke coverage of the real Community screens - CommunityScreen.tsx, GroupFeed / CommunityPostFeed,
//              CreatePostScreen, UserProfileScreen, SinglePostView - rendered against the fake backend)
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/community_slots.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/register.dart';
import 'package:anacan/features/community/ui/community_post_feed.dart';
import 'package:anacan/features/community/ui/community_screen.dart';
import 'package:anacan/features/community/ui/user_profile_screen.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/links/push_nav.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

final CRow post = {
  'id': 'p1', 'user_id': 'author', 'group_id': null, 'content': 'Salam #ana @Leyla https://example.com', 'media_urls': <String>[], //
  'likes_count': 3, 'comments_count': 1, 'is_pinned': true, 'is_anonymous': false,
  'created_at': '2026-09-14T00:00:00Z', 'language': 'az',
};

void main() {
  late FakeCommunityBackend backend;

  setUp(() {
    backend = FakeCommunityBackend();
    backend.onGetUser = () async => 'viewer';
    backend.onProfileCards = (ids) async => {'author': {'user_id': 'author', 'name': 'Ayla', 'badge_type': 'moderator', 'is_premium': true, 'life_stage': 'bump'}};
    backend.onRpc = (fn, params) async => switch (fn) {
          'get_community_feed_v2' => [post],
          'get_community_profile_stats' => {'user_id': 'author', 'posts_count': 4, 'likes_count': 9, 'followers_count': 2, 'following_count': 1, 'is_following': false},
          _ => null,
        };
    backend.onMaybeSingle = (q) async => q.table == 'community_posts' ? post : null;
  });

  test('registers the tab and the user-profile overlay', () {
    final registry = FeatureRegistry()..registerAll([registerCommunityFeature]);
    expect(registry.registeredIds, containsAll(['tab:community', 'overlay:userProfile']));
    // chat text builder, photo viewer, restriction note (the unread counter is set in state/shell_bindings.dart).
    expect(communityWiringOverrides(), hasLength(3));
  });

  Future<void> mount(WidgetTester tester, Widget child) => pumpCommunity(
        tester,
        child,
        overrides: [
          ...communityOverrides(backend: backend, userId: 'viewer', client: QueryClient(defaults: const QueryDefaults(retry: noRetry))),
          communityOnlineProvider.overrideWithValue(true),
          communityNotificationsUnreadProvider.overrideWithValue(0),
          communityDmUnreadProvider.overrideWithValue(2),
        ],
      );

  Future<void> settleUi(WidgetTester tester) async {
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 20));
    }
  }

  testWidgets('renders the feed with a post card and opens the composer', (tester) async {
    await mount(tester, const CommunityScreenPage(screen: CommunityScreen(onOpenNotifications: _noop)));
    await settleUi(tester);
    expect(find.text('Cəmiyyət'), findsOneWidget);
    expect(find.textContaining('Salam'), findsOneWidget);
    expect(find.text('Ayla'), findsOneWidget);
    expect(find.text('Pinlənmiş'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    await tester.tap(find.text('Nə düşünürsünüz?'));
    await settleUi(tester);
    expect(find.text('Yeni Paylaşım'), findsOneWidget);
    await flushCommunity(tester);
  });

  testWidgets('renders a profile and a deep-linked single post', (tester) async {
    await mount(tester, const UserProfileScreenPage(screen: UserProfileScreen(userId: 'author', onBack: _noop, onUserClick: _noopUser)));
    await settleUi(tester);
    expect(find.text('Profil'), findsOneWidget);
    expect(find.text('Ayla'), findsWidgets);
    expect(find.text('4'), findsOneWidget);
    await flushCommunity(tester);

    await mount(tester, const CommunityScreenPage(screen: CommunityScreen(deepLinkTarget: CommunityDeepLinkTarget(postId: 'p1'))));
    await settleUi(tester);
    expect(find.text('Paylaşım'), findsOneWidget);
    expect(find.text('Şərhlər'), findsOneWidget);
    await flushCommunity(tester);
  });
}

void _noop() {}
void _noopUser(String _) {}
