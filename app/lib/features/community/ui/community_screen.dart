// Ported from: src/components/community/CommunityScreen.tsx, src/components/community/GroupFeed.tsx (the embedded
//              global feed: `group={null} isEmbedded`)
//
// The Community tab as slivers in the shell's scroll view. Nested screens replace the feed in this order (like the
// React early returns): community block → DM lookup spinner → DM → conversations → profile → composer → single post
// → group chat → feed. A deep-link target (push / notification / user-profile overlay) resets every nested screen,
// is applied once and then consumed; a DM target resolves the sender through its public card (never the push
// payload) and falls back to the conversation list.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/links/push_nav.dart' show CommunityDeepLinkTarget;
import '../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../../state/user_store.dart' show userStoreProvider;
import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../chat/copy/chat_copy.dart' show chatTr;
import '../../chat/dm/conversation_list_screen.dart';
import '../../chat/dm/direct_message_screen.dart';
import '../../chat/ui/chat_widgets.dart' show chatGroupScreenProvider;
import '../community_slots.dart';
import '../data/community_backend.dart';
import '../data/community_blog.dart';
import '../data/community_env.dart';
import '../data/community_social.dart';
import '../data/community_toasts.dart';
import 'community_post_feed.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper;
import 'community_widgets.dart';
import 'create_post_screen.dart';
import 'single_post_view.dart';
import 'user_profile_screen.dart';

/// The nested screens of CommunityScreen (test seam, like the vi.mock'ed children of the deep-link tests).
class CommunityScreenParts {
  const CommunityScreenParts({
    this.feed,
    this.profile,
    this.composer,
    this.post,
    this.conversations,
    this.dm,
  });

  /// `<GroupFeed group={null} isEmbedded onCreatePost onUserClick view onViewChange />` (a sliver).
  final Widget Function(BuildContext context, {required VoidCallback onCreatePost, required void Function(String) onUserClick})? feed;
  final Widget Function(BuildContext context, String userId, VoidCallback onBack)? profile;
  final Widget Function(BuildContext context, VoidCallback onBack)? composer;
  final Widget Function(BuildContext context, String postId, String? commentId, VoidCallback onBack)? post;
  final Widget Function(BuildContext context, VoidCallback onBack, void Function(String userId, String name, String? avatar) onOpenChat)? conversations;
  final Widget Function(BuildContext context, String userId, String name, String? avatar, VoidCallback onBack)? dm;
}

final communityScreenPartsProvider = Provider<CommunityScreenParts>((ref) => const CommunityScreenParts());

class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({super.key, this.onBack, this.onOpenNotifications, this.onEditProfile, this.deepLinkTarget, this.onDeepLinkConsumed});
  final VoidCallback? onBack;
  final VoidCallback? onOpenNotifications;
  final VoidCallback? onEditProfile;
  final CommunityDeepLinkTarget? deepLinkTarget;
  final VoidCallback? onDeepLinkConsumed;

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  String _activeTab = 'feed';
  String? _selectedGroupId;
  String? _openPostId;
  String? _openCommentId;
  String? _openStoryId;
  bool _showCreatePost = false;
  SharedBlog? _initialBlog;
  String? _selectedUserId;
  List<String> _profileTrail = const [];
  CommunityFeedView _feedView = CommunityFeedView.recent;
  String? _createReturnUserId;
  bool _showConversations = false;
  ({String userId, String name, String? avatar})? _dmChat;
  bool _resolvingDm = false;
  int _deepLinkKey = 0;
  void Function()? _cancelDmLookup;

  @override
  void initState() {
    super.initState();
    final target = widget.deepLinkTarget;
    if (target != null) _apply(target, initial: true);
  }

  @override
  void didUpdateWidget(CommunityScreen old) {
    super.didUpdateWidget(old);
    final target = widget.deepLinkTarget;
    if (target != null && !identical(target, old.deepLinkTarget)) _apply(target);
  }

  @override
  void dispose() {
    _cancelDmLookup?.call();
    super.dispose();
  }

  void _scrollToTop() {
    try {
      ref.read(scrollMemoryProvider).scrollToTop();
    } catch (_) {
      // No shell scroll container (standalone / tests).
    }
  }

  void _apply(CommunityDeepLinkTarget target, {bool initial = false}) {
    _cancelDmLookup?.call();
    _cancelDmLookup = null;
    _deepLinkKey++;
    _selectedGroupId = null;
    _selectedUserId = null;
    _profileTrail = const [];
    _feedView = CommunityFeedView.recent;
    _createReturnUserId = null;
    _showCreatePost = false;
    _initialBlog = null;
    _showConversations = false;
    _dmChat = null;
    _resolvingDm = false;
    _openPostId = null;
    _openCommentId = null;
    _openStoryId = null;
    _activeTab = 'feed';

    final blog = SharedBlog.tryParse(target.composeBlog);
    if (blog != null) {
      _initialBlog = blog;
      _showCreatePost = true;
    } else if (target.dmUserId != null || target.conversations == true) {
      _showConversations = true;
      final userId = target.dmUserId;
      if (userId != null && isUuid(userId)) {
        var cancelled = false;
        _cancelDmLookup = () => cancelled = true;
        _resolvingDm = true;
        final lower = userId.toLowerCase();
        unawaited(getPublicProfileCard(ref.read(communityBackendProvider), lower).then((card) {
          if (cancelled || !mounted || card?['user_id'] != lower) return;
          setState(() {
            _dmChat = (
              userId: '${card!['user_id']}',
              name: (card['name'] as String?)?.isNotEmpty == true ? card['name'] as String : chatTr('usedirectmessages_i_stifadeci_b6bdd6', 'İstifadəçi'),
              avatar: card['avatar_url'] as String?,
            );
            _showConversations = false;
          });
        }, onError: (Object _) {
          // An unavailable card leaves the conversations fallback visible.
        }).whenComplete(() {
          if (cancelled || !mounted) return;
          _cancelDmLookup = null;
          setState(() => _resolvingDm = false);
        }));
      }
    } else if (target.groupId != null && isUuid(target.groupId)) {
      _selectedGroupId = target.groupId;
      _activeTab = 'groups';
    } else if (target.userId != null && isUuid(target.userId)) {
      _selectedUserId = target.userId;
    } else if (target.postId != null && target.postId!.isNotEmpty) {
      _openPostId = target.postId;
      _openCommentId = (target.commentId ?? '').isEmpty ? null : target.commentId;
    } else if (target.storyId != null && target.storyId!.isNotEmpty) {
      _openStoryId = target.storyId;
    }
    if (!initial) setState(() {});
    final consumed = widget.onDeepLinkConsumed;
    if (consumed != null) scheduleMicrotask(consumed);
  }

  void _userClick(String userId) {
    setState(() {
      if (_selectedUserId != null && _selectedUserId != userId) _profileTrail = [..._profileTrail, _selectedUserId!];
      _selectedUserId = userId;
    });
    _scrollToTop();
  }

  void _profileBack() {
    setState(() {
      _selectedUserId = _profileTrail.isEmpty ? null : _profileTrail.last;
      _profileTrail = _profileTrail.isEmpty ? const [] : _profileTrail.sublist(0, _profileTrail.length - 1);
    });
    _scrollToTop();
  }

  void _openDm(String userId, String name, String? avatar) => setState(() {
        _dmChat = (userId: userId, name: name, avatar: avatar);
        _selectedUserId = null;
        _profileTrail = const [];
        _showConversations = false;
      });

  Widget _fill(Widget child) => SliverFillRemaining(hasScrollBody: true, child: child);

  @override
  Widget build(BuildContext context) {
    final parts = ref.watch(communityScreenPartsProvider);
    final block = ref.watch(activeBlockQuery).data;
    if (block != null) return SliverToBoxAdapter(child: _BlockedScreen(block: block));

    if (_resolvingDm) {
      return _fill(Semantics(
        liveRegion: true,
        label: 'status',
        child: ColoredBox(color: context.tokens.shadcn.background, child: Center(child: ARingSpinner(size: 32, width: 4, color: context.tokens.shadcn.primary))),
      ));
    }
    final dm = _dmChat;
    if (dm != null) {
      void back() => setState(() => _dmChat = null);
      return _fill(KeyedSubtree(
        key: ValueKey('dm-${dm.userId}'),
        child: parts.dm?.call(context, dm.userId, dm.name, dm.avatar, back) ??
            DirectMessageScreen(userId: dm.userId, userName: dm.name, userAvatar: dm.avatar, onBack: back),
      ));
    }
    if (_showConversations) {
      void back() => setState(() => _showConversations = false);
      return _fill(parts.conversations?.call(context, back, _openDm) ?? ConversationListScreen(onBack: back, onOpenChat: _openDm));
    }
    final selectedUser = _selectedUserId;
    if (selectedUser != null) {
      final custom = parts.profile?.call(context, selectedUser, _profileBack);
      if (custom != null) return SliverToBoxAdapter(child: custom);
      return UserProfileScreen(
        key: ValueKey('profile-$selectedUser'),
        userId: selectedUser,
        onBack: _profileBack,
        onUserClick: _userClick,
        onSendMessage: _openDm,
        onEditProfile: widget.onEditProfile,
        onCreatePost: () => setState(() {
          _createReturnUserId = selectedUser;
          _selectedUserId = null;
          _selectedGroupId = null;
          _showCreatePost = true;
        }),
      );
    }
    if (_showCreatePost) {
      void back() => setState(() {
            _showCreatePost = false;
            _initialBlog = null;
            _selectedUserId = _createReturnUserId;
            _createReturnUserId = null;
          });
      return SliverToBoxAdapter(
        child: parts.composer?.call(context, back) ?? CreatePostScreen(onBack: back, groupId: _selectedGroupId, initialBlog: _initialBlog),
      );
    }
    final postId = _openPostId;
    if (postId != null) {
      void back() => setState(() {
            _openPostId = null;
            _openCommentId = null;
          });
      final custom = parts.post?.call(context, postId, _openCommentId, back);
      if (custom != null) return SliverToBoxAdapter(child: custom);
      return SinglePostView(key: ValueKey('post-$postId'), postId: postId, commentId: _openCommentId, onBack: back, onUserClick: _userClick);
    }
    final groupId = _selectedGroupId;
    if (groupId != null) return _fill(ref.watch(chatGroupScreenProvider)(context, groupId, () => setState(() => _selectedGroupId = null)));

    return KeyedSubtree(key: ValueKey('community-$_deepLinkKey'), child: _feed(context, parts));
  }

  Widget _feed(BuildContext context, CommunityScreenParts parts) {
    final a = context.a;
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final own = profile != null && profile.userId == user?.id ? profile : null;
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final headerKey = 'community_header_${lifeStage ?? 'mommy'}';
    final dynamicHeader = ref.watch(appSettingProvider(headerKey));
    final headerText = dynamicHeader is String ? tr(headerKey, dynamicHeader) : chatTr('communityscreen_diger_analar_ile_elaqede_olun_4830a3', 'Digər analar ilə əlaqə olun');
    final notifications = ref.watch(communityNotificationsUnreadProvider);
    final dms = ref.watch(communityDmUnreadProvider);
    final banner = ref.watch(communityBannerProvider);
    final stories = ref.watch(communityStoriesBarProvider);

    Widget iconButton({required String label, required Widget icon, required VoidCallback onTap, String? badge}) => Stack(clipBehavior: Clip.none, children: [
          AIconBtn(onTap: onTap, semanticLabel: label, icon: icon),
          if (badge != null) CommunityCountBadge(badge),
        ]);

    final topbar = ATopbar(
      onBack: widget.onBack,
      backScale: 0.9,
      leading: Row(children: [
        if (widget.onBack != null) ...[
          AIconBtn(onTap: widget.onBack, icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
          const SizedBox(width: 10),
        ],
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(cssUpperText(headerText), maxLines: 1, overflow: TextOverflow.ellipsis, style: px(11, weight: FontWeight.w700, color: a.onBgSoft, ls: 0.1)),
            AWordmark(chatTr('communityscreen_cemiyyet_2dc44d', 'Cəmiyyət'), fontSize: 18),
          ]),
        ),
      ]),
      title: '',
      actions: [
        if (user != null)
          AIconBtn(
            onTap: () => _userClick(user.id),
            semanticLabel: tr('community_my_profile', 'Cəmiyyət profilim'),
            icon: CommunityAvatar(size: 32, url: own?.avatarUrl, fallbackColor: a.peach1, fallbackWidget: AIcon(AIcons.userRound, size: 18, color: a.ink)),
          ),
        if (widget.onOpenNotifications != null)
          iconButton(
            label: tr('notificationsscreen_bildirisler_54eb88', 'Bildirişlər'),
            icon: const AIcon(AIcons.bell, size: 19),
            onTap: widget.onOpenNotifications!,
            badge: notifications > 0 ? (notifications > 99 ? '99+' : '$notifications') : null,
          ),
        iconButton(
          label: chatTr('bottomnav_mesajlar', 'Mesajlar'),
          icon: const AIcon(AIcons.messageCircle, size: 19),
          onTap: () => setState(() => _showConversations = true),
          badge: dms > 0 ? (dms > 9 ? '9+' : '$dms') : null,
        ),
      ],
    );

    final tabs = Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: context.tokens.shadcn.muted.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        for (final (id, label, icon) in [
          ('feed', chatTr('communityscreen_umumi_1b5521', 'Ümumi'), AIcons.trendingUp),
          ('groups', chatTr('chat_groups', 'Qruplar'), AIcons.users),
        ])
          Expanded(
            child: CommunityButton(
              label: label,
              selected: _activeTab == id,
              onTap: () {
                setState(() => _activeTab = id);
                _scrollToTop();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: _activeTab == id
                    ? BoxDecoration(
                        color: context.tokens.shadcn.background,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
                      )
                    : null,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(icon, size: 15, color: _activeTab == id ? context.tokens.shadcn.foreground : context.tokens.shadcn.mutedForeground),
                  const SizedBox(width: 8),
                  Text(label,
                      style: px(12, weight: FontWeight.w700, color: _activeTab == id ? context.tokens.shadcn.foreground : context.tokens.shadcn.mutedForeground, height: 1.3)),
                ]),
              ),
            ),
          ),
      ]),
    );

    final composerPrompt = CommunityButton(
      tapScale: 0.98,
      onTap: () => setState(() => _showCreatePost = true),
      child: Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 12, 12),
        decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(22), boxShadow: a.cardShadow),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(gradient: a.gradPeach, shape: BoxShape.circle),
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            child: (own?.avatarUrl ?? '').isNotEmpty
                ? Image.network(own!.avatarUrl!, width: 36, height: 36, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())
                : Text(charAt0(own?.name).isEmpty ? 'A' : charAt0(own?.name), style: px(16, color: a.ink, height: 1)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(chatTr('communityscreen_ne_dusunursunuz_0378b3', 'Nə düşünürsünüz?'), style: px(13, weight: FontWeight.w500, color: a.inkFaint))),
          IgnorePointer(
            child: AButton(
              variant: AButtonVariant.cta,
              onPressed: () {},
              leading: const AIcon(AIcons.sparkles, size: 12, color: Color(0xFFFFFFFF)),
              child: Text(chatTr('storiesbar_elave_et_6e1b9b', 'Əlavə et'), style: const TextStyle(fontSize: 11.5)),
            ),
          ),
        ]),
      ),
    );

    void create() => setState(() => _showCreatePost = true);
    final feed = parts.feed?.call(context, onCreatePost: create, onUserClick: _userClick) ??
        SliverMainAxisGroup(slivers: [
          SliverToBoxAdapter(child: PostSearchFilter(sortBy: _feedView, onSortChange: (v) => setState(() => _feedView = v))),
          CommunityPostFeed(
            key: ValueKey('feed-${_feedView.id}'),
            view: _feedView,
            onUserClick: _userClick,
            onCreatePost: create,
            onExplore: () => setState(() => _feedView = CommunityFeedView.recent),
          ),
        ]);

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      sliver: SliverMainAxisGroup(slivers: [
        SliverToBoxAdapter(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            banner(context, 'community_banner'),
            topbar,
            tabs,
          ]),
        ),
        if (_activeTab == 'groups')
          SliverToBoxAdapter(child: ref.watch(communityGroupsPanelProvider)(context, search: '', onOpen: (id) => setState(() => _selectedGroupId = id)))
        else ...[
          SliverToBoxAdapter(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              banner(context, 'community_top'),
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: stories(context, groupId: null, autoOpenStoryId: _openStoryId, onAutoOpenConsumed: () => setState(() => _openStoryId = null)),
              ),
              composerPrompt,
              banner(context, 'community_inline'),
              const SizedBox(height: 16),
            ]),
          ),
          feed,
        ],
      ]),
    );
  }
}

/// `text-transform: uppercase` of `.a-eyebrow`.
String cssUpperText(String text) => cssUpper(text);

class _BlockedScreen extends StatelessWidget {
  const _BlockedScreen({required this.block});
  final ActiveBlock block;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final expires = block.expiresAt == null ? null : DateTime.tryParse(block.expiresAt!);
    String? expiry;
    if (expires != null) {
      try {
        expiry = formatIntlDateTemplate(normalizeAppLanguage(currentLanguage()), 'dmyhm', expires.toLocal());
      } catch (_) {
        expiry = expires.toLocal().toString();
      }
    }
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(24)), // bg-red-50
            alignment: Alignment.center,
            child: const AIcon(AIcons.ban, size: 32, color: Color(0xFFEF4444)), // text-red-500
          ),
          const SizedBox(height: 16),
          Text(tr('community_blocked_title', 'Community girişiniz bloklanıb'), textAlign: TextAlign.center, style: px(18, weight: FontWeight.w900, color: a.ink)),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 384),
            child: Text(
              tr('community_blocked_subtitle', 'Qaydaların pozulmasına görə community bölməsində paylaşım etmək imkanınız məhdudlaşdırılıb.'),
              textAlign: TextAlign.center,
              style: px(14, color: a.inkSoft),
            ),
          ),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 384),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('blocked_reason_label', 'Bloklanma səbəbi').toUpperCase(), style: px(11, weight: FontWeight.w700, color: a.warnInk, ls: 0.025)),
                const SizedBox(height: 4),
                Text((block.reason ?? '').isNotEmpty ? block.reason! : tr('blocked_reason_default', 'Qaydaların pozulması'), style: px(14, color: a.ink)),
                const SizedBox(height: 8),
                Text(expiry != null ? '${tr('blocked_until', 'Blokun bitmə tarixi:')} $expiry' : tr('blocked_permanent', 'Bu blok daimidir.'),
                    style: px(12, color: a.inkSoft)),
              ]),
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Text(tr('blocked_appeal', 'Bunun səhv olduğunu düşünürsünüzsə, support@anacan.az ünvanına yazın.'),
                textAlign: TextAlign.center, style: px(11, color: a.inkFaint)),
          ),
        ]),
      ),
    );
  }
}

/// [CommunityScreen] in its own scroll view (previews, tests, a standalone page).
class CommunityScreenPage extends StatelessWidget {
  const CommunityScreenPage({super.key, required this.screen});
  final CommunityScreen screen;
  @override
  Widget build(BuildContext context) => CommunityToastListener(child: CommunityScope(child: CustomScrollView(slivers: [screen])));
}
