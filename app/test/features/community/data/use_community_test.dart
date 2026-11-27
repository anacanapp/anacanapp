// Ported from: src/hooks/useCommunity.test.ts
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/data/community.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

final CRow post = {
  'id': 'p1', 'user_id': 'author-a', 'group_id': 'g1', 'content': 'Post', 'media_urls': null, //
  'likes_count': 7, 'comments_count': 2, 'is_pinned': false, 'is_anonymous': false,
  'created_at': '2026-09-10T00:00:00Z', 'language': 'az',
};
final CRow author = {
  'user_id': 'author-a', 'name': 'Ayla', 'avatar_url': '/avatar.png', 'badge_type': 'admin', //
  'is_verified': true, 'verified_until': '2027-09-10T00:00:00Z', 'life_stage': 'mommy',
};

late FakeCommunityBackend backend;
late QueryClient client;
late Future<List<CRow>> Function() postsResult;
late Future<CRow?> Function() singleResult;
late Future<List<CRow>> Function() likesResult;
late Future<List<CRow>> Function() bookmarksResult;
late Future<Map<String, CRow>> Function() profiles;

void main() {
  setUp(() {
    backend = FakeCommunityBackend();
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry, staleTime: Duration(days: 365000)));
    postsResult = () async => [post];
    singleResult = () async => post;
    likesResult = () async => [{'post_id': 'p1'}];
    bookmarksResult = () async => const [];
    profiles = () async => {'author-a': author};
    backend.onSelect = (q) => switch (q.table) {
          'community_posts' => postsResult(),
          'post_likes' => likesResult(),
          'community_post_bookmarks' => bookmarksResult(),
          _ => throw StateError('Unexpected table: ${q.table}'),
        };
    backend.onMaybeSingle = (q) => singleResult();
    backend.onProfileCards = (ids) => profiles();
  });

  ProviderContainer make({String? user = 'viewer-a', bool userFromState = false, bool loadingFromState = false}) {
    final container = communityContainer(communityOverrides(
      backend: backend,
      client: client,
      userId: user,
      userFromState: userFromState,
      loadingFromState: loadingFromState,
    ));
    return container;
  }

  group('post enrichment', () {
    test('executes author and like batches concurrently, preserving anonymity, fields and order', () async {
      postsResult = () async => [post, {...post, 'id': 'p2', 'is_anonymous': true}];
      final authors = Completer<Map<String, CRow>>();
      profiles = () => authors.future;
      final h = make();
      final read = listen(h, groupPostsQuery('g1'));
      await until(() => backend.selects('post_likes').length == 1);
      expect(backend.named('profileCards').single.args.single, ['author-a', 'author-a']);
      expect(read().isPending, isTrue);
      authors.complete({'author-a': author});
      await until(() => read().isSuccess);

      expect(read().data, [
        {
          ...post, 'is_anonymous': false, 'is_liked': true, 'is_saved': false, //
          'author': {
            'name': 'Ayla', 'avatar_url': '/avatar.png', 'badge_type': 'admin', //
            'is_premium': false, 'can_share_links': true,
            'is_verified': true, 'verified_until': author['verified_until'], 'life_stage': 'mommy',
          },
        },
        {
          ...post, 'id': 'p2', 'is_anonymous': true, 'is_liked': false, 'is_saved': false, //
          'author': {'name': 'Anonim', 'avatar_url': null, 'badge_type': null, 'is_verified': false, 'verified_until': null},
        },
      ]);
      final likes = backend.selects('post_likes').single;
      expect(likes.filter('in', 'post_id'), ['p1', 'p2']);
      expect(likes.filter('eq', 'user_id'), 'viewer-a');
      final posts = backend.selects('community_posts').single;
      expect(posts.limitValue, 150);
      expect(posts.filter('eq', 'is_active'), true);
      expect(posts.filter('eq', 'group_id'), 'g1');
      expect(backend.named('getUser'), isEmpty);
    });

    test('keeps signed-out reads available without fetching likes', () async {
      final h = make(user: null);
      final read = listen(h, groupPostsQuery(null));
      await until(() => read().isSuccess);
      expect(read().data![0]['is_liked'], false);
      expect((read().data![0]['author'] as Map)['name'], 'Ayla');
      expect(backend.selects('community_posts').single.has('is', 'group_id'), isTrue);
      expect([for (final c in backend.named('select')) (c.args[0] as CQuery).table], ['community_posts']);
      expect(backend.named('getUser'), isEmpty);
    });

    for (final kind in ['group', 'single']) {
      test('does not enrich an empty $kind response', () async {
        postsResult = () async => const [];
        singleResult = () async => null;
        final h = make();
        final read = kind == 'group' ? listen(h, groupPostsQuery('g1')) : listen(h, singlePostQuery('p1'));
        await until(() => read().isSuccess);
        expect(read().data, kind == 'group' ? isEmpty : isNull);
        expect(backend.named('profileCards'), isEmpty);
        expect(backend.selects('post_likes'), isEmpty);
      });
    }

    for (final batch in ['authors', 'likes', 'bookmarks']) {
      test('does not cache fallback fields after a failed $batch batch', () async {
        const error = CommunityBackendError(code: '42501', message: 'denied');
        if (batch == 'authors') profiles = () async => throw error;
        if (batch == 'likes') likesResult = () async => throw error;
        if (batch == 'bookmarks') bookmarksResult = () async => throw error;
        final h = make();
        final read = listen(h, groupPostsQuery('g1'));
        await until(() => read().isError);
        expect(identical(read().error, error), isTrue);
        expect(client.getQueryData<Object?>(['group-posts', 'g1', 'viewer-a']), isNull);
      });
    }
  });

  for (final kind in ['group', 'single']) {
    group('$kind post cache identity', () {
      List<Object?> key(String? userId) => kind == 'group' ? ['group-posts', 'g1', userId, 'az'] : ['single-post', 'p1', userId];
      CRow first(Object? data) => data is List ? data.first as CRow : data as CRow;

      test('waits for auth bootstrap, but does not make a redundant auth request', () async {
        final h = make(loadingFromState: true);
        h.read(testAuthLoadingProvider.notifier).set(true);
        final read = kind == 'group' ? listen(h, groupPostsQuery('g1')) : listen(h, singlePostQuery('p1'));
        await settle();
        expect(backend.named('select'), isEmpty);
        expect(backend.named('maybeSingle'), isEmpty);
        h.read(testAuthLoadingProvider.notifier).set(false);
        await until(() => read().isSuccess);
        expect(backend.named('getUser'), isEmpty);
        if (kind == 'single') expect(backend.selects('community_posts').single.filter('eq', 'id'), 'p1');
      });

      test('never reuses another account or signed-out like flags', () async {
        final h = make(userFromState: true);
        final read = kind == 'group' ? listen(h, groupPostsQuery('g1')) : listen(h, singlePostQuery('p1'));
        await until(() => read().isSuccess);
        expect(first(read().data)['is_liked'], true);

        h.read(testUserProvider.notifier).set('viewer-b');
        likesResult = () async => const [];
        expect(read().data, isNull);
        await until(() => read().isSuccess);
        expect(first(read().data)['is_liked'], false);
        expect(first(client.getQueryData<Object?>(key('viewer-a')))['is_liked'], true);

        h.read(testUserProvider.notifier).set(null);
        expect(read().data, isNull);
        await until(() => read().isSuccess);
        expect(first(client.getQueryData<Object?>(key(null)))['is_liked'], false);
        expect(backend.selects('post_likes'), hasLength(2));
        expect(backend.named('getUser'), isEmpty);
        if (kind == 'group') expect(backend.named('channel'), hasLength(1));
      });
    });
  }

  test('scopes optimistic group likes and rollback while keeping existing profile-cache updates', () async {
    final ownKeys = [
      ['group-posts', 'g1', 'viewer-a'],
      ['group-posts', null, 'viewer-a'],
      ['user-posts', 'author-a', false],
    ];
    final otherKey = ['group-posts', 'g1', 'viewer-b'];
    final cached = [{...post, 'is_liked': true}];
    for (final k in [...ownKeys, otherKey]) {
      client.setQueryDataValue(k, cached);
    }
    final finish = Completer<List<CRow>>();
    backend.onDelete = (table, filters, returning) => finish.future;
    backend.onGetUser = () async => 'viewer-a';
    final h = make(userFromState: true);
    final read = listen(h, toggleLikeMutation);
    h.read(toggleLikeMutation.notifier).mutate(const LikeVars(postId: 'p1', isLiked: true, groupId: 'g1', viewerId: 'viewer-a'));
    await until(() => backend.named('delete').length == 1);
    for (final k in ownKeys) {
      final row = (client.getQueryData<Object?>(k) as List).first as Map;
      expect(row['is_liked'], false);
      expect(row['likes_count'], 6);
    }
    expect(client.getQueryData<Object?>(otherKey), cached);

    h.read(testUserProvider.notifier).set('viewer-b');
    finish.completeError(const CommunityBackendError(code: '42501'));
    await until(() => read().isError);
    for (final k in [...ownKeys, otherKey]) {
      expect(client.getQueryData<Object?>(k), cached);
    }
    expect(backend.named('getUser'), hasLength(1));
    await client.invalidateQueries(queryKey: const ['group-posts', 'g1']);
    bool invalidated(List<Object?> k) => client.findAll(QueryFilters(queryKey: k, exact: true)).single.state.isInvalidated;
    expect(invalidated(ownKeys[0]), isTrue);
    expect(invalidated(otherKey), isTrue);
  });
}

