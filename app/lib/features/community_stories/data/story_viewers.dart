// Ported from: src/hooks/useStoryViewers.ts, src/hooks/useStoryReplies.ts
//
// Who viewed an own story (likers first), and the flat reply thread of a story (live while its sheet is open, with
// an optimistic "Siz" reply).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../domain/js_compat.dart' show jsSortInPlace, jsToIsoString;
import '../../chat/data/chat_push.dart';
import '../../community/data/community_backend.dart';
import '../../community/data/community_toasts.dart';

/// `{user_id, name, avatar_url, viewed_at, has_liked}`.
final storyViewersQuery = queryProviderFamily<List<CRow>, String?>((ref, storyId) {
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<List<CRow>>(
    queryKey: ['story-viewers', storyId],
    enabled: storyId != null && storyId.isNotEmpty,
    staleTime: const Duration(seconds: 10),
    queryFn: (_) async {
      if (storyId == null || storyId.isEmpty) return const [];
      // Views and likes in parallel: the heart is shown next to the name.
      final viewsRequest = backend.select(CQuery('story_views', 'user_id, viewed_at').eq('story_id', storyId).order('viewed_at', ascending: false));
      final likes = backend.select(CQuery('story_likes', 'user_id').eq('story_id', storyId)).then<List<CRow>?>((rows) => rows, onError: (Object _) => null);
      final views = await viewsRequest;
      final liked = {for (final l in await likes ?? const <CRow>[]) '${l['user_id']}'};
      if (views.isEmpty) return const [];
      final profiles = await backend.profileCards([for (final v in views) '${v['user_id']}']);
      final viewers = [
        for (final view in views)
          () {
            final profile = profiles['${view['user_id']}'];
            final name = profile?['name'];
            final avatar = profile?['avatar_url'];
            return <String, dynamic>{
              'user_id': view['user_id'],
              'name': name is String && name.isNotEmpty ? name : tr('usestoryviewers_i_stifadeci_b6bdd6', 'İstifadəçi'),
              'avatar_url': avatar is String && avatar.isNotEmpty ? avatar : null,
              'viewed_at': view['viewed_at'],
              'has_liked': liked.contains('${view['user_id']}'),
            };
          }(),
      ];
      // Instagram: likers first.
      return jsSortInPlace<CRow>(viewers, (a, b) => (b['has_liked'] == true ? 1 : 0) - (a['has_liked'] == true ? 1 : 0));
    },
  );
}, name: 'storyViewersQuery');

/// `useStoryReplies(storyId, enabled)`.
final storyRepliesQuery = queryProviderFamily<List<CRow>, ({String? storyId, bool enabled})>((ref, args) {
  final backend = ref.watch(communityBackendProvider);
  final client = ref.read(queryClientProvider);
  final storyId = args.storyId;
  final enabled = storyId != null && storyId.isNotEmpty && args.enabled;
  if (enabled) {
    // A reply someone else sends while the story is open shows up live.
    final remove = backend.subscribe(
      channelPrefix: 'story-replies-$storyId',
      table: 'story_replies',
      filter: 'story_id=eq.$storyId',
      onChange: (_) => unawaited(client.invalidateQueries(queryKey: ['story-replies', storyId])),
    );
    ref.onDispose(remove);
  }
  return QueryOptions<List<CRow>>(
    queryKey: ['story-replies', storyId],
    enabled: enabled,
    staleTime: const Duration(seconds: 10),
    queryFn: (_) async {
      if (storyId == null || storyId.isEmpty) return const [];
      final replies = await backend.select(CQuery('story_replies').eq('story_id', storyId).eq('is_active', true).order('created_at', ascending: true));
      if (replies.isEmpty) return const [];
      final authors = await backend.profileCards([for (final r in replies) '${r['user_id']}']);
      return [
        for (final reply in replies)
          () {
            final author = authors['${reply['user_id']}'];
            final name = author?['name'];
            final avatar = author?['avatar_url'];
            return <String, dynamic>{
              ...reply,
              'author': author != null
                  // React bug: az.json holds the escaped source text "\u0130stifad\u0259\xE7i" for
                  // usestoryreplies_i_stifadeci_b6bdd6; the sibling key of the same file has the same text, translated.
                  ? {'name': name is String && name.isNotEmpty ? name : tr('usestoryreplies_istifadeci_b6bdd6', 'İstifadəçi'), 'avatar_url': avatar is String && avatar.isNotEmpty ? avatar : null}
                  : {'name': tr('usestoryreplies_istifadeci_b6bdd6', 'İstifadəçi'), 'avatar_url': null},
            };
          }(),
      ];
    },
  );
}, name: 'storyRepliesQuery');

@immutable
class StoryReplyInput {
  const StoryReplyInput({required this.storyId, required this.content, this.storyAuthorId, this.replierName});
  final String storyId;
  final String content;
  final String? storyAuthorId;
  final String? replierName;
}

final createStoryReplyMutation = mutationProvider<void, StoryReplyInput, QuerySnapshot>((ref) {
  final client = ref.read(queryClientProvider);
  final backend = ref.watch(communityBackendProvider);
  final push = ref.watch(chatPushSenderProvider);
  final toasts = ref.read(communityToastsProvider);
  return MutationOptions<void, StoryReplyInput, QuerySnapshot>(
    mutationFn: (v) async {
      final userId = await backend.getUserId();
      if (userId == null) throw const CommunityBackendError(message: 'Not authenticated');
      final inserted = await backend.insertSingle('story_replies', {'story_id': v.storyId, 'user_id': userId, 'content': v.content}, columns: 'id');
      final replyId = inserted['id'];
      // Push to the story owner in the background (not to oneself).
      if (v.storyAuthorId != null && v.storyAuthorId!.isNotEmpty && v.storyAuthorId != userId && replyId != null) {
        unawaited(() async {
          try {
            final preview = v.content.length > 50 ? '${v.content.substring(0, 50)}...' : v.content;
            final name = v.replierName != null && v.replierName!.isNotEmpty ? v.replierName! : tr('usestoryreplies_istifadeci_b6bdd6', 'İstifadəçi');
            await push.send(SendPushPayload(
              userId: v.storyAuthorId!,
              title: tr('usestoryreplies_yeni_cavab_923a12', 'Yeni cavab 💬'),
              body: '$name: $preview',
              data: {'type': 'story_reply', 'storyId': v.storyId, 'context': 'community_story', 'interactionId': replyId},
              kind: 'story_reply',
            ));
          } catch (error) {
            debugPrint('Story reply notification error: $error');
          }
        }());
      }
    },
    onMutate: (v) => client.optimisticUpdate<List<CRow>>(['story-replies', v.storyId], (old) => [
          ...?old,
          {
            'id': 'optimistic-${DateTime.now().millisecondsSinceEpoch}',
            'story_id': v.storyId,
            'user_id': 'optimistic',
            'content': v.content,
            'created_at': jsToIsoString(DateTime.now()),
            'author': {'name': tr('usestoryreplies_siz_5c7f89', 'Siz'), 'avatar_url': null},
          },
        ]),
    onError: (error, v, snapshot) {
      snapshot?.rollback();
      toasts.show(CommunityToast(title: tr('usestoryreplies_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: errorMessage(error), destructive: true));
    },
    onSuccess: (_, v, _) {
      unawaited(client.invalidateQueries(queryKey: ['story-replies', v.storyId]));
      // replies_count changes through a server trigger.
      unawaited(client.invalidateQueries(queryKey: const ['stories']));
    },
  );
}, name: 'createStoryReplyMutation');

final deleteStoryReplyMutation = mutationProvider<void, ({String replyId, String storyId}), void>((ref) {
  final client = ref.read(queryClientProvider);
  final backend = ref.watch(communityBackendProvider);
  final toasts = ref.read(communityToastsProvider);
  return MutationOptions<void, ({String replyId, String storyId}), void>(
    mutationFn: (v) async {
      await backend.delete('story_replies', [CFilter('eq', 'id', v.replyId)]);
    },
    onSuccess: (_, v, _) {
      unawaited(client.invalidateQueries(queryKey: ['story-replies', v.storyId]));
      unawaited(client.invalidateQueries(queryKey: const ['stories']));
      toasts.show(CommunityToast(title: '${tr('usestoryreplies_cavab_silindi', 'Cavab silindi')} 🗑️'));
    },
    onError: (_, _, _) => toasts.show(CommunityToast(title: tr('usestoryreplies_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true)),
  );
}, name: 'deleteStoryReplyMutation');
