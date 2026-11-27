// Ported from: src/pages/Index.tsx (IndexContent useState/useRef state: activeTab, activeScreen,
//              activeTool, toolOpenedFromDashboard, toolsResetKey, showMotherChat, viewingUserId,
//              communityDeepLink, blogSection, swipeRestoreRef), src/components/blog/BlogLinkHost.tsx (link)
import 'package:flutter/foundation.dart';

import '../links/push_nav.dart' show CommunityDeepLinkTarget;
import 'ids.dart';

/// `SwipeRestoreState`: what an edge swipe-back closed, re-opened by swipe-forward.
@immutable
sealed class SwipeRestore {
  const SwipeRestore();
}

class SwipeRestoreScreen extends SwipeRestore {
  const SwipeRestoreScreen(this.screen);
  final String screen;
  @override
  bool operator ==(Object other) => other is SwipeRestoreScreen && other.screen == screen;
  @override
  int get hashCode => screen.hashCode;
}

class SwipeRestoreTool extends SwipeRestore {
  const SwipeRestoreTool(this.tool, {required this.fromDashboard});
  final String tool;
  final bool fromDashboard;
  @override
  bool operator ==(Object other) => other is SwipeRestoreTool && other.tool == tool && other.fromDashboard == fromDashboard;
  @override
  int get hashCode => Object.hash(tool, fromDashboard);
}

class SwipeRestoreMotherChat extends SwipeRestore {
  const SwipeRestoreMotherChat();
  @override
  bool operator ==(Object other) => other is SwipeRestoreMotherChat;
  @override
  int get hashCode => 1;
}

class SwipeRestoreUserProfile extends SwipeRestore {
  const SwipeRestoreUserProfile(this.userId);
  final String userId;
  @override
  bool operator ==(Object other) => other is SwipeRestoreUserProfile && other.userId == userId;
  @override
  int get hashCode => userId.hashCode;
}

/// The in-app article overlay of `BlogLinkHost` (covers everything, keeps the screen below mounted).
@immutable
class BlogOverlay {
  const BlogOverlay(this.slug, this.scope);
  final String slug;

  /// `<backendUrl>:<userId>`: a different signed-in account closes it.
  final String scope;
  @override
  bool operator ==(Object other) => other is BlogOverlay && other.slug == slug && other.scope == scope;
  @override
  int get hashCode => Object.hash(slug, scope);
}

/// Index's navigation state. `showAdmin` is gone: the admin panel opens on the web.
@immutable
class ShellState {
  const ShellState({
    this.activeTab = ShellTab.home,
    this.activeScreen,
    this.activeTool,
    this.toolOpenedFromDashboard = false,
    this.toolsResetKey = 0,
    this.showMotherChat = false,
    this.viewingUserId,
    this.communityDeepLink,
    this.blogSection,
    this.swipeRestore,
    this.blogOverlay,
  });

  final ShellTab activeTab;

  /// Raw `activeScreen` string (see [ShellScreen.tryParse]); unknown ids are kept, like Index.
  final String? activeScreen;

  /// Raw `activeTool` string (see [ToolId.tryParse]); passed to the Tools hub as `initialTool`.
  final String? activeTool;
  final bool toolOpenedFromDashboard;

  /// Bumped to remount the Tools hub (it reads `initialTool` only on mount).
  final int toolsResetKey;
  final bool showMotherChat;
  final String? viewingUserId;
  final CommunityDeepLinkTarget? communityDeepLink;

  /// Blog module section the home dashboard should scroll to (`feeding` | `sleep` | `diaper`).
  final String? blogSection;
  final SwipeRestore? swipeRestore;
  final BlogOverlay? blogOverlay;

  ShellScreen? get screen => ShellScreen.tryParse(activeScreen);
  ToolId? get tool => ToolId.tryParse(activeTool);

  static const Object _keep = Object();

  ShellState copyWith({
    ShellTab? activeTab,
    Object? activeScreen = _keep,
    Object? activeTool = _keep,
    bool? toolOpenedFromDashboard,
    int? toolsResetKey,
    bool? showMotherChat,
    Object? viewingUserId = _keep,
    Object? communityDeepLink = _keep,
    Object? blogSection = _keep,
    Object? swipeRestore = _keep,
    Object? blogOverlay = _keep,
  }) {
    return ShellState(
      activeTab: activeTab ?? this.activeTab,
      activeScreen: identical(activeScreen, _keep) ? this.activeScreen : activeScreen as String?,
      activeTool: identical(activeTool, _keep) ? this.activeTool : activeTool as String?,
      toolOpenedFromDashboard: toolOpenedFromDashboard ?? this.toolOpenedFromDashboard,
      toolsResetKey: toolsResetKey ?? this.toolsResetKey,
      showMotherChat: showMotherChat ?? this.showMotherChat,
      viewingUserId: identical(viewingUserId, _keep) ? this.viewingUserId : viewingUserId as String?,
      communityDeepLink:
          identical(communityDeepLink, _keep) ? this.communityDeepLink : communityDeepLink as CommunityDeepLinkTarget?,
      blogSection: identical(blogSection, _keep) ? this.blogSection : blogSection as String?,
      swipeRestore: identical(swipeRestore, _keep) ? this.swipeRestore : swipeRestore as SwipeRestore?,
      blogOverlay: identical(blogOverlay, _keep) ? this.blogOverlay : blogOverlay as BlogOverlay?,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShellState &&
      other.activeTab == activeTab &&
      other.activeScreen == activeScreen &&
      other.activeTool == activeTool &&
      other.toolOpenedFromDashboard == toolOpenedFromDashboard &&
      other.toolsResetKey == toolsResetKey &&
      other.showMotherChat == showMotherChat &&
      other.viewingUserId == viewingUserId &&
      other.communityDeepLink == communityDeepLink &&
      other.blogSection == blogSection &&
      other.swipeRestore == swipeRestore &&
      other.blogOverlay == blogOverlay;

  @override
  int get hashCode => Object.hash(activeTab, activeScreen, activeTool, toolOpenedFromDashboard, toolsResetKey,
      showMotherChat, viewingUserId, communityDeepLink, blogSection, swipeRestore, blogOverlay);

  @override
  String toString() => 'ShellState(tab: ${activeTab.id}, screen: $activeScreen, tool: $activeTool'
      '${toolOpenedFromDashboard ? ' (dash)' : ''}, reset: $toolsResetKey, chat: $showMotherChat, user: $viewingUserId, '
      'community: $communityDeepLink, blogSection: $blogSection, blog: ${blogOverlay?.slug})';
}

/// What the shell renders for a state (Index's render precedence after the gates).
enum ShellLayer { userProfile, subScreen, motherChat, frame }

/// `TourNav` of src/lib/onboardingTour.ts.
@immutable
class TourNav {
  const TourNav({required this.tab, this.tool});
  final ShellTab tab;
  final String? tool;
}
