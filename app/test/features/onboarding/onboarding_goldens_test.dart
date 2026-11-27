// Ported from: (goldens) — Flutter renders of src/components/onboarding/* used as regression baselines only;
// they are not compared against the web.
import 'package:anacan/features/onboarding/onboarding_journey.dart';
import 'package:anacan/features/onboarding/onboarding_model.dart';
import 'package:anacan/features/onboarding/onboarding_persistence.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support.dart';

Future<void> shoot(WidgetTester tester, OnboardingTestEnv env, String name, {bool dark = false}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await loadAnacanFonts();
  await tester.pumpWidget(env.wrap(const OnboardingJourney(), dark: dark, rtl: env.language == 'ar'));
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
  await settleImages(tester);
  await settleSvgs(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
  await tester.pump(const Duration(seconds: 1));
}

Future<OnboardingTestEnv> envAt(String step, {String stage = 'bump', String language = 'az', bool native = false, bool saved = false, Map<String, Object> answers = const {}}) async {
  final env = OnboardingTestEnv(language: language, native: native);
  var draft = newOnboardingDraft(actor, backend, 'Aysel').copyWith(stage: stage, pregnancyDate: '2026-06-01', lastPeriodDate: '2026-09-01', answers: answers);
  if (stage == 'mommy') draft = draft.copyWith(children: [draft.children.first.copyWith(name: 'Leyla', gender: 'girl', birthDate: '2026-08-01')]);
  if (saved) {
    await saveOnboardingSetup(draft, language, env.db);
    final journey = (env.db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
    draft = draft.copyWith(id: journey['id'] as String, setupComplete: true, saveStarted: true);
  }
  writeOnboardingDraft(draft.copyWith(step: step), env.drafts);
  return env;
}

void main() {
  testWidgets('welcome', (tester) async {
    final env = OnboardingTestEnv();
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_welcome');
  });
  for (final dark in [false, true]) {
    testWidgets('stage ${dark ? 'dark' : 'light'}', (tester) async {
      final env = OnboardingTestEnv()..hasSeenIntro = true;
      addTearDown(env.dispose);
      await shoot(tester, env, 'onboarding_stage_${dark ? 'dark' : 'light'}', dark: dark);
    });
  }
  testWidgets('stage rtl', (tester) async {
    final env = OnboardingTestEnv(language: 'ar')..hasSeenIntro = true;
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_stage_ar');
  });
  testWidgets('data flow', (tester) async {
    final env = await envAt('data', stage: 'flow');
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_data_flow');
  });
  testWidgets('data mommy', (tester) async {
    final env = await envAt('data', stage: 'mommy');
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_data_mommy');
  });
  testWidgets('question', (tester) async {
    final env = await envAt('bumpSymptoms', answers: {'bumpSymptoms': ['nausea', 'fatigue']});
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_question');
  });
  testWidgets('results', (tester) async {
    final env = await envAt('results', stage: 'mommy', saved: true);
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_results');
  });
  for (final dark in [false, true]) {
    testWidgets('paywall ${dark ? 'dark' : 'light'}', (tester) async {
      final env = await envAt('paywall', native: true, saved: true);
      addTearDown(env.dispose);
      await shoot(tester, env, 'onboarding_paywall_${dark ? 'dark' : 'light'}', dark: dark);
    });
  }
  testWidgets('paywall rtl', (tester) async {
    final env = await envAt('paywall', native: true, saved: true, language: 'ar');
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_paywall_ar');
  });
  testWidgets('monthly offer', (tester) async {
    final env = await envAt('offer', stage: 'flow', native: true, saved: true);
    addTearDown(env.dispose);
    await shoot(tester, env, 'onboarding_offer');
  });
}
