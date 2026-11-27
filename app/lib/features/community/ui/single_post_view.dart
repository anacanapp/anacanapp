// Ported from: src/components/community/SinglePostView.tsx
//
// The notification / deep-link target: one post by id (independent of the feed window), its comments open and the
// referenced comment highlighted. Removed posts show the moderator decision with the appeal link; held posts show the
// author's review card.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/links/push_nav.dart' show PushNavIntent;
import '../../../shell/nav/shell_controller.dart';
import '../../moderation/moderator.dart';
import '../data/community.dart';
import '../data/community_moderation.dart';
import 'community_post_feed.dart';
import 'community_widgets.dart';
import 'post_card.dart';

/// `<SinglePostView postId commentId onBack onUserClick />` as slivers (sticky header + body).
class SinglePostView extends ConsumerWidget {
  const SinglePostView({super.key, required this.postId, this.commentId, required this.onBack, this.onUserClick});
  final String postId;
  final String? commentId;
  final VoidCallback onBack;
  final void Function(String userId)? onUserClick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final q = ref.watch(singlePostQuery(postId));
    final post = q.data;
    Widget body;
    if (q.isLoading) {
      body = const ASkeleton(height: 192);
    } else if (post == null) {
      body = ACard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 36),
        child: Column(children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: AIcon(AIcons.fileQuestion, size: 32, color: context.tokens.shadcn.mutedForeground),
          ),
          const SizedBox(height: 16),
          Text(tr('singlepostview_not_found_title', 'Paylaşım tapılmadı'), textAlign: TextAlign.center, style: aListTitle(context)),
          const SizedBox(height: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 280),
            child: Text(
              tr('singlepostview_not_found_subtitle', 'Bu paylaşım silinmiş ola bilər, ya da onu görmək üçün icazəniz yoxdur.'),
              textAlign: TextAlign.center,
              style: aListSub(context).copyWith(height: 1.5),
            ),
          ),
        ]),
      );
    } else if (post['moderation_removed_at'] != null) {
      body = ACard(
        child: VGap(gap: 12, children: [
          Text(moderatorText('removed_marker'), style: px(16, weight: FontWeight.w700, color: a.ink)),
          Text(moderatorText('removed_body'), style: px(14, color: a.ink)),
          Text(moderatorReason(post['moderation_reason'] as String?), style: px(14, weight: FontWeight.w500, color: a.ink)),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: AButton(
              variant: AButtonVariant.pillSoft,
              onPressed: () => ref.read(shellProvider.notifier).dispatchPushEvent(const PushNavIntent(screen: 'moderation-history')),
              child: Text(moderatorText('appeal')),
            ),
          ),
        ]),
      );
    } else if (isHeldPost(post['ad_moderation_state'] as String?)) {
      body = MyModeratedPosts(postId: '${post['id']}', onRemoved: onBack);
    } else {
      body = PostSeenObserver(
        postId: '${post['id']}',
        createdAt: '${post['created_at']}',
        postUserId: post['user_id'] as String?,
        child: PostCard(post: post, groupId: post['group_id'] as String?, onUserClick: onUserClick, forceShowComments: true, highlightCommentId: commentId),
      );
    }
    return SliverMainAxisGroup(slivers: [
      PinnedHeaderSliver(
        child: ColoredBox(
          color: context.tokens.shadcn.background,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              CommunityButton(
                label: tr('common_geri', 'Geri'),
                tapScale: 0.9,
                onTap: onBack,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(color: context.tokens.shadcn.muted.withValues(alpha: 0.4), shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: AIcon(AIcons.arrowLeft, size: 16, color: context.tokens.shadcn.foreground, mirrorInRtl: true),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(tr('singlepostview_title', 'Paylaşım'),
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: px(16, weight: FontWeight.w900, color: context.tokens.shadcn.foreground, height: 1.25)),
              ),
            ]),
          ),
        ),
      ),
      SliverPadding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 96), sliver: SliverToBoxAdapter(child: body)),
    ]);
  }
}
