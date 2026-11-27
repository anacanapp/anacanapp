// Ported from: (golden coverage of src/components/Dashboard.tsx MommyDashboard sections — self-generated Flutter
//              renders with fixture data; NOT compared pixel-wise to the web app)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/home_mommy/mommy_dashboard.dart';
import 'package:flutter/widgets.dart' hide FocusManager;
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import 'support/mommy_fixture.dart';
import 'support/mommy_harness.dart';

/// Sections scrolled to the top of the 390×844 viewport (null = page top).
const sections = <String, String?>{
  'top': null,
  'care': 'care-sleep',
  'summary': 'care-summary',
  'growth': 'milestone-rail',
};

void main() {
  setUpAll(() async {
    await ensureDateLocales();
    await loadAnacanFonts();
  });
  tearDown(DomainClock.reset);

  Future<void> golden(WidgetTester tester, String name, {Brightness brightness = Brightness.light, bool rtl = false, String? section}) async {
    resetChildrenSeedGuard();
    final h = MommyHarness(babyBirthDate: '2026-05-20');
    seedMommyFixture(h);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(mommyApp(
      overrides: h.overrides,
      brightness: brightness,
      direction: rtl ? TextDirection.rtl : TextDirection.ltr,
      locale: rtl ? const Locale('ar') : const Locale('az'),
      child: const MommyDashboard(),
    ));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    if (section != null) {
      final ctx = tester.element(find.byKey(ValueKey(section)));
      await tester.runAsync(() => Scrollable.ensureVisible(ctx));
      await tester.pump();
    }
    await settleSvgs(tester);
    await expectLater(find.byType(WidgetsApp), matchesGoldenFile('goldens/mommy_$name.png'));
    await h.finish(tester);
  }

  for (final b in [Brightness.light, Brightness.dark]) {
    final mode = b == Brightness.light ? 'light' : 'dark';
    for (final e in sections.entries) {
      testWidgets('mommy home ${e.key} $mode', (tester) => golden(tester, '${e.key}_$mode', brightness: b, section: e.value));
    }
  }
  testWidgets('mommy home top rtl', (tester) => golden(tester, 'top_rtl', rtl: true));
  testWidgets('mommy home care rtl', (tester) => golden(tester, 'care_rtl', rtl: true, section: 'care-sleep'));
}
