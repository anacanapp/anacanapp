// Ported from: src/hooks/useModerator.ts (useModeratorContent), src/lib/moderator.ts (ModeratorTarget,
//              ModeratorAction, ModeratorKind)
import 'package:flutter/foundation.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../moderation/moderation_queries.dart';
import '../data/community_env.dart';

/// `ModeratorKind`: post | comment | story | user.
typedef ModeratorKind = String;

/// `ModeratorAction`.
const List<String> kModeratorActions = [
  'warn', 'restrict', 'unrestrict', 'edit', 'remove', 'restore', 'pin', 'unpin', 'lock_comments', 'unlock_comments', //
];

/// `ModeratorTarget`.
@immutable
class ModeratorTarget {
  const ModeratorTarget({
    required this.kind,
    required this.id,
    required this.userId,
    this.name,
    this.content,
    this.version,
    this.restrictionId,
    this.legacy,
    this.isPinned,
    this.removed,
    this.commentsLocked,
  });
  final ModeratorKind kind;
  final String id;
  final String userId;
  final String? name;
  final String? content;
  final int? version;
  final String? restrictionId;
  final bool? legacy;
  final bool? isPinned;
  final bool? removed;
  final bool? commentsLocked;
}

/// The actions [ModeratorActionMenu] offers for a target (content actions first, then warn / restrict).
List<String> moderatorContentActions(ModeratorTarget target) {
  if (target.kind == 'user') return const [];
  if (target.removed == true) return const ['restore'];
  return [
    if (target.kind != 'story') ...['edit', target.isPinned == true ? 'unpin' : 'pin'],
    if (target.kind == 'post') target.commentsLocked == true ? 'unlock_comments' : 'lock_comments',
    'remove',
  ];
}

/// `useModeratorContent(kind, id)`: the exact current version of the content (staff only, never persisted).
final moderatorContentQuery = queryProviderFamily<Map<String, dynamic>?, (String?, String?)>((ref, args) {
  final (kind, id) = args;
  final user = ref.watch(authUserProvider)?.id;
  final access = ref.watch(moderatorAccessQuery).data;
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['moderator-content', ref.watch(communityBackendUrlProvider), user, kind, id],
    enabled: (id ?? '').isNotEmpty && (kind ?? '').isNotEmpty && kind != 'user' && access?['allowed'] == true,
    meta: const {'persist': false},
    staleTime: Duration.zero,
    queryFn: (_) async {
      final data = await ref.read(moderationBackendProvider).rpc('moderator_content_detail_v1', {'p_kind': kind, 'p_id': id});
      return data is Map ? Map<String, dynamic>.from(data) : null;
    },
  );
}, name: 'moderatorContentQuery');
