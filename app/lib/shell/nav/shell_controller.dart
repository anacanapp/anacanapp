// Ported from: src/pages/Index.tsx (the effects that wire the state machine: push-nav listener with the
//              ready condition and cold-start pending, pending blog, blog-module event, admin screen effect,
//              empty-tab reset, analytics screen views, tab/screen/tool scroll reset, root back handler),
//              src/components/blog/BlogLinkHost.tsx (article overlay: open/close rules, scope, back, closes on
//              push/blog-module navigation), src/lib/blog-links.ts (openAppBlog),
//              src/lib/blog-module-navigation.ts (openBlogModule), src/lib/parenting-nav.ts (openParentingTool)
import 'dart:async';

import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../links/app_path_links.dart';
import '../links/blog_links.dart';
import '../links/deeplink.dart';
import '../links/nav_handoffs.dart';
import '../links/notification_taps.dart';
import '../links/push_nav.dart';
import '../shell_inputs.dart';
import 'admin_web.dart';
import 'back_button.dart';
import 'ids.dart';
import 'scroll_memory.dart';
import 'shell_machine.dart';
import 'shell_machine.dart' as m;
import 'shell_state.dart';

// ── process-wide stores (module state of the React libs) ──

final backDispatcherProvider = Provider<BackDispatcher>((ref) => BackDispatcher());
final scrollMemoryProvider = Provider<ScrollMemory>(
  (ref) => ScrollMemory(TimerScrollScheduler((fn) => SchedulerBinding.instance.addPostFrameCallback((_) => fn()))),
);
final notificationTapQueueProvider = Provider<NotificationTapQueue>((ref) => NotificationTapQueue());
final parentingTargetStoreProvider = Provider<ParentingTargetStore>((ref) => ParentingTargetStore());
final widgetActionStoreProvider = Provider<WidgetActionStore>((ref) => WidgetActionStore());
final pendingBlogStoreProvider = Provider<PendingBlogStore>((ref) => PendingBlogStore());
final blogModuleStoreProvider = Provider<BlogModuleStore>((ref) => BlogModuleStore());
final appLinkStoreProvider = Provider<AppLinkStore>((ref) => AppLinkStore());
final pushNavRouterProvider = Provider<PushNavRouter>(
  (ref) => PushNavRouter(parenting: ref.watch(parentingTargetStoreProvider)),
);

/// Full-screen chat leases (`useFullScreenChat`): while > 0 the bottom nav is hidden.
final fullScreenChatLeasesProvider = NotifierProvider<FullScreenChatLeases, int>(FullScreenChatLeases.new);

class FullScreenChatLeases extends Notifier<int> {
  @override
  int build() => 0;
  void acquire() => state = state + 1;
  void release() => state = state > 0 ? state - 1 : 0;
}

/// `useChatChromeHidden()`.
final chatChromeHiddenProvider = Provider<bool>((ref) => ref.watch(fullScreenChatLeasesProvider) > 0);

/// The navigation state machine. Feature code opens things through this notifier:
/// `ref.read(shellProvider.notifier).openTool(ToolId.kick)`.
final shellProvider = NotifierProvider<ShellController, ShellState>(ShellController.new);

class ShellController extends Notifier<ShellState> {
  VoidCallback? _releaseRoot;
  VoidCallback? _releaseBlogBack;
  VoidCallback? _detachTaps;
  bool _disposed = false;

  @override
  ShellState build() {
    _disposed = false;
    final pending = ref.read(pendingBlogStoreProvider).pending();
    ref.listen<ShellUser>(shellUserProvider, _onUser);
    ref.onDispose(() {
      _disposed = true;
      _releaseRoot?.call();
      _releaseBlogBack?.call();
      _detachTaps?.call();
    });
    // Effects that may touch `state` run after build returned.
    scheduleMicrotask(() {
      if (_disposed) return;
      _releaseRoot = ref.read(backDispatcherProvider).push(back, BackLayer.root);
      _detachTaps = ref.read(notificationTapQueueProvider).attach(navigateFromPush);
      _onUser(null, ref.read(shellUserProvider));
    });
    return ShellState(activeScreen: pending != null ? 'blog/$pending' : null);
  }

  ShellUser get _user => ref.read(shellUserProvider);
  ShellContext get _context {
    final u = _user;
    return ShellContext(guard: u.guard, userId: u.userId);
  }

  ShellPlatform get _platform => ref.read(shellPlatformProvider);

  // ── transaction plumbing ──

  void _run(void Function(ShellTxn t) fn) => _commit(runShell(state, _context, fn));

  void _commit(ShellTxn t) {
    final memory = ref.read(scrollMemoryProvider);
    for (final e in t.effects) {
      if (e is SaveScroll) memory.save(e.key);
    }
    final before = state;
    state = t.state;
    final moved = before.activeTab != state.activeTab ||
        before.activeScreen != state.activeScreen ||
        before.activeTool != state.activeTool;
    if (moved) memory.resetToTop();
    for (final e in t.effects) {
      _execute(e);
    }
    _postCommit(before, moved);
  }

  void _execute(ShellEffect e) {
    switch (e) {
      case SaveScroll():
        break; // done before the state change
      case RestoreScroll(:final key):
        ref.read(scrollMemoryProvider).restore(key);
      case ChangeLanguage(:final language):
        unawaited(_platform.changeLanguage(language));
      case SetWidgetAction(:final action):
        ref.read(widgetActionStoreProvider).set(action);
      case SetParentingTarget(:final target):
        ref.read(parentingTargetStoreProvider).set(target);
      case RememberBlog(:final slug):
        ref.read(pendingBlogStoreProvider).remember(slug);
      case ClearPendingBlog():
        ref.read(pendingBlogStoreProvider).clear();
      case OpenBlogModule(:final module):
        openBlogModule(module);
      case ReopenToolNextTick(:final tool):
        Timer.run(() {
          if (!_disposed) _run((t) => t.setActiveTool(tool));
        });
      case DispatchPushEvent(:final intent):
        dispatchPushEvent(intent);
      case OpenAdminWeb():
        openAdminWeb();
    }
  }

  void _postCommit(ShellState before, bool moved) {
    final user = _user;
    if (moved && user.isAuthenticated) {
      final view = screenViewFor(state);
      _platform.logScreenView(view.name, view.screenClass);
    }
    final ctx = _context;
    if (adminScreenPending(state, ctx)) {
      unawaited(_platform.openExternalUrl(adminWebUri(backendUrl: user.backendUrl)));
      _run((t) => t.setActiveScreen(null));
      return;
    }
    if (emptyTabPending(state, ctx)) _run((t) => t.setActiveTab(ShellTab.home));
  }

  void _onUser(ShellUser? prev, ShellUser next) {
    if (_disposed) return;
    // BlogLinkHost: another account (or backend) closes the article.
    if (prev != null && prev.scope != next.scope && state.blogOverlay != null) closeBlogOverlay();
    if (next.isAuthenticated && next.profileLoaded) {
      final slug = ref.read(pendingBlogStoreProvider).pending();
      if (slug != null) {
        _run((t) => t.setActiveScreen('blog/$slug'));
        ref.read(pendingBlogStoreProvider).clear();
      }
      final module = ref.read(blogModuleStoreProvider).consume();
      if (module != null) _showBlogModule(module);
    }
    if (next.isReady) {
      final pending = ref.read(pushNavRouterProvider).consumePending();
      if (pending != null) _applyIntentEvent(pending);
    }
    if (emptyTabPending(state, _context)) _run((t) => t.setActiveTab(ShellTab.home));
  }

  // ── tabs ──

  /// Bottom-nav tap (`handleTabChange`): Tools resets to the hub; scroll per tab is kept.
  void selectTab(ShellTab tab) => _run((t) => handleTabChange(t, tab));

  /// Plain `setActiveTab` (callbacks such as "open chat", "open assistant", "back to home").
  void setTab(ShellTab tab) => _run((t) => t.setActiveTab(tab));

  /// Dashboard / BabyChat "Anacan.AI" shortcut.
  void openAssistant() => setTab(ShellTab.ai);

  // ── screens ──

  /// Index `setActiveScreen(screen)` (raw id, e.g. `legal/privacy_policy`, `aptek/cart`, `blog/<slug>`).
  void openScreen(String screen) => _run((t) => t.setActiveScreen(screen));

  /// Typed variant of [openScreen]: `openScreenId(ScreenId.legal, 'privacy_policy')`.
  void openScreenId(ScreenId id, [String? param]) => openScreen(param == null ? id.id : '${id.id}/$param');

  /// A screen's `onBack` (`setActiveScreen(null)`).
  void closeScreen() => _run((t) => t.setActiveScreen(null));

  /// `navigateScreen(screen)` (Profile, loss memories): `home` closes the screen and opens Home.
  void navigateScreen(String screen) => _run((t) => m.navigateScreen(t, screen));

  // ── tools ──

  /// Opens a tool on the Tools tab. [fromDashboard] (default, `handleNavigateToTool`) makes its back
  /// return to Home; `false` returns to the hub list.
  void openTool(ToolId tool, {bool fromDashboard = true}) => openToolId(tool.id, fromDashboard: fromDashboard);

  /// [openTool] with a raw id (aliases, ids from the server).
  void openToolId(String tool, {bool fromDashboard = true}) => _run((t) {
        if (fromDashboard) {
          handleNavigateToTool(t, tool);
        } else {
          t.setActiveTool(tool);
          t.setToolOpenedFromDashboard(false);
          t.setActiveTab(ShellTab.tools);
        }
      });

  /// `handleToolBack()` (the Tools hub `onBack`).
  void toolBack() => _run(handleToolBack);

  /// Recovery / loss memories `onNavigateToTool`.
  void screenOpensTool(String tool) => _run((t) => m.screenOpensTool(t, tool));

  /// BabyChat `onOpenAssistant`.
  void screenOpensAssistant() => _run(m.screenOpensAssistant);

  // ── overlays: messages, user profile, community ──

  void openMotherChat() => _run((t) => t.setShowMotherChat(true));
  void closeMotherChat() => _run((t) => t.setShowMotherChat(false));
  void viewUser(String userId) => _run((t) => t.setViewingUserId(userId));
  void closeUserProfile() => _run((t) => t.setViewingUserId(null));
  void userProfileSendMessage(String userId) => _run((t) => m.userProfileSendMessage(t, userId));
  void userProfileEditProfile() => _run(m.userProfileEditProfile);
  void communityEditProfile() => _run(m.communityEditProfile);
  void consumeCommunityDeepLink() => _run((t) => t.setCommunityDeepLink(null));
  void notificationsToCommunity([CommunityDeepLinkTarget? target]) => _run((t) => m.notificationsToCommunity(t, target));

  /// Dashboard finished scrolling to the blog module section (or gave up after 100 tries).
  void clearBlogSection() => _run((t) => t.setBlogSection(null));

  // ── back, swipe ──

  /// Index's root back handler; false = not consumed.
  bool back() {
    var consumed = false;
    _run((t) => consumed = rootBack(t));
    return consumed;
  }

  void swipeBack() => _run(handleSwipeBack);
  void swipeForward() => _run(handleSwipeForward);

  /// Edge swipe is on when signed in and no article overlay is open (gates are not rendered with the shell).
  bool get swipeEnabled => _user.isAuthenticated && !blogOverlayOpen;

  // ── admin ──

  /// Profile → Admin Panel: opens the web admin (product decision; no in-app admin panel).
  void openAdminWeb() => unawaited(_platform.openExternalUrl(adminWebUri(backendUrl: _user.backendUrl)));

  // ── deeplinks and pushes ──

  /// `handleDeeplink(parsed)` (OS links, banners' `anacan:deeplink` events, pushes with a link).
  void applyDeeplink(ParsedDeeplink parsed) => _run((t) => handleDeeplink(t, parsed));

  /// `appUrlOpen` / launch URL: parses and routes; false when the URL is not an app link.
  bool openUrl(String url) {
    final parsed = parseDeeplink(url);
    if (parsed == null) return false;
    applyDeeplink(parsed);
    return true;
  }

  /// `navigateFromPush(data)`: notification taps, AppPathLink hand-offs.
  void navigateFromPush(Map<String, Object?> data) {
    final router = ref.read(pushNavRouterProvider)..backendUrl = _safeBackendUrl();
    final action = router.navigateFromPush(data);
    switch (action) {
      case null:
        return;
      case PushTapIntent(:final intent):
        _onPushEvent(intent, consumePending: true);
      case PushTapOpenBrowser(:final url):
        Timer(PushTapOpenBrowser.delay, () => unawaited(_platform.openExternalUrl(Uri.parse(url))));
      case PushTapWebNavigate(:final url, :final fallback):
        unawaited(() async {
          bool ok;
          try {
            ok = await _platform.openWebPage(Uri.parse(url));
          } catch (_) {
            ok = false;
          }
          if (!ok && fallback != null && !_disposed) {
            router.fallbackAfterFailedNavigation(fallback);
            _onPushEvent(fallback, consumePending: true);
          }
        }());
    }
  }

  String? _safeBackendUrl() {
    try {
      return _user.backendUrl;
    } catch (_) {
      return null;
    }
  }

  /// `window.dispatchEvent(PUSH_NAV_EVENT)` without a pending copy (`openParentingTool`,
  /// `openMentalHealthTool`): applied only while the router is ready.
  void dispatchPushEvent(PushNavIntent intent) => _onPushEvent(intent, consumePending: false);

  /// `openParentingTool(target)`: the mother's tool or the partner's screen, on that item.
  void openParentingTool(ParentingTarget? target) {
    ref.read(parentingTargetStoreProvider).set(target);
    dispatchPushEvent(_context.isPartnerRole
        ? const PushNavIntent(screen: kPartnerParentingScreen)
        : const PushNavIntent(tool: 'parenting'));
  }

  void _onPushEvent(PushNavIntent intent, {required bool consumePending}) {
    // BlogLinkHost closes on every push navigation event.
    if (state.blogOverlay != null) closeBlogOverlay();
    if (!_user.isReady) return; // stays pending (when stored) until ready
    if (consumePending) ref.read(pushNavRouterProvider).consumePending();
    _applyIntentEvent(intent);
  }

  void _applyIntentEvent(PushNavIntent intent) => _run((t) => applyPushIntent(t, intent));

  // ── blog ──

  /// `openBlogModule(module)`: remember, then show once signed in with the profile loaded.
  void openBlogModule(String module) {
    if (!isBlogModule(module)) return;
    ref.read(blogModuleStoreProvider).remember(module);
    if (state.blogOverlay != null) closeBlogOverlay();
    final u = _user;
    if (!u.isAuthenticated || !u.profileLoaded) return;
    ref.read(blogModuleStoreProvider).consume();
    _showBlogModule(module);
  }

  void _showBlogModule(String module) => _run((t) => showBlogModule(t, module, lifeStage: _user.lifeStage));

  /// `openAppBlog(url)`: an app article link opens the in-app reader over the current screen.
  bool openAppBlogLink(String url) {
    final slug = appBlogSlug(url);
    if (slug == null) return false;
    openBlogOverlay(slug);
    return true;
  }

  /// `OPEN_BLOG_EVENT` handler of BlogLinkHost.
  void openBlogOverlay(String slug) {
    if (!validBlogSlug(slug)) return;
    final u = _user;
    if (u.userId == null || !u.profileLoaded) {
      ref.read(pendingBlogStoreProvider).remember(slug);
      return;
    }
    ref.read(pendingBlogStoreProvider).clear();
    state = state.copyWith(blogOverlay: BlogOverlay(slug, u.scope));
    _releaseBlogBack ??= ref.read(backDispatcherProvider).push(() {
      closeBlogOverlay();
      return true;
    }, BackLayer.overlay);
  }

  void closeBlogOverlay() {
    _releaseBlogBack?.call();
    _releaseBlogBack = null;
    if (state.blogOverlay != null) state = state.copyWith(blogOverlay: null);
  }

  /// BlogLinkHost `open`: the article shows only for the account that opened it.
  bool get blogOverlayOpen {
    final o = state.blogOverlay;
    if (o == null) return false;
    final u = _user;
    return o.scope == u.scope && u.userId != null && u.profileLoaded;
  }

  // ── onboarding tour ──

  void tourNavigate(TourNav nav) => _run((t) => m.tourNavigate(t, nav));
  void tourPreview() => _run(m.tourPreview);
}
