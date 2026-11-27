// Ported from: src/pages/Index.tsx (`case 'community'` → CommunityScreen with onOpenNotifications / onEditProfile /
//              deepLinkTarget / onDeepLinkConsumed; `viewingUserId` → UserProfileScreen in `.a-subscreen`),
//              src/components/BottomNav.tsx (the always-mounted useUnreadCommunityPosts consumer of the badge)
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import '../chat/ui/chat_widgets.dart' show chatPhotoViewerProvider, chatRestrictionNoteProvider, chatTextBuilderProvider;
import 'data/community_toasts.dart';
import 'moderation/moderator_widgets.dart' show RestrictionNote;
import 'ui/comment_text.dart';
import 'ui/community_screen.dart';
import 'ui/community_widgets.dart';
import 'ui/photo_gallery_viewer.dart';
import 'ui/user_profile_screen.dart';

void registerCommunityFeature(FeatureRegistry r) {
  // Partners open Community through links only and get the shared (woman) variant.
  r.registerTabSlivers(ShellTab.community, (context, a) => const ShellSliverBody(sliver: CommunityTab()));
  r.registerOverlay(ShellOverlayId.userProfile, (context, a) => CommunityUserProfileOverlay(userId: a.userId ?? '', onClose: a.onClose));
}

/// The cross-feature overrides this feature implements (spread into `featureWiringOverrides()`).
/// `unreadCommunityPostsCountProvider` is set next to the unread messages in `state/shell_bindings.dart`
/// (`communityUnreadCountProvider`), where the app tests replace both counters.
List<Override> communityWiringOverrides() => [
      chatTextBuilderProvider.overrideWithValue(communityChatTextBuilder),
      chatPhotoViewerProvider.overrideWithValue(communityChatPhotoViewer),
      chatRestrictionNoteProvider.overrideWithValue((context) => const RestrictionNote(scope: 'message')),
    ];

/// The Community tab (Index `case 'community'`), a sliver in the shell's scroll view.
class CommunityTab extends ConsumerWidget {
  const CommunityTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shell = ref.read(shellProvider.notifier);
    final target = ref.watch(shellProvider.select((s) => s.communityDeepLink));
    return CommunityToastListener(
      child: DefaultTextStyle.merge(
        style: px(15, height: 1.6),
        child: CommunityScreen(
          onOpenNotifications: () => shell.openScreen(ScreenId.notifications.id),
          onEditProfile: shell.communityEditProfile,
          deepLinkTarget: target,
          onDeepLinkConsumed: shell.consumeCommunityDeepLink,
        ),
      ),
    );
  }
}

/// `viewingUserId` → UserProfileScreen (send message → Community DM, edit → Community profile + edit-profile).
class CommunityUserProfileOverlay extends ConsumerWidget {
  const CommunityUserProfileOverlay({super.key, required this.userId, required this.onClose});
  final String userId;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shell = ref.read(shellProvider.notifier);
    return CommunityToastListener(
      child: UserProfileScreenPage(
        key: ValueKey('user-profile-$userId'),
        screen: UserProfileScreen(
          userId: userId,
          onBack: onClose,
          onUserClick: shell.viewUser,
          onSendMessage: (id, name, avatar) => shell.userProfileSendMessage(id),
          onEditProfile: shell.userProfileEditProfile,
        ),
      ),
    );
  }
}
