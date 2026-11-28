// Ported from: src/components/community/{CommunityPostFeed,PostSeenObserver,PostSearchFilter,MyModeratedPosts}.tsx
//
// The feed is a sliver: the shell's single scroll view builds the cards lazily (the WebView's windowing with measured
// spacers is what SliverList does natively). Building the last card pulls the next page, like the bottom sentinel.
// A card counts as seen after >= 50 % of it was on screen for 600 ms.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../core/offline/connectivity.dart' show onlineStatusProvider;
import '../../../design/design.dart';
import '../copy/community_copy.dart';
import '../data/community.dart';
import '../data/community_env.dart';
import '../data/community_moderation.dart';
import '../data/community_social.dart';
import '../data/unread_community_posts.dart';
import 'comment_reply.dart' show communityConfirm;
import 'community_widgets.dart';
import 'post_card.dart';
import 'text_area.dart';

/// `useOnlineStatus()`.
final communityOnlineProvider = Provider<bool>((ref) => ref.watch(onlineStatusProvider));

/// `<PostSearchFilter sortBy onSortChange />` (search was removed; only the feed sections remain).
class PostSearchFilter extends StatelessWidget {
  const PostSearchFilter({super.key, required this.sortBy, required this.onSortChange});
  final CommunityFeedView sortBy;
  final ValueChanged<CommunityFeedView> onSortChange;

  @override
  Widget build(BuildContext context) {
    final options = [
      (CommunityFeedView.recent, tr('postsearchfilter_en_son_473654', 'Ən son')),
      (CommunityFeedView.popular, tr('postsearchfilter_populyar', 'Populyar')),
      (CommunityFeedView.mine, tr('community_my_posts', 'Mənim postlarım')),
      (CommunityFeedView.following, tr('community_following', 'İzlədiklərim')),
      (CommunityFeedView.saved, tr('community_saved', 'Saxlanmışlar')),
    ];
    return CommunityFeedTabs(
      semanticLabel: tr('community_feed_filters', 'Paylaşım bölmələri'),
      children: [for (final (id, label) in options) CommunityTabChip(label: label, active: sortBy == id, onTap: () => onSortChange(id))],
    );
  }
}

/// `<PostSeenObserver postId createdAt postUserId>`: the unread dot and the 600 ms / 50 % seen marker.
class PostSeenObserver extends ConsumerStatefulWidget {
  const PostSeenObserver({super.key, required this.postId, required this.createdAt, this.postUserId, required this.child});
  final String postId;
  final String createdAt;
  final String? postUserId;
  final Widget child;

  @override
  ConsumerState<PostSeenObserver> createState() => _PostSeenObserverState();
}

class _PostSeenObserverState extends ConsumerState<PostSeenObserver> {
  bool _marked = false;
  Timer? _timer;
  ScrollPosition? _position;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (!identical(position, _position)) {
      _position?.removeListener(_check);
      _position = position;
      _position?.addListener(_check);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _position?.removeListener(_check);
    super.dispose();
  }

  bool get _effectivelyMarked => _marked || ref.read(postSeenFlagProvider(widget.postId));

  /// The visible fraction of this card inside the nearest scroll viewport (or the screen).
  double _ratio() {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached || box.size.height == 0) return 0;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    Rect viewport = Offset.zero & MediaQuery.sizeOf(context);
    final scrollBox = Scrollable.maybeOf(context)?.context.findRenderObject();
    if (scrollBox is RenderBox && scrollBox.hasSize && scrollBox.attached) viewport = scrollBox.localToGlobal(Offset.zero) & scrollBox.size;
    final visible = rect.intersect(viewport);
    if (visible.isEmpty || visible.height <= 0 || visible.width <= 0) return 0;
    return visible.height / rect.height;
  }

  void _check() {
    if (!mounted) return;
    final userId = ref.read(authUserProvider)?.id;
    if (_effectivelyMarked || userId == null) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    if (_ratio() >= 0.5) {
      _timer ??= Timer(const Duration(milliseconds: 600), () {
        if (!mounted) return;
        setState(() => _marked = true);
        unawaited(ref.read(unreadCommunityStoreProvider.notifier).markPostSeen(userId: userId, postId: widget.postId, postUserId: widget.postUserId));
        _position?.removeListener(_check);
      });
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider)?.id;
    final seen = ref.watch(postSeenFlagProvider(widget.postId));
    final unread = ref.watch(postUnreadFlagProvider((postId: widget.postId, postUserId: widget.postUserId)));
    final own = widget.postUserId != null && widget.postUserId == userId;
    final isUnread = !own && !(_marked || seen) && unread;
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (_) {
        _check();
        return false;
      },
      child: Stack(children: [
        widget.child,
        if (isUnread)
          PositionedDirectional(
            top: 12,
            end: 12,
            child: Semantics(
              label: tr('postseenobserver_oxunmamis_post_42ef5b', 'Oxunmamış post'),
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444), // bg-red-500
                  shape: BoxShape.circle,
                  border: Border.all(color: context.tokens.shadcn.background, width: 2),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

/// `<CommunityPostFeed view groupId authorId search onUserClick onCreatePost onExplore />` as a sliver.
class CommunityPostFeed extends ConsumerStatefulWidget {
  const CommunityPostFeed({super.key, required this.view, this.groupId, this.authorId, this.search = '', this.onUserClick, this.onCreatePost, this.onExplore});
  final CommunityFeedView view;
  final String? groupId;
  final String? authorId;
  final String search;
  final void Function(String userId)? onUserClick;
  final VoidCallback? onCreatePost;
  final VoidCallback? onExplore;

  @override
  ConsumerState<CommunityPostFeed> createState() => _CommunityPostFeedState();
}

class _CommunityPostFeedState extends ConsumerState<CommunityPostFeed> {
  bool _hasModerated = false;

  FeedArgs get _args => FeedArgs(widget.view, groupId: widget.groupId, authorId: widget.authorId, search: widget.search);

  void _more() {
    final notifier = ref.read(communityFeedQuery(_args).notifier);
    final feed = ref.read(communityFeedProvider(_args));
    if (feed.hasNextPage && !feed.query.isFetching) unawaited(notifier.fetchNextPage());
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final feed = ref.watch(communityFeedProvider(_args));
    final online = ref.watch(communityOnlineProvider);
    final query = feed.query;
    final view = widget.view;
    final search = widget.search;
    final offlineWithoutPosts = query.isPending && (query.isPaused || !online);
    final emptyIcon = view == CommunityFeedView.saved ? AIcons.bookmark : view == CommunityFeedView.following ? AIcons.users : AIcons.messageCircle;
    final emptyTitle = search.isNotEmpty
        ? tr('groupfeed_netice_tapilmadi_4b1b52', 'Nəticə tapılmadı')
        : view == CommunityFeedView.saved
            ? tr('community_saved_empty', 'Hələ saxlanmış paylaşım yoxdur')
            : view == CommunityFeedView.following
                ? tr('community_following_empty', 'İzlədiklərinizdən paylaşım yoxdur')
                : view == CommunityFeedView.mine
                    ? tr('community_mine_empty', 'İlk paylaşımınızı yaradın')
                    : tr('groupfeed_hele_paylasim_yoxdur_a0a7fa', 'Hələ paylaşım yoxdur');
    final emptyText = search.isNotEmpty
        ? tr('groupfeed_basqa_axtaris_sozleri_sinayin_20e63c', 'Başqa axtarış sözləri sınayın')
        : view == CommunityFeedView.saved
            ? tr('community_saved_hint', 'Sonra oxumaq üçün paylaşımın yadda saxlama ikonuna toxunun.')
            : view == CommunityFeedView.following
                ? tr('community_following_hint', 'İstifadəçiləri izləyin; onların açıq paylaşımları burada görünəcək.')
                : tr('community_empty_hint', 'Sualınızı və təcrübənizi Cəmiyyətlə paylaşın.');
    Widget retry() => AButton(
          variant: AButtonVariant.pillSoft,
          onPressed: () => unawaited(ref.read(communityFeedQuery(_args).notifier).refetch()),
          leading: const AIcon(AIcons.refreshCw, size: 15),
          child: Text(tr('community_retry', 'Yenidən yoxla')),
        );

    final head = <Widget>[
      if (view == CommunityFeedView.mine) MyModeratedPosts(onPresenceChange: (present) => setState(() => _hasModerated = present)),
      if (query.isError)
        Semantics(
          liveRegion: true,
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.'), style: px(14, color: a.ink)),
              const SizedBox(height: 12),
              retry(),
            ]),
          ),
        ),
      if (offlineWithoutPosts)
        ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
          child: Column(children: [
            AIcon(AIcons.wifiOff, size: 28, color: a.inkSoft),
            const SizedBox(height: 12),
            Text(tr('community_offline_title', 'İnternet bağlantısı yoxdur'), textAlign: TextAlign.center, style: px(16, weight: FontWeight.w700, color: a.ink)),
            const SizedBox(height: 8),
            Text(tr('community_offline_hint', 'Bağlantı bərpa olunanda paylaşımlar yüklənəcək.'), textAlign: TextAlign.center, style: px(14, color: a.inkSoft, height: 1.625)),
            const SizedBox(height: 16),
            retry(),
          ]),
        )
      else if (query.isPending)
        Semantics(
          label: tr('community_loading', 'Yüklənir'),
          child: const VGap(gap: 16, children: [ASkeleton(height: 160), ASkeleton(height: 160), ASkeleton(height: 160)]),
        )
      else if (!query.isError && feed.posts.isEmpty && !(view == CommunityFeedView.mine && _hasModerated))
        ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
          child: Column(children: [
            AIcon(emptyIcon, size: 32, color: a.accentInk),
            const SizedBox(height: 16),
            Text(emptyTitle, textAlign: TextAlign.center, style: px(16, weight: FontWeight.w700, color: a.ink)),
            const SizedBox(height: 8),
            Text(emptyText, textAlign: TextAlign.center, style: px(14, color: a.inkSoft, height: 1.625)),
            if (search.isEmpty && (view == CommunityFeedView.saved || view == CommunityFeedView.following) && widget.onExplore != null) ...[
              const SizedBox(height: 16),
              AButton(variant: AButtonVariant.pillSoft, onPressed: widget.onExplore, child: Text(tr('community_explore', 'Cəmiyyəti kəşf et'))),
            ],
            if (search.isEmpty && view != CommunityFeedView.saved && view != CommunityFeedView.following && widget.onCreatePost != null) ...[
              const SizedBox(height: 16),
              AButton(
                variant: AButtonVariant.cta,
                onPressed: widget.onCreatePost,
                leading: const AIcon(AIcons.plus, size: 16),
                child: Text(tr('groupfeed_paylasim_yarat_69bdcd', 'Paylaşım yarat')),
              ),
            ],
          ]),
        ),
      if (feed.newPostsCount > 0)
        AButton(
          variant: AButtonVariant.pillSoft,
          block: true,
          onPressed: () => ref.read(communityFeedLiveProvider(_args).notifier).showNewPosts(),
          leading: const AIcon(AIcons.arrowUp, size: 15),
          child: Text('${feed.newPostsCount > 99 ? '99+' : feed.newPostsCount} · ${tr('createpostscreen_yeni_paylasim_4f5b15', 'Yeni Paylaşım')}'),
        ),
    ];
    final posts = feed.posts;
    return SliverMainAxisGroup(slivers: [
      for (final w in head) SliverPadding(padding: const EdgeInsets.only(bottom: 16), sliver: SliverToBoxAdapter(child: w)),
      // The 1px top sentinel and the `space-y-4` gap after it always precede the cards.
      if (posts.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 17)),
      SliverList.builder(
        itemCount: posts.length,
        itemBuilder: (context, index) {
          if (index == posts.length - 1) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _more() : null);
          final post = posts[index];
          return Padding(
            key: ValueKey('post-${post['id']}'),
            padding: const EdgeInsets.only(bottom: 16),
            child: PostSeenObserver(
              postId: '${post['id']}',
              createdAt: '${post['created_at']}',
              postUserId: post['user_id'] as String?,
              child: PostCard(post: post, groupId: post['group_id'] as String?, onUserClick: widget.onUserClick),
            ),
          );
        },
      ),
      if (feed.hasNextPage)
        SliverToBoxAdapter(
          child: AButton(
            variant: AButtonVariant.pillSoft,
            block: true,
            onPressed: query.isFetching ? null : () => unawaited(ref.read(communityFeedQuery(_args).notifier).fetchNextPage()),
            child: Text(query.isFetching ? tr('community_loading', 'Yüklənir') : tr('community_load_more', 'Daha çox göstər')),
          ),
        ),
    ]);
  }
}

/// `<MyModeratedPosts postId onRemoved onPresenceChange />`: the author's own held posts.
class MyModeratedPosts extends ConsumerStatefulWidget {
  const MyModeratedPosts({super.key, this.postId, this.onRemoved, this.onPresenceChange});
  final String? postId;
  final VoidCallback? onRemoved;
  final ValueChanged<bool>? onPresenceChange;
  @override
  ConsumerState<MyModeratedPosts> createState() => _MyModeratedPostsState();
}

class _MyModeratedPostsState extends ConsumerState<MyModeratedPosts> {
  int _page = 0;
  final AdReviewsWatcher _watcher = AdReviewsWatcher();
  bool? _present;

  AdReviewsArgs get _args => AdReviewsArgs(postId: widget.postId, page: _page);

  @override
  Widget build(BuildContext context) {
    final language = currentLanguage();
    String t(String key) => moderationText(key, language);
    ref.listen(myAdReviewsQuery(_args), (_, next) {
      _watcher.update(ref.read(queryClientProvider),
          actor: ref.read(authUserProvider)?.id, backend: ref.read(communityBackendUrlProvider), postId: widget.postId, data: next.data);
    });
    final q = ref.watch(myAdReviewsQuery(_args));
    final present = (q.data ?? const []).isNotEmpty;
    if (present != _present) {
      _present = present;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onPresenceChange?.call(present));
    }
    final a = context.a;
    if (q.isError) {
      return Semantics(
        liveRegion: true,
        child: ACard(
          child: VGap(gap: 12, children: [
            Text(moderationError(q.error, language), style: px(14, color: a.ink)),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: () => unawaited(ref.read(myAdReviewsQuery(_args).notifier).refetch()),
                leading: const AIcon(AIcons.refreshCw, size: 15),
                child: Text(t('refresh')),
              ),
            ),
          ]),
        ),
      );
    }
    if (q.isPending) {
      if (widget.postId == null) return const SizedBox.shrink();
      return ACard(child: Row(children: [const ALoader(size: 18), const SizedBox(width: 8), Text(t('loading'))]));
    }
    final data = q.data ?? const [];
    if (data.isEmpty && _page == 0) return const SizedBox.shrink();
    return Semantics(
      label: t('my_reviews'),
      container: true,
      child: VGap(gap: 12, children: [
        if (widget.postId == null)
          Row(children: [
            AIcon(AIcons.shieldCheck, size: 18, color: a.ink),
            const SizedBox(width: 8),
            Text(t('my_reviews'), style: px(14, weight: FontWeight.w700, color: a.ink)),
          ]),
        for (final review in data)
          _ReviewCard(
            key: ValueKey('${review['id']}:${review['state']}'),
            review: review,
            onRemoved: () {
              unawaited(ref.read(myAdReviewsQuery(_args).notifier).refetch());
              widget.onRemoved?.call();
            },
          ),
        if (widget.postId == null && (_page > 0 || data.length == 30))
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            AButton(variant: AButtonVariant.pillSoft, onPressed: _page == 0 ? null : () => setState(() => _page--), child: Text(t('previous'))),
            AButton(variant: AButtonVariant.pillSoft, onPressed: data.length != 30 ? null : () => setState(() => _page++), child: Text(t('next'))),
          ]),
      ]),
    );
  }
}

class _ReviewCard extends ConsumerStatefulWidget {
  const _ReviewCard({super.key, required this.review, this.onRemoved});
  final OwnAdReview review;
  final VoidCallback? onRemoved;
  @override
  ConsumerState<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends ConsumerState<_ReviewCard> {
  bool _editing = false;
  late final TextEditingController _content = TextEditingController(text: '${widget.review['content'] ?? ''}');

  @override
  void initState() {
    super.initState();
    _content.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _content.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = currentLanguage();
    String t(String key) => moderationText(key, language);
    final r = widget.review;
    final state = r['state'];
    final prefix = state == 'checking'
        ? 'checking'
        : state == 'rejected'
            ? 'rejected'
            : state == 'approved'
                ? 'approved'
                : r['technical'] == true
                    ? 'technical'
                    : 'review';
    final edit = ref.watch(editPostMutation);
    final remove = ref.watch(deletePostMutation);
    final pending = edit.isPending || remove.isPending;
    final original = '${r['content'] ?? ''}';
    final muted = context.tokens.shadcn.mutedForeground;
    final mediaCount = r['media_urls'] is List ? (r['media_urls'] as List).length : 0;
    return Semantics(
      identifier: 'own-moderated-post',
      container: true,
      child: ACard(
        child: VGap(gap: 12, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AIcon(AIcons.shieldCheck, size: 22, color: context.tokens.shadcn.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('${prefix}_title'), style: px(14, weight: FontWeight.w700, color: a.ink, height: 1.625)),
                const SizedBox(height: 4),
                Text(t('${prefix}_body'), style: px(14, color: muted, height: 1.625)),
              ]),
            ),
          ]),
          if ((r['decision_reason'] ?? '') != '')
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: context.tokens.shadcn.muted, borderRadius: BorderRadius.circular(12)),
              child: Text.rich(TextSpan(children: [
                TextSpan(text: '${t('reason')}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: moderationReason(r['decision_reason'] as String?, language)),
              ]), style: px(14, color: a.ink)),
            ),
          if (_editing)
            VGap(gap: 8, children: [
              CommunityTextArea(controller: _content, minHeight: 128, minLines: 5, maxLines: 12, radius: 12, maxLength: 20000, semanticLabel: t('content')),
              Wrap(spacing: 8, runSpacing: 8, children: [
                AButton(
                  variant: AButtonVariant.pillSoft,
                  onPressed: pending || _content.text.trim().isEmpty || _content.text == original
                      ? null
                      : () => ref.read(editPostMutation.notifier).mutate(
                            EditPostVars(
                              postId: '${r['post_id']}',
                              content: _content.text.trim(),
                              currentLanguage: r['language'] as String?,
                              expectedRevision: (r['revision'] as num?)?.toInt(),
                            ),
                            onSuccess: (_, _, _) {
                              if (mounted) setState(() => _editing = false);
                            },
                          ),
                  leading: edit.isPending ? const ALoader(size: 15) : null,
                  child: Text(t('edit')),
                ),
                AButton(variant: AButtonVariant.pillSoft, onPressed: pending ? null : () => setState(() => _editing = false), child: Text(t('cancel'))),
              ]),
            ])
          else
            Text(original, style: px(14, color: a.ink, height: 1.625)),
          if (mediaCount > 0) Text('${t('media')}: $mediaCount', style: px(12, color: muted)),
          if (!_editing && state != 'approved')
            Wrap(spacing: 8, runSpacing: 8, children: [
              AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: pending
                    ? null
                    : () => setState(() {
                          _content.text = original;
                          _editing = true;
                        }),
                leading: const AIcon(AIcons.pencil, size: 15),
                child: Text(t('edit')),
              ),
              AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: pending
                    ? null
                    : () async {
                        if (!await communityConfirm(context, t('withdraw_confirm'))) return;
                        ref.read(deletePostMutation.notifier).mutate('${r['post_id']}', onSuccess: (_, _, _) => widget.onRemoved?.call());
                      },
                leading: const AIcon(AIcons.trash2, size: 15),
                child: Text(t('withdraw')),
              ),
            ]),
          if (state != 'approved')
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AIcon(AIcons.clock3, size: 14, color: muted),
              const SizedBox(width: 8),
              Expanded(child: Text(t('private_status'), style: px(12, color: muted, height: 1.625))),
            ]),
        ]),
      ),
    );
  }
}
