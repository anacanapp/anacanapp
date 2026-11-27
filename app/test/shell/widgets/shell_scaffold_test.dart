// Ported from: src/pages/Index.tsx (frame vs sub-screen layers, scroll memory, enter animation, swipe, back,
//              gates → shell) — widget-level checks of the Flutter shell
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import '../nav/shell_test_support.dart';

class GateInputsN extends Notifier<GateInputs> {
  GateInputsN(this.initial);
  final GateInputs initial;
  @override
  GateInputs build() => initial;
  void set(GateInputs v) => state = v;
}

class App {
  App({ShellUser? user, GateInputs inputs = readyInputs, void Function(FeatureRegistry r)? register}) {
    userProvider = NotifierProvider<TestUser, ShellUser>(() => TestUser(user ?? kWoman));
    gateProvider = NotifierProvider<GateInputsN, GateInputs>(() => GateInputsN(inputs));
    register?.call(registry);
    container = ProviderContainer(overrides: [
      shellUserProvider.overrideWith((ref) => ref.watch(userProvider)),
      gateInputsProvider.overrideWith((ref) => ref.watch(gateProvider)),
      gateActionsProvider.overrideWithValue(actions),
      unreadMessagesCountProvider.overrideWithValue(0),
      unreadCommunityPostsCountProvider.overrideWithValue(0),
      bottomNavStyleProvider.overrideWithValue(BottomNavStyle.capsule),
      shellPlatformProvider.overrideWithValue(platform),
      featureRegistryProvider.overrideWithValue(registry),
    ]);
  }

  late final NotifierProvider<TestUser, ShellUser> userProvider;
  late final NotifierProvider<GateInputsN, GateInputs> gateProvider;
  final FeatureRegistry registry = FeatureRegistry();
  final FakePlatform platform = FakePlatform();
  final FakeGateActions actions = FakeGateActions();
  late final ProviderContainer container;

  ShellController get shell => container.read(shellProvider.notifier);
  ShellState get state => container.read(shellProvider);

  Future<void> pump(WidgetTester tester, {bool splash = false, bool rtl = false}) async {
    GateHost.brandSplashShown = !splash;
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: WidgetsApp(
        color: const Color(0xFFFFFFFF),
        pageRouteBuilder: <T>(RouteSettings s, WidgetBuilder b) => PageRouteBuilder<T>(settings: s, pageBuilder: (c, _, _) => b(c)),
        builder: (context, child) => GalleryFrame(rtl: rtl, child: child!),
        home: const AndroidBackScope(enabled: true, child: GateHost()),
      ),
    ));
    await tester.pump();
    await tester.pump();
  }
}

Finder placeholder(String id) => find.byKey(ValueKey('placeholder-$id'));

void main() {
  setUpAll(loadAnacanFonts);

  testWidgets('splash, then the intro timer, then the shell; side effects reach the store', (tester) async {
    final app = App(inputs: const GateInputs(
      hasSelectedLanguage: false, hasSeenIntro: false, isOnboarded: true, isAuthenticated: true, authLoading: false,
      hasUser: true, profileLoaded: true, hasProfile: true, profileCountryCode: 'AZ', profileName: 'A', hasCompletedFunnel: false,
    ));
    await app.pump(tester, splash: true);
    expect(placeholder('gate:splash'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 400));
    expect(placeholder('tab:home'), findsOneWidget, reason: 'splash done at 350 ms; intro not yet');
    expect(app.actions.calls, containsAll(['language:true', 'funnel:true']));
    await tester.pump(const Duration(milliseconds: 1200));
    expect(placeholder('gate:intro'), findsOneWidget, reason: '1 500 ms timer shows the intro');
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('gates render registered widgets and pass the intro callback', (tester) async {
    final app = App(
      inputs: const GateInputs(hasSelectedLanguage: true, hasSeenIntro: true, isOnboarded: true, isAuthenticated: false, authLoading: false, hasUser: false),
      register: (r) => r.registerGate(GateId.auth, (context, args) => const Text('AUTH')),
    );
    await app.pump(tester);
    expect(find.text('AUTH'), findsOneWidget);
    app.container.read(app.gateProvider.notifier).set(readyInputs);
    await tester.pump();
    expect(placeholder('tab:home'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('frame: tabs from the registry, nav switches tabs, screens replace the frame, back closes them', (tester) async {
    final app = App(register: (r) {
      r.registerTab(ShellTab.home, (c, a) => const Text('HOME'));
      r.registerScreen(ScreenId.settings, (c, a) => GestureDetector(onTap: a.onBack, child: const Text('SETTINGS')));
    });
    await app.pump(tester);
    expect(find.text('HOME'), findsOneWidget);
    expect(find.byType(BottomNavBar), findsOneWidget);
    await tester.tap(find.byKey(BottomNavBar.itemKey(ShellTab.profile)));
    await tester.pump();
    expect(placeholder('tab:profile'), findsOneWidget);
    app.shell.openScreen('settings');
    await tester.pump();
    expect(find.text('SETTINGS'), findsOneWidget);
    expect(find.byType(BottomNavBar), findsNothing, reason: 'sub-screens are full screen');
    expect(find.byType(SubScreenFrame), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(placeholder('tab:profile'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('HOME'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('an unregistered screen shows a placeholder with a back control; ad-preferences returns to settings', (tester) async {
    final app = App();
    await app.pump(tester);
    app.shell.openScreen('ad-preferences');
    await tester.pump();
    expect(placeholder('screen:ad-preferences'), findsOneWidget);
    await tester.tap(find.text('←'));
    await tester.pump();
    expect(app.state.activeScreen, 'settings');
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('partner role renders the partner tab variants; community is shared', (tester) async {
    final app = App(user: kPartner, register: (r) {
      r.registerTab(ShellTab.home, (c, a) => const Text('WOMAN HOME'));
      r.registerTab(ShellTab.home, (c, a) => const Text('PARTNER HOME'), partner: true);
      r.registerTab(ShellTab.community, (c, a) => Text('COMMUNITY partner=${a.partner}'));
    });
    await app.pump(tester);
    expect(find.text('PARTNER HOME'), findsOneWidget);
    expect(find.bySemanticsLabel('Birlikdə'), findsOneWidget);
    app.shell.openUrl('anacan://community');
    await tester.pump();
    expect(find.text('COMMUNITY partner=false'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('the tab scroll position is kept across a sub-screen and per tab', (tester) async {
    final app = App(register: (r) {
      r.registerTab(ShellTab.home, (c, a) => const SizedBox(height: 3000, child: Text('HOME')));
      r.registerTab(ShellTab.community, (c, a) => const SizedBox(height: 3000, child: Text('COMMUNITY')));
    });
    await app.pump(tester);
    ScrollPosition pos() => tester.state<ScrollableState>(find.descendant(
        of: find.byKey(const ValueKey('shell-scroll')), matching: find.byType(Scrollable))).position;
    pos().jumpTo(500);
    app.shell.openScreen('help');
    await tester.pump();
    app.shell.closeScreen();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(pos().pixels, 500);
    await tester.tap(find.byKey(BottomNavBar.itemKey(ShellTab.community)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(pos().pixels, 0);
    pos().jumpTo(250);
    await tester.tap(find.byKey(BottomNavBar.itemKey(ShellTab.home)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(pos().pixels, 500);
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('tab enter: opacity 0 → 1 over 300 ms and y 10 → 0; no exit animation', (tester) async {
    final app = App(register: (r) => r.registerTab(ShellTab.home, (c, a) => const Text('HOME')));
    await app.pump(tester);
    await tester.tap(find.byKey(BottomNavBar.itemKey(ShellTab.profile)));
    await tester.pump();
    expect(find.text('HOME'), findsNothing, reason: 'the old tab is gone at once');
    Opacity opacity() => tester.widget<Opacity>(find.ancestor(of: placeholder('tab:profile'), matching: find.byType(Opacity)).first);
    expect(opacity().opacity, lessThan(0.1));
    await tester.pump(const Duration(milliseconds: 150));
    expect(opacity().opacity, inExclusiveRange(0.1, 1));
    await tester.pump(const Duration(milliseconds: 400));
    expect(opacity().opacity, 1);
    final dy = tester.widget<Transform>(find.ancestor(of: placeholder('tab:profile'), matching: find.byType(Transform)).first);
    expect(dy.transform.getTranslation().y.abs(), lessThan(0.5));
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('edge swipe back closes the screen, swipe forward reopens it (RTL mirrored)', (tester) async {
    for (final rtl in [false, true]) {
      final app = App();
      await app.pump(tester, rtl: rtl);
      app.shell.openScreen('help');
      await tester.pump();
      final backStart = rtl ? const Offset(385, 400) : const Offset(5, 400);
      final dir = rtl ? -1.0 : 1.0;
      await tester.dragFrom(backStart, Offset(120 * dir, 0));
      await tester.pump();
      expect(app.state.activeScreen, isNull, reason: 'rtl=$rtl');
      final fwdStart = rtl ? const Offset(5, 400) : const Offset(385, 400);
      await tester.dragFrom(fwdStart, Offset(-120 * dir, 0));
      await tester.pump();
      expect(app.state.activeScreen, 'help', reason: 'rtl=$rtl');
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpWidget(const SizedBox());
    }
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('user profile and messages layers; blog article over everything', (tester) async {
    final app = App(register: (r) {
      r.registerOverlay(ShellOverlayId.userProfile, (c, a) => Text('USER ${a.userId}'));
      r.registerOverlay(ShellOverlayId.blogArticle, (c, a) => Text('ARTICLE ${a.slug}'));
    });
    await app.pump(tester);
    app.shell.viewUser('u1');
    await tester.pump();
    expect(find.text('USER u1'), findsOneWidget);
    app.shell.openBlogOverlay('sleep-guide');
    await tester.pump();
    expect(find.text('ARTICLE sleep-guide'), findsOneWidget);
    expect(find.text('USER u1'), findsOneWidget, reason: 'the screen below stays mounted');
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('ARTICLE sleep-guide'), findsNothing);
    app.shell.closeUserProfile();
    app.shell.openMotherChat();
    await tester.pump();
    expect(placeholder('overlay:motherChat'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });

  testWidgets('frame overlays sit between the content and the nav; redesign background per tab', (tester) async {
    final app = App(register: (r) => r.registerFrameOverlay('timer', (c) => const Positioned(top: 10, left: 10, child: Text('TIMER'))));
    await app.pump(tester);
    expect(find.text('TIMER'), findsOneWidget);
    final ctx = tester.element(find.byType(ShellFrame));
    final frameBox = tester.widget<ColoredBox>(find.descendant(of: find.byType(ShellFrame), matching: find.byType(ColoredBox)).first);
    expect(frameBox.color, AnacanTokens.of(ctx).a.bg, reason: 'mommy home is a redesigned screen');
    await tester.pump(const Duration(seconds: 2)); // let scroll retries / timers finish
  });
}
