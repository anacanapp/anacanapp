// Ported from: (golden coverage of app/lib/design/gallery.dart — not compared to browser screenshots)
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

Future<void> _golden(WidgetTester tester, String name, Widget child, {bool dark = false, bool rtl = false, double height = 1600}) async {
  tester.view.physicalSize = Size(390, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(size: Size(390, height)),
      child: GalleryFrame(
        dark: dark,
        rtl: rtl,
        child: Builder(
          builder: (context) => ColoredBox(
            color: AnacanTokens.of(context).a.bg,
            child: Align(
              alignment: Alignment.topCenter,
              child: SingleChildScrollView(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8), child: child),
            ),
          ),
        ),
      ),
    ),
  );
  await settleSvgs(tester);
  await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  setUpAll(loadAnacanFonts);

  for (final dark in <bool>[false, true]) {
    final mode = dark ? 'dark' : 'light';
    testWidgets('primitives $mode', (tester) async {
      await _golden(tester, 'primitives_$mode', const GalleryPrimitives(animate: false), dark: dark, height: 2100);
    });
    testWidgets('typography $mode', (tester) async {
      await _golden(tester, 'typography_$mode', const GalleryTypography(), dark: dark, height: 420);
    });
    testWidgets('swatches $mode', (tester) async {
      await _golden(tester, 'swatches_$mode', const GallerySwatches(), dark: dark, height: 2000);
    });
  }

  testWidgets('primitives rtl', (tester) async {
    await _golden(tester, 'primitives_rtl', const GalleryPrimitives(animate: false), rtl: true, height: 2100);
  });
  testWidgets('typography rtl (Noto Sans Arabic)', (tester) async {
    await _golden(tester, 'typography_rtl', const GalleryTypography(), rtl: true, height: 420);
  });
  testWidgets('icons light', (tester) async {
    await _golden(tester, 'icons_light', const GalleryIcons(limit: 64), height: 420);
  });
}
