// Ported from: (golden of src/components/games/MiniGamesHub.tsx for the reference shot mommy.parity__mini-games,
//              390×844 light az, no saved progress)
import 'package:anacan/design/design.dart';
import 'package:anacan/features/games/hub/ui/mini_games_hub.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialApp;

import '../../../design/harness.dart';
import '../../../support/i18n_fakes.dart';
import '../ui_support.dart';

void main() {
  setUpAll(loadAnacanFonts);

  testWidgets('golden: mini games hub (reference shot mommy.parity__mini-games)', (tester) async {
    final env = GameTestEnv();
    installTestI18n();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: env.overrides(),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(data: const MediaQueryData(size: Size(390, 844), disableAnimations: true), child: nav!),
        home: Builder(
          builder: (context) => Material(color: context.a.bg, child: SingleChildScrollView(child: MiniGamesHub(onBack: () {}))),
        ),
      ),
    ));
    await settle(tester);
    await settleSvgs(tester);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/mini_games_hub_light.png'));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 5));
  });
}
