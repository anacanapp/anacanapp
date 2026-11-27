// Ported from: src/hooks/useCommunitySocial.test.tsx
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/data/community_post_cache.dart';
import 'package:anacan/features/community/data/community_social.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

final CRow post = {'id': 'post', 'user_id': 'author', 'content': 'Older saved post', 'language': 'az', 'is_saved': false, 'is_liked': false, 'likes_count': 2};
final CRow stats = {'user_id': 'author', 'posts_count': 1, 'likes_count': 2, 'followers_count': 10, 'following_count': 5, 'is_following': false};
List<Object?> feedKey(String userId) => ['community-feed', userId, 'saved'];
FeedPages cachedFeed() => FeedPages(pages: [FeedPage(posts: [{...post}])], pageParams: const [0]);

void main() {
  late FakeCommunityBackend backend;
  late QueryClient client;

  setUp(() {
    backend = FakeCommunityBackend()..onProfileCards = (ids) async => {};
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry));
    backend.onRpc = (fn, params) async => const [];
  });

  ProviderContainer make({bool languageFromState = false}) => communityContainer(communityOverrides(
        backend: backend,
        client: client,
        userFromState: true,
        languageFromState: languageFromState,
      ));

  group('community feed and private interaction state', () {
    test('resolves Premium in followers independently of a stale stored badge label', () async {
      backend.onProfileCards = null;
      backend.onRpc = (fn, params) async => fn == 'get_public_community_profiles_v2'
          ? [{'user_id': 'author', 'name': 'Author', 'is_premium': true, 'badge_type': 'premium'}]
          : [{'user_id': 'author', 'name': 'Author', 'is_following': true, 'followed_at': '2026-09-21', 'is_premium': false, 'badge_type': null}];
      final c = make();
      final read = listen(c, communityConnectionsQuery(('someone', ConnectionDirection.followers)));
      await until(() => read().data?.pages.first.connections.isNotEmpty ?? false);
      final row = read().data!.pages.first.connections.first;
      expect(row, allOf(containsPair('user_id', 'author'), containsPair('is_premium', true), containsPair('badge_type', 'premium'),
          containsPair('is_following', true)));
      expect(backend.rpcArgs('get_public_community_profiles_v2').single, {'p_user_ids': ['author']});
    });

    test('loads older personal results by server-side view and pagination, not by filtering the recent feed', () async {
      final all = [for (var n = 0; n < 34; n++) {...post, 'id': 'old-$n'}];
      backend.onRpc = (fn, params) async {
        final offset = params!['p_offset'] as int, limit = params['p_limit'] as int;
        return all.sublist(offset, (offset + limit).clamp(0, all.length));
      };
      final c = make();
      const args = FeedArgs(CommunityFeedView.mine);
      final read = listen(c, communityFeedProvider(args));
      await until(() => read().posts.length == 20);
      expect(backend.rpcArgs('get_community_feed_v2').first,
          allOf(containsPair('p_view', 'mine'), containsPair('p_offset', 0), containsPair('p_language', 'az')));
      await c.read(communityFeedQuery(args).notifier).fetchNextPage();
      await until(() => read().posts.length == 34);
      expect(read().posts[33]['id'], 'old-33');
      expect(read().hasNextPage, isFalse);
      expect(backend.rpcArgs('get_community_feed_v2').last,
          allOf(containsPair('p_view', 'mine'), containsPair('p_offset', 20), containsPair('p_language', 'az')));
    });

    test('does not show another account saved feed on account changes or sign-out', () async {
      late ProviderContainer c;
      backend.onRpc = (fn, params) async => c.read(testUserProvider) == 'viewer-a' ? [post] : const [];
      c = make();
      final read = listen(c, communityFeedProvider(const FeedArgs(CommunityFeedView.saved)));
      await until(() => read().posts.length == 1);
      c.read(testUserProvider.notifier).set('viewer-b');
      expect(read().posts, isEmpty);
      await until(() => read().query.isSuccess);
      expect(read().posts, isEmpty);
      c.read(testUserProvider.notifier).set(null);
      expect(read().posts, isEmpty);
    });

    for (final view in CommunityFeedView.values) {
      test('binds ${view.id} pagination to the selected language, independently of account country', () async {
        backend.onRpc = (fn, params) async => [
              {...post, 'id': params!['p_language'], 'language': params['p_language']},
            ];
        final c = make(languageFromState: true);
        c.read(testLanguageProvider.notifier).set('ru');
        final read = listen(c, communityFeedProvider(FeedArgs(view, authorId: 'author')));
        await until(() => read().posts.firstOrNull?['language'] == 'ru');
        expect(backend.rpcArgs('get_community_feed_v2').first, allOf(containsPair('p_view', view.id), containsPair('p_language', 'ru'),
            containsPair('p_limit', 21), containsPair('p_offset', 0)));
        c.read(testLanguageProvider.notifier).set('ja');
        expect(read().posts, isEmpty);
        await until(() => read().posts.firstOrNull?['language'] == 'ja');
      });
    }

    test('counts foreign inserts and patches counters in place instead of refetching the feed', () async {
      backend.onRpc = (fn, params) async => [{...post}];
      final c = make();
      const args = FeedArgs(CommunityFeedView.recent);
      final read = listen(c, communityFeedProvider(args));
      await until(() => read().posts.length == 1);
      final calls = backend.rpcArgs('get_community_feed_v2').length;
      backend.emit('community_posts', eventType: 'INSERT', newRecord: {'id': 'fresh', 'user_id': 'other', 'language': 'az', 'group_id': null});
      backend.emit('community_posts', eventType: 'INSERT', newRecord: {'id': 'foreign', 'user_id': 'other', 'language': 'ru', 'group_id': null});
      expect(read().newPostsCount, 1);
      backend.emit('community_posts', eventType: 'UPDATE', newRecord: {...post, 'likes_count': 9, 'is_active': true}, oldRecord: {'id': 'post'});
      await until(() => read().posts.first['likes_count'] == 9);
      backend.emit('community_posts', eventType: 'DELETE', newRecord: const {}, oldRecord: {'id': 'post'});
      await until(() => read().posts.isEmpty);
      expect(backend.rpcArgs('get_community_feed_v2').length, calls);
      c.read(communityFeedLiveProvider(args).notifier).showNewPosts();
      expect(read().newPostsCount, 0);
      await until(() => backend.rpcArgs('get_community_feed_v2').length == calls + 1);
    });

    test('fails closed if a server sends another language and never enriches or caches it', () async {
      backend.onRpc = (fn, params) async => [{...post, 'language': 'ru'}];
      final c = make();
      final read = listen(c, communityFeedProvider(const FeedArgs(CommunityFeedView.recent)));
      await until(() => read().query.isError);
      expect(read().posts, isEmpty);
      expect(backend.named('profileCards'), isEmpty);
    });

    test('shares pending bookmark state and rolls back only the failed save, preserving a concurrent like', () async {
      client.setQueryDataValue(feedKey('viewer-a'), cachedFeed());
      client.setQueryDataValue(feedKey('viewer-b'), cachedFeed());
      client.setQueryDataValue(['user-posts', 'author', false], [{...post}]);
      final finish = Completer<Object?>();
      backend.onRpc = (fn, params) => finish.future;
      final c = make();
      final first = listen(c, communityBookmarkProvider('post'));
      final second = listen(c, communityBookmarkProvider('post'));
      first().setSaved(true);
      CRow saved(String user) => (client.getQueryData<FeedPages>(feedKey(user))!).pages[0].posts[0];
      await until(() => saved('viewer-a')['is_saved'] == true);
      expect(first().isPending && second().isPending, isTrue);
      expect(saved('viewer-b')['is_saved'], false);
      expect(((client.getQueryData<Object?>(['user-posts', 'author', false]) as List)[0] as Map)['is_saved'], false);
      client.setQueryDataValue(feedKey('viewer-a'),
          FeedPages(pages: [FeedPage(posts: [{...post, 'is_saved': true, 'is_liked': true, 'likes_count': 3}])], pageParams: const [0]));
      finish.completeError(const CommunityBackendError(code: '42501'));
      await until(() => !first().isPending);
      expect(saved('viewer-a'), allOf(containsPair('is_saved', false), containsPair('is_liked', true), containsPair('likes_count', 3)));
      expect(backend.rpcArgs('set_community_bookmark').single, {'p_expected_user_id': 'viewer-a', 'p_post_id': 'post', 'p_saved': true});
    });

    test('keeps a late save failure scoped to the original account', () async {
      client.setQueryDataValue(feedKey('viewer-a'), cachedFeed());
      client.setQueryDataValue(feedKey('viewer-b'), cachedFeed());
      final finish = Completer<Object?>();
      backend.onRpc = (fn, params) => finish.future;
      final c = make();
      final read = listen(c, communityBookmarkProvider('post'));
      read().setSaved(true);
      await until(() => backend.rpcArgs('set_community_bookmark').length == 1);
      c.read(testUserProvider.notifier).set('viewer-b');
      finish.completeError(const CommunityBackendError(code: '42501'));
      await settle();
      expect(client.getQueryData<FeedPages>(feedKey('viewer-a'))!.pages[0].posts[0]['is_saved'], false);
      expect(client.getQueryData<FeedPages>(feedKey('viewer-b'))!.pages[0].posts[0]['is_saved'], false);
    });

    test('updates follow state/count immediately, restores them on failure, and sends an explicit desired state', () async {
      final key = ['community-profile-stats', 'viewer-a', 'author'];
      client.setQueryDataValue(key, stats);
      final finish = Completer<Object?>();
      backend.onRpc = (fn, params) => finish.future;
      final c = make();
      final read = listen(c, communityFollowProvider('author'));
      read().setFollowing(true);
      await until(() => (client.getQueryData<CRow>(key))?['followers_count'] == 11);
      expect(client.getQueryData<CRow>(key), containsPair('is_following', true));
      expect(backend.rpcArgs('set_community_follow').single, {'p_expected_user_id': 'viewer-a', 'p_following_id': 'author', 'p_follow': true});
      finish.completeError(const CommunityBackendError(code: '42501'));
      await until(() => !read().isPending);
      expect(client.getQueryData<CRow>(key), allOf(containsPair('is_following', false), containsPair('followers_count', 10)));
    });

    test('does not submit self-follow and loads connection status in the viewer own namespace', () async {
      final c = make();
      final self = listen(c, communityFollowProvider('viewer-a'));
      self().setFollowing(true);
      await settle();
      expect(backend.named('rpc'), isEmpty);
      backend.onRpc = (fn, params) async => [{'user_id': 'author', 'name': 'Author', 'is_following': c.read(testUserProvider) == 'viewer-a'}];
      final read = listen(c, communityConnectionsQuery(('someone', ConnectionDirection.followers)));
      List<CRow> connections() => [for (final p in read().data?.pages ?? const <ConnectionsPage>[]) ...p.connections];
      await until(() => connections().firstOrNull?['is_following'] == true);
      c.read(testUserProvider.notifier).set('viewer-b');
      expect(connections(), isEmpty);
      await until(() => connections().firstOrNull?['is_following'] == false);
    });
  });
}
