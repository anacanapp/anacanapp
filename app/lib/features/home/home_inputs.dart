// Ported from: src/components/Dashboard.tsx (useAuth / useUnreadMessages / useDirectMessages / useSubscription /
//              useAppSetting reads of the home frame), src/components/stories/DashboardStories.tsx (same reads)
//
// Read-only inputs of the home feature. Each has a working default on top of the foundation (auth controller,
// user store); the ones whose React hooks belong to other features (unread counts, subscription, app settings,
// selected child, emergency number) default to a neutral value and are overridden by the app root once those
// features land (README.md → "Interfaces awaiting wiring").
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shell/shell.dart' show PushNavIntent, ShellController, shellProvider;

/// `useAuth().user?.id`.
final homeUserIdProvider = Provider<String?>((ref) => ref.watch(authUserProvider)?.id);

/// `useAuth().profile` as the raw row (`linked_partner_id`, `multiples_type`, `loss_recovery_active`, …).
final homeProfileRowProvider = Provider<Map<String, dynamic>?>((ref) => ref.watch(authProfileProvider)?.row);

/// `useAuth().isAdmin`.
final homeIsAdminProvider = Provider<bool>((ref) => ref.watch(isAdminProvider));

/// `useSubscription().isPremium` (subscription feature). Default: false.
final homeIsPremiumProvider = Provider<bool>((ref) => false);

/// `useUnreadMessages().unreadCount + Σ useDirectMessages().conversations[].unread_count` (chat feature).
final homeTotalUnreadProvider = Provider<int>((ref) => 0);

/// `useNotifications().unreadCount` (bell currently disabled in React — kept for the header).
final homeNotificationCountProvider = Provider<int>((ref) => 0);

/// `useAppSetting(key)` (app settings feature). Default: undefined for every key.
final homeAppSettingProvider = Provider.family<Object?, String>((ref, key) => null);

/// `useChildren().selectedChild` → `{id, name, birth_date, avatar_emoji}` (mommy feature). Default: none.
final homeSelectedChildProvider = Provider<Map<String, dynamic>?>((ref) => null);

/// `useEffectiveCycleLength()` (flow feature). Default: null → stories use 28.
final homeEffectiveCycleLengthProvider = Provider<int?>((ref) => null);

/// `useDisabledTools().isToolDisabled(id)` (tools hub). Default: nothing disabled.
final homeToolDisabledProvider = Provider.family<bool, String>((ref, toolId) => false);

/// `isNativePlatform()` for headless native syncs (widgets, live activity). Tests override it.
final homeIsNativeProvider = Provider<bool>((ref) => true);

/// Dashboard props `onNavigateToTool` / `onNavigate` / `onOpenChat` / `onOpenAssistant` and the stories'
/// `PUSH_NAV_EVENT` dispatch. The default drives the shell (Index wiring); tests override it.
class HomeNavigation {
  const HomeNavigation({
    required this.openTool,
    required this.navigate,
    required this.openChat,
    required this.openAssistant,
    required this.pushIntent,
  });

  /// `handleNavigateToTool(id)` (from the dashboard: back returns home).
  final void Function(String toolId) openTool;

  /// `setActiveScreen(screen)` (`'blog'`, `'blog/<slug>'`, `'recap'`, `'baby-chat'`, `'books'`, …).
  final void Function(String screen) navigate;
  final void Function() openChat;
  final void Function() openAssistant;

  /// `window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: { tool | tab | screen } }))`.
  final void Function({String? tool, String? tab, String? screen}) pushIntent;
}

final homeNavigationProvider = Provider<HomeNavigation>((ref) {
  ShellController shell() => ref.read(shellProvider.notifier);
  return HomeNavigation(
    openTool: (id) => shell().openToolId(id),
    navigate: (screen) => shell().openScreen(screen),
    openChat: () => shell().openMotherChat(),
    openAssistant: () => shell().openAssistant(),
    pushIntent: ({tool, tab, screen}) => shell().dispatchPushEvent(PushNavIntent(tool: tool, tab: tab, screen: screen)),
  );
});
