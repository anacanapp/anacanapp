// Ported from: src/components/community/{UserProfileScreen,FollowButton,CommunityConnections}.tsx
//
// A community profile: card (avatar, name, tick, badges, life stage, joined), stats (posts / followers /
// following), follow / message actions or "create post" for the own profile, and the posts / stories / saved tabs.
// The stories tab (useStories + StoryViewer) belongs to the stories port: [communityProfileStoriesProvider].
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ShadDialogFrame, showShadDialog, shadTitle, shadDescription;
import '../copy/community_copy.dart';
import '../data/community_backend.dart';
import '../data/community_env.dart';
import '../data/community_social.dart';
import 'community_post_feed.dart';
import 'community_widgets.dart';
import 'post_card.dart' show lifeStageMeta;
import 'user_badge.dart';

/// `['community-profile-card', viewer, userId]` → `getPublicProfileCard(userId)`.
final communityProfileCardQuery = queryProviderFamily<CRow?, String>((ref, userId) {
  final viewer = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  return QueryOptions<CRow?>(
    queryKey: ['community-profile-card', viewer, userId],
    enabled: userId.isNotEmpty,
    staleTime: const Duration(seconds: 10),
    queryFn: (_) => getPublicProfileCard(backend, userId),
  );
}, name: 'communityProfileCardQuery');

/// The stories tab of a profile (`useStories(null)` + the story grid + StoryViewer). Default: the empty state.
typedef ProfileStoriesBuilder = Widget Function(BuildContext context, String userId);

final communityProfileStoriesProvider = Provider<ProfileStoriesBuilder>((ref) => (context, userId) => const ProfileStoriesEmpty());

/// "Aktiv hekayə yoxdur".
class ProfileStoriesEmpty extends StatelessWidget {
  const ProfileStoriesEmpty({super.key});
  @override
  Widget build(BuildContext context) => ACard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
        child: Column(children: [
          AIcon(AIcons.film, size: 28, color: context.a.ink),
          const SizedBox(height: 12),
          Text(tr('community_stories_empty', 'Aktiv hekayə yoxdur'), style: px(14, color: context.a.ink)),
        ]),
      );
}

/// `<FollowButton userId isFollowing loading />`.
class FollowButton extends ConsumerWidget {
  const FollowButton({super.key, required this.userId, required this.isFollowing, this.loading = false, this.compact = false});
  final String userId;
  final bool isFollowing;
  final bool loading;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authUserProvider);
    final follow = ref.watch(communityFollowProvider(userId));
    if (user == null || user.id == userId) return const SizedBox.shrink();
    final color = isFollowing ? context.a.accentInk : const Color(0xFFFFFFFF);
    return Semantics(
      selected: isFollowing,
      child: AButton(
        variant: isFollowing ? AButtonVariant.pillSoft : AButtonVariant.pillSolid,
        onPressed: loading || follow.isPending
            ? null
            : () {
                ref.read(communityHapticsProvider).light();
                follow.setFollowing(!isFollowing);
              },
        leading: follow.isPending ? ALoader(size: 16, color: color) : AIcon(isFollowing ? AIcons.userMinus : AIcons.userPlus, size: 16, color: color),
        child: Text(isFollowing ? tr('community_unfollow', 'İzləmədən çıx') : tr('community_follow', 'İzlə')),
      ),
    );
  }
}

/// `<CommunityConnections userId direction onClose onUserClick />` (followers / following dialog).
Future<void> showCommunityConnections(BuildContext context, {required String userId, required ConnectionDirection direction, required void Function(String) onUserClick}) =>
    showShadDialog<void>(
      context,
      builder: (ctx) => CommunityConnections(userId: userId, direction: direction, onClose: () => Navigator.of(ctx).pop(), onUserClick: onUserClick),
    );

class CommunityConnections extends ConsumerWidget {
  const CommunityConnections({super.key, required this.userId, required this.direction, required this.onClose, required this.onUserClick});
  final String userId;
  final ConnectionDirection direction;
  final VoidCallback onClose;
  final void Function(String userId) onUserClick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final args = (userId, direction);
    final q = ref.watch(communityConnectionsQuery(args));
    final notifier = ref.read(communityConnectionsQuery(args).notifier);
    final connections = [for (final p in q.data?.pages ?? const <ConnectionsPage>[]) ...p.connections];
    final hasNext = q.data?.pages.lastOrNull?.nextOffset != null;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.82;
    return AScope(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: ShadDialogFrame(radius: 24, maxWidth: 448, inset: 12, children: [
          Text(direction == ConnectionDirection.followers ? tr('community_followers', 'İzləyicilər') : tr('community_following_people', 'İzlədikləri'),
              style: shadTitle(context)),
          Text(tr('community_connections_hint', 'Profilə baxmaq üçün istifadəçinin adına toxunun.'), style: shadDescription(context)),
          Flexible(
            child: SingleChildScrollView(
              child: VGap(gap: 12, children: [
                if (q.isPending)
                  Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Text(tr('community_loading', 'Yüklənir'), textAlign: TextAlign.center, style: px(14))),
                if (q.isError)
                  Column(children: [
                    Text(tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.'), textAlign: TextAlign.center, style: px(14)),
                    const SizedBox(height: 12),
                    AButton(variant: AButtonVariant.pillSoft, onPressed: () => notifier.refetch(), child: Text(tr('community_retry', 'Yenidən yoxla'))),
                  ]),
                if (!q.isPending && !q.isError && connections.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Column(children: [
                      AIcon(AIcons.users, size: 28, color: a.ink),
                      const SizedBox(height: 12),
                      Text(tr('community_connections_empty', 'Hələ heç kim yoxdur'), style: px(14)),
                    ]),
                  ),
                for (final person in connections)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
                    child: Row(children: [
                      Expanded(
                        child: CommunityButton(
                          onTap: () {
                            onClose();
                            onUserClick('${person['user_id']}');
                          },
                          child: Row(children: [
                            CommunityAvatar(size: 40, url: person['avatar_url'] as String?, name: person['name'] as String?),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 4, children: [
                                  Text((person['name'] as String?)?.isNotEmpty == true ? person['name'] as String : tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi'),
                                      style: px(14, weight: FontWeight.w700, color: a.ink)),
                                  if (isVerifiedActive(person['is_verified'], person['verified_until'])) const VerifiedTick(size: 13),
                                ]),
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: UserBadge(type: person['badge_type'] as String?, premium: person['is_premium'] as bool?),
                                ),
                              ]),
                            ),
                          ]),
                        ),
                      ),
                      const SizedBox(width: 10),
                      FollowButton(userId: '${person['user_id']}', isFollowing: person['is_following'] == true, compact: true),
                    ]),
                  ),
                if (hasNext)
                  AButton(
                    variant: AButtonVariant.pillSoft,
                    block: true,
                    onPressed: q.isFetching ? null : () => notifier.fetchNextPage(),
                    child: Text(q.isFetching ? tr('community_loading', 'Yüklənir') : tr('community_load_more', 'Daha çox göstər')),
                  ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `<UserProfileScreen userId onBack onUserClick onSendMessage onEditProfile onCreatePost />` as slivers.
class UserProfileScreen extends ConsumerStatefulWidget {
  const UserProfileScreen({
    super.key,
    required this.userId,
    required this.onBack,
    required this.onUserClick,
    this.onSendMessage,
    this.onEditProfile,
    this.onCreatePost,
  });
  final String userId;
  final VoidCallback onBack;
  final void Function(String userId) onUserClick;
  final void Function(String userId, String name, String? avatar)? onSendMessage;
  final VoidCallback? onEditProfile;
  final VoidCallback? onCreatePost;

  @override
  ConsumerState<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends ConsumerState<UserProfileScreen> {
  String _tab = 'posts';

  @override
  void didUpdateWidget(UserProfileScreen old) {
    super.didUpdateWidget(old);
    if (old.userId != widget.userId) _tab = 'posts';
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final user = ref.watch(authUserProvider);
    final own = user?.id == widget.userId;
    final profileQuery = ref.watch(communityProfileCardQuery(widget.userId));
    final statsQuery = ref.watch(communityProfileStatsQuery(widget.userId));
    final profile = profileQuery.data;
    final stats = statsQuery.data;
    final stage = lifeStageMeta(context, profile?['life_stage'] as String?);
    final verified = isVerifiedActive(profile?['is_verified'], profile?['verified_until']);
    final name = (profile?['name'] as String?)?.isNotEmpty == true ? profile!['name'] as String : tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi');

    final header = ATopbar(
      onBack: widget.onBack,
      title: own ? tr('community_my_profile', 'Cəmiyyət profilim') : tr('untranslated_profil_v8b0sk', 'Profil'),
      titleSize: 18,
      actions: [
        if (own && widget.onEditProfile != null)
          AIconBtn(onTap: widget.onEditProfile, semanticLabel: tr('community_edit_profile', 'Profili redaktə et'), icon: const AIcon(AIcons.pencil, size: 18)),
      ],
    );

    final slivers = <Widget>[SliverToBoxAdapter(child: header)];
    if (profileQuery.isPending) {
      slivers.add(SliverToBoxAdapter(
        child: Semantics(
          label: tr('community_loading', 'Yüklənir'),
          child: const ACard(
            child: VGap(gap: 16, crossAxisAlignment: CrossAxisAlignment.start, children: [
              ASkeleton(height: 80, width: 80, circle: true),
              ASkeleton(height: 24, width: 160, radius: 6),
              ASkeleton(height: 80, radius: 6),
            ]),
          ),
        ),
      ));
    } else if (profile == null) {
      slivers.add(SliverToBoxAdapter(
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
          child: Column(children: [
            Text(profileQuery.isError ? tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.') : tr('community_profile_missing', 'İstifadəçi tapılmadı'),
                textAlign: TextAlign.center, style: px(15, color: a.ink)),
            if (profileQuery.isError) ...[
              const SizedBox(height: 12),
              AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: () => ref.read(communityProfileCardQuery(widget.userId).notifier).refetch(),
                child: Text(tr('community_retry', 'Yenidən yoxla')),
              ),
            ],
          ]),
        ),
      ));
    } else {
      final created = DateTime.tryParse('${profile['created_at'] ?? ''}');
      final likes = (stats?['likes_count'] as num?)?.toInt() ?? 0;
      Widget stat(String id, String label, Object? count, VoidCallback open) => Expanded(
            child: CommunityButton(
              label: '$label ${count ?? '—'}',
              onTap: open,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                child: Column(children: [
                  Text('${count ?? '—'}', style: px(22, weight: FontWeight.w800, color: a.ink, height: 1.2)),
                  const SizedBox(height: 3),
                  Text(label, textAlign: TextAlign.center, style: px(12, color: a.inkSoft, height: 1.3)),
                ]),
              ),
            ),
          );
      void connections(ConnectionDirection d) =>
          showCommunityConnections(context, userId: widget.userId, direction: d, onUserClick: widget.onUserClick);
      final card = ACard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CommunityAvatar(
              size: 80,
              url: profile['avatar_url'] as String?,
              name: profile['name'] as String?,
              fallbackColor: a.peach1,
              border: Border.all(color: a.peach1, width: 3),
              fallbackWidget: Text(charAt0(profile['name'] as String?).isEmpty ? 'A' : charAt0(profile['name'] as String?),
                  style: px(28, weight: FontWeight.w800, color: a.accentInk, height: 1)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 4, children: [
                  Text(name, style: px(20, weight: FontWeight.w800, color: a.ink, height: 1.4)),
                  if (verified) const VerifiedTick(size: 17),
                  UserBadge(type: profile['badge_type'] as String?, premium: profile['is_premium'] as bool?),
                ]),
                if (stage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(color: stage.bg, borderRadius: BorderRadius.circular(999)),
                      child: Text(stage.label, style: px(12, weight: FontWeight.w700, color: stage.ink, height: 1.3)),
                    ),
                  ),
                if (created != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('${formatDistanceToNowSuffix(created)} ${tr('userprofilescreen_qosuldu_78ba1a', 'qoşuldu')}', style: px(12, color: a.inkSoft)),
                  ),
              ]),
            ),
          ]),
          const SizedBox(height: 20),
          Row(children: [
            stat('posts', tr('userprofilescreen_postlar', 'Postlar'), stats?['posts_count'], () => setState(() => _tab = 'posts')),
            const SizedBox(width: 8),
            stat('followers', tr('community_followers', 'İzləyicilər'), stats?['followers_count'], () => connections(ConnectionDirection.followers)),
            const SizedBox(width: 8),
            stat('following', tr('community_following_people', 'İzlədikləri'), stats?['following_count'], () => connections(ConnectionDirection.following)),
          ]),
          if (statsQuery.isError)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(
                liveRegion: true,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.'), style: px(14, color: a.ink)),
                  const SizedBox(height: 8),
                  AButton(
                    variant: AButtonVariant.pillSoft,
                    onPressed: () => ref.read(communityProfileStatsQuery(widget.userId).notifier).refetch(),
                    child: Text(tr('community_retry', 'Yenidən yoxla')),
                  ),
                ]),
              ),
            ),
          if (likes > 0)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text('$likes ${tr('community_received_likes', 'bəyənmə')}', textAlign: TextAlign.center, style: px(12, color: a.inkSoft)),
            ),
          if (!own)
            Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Row(children: [
                Expanded(child: FollowButton(userId: widget.userId, isFollowing: stats?['is_following'] == true, loading: stats == null)),
                if (widget.onSendMessage != null) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: AButton(
                      variant: AButtonVariant.pillSoft,
                      onPressed: () => widget.onSendMessage!(widget.userId, name, profile['avatar_url'] as String?),
                      leading: AIcon(AIcons.messageCircle, size: 17, color: a.accentInk),
                      child: Text(tr('community_message', 'Mesaj yaz')),
                    ),
                  ),
                ],
              ]),
            ),
          if (own && widget.onCreatePost != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: AButton(
                variant: AButtonVariant.pillSolid,
                block: true,
                onPressed: widget.onCreatePost,
                leading: const AIcon(AIcons.plus, size: 17, color: Color(0xFFFFFFFF)),
                child: Text(tr('groupfeed_paylasim_yarat_69bdcd', 'Paylaşım yarat')),
              ),
            ),
        ]),
      );
      slivers.add(SliverToBoxAdapter(child: card));
      slivers.add(SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: 16),
          child: CommunityFeedTabs(semanticLabel: tr('community_profile_sections', 'Profil bölmələri'), children: [
            CommunityTabChip(
              icon: AIcons.grid3x3,
              label: own ? tr('community_my_posts', 'Mənim postlarım') : tr('userprofilescreen_postlar', 'Postlar'),
              active: _tab == 'posts',
              onTap: () => setState(() => _tab = 'posts'),
            ),
            CommunityTabChip(icon: AIcons.film, label: tr('community_stories', 'Hekayələr'), active: _tab == 'stories', onTap: () => setState(() => _tab = 'stories')),
            if (own) CommunityTabChip(icon: AIcons.bookmark, label: tr('community_saved', 'Saxlanmışlar'), active: _tab == 'saved', onTap: () => setState(() => _tab = 'saved')),
          ]),
        ),
      ));
      if (_tab == 'posts') {
        slivers.add(CommunityPostFeed(
          key: ValueKey('profile-${widget.userId}'),
          view: CommunityFeedView.profile,
          authorId: widget.userId,
          onUserClick: widget.onUserClick,
          onCreatePost: own ? widget.onCreatePost : null,
        ));
      }
      if (_tab == 'saved' && own) {
        slivers.add(CommunityPostFeed(key: const ValueKey('profile-saved'), view: CommunityFeedView.saved, onUserClick: widget.onUserClick, onExplore: widget.onBack));
      }
      if (_tab == 'stories') slivers.add(SliverToBoxAdapter(child: ref.watch(communityProfileStoriesProvider)(context, widget.userId)));
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
      sliver: SliverMainAxisGroup(slivers: slivers),
    );
  }
}

/// [UserProfileScreen] in its own scroll view (the shell's user-profile overlay scrolls itself).
class UserProfileScreenPage extends StatelessWidget {
  const UserProfileScreenPage({super.key, required this.screen});
  final UserProfileScreen screen;
  @override
  Widget build(BuildContext context) => CommunityScope(child: CustomScrollView(slivers: [screen]));
}
