// Ported from: src/pages/Index.tsx transitions (no vitest counterpart beyond Index.pushNav.test.tsx): table
//              tests of every pure transition over ShellState
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

const woman = ShellContext(
  guard: ShellGuardContext(role: 'woman', lifeStage: 'mommy', isAdmin: false, language: 'az', cakesAvailable: true),
  userId: 'me',
);
const partner = ShellContext(
  guard: ShellGuardContext(role: 'partner', lifeStage: 'partner', isAdmin: false, language: 'az', cakesAvailable: true),
  userId: 'me',
);

ShellTxn run(ShellState s, void Function(ShellTxn t) fn, [ShellContext c = woman]) => runShell(s, c, fn);

void main() {
  group('root back order: user → chat → screen → tool → tab → not consumed', () {
    final cases = <(String, ShellState, ShellState, bool)>[
      ('user profile first', const ShellState(viewingUserId: 'u', showMotherChat: true, activeScreen: 'settings'),
          const ShellState(showMotherChat: true, activeScreen: 'settings'), true),
      ('then mother chat', const ShellState(showMotherChat: true, activeScreen: 'settings'),
          const ShellState(activeScreen: 'settings'), true),
      ('then the screen', const ShellState(activeScreen: 'settings', activeTool: 'kick', activeTab: ShellTab.tools),
          const ShellState(activeTool: 'kick', activeTab: ShellTab.tools), true),
      ('then the tool (+ hub remount)', const ShellState(activeTool: 'kick', activeTab: ShellTab.tools),
          const ShellState(activeTab: ShellTab.tools, toolsResetKey: 1), true),
      ('then a non-home tab', const ShellState(activeTab: ShellTab.profile), const ShellState(), true),
      ('home: not consumed', const ShellState(), const ShellState(), false),
    ];
    for (final (name, from, to, consumed) in cases) {
      test(name, () {
        var result = false;
        final t = run(from, (t) => result = rootBack(t));
        expect(result, consumed);
        expect(t.state, to);
      });
    }

    test('closing a screen restores the committed tab scroll; back to home does not', () {
      expect(run(const ShellState(activeTab: ShellTab.tools, activeScreen: 'x'), rootBack).effects, [const RestoreScroll('tab:tools')]);
      expect(run(const ShellState(activeTab: ShellTab.tools), rootBack).effects, isEmpty);
    });
  });

  group('swipe', () {
    test('back pops the screen before a viewed user (render shows the user first; kept as in Index)', () {
      final t = run(const ShellState(activeScreen: 'settings', viewingUserId: 'u'), handleSwipeBack);
      expect(t.state.activeScreen, isNull);
      expect(t.state.viewingUserId, 'u');
      expect(t.state.swipeRestore, const SwipeRestoreScreen('settings'));
    });

    test('back closes the user, then the chat', () {
      expect(run(const ShellState(viewingUserId: 'u'), handleSwipeBack).state.swipeRestore, const SwipeRestoreUserProfile('u'));
      final chat = run(const ShellState(showMotherChat: true), handleSwipeBack).state;
      expect(chat.showMotherChat, isFalse);
      expect(chat.swipeRestore, const SwipeRestoreMotherChat());
    });

    test('back closes a tool only on the Tools tab and remembers where it came from', () {
      final t = run(const ShellState(activeTab: ShellTab.tools, activeTool: 'kick', toolOpenedFromDashboard: true), handleSwipeBack);
      expect(t.state.activeTab, ShellTab.home);
      expect(t.state.activeTool, isNull);
      expect(t.state.swipeRestore, const SwipeRestoreTool('kick', fromDashboard: true));
      expect(run(const ShellState(activeTab: ShellTab.home, activeTool: 'kick'), handleSwipeBack).state,
          const ShellState(activeTab: ShellTab.home, activeTool: 'kick'));
    });

    test('back never switches tabs', () {
      expect(run(const ShellState(activeTab: ShellTab.profile), handleSwipeBack).state, const ShellState(activeTab: ShellTab.profile));
    });

    test('forward re-applies once', () {
      final back = run(const ShellState(activeTab: ShellTab.tools, activeTool: 'kick'), handleSwipeBack).state;
      final fwd = run(back, handleSwipeForward).state;
      expect((fwd.activeTab, fwd.activeTool, fwd.toolOpenedFromDashboard, fwd.swipeRestore), (ShellTab.tools, 'kick', false, null));
      expect(run(fwd, handleSwipeForward).state, fwd);
      expect(run(const ShellState(swipeRestore: SwipeRestoreScreen('help')), handleSwipeForward).state, const ShellState(activeScreen: 'help'));
      expect(run(const ShellState(swipeRestore: SwipeRestoreMotherChat()), handleSwipeForward).state, const ShellState(showMotherChat: true));
      expect(run(const ShellState(swipeRestore: SwipeRestoreUserProfile('u')), handleSwipeForward).state, const ShellState(viewingUserId: 'u'));
    });
  });

  group('tabs, screens and tools', () {
    test('tab change saves the old tab and restores the new one; Tools resets the hub', () {
      final t = run(const ShellState(activeTool: 'kick', toolOpenedFromDashboard: true), (t) => handleTabChange(t, ShellTab.tools));
      expect(t.effects, [const SaveScroll('tab:home'), const RestoreScroll('tab:tools')]);
      expect(t.state, const ShellState(activeTab: ShellTab.tools, toolsResetKey: 1));
      expect(run(const ShellState(), (t) => handleTabChange(t, ShellTab.home)).effects, isEmpty);
    });

    test('tab change keeps an unrendered screen and the community target', () {
      const s = ShellState(activeScreen: 'name-voting', communityDeepLink: CommunityDeepLinkTarget(postId: 'p'));
      final t = run(s, (t) => handleTabChange(t, ShellTab.profile)).state;
      expect(t.activeScreen, 'name-voting');
      expect(t.communityDeepLink, const CommunityDeepLinkTarget(postId: 'p'));
    });

    test('navigateScreen(home) closes the screen and opens Home', () {
      final t = run(const ShellState(activeTab: ShellTab.profile, activeScreen: 'settings'), (t) => navigateScreen(t, 'home'));
      expect(t.state, const ShellState());
      expect(t.effects, [const RestoreScroll('tab:profile')]);
      expect(run(const ShellState(), (t) => navigateScreen(t, 'help')).effects, [const SaveScroll('tab:home')]);
    });

    test('tool from Dashboard returns to Home; from the hub stays on the hub', () {
      final dash = run(const ShellState(), (t) => handleNavigateToTool(t, 'kick')).state;
      expect(dash, const ShellState(activeTab: ShellTab.tools, activeTool: 'kick', toolOpenedFromDashboard: true));
      expect(run(dash, handleToolBack).state, const ShellState());
      expect(run(const ShellState(activeTab: ShellTab.tools, activeTool: 'kick'), handleToolBack).state,
          const ShellState(activeTab: ShellTab.tools));
    });

    test('screen callbacks', () {
      expect(run(const ShellState(activeScreen: 'recovery'), (t) => screenOpensTool(t, 'exercise')).state,
          const ShellState(activeTab: ShellTab.tools, activeTool: 'exercise', toolOpenedFromDashboard: true));
      expect(run(const ShellState(activeScreen: 'baby-chat'), screenOpensAssistant).state, const ShellState(activeTab: ShellTab.ai));
      expect(run(const ShellState(), communityEditProfile).state,
          const ShellState(activeScreen: 'edit-profile', communityDeepLink: CommunityDeepLinkTarget(userId: 'me')));
      expect(run(const ShellState(viewingUserId: 'u'), (t) => userProfileSendMessage(t, 'u')).state,
          const ShellState(activeTab: ShellTab.community, communityDeepLink: CommunityDeepLinkTarget(dmUserId: 'u')));
      expect(run(const ShellState(viewingUserId: 'u'), userProfileEditProfile).state, const ShellState(
          activeTab: ShellTab.community, activeScreen: 'edit-profile', communityDeepLink: CommunityDeepLinkTarget(userId: 'me')));
      expect(run(const ShellState(activeScreen: 'notifications'), (t) => notificationsToCommunity(t, null)).state,
          const ShellState(activeTab: ShellTab.community));
    });

    test('opening a screen from a just-switched tab uses the committed tab (activeTabRef)', () {
      // Push to a partner: tab home + partner-shopping in one batch saves the previous tab's scroll.
      final t = run(const ShellState(activeTab: ShellTab.together), (t) => applyPushIntent(t, const PushNavIntent(shoppingList: true)), partner);
      expect(t.effects, [const RestoreScroll('tab:together'), const SaveScroll('tab:together')]);
      expect(t.state.activeScreen, 'partner-shopping');
      expect(t.state.activeTab, ShellTab.home);
    });
  });

  group('deeplink actions', () {
    final cases = <(String, ShellState, ParsedDeeplink, ShellState)>[
      ('tab clears tool and screen', const ShellState(activeTool: 'kick', activeScreen: 'help'),
          const ParsedDeeplink('tab', {'tab': 'community'}), const ShellState(activeTab: ShellTab.community)),
      ('tool opens on Tools from the hub', const ShellState(), const ParsedDeeplink('tool', {'tool_id': 'names'}),
          const ShellState(activeTab: ShellTab.tools, activeTool: 'names')),
      ('screen', const ShellState(), const ParsedDeeplink('screen', {'screen': 'legal/privacy'}),
          const ShellState(activeScreen: 'legal/privacy')),
      ('messages ignores the user id', const ShellState(), const ParsedDeeplink('messages', {'user_id': 'x'}),
          const ShellState(showMotherChat: true)),
      ('user profile', const ShellState(), const ParsedDeeplink('user-profile', {'user_id': 'x'}),
          const ShellState(viewingUserId: 'x')),
      ('community post', const ShellState(activeScreen: 'help'), const ParsedDeeplink('community-post', {'post_id': 'p'}),
          const ShellState(activeTab: ShellTab.community, communityDeepLink: CommunityDeepLinkTarget(postId: 'p'))),
    ];
    for (final (name, from, link, to) in cases) {
      test(name, () => expect(run(from, (t) => handleDeeplink(t, link)).state, to));
    }

    test('blog screen links remember the article; module links become an effect', () {
      expect(run(const ShellState(), (t) => handleDeeplink(t, const ParsedDeeplink('screen', {'screen': 'blog/a'}))).effects,
          [const RememberBlog('a'), const SaveScroll('tab:home')]);
      expect(run(const ShellState(), (t) => handleDeeplink(t, const ParsedDeeplink('blog-module', {'module': 'sleep', 'language': 'ru'}))).effects,
          [const ChangeLanguage('ru'), const OpenBlogModule('sleep')]);
    });

    test('tool links store the widget action (or clear it)', () {
      expect(run(const ShellState(), (t) => handleDeeplink(t, const ParsedDeeplink('tool', {'tool_id': 'x'}))).effects,
          [const SetWidgetAction(null)]);
    });
  });

  group('push intents (applyIntent)', () {
    const busy = ShellState(
      activeTab: ShellTab.tools, activeTool: 'kick', toolOpenedFromDashboard: true, showMotherChat: true, viewingUserId: 'u',
      activeScreen: 'settings', communityDeepLink: CommunityDeepLinkTarget(postId: 'p'), swipeRestore: SwipeRestoreMotherChat(),
    );
    final cases = <(String, PushNavIntent, ShellContext, ShellState)>[
      ('chat (woman)', const PushNavIntent(motherChat: true), woman,
          const ShellState(activeTab: ShellTab.tools, toolsResetKey: 1, showMotherChat: true)),
      ('chat (partner) → chat tab', const PushNavIntent(motherChat: true), partner, const ShellState(activeTab: ShellTab.chat, toolsResetKey: 1)),
      ('shopping (woman)', const PushNavIntent(shoppingList: true), woman,
          const ShellState(activeTab: ShellTab.tools, activeTool: 'shopping', toolOpenedFromDashboard: true, toolsResetKey: 1)),
      ('tool', const PushNavIntent(tool: 'parenting'), woman, const ShellState(activeTab: ShellTab.tools, activeTool: 'parenting', toolsResetKey: 1)),
      ('screen', const PushNavIntent(screen: 'billing'), woman, const ShellState(activeTab: ShellTab.tools, activeScreen: 'billing', toolsResetKey: 1)),
      ('home tab', const PushNavIntent(tab: 'home'), woman, const ShellState(toolsResetKey: 1)),
      ('community tab without target → {}', const PushNavIntent(tab: 'community'), woman,
          const ShellState(activeTab: ShellTab.community, communityDeepLink: CommunityDeepLinkTarget.empty, toolsResetKey: 1)),
      ('deeplink', const PushNavIntent(deeplink: ParsedDeeplink('tab', {'tab': 'ai'})), woman,
          const ShellState(activeTab: ShellTab.ai, toolsResetKey: 1)),
    ];
    for (final (name, intent, ctx, to) in cases) {
      test(name, () => expect(run(busy, (t) => applyPushIntent(t, intent), ctx).state, to));
    }
  });

  group('blog module, tour', () {
    test('show(module)', () {
      expect(run(const ShellState(activeScreen: 'x', showMotherChat: true, viewingUserId: 'u', activeTool: 't'),
              (t) => showBlogModule(t, 'diaper', lifeStage: 'mommy')).state,
          const ShellState(blogSection: 'diaper'));
      expect(run(const ShellState(), (t) => showBlogModule(t, 'babyGrowth', lifeStage: 'bump')).state,
          const ShellState(activeTab: ShellTab.tools, activeTool: 'baby-growth', toolOpenedFromDashboard: true, toolsResetKey: 1));
      expect(run(const ShellState(), (t) => showBlogModule(t, 'sleep', lifeStage: 'mommy'), partner).state,
          const ShellState(activeScreen: 'blog'));
    });

    test('tourNavigate: a tool through a fresh hub; the Tools tab resets; other tabs keep the tool', () {
      expect(run(const ShellState(activeScreen: 'x'), (t) => tourNavigate(t, const TourNav(tab: ShellTab.tools, tool: 'mood'))).state,
          const ShellState(activeTab: ShellTab.tools, activeTool: 'mood', toolsResetKey: 1));
      expect(run(const ShellState(activeTool: 'kick'), (t) => tourNavigate(t, const TourNav(tab: ShellTab.tools))).state,
          const ShellState(activeTab: ShellTab.tools, toolsResetKey: 1));
      expect(run(const ShellState(activeTool: 'kick', showMotherChat: true), (t) => tourNavigate(t, const TourNav(tab: ShellTab.community))).state,
          const ShellState(activeTab: ShellTab.community, activeTool: 'kick'));
      expect(run(const ShellState(activeTab: ShellTab.ai, activeScreen: 'x'), tourPreview).state, const ShellState());
    });
  });

  test('layers and screen views', () {
    const g = ShellGuardContext(role: 'woman', lifeStage: 'mommy', isAdmin: false, language: 'az', cakesAvailable: true);
    expect(layerFor(const ShellState(viewingUserId: 'u', activeScreen: 'help', showMotherChat: true), g), ShellLayer.userProfile);
    expect(layerFor(const ShellState(activeScreen: 'help', showMotherChat: true), g), ShellLayer.subScreen);
    expect(layerFor(const ShellState(activeScreen: 'name-voting', showMotherChat: true), g), ShellLayer.motherChat);
    expect(layerFor(const ShellState(activeScreen: 'name-voting'), g), ShellLayer.frame);
    expect(screenViewFor(const ShellState()), (name: 'Dashboard', screenClass: 'Tab'));
    expect(screenViewFor(const ShellState(activeTab: ShellTab.cakes)), (name: 'Cakes', screenClass: 'Tab'));
    expect(screenViewFor(const ShellState(activeTool: 'kick', activeScreen: 'shop')), (name: 'Shop', screenClass: 'Screen'));
  });
}
