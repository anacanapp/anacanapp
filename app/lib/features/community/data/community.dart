// Ported from: src/hooks/useCommunity.ts
//
// Community posts, comments, likes and groups. Posts / comments stay rows (`CRow`, snake_case like the React
// objects); `author`, `is_liked`, `is_saved` are added by [enrichPosts] / the comment query.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/net/backend_client.dart' show BootstrapOpened;
import '../../../core/net/backend_providers.dart' show backendBootstrapProvider;
import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../chat/copy/chat_copy.dart' show chatTr;
import '../../chat/data/chat_push.dart';
import '../copy/community_copy.dart';
import 'community_backend.dart';
import 'community_env.dart';
import 'community_moderation.dart';
import 'community_post_cache.dart';
import 'community_toasts.dart';

/// JS truthiness of a JSON value.
bool truthy(Object? value) =>
    value != null && value != false && value != 0 && value != '' && !(value is double && value.isNaN);

Object? _or(Object? value, Object? fallback) => truthy(value) ? value : fallback;

/// `useBackendConfig().azure` (no legacy table fallbacks on Azure).
final communityAzureProvider = Provider<bool>((ref) {
  try {
    final result = ref.watch(backendBootstrapProvider).value;
    return result is BootstrapOpened && result.backend.azure;
  } catch (_) {
    return false;
  }
});

/// `customerIo.postCreated(actor, backend, requestId)` (analytics; not ported, no-op).
final communityPostCreatedTrackerProvider =
    Provider<void Function(String actor, String backend, String requestId)>((ref) => (actor, backend, requestId) {});

CRow _authorCard(CRow? authorData, {required bool anonymous, required String fallbackName}) {
  if (anonymous) return {'name': 'Anonim', 'avatar_url': null, 'badge_type': null, 'is_verified': false, 'verified_until': null};
  if (authorData == null) return {'name': fallbackName, 'avatar_url': null, 'badge_type': null, 'is_verified': false, 'verified_until': null};
  final badge = _or(authorData['badge_type'], null);
  return {
    'name': _or(authorData['name'], chatTr('usecommunity_i_stifadeci_b6bdd6', 'İstifadəçi')),
    'avatar_url': _or(authorData['avatar_url'], null),
    'badge_type': badge,
    'is_premium': authorData['is_premium'] == true,
    'can_share_links': authorData['can_share_links'] == true || const ['admin', 'moderator'].contains(badge ?? ''),
    'is_verified': _or(authorData['is_verified'], false),
    'verified_until': _or(authorData['verified_until'], null),
    'life_stage': _or(authorData['life_stage'], null),
  };
}

/// `enrichPosts(posts, userId)`: author cards + like / bookmark flags, three batches in parallel.
Future<List<CRow>> enrichPosts(CommunityBackend backend, List<CRow> posts, String? userId) async {
  if (posts.isEmpty) return const [];
  final ids = [for (final p in posts) p['id']];
  final results = await Future.wait<Object>([
    backend.profileCards([for (final p in posts) '${p['user_id']}']),
    userId != null
        ? backend.select(CQuery('post_likes', 'post_id').eq('user_id', userId).inList('post_id', ids))
        : Future.value(const <CRow>[]),
    userId != null
        ? backend.select(CQuery('community_post_bookmarks', 'post_id').eq('user_id', userId).inList('post_id', ids))
        : Future.value(const <CRow>[]),
  ]);
  final authorMap = results[0] as Map<String, CRow>;
  final liked = {for (final r in results[1] as List<CRow>) r['post_id']};
  final saved = {for (final r in results[2] as List<CRow>) r['post_id']};
  return [
    for (final post in posts)
      () {
        final anonymous = post['is_anonymous'] == true;
        return <String, dynamic>{
          ...post,
          'is_anonymous': anonymous,
          'author': _authorCard(anonymous ? null : authorMap['${post['user_id']}'],
              anonymous: anonymous, fallbackName: chatTr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi')),
          'is_liked': liked.contains(post['id']),
          'is_saved': saved.contains(post['id']),
        };
      }(),
  ];
}

/// `useCommunityGroups()`: active groups of the UI language.
final communityGroupsQuery = queryProvider<List<CRow>>((ref) {
  final language = ref.watch(communityLanguageProvider);
  final user = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<List<CRow>>(
    queryKey: ['community-groups', language, user],
    queryFn: (_) async {
      final rows = await backend.select(CQuery('community_groups')
          .eq('is_active', true)
          .eq('discovery_language', language)
          .order('group_type', ascending: true)
          .order('name', ascending: true));
      return [for (final g in rows) if (g['discovery_language'] == language) g];
    },
  );
}, name: 'communityGroupsQuery');

/// `useUserMemberships()`.
final userMembershipsQuery = queryProvider<List<CRow>>((ref) {
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<List<CRow>>(
    queryKey: const ['user-memberships'],
    queryFn: (_) async {
      final user = await backend.getUserId();
      if (user == null) return const [];
      return backend.select(CQuery('group_memberships', 'group_id, role, joined_at').eq('user_id', user));
    },
  );
}, name: 'userMembershipsQuery');

CommunityToasts _toasts(Ref ref) => ref.read(communityToastsProvider);
String _errorTitle() => chatTr('usecommunity_xeta_bas_verdi_f22fba', 'Xəta baş verdi');

/// `useJoinGroup()`.
final joinGroupMutation = mutationProvider<Object?, String, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (groupId) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      return backend.rpc('chat_group_action_v3', {'p_actor': user, 'p_group': groupId, 'p_action': 'join'});
    },
    onSuccess: (data, _, _) {
      for (final key in const ['user-memberships', 'community-groups', 'chat-groups-v3']) {
        unawaited(client.invalidateQueries(queryKey: [key]));
      }
      _toasts(ref).show(CommunityToast(
          title: data is Map && data['state'] == 'requested'
              ? chatTr('group_pending', 'Təsdiq gözləyir')
              : chatTr('usecommunity_qrupa_qosuldunuz_bea9e3', 'Qrupa qoşuldunuz! 🎉')));
    },
    onError: (_, _, _) => _toasts(ref).show(CommunityToast(title: _errorTitle(), destructive: true)),
  );
}, name: 'joinGroupMutation');

/// `useLeaveGroup()`.
final leaveGroupMutation = mutationProvider<void, String, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (groupId) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      await backend.rpc('chat_group_action_v3', {'p_actor': user, 'p_group': groupId, 'p_action': 'leave'});
    },
    onSuccess: (_, _, _) {
      unawaited(client.invalidateQueries(queryKey: const ['user-memberships']));
      unawaited(client.invalidateQueries(queryKey: const ['community-groups']));
      _toasts(ref).show(CommunityToast(title: chatTr('usecommunity_qrupdan_ayrildiniz_2ad166', 'Qrupdan ayrıldınız')));
    },
  );
}, name: 'leaveGroupMutation');

/// Realtime invalidation of `useGroupPosts` (one channel per group + language; the account is read at event time).
const Duration kGroupPostsInvalidateInterval = Duration(milliseconds: 4000);

final _groupPostsRealtime = Provider.autoDispose.family<void, (String?, String)>((ref, args) {
  final (groupId, uiLang) = args;
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  var lastInvalidatedAt = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? pending;
  void schedule() {
    final now = DateTime.now();
    final elapsed = now.difference(lastInvalidatedAt);
    if (elapsed >= kGroupPostsInvalidateInterval) {
      lastInvalidatedAt = now;
      unawaited(client.invalidateQueries(queryKey: ['group-posts', groupId]));
    } else {
      pending ??= Timer(kGroupPostsInvalidateInterval - elapsed, () {
        pending = null;
        lastInvalidatedAt = DateTime.now();
        unawaited(client.invalidateQueries(queryKey: ['group-posts', groupId]));
      });
    }
  }

  final cancel = backend.subscribe(
    channelPrefix: 'community-posts-${groupId ?? 'global'}',
    table: 'community_posts',
    filter: groupId != null ? 'group_id=eq.$groupId' : null,
    onChange: (change) {
      if (change.eventType == 'INSERT' && !matchesFeedLanguage(change.newRecord, uiLang)) return;
      if (groupId == null) {
        final row = change.newRecord.isNotEmpty ? change.newRecord : change.oldRecord;
        if (truthy(row['group_id'])) return;
        if (change.eventType == 'INSERT' && row['user_id'] != ref.read(authUserProvider)?.id) return;
      }
      schedule();
    },
  );
  ref.onDispose(() {
    pending?.cancel();
    cancel();
  });
});

/// `useGroupPosts(groupId)`: the 150 newest active posts of a group (null = global) in the UI language.
final groupPostsQuery = queryProviderFamily<List<CRow>, String?>((ref, groupId) {
  final userId = ref.watch(authUserProvider)?.id;
  final loading = ref.watch(communityAuthLoadingProvider);
  final uiLang = ref.watch(communityLanguageProvider);
  final backend = ref.watch(communityBackendProvider);
  ref.watch(_groupPostsRealtime((groupId, uiLang)));
  return QueryOptions<List<CRow>>(
    queryKey: ['group-posts', groupId, userId, uiLang],
    enabled: !loading,
    queryFn: (_) async {
      final q = CQuery('community_posts')
          .eq('is_active', true)
          .eq('language', uiLang)
          .order('is_pinned', ascending: false)
          .order('created_at', ascending: false);
      if (groupId != null) {
        q.eq('group_id', groupId);
      } else {
        q.isNull('group_id');
      }
      q.limit(150);
      final posts = await backend.select(q);
      return enrichPosts(backend, [for (final p in posts) if (matchesFeedLanguage(p, uiLang)) p], userId);
    },
  );
}, name: 'groupPostsQuery');

/// `useSinglePost(postId)`: one post by id (deep links / notifications), independent of the feed window.
final singlePostQuery = queryProviderFamily<CRow?, String?>((ref, postId) {
  final userId = ref.watch(authUserProvider)?.id;
  final loading = ref.watch(communityAuthLoadingProvider);
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<CRow?>(
    queryKey: ['single-post', postId, userId],
    enabled: postId != null && postId.isNotEmpty && !loading,
    queryFn: (_) async {
      final post = await backend.maybeSingle(CQuery('community_posts').eq('id', postId));
      if (post == null) return null;
      return (await enrichPosts(backend, [post], userId)).first;
    },
  );
}, name: 'singlePostQuery');

/// `useCreatePost` variables.
@immutable
class CreatePostVars {
  const CreatePostVars({
    required this.groupId,
    required this.content,
    this.mediaUrls,
    this.isAnonymous,
    this.language,
    this.autoLanguage,
    this.taggedGroupIds,
    this.blogPostId,
  });
  final String? groupId;
  final String content;
  final List<String>? mediaUrls;
  final bool? isAnonymous;
  final String? language;
  final bool? autoLanguage;
  final List<String>? taggedGroupIds;
  final String? blogPostId;
}

class _RequestHolder {
  ({String key, String id})? value;
}

final _createPostRequest = Provider.autoDispose<_RequestHolder>((ref) => _RequestHolder());

String _stableJson(Object? value) {
  if (value is Map) return '{${value.entries.map((e) => '"${e.key}":${_stableJson(e.value)}').join(',')}}';
  if (value is List) return '[${value.map(_stableJson).join(',')}]';
  if (value is String) return '"${value.replaceAll(r'\', r'\\').replaceAll('"', r'\"')}"';
  return '$value';
}

const List<String> _moderationStates = ['checking', 'review', 'approved', 'rejected'];

/// `useCreatePost()`: `submit_community_post_v2` with a request id reused until the payload changes (a lost response
/// is retried idempotently); never an unmoderated insert.
final createPostMutation = mutationProvider<CRow, CreatePostVars, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  final request = ref.watch(_createPostRequest);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null || user != ref.read(authUserProvider)?.id) throw StateError('COMMUNITY_ACTOR_MISMATCH');
      final uiLang = currentLanguage().isEmpty ? 'az' : currentLanguage();
      final fallbackLang = isFeedLang(uiLang) ? uiLang : 'az';
      final postLanguage = v.language ?? detectLang(v.content, fallbackLang);
      final backendUrl = ref.read(communityBackendUrlProvider);
      final payload = <String, dynamic>{
        'p_actor': user,
        'p_content': v.content,
        'p_language': postLanguage,
        'p_group_id': v.groupId,
        'p_media_urls': v.mediaUrls ?? const <String>[],
        'p_is_anonymous': v.isAnonymous == true,
        'p_tagged_group_ids': ({...?v.taggedGroupIds}).take(3).toList(),
        'p_blog_post_id': v.blogPostId,
        'p_auto_language': v.autoLanguage ?? v.language == null,
      };
      final key = _stableJson([backendUrl, payload]);
      if (request.value?.key != key) request.value = (key: key, id: ref.read(communityUuidProvider)());
      final requestId = request.value!.id;
      final data = await backend.rpc('submit_community_post_v2', {...payload, 'p_id': requestId});
      if (data is! Map || !truthy(data['id']) || !_moderationStates.contains(data['state'])) {
        throw const CommunityBackendError(message: 'MODERATION_INVALID_RESPONSE');
      }
      return {...Map<String, dynamic>.from(data), 'actor': user, 'backend': backendUrl, 'requestId': requestId};
    },
    onSuccess: (data, _, _) async {
      if (request.value?.id == data['requestId']) request.value = null;
      await invalidateCommunityPosts(client);
      await client.invalidateQueries(queryKey: ['community-ad-mine', data['backend'], data['actor']]);
      if (data['actor'] != ref.read(authUserProvider)?.id) return;
      ref.read(communityPostCreatedTrackerProvider)('${data['actor']}', '${data['backend']}', '${data['requestId']}');
      final language = currentLanguage();
      final state = data['state'];
      _toasts(ref).show(CommunityToast(title: moderationText('${state}_title', language), description: moderationText('${state}_body', language)));
    },
    onError: (error, _, _) => _toasts(ref).show(CommunityToast(title: moderationError(error, currentLanguage()), destructive: true)),
  );
}, name: 'createPostMutation');

@immutable
class EditPostVars {
  const EditPostVars({required this.postId, required this.content, this.currentLanguage, this.expectedRevision});
  final String postId;
  final String content;
  final String? currentLanguage;
  final int? expectedRevision;
}

/// `useEditPost()`: the guarded `edit_community_post_v1` RPC with the expected revision (the language is re-detected).
final editPostMutation = mutationProvider<CRow, EditPostVars, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      final uiLang = currentLanguage().isEmpty ? 'az' : currentLanguage();
      final fallbackLang = isFeedLang(v.currentLanguage) ? v.currentLanguage! : isFeedLang(uiLang) ? uiLang : 'az';
      final data = await backend.rpc('edit_community_post_v1', {
        'p_actor': user,
        'p_post': v.postId,
        'p_content': v.content,
        'p_language': detectLang(v.content, fallbackLang),
        'p_expected_revision': v.expectedRevision,
      });
      if (data == null) throw const CommunityBackendError(message: 'MODERATION_REVIEW_CONFLICT');
      if (data is! Map || !_moderationStates.contains(data['state'])) throw const CommunityBackendError(message: 'MODERATION_REQUIRED');
      return Map<String, dynamic>.from(data);
    },
    onSuccess: (data, _, _) async {
      await invalidateCommunityPosts(client);
      await client.invalidateQueries(queryKey: const ['community-ad-mine']);
      _toasts(ref).show(CommunityToast(title: moderationText('${data['state']}_title', currentLanguage())));
    },
    onError: (error, _, _) => _toasts(ref).show(CommunityToast(title: moderationError(error, currentLanguage()), destructive: true)),
  );
}, name: 'editPostMutation');

/// `useDeletePost()`: ownership is enforced by RLS (own posts, admins); zero deleted rows is an error.
final deletePostMutation = mutationProvider<void, String, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (postId) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      final rows = await backend.delete('community_posts', [CFilter('eq', 'id', postId)], returning: 'id');
      if (rows.isEmpty) throw StateError('Not permitted');
    },
    onSuccess: (_, _, _) async {
      await invalidateCommunityPosts(client);
      _toasts(ref).show(CommunityToast(title: '${chatTr('usecommunity_post_silindi', 'Post silindi')} 🗑️'));
    },
    onError: (_, _, _) => _toasts(ref).show(CommunityToast(title: _errorTitle(), destructive: true)),
  );
}, name: 'deletePostMutation');

/// `useTogglePinPost()`: the moderator content action at the post's current version.
final togglePinMutation = mutationProvider<void, ({String postId, bool pin}), void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final current = await backend.rpc('moderator_content_detail_v1', {'p_kind': 'post', 'p_id': v.postId});
      if (current is! Map) throw const CommunityBackendError(message: 'MODERATOR_CONTENT_UNAVAILABLE');
      await backend.rpc('moderator_content_action_v1', {
        'p_kind': 'post',
        'p_id': v.postId,
        'p_version': current['version'],
        'p_action': v.pin ? 'pin' : 'unpin',
        'p_reason': 'other',
        'p_content': null,
        'p_note': '',
        'p_request': ref.read(communityUuidProvider)(),
      });
    },
    onSuccess: (_, v, _) async {
      await invalidateCommunityPosts(client);
      _toasts(ref).show(CommunityToast(
          title: v.pin ? chatTr('usecommunity_post_pinlendi', '📌 Post pinləndi') : chatTr('usecommunity_post_pini_goturuldu', 'Post pindən çıxarıldı')));
    },
    onError: (_, _, _) => _toasts(ref).show(CommunityToast(title: _errorTitle(), destructive: true)),
  );
}, name: 'togglePinMutation');

@immutable
class LikeVars {
  const LikeVars({required this.postId, required this.isLiked, this.groupId, required this.viewerId});
  final String postId;
  final bool isLiked;
  final String? groupId;

  /// `useAuth().user.id` when the hook rendered (the mutation refuses another account).
  final String? viewerId;
}

typedef LikeContext = ({List<(QueryKey, Object?)> previous, String? userId});

void _background(Future<void> Function() run, String label) {
  unawaited(run().catchError((Object e) => debugPrint('$label: $e')));
}

/// `useToggleLike()`: optimistic heart + count, background push to the author, rollback of only those fields.
final toggleLikeMutation = mutationProvider<void, LikeVars, LikeContext>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null || user != v.viewerId) throw StateError('Not authenticated');
      if (v.isLiked) {
        await backend.delete('post_likes', [CFilter('eq', 'post_id', v.postId), CFilter('eq', 'user_id', user)]);
        return;
      }
      CRow like;
      try {
        like = await backend.insertSingle('post_likes', {'post_id': v.postId, 'user_id': user}, columns: 'id');
      } catch (error) {
        if (errorCode(error) == '23505') return;
        rethrow;
      }
      final push = ref.read(chatPushSenderProvider);
      _background(() async {
        final post = await backend.maybeSingle(CQuery('community_posts', 'id, user_id, group_id').eq('id', v.postId));
        if (post != null && post['user_id'] != user) {
          final profile = await backend.maybeSingle(CQuery('public_profile_cards', 'name').eq('user_id', user));
          final likerName = _or(profile?['name'], chatTr('usecommunity_i_stifadeci_b6bdd6', 'İstifadəçi'));
          await push.send(SendPushPayload(
            userId: '${post['user_id']}',
            title: chatTr('usecommunity_yeni_beyenme_3fd88a', 'Yeni bəyənmə ❤️'),
            body: '$likerName ${chatTr('usecommunity_paylasiminizi_beyendi', 'paylaşımınızı bəyəndi')}',
            data: {
              'type': 'community_like',
              'context': 'community_post',
              'postId': post['id'],
              'groupId': post['group_id'],
              'interactionId': like['id'],
            },
            kind: 'community_like',
          ));
        }
      }, 'Like notification error');
    },
    onMutate: (v) async {
      final filter = communityPostFilter(v.viewerId, true);
      await client.cancelQueries(filter);
      final previous = client.getQueriesData(filter);
      patchCommunityPost(client, v.viewerId, v.postId, (p) {
        final count = (p['likes_count'] as num?)?.toInt() ?? 0;
        return {...p, 'is_liked': !v.isLiked, 'likes_count': (count + (v.isLiked ? -1 : 1)).clamp(0, 1 << 31)};
      }, true);
      return (previous: previous, userId: v.viewerId);
    },
    onError: (_, v, ctx) {
      if (ctx != null) restoreCommunityPostFields(client, ctx.previous, v.postId, const ['is_liked', 'likes_count']);
    },
    onSettled: (_, _, _, ctx) => client.invalidateQueries(queryKey: ['community-profile-stats', ctx?.userId]),
  );
}, name: 'toggleLikeMutation');

/// `useToggleCommentLike()`: optimistic, with a background push to the comment author.
final toggleCommentLikeMutation = mutationProvider<void, ({String commentId, bool isLiked, String postId}), QuerySnapshot>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      if (v.isLiked) {
        await backend.delete('comment_likes', [CFilter('eq', 'comment_id', v.commentId), CFilter('eq', 'user_id', user)]);
        return;
      }
      CRow like;
      try {
        like = await backend.insertSingle('comment_likes', {'comment_id': v.commentId, 'user_id': user}, columns: 'id');
      } catch (error) {
        if (errorCode(error) == '23505') return;
        rethrow;
      }
      final push = ref.read(chatPushSenderProvider);
      _background(() async {
        final comment = await backend.maybeSingle(CQuery('post_comments', 'id, user_id, content, post_id').eq('id', v.commentId));
        if (comment != null && comment['user_id'] != user) {
          final profile = await backend.maybeSingle(CQuery('public_profile_cards', 'name').eq('user_id', user));
          final likerName = _or(profile?['name'], chatTr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi'));
          final content = '${comment['content'] ?? ''}';
          final preview = jsSlice(content, 0, 50);
          await push.send(SendPushPayload(
            userId: '${comment['user_id']}',
            title: chatTr('usecommunity_serhiniz_beyenildi', 'Şərhiniz bəyənildi ❤️'),
            body: preview.isNotEmpty ? '$likerName: $preview' : '$likerName',
            data: {
              'type': 'comment_like',
              'context': 'post_comment',
              'commentId': comment['id'],
              'postId': comment['post_id'],
              'interactionId': like['id'],
            },
            kind: 'comment_like',
          ));
        }
      }, 'Comment like notification error');
    },
    onMutate: (v) => client.optimisticUpdate<Object?>(['post-comments', v.postId], (old) {
      if (old is! List) return old;
      return [
        for (final c in old)
          if (c is Map && c['id'] == v.commentId)
            {
              ...Map<String, dynamic>.from(c),
              'is_liked': !v.isLiked,
              'likes_count': (((c['likes_count'] as num?)?.toInt() ?? 0) + (v.isLiked ? -1 : 1)).clamp(0, 1 << 31),
            }
          else
            c,
      ];
    }),
    onError: (_, _, snapshot) => snapshot?.rollback(),
  );
}, name: 'toggleCommentLikeMutation');

/// `str.slice(start, end)` on UTF-16 code units (like JS).
String jsSlice(String value, int start, [int? end]) {
  final e = end == null || end > value.length ? value.length : end;
  if (start >= e) return '';
  return value.substring(start, e);
}

CRow _commentAuthor(CRow comment, Map<String, CRow> authorMap) {
  final anonymous = comment['is_anonymous'] == true;
  return _authorCard(anonymous ? null : authorMap['${comment['user_id']}'],
      anonymous: anonymous, fallbackName: chatTr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi'));
}

/// `usePostComments(postId, enabled)`: only while the comment sheet is open (query + realtime channel).
final postCommentsQuery = queryProviderFamily<List<CRow>, ({String postId, bool enabled})>((ref, args) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  final azure = ref.watch(communityAzureProvider);
  final enabled = args.postId.isNotEmpty && args.enabled;
  if (enabled) {
    final cancel = backend.subscribe(
      channelPrefix: 'post-comments-${args.postId}',
      table: 'post_comments',
      filter: 'post_id=eq.${args.postId}',
      onChange: (_) => unawaited(client.invalidateQueries(queryKey: ['post-comments', args.postId])),
    );
    ref.onDispose(cancel);
  }
  return QueryOptions<List<CRow>>(
    queryKey: ['post-comments', args.postId],
    enabled: enabled,
    queryFn: (_) async {
      final user = await backend.getUserId();
      List<CRow> comments;
      try {
        final data = await backend.rpc('community_comments_v2', {'p_post': args.postId});
        comments = [for (final row in data is List ? data : const []) if (row is Map) Map<String, dynamic>.from(row)];
      } catch (error) {
        if (!const ['PGRST202', '42883'].contains(errorCode(error)) || azure) rethrow;
        comments = await backend.select(CQuery('post_comments')
            .eq('post_id', args.postId)
            .eq('is_active', true)
            .order('created_at', ascending: true));
      }
      final authorMap = await backend.profileCards([for (final c in comments) '${c['user_id']}']);
      final liked = <Object?>{};
      if (user != null && comments.isNotEmpty) {
        final rows = await backend.select(
            CQuery('comment_likes', 'comment_id').eq('user_id', user).inList('comment_id', [for (final c in comments) c['id']]));
        liked.addAll(rows.map((r) => r['comment_id']));
      }
      return [
        for (final c in comments) {...c, 'author': _commentAuthor(c, authorMap), 'is_liked': liked.contains(c['id'])},
      ];
    },
  );
}, name: 'postCommentsQuery');

@immutable
class CreateCommentVars {
  const CreateCommentVars({
    required this.postId,
    required this.content,
    this.imageUrl,
    this.parentCommentId,
    this.postAuthorId,
    this.commenterName,
    this.isAnonymous,
    this.expectedUserId,
  });
  final String postId;
  final String content;
  final String? imageUrl;
  final String? parentCommentId;
  final String? postAuthorId;
  final String? commenterName;
  final bool? isAnonymous;
  final String? expectedUserId;
}

/// `Array.from(text).slice(0, n).join('')` (code points).
String takeCodePoints(String text, int n) => String.fromCharCodes(text.runes.take(n));

/// `useCreateComment()`: insert, then a push to the persisted recipient (parent author for replies, post author for
/// root comments) bound to the inserted id; an optimistic row until the refetch.
final createCommentMutation = mutationProvider<void, CreateCommentVars, QuerySnapshot>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null || (v.expectedUserId != null && v.expectedUserId!.isNotEmpty && user != v.expectedUserId)) {
        throw StateError('Not authenticated');
      }
      final inserted = await backend.insertSingle(
        'post_comments',
        {
          'post_id': v.postId,
          'user_id': user,
          'parent_comment_id': v.parentCommentId,
          'content': v.content,
          'image_url': truthy(v.imageUrl) ? v.imageUrl : null,
          'is_anonymous': v.isAnonymous ?? false,
        },
        columns: 'id, post_id, parent_comment_id',
      );
      final content = v.content;
      final preview = content.trim().isNotEmpty ? (content.length > 50 ? '${jsSlice(content, 0, 50)}...' : content) : '📷';
      final rawName = v.isAnonymous == true
          ? chatTr('usecommunity_anonim', 'Anonim')
          : (v.commenterName?.trim().isNotEmpty == true ? v.commenterName!.trim() : chatTr('usecommunity_i_stifadeci_b6bdd6', 'İstifadəçi'));
      final senderName = takeCodePoints(rawName, 30);
      final push = ref.read(chatPushSenderProvider);
      try {
        final parentId = inserted['parent_comment_id'];
        if (truthy(parentId)) {
          final parent = await backend.maybeSingle(CQuery('post_comments', 'user_id, post_id').eq('id', parentId));
          final parentAuthorId = parent?['user_id'];
          if (truthy(parentAuthorId) && parentAuthorId != user && parent!['post_id'] == inserted['post_id']) {
            await push.send(SendPushPayload(
              userId: '$parentAuthorId',
              title: '$senderName ${chatTr('community_reply_notification', 'rəyinizə cavab yazdı')}',
              body: preview,
              data: {
                'type': 'community_reply',
                'context': 'post_comment',
                'commentId': parentId,
                'postId': inserted['post_id'],
                'interactionId': inserted['id'],
              },
              kind: 'community_reply',
            ));
          }
        } else {
          final post = await backend.maybeSingle(CQuery('community_posts', 'user_id').eq('id', inserted['post_id']));
          final author = post?['user_id'];
          if (truthy(author) && author != user) {
            await push.send(SendPushPayload(
              userId: '$author',
              title: chatTr('usecommunity_yeni_serh_25bb56', 'Yeni şərh 💬'),
              body: '$senderName: $preview',
              data: {
                'type': 'community_comment',
                'context': 'community_post',
                'postId': inserted['post_id'],
                'interactionId': inserted['id'],
              },
              kind: 'community_comment',
            ));
          }
        }
      } catch (e) {
        debugPrint('Comment notification error: $e');
      }
    },
    onMutate: (v) => client.optimisticUpdate<Object?>(['post-comments', v.postId], (old) => [
          ...(old is List ? old : const []),
          {
            'id': 'optimistic-${DateTime.now().millisecondsSinceEpoch}',
            'post_id': v.postId,
            'user_id': 'optimistic',
            'parent_comment_id': v.parentCommentId,
            'content': v.content,
            'image_url': truthy(v.imageUrl) ? v.imageUrl : null,
            'likes_count': 0,
            'created_at': DateTime.now().toUtc().toIso8601String(),
            'is_anonymous': v.isAnonymous ?? false,
            'author': v.isAnonymous == true
                ? {'name': 'Anonim', 'avatar_url': null, 'badge_type': null, 'is_verified': false, 'verified_until': null}
                : {
                    'name': truthy(v.commenterName) ? v.commenterName : chatTr('usecommunity_i_stifadeci_b6bdd6', 'İstifadəçi'),
                    'avatar_url': null,
                    'badge_type': null,
                    'is_verified': false,
                    'verified_until': null,
                  },
            'is_liked': false,
          },
        ]),
    onError: (error, v, snapshot) {
      snapshot?.rollback();
      final message = errorMessage(error);
      _toasts(ref).show(CommunityToast(
        title: _errorTitle(),
        description: message == 'COMMENT_LINKS_STAFF_ONLY'
            ? chatTr('community_links_staff_only', 'Rəylərdə linki yalnız administrator və moderator paylaşa bilər.')
            : message,
        destructive: true,
      ));
    },
    onSuccess: (_, v, _) async {
      await Future.wait([
        client.invalidateQueries(queryKey: ['post-comments', v.postId]),
        invalidateCommunityPosts(client),
      ]);
    },
  );
}, name: 'createCommentMutation');

/// Marker for "leave `image_url` unchanged" in [EditCommentVars].
const Object keepImage = Object();

@immutable
class EditCommentVars {
  const EditCommentVars({required this.commentId, required this.content, required this.postId, this.imageUrl = keepImage});
  final String commentId;
  final String content;
  final String postId;

  /// [keepImage] (undefined), null (remove the image) or a URL.
  final Object? imageUrl;
}

/// `useEditComment()`: own comments only (`.eq('user_id', user.id)`).
final editCommentMutation = mutationProvider<void, EditCommentVars, void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      final updates = <String, dynamic>{'content': v.content, if (!identical(v.imageUrl, keepImage)) 'image_url': v.imageUrl};
      await backend.update('post_comments', updates, [CFilter('eq', 'id', v.commentId), CFilter('eq', 'user_id', user)]);
    },
    onSuccess: (_, v, _) {
      unawaited(client.invalidateQueries(queryKey: ['post-comments', v.postId]));
      _toasts(ref).show(CommunityToast(title: chatTr('usecommunity_serh_redakte_edildi', 'Şərh redaktə edildi ✏️')));
    },
    onError: (_, _, _) => _toasts(ref).show(CommunityToast(title: _errorTitle(), destructive: true)),
  );
}, name: 'editCommentMutation');

/// `useDeleteComment()`: ownership enforced by RLS (own comments, admins).
final deleteCommentMutation = mutationProvider<void, ({String commentId, String postId}), void>((ref) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) async {
      final user = await backend.getUserId();
      if (user == null) throw StateError('Not authenticated');
      await backend.delete('post_comments', [CFilter('eq', 'id', v.commentId)]);
    },
    onSuccess: (_, v, _) async {
      await Future.wait([client.invalidateQueries(queryKey: ['post-comments', v.postId]), invalidateCommunityPosts(client)]);
      _toasts(ref).show(CommunityToast(title: '${chatTr('commentreply_serh_silindi_59cfe5', 'Şərh silindi')} 🗑️'));
    },
    onError: (_, _, _) => _toasts(ref).show(CommunityToast(title: _errorTitle(), destructive: true)),
  );
}, name: 'deleteCommentMutation');
