// Ported from: the CommunityScreen children owned by other ports: components/community/StoriesBar.tsx
//              (`social.stories-bar`), ChatGroupsPanel.tsx / GroupChatScreen.tsx (`social.groups`),
//              banners/BannerSlot.tsx + ads/AdExperienceProvider.tsx (`AdSurface`, `AdInlineAnchor`), and the header
//              counters (useNotifications, useDirectMessages)
//
// Safe defaults until the owners land; each owner overrides its provider in `featureWiringOverrides()`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/feature_registry.dart' show ShellPlaceholder;
import '../chat/data/direct_messages.dart' show directMessagesProvider;
import '../settings/data/notifications.dart' show notificationsQuery;

/// `<StoriesBar groupId autoOpenStoryId onAutoOpenConsumed />`: opens [autoOpenStoryId] once, then calls
/// [onAutoOpenConsumed].
typedef CommunityStoriesBarBuilder = Widget Function(
    BuildContext context, {String? groupId, String? autoOpenStoryId, VoidCallback? onAutoOpenConsumed});

/// Default: no stories bar.
final communityStoriesBarProvider = Provider<CommunityStoriesBarBuilder>(
    (ref) => (context, {groupId, autoOpenStoryId, onAutoOpenConsumed}) => const SizedBox.shrink());

/// `<ChatGroupsPanel search onOpen />` (the Community "Qruplar" tab).
typedef CommunityGroupsPanelBuilder = Widget Function(BuildContext context, {required String search, required void Function(String groupId) onOpen});

/// Default: a placeholder until the groups port registers its panel.
final communityGroupsPanelProvider = Provider<CommunityGroupsPanelBuilder>(
    (ref) => (context, {required search, required onOpen}) => const ShellPlaceholder(kind: 'panel', id: 'chat-groups', fill: false));

/// `<BannerSlot placement="community_top" />`, `<AdSurface id="community_banner" />`, `<AdInlineAnchor />`.
typedef CommunityBannerBuilder = Widget Function(BuildContext context, String placement);

/// Default: nothing (banners / ads are not ported).
final communityBannerProvider = Provider<CommunityBannerBuilder>((ref) => (context, placement) => const SizedBox.shrink());

/// `useNotifications().unreadCount`.
final communityNotificationsUnreadProvider = Provider.autoDispose<int>((ref) {
  try {
    return (ref.watch(notificationsQuery).data ?? const []).where((n) => !n.isRead).length;
  } catch (_) {
    return 0;
  }
});

/// `useDirectMessages().totalUnread`.
final communityDmUnreadProvider = Provider.autoDispose<int>((ref) {
  try {
    return ref.watch(directMessagesProvider(null)).totalUnread;
  } catch (_) {
    return 0;
  }
});
