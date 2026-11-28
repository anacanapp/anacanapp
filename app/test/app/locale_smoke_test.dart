// Ported from: src/App.tsx (DirectionProvider: `dir` from the language), src/components/BottomNav.tsx (womanTabs),
//              src/pages/Index.tsx (renderContent per tab) — no vitest file.
//
// Smoke test: the routed app with the real feature registry and the bundled dictionaries, on a 360×640 phone, in
// Arabic (RTL) and the languages with the longest UI strings (de, ru, kk, ky). Every main tab is shown; a layout
// overflow or any other exception fails the test. Fake backend (every read answers []) and a pregnant, onboarded
// user in the local store, so this checks the empty / first-run states of the tabs, not populated feeds.
import 'package:anacan/app/anacan_app.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../design/harness.dart' show loadAnacanFonts;
import 'app_test_support.dart';

const List<ShellTab> _mainTabs = [ShellTab.home, ShellTab.tools, ShellTab.community, ShellTab.ai, ShellTab.profile];

void main() {
  setUpAll(() async {
    await loadAnacanFonts();
    await ensureDateLocales();
  });

  for (final lang in ['ar', 'de', 'ru', 'kk', 'ky']) {
    testWidgets('$lang: the main tabs lay out at 360×640 without overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')));
      I18nRuntime.instance = runtime;
      await tester.runAsync(() => runtime.ensureLanguageReady(lang));
      runtime.setLanguageInMemory(lang);
      GateHost.brandSplashShown = false;

      final store = LocalStore.memory({
        'anacan-user-store': '{"state":{"language":"$lang","isOnboarded":true,"name":"Aysel","lifeStage":"bump",'
            '"dueDate":"2027-03-01T00:00:00.000Z"},"version":0}',
        'language': lang,
      });
      await tester.pumpWidget(AnacanApp(
        createContainer: () => testAppContainer(store: store, user: kWoman.copyWith(language: lang)),
        runStartup: FakeStartup([fakeReady()]).call,
        prepare: noPrepare,
        watchAdmission: false,
      ));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.byType(ShellScaffold), findsOneWidget);
      expect(Directionality.of(tester.element(find.byType(ShellScaffold))), lang == 'ar' ? TextDirection.rtl : TextDirection.ltr);

      final container = tester.state<AnacanAppState>(find.byType(AnacanApp)).container!;
      for (final tab in _mainTabs) {
        container.read(shellProvider.notifier).setTab(tab);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));
        await tester.pump(const Duration(milliseconds: 600));
        expect(tester.takeException(), isNull, reason: '$lang / ${tab.id}');
        expect(container.read(shellProvider).activeTab, tab);
        // The tab rendered its own content (more than the five bottom-nav labels).
        expect(find.byType(Text).evaluate().length, greaterThan(5), reason: '$lang / ${tab.id}');
      }

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 2));
    });
  }
}
