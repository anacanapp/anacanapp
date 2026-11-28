// Ported from: src/hooks/useSwipeNavigation.ts (edge start, RTL), src/lib/backButton.ts (layer order) — the
//              interactive native back swipe of the Flutter shell (iOS)
import 'package:anacan/design/gallery.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import '../nav/shell_test_support.dart';

class App {
  App({bool edgeBack = true, void Function(FeatureRegistry r)? register}) {
    userProvider = NotifierProvider<TestUser, ShellUser>(() => TestUser(kWoman));
    register?.call(registry);
    container = ProviderContainer(overrides: [
      shellUserProvider.overrideWith((ref) => ref.watch(userProvider)),
      gateInputsProvider.overrideWithValue(readyInputs),
      gateActionsProvider.overrideWithValue(FakeGateActions()),
      unreadMessagesCountProvider.overrideWithValue(0),
      unreadCommunityPostsCountProvider.overrideWithValue(0),
      bottomNavStyleProvider.overrideWithValue(BottomNavStyle.capsule),
      shellPlatformProvider.overrideWithValue(platform),
      featureRegistryProvider.overrideWithValue(registry),
      edgeSwipeBackPlatformProvider.overrideWithValue(edgeBack),
    ]);
  }

  late final NotifierProvider<TestUser, ShellUser> userProvider;
  final FeatureRegistry registry = FeatureRegistry();
  final FakePlatform platform = FakePlatform();
  late final ProviderContainer container;

  ShellController get shell => container.read(shellProvider.notifier);
  ShellState get state => container.read(shellProvider);
  BackDispatcher get back => container.read(backDispatcherProvider);

  Future<void> pump(WidgetTester tester, {bool rtl = false}) async {
    GateHost.brandSplashShown = true;
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
        home: const AndroidBackScope(enabled: false, child: GateHost()),
      ),
    ));
    await tester.pump();
    await tester.pump();
  }
}

/// Horizontal translation (fraction of the width) of the slide layer holding [finder].
double slideOf(WidgetTester tester, Finder finder) => tester
    .widget<FractionalTranslation>(find.ancestor(of: finder, matching: find.byType(FractionalTranslation)).first)
    .translation
    .dx;

const _slow = Duration(milliseconds: 900);

void main() {
  setUpAll(loadAnacanFonts);

  testWidgets('a drag from the leading edge moves the screen with the finger and goes back past 35 %', (tester) async {
    final app = App(register: (r) => r.registerScreen(ScreenId.help, (c, a) => const Text('HELP')));
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();

    final g = await tester.startGesture(const Offset(5, 400));
    for (var i = 0; i < 10; i++) {
      await g.moveBy(const Offset(10, 0));
      await tester.pump(const Duration(milliseconds: 40));
    }
    expect(slideOf(tester, find.text('HELP')), greaterThan(0.2), reason: 'the layer follows the finger');
    expect(app.state.activeScreen, 'help', reason: 'nothing happens before release');
    for (var i = 0; i < 6; i++) {
      await g.moveBy(const Offset(10, 0));
      await tester.pump(const Duration(milliseconds: 40));
    }
    await tester.pump(const Duration(milliseconds: 400)); // finger rests: no fling
    await g.up();
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, isNull);
    expect(find.text('HELP'), findsNothing);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('released before 35 % without a flick, the screen springs back', (tester) async {
    final app = App(register: (r) => r.registerScreen(ScreenId.help, (c, a) => const Text('HELP')));
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    await tester.timedDragFrom(const Offset(5, 400), const Offset(90, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, 'help');
    expect(slideOf(tester, find.text('HELP')), 0);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('a fast flick from the edge goes back even when short', (tester) async {
    final app = App();
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    await tester.flingFrom(const Offset(5, 400), const Offset(80, 0), 1500);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, isNull);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('a drag that starts away from the edge does nothing', (tester) async {
    final app = App();
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    for (final x in [30.0, 120.0, 200.0]) {
      await tester.timedDragFrom(Offset(x, 400), const Offset(180, 0), _slow);
      await tester.pumpAndSettle();
      expect(app.state.activeScreen, 'help', reason: 'start x=$x');
    }
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('RTL: the back edge is the right one, dragged to the left', (tester) async {
    final app = App();
    await app.pump(tester, rtl: true);
    app.shell.openScreen('help');
    await tester.pump();
    await tester.timedDragFrom(const Offset(5, 400), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, 'help', reason: 'the left edge is not the back edge in RTL');
    await tester.timedDragFrom(const Offset(385, 400), const Offset(-250, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, isNull);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('root tabs have nothing to go back to: no slide, no tab switch, no exit toast', (tester) async {
    final app = App(register: (r) => r.registerTab(ShellTab.profile, (c, a) => const Text('PROFILE')));
    await app.pump(tester);
    app.shell.selectTab(ShellTab.profile);
    await tester.pump();
    await tester.timedDragFrom(const Offset(5, 400), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeTab, ShellTab.profile);
    expect(app.platform.exits, 0);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('same order and guards as the back button: feature handlers first, one layer per swipe', (tester) async {
    final app = App();
    await app.pump(tester);
    app.shell.openScreen('help');
    app.shell.viewUser('u1');
    await tester.pump();
    // A feature's inner view (screen layer) consumes the swipe first, like the back button.
    var inner = 0;
    final release = app.back.push(() {
      inner++;
      return true;
    });
    await tester.timedDragFrom(const Offset(5, 400), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect(inner, 1);
    expect((app.state.viewingUserId, app.state.activeScreen), ('u1', 'help'), reason: 'a guard kept the layer');
    release();
    // Root order: the viewed user first, then the screen; exactly one per swipe (the parity edge detector is off).
    await tester.timedDragFrom(const Offset(5, 400), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect((app.state.viewingUserId, app.state.activeScreen), (null, 'help'));
    await tester.timedDragFrom(const Offset(5, 400), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, isNull);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('the blog article slides over the mounted layer and closes alone', (tester) async {
    final app = App(register: (r) {
      r.registerScreen(ScreenId.help, (c, a) => const Text('HELP'));
      r.registerOverlay(ShellOverlayId.blogArticle, (c, a) => Text('ARTICLE ${a.slug}'));
    });
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    app.shell.openBlogOverlay('sleep');
    await tester.pump();
    final g = await tester.startGesture(const Offset(5, 400));
    for (var i = 0; i < 14; i++) {
      await g.moveBy(const Offset(12, 0));
      await tester.pump(const Duration(milliseconds: 40));
    }
    expect(slideOf(tester, find.text('ARTICLE sleep')), greaterThan(0.35));
    expect(slideOf(tester, find.text('HELP')), 0, reason: 'the layer below stays in place');
    await tester.pump(const Duration(milliseconds: 400));
    await g.up();
    await tester.pumpAndSettle();
    expect(find.text('ARTICLE sleep'), findsNothing);
    expect(app.state.activeScreen, 'help');
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('a carousel started near (not on) the edge scrolls; started on the edge, back wins', (tester) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    final app = App(register: (r) => r.registerScreen(
          ScreenId.help,
          (c, a) => SizedBox(
            height: 200,
            child: ListView(
              controller: controller,
              scrollDirection: Axis.horizontal,
              children: [for (var i = 0; i < 20; i++) SizedBox(width: 120, child: Text('card $i'))],
            ),
          ),
        ));
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    final y = tester.getCenter(find.text('card 0')).dy;
    await tester.timedDragFrom(Offset(60, y), const Offset(-150, 0), _slow);
    await tester.pumpAndSettle();
    expect(controller.offset, greaterThan(100));
    expect(app.state.activeScreen, 'help');
    await tester.timedDragFrom(Offset(5, y), const Offset(250, 0), _slow);
    await tester.pumpAndSettle();
    expect(app.state.activeScreen, isNull);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('off (Android: system back gesture) → the parity edge swipe of Index is unchanged', (tester) async {
    final app = App(edgeBack: false);
    await app.pump(tester);
    app.shell.openScreen('help');
    await tester.pump();
    await tester.dragFrom(const Offset(5, 400), const Offset(120, 0));
    await tester.pump();
    expect(app.state.activeScreen, isNull);
    expect(app.state.swipeRestore, const SwipeRestoreScreen('help'));
    await tester.pump(const Duration(seconds: 2));
  });

  test('edgeSwipeCanGoBack / edgeSwipeBack: root only for a visible layer or an open tool on Tools', () {
    final back = BackDispatcher();
    var rootCalls = 0;
    back.push(() {
      rootCalls++;
      return true;
    }, BackLayer.root);
    final guard = kWoman.guard;
    expect(edgeSwipeCanGoBack(back, const ShellState(activeTab: ShellTab.profile), guard), isFalse);
    expect(edgeSwipeBack(back, const ShellState(activeTab: ShellTab.profile), guard), isFalse);
    expect(rootCalls, 0);
    expect(edgeSwipeCanGoBack(back, const ShellState(activeTab: ShellTab.home, activeTool: 'kick'), guard), isFalse,
        reason: 'a stale tool behind another tab is not visible');
    expect(edgeSwipeCanGoBack(back, const ShellState(activeTab: ShellTab.tools, activeTool: 'kick'), guard), isTrue);
    expect(edgeSwipeCanGoBack(back, const ShellState(showMotherChat: true), guard), isTrue);
    expect(edgeSwipeBack(back, const ShellState(activeScreen: 'help'), guard), isTrue);
    expect(rootCalls, 1);
    final release = back.push(() => true, BackLayer.overlay);
    expect(edgeSwipeCanGoBack(back, const ShellState(), guard), isTrue);
    release();
  });
}
