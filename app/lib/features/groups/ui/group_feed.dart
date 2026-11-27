// Ported from: src/components/community/GroupFeed.tsx (the stand-alone group page: sticky header, presence bar,
//              the group's stories, feed sections), src/components/community/GroupPresenceBar.tsx
//
// React only mounts GroupFeed embedded with `group={null}` (CommunityScreen; ported in the community feature). The
// stand-alone page below is ported for parity but nothing opens it in React either.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../chat/ui/chat_widgets.dart' show ChatAvatar, charAt0;
import '../../community/community_slots.dart' show communityStoriesBarProvider;
import '../../community/data/community_social.dart' show CommunityFeedView;
import '../../community/ui/community_post_feed.dart' show CommunityPostFeed, PostSearchFilter;
import '../../settings/ui/settings_ui.dart' show px;
import '../data/group_presence.dart';

/// `<GroupFeed group onBack onCreatePost onUserClick view onViewChange />` (not embedded) as slivers.
class GroupFeed extends ConsumerStatefulWidget {
  const GroupFeed({super.key, required this.group, required this.onBack, required this.onCreatePost, this.onUserClick, this.view, this.onViewChange});

  /// A `community_groups` row (`id`, `name`, `icon_emoji`, `member_count`) or null.
  final Map<String, dynamic>? group;
  final VoidCallback onBack;
  final VoidCallback onCreatePost;
  final void Function(String userId)? onUserClick;
  final CommunityFeedView? view;
  final ValueChanged<CommunityFeedView>? onViewChange;

  @override
  ConsumerState<GroupFeed> createState() => _GroupFeedState();
}

class _GroupFeedState extends ConsumerState<GroupFeed> {
  CommunityFeedView _localSort = CommunityFeedView.recent;

  void _setSort(CommunityFeedView next) {
    setState(() => _localSort = next);
    widget.onViewChange?.call(next);
  }

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final groupId = group?['id'] as String?;
    final presence = ref.watch(groupPresenceProvider(groupId));
    final sortBy = widget.view ?? _localSort;
    final s = context.tokens.shadcn;
    final name = group?['name'] as String?;
    final emoji = group?['icon_emoji'] is String && (group!['icon_emoji'] as String).isNotEmpty ? group['icon_emoji'] as String : '👥';
    return SliverMainAxisGroup(slivers: [
      PinnedHeaderSliver(
        child: ColoredBox(
          color: s.background,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(children: [
                PressScale(
                  scale: 0.9,
                  onTap: widget.onBack,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.4), shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: AIcon(AIcons.arrowLeft, size: 16, color: s.foreground, mirrorInRtl: true),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [s.primary.withValues(alpha: 0.1), s.accent.withValues(alpha: 0.08)]),
                  ),
                  alignment: Alignment.center,
                  child: Text(emoji, style: const TextStyle(fontSize: 18, height: 1)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      name != null && name.isNotEmpty ? tr('group_name_${name.replaceAll(RegExp(r'\s+'), '_').toLowerCase()}', name) : tr('groupfeed_umumi_1b5521', 'Ümumi'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: px(16, weight: FontWeight.w900, color: s.foreground, height: 1.25),
                    ),
                    Row(children: [
                      AIcon(AIcons.users, size: 12, color: s.mutedForeground.withValues(alpha: 0.4)),
                      const SizedBox(width: 4),
                      Text('${group?['member_count'] ?? 0} ${tr('groupfeed_uzv_3f0dbc', 'üzv')}',
                          style: px(10, weight: FontWeight.w500, color: s.mutedForeground.withValues(alpha: 0.4))),
                    ]),
                  ]),
                ),
                PressScale(
                  onTap: widget.onCreatePost,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: context.a.gradPeach,
                      boxShadow: [BoxShadow(color: s.primary.withValues(alpha: 0.2), blurRadius: 2, offset: const Offset(0, 1))],
                    ),
                    alignment: Alignment.center,
                    child: AIcon(AIcons.plus, size: 16, color: s.primaryForeground),
                  ),
                ),
              ]),
            ),
            if (group != null) GroupPresenceBar(state: presence),
            if (group != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                child: ref.watch(communityStoriesBarProvider)(context, groupId: groupId),
              ),
          ]),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        sliver: SliverToBoxAdapter(child: PostSearchFilter(sortBy: sortBy, onSortChange: _setSort)),
      ),
      SliverPadding(
        padding: const EdgeInsets.only(top: 4, bottom: 96),
        sliver: CommunityPostFeed(
          key: ValueKey('group-feed:$groupId:${sortBy.id}'),
          view: sortBy,
          groupId: groupId,
          onUserClick: widget.onUserClick,
          onCreatePost: widget.onCreatePost,
          onExplore: () => _setSort(CommunityFeedView.recent),
        ),
      ),
    ]);
  }
}

/// `<GroupPresenceBar onlineCount onlineUsers typingUsers />`.
class GroupPresenceBar extends StatelessWidget {
  const GroupPresenceBar({super.key, required this.state});
  final GroupPresenceState state;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final faint = s.mutedForeground.withValues(alpha: 0.4);
    const green = Color(0xFF22C55E); // green-500
    final users = state.onlineUsers;
    final typing = state.typingUsers;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Row(children: [
        Container(width: 8, height: 8, decoration: const BoxDecoration(color: green, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text('${state.onlineCount} online', style: px(10, weight: FontWeight.w700, color: faint)),
        if (users.isNotEmpty) ...[
          const SizedBox(width: 8),
          SizedBox(
            height: 20,
            width: 20.0 + (users.length.clamp(1, 4) - 1) * 14 + (users.length > 4 ? 14 : 0),
            child: Stack(children: [
              for (var i = 0; i < users.length && i < 4; i++)
                PositionedDirectional(
                  start: i * 14.0,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: Duration(milliseconds: 300 + i * 50),
                    builder: (context, v, child) => Transform.scale(scale: v, child: child),
                    child: ChatAvatar(
                      size: 20,
                      url: users[i].avatarUrl,
                      border: Border.all(color: s.background, width: 1.5),
                      fallbackColor: s.primary.withValues(alpha: 0.1),
                      fallback: Text(charAt0(users[i].name), style: px(8, weight: FontWeight.w700, color: s.primary, height: 1)),
                    ),
                  ),
                ),
              if (users.length > 4)
                PositionedDirectional(
                  start: 4 * 14.0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.5), shape: BoxShape.circle, border: Border.all(color: s.background, width: 1.5)),
                    alignment: Alignment.center,
                    child: Text('+${users.length - 4}', style: px(8, weight: FontWeight.w700, color: s.mutedForeground.withValues(alpha: 0.6), height: 1)),
                  ),
                ),
            ]),
          ),
        ],
        if (typing.isNotEmpty) ...[
          const SizedBox(width: 12),
          Expanded(
            child: Row(children: [
              const _TypingDots(),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  typing.length == 1 ? '${typing.first.name} ${tr('community_is_typing', 'yazır...')}' : '${typing.length} ${tr('community_people_are_typing', 'nəfər yazır...')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: px(10, weight: FontWeight.w500, color: faint),
                ),
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}

/// `anacan-typing-dot` (scale 1 → 1.3 → 1, 0.6 s, delays 0 / .15 / .3 s).
class _TypingDots extends StatefulWidget {
  const _TypingDots();
  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = context.tokens.shadcn.primary.withValues(alpha: 0.6);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Row(mainAxisSize: MainAxisSize.min, children: [
        for (final (i, delay) in const [0.0, 0.25, 0.5].indexed) ...[
          if (i > 0) const SizedBox(width: 3),
          Transform.scale(
            scale: 1 + 0.3 * Curves.easeInOut.transform(1 - ((_c.value - delay) % 1 * 2 - 1).abs()),
            child: Container(width: 4, height: 4, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ),
        ],
      ]),
    );
  }
}
