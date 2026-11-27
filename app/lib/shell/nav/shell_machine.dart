// Ported from: src/pages/Index.tsx (setActiveScreen with scroll memory, handleTabChange, navigateScreen,
//              handleNavigateToTool, handleToolBack, handleSwipeBack/Forward, the root back handler,
//              applyIntent (push), handleDeeplink, blog-module show(), tourNavigate, TOUR_PREVIEW_EVENT,
//              screen callbacks passed to Community / Notifications / UserProfile / Recovery / BabyChat …)
//
// Every transition is a pure function over a [ShellTxn]: it reads the state the React closure saw
// ([ShellTxn.initial]), writes through setters that mirror the React state setters, and records side
// effects ([ShellEffect]) the controller executes afterwards.
import 'package:flutter/foundation.dart';

import '../../core/i18n/app_languages.dart' show isAppLanguage;
import '../links/blog_links.dart' show isBlogModule;
import '../links/deeplink.dart';
import '../links/nav_handoffs.dart';
import '../links/push_nav.dart';
import 'ids.dart';
import 'shell_state.dart';

/// Side effects of a transition, executed by the controller in order.
@immutable
sealed class ShellEffect {
  const ShellEffect();
}

/// `saveScroll(key)` (before the content changes).
class SaveScroll extends ShellEffect {
  const SaveScroll(this.key);
  final String key;
  @override
  bool operator ==(Object other) => other is SaveScroll && other.key == key;
  @override
  int get hashCode => key.hashCode;
  @override
  String toString() => 'SaveScroll($key)';
}

/// `restoreScroll(key)` (retried after the reset to top).
class RestoreScroll extends ShellEffect {
  const RestoreScroll(this.key);
  final String key;
  @override
  bool operator ==(Object other) => other is RestoreScroll && other.key == key;
  @override
  int get hashCode => key.hashCode;
  @override
  String toString() => 'RestoreScroll($key)';
}

/// `?language=` of a deeplink: `ensureLanguageReady` then `setLanguage`.
class ChangeLanguage extends ShellEffect {
  const ChangeLanguage(this.language);
  final String language;
  @override
  bool operator ==(Object other) => other is ChangeLanguage && other.language == language;
  @override
  int get hashCode => language.hashCode;
  @override
  String toString() => 'ChangeLanguage($language)';
}

/// `setPendingWidgetAction(action)`.
class SetWidgetAction extends ShellEffect {
  const SetWidgetAction(this.action);
  final String? action;
  @override
  bool operator ==(Object other) => other is SetWidgetAction && other.action == action;
  @override
  int get hashCode => action.hashCode;
  @override
  String toString() => 'SetWidgetAction($action)';
}

/// `setParentingTarget(target)` (from a Tərbiyə item link).
class SetParentingTarget extends ShellEffect {
  const SetParentingTarget(this.target);
  final ParentingTarget? target;
  @override
  bool operator ==(Object other) => other is SetParentingTarget && other.target == target;
  @override
  int get hashCode => target.hashCode;
  @override
  String toString() => 'SetParentingTarget($target)';
}

/// `rememberBlog(slug)`.
class RememberBlog extends ShellEffect {
  const RememberBlog(this.slug);
  final String slug;
  @override
  bool operator ==(Object other) => other is RememberBlog && other.slug == slug;
  @override
  int get hashCode => slug.hashCode;
  @override
  String toString() => 'RememberBlog($slug)';
}

/// `clearPendingBlog()`.
class ClearPendingBlog extends ShellEffect {
  const ClearPendingBlog();
  @override
  bool operator ==(Object other) => other is ClearPendingBlog;
  @override
  int get hashCode => 2;
  @override
  String toString() => 'ClearPendingBlog()';
}

/// `openBlogModule(module)`: remember + `anacan:open-blog-module` event.
class OpenBlogModule extends ShellEffect {
  const OpenBlogModule(this.module);
  final String module;
  @override
  bool operator ==(Object other) => other is OpenBlogModule && other.module == module;
  @override
  int get hashCode => module.hashCode;
  @override
  String toString() => 'OpenBlogModule($module)';
}

/// A widget action for the tool that is already open: close it now, reopen on the next tick.
class ReopenToolNextTick extends ShellEffect {
  const ReopenToolNextTick(this.tool);
  final String tool;
  @override
  bool operator ==(Object other) => other is ReopenToolNextTick && other.tool == tool;
  @override
  int get hashCode => tool.hashCode;
  @override
  String toString() => 'ReopenToolNextTick($tool)';
}

/// `anacan-push-nav` event without storing it as pending (`openParentingTool`).
class DispatchPushEvent extends ShellEffect {
  const DispatchPushEvent(this.intent);
  final PushNavIntent intent;
  @override
  bool operator ==(Object other) => other is DispatchPushEvent && other.intent == intent;
  @override
  int get hashCode => intent.hashCode;
  @override
  String toString() => 'DispatchPushEvent($intent)';
}

/// Admin panel (product decision): open the web admin instead of an in-app panel.
class OpenAdminWeb extends ShellEffect {
  const OpenAdminWeb();
  @override
  bool operator ==(Object other) => other is OpenAdminWeb;
  @override
  int get hashCode => 3;
  @override
  String toString() => 'OpenAdminWeb()';
}

/// Facts a transition reads besides the state.
@immutable
class ShellContext {
  const ShellContext({required this.guard, this.userId});
  final ShellGuardContext guard;

  /// `user?.id` (the signed-in account).
  final String? userId;

  bool get isPartnerRole => guard.isPartnerRole;
}

/// One transition: the closure state, the pending state and the recorded effects.
class ShellTxn {
  ShellTxn(this.initial, this.context) : state = initial;

  /// The state the React handler closed over (committed render).
  final ShellState initial;
  final ShellContext context;
  ShellState state;
  final List<ShellEffect> effects = [];

  /// `activeTabRef.current`: the tab of the committed render (updated after render, not by setters).
  ShellTab get committedTab => initial.activeTab;

  // ── React state setters ──
  void setActiveTab(ShellTab tab) => state = state.copyWith(activeTab: tab);

  /// Index's `setActiveScreen`: opening saves `tab:<committed tab>`, closing restores it.
  void setActiveScreen(String? screen) {
    if (screen != null) effects.add(SaveScroll('tab:${committedTab.id}'));
    state = state.copyWith(activeScreen: screen);
    if (screen == null) effects.add(RestoreScroll('tab:${committedTab.id}'));
  }

  void setActiveTool(String? tool) => state = state.copyWith(activeTool: tool);
  void setToolOpenedFromDashboard(bool value) => state = state.copyWith(toolOpenedFromDashboard: value);
  void bumpToolsResetKey() => state = state.copyWith(toolsResetKey: state.toolsResetKey + 1);
  void setShowMotherChat(bool value) => state = state.copyWith(showMotherChat: value);
  void setViewingUserId(String? id) => state = state.copyWith(viewingUserId: id);
  void setCommunityDeepLink(CommunityDeepLinkTarget? target) => state = state.copyWith(communityDeepLink: target);
  void setBlogSection(String? module) => state = state.copyWith(blogSection: module);
  void setSwipeRestore(SwipeRestore? value) => state = state.copyWith(swipeRestore: value);
}

/// Runs [fn] on a fresh transaction.
ShellTxn runShell(ShellState state, ShellContext context, void Function(ShellTxn t) fn) {
  final t = ShellTxn(state, context);
  fn(t);
  return t;
}

// ── tabs, screens, tools ──

/// `handleTabChange(tab)` (bottom nav tap).
void handleTabChange(ShellTxn t, ShellTab tab) {
  if (tab == ShellTab.tools) {
    t.setActiveTool(null);
    t.setToolOpenedFromDashboard(false);
    t.bumpToolsResetKey();
  }
  if (tab != t.initial.activeTab) {
    t.effects.add(SaveScroll('tab:${t.initial.activeTab.id}'));
    t.effects.add(RestoreScroll('tab:${tab.id}'));
  }
  t.setActiveTab(tab);
}

/// `navigateScreen(screen)`: `home` closes the screen and opens the home tab.
void navigateScreen(ShellTxn t, String screen) {
  if (screen == 'home') {
    t.setActiveScreen(null);
    t.setActiveTab(ShellTab.home);
  } else {
    t.setActiveScreen(screen);
  }
}

/// `handleNavigateToTool(tool)` (Dashboard shortcuts, Recovery, loss memories).
void handleNavigateToTool(ShellTxn t, String tool) {
  t.setActiveTool(tool);
  t.setToolOpenedFromDashboard(true);
  t.setActiveTab(ShellTab.tools);
}

/// `handleToolBack()`: back to the Dashboard when the tool was opened from there.
void handleToolBack(ShellTxn t) {
  if (t.initial.toolOpenedFromDashboard) {
    t.setActiveTool(null);
    t.setToolOpenedFromDashboard(false);
    t.setActiveTab(ShellTab.home);
  } else {
    t.setActiveTool(null);
  }
}

// ── Android back (root layer) ──

/// Index's root back handler: viewed user → mother chat → screen → tool → non-home tab → home.
/// Returns false when nothing was consumed (backButton.ts then asks for a second press to exit).
bool rootBack(ShellTxn t) {
  final s = t.initial;
  if (s.viewingUserId != null) {
    t.setViewingUserId(null);
    return true;
  }
  if (s.showMotherChat) {
    t.setShowMotherChat(false);
    return true;
  }
  if (s.activeScreen != null) {
    t.setActiveScreen(null);
    return true;
  }
  if (s.activeTool != null) {
    t.setActiveTool(null);
    t.bumpToolsResetKey();
    return true;
  }
  if (s.activeTab != ShellTab.home) {
    t.setActiveTab(ShellTab.home);
    return true;
  }
  return false;
}

// ── edge swipe ──

/// `handleSwipeBack()`: only pops the current stack (screen → user → chat → tool on the Tools tab).
void handleSwipeBack(ShellTxn t) {
  final s = t.initial;
  if (s.activeScreen != null) {
    t.setSwipeRestore(SwipeRestoreScreen(s.activeScreen!));
    t.setActiveScreen(null);
    return;
  }
  if (s.viewingUserId != null) {
    t.setSwipeRestore(SwipeRestoreUserProfile(s.viewingUserId!));
    t.setViewingUserId(null);
    return;
  }
  if (s.showMotherChat) {
    t.setSwipeRestore(const SwipeRestoreMotherChat());
    t.setShowMotherChat(false);
    return;
  }
  if (s.activeTool != null && s.activeTab == ShellTab.tools) {
    t.setSwipeRestore(SwipeRestoreTool(s.activeTool!, fromDashboard: s.toolOpenedFromDashboard));
    handleToolBack(t);
  }
}

/// `handleSwipeForward()`: re-opens what the last swipe-back closed, once.
void handleSwipeForward(ShellTxn t) {
  final restore = t.initial.swipeRestore;
  if (restore == null) return;
  switch (restore) {
    case SwipeRestoreScreen(:final screen):
      t.setActiveScreen(screen);
    case SwipeRestoreUserProfile(:final userId):
      t.setViewingUserId(userId);
    case SwipeRestoreMotherChat():
      t.setShowMotherChat(true);
    case SwipeRestoreTool(:final tool, :final fromDashboard):
      t.setActiveTab(ShellTab.tools);
      t.setActiveTool(tool);
      t.setToolOpenedFromDashboard(fromDashboard);
  }
  t.setSwipeRestore(null);
}

// ── push intents ──

/// `applyIntent(intent)`: a push tap replaces the whole nested navigation, then routes.
void applyPushIntent(ShellTxn t, PushNavIntent intent) {
  t.setViewingUserId(null);
  t.setShowMotherChat(false);
  t.setActiveScreen(null);
  t.setActiveTool(null);
  t.setToolOpenedFromDashboard(false);
  t.setCommunityDeepLink(null);
  t.setSwipeRestore(null);
  t.bumpToolsResetKey();

  if (intent.motherChat) {
    if (t.context.isPartnerRole) {
      t.setActiveTab(ShellTab.chat);
    } else {
      t.setShowMotherChat(true);
    }
    return;
  }
  if (intent.shoppingList) {
    if (t.context.isPartnerRole) {
      t.setActiveTab(ShellTab.home);
      t.setActiveScreen(ScreenId.partnerShopping.id);
    } else {
      t.setActiveTab(ShellTab.tools);
      t.setActiveTool(ToolId.shopping.id);
      t.setToolOpenedFromDashboard(true);
    }
    return;
  }
  if (intent.deeplink != null) {
    handleDeeplink(t, intent.deeplink!);
    return;
  }
  if (intent.tool != null) {
    t.setActiveTab(ShellTab.tools);
    t.setActiveTool(intent.tool);
    return;
  }
  if (intent.screen != null) {
    t.setActiveScreen(intent.screen);
    return;
  }
  if (intent.tab != null) {
    final tab = ShellTab.tryParse(intent.tab);
    if (tab != null) t.setActiveTab(tab);
    if (intent.tab == 'community') t.setCommunityDeepLink(intent.communityTarget ?? CommunityDeepLinkTarget.empty);
  }
}

// ── deeplinks ──

/// `handleDeeplink(parsed)`.
void handleDeeplink(ShellTxn t, ParsedDeeplink parsed) {
  final language = parsed.params['language'];
  if (language != null && isAppLanguage(language)) t.effects.add(ChangeLanguage(language));
  switch (parsed.action) {
    case 'blog-module':
      final module = parsed.params['module'];
      if (isBlogModule(module)) t.effects.add(OpenBlogModule(module!));
    case 'tab':
      final tab = ShellTab.tryParse(parsed.params['tab']);
      if (tab != null) t.setActiveTab(tab);
      t.setActiveTool(null);
      t.setActiveScreen(null);
    case 'tool':
      final id = parsed.params['tool_id'] ?? '';
      // Tərbiyə item links open that item (partner app included).
      if (id == 'parenting') {
        final target = parentingTargetFromDeeplink(parsed);
        if (target != null) {
          t.effects.add(SetParentingTarget(target));
          t.effects.add(DispatchPushEvent(t.context.isPartnerRole
              ? const PushNavIntent(screen: kPartnerParentingScreen)
              : const PushNavIntent(tool: 'parenting')));
          break;
        }
      }
      final widgetAction = parsed.params['widget_action'];
      t.effects.add(SetWidgetAction(widgetAction));
      t.setActiveTab(ShellTab.tools);
      // A widget action for the already open tool remounts it so the tool picks the action up.
      if (t.state.activeTool == id && widgetAction != null && widgetAction.isNotEmpty) {
        t.effects.add(ReopenToolNextTick(id));
        t.setActiveTool(null);
      } else {
        t.setActiveTool(id);
      }
      t.setToolOpenedFromDashboard(false);
    case 'screen':
      final screen = parsed.params['screen'] ?? '';
      if (screen.startsWith('blog/')) t.effects.add(RememberBlog(screen.substring(5)));
      t.setActiveScreen(screen);
    case 'messages':
      t.setShowMotherChat(true);
    case 'user-profile':
      t.setViewingUserId(parsed.params['user_id']);
    case 'community-post':
      t.setActiveTab(ShellTab.community);
      t.setActiveScreen(null);
      t.setCommunityDeepLink(CommunityDeepLinkTarget(postId: parsed.params['post_id']));
  }
}

// ── blog modules ──

/// `show(module)` of the blog-module effect (only called when signed in with the profile loaded).
void showBlogModule(ShellTxn t, String module, {required String? lifeStage}) {
  t.setActiveScreen(null);
  t.setShowMotherChat(false);
  t.setViewingUserId(null);
  t.setActiveTool(null);
  if (module == 'calendar') {
    t.setActiveScreen(ScreenId.calendar.id);
    return;
  }
  if (module == 'hospitalBag' || module == 'babyGrowth') {
    t.setActiveTab(ShellTab.tools);
    t.setActiveTool(module == 'hospitalBag' ? ToolId.hospital.id : ToolId.babyGrowth.id);
    t.setToolOpenedFromDashboard(true);
    t.bumpToolsResetKey();
    return;
  }
  if (lifeStage != 'mommy' || t.context.isPartnerRole) {
    t.setActiveScreen(ScreenId.blog.id);
    return;
  }
  t.setActiveTab(ShellTab.home);
  t.setBlogSection(module);
}

// ── onboarding tour ──

/// `tourNavigate(nav)`: a tool opens through a fresh Tools hub, a tab shows its root screen.
void tourNavigate(ShellTxn t, TourNav nav) {
  t.setActiveScreen(null);
  t.setShowMotherChat(false);
  if (nav.tool != null && nav.tool!.isNotEmpty) {
    t.setActiveTool(nav.tool);
    t.setToolOpenedFromDashboard(false);
    t.bumpToolsResetKey();
    t.setActiveTab(ShellTab.tools);
    return;
  }
  if (nav.tab == ShellTab.tools) {
    t.setActiveTool(null);
    t.setToolOpenedFromDashboard(false);
    t.bumpToolsResetKey();
  }
  t.setActiveTab(nav.tab);
}

/// `TOUR_PREVIEW_EVENT` (admin "Turu sınaqla"): leave everything and go home.
void tourPreview(ShellTxn t) {
  t.setActiveScreen(null);
  t.setActiveTab(ShellTab.home);
}

// ── screen callbacks wired by Index ──

/// CommunityScreen `onEditProfile`.
void communityEditProfile(ShellTxn t) {
  final me = t.context.userId;
  if (me != null) t.setCommunityDeepLink(CommunityDeepLinkTarget(userId: me));
  t.setActiveScreen(ScreenId.editProfile.id);
}

/// NotificationsScreen `onNavigateToCommunity(target)`.
void notificationsToCommunity(ShellTxn t, CommunityDeepLinkTarget? target) {
  t.setActiveScreen(null);
  t.setActiveTab(ShellTab.community);
  if (target != null) t.setCommunityDeepLink(target);
}

/// UserProfileScreen `onSendMessage(userId)`.
void userProfileSendMessage(ShellTxn t, String userId) {
  t.setViewingUserId(null);
  t.setActiveTab(ShellTab.community);
  t.setCommunityDeepLink(CommunityDeepLinkTarget(dmUserId: userId));
}

/// UserProfileScreen `onEditProfile`.
void userProfileEditProfile(ShellTxn t) {
  t.setViewingUserId(null);
  t.setActiveTab(ShellTab.community);
  final me = t.context.userId;
  if (me != null) t.setCommunityDeepLink(CommunityDeepLinkTarget(userId: me));
  t.setActiveScreen(ScreenId.editProfile.id);
}

/// Recovery / loss memories `onNavigateToTool(tool)`.
void screenOpensTool(ShellTxn t, String tool) {
  t.setActiveScreen(null);
  handleNavigateToTool(t, tool);
}

/// BabyChat `onOpenAssistant`.
void screenOpensAssistant(ShellTxn t) {
  t.setActiveScreen(null);
  t.setActiveTab(ShellTab.ai);
}

// ── post-commit effects (Index useEffects that run after a render) ──

/// `activeScreen === 'admin' && isAdmin` → admin panel (web) and close the screen.
bool adminScreenPending(ShellState s, ShellContext c) => s.activeScreen == ScreenId.admin.id && c.guard.isAdmin;

/// An unavailable tab (e.g. cakes elsewhere) resets to `home`.
bool emptyTabPending(ShellState s, ShellContext c) => s.activeTab != ShellTab.home && !tabHasContent(s.activeTab, c.guard);

/// Which layer Index renders after the gates (the admin panel is on the web).
ShellLayer layerFor(ShellState s, ShellGuardContext c) {
  if (s.viewingUserId != null) return ShellLayer.userProfile;
  if (resolveSubScreen(s.activeScreen, c) != null) return ShellLayer.subScreen;
  if (s.showMotherChat) return ShellLayer.motherChat;
  return ShellLayer.frame;
}

/// GA screen names (`SCREEN_NAME_MAP`).
const Map<String, String> kScreenNameMap = {
  'home': 'Dashboard', 'tools': 'ToolsHub', 'ai': 'AIChat', 'shop': 'Shop', 'cakes': 'Cakes', 'profile': 'Profile',
  'community': 'Community',
};

/// The `logScreenView(name, class)` for a state.
({String name, String screenClass}) screenViewFor(ShellState s) {
  final raw = s.activeScreen ?? s.activeTool ?? s.activeTab.id;
  final name = kScreenNameMap[raw] ?? raw;
  final cls = s.activeScreen != null ? 'Screen' : s.activeTool != null ? 'Tools' : 'Tab';
  return (name: name, screenClass: cls);
}
