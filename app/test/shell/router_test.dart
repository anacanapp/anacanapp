// Ported from: src/pages/AppPathLink.test.tsx (404 vs known app path, signed-in hand-off, kept until sign-in),
//              src/App.tsx routes, src/pages/BlogLink.tsx (native)
import 'package:anacan/design/gallery.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'nav/shell_test_support.dart';

void main() {
  group('resolveOuterRoute', () {
    final table = <String, OuterRoute>{
      '/': const OuterIndex(),
      '': const OuterIndex(),
      '/blog/sleep-guide': const OuterBlogLink('sleep-guide'),
      '/blog/sleep-guide/': const OuterBlogLink('sleep-guide'),
      '/blog/ru/sleep-guide': const OuterBlogLink('sleep-guide'),
      '/blog/k%C3%B6rp%C9%99': const OuterBlogLink('körpə'),
      '/reset-password': const OuterPage(OuterRouteId.resetPassword),
      '/reset-password/': const OuterPage(OuterRouteId.resetPassword),
      '/legal/privacy_policy': const OuterPage(OuterRouteId.legal, {'docType': 'privacy_policy'}),
      '/payment/success': const OuterPage(OuterRouteId.paymentSuccess),
      '/payment/error': const OuterPage(OuterRouteId.paymentError),
      '/mini-games': const OuterPage(OuterRouteId.miniGames),
      '/tools': const OuterAppLink('anacan://tools'),
      '/tool/kick-counter': const OuterAppLink('anacan://tool/kick-counter'),
      '/community/post/abc-123': const OuterAppLink('anacan://community/post/abc-123'),
      '/does-not-exist': const OuterPage(OuterRouteId.notFound),
      '/blog': const OuterPage(OuterRouteId.notFound),
      '/admin': const OuterPage(OuterRouteId.notFound),
      '/moderator': const OuterPage(OuterRouteId.notFound),
      '/p/v/token': const OuterPage(OuterRouteId.notFound),
      '/h/EXPO-26': const OuterPage(OuterRouteId.notFound),
      '/debug/revenuecat': const OuterPage(OuterRouteId.notFound),
    };
    for (final e in table.entries) {
      test("'${e.key}'", () => expect(resolveOuterRoute(e.key), e.value));
    }
    test('language query is carried for app paths', () {
      expect(resolveOuterRoute('/tools', '?language=ru&x=1'), const OuterAppLink('anacan://tools?language=ru'));
    });
  });

  group('AppPathLink (go_router)', () {
    late NotifierProvider<TestUser, ShellUser> userProvider;
    late ProviderContainer container;
    late FakePlatform platform;

    Future<void> pumpAt(WidgetTester tester, String location, ShellUser user) async {
      GateHost.brandSplashShown = true;
      userProvider = NotifierProvider<TestUser, ShellUser>(() => TestUser(user));
      platform = FakePlatform();
      final registry = FeatureRegistry()
        ..registerRoutePage(OuterRouteId.notFound, (c, a) => const Text('404'))
        ..registerRoutePage(OuterRouteId.legal, (c, a) => Text('LEGAL ${a.params['docType']}'));
      container = ProviderContainer(overrides: [
        shellUserProvider.overrideWith((ref) => ref.watch(userProvider)),
        gateInputsProvider.overrideWithValue(readyInputs),
        gateActionsProvider.overrideWithValue(FakeGateActions()),
        unreadMessagesCountProvider.overrideWithValue(0),
        unreadCommunityPostsCountProvider.overrideWithValue(0),
        bottomNavStyleProvider.overrideWithValue(BottomNavStyle.capsule),
        shellPlatformProvider.overrideWithValue(platform),
        featureRegistryProvider.overrideWithValue(registry),
      ]);
      addTearDown(container.dispose);
      final router = buildShellRouter(initialLocation: location);
      addTearDown(router.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: WidgetsApp.router(
          color: const Color(0xFFFFFFFF),
          routerConfig: router,
          builder: (context, child) => GalleryFrame(child: child!),
        ),
      ));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('shows the 404 card for unknown paths', (tester) async {
      await pumpAt(tester, '/does-not-exist', kWoman);
      expect(find.text('404'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('signed in: opens the shared screen through the in-app router', (tester) async {
      await pumpAt(tester, '/tool/kick-counter', kWoman);
      await tester.pump();
      expect(container.read(shellProvider).activeTab, ShellTab.tools);
      expect(container.read(shellProvider).activeTool, 'kick-counter');
      expect(find.byType(ShellScaffold), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('signed out: goes home and keeps the link until sign-in', (tester) async {
      await pumpAt(tester, '/community/post/abc-123', kWoman.copyWith(isAuthenticated: false));
      await tester.pump();
      expect(container.read(appLinkStoreProvider).take(nowMs: DateTime.now().millisecondsSinceEpoch), 'anacan://community/post/abc-123');
      // Put it back and sign in (e.g. back from the Google sign-in redirect).
      container.read(appLinkStoreProvider).remember('anacan://community/post/abc-123', nowMs: DateTime.now().millisecondsSinceEpoch);
      container.read(userProvider.notifier).set(kWoman);
      await tester.pump();
      await tester.pump();
      expect(container.read(shellProvider).activeTab, ShellTab.community);
      expect(container.read(shellProvider).communityDeepLink, const CommunityDeepLinkTarget(postId: 'abc-123'));
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('native blog link remembers the article and opens it as the blog screen', (tester) async {
      await pumpAt(tester, '/blog/en/sleep-guide', kWoman.copyWith(profileLoaded: false));
      container.read(userProvider.notifier).set(kWoman);
      await tester.pump();
      expect(container.read(shellProvider).activeScreen, 'blog/sleep-guide');
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('legal route with its parameter', (tester) async {
      await pumpAt(tester, '/legal/terms_of_service/', kWoman);
      expect(find.text('LEGAL terms_of_service'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
    });
  });
}
