// Ported from: src/pages/Index.pushNav.test.tsx (state-level: what Index renders after each step), plus the
//              Index effects the React suite does not cover (admin web, scroll memory, blog overlay, blog modules,
//              widget-action reopen, parenting links, language, analytics names, empty-tab reset)
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';

import 'shell_test_support.dart';

const sender = '01234567-89ab-4cde-8fab-0123456789ab';

void main() {
  late Harness h;
  tearDown(() => h.dispose());

  Future<void> open({ShellUser? user}) async {
    h = Harness(user: user);
    await h.start();
  }

  void deeplink(String action, [Map<String, String> params = const {}]) => h.shell.applyDeeplink(ParsedDeeplink(action, params));

  /// Index.pushNav.test `stackConflictingScreens` (the admin screen now opens the web admin).
  void stackConflictingScreens() {
    h.setUser(h.c.read(shellUserProvider).copyWith(isAdmin: true));
    deeplink('tool', {'tool_id': 'weight'});
    deeplink('messages');
    deeplink('user-profile', {'user_id': 'profile-user'});
    deeplink('screen', {'screen': 'admin'});
    expect(h.platform.external.single.toString(), 'https://app.anacan.az/admin?web=admin');
    expect(h.state.activeScreen, isNull);
    expect(h.layer, ShellLayer.userProfile);
    deeplink('screen', {'screen': 'settings'});
  }

  group('Index push navigation', () {
    for (final role in ['woman', 'partner']) {
      test('replaces all nested screens with an actual DM target for $role', () async {
        await open(user: role == 'partner' ? kPartner : kWoman);
        stackConflictingScreens();
        h.tap({'type': 'direct_message', 'sender_id': sender, 'userName': 'Forged name'});
        expect(h.layer, ShellLayer.frame);
        expect(h.state.activeTab, ShellTab.community);
        expect(h.state.communityDeepLink, const CommunityDeepLinkTarget(dmUserId: sender));
        expect(h.state.viewingUserId, isNull);
        expect(h.state.activeScreen, isNull);
        expect(h.state.showMotherChat, isFalse);
        expect(h.push.consumePending(), isNull);
        h.tap({'type': 'direct_message'});
        expect(h.state.communityDeepLink, const CommunityDeepLinkTarget(conversations: true));
        h.shell.selectTab(ShellTab.home);
        expect(h.state.activeTab, ShellTab.home);
        expect(h.layer, ShellLayer.frame);
      });

      test('opens the unified Messages inbox for $role even from a sub-screen', () async {
        await open(user: role == 'partner' ? kPartner : kWoman);
        h.shell.openScreen('settings');
        expect(h.layer, ShellLayer.subScreen);
        h.tap({'type': 'partner_message'});
        if (role == 'partner') {
          expect(h.layer, ShellLayer.frame);
          expect(h.state.activeTab, ShellTab.chat);
          h.shell.setTab(ShellTab.home); // partner chat tab onBack
        } else {
          expect(h.layer, ShellLayer.motherChat);
          h.shell.closeMotherChat();
        }
        expect(h.layer, ShellLayer.frame);
        expect(h.state.activeTab, ShellTab.home);
      });
    }

    test('opens the shopping tool even when ToolsHub has a different tool mounted', () async {
      await open();
      deeplink('tool', {'tool_id': 'weight'});
      expect(h.state.activeTab, ShellTab.tools);
      expect(h.state.activeTool, 'weight');
      final key = h.state.toolsResetKey;
      h.tap({'type': 'shopping_list'});
      expect(h.state.activeTool, 'shopping');
      expect(h.state.toolsResetKey, greaterThan(key), reason: 'ToolsHub remounts with the new initialTool');
      h.shell.toolBack();
      expect(h.state.activeTab, ShellTab.home);
      expect(h.state.activeTool, isNull);
    });

    test('opens partner-shopping and returns Home without an old sub-screen', () async {
      await open(user: kPartner);
      stackConflictingScreens();
      h.tap({'type': 'shopping_list'});
      expect(h.layer, ShellLayer.subScreen);
      expect(h.state.activeScreen, 'partner-shopping');
      h.shell.closeScreen();
      expect(h.layer, ShellLayer.frame);
      expect(h.state.activeTab, ShellTab.home);
    });

    for (final role in ['woman', 'partner']) {
      for (final type in ['sos_alert', 'birth_alert', 'sos', 'birth']) {
        test('mounts the frame (AlertReceiver) on Home for $role / $type from conflicting sub-screens', () async {
          await open(user: role == 'partner' ? kPartner : kWoman);
          stackConflictingScreens();
          expect(h.layer, isNot(ShellLayer.frame));
          h.tap({'type': type});
          expect(h.layer, ShellLayer.frame);
          expect(h.state.activeTab, ShellTab.home);
        });
      }
    }

    test('does not leave a hidden chat/profile behind a screen intent', () async {
      await open();
      deeplink('messages');
      deeplink('user-profile', {'user_id': 'profile-user'});
      expect(h.layer, ShellLayer.userProfile);
      h.tap({'type': 'subscription'});
      expect(h.layer, ShellLayer.subScreen);
      expect(h.state.activeScreen, 'billing');
      h.shell.closeScreen();
      expect(h.layer, ShellLayer.frame);
      expect(h.state.activeTab, ShellTab.home);
    });

    test('clears swipe-forward restoration when a push replaces the navigation stack', () async {
      await open();
      h.shell.openScreen('settings');
      h.shell.swipeBack();
      expect(h.layer, ShellLayer.frame);
      h.tap({'type': 'sos_alert'});
      h.shell.swipeForward();
      expect(h.layer, ShellLayer.frame);
      expect(h.state.activeScreen, isNull);
    });

    test('waits for the loaded role before consuming a cold-start shopping intent', () async {
      await open(user: kWoman.copyWith(authLoading: true, profileLoaded: false));
      h.tap({'type': 'shopping_list'});
      expect(h.state.activeTab, ShellTab.home);
      expect(h.state.activeTool, isNull);
      h.setUser(kPartner);
      expect(h.state.activeScreen, 'partner-shopping');
      expect(h.layer, ShellLayer.subScreen);
      expect(h.push.consumePending(), isNull);
    });

    test('a tap queued before the shell exists is applied once the shell attaches and is ready', () async {
      h = Harness();
      h.c.read(notificationTapQueueProvider).deliver({'type': 'subscription'}, nowMs: 1);
      await h.start();
      expect(h.state.activeScreen, 'billing');
    });

    test('does not replay a consumed warm intent after navigation or a role re-render', () async {
      await open();
      h.tap({'type': 'direct_message', 'sender_id': sender});
      expect(h.state.activeTab, ShellTab.community);
      h.shell.consumeCommunityDeepLink();
      expect(h.state.communityDeepLink, isNull);
      h.shell.selectTab(ShellTab.home);
      h.setUser(kPartner);
      expect(h.state.activeTab, ShellTab.home);
      expect(h.state.communityDeepLink, isNull);
    });

    test('preserves comment/story push targets and explicitly clears the target for a generic Community push', () async {
      await open();
      h.shell.openScreen('settings');
      h.tap({'type': 'community_reply', 'postId': 'post', 'commentId': 'comment'});
      expect(h.state.activeTab, ShellTab.community);
      expect(h.state.communityDeepLink, const CommunityDeepLinkTarget(postId: 'post', commentId: 'comment'));
      h.tap({'type': 'story_reply', 'storyId': 'story'});
      expect(h.state.communityDeepLink, const CommunityDeepLinkTarget(storyId: 'story'));
      h.tap({'type': 'community'});
      expect(h.state.communityDeepLink, CommunityDeepLinkTarget.empty);
    });

    final notif = <String, CommunityDeepLinkTarget>{
      'post': const CommunityDeepLinkTarget(postId: 'post'),
      'comment': const CommunityDeepLinkTarget(postId: 'post', commentId: 'comment'),
      'story': const CommunityDeepLinkTarget(storyId: 'story'),
    };
    for (final e in notif.entries) {
      test('preserves in-app notification ${e.key} navigation', () async {
        await open();
        h.shell.openScreen('notifications');
        h.shell.notificationsToCommunity(e.value);
        expect(h.state.activeTab, ShellTab.community);
        expect(h.state.communityDeepLink, e.value);
        expect(h.state.activeScreen, isNull);
        expect(h.layer, ShellLayer.frame);
      });
    }
  });

  group('shell effects', () {
    test('non-admins keep `admin` as an unrendered screen (tab frame stays, back clears it)', () async {
      await open();
      h.shell.openScreen('admin');
      expect(h.platform.external, isEmpty);
      expect(h.state.activeScreen, 'admin');
      expect(h.layer, ShellLayer.frame);
      expect(h.shell.back(), isTrue);
      expect(h.state.activeScreen, isNull);
    });

    test('openAdminWeb opens the admitted host', () async {
      await open(user: const ShellUser(
          isAuthenticated: true, authLoading: false, profileLoaded: true, language: 'az', backendUrl: 'https://gcp.anacan.az', isAdmin: true));
      h.shell.openAdminWeb();
      await Future<void>.delayed(Duration.zero);
      expect(h.platform.external.single.toString(), 'https://gcp.anacan.az/admin?web=admin');
    });

    test('opening a screen saves the tab scroll; closing restores it after the reset to top', () async {
      await open();
      h.container.offset = 640;
      h.shell.openScreen('settings');
      expect(h.memory.saved('tab:home'), 640);
      h.container.offset = 0;
      h.shell.closeScreen();
      h.scheduler.advance(250);
      expect(h.container.offset, 640);
    });

    test('switching tabs keeps a position per tab', () async {
      await open();
      h.container.offset = 300;
      h.shell.selectTab(ShellTab.community);
      h.scheduler.advance(250);
      expect(h.container.offset, 0, reason: 'community has no saved position → top');
      h.container.offset = 120;
      h.shell.selectTab(ShellTab.home);
      h.scheduler.advance(250);
      expect(h.container.offset, 300);
      expect(h.memory.saved('tab:community'), 120);
    });

    test('Tools tab tap resets to the hub list and remounts it', () async {
      await open();
      h.shell.openTool(ToolId.kick);
      expect(h.state.toolOpenedFromDashboard, isTrue);
      final key = h.state.toolsResetKey;
      h.shell.selectTab(ShellTab.tools);
      expect(h.state.activeTool, isNull);
      expect(h.state.toolOpenedFromDashboard, isFalse);
      expect(h.state.toolsResetKey, key + 1);
    });

    test('deeplink language switches the app language first', () async {
      await open();
      h.shell.openUrl('anacan://tools?language=ru');
      await Future<void>.delayed(Duration.zero);
      expect(h.platform.languages, ['ru']);
      expect(h.state.activeTab, ShellTab.tools);
    });

    test('a widget action for the open tool closes it and reopens it on the next tick', () async {
      await open();
      h.shell.openUrl('anacan://tool/baby-tracker?widget_action=feed');
      expect(h.state.activeTool, 'baby-tracker');
      expect(h.c.read(widgetActionStoreProvider).consume(), 'feed');
      h.shell.openUrl('anacan://tool/baby-tracker?widget_action=sleep');
      expect(h.state.activeTool, isNull);
      await Future<void>.delayed(Duration.zero);
      expect(h.state.activeTool, 'baby-tracker');
      expect(h.c.read(widgetActionStoreProvider).consume(), 'sleep');
    });

    test('a Tərbiyə item link opens the mother tool or the partner screen on that item', () async {
      await open();
      h.shell.openUrl('anacan://parenting/sos/shop-tantrum');
      expect(h.state.activeTab, ShellTab.tools);
      expect(h.state.activeTool, 'parenting');
      expect(h.c.read(parentingTargetStoreProvider).peek(), const ParentingTarget('sos', 'shop-tantrum'));
      h.setUser(kPartner);
      h.shell.openUrl('anacan://parenting/article/a-1');
      expect(h.state.activeScreen, 'partner-parenting');
    });

    test('blog module links: calendar, tools, mommy home section, other stages → blog', () async {
      await open();
      h.shell.openUrl('anacan:///?blog_module=calendar');
      expect(h.state.activeScreen, 'calendar');
      h.shell.openUrl('anacan:///?blog_module=hospitalBag');
      expect((h.state.activeTab, h.state.activeTool, h.state.toolOpenedFromDashboard), (ShellTab.tools, 'hospital', true));
      h.shell.openUrl('anacan:///?blog_module=sleep');
      expect((h.state.activeTab, h.state.blogSection, h.state.activeTool), (ShellTab.home, 'sleep', null));
      h.shell.clearBlogSection();
      h.setUser(kWoman.copyWith(lifeStage: 'bump'));
      h.shell.openUrl('anacan:///?blog_module=feeding');
      expect(h.state.activeScreen, 'blog');
    });

    test('a blog module opened before the profile is ready waits for it', () async {
      await open(user: kWoman.copyWith(profileLoaded: false));
      h.shell.openBlogModule('calendar');
      expect(h.state.activeScreen, isNull);
      h.setUser(kWoman);
      expect(h.state.activeScreen, 'calendar');
    });

    test('blog article overlay: opens over the screen, back closes it, push closes it, another account closes it', () async {
      await open();
      h.shell.openScreen('settings');
      expect(h.shell.openAppBlogLink('https://api.anacan.az/blog/sleep-guide'), isTrue);
      expect(h.shell.blogOverlayOpen, isTrue);
      expect(h.shell.swipeEnabled, isFalse);
      expect(h.c.read(backDispatcherProvider).dispatch(), isTrue);
      expect(h.shell.blogOverlayOpen, isFalse);
      expect(h.state.activeScreen, 'settings', reason: 'the screen below stays');
      h.shell.openBlogOverlay('a');
      h.tap({'type': 'like'});
      expect(h.shell.blogOverlayOpen, isFalse);
      h.shell.openBlogOverlay('b');
      h.setUser(kWoman.copyWith(userId: 'someone-else'));
      expect(h.state.blogOverlay, isNull);
    });

    test('an article link before sign-in is kept and opens as the blog screen once ready', () async {
      await open(user: kWoman.copyWith(profileLoaded: false));
      h.shell.openBlogOverlay('sleep-guide');
      expect(h.state.blogOverlay, isNull);
      h.setUser(kWoman);
      expect(h.state.activeScreen, 'blog/sleep-guide');
    });

    test('analytics screen names', () async {
      await open();
      h.shell.selectTab(ShellTab.tools);
      h.shell.openTool(ToolId.kick, fromDashboard: false);
      h.shell.openScreen('settings');
      expect(h.platform.views, [('ToolsHub', 'Tab'), ('kick', 'Tools'), ('settings', 'Screen')]);
    });

    test('an unavailable tab (cakes elsewhere) resets to home', () async {
      await open(user: kWoman.copyWith(language: 'en'));
      h.shell.openUrl('anacan://cakes');
      expect(h.state.activeTab, ShellTab.home);
      h.setUser(kWoman);
      h.shell.openUrl('anacan://cakes');
      expect(h.state.activeTab, ShellTab.cakes);
      h.setUser(kWoman.copyWith(language: 'en'));
      expect(h.state.activeTab, ShellTab.home);
    });

    test('website push links open in the browser, unknown trusted pages fall back to the type', () async {
      await open();
      h.tap({'deeplink': 'https://anacan.az/kampaniya'});
      await Future<void>.delayed(const Duration(milliseconds: 400));
      expect(h.platform.external.single.toString(), 'https://anacan.az/kampaniya');
      h.platform.webPageResult = false;
      h.tap({'type': 'subscription', 'deeplink': 'https://app.anacan.az/no-such-route'});
      await Future<void>.delayed(Duration.zero);
      expect(h.platform.webPages.single.toString(), 'https://app.anacan.az/no-such-route');
      expect(h.state.activeScreen, 'billing');
    });

    test('the root back handler is registered on the root layer', () async {
      await open();
      final d = h.c.read(backDispatcherProvider);
      expect(d.count(BackLayer.root), 1);
      h.shell.selectTab(ShellTab.profile);
      expect(d.dispatch(), isTrue);
      expect(h.state.activeTab, ShellTab.home);
      expect(d.dispatch(), isFalse);
    });
  });
}
