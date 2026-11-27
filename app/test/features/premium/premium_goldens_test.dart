// Ported from: (goldens) — Flutter renders of src/components/PremiumModal.tsx + PaywallCore.tsx and the premium gates,
// regression baselines only (not compared against the web).
import 'package:anacan/features/premium/ad_free_premium_offer.dart';
import 'package:anacan/features/premium/premium_gates.dart';
import 'package:anacan/features/premium/premium_modal.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../onboarding/support.dart';

Future<void> shoot(WidgetTester tester, OnboardingTestEnv env, Widget child, String name, {bool dark = false}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await loadAnacanFonts();
  await tester.pumpWidget(env.wrap(child, dark: dark, rtl: env.language == 'ar'));
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
  await settleSvgs(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  for (final dark in [false, true]) {
    testWidgets('premium modal ${dark ? 'dark' : 'light'}', (tester) async {
      final env = OnboardingTestEnv(native: true);
      env.container.read(userStoreProvider.notifier).setLifeStage('mommy');
      addTearDown(env.dispose);
      await shoot(tester, env, PremiumModalView(feature: 'ai_chat', onClose: () {}), 'premium_modal_${dark ? 'dark' : 'light'}', dark: dark);
    });
  }
  testWidgets('premium modal rtl', (tester) async {
    final env = OnboardingTestEnv(language: 'ar', native: true);
    addTearDown(env.dispose);
    await shoot(tester, env, PremiumModalView(onClose: () {}), 'premium_modal_ar');
  });
  testWidgets('premium gates', (tester) async {
    final env = OnboardingTestEnv();
    addTearDown(env.dispose);
    await shoot(
      tester,
      env,
      const Padding(
        padding: EdgeInsets.all(20),
        child: Column(children: [
          PremiumGate(title: 'Həftəlik statistika', emoji: '📊', child: SizedBox()),
          SizedBox(height: 16),
          PremiumBlurGate(feature: 'parenting_quiz', subtitle: 'Testin ətraflı nəticəsi Premium ilə açılır.', child: SizedBox()),
          AdFreePremiumOffer(position: 'top'),
        ]),
      ),
      'premium_gates',
    );
  });
}
