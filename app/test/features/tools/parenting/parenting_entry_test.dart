// Ported from: src/components/tools/parenting/ParentingEntry.test.tsx,
//              src/components/tools/parenting/PartnerParentingScreen.test.tsx
// Opening the tool goes through ProgrammeNav.openParenting (the shell sends the mother to the tool and the partner
// role to the partner screen — `PushNavIntent(tool: 'parenting')` / `(screen: 'partner-parenting')`); the harness
// records the target. "The app language has no content" uses a language outside the 25 content languages ('en' now
// has content). `normalizePartnerChildren` belongs to the partner feature (phase 6) and is not ported here.
import 'package:anacan/domain/parenting/parenting.dart';
import 'package:anacan/features/tools/parenting/parenting_entry.dart';
import 'package:anacan/features/tools/parenting/parenting_tool.dart';
import 'package:anacan/features/tools/parenting/partner_parenting_screen.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/programme_tools.dart' show programmeAiAnswerCard;
import 'package:anacan/features/ai_chat/ai_chat_logic.dart' show AiPartnerContext;
import 'package:anacan/shell/shell.dart' show ParentingTarget;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import 'support/programme_harness.dart';

ProgrammeHarness env({String lifeStage = 'mommy', String language = 'az', Object? setting = 'on', List<String> disabled = const [], String? birth = '2024-07-07'}) {
  final h = ProgrammeHarness();
  final child = birth != null ? ProgrammeChild(id: 'c1', name: 'Aysel', birthDate: birth) : null;
  h.inputs = ProgrammeInputs(
    userId: 'u1',
    lifeStage: lifeStage,
    language: language,
    parentingSetting: setting,
    disabledTools: disabled,
    children: [?child],
    selectedChild: child,
  );
  return h;
}

String up(String s) => s.toUpperCase();
final Finder card = find.byKey(const ValueKey('parenting-ai-card'));

void main() {
  setUp(installTestI18n);

  group('Anacan.AI → Tərbiyə suggestion card', () {
    testWidgets('suggests the best SOS card for the mother and opens the tool on it', (tester) async {
      final h = env();
      await h.pump(tester, const ParentingAiCard(question: '3 yaşlı oğlum axşamlar yatmaq istəmir, nə edim?'));
      expect(find.descendant(of: card, matching: find.text(up('Tərbiyə · SOS kartı'))), findsOneWidget);
      expect(find.descendant(of: card, matching: find.text('Yatmaq istəmir')), findsOneWidget);
      await tester.tap(card);
      await tester.pump();
      expect(h.openedParenting, [const ParentingTarget('sos', 'bedtime-refusal')]);
      expect(h.targets.peek(), const ParentingTarget('sos', 'bedtime-refusal'));
      await h.finish(tester);
    });

    testWidgets('suggests an article for a general question', (tester) async {
      final h = env();
      await h.pump(tester, const ParentingAiCard(question: 'Uşağım tez-tez yalan danışır'));
      expect(find.descendant(of: card, matching: find.text(up('Tərbiyə · Məqalə'))), findsOneWidget);
      await h.finish(tester);
    });

    for (final (label, h) in [
      ('the switch is off', () => env(setting: 'off')),
      ('the app language has no content', () => env(language: 'xx')),
      ('the module is not Ana', () => env(lifeStage: 'bump')),
      ('the tool is disabled for the language', () => env(disabled: ['parenting'])),
      ('the child is 13 or older', () => env(birth: '2010-01-01')),
    ]) {
      testWidgets('stays hidden when $label', (tester) async {
        final harness = h();
        await harness.pump(tester, const ParentingAiCard(question: 'isterika edir'));
        expect(card, findsNothing);
        await harness.finish(tester);
      });
    }

    testWidgets('stays hidden for a question that is not about parenting', (tester) async {
      final h = env();
      await h.pump(tester, const ParentingAiCard(question: 'Körpəmin qızdırması var, nə verim?'));
      expect(card, findsNothing);
      await h.finish(tester);
    });

    testWidgets('works for the partner of an Ana-module mother and opens the partner screen', (tester) async {
      final h = env(lifeStage: 'partner');
      await h.pump(tester, const ParentingAiCard(question: 'Qızım qardaşını vurur', partner: ParentingPartnerContext(lifeStage: 'mommy', babyBirthDate: '2021-03-01')));
      await tester.tap(card);
      await tester.pump();
      expect(h.openedParenting, [const ParentingTarget('sos', 'hit-sibling')]);
      await h.finish(tester);
      final bump = env(lifeStage: 'partner');
      await bump.pump(tester, const ParentingAiCard(question: 'Qızım qardaşını vurur', partner: ParentingPartnerContext(lifeStage: 'bump')));
      expect(card, findsNothing);
      await bump.finish(tester);
    });

    testWidgets('the Anacan.AI answer card passes the partner context through (AIChatScreen wiring, no vitest case)', (tester) async {
      final h = env(lifeStage: 'partner');
      await h.pump(
          tester,
          Builder(
              builder: (context) => programmeAiAnswerCard(context,
                  question: 'How do I wean my toddler? Qızım qardaşını vurur', partner: const AiPartnerContext(lifeStage: 'mommy', babyBirthDate: '2021-03-01'))!));
      expect(find.byType(ParentingAiCard), findsOneWidget);
      expect(card, findsOneWidget);
      await h.finish(tester);
    });
  });

  group('Tərbiyə in partner mode', () {
    final now = DateTime(2026, 11, 7);
    bool visible({String? womanLifeStage = 'mommy', String language = 'az', Object? setting = 'on', String? birthDate = '2022-05-01'}) =>
        isParentingPartnerVisible(womanLifeStage: womanLifeStage, language: language, setting: setting, birthDate: birthDate, now: now);

    test('is visible to the partner of an Ana-module mother under the same switch and content rules', () {
      expect(visible(), true);
      expect(visible(birthDate: null), true);
      expect(visible(womanLifeStage: 'bump'), false);
      expect(visible(womanLifeStage: null), false);
      expect(visible(setting: 'off'), false);
      expect(visible(language: 'xx'), false);
      expect(visible(birthDate: '2012-01-01'), false);
    });

    test('reads for her current child he can see, else her profile baby', () {
      const kids = [(name: 'Ali', birthDate: '2019-01-01', isCurrent: false), (name: 'Aysel', birthDate: '2024-07-07', isCurrent: true)];
      expect(partnerParentingChild(kids, null), (name: 'Aysel', birthDate: '2024-07-07'));
      expect(partnerParentingChild([kids[0]], null), (name: 'Ali', birthDate: '2019-01-01'));
      expect(partnerParentingChild([], (babyName: 'Nur', babyBirthDate: '2025-01-01')), (name: 'Nur', birthDate: '2025-01-01'));
      expect(partnerParentingChild([], null), isNull);
    });

    testWidgets('the partner screen opens the same tool in partner mode with her child', (tester) async {
      final h = env(lifeStage: 'partner');
      const data = PartnerParentingData(
        babyName: 'Nur',
        babyBirthDate: '2025-01-01',
        hasProfile: true,
        children: [PartnerChildRow(id: 'k', name: 'Aysel', birthDate: '2024-07-07', isCurrent: true)],
      );
      await h.pump(tester, ProviderScope(overrides: [partnerParentingDataProvider.overrideWithValue(data)], child: PartnerParentingScreen(onBack: () {})));
      final view = tester.widget<ParentingToolView>(find.byType(ParentingToolView));
      expect(view.partner, true);
      expect((view.child?.id, view.child?.name, view.child?.birthDate), ('k', 'Aysel', '2024-07-07'));
      expect([for (final k in view.kids) k.id], ['k']);
      await h.finish(tester);
    });
  });

  group('partner Tərbiyə corrected age', () {
    final now = DateTime(2026, 11, 7, 10);
    ({int? months, bool corrected}) partnerMilestone(PartnerParentingData data) {
      final child = partnerParentingStartChild(data);
      final kids = [for (final c in data.children) ProgrammeChild(id: c.id, name: c.name, birthDate: c.birthDate, dueDate: c.dueDate)];
      final picked = pickParentingChild<ProgrammeChild>(kids, idOf: (k) => k.id, birthDateOf: (k) => k.birthDate, preferred: child?.id, now: now);
      return milestoneAge(picked?.birthDate, picked?.dueDate, now);
    }

    test('a preterm baby gets the corrected age on the partner side (10 months, born ~31 weeks → 7 corrected months)', () {
      const data = PartnerParentingData(children: [PartnerChildRow(id: 'a', name: 'Aysel', birthDate: '2026-01-08', isCurrent: true, dueDate: '2026-03-15')]);
      final child = partnerParentingStartChild(data)!;
      expect((child.id, child.dueDate), ('a', '2026-03-15'));
      final m = partnerMilestone(data);
      expect((m.months, m.corrected), (7, true));
    });

    test('without due_date (old function) the partner keeps calendar age', () {
      const data = PartnerParentingData(children: [PartnerChildRow(id: 'a', name: 'Aysel', birthDate: '2026-01-08', isCurrent: true)]);
      expect(partnerParentingStartChild(data)!.dueDate, isNull);
      final m = partnerMilestone(data);
      expect((m.months, m.corrected), (9, false));
    });
  });
}
