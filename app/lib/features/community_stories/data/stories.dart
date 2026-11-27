// Ported from: src/hooks/useStories.ts (useStories, useToggleStoryLike)
//
// Community stories (24 h, optionally per group): one query per account and group, enriched with the authors'
// public cards and the viewer's own like / view flags in three parallel batches. Views patch the cached flags in
// place (no refetch, so an open viewer does not re-sort); likes are optimistic per viewer.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../domain/js_compat.dart' show jsSortInPlace, jsToIsoString, jsParseDate;
import '../../chat/data/chat_push.dart';
import '../../community/data/community_backend.dart';
import '../../community/data/community_env.dart' show communityAuthLoadingProvider;
import '../../community/data/community_toasts.dart';
import '../editor/story_scene.dart';
import 'stories_backend.dart';

/// A `community_stories` row with `likes_count`, `replies_count`, `is_liked`, `is_viewed` and `author {name,
/// avatar_url}`.
typedef StoryRow = CRow;

String _userFallback() => tr('usestories_i_stifadeci_b6bdd6', 'İstifadəçi');

/// `UserStoryGroup`.
class UserStoryGroup {
  UserStoryGroup({required this.userId, required this.userName, required this.userAvatar, required this.stories, required this.hasUnviewed});
  final String userId;
  final String userName;
  final String? userAvatar;
  final List<StoryRow> stories;
  bool hasUnviewed;
}

int _ms(Object? iso) => iso is String ? (jsParseDate(iso)?.millisecondsSinceEpoch ?? 0) : 0;

/// The `storyGroups` of useStories: grouped by author, chronological inside a group, own group first, then groups
/// with unviewed stories (stable).
List<UserStoryGroup> groupStories(List<StoryRow> stories, String? userId) {
  final groups = <UserStoryGroup>[];
  for (final story in stories) {
    final owner = '${story['user_id']}';
    final existing = groups.where((g) => g.userId == owner).firstOrNull;
    final viewed = story['is_viewed'] == true;
    if (existing != null) {
      existing.stories.add(story);
      if (!viewed) existing.hasUnviewed = true;
    } else {
      final author = story['author'];
      final name = author is Map && author['name'] is String && (author['name'] as String).isNotEmpty ? author['name'] as String : _userFallback();
      final avatar = author is Map && author['avatar_url'] is String && (author['avatar_url'] as String).isNotEmpty ? author['avatar_url'] as String : null;
      groups.add(UserStoryGroup(userId: owner, userName: name, userAvatar: avatar, stories: [story], hasUnviewed: !viewed));
    }
  }
  for (final g in groups) {
    jsSortInPlace<StoryRow>(g.stories, (a, b) => _ms(a['created_at']) - _ms(b['created_at']));
  }
  jsSortInPlace<UserStoryGroup>(groups, (a, b) {
    if (a.userId == userId) return -1;
    if (b.userId == userId) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });
  return groups;
}

/// `['stories', userId, groupId]`.
List<Object?> storiesKey(String? userId, String? groupId) => ['stories', userId, groupId];

/// The clock of the `expires_at` filter (replaceable in tests).
final storiesClockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

final storiesQuery = queryProviderFamily<List<StoryRow>, String?>((ref, groupId) {
  final userId = ref.watch(authUserProvider)?.id;
  final authLoading = ref.watch(communityAuthLoadingProvider);
  final backend = ref.watch(communityBackendProvider);
  final now = ref.watch(storiesClockProvider);
  return QueryOptions<List<StoryRow>>(
    queryKey: storiesKey(userId, groupId),
    enabled: !authLoading,
    staleTime: const Duration(seconds: 30),
    queryFn: (_) async {
      final query = CQuery('community_stories').gt('expires_at', jsToIsoString(now())).order('created_at', ascending: false);
      if (groupId != null && groupId.isNotEmpty) query.eq('group_id', groupId);
      final source = await backend.select(query);
      final data = [for (final row in source) if (row['moderation_removed_at'] == null) row];
      if (data.isEmpty) return const [];
      final ids = [for (final s in data) '${s['id']}'];
      final results = await Future.wait<Object?>([
        backend.profileCards([for (final s in data) '${s['user_id']}']),
        userId != null ? backend.select(CQuery('story_likes', 'story_id').eq('user_id', userId).inList('story_id', ids)) : Future.value(const <CRow>[]),
        userId != null ? backend.select(CQuery('story_views', 'story_id').eq('user_id', userId).inList('story_id', ids)) : Future.value(const <CRow>[]),
      ]);
      final authors = results[0] as Map<String, CRow>;
      final liked = {for (final r in results[1] as List<CRow>) '${r['story_id']}'};
      final viewed = {for (final r in results[2] as List<CRow>) '${r['story_id']}'};
      return [
        for (final story in data)
          () {
            final author = authors['${story['user_id']}'];
            final name = author?['name'];
            final avatar = author?['avatar_url'];
            return <String, dynamic>{
              ...story,
              'likes_count': story['likes_count'] ?? 0,
              'is_liked': liked.contains('${story['id']}'),
              'replies_count': story['replies_count'] ?? 0,
              'author': {
                'name': name is String && name.isNotEmpty ? name : _userFallback(),
                'avatar_url': author != null && avatar is String && avatar.isNotEmpty ? avatar : null,
              },
              'is_viewed': viewed.contains('${story['id']}'),
            };
          }(),
      ];
    },
  );
}, name: 'storiesQuery');

/// `useStories(groupId)` (reads).
@immutable
class StoriesView {
  const StoriesView({required this.stories, required this.storyGroups, required this.isLoading, required this.isFetching, required this.refetch});
  final List<StoryRow> stories;
  final List<UserStoryGroup> storyGroups;
  final bool isLoading;
  final bool isFetching;
  final Future<void> Function() refetch;
}

final storiesProvider = Provider.autoDispose.family<StoriesView, String?>((ref, groupId) {
  final q = ref.watch(storiesQuery(groupId));
  final stories = q.data ?? const <StoryRow>[];
  return StoriesView(
    stories: stories,
    storyGroups: groupStories(stories, ref.watch(authUserProvider)?.id),
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    refetch: () async {
      await ref.read(storiesQuery(groupId).notifier).refetch();
    },
  );
}, name: 'storiesProvider');

/// `createStory` input. [editorLayout] is sent only when [hasEditorLayout] (`editorLayout !== undefined`).
@immutable
class CreateStoryInput {
  const CreateStoryInput({
    required this.mediaUrl,
    required this.mediaType,
    this.textOverlay,
    this.backgroundColor,
    this.groupId,
    this.storyId,
    this.editorLayout,
    this.hasEditorLayout = false,
  });
  final String mediaUrl;
  final String mediaType;
  final String? textOverlay;
  final String? backgroundColor;
  final String? groupId;
  final String? storyId;
  final StoryScene? editorLayout;
  final bool hasEditorLayout;
}

String? _orNull(String? value) => value == null || value.isEmpty ? null : value;

final createStoryMutation = mutationProvider<void, CreateStoryInput, void>((ref) {
  final user = ref.watch(authUserProvider);
  final backend = ref.watch(communityBackendProvider);
  final storage = ref.watch(storyStorageProvider);
  final client = ref.read(queryClientProvider);
  final toasts = ref.read(communityToastsProvider);
  return MutationOptions<void, CreateStoryInput, void>(
    mutationFn: (v) async {
      if (user == null) throw const CommunityBackendError(message: 'Not authenticated');
      final storyId = _orNull(v.storyId);
      if (storyId != null) {
        await backend.rpc('save_story_editor', {
          'p_expected_user_id': user.id,
          'p_story_id': storyId,
          'p_group_id': _orNull(v.groupId),
          'p_media_url': v.mediaUrl,
          'p_media_type': v.mediaType,
          'p_text_overlay': _orNull(v.textOverlay),
          'p_background_color': _orNull(v.backgroundColor),
          'p_editor_layout': v.editorLayout?.toJson(),
        });
        return;
      }
      await storage.insert('community_stories', {
        'user_id': user.id,
        'group_id': _orNull(v.groupId),
        'media_url': v.mediaUrl,
        'media_type': v.mediaType,
        'text_overlay': _orNull(v.textOverlay),
        'background_color': _orNull(v.backgroundColor),
        if (v.hasEditorLayout) 'editor_layout': v.editorLayout?.toJson(),
      });
    },
    onSuccess: (_, _, _) async {
      await client.invalidateQueries(queryKey: const ['stories']);
      toasts.show(CommunityToast(title: tr('usestories_story_paylasildi_e1288f', 'Story paylaşıldı! 📸')));
    },
    onError: (_, v, _) {
      if (_orNull(v.storyId) == null) toasts.show(CommunityToast(title: tr('usestories_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true));
    },
  );
}, name: 'createStoryMutation');

/// `markAsViewed(storyId)`: records the view and patches only this viewer's cached flags (no refetch).
final markStoryViewedProvider = Provider.autoDispose<Future<void> Function(String storyId)>((ref) {
  final user = ref.watch(authUserProvider);
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return (storyId) async {
    if (user == null) return;
    try {
      await backend.upsert('story_views', [
        {'story_id': storyId, 'user_id': user.id},
      ], onConflict: 'story_id,user_id');
      client.setQueriesData(QueryFilters(queryKey: ['stories', user.id]), (old) {
        if (old is! List) return null;
        return [
          for (final s in old)
            if (s is Map && s['id'] == storyId) {...s, 'is_viewed': true} else s,
        ];
      });
    } catch (error) {
      debugPrint('Error marking story as viewed: $error');
    }
  };
});

final deleteStoryMutation = mutationProvider<void, String, void>((ref) {
  final user = ref.watch(authUserProvider);
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  final toasts = ref.read(communityToastsProvider);
  return MutationOptions<void, String, void>(
    mutationFn: (storyId) async {
      if (user == null) throw const CommunityBackendError(message: 'Not authenticated');
      // Ownership is enforced by RLS (own stories + admins).
      final rows = await backend.delete('community_stories', [CFilter('eq', 'id', storyId)], returning: 'id');
      if (rows.isEmpty) throw const CommunityBackendError(message: 'Not permitted');
    },
    onSuccess: (_, _, _) {
      unawaited(client.invalidateQueries(queryKey: const ['stories']));
      toasts.show(CommunityToast(title: tr('stories_story_silindi', 'Story silindi')));
    },
  );
}, name: 'deleteStoryMutation');

/// `useToggleStoryLike()`: optimistic, scoped to this viewer's caches (`['stories', viewer]`); a duplicate insert
/// (23505) counts as success; the owner gets a push in the background.
final toggleStoryLikeMutation = mutationProvider<void, ({String storyId, bool isLiked}), QuerySnapshot>((ref) {
  final client = ref.read(queryClientProvider);
  final backend = ref.watch(communityBackendProvider);
  final push = ref.watch(chatPushSenderProvider);
  final queryKey = ['stories', ref.watch(authUserProvider)?.id];
  return MutationOptions<void, ({String storyId, bool isLiked}), QuerySnapshot>(
    mutationFn: (v) async {
      final userId = await backend.getUserId();
      if (userId == null) throw const CommunityBackendError(message: 'Not authenticated');
      if (v.isLiked) {
        await backend.delete('story_likes', [CFilter('eq', 'story_id', v.storyId), CFilter('eq', 'user_id', userId)]);
        return;
      }
      CRow inserted;
      try {
        inserted = await backend.insertSingle('story_likes', {'story_id': v.storyId, 'user_id': userId}, columns: 'id');
      } catch (error) {
        if (errorCode(error) == '23505') return;
        rethrow;
      }
      final likeId = inserted['id'];
      if (likeId == null) return;
      unawaited(() async {
        try {
          final story = await backend.maybeSingle(CQuery('community_stories', 'user_id').eq('id', v.storyId));
          if (story != null && story['user_id'] != userId) {
            final profile = await backend.maybeSingle(CQuery('public_profile_cards', 'name').eq('user_id', userId));
            final name = profile?['name'];
            final likerName = name is String && name.isNotEmpty ? name : _userFallback();
            await push.send(SendPushPayload(
              userId: '${story['user_id']}',
              title: tr('usestories_yeni_beyenme_3fd88a', 'Yeni bəyənmə ❤️'),
              body: '$likerName ${tr('usestories_story_nizi_beyendi', 'story-nizi bəyəndi')}',
              data: {'type': 'story_like', 'storyId': v.storyId, 'context': 'community_story', 'interactionId': likeId},
              kind: 'story_like',
            ));
          }
        } catch (error) {
          debugPrint('Story like notification error: $error');
        }
      }());
    },
    onMutate: (v) => client.optimisticUpdateQueries(QueryFilters(queryKey: queryKey), (old) {
      if (old is! List) return null;
      return [
        for (final s in old)
          if (s is Map && s['id'] == v.storyId)
            {
              ...s,
              'is_liked': !v.isLiked,
              'likes_count': (((s['likes_count'] as num?) ?? 0) + (v.isLiked ? -1 : 1)).clamp(0, double.infinity).toInt(),
            }
          else
            s,
      ];
    }),
    onError: (_, _, snapshot) => snapshot?.rollback(),
  );
}, name: 'toggleStoryLikeMutation');
