// Ported from: (golden coverage of the bump home in src/components/Dashboard.tsx — self-generated Flutter renders
// used as regression baselines; compared by eye with tools/reference-shots/out/**/bump.tabs__home*.png, see README)
import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:anacan/features/home/dashboard.dart';
import 'package:anacan/features/home/bump/fetus_hero_image.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'home_fixtures.dart';
import 'home_test_support.dart';

void main() {
  setUpAll(() async {
    await loadAnacanFonts();
    await ensureDateLocales();
  });
  setUp(() async {
    await installRealI18n();
    resetIllustrationCacheForTests();
  });

  Future<void> shot(WidgetTester tester, String name, {bool dark = false, bool rtl = false, double scroll = 0}) async {
    final env = HomeTestEnv(now: fixtureNow, lastPeriod: fixtureLmp);
    addTearDown(env.dispose);
    registerBumpHomeBody();
    seedBumpFixtures(env.repo);
    phoneSurface(tester);
    await tester.pumpWidget(
      env.wrap(
        Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            // The shell's scroll container pads the bottom by pb-nav (108 + safe area).
            child: Padding(
              padding: const EdgeInsets.only(bottom: 108),
              child: Dashboard(now: () => fixtureNow),
            ),
          ),
        ),
        dark: dark,
        rtl: rtl,
      ),
    );
    await goldenSettle(tester);
    if (scroll > 0) {
      final pos = tester
          .state<ScrollableState>(find.descendant(of: find.byKey(const ValueKey('test-scroll')), matching: find.byType(Scrollable)).first)
          .position;
      pos.jumpTo(scroll.clamp(0, pos.maxScrollExtent));
      await tester.pump();
      await settleSvgs(tester);
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
  }

  testWidgets('bump home top light', (tester) => shot(tester, 'bump_home_top_light'));
  testWidgets('bump home section 2 light', (tester) => shot(tester, 'bump_home_2_light', scroll: 844));
  testWidgets('bump home section 3 light', (tester) => shot(tester, 'bump_home_3_light', scroll: 1688));
  testWidgets('bump home top dark', (tester) => shot(tester, 'bump_home_top_dark', dark: true));
  testWidgets('bump home section 2 dark', (tester) => shot(tester, 'bump_home_2_dark', dark: true, scroll: 844));
  testWidgets('bump home top rtl', (tester) => shot(tester, 'bump_home_top_rtl', rtl: true));
}
