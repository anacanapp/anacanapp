// Ported from: src/components/blog/BlogLinkHost.test.tsx
//
// The shell owns BlogLinkHost's state (shell_controller.dart); this drives the blog feature's overlay registration
// through the real ShellScaffold with the article reader replaced, like the React test mocks BlogScreen.
import 'package:anacan/design/gallery.dart';
import 'package:anacan/features/blog/register.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/state.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../shell/nav/shell_test_support.dart';
import '../../support/i18n_fakes.dart';

class _Draft extends StatelessWidget {
  const _Draft();
  @override
  Widget build(BuildContext context) => Material(child: TextField(key: const ValueKey('draft'), decoration: const InputDecoration(labelText: 'Message draft')));
}

class _App {
  _App() {
    registry
      ..registerAll([registerBlogFeature])
      ..registerTab(ShellTab.home, (c, a) => const _Draft());
    container = ProviderContainer(overrides: [
      shellUserProvider.overrideWith((ref) => ref.watch(userProvider)),
      gateInputsProvider.overrideWithValue(readyInputs),
      gateActionsProvider.overrideWithValue(FakeGateActions()),
      unreadMessagesCountProvider.overrideWithValue(0),
      unreadCommunityPostsCountProvider.overrideWithValue(0),
      bottomNavStyleProvider.overrideWithValue(BottomNavStyle.capsule),
      shellPlatformProvider.overrideWithValue(FakePlatform()),
      featureRegistryProvider.overrideWithValue(registry),
      localStoreProvider.overrideWithValue(LocalStore.memory({})),
      blogArticleBuilderProvider.overrideWithValue((context, {required slug, required lifeStage, required onBack}) => Column(children: [
            Semantics(header: true, child: Text(slug)),
            GestureDetector(onTap: onBack, child: const Text('Return to conversation')),
          ])),
    ]);
  }

  final userProvider = NotifierProvider<TestUser, ShellUser>(() => TestUser(kWoman.copyWith(userId: 'user-a')));
  final FeatureRegistry registry = FeatureRegistry();
  late final ProviderContainer container;

  ShellController get shell => container.read(shellProvider.notifier);

  Future<void> pump(WidgetTester tester) async {
    installTestI18n();
    GateHost.brandSplashShown = true;
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: WidgetsApp(
        color: const Color(0xFFFFFFFF),
        localizationsDelegates: const [DefaultMaterialLocalizations.delegate, DefaultWidgetsLocalizations.delegate],
        pageRouteBuilder: <T>(RouteSettings s, WidgetBuilder b) => PageRouteBuilder<T>(settings: s, pageBuilder: (c, _, _) => b(c)),
        builder: (context, child) => GalleryFrame(child: child!),
        home: const AndroidBackScope(enabled: true, child: GateHost()),
      ),
    ));
    await tester.pump();
    await tester.pump();
  }
}

void main() {
  testWidgets('opens the exact linked article without losing the originating conversation draft', (tester) async {
    final app = _App();
    await app.pump(tester);
    final field = find.byKey(const ValueKey('draft'));
    await tester.enterText(field, 'Unsent message');
    final element = tester.element(field);
    app.shell.openAppBlogLink(blogLinks('exact-article').app);
    await tester.pump();
    expect(find.text('exact-article'), findsOneWidget);
    expect(element.mounted, isTrue, reason: 'the conversation below stays mounted');
    await tester.tap(find.text('Return to conversation'));
    await tester.pump();
    expect(find.text('exact-article'), findsNothing);
    expect(tester.element(find.byKey(const ValueKey('draft'))), same(element));
    expect(find.text('Unsent message'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('closes a linked article immediately when the account changes', (tester) async {
    final app = _App();
    await app.pump(tester);
    app.shell.openAppBlogLink(blogLinks('private-context').app);
    await tester.pump();
    expect(find.text('private-context'), findsOneWidget);
    app.container.read(app.userProvider.notifier).set(kWoman.copyWith(userId: 'user-b'));
    await tester.pump();
    expect(find.text('private-context'), findsNothing);
    await tester.pump(const Duration(seconds: 2));
  });
}
