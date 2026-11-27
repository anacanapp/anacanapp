// Ported from: src/lib/community-post-cache.ts
//
// Cached community posts live in four shapes: feed pages (`community-feed`, [InfiniteData] of [FeedPage]), post lists
// (`group-posts`, the legacy `user-posts`), and single posts (`single-post`). These helpers patch / restore one post in
// every shape for one viewer.
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/cache/cache.dart';
import 'community_backend.dart' show CRow;

/// One page of `get_community_feed_v2` (`{ posts, nextOffset }`).
@immutable
class FeedPage {
  const FeedPage({required this.posts, this.nextOffset});
  final List<CRow> posts;
  final int? nextOffset;

  FeedPage copyWith({List<CRow>? posts}) => FeedPage(posts: posts ?? this.posts, nextOffset: nextOffset);
}

typedef FeedPages = InfiniteData<FeedPage, int>;

/// `communityPostFilter(userId, includeLegacyProfiles)`.
QueryFilters communityPostFilter(String? userId, [bool includeLegacyProfiles = false]) => QueryFilters(predicate: (query) {
      final key = query.queryKey;
      final root = key.isEmpty ? null : key[0];
      if (root == 'community-feed') return key.length > 1 && key[1] == userId;
      if (root == 'group-posts' || root == 'single-post') return key.length > 2 && key[2] == userId;
      return includeLegacyProfiles && root == 'user-posts';
    });

/// `mapCommunityPostCache(data, postId, update)`.
Object? mapCommunityPostCache(Object? data, String postId, CRow Function(CRow post) update) {
  List<CRow> map(List<CRow> posts) => [for (final post in posts) post['id'] == postId ? update(post) : post];
  if (data is List) return map([for (final p in data) Map<String, dynamic>.from(p as Map)]);
  if (data is FeedPages) {
    return FeedPages(pages: [for (final page in data.pages) page.copyWith(posts: map(page.posts))], pageParams: data.pageParams);
  }
  if (data is Map && data['id'] == postId) return update(Map<String, dynamic>.from(data));
  return data;
}

/// `patchCommunityPost(client, userId, postId, update, includeLegacyProfiles)`.
void patchCommunityPost(QueryClient client, String? userId, String postId, CRow Function(CRow post) update,
    [bool includeLegacyProfiles = false]) {
  client.setQueriesData(communityPostFilter(userId, includeLegacyProfiles), (data) => mapCommunityPostCache(data, postId, update));
}

/// `invalidateCommunityPosts(client)`.
Future<void> invalidateCommunityPosts(QueryClient client) async {
  await Future.wait([
    client.invalidateQueries(
        predicate: (q) =>
            q.queryKey.isNotEmpty && const ['community-feed', 'group-posts', 'user-posts', 'single-post'].contains('${q.queryKey[0]}')),
    client.invalidateQueries(queryKey: const ['community-profile-stats']),
    client.invalidateQueries(queryKey: const ['community-ad-mine']),
  ]);
}

/// `restoreCommunityPostFields(client, snapshots, postId, fields)`.
void restoreCommunityPostFields(QueryClient client, List<(QueryKey, Object?)> snapshots, String postId, List<String> fields) {
  for (final (key, previous) in snapshots) {
    CRow? before;
    mapCommunityPostCache(previous, postId, (post) {
      before = post;
      return post;
    });
    final b = before;
    if (b == null) continue;
    final restored = {for (final field in fields) field: b[field]};
    client.setQueryData<Object?>(key, (current) => mapCommunityPostCache(current, postId, (post) => {...post, ...restored}));
  }
}
