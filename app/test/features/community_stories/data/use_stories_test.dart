// Ported from: src/hooks/useStories.test.ts
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community_stories/data/stories.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

final CRow story = {
  'id': 's1', 'user_id': 'a', 'group_id': 'g1', 'media_url': '/story.png', 'media_type': 'image', //
  'text_overlay': null, 'background_color': null, 'created_at': '2026-09-10T00:00:00Z',
  'expires_at': '2026-09-11T00:00:00Z', 'likes_count': 7, 'replies_count': 2, 'view_count': 12,
};
final List<CRow> rows = [
  {...story, 'id': 'b-new', 'user_id': 'b', 'created_at': '2026-09-10T12:00:00Z'},
  {...story, 'id': 'c-viewed', 'user_id': 'c', 'created_at': '2026-09-10T11:00:00Z', 'likes_count': null, 'replies_count': null},
  {...story, 'id': 'a-new', 'created_at': '2026-09-10T10:00:00Z'},
  {...story, 'id': 'own', 'user_id': 'viewer-a', 'created_at': '2026-09-10T09:00:00Z'},
  {...story, 'id': 'a-old', 'created_at': '2026-09-10T08:00:00Z'},
];
final Map<String, CRow> profiles = {
  'a': {'user_id': 'a', 'name': 'Ayla', 'avatar_url': '/a.png'},
  'b': {'user_id': 'b', 'name': 'Maya', 'avatar_url': null},
  'viewer-a': {'user_id': 'viewer-a', 'name': 'Me', 'avatar_url': null},
};
List<Object?> key(String? userId, [String? groupId = 'g1']) => ['stories', userId, groupId];

void main() {
  late FakeCommunityBackend backend;
  late QueryClient client;
  late Future<List<CRow>> Function() storiesResult, likesResult, viewsResult;
  late Future<Map<String, CRow>> Function() profilesResult;
  late List<String> profileCalls;

  setUp(() {
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry));
    storiesResult = () async => rows;
    likesResult = () async => [
          {'story_id': 'b-new'},
          {'story_id': 'a-old'},
        ];
    viewsResult = () async => [
          {'story_id': 'c-viewed'},
          {'story_id': 'a-old'},
          {'story_id': 'own'},
        ];
    profilesResult = () async => profiles;
    profileCalls = [];
    backend = FakeCommunityBackend();
    backend.onSelect = (q) => switch (q.table) {
          'community_stories' => storiesResult(),
          'story_likes' => likesResult(),
          'story_views' => viewsResult(),
          _ => throw StateError('Unexpected table: ${q.table}'),
        };
    backend.onProfileCards = (ids) {
      profileCalls.add('call');
      return profilesResult();
    };
  });

  ProviderContainer make({String? userId = 'viewer-a', bool fromState = false, bool loadingFromState = false}) {
    final c = communityContainer([
      ...communityOverrides(backend: backend, client: client, userId: userId, userFromState: fromState, loadingFromState: loadingFromState),
      storyStorageProvider.overrideWithValue(FakeStoryStorage()),
    ]);
    if (fromState) c.read(testUserProvider.notifier).set(userId);
    return c;
  }

  List<String> tables() => [for (final c in backend.calls) if (c.name == 'select') (c.args[0] as CQuery).table];

  group('story enrichment', () {
    test('executes three independent batches, not per-story view queries, and preserves flags and ordering', () async {
      final authors = Completer<Map<String, CRow>>();
      final likes = Completer<List<CRow>>();
      profilesResult = () => authors.future;
      likesResult = () => likes.future;
      final c = make();
      final read = listen(c, storiesProvider('g1'));

      await until(() => backend.selects('story_views').length == 1);
      expect(backend.named('profileCards').single.args[0], [for (final s in rows) s['user_id']]);
      expect(backend.selects('story_likes'), hasLength(1));
      expect(read().isLoading, isTrue);
      authors.complete(profiles);
      likes.complete([
        {'story_id': 'b-new'},
        {'story_id': 'a-old'},
      ]);
      await until(() => read().stories.length == rows.length);

      for (final table in ['story_likes', 'story_views']) {
        final q = backend.selects(table).single;
        expect(q.columns, 'story_id');
        expect([for (final f in q.filters) if (f.op == 'eq') (f.column, f.value)], [('user_id', 'viewer-a')]);
        expect(q.filter('in', 'story_id'), [for (final s in rows) s['id']]);
      }
      expect(tables(), ['community_stories', 'story_likes', 'story_views']);
      final storiesQuery = backend.selects('community_stories').single;
      expect(storiesQuery.orders, [('created_at', false)]);
      expect([for (final f in storiesQuery.filters) if (f.op == 'eq') (f.column, f.value)], [('group_id', 'g1')]);
      expect(storiesQuery.filter('gt', 'expires_at'), isA<String>());
      expect([for (final s in read().stories) [s['id'], s['is_liked'], s['is_viewed']]], [
        ['b-new', true, false],
        ['c-viewed', false, true],
        ['a-new', false, false],
        ['own', false, true],
        ['a-old', true, true],
      ]);
      expect(read().stories[2], allOf(containsPair('likes_count', 7), containsPair('replies_count', 2), containsPair('view_count', 12)));
      expect(read().stories[2]['author'], {'name': 'Ayla', 'avatar_url': '/a.png'});
      expect(read().stories[1], allOf(containsPair('likes_count', 0), containsPair('replies_count', 0), containsPair('view_count', 12)));
      expect(read().stories[1]['author'], {'name': 'İstifadəçi', 'avatar_url': null});
      expect([for (final g in read().storyGroups) [g.userId, g.hasUnviewed]], [
        ['viewer-a', false],
        ['b', true],
        ['a', true],
        ['c', false],
      ]);
      expect([for (final s in read().storyGroups.firstWhere((g) => g.userId == 'a').stories) s['id']], ['a-old', 'a-new']);
    });

    test('makes no enrichment requests when there are no stories', () async {
      storiesResult = () async => const [];
      final c = make();
      final read = listen(c, storiesProvider('g1'));
      await until(() => client.getQueryState(key('viewer-a'))?.status == QueryStatus.success);
      expect(read().stories, isEmpty);
      expect(read().storyGroups, isEmpty);
      expect(tables(), ['community_stories']);
      expect(profileCalls, isEmpty);
    });

    for (final authenticated in [true, false]) {
      test('uses false flags only for empty results or signed-out reads (authenticated=$authenticated)', () async {
        likesResult = () async => const [];
        viewsResult = () async => const [];
        final c = make(userId: authenticated ? 'viewer-a' : null);
        final read = listen(c, storiesProvider('g1'));
        await until(() => read().stories.length == rows.length);
        expect(read().stories.every((s) => s['is_liked'] == false && s['is_viewed'] == false), isTrue);
        expect(read().storyGroups.every((g) => g.hasUnviewed), isTrue);
        expect(backend.selects('story_likes'), hasLength(authenticated ? 1 : 0));
        expect(backend.selects('story_views'), hasLength(authenticated ? 1 : 0));
        expect(profileCalls, hasLength(1));
        expect(backend.named('getUser'), isEmpty);
      });
    }

    for (final batch in ['stories', 'authors', 'likes', 'views']) {
      test('does not cache false flags after a failed $batch query', () async {
        const error = CommunityBackendError(code: '42501', message: 'denied');
        switch (batch) {
          case 'authors':
            profilesResult = () async => throw error;
          case 'stories':
            storiesResult = () async => throw error;
          case 'likes':
            likesResult = () async => throw error;
          case 'views':
            viewsResult = () async => throw error;
        }
        final c = make();
        listen(c, storiesProvider('g1'));
        await until(() => client.getQueryState(key('viewer-a'))?.status == QueryStatus.error);
        expect(client.getQueryState(key('viewer-a'))!.error, same(error));
        expect(client.getQueryData<List<CRow>>(key('viewer-a')), isNull);
        if (batch == 'stories') {
          expect(profileCalls, isEmpty);
          expect(tables(), ['community_stories']);
        }
      });
    }

    for (final batch in ['likes', 'views']) {
      test('preserves known flags when a $batch refetch fails', () async {
        final c = make();
        final read = listen(c, storiesProvider('g1'));
        await until(() => read().stories.length == rows.length);
        final previous = read().stories;
        const error = CommunityBackendError(code: '42501', message: 'denied');
        if (batch == 'likes') {
          likesResult = () async => throw error;
        } else {
          viewsResult = () async => throw error;
        }
        await client.invalidateQueries(queryKey: const ['stories']);
        await settle();
        expect(client.getQueryState(key('viewer-a'))!.status, QueryStatus.error);
        expect(client.getQueryData<List<CRow>>(key('viewer-a')), previous);
        expect(read().stories, previous);
      });
    }
  });

  test('waits for auth bootstrap and isolates account/signed-out caches while preserving root invalidation', () async {
    final c = make(fromState: true, loadingFromState: true);
    c.read(testAuthLoadingProvider.notifier).set(true);
    final read = listen(c, storiesProvider('g1'));
    await settle();
    expect(backend.calls, isEmpty);
    c.read(testAuthLoadingProvider.notifier).set(false);
    await until(() => read().stories.length == rows.length);
    final firstAccount = read().stories;

    likesResult = () async => const [];
    viewsResult = () async => const [];
    c.read(testUserProvider.notifier).set('viewer-b');
    expect(read().stories, isEmpty);
    await until(() => read().stories.length == rows.length);
    expect(read().stories.every((s) => s['is_liked'] != true && s['is_viewed'] != true), isTrue);
    expect(client.getQueryData<List<CRow>>(key('viewer-a')), firstAccount);

    c.read(testUserProvider.notifier).set(null);
    expect(read().stories, isEmpty);
    await until(() => read().stories.length == rows.length);
    expect(backend.selects('story_likes'), hasLength(2));
    expect(backend.selects('story_views'), hasLength(2));
    expect(client.getQueryData<List<CRow>>(key(null)), read().stories);
    await client.invalidateQueries(queryKey: const ['stories']);
    await settle();
    expect(client.getQueryState(key('viewer-a'))!.isInvalidated, isTrue);
    expect(client.getQueryState(key('viewer-b'))!.isInvalidated, isTrue);
    expect(backend.selects('community_stories'), hasLength(4));
  });

  for (final (outcome, error, viewed) in [
    ('successful', null, true),
    ('failed', const CommunityBackendError(code: '42501'), false),
  ]) {
    test('marks only this viewer cache on a $outcome view write, without refetching', () async {
      final ownKeys = [key('viewer-a'), key('viewer-a', null)];
      final otherKeys = [key('viewer-b'), key(null)];
      final cached = [
        {...story, 'is_viewed': false},
      ];
      for (final k in [...ownKeys, ...otherKeys]) {
        client.setQueryDataValue(k, cached);
      }
      backend.onUpsert = (table, rows, onConflict) async {
        if (error != null) throw error;
      };
      final c = make();
      final markAsViewed = listen(c, markStoryViewedProvider)();
      await markAsViewed('s1');

      for (final k in ownKeys) {
        expect((client.getQueryData<List<Object?>>(k)![0] as Map)['is_viewed'], viewed);
      }
      for (final k in otherKeys) {
        expect(client.getQueryData<List<Object?>>(k), cached);
      }
      expect(backend.named('upsert').single.args, [
        'story_views',
        [
          {'story_id': 's1', 'user_id': 'viewer-a'},
        ],
        'story_id,user_id',
      ]);
      expect(backend.calls.map((call) => call.name), ['upsert']);
      expect(profileCalls, isEmpty);
    });
  }

  test('scopes optimistic story likes and their rollback to the original viewer across groups', () async {
    final ownKeys = [key('viewer-a'), key('viewer-a', null)];
    final otherKeys = [key('viewer-b'), key(null)];
    final cached = [
      {...story, 'is_liked': true},
    ];
    for (final k in [...ownKeys, ...otherKeys]) {
      client.setQueryDataValue(k, cached);
    }
    final finish = Completer<List<CRow>>();
    late ProviderContainer c;
    backend.onGetUser = () async => c.read(testUserProvider);
    backend.onDelete = (table, filters, returning) => finish.future;
    c = make(fromState: true);
    final read = listen(c, toggleStoryLikeMutation);
    c.read(toggleStoryLikeMutation.notifier).mutate((storyId: 's1', isLiked: true));
    await until(() => backend.named('delete').length == 1);
    for (final k in ownKeys) {
      final s = client.getQueryData<List<Object?>>(k)![0] as Map;
      expect(s['is_liked'], false);
      expect(s['likes_count'], 6);
    }
    for (final k in otherKeys) {
      expect(client.getQueryData<List<Object?>>(k), cached);
    }

    c.read(testUserProvider.notifier).set('viewer-b');
    finish.completeError(const CommunityBackendError(code: '42501'));
    await until(() => read().isError);
    for (final k in [...ownKeys, ...otherKeys]) {
      expect(client.getQueryData<List<Object?>>(k), cached);
    }
    expect(backend.named('getUser'), hasLength(1));
    final filters = backend.named('delete').single.args[1] as List<CFilter>;
    expect(filters.any((f) => f.op == 'eq' && f.column == 'user_id' && f.value == 'viewer-a'), isTrue);
  });
}
