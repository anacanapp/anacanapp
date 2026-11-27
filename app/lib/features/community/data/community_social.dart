// Ported from: src/hooks/useCommunitySocial.ts
//
// Server-paginated feeds (`get_community_feed_v2`), the live "new posts" counter, profile stats, follower lists,
// follow and bookmark mutations.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import 'community.dart' show enrichPosts;
import 'community_backend.dart';
import 'community_env.dart';
import 'community_moderation.dart' show matchesFeedLanguage;
import 'community_post_cache.dart';
import 'community_toasts.dart';

/// `CommunityFeedView`.
enum CommunityFeedView {
  recent,
  popular,
  mine,
  saved,
  following,
  profile;

  String get id => name;
}

const int kCommunityPageSize = 20;
const List<String> _counterFields = ['likes_count', 'comments_count'];
const List<String> _structuralFields = [
  'content', 'is_pinned', 'comments_locked', 'is_active', 'moderation_version', 'moderation_removed_at', 'ad_moderation_state', //
];

@immutable
class FeedArgs {
  const FeedArgs(this.view, {this.groupId, this.authorId, this.search = ''});
  final CommunityFeedView view;
  final String? groupId;
  final String? authorId;
  final String search;

  @override
  bool operator ==(Object other) =>
      other is FeedArgs && other.view == view && other.groupId == groupId && other.authorId == authorId && other.search == search;
  @override
  int get hashCode => Object.hash(view, groupId, authorId, search);
}

CRow? _findCachedPost(FeedPages? data, String id) {
  for (final page in data?.pages ?? const <FeedPage>[]) {
    for (final post in page.posts) {
      if (post['id'] == id) return post;
    }
  }
  return null;
}

FeedPages? _removeCachedPost(FeedPages? data, String id) => data == null
    ? null
    : FeedPages(
        pages: [for (final page in data.pages) page.copyWith(posts: [for (final p in page.posts) if (p['id'] != id) p])],
        pageParams: data.pageParams,
      );

List<Object?> communityFeedKey(String? userId, FeedArgs args, String language) =>
    ['community-feed', userId, args.view.id, args.groupId, args.authorId, args.search, language];

/// The infinite query of `useCommunityFeed(view, groupId, authorId, search)`.
final communityFeedQuery = NotifierProvider.autoDispose.family<InfiniteQueryNotifier<FeedPage, int>, QueryResult<FeedPages>, FeedArgs>(
  (args) => InfiniteQueryNotifier<FeedPage, int>((ref) {
    final userId = ref.watch(authUserProvider)?.id;
    final loading = ref.watch(communityAuthLoadingProvider);
    final language = ref.watch(communityLanguageProvider);
    final backend = ref.watch(communityBackendProvider);
    return infiniteQueryOptions<FeedPage, int>(
      queryKey: communityFeedKey(userId, args, language),
      initialPageParam: 0,
      enabled: userId != null && !loading && (args.view != CommunityFeedView.profile || (args.authorId ?? '').isNotEmpty),
      staleTime: Duration.zero,
      queryFn: (_, pageParam) async {
        final data = await backend.rpc('get_community_feed_v2', {
          'p_language': language,
          'p_view': args.view.id,
          'p_group_id': args.groupId,
          'p_author_id': args.authorId,
          'p_search': args.search.trim().isEmpty ? null : args.search.trim(),
          'p_limit': kCommunityPageSize + 1,
          'p_offset': pageParam,
        });
        final rows = [for (final row in data is List ? data : const []) if (row is Map) Map<String, dynamic>.from(row)];
        if (rows.any((post) => !matchesFeedLanguage(post, language))) {
          throw const CommunityBackendError(message: 'COMMUNITY_LANGUAGE_RESPONSE_MISMATCH');
        }
        return FeedPage(
          posts: await enrichPosts(backend, rows.take(kCommunityPageSize).toList(), userId),
          nextOffset: rows.length > kCommunityPageSize ? pageParam + kCommunityPageSize : null,
        );
      },
      getNextPageParam: (last, _, _, _) => last.nextOffset,
    );
  }),
  name: 'communityFeedQuery',
);

/// The live part of `useCommunityFeed`: foreign inserts are counted, counter updates are patched in place, structural
/// changes refetch (1.5 s debounce), deletions / deactivations drop the post. The channel is rebuilt only when the
/// account or language changes; the count resets with the query key.
class CommunityFeedLive extends Notifier<int> {
  CommunityFeedLive(this.args);
  final FeedArgs args;

  @override
  int build() {
    final userId = ref.watch(authUserProvider)?.id;
    final language = ref.watch(communityLanguageProvider);
    if (userId == null) return 0;
    final backend = ref.watch(communityBackendProvider);
    final client = ref.read(queryClientProvider);
    Timer? timer;
    void refresh() {
      if (timer != null) return;
      timer = Timer(const Duration(milliseconds: 1500), () {
        timer = null;
        unawaited(client.invalidateQueries(queryKey: ['community-feed', userId]));
        unawaited(client.invalidateQueries(queryKey: ['community-profile-stats', userId]));
      });
    }

    final cancel = backend.subscribe(
      channelPrefix: 'community-feed-$userId',
      table: 'community_posts',
      onChange: (event) {
        final queryKey = communityFeedKey(userId, args, language);
        if (event.eventType == 'INSERT') {
          final row = event.newRecord;
          if (!matchesFeedLanguage(row, language)) return;
          if (row['user_id'] == userId) {
            refresh();
            return;
          }
          final live = args.view == CommunityFeedView.recent || args.view == CommunityFeedView.popular;
          if (live && (args.groupId == null || row['group_id'] == args.groupId)) state = state + 1;
          return;
        }
        final id = (event.newRecord['id'] ?? event.oldRecord['id']) as String?;
        if (id == null || id.isEmpty) return;
        final cached = _findCachedPost(client.getQueryData<FeedPages>(queryKey), id);
        if (cached == null) return;
        if (event.eventType == 'DELETE' || event.newRecord['is_active'] == false) {
          client.setQueryData<FeedPages>(queryKey, (data) => _removeCachedPost(data, id));
          return;
        }
        final row = event.newRecord;
        if (_structuralFields.any((f) => row.containsKey(f) && cached.containsKey(f) && row[f] != cached[f])) {
          refresh();
          return;
        }
        final counters = {for (final f in _counterFields) if (row[f] is num) f: row[f]};
        if (counters.isNotEmpty) patchCommunityPost(client, userId, id, (post) => {...post, ...counters});
      },
    );
    ref.onDispose(() {
      timer?.cancel();
      cancel();
    });
    return 0;
  }

  /// `showNewPosts()`: reset the counter, keep only the first page and refetch it.
  void showNewPosts() {
    state = 0;
    final client = ref.read(queryClientProvider);
    final key = communityFeedKey(ref.read(authUserProvider)?.id, args, ref.read(communityLanguageProvider));
    client.setQueryData<FeedPages>(
        key, (data) => data == null ? null : FeedPages(pages: data.pages.take(1).toList(), pageParams: data.pageParams.take(1).toList()));
    unawaited(client.invalidateQueries(queryKey: key, exact: true));
  }
}

final communityFeedLiveProvider =
    NotifierProvider.autoDispose.family<CommunityFeedLive, int, FeedArgs>(CommunityFeedLive.new, name: 'communityFeedLiveProvider');

/// `{ ...query, posts, newPostsCount, showNewPosts }` of useCommunityFeed.
@immutable
class CommunityFeed {
  const CommunityFeed({required this.query, required this.posts, required this.newPostsCount, required this.hasNextPage});
  final QueryResult<FeedPages> query;
  final List<CRow> posts;
  final int newPostsCount;
  final bool hasNextPage;
}

final communityFeedProvider = Provider.autoDispose.family<CommunityFeed, FeedArgs>((ref, args) {
  final query = ref.watch(communityFeedQuery(args));
  final count = ref.watch(communityFeedLiveProvider(args));
  final language = ref.watch(communityLanguageProvider);
  final unique = <String, CRow>{};
  for (final page in query.data?.pages ?? const <FeedPage>[]) {
    for (final post in page.posts) {
      if (matchesFeedLanguage(post, language)) unique['${post['id']}'] = post;
    }
  }
  final last = query.data?.pages.lastOrNull;
  return CommunityFeed(query: query, posts: unique.values.toList(), newPostsCount: count, hasNextPage: last?.nextOffset != null);
}, name: 'communityFeedProvider');

/// `useCommunityProfileStats(profileId)`.
final communityProfileStatsQuery = queryProviderFamily<CRow?, String?>((ref, profileId) {
  final user = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<CRow?>(
    queryKey: ['community-profile-stats', user, profileId],
    enabled: user != null && (profileId ?? '').isNotEmpty,
    staleTime: const Duration(seconds: 10),
    refetchInterval: const Duration(seconds: 30),
    queryFn: (_) async {
      final data = await backend.rpc('get_community_profile_stats', {'p_user_id': profileId});
      return data is Map ? Map<String, dynamic>.from(data) : null;
    },
  );
}, name: 'communityProfileStatsQuery');

/// `ConnectionDirection`.
enum ConnectionDirection { followers, following }

@immutable
class ConnectionsPage {
  const ConnectionsPage({required this.connections, this.nextOffset});
  final List<CRow> connections;
  final int? nextOffset;
}

/// `useCommunityConnections(profileId, direction)`: rows merged with the effective public cards.
final communityConnectionsQuery = NotifierProvider.autoDispose
    .family<InfiniteQueryNotifier<ConnectionsPage, int>, QueryResult<InfiniteData<ConnectionsPage, int>>, (String, ConnectionDirection?)>(
  (args) => InfiniteQueryNotifier<ConnectionsPage, int>((ref) {
    final (profileId, direction) = args;
    final user = ref.watch(authUserProvider)?.id;
    final backend = ref.watch(communityBackendProvider);
    return infiniteQueryOptions<ConnectionsPage, int>(
      queryKey: ['community-connections', user, profileId, direction?.name],
      initialPageParam: 0,
      enabled: user != null && direction != null,
      staleTime: Duration.zero,
      queryFn: (_, pageParam) async {
        final data = await backend.rpc('get_community_connections', {
          'p_user_id': profileId,
          'p_direction': direction?.name,
          'p_limit': kCommunityPageSize + 1,
          'p_offset': pageParam,
        });
        final rows = [for (final row in data is List ? data : const []) if (row is Map) Map<String, dynamic>.from(row)];
        final page = rows.take(kCommunityPageSize).toList();
        final effective = await backend.profileCards([for (final p in page) '${p['user_id']}']);
        return ConnectionsPage(
          connections: [for (final p in page) {...p, ...?effective['${p['user_id']}']}],
          nextOffset: rows.length > kCommunityPageSize ? pageParam + kCommunityPageSize : null,
        );
      },
      getNextPageParam: (last, _, _, _) => last.nextOffset,
    );
  }),
  name: 'communityConnectionsQuery',
);

/// `useIsMutating({ mutationKey })` for the follow / bookmark keys (instances of the same key share pending state).
class CommunityPendingKeys extends Notifier<Map<String, int>> {
  @override
  Map<String, int> build() => const {};
  void add(String key) => state = {...state, key: (state[key] ?? 0) + 1};
  void remove(String key) {
    final next = {...state};
    final value = (next[key] ?? 1) - 1;
    if (value <= 0) {
      next.remove(key);
    } else {
      next[key] = value;
    }
    state = next;
  }
}

final communityPendingKeysProvider = NotifierProvider<CommunityPendingKeys, Map<String, int>>(CommunityPendingKeys.new);

/// `useCommunityFollow(targetId)`: `{ isPending, setFollowing }`.
@immutable
class FollowControl {
  const FollowControl({required this.isPending, required this.setFollowing});
  final bool isPending;
  final void Function(bool following) setFollowing;
}

final communityFollowProvider = Provider.autoDispose.family<FollowControl, String>((ref, targetId) {
  final userId = ref.watch(authUserProvider)?.id;
  final key = 'community-follow|$userId|$targetId';
  final pending = (ref.watch(communityPendingKeysProvider)[key] ?? 0) > 0;
  final container = ref.container;
  return FollowControl(
    isPending: pending,
    setFollowing: (following) {
      if (userId == null || userId == targetId) return;
      unawaited(setCommunityFollow(container, targetId, following: following, actorId: userId));
    },
  );
}, name: 'communityFollowProvider');

/// The follow mutation (optimistic follower count, restore + toast on failure, explicit desired state).
Future<void> setCommunityFollow(ProviderContainer container, String targetId, {required bool following, required String actorId}) async {
  final client = container.read(queryClientProvider);
  final backend = container.read(communityBackendProvider);
  final pending = container.read(communityPendingKeysProvider.notifier);
  final key = 'community-follow|$actorId|$targetId';
  pending.add(key);
  final targetKey = ['community-profile-stats', actorId, targetId];
  await client.cancelQueries(QueryFilters(queryKey: targetKey));
  final previous = client.getQueryData<CRow?>(targetKey);
  if (previous != null) {
    final wasFollowing = previous['is_following'] == true;
    final count = (previous['followers_count'] as num?)?.toInt() ?? 0;
    client.setQueryDataValue(targetKey, {
      ...previous,
      'is_following': following,
      'followers_count': math.max(0, count + (wasFollowing == following ? 0 : following ? 1 : -1)),
    });
  }
  try {
    await backend.rpc('set_community_follow', {'p_expected_user_id': actorId, 'p_following_id': targetId, 'p_follow': following});
  } catch (_) {
    if (previous != null) client.setQueryDataValue(targetKey, previous);
    if (actorId == container.read(authUserProvider)?.id) {
      container.read(communityToastsProvider).show(
          CommunityToast(title: tr('community_follow_failed', 'İzləmə dəyişdirilmədi. Yenidən cəhd edin.'), destructive: true));
    }
  } finally {
    await Future.wait([
      client.invalidateQueries(queryKey: ['community-profile-stats', actorId]),
      client.invalidateQueries(queryKey: ['community-connections', actorId]),
      client.invalidateQueries(queryKey: ['community-feed', actorId, 'following']),
    ]);
    pending.remove(key);
  }
}

/// `useCommunityBookmark(postId)`: `{ isPending, setSaved }`.
@immutable
class BookmarkControl {
  const BookmarkControl({required this.isPending, required this.setSaved});
  final bool isPending;
  final void Function(bool saved) setSaved;
}

final communityBookmarkProvider = Provider.autoDispose.family<BookmarkControl, String>((ref, postId) {
  final userId = ref.watch(authUserProvider)?.id;
  final key = 'community-bookmark|$userId|$postId';
  final pending = (ref.watch(communityPendingKeysProvider)[key] ?? 0) > 0;
  final container = ref.container;
  return BookmarkControl(
    isPending: pending,
    setSaved: (saved) {
      if (userId == null) return;
      unawaited(setCommunityBookmark(container, postId, saved: saved, actorId: userId));
    },
  );
}, name: 'communityBookmarkProvider');

/// The bookmark mutation (optimistic `is_saved` in the actor's caches; only that field is restored on failure).
Future<void> setCommunityBookmark(ProviderContainer container, String postId, {required bool saved, required String actorId}) async {
  final client = container.read(queryClientProvider);
  final backend = container.read(communityBackendProvider);
  final pending = container.read(communityPendingKeysProvider.notifier);
  final key = 'community-bookmark|$actorId|$postId';
  pending.add(key);
  final filter = communityPostFilter(actorId);
  await client.cancelQueries(filter);
  final previous = client.getQueriesData(filter);
  patchCommunityPost(client, actorId, postId, (post) => {...post, 'is_saved': saved});
  try {
    await backend.rpc('set_community_bookmark', {'p_expected_user_id': actorId, 'p_post_id': postId, 'p_saved': saved});
  } catch (_) {
    restoreCommunityPostFields(client, previous, postId, const ['is_saved']);
    if (actorId == container.read(authUserProvider)?.id) {
      container.read(communityToastsProvider).show(
          CommunityToast(title: tr('community_save_failed', 'Paylaşım saxlanılmadı. Yenidən cəhd edin.'), destructive: true));
    }
  } finally {
    await client.invalidateQueries(queryKey: ['community-feed', actorId, 'saved']);
    pending.remove(key);
  }
}
