// Ported from: src/components/tools/parenting/ParentingHomeCard.test.tsx,
//              src/components/DashboardHomeBlocks.test.tsx ('Tərbiyə home card' cases)
// (ParentingHomeCard.bundle.test.tsx checks the web bundle split — the small tips chunk — which the Flutter card does
// not have: it loads the bundled content file; not portable.)
import 'dart:convert';

import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_home_card.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/programme_tools.dart' show programmeMommySlots;
import 'package:anacan/features/home_mommy/mommy_home_slots.dart' show MommySlot;
import 'package:anacan/shell/shell.dart' show ParentingTarget;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import 'support/programme_harness.dart';

final DateTime now = DateTime(2026, 11, 7, 10); // Aysel (2024-07-07) is 2 years 4 months → band 1–3
const String key = 'anacan.parenting.v1.u1';
final ParentingContent content = contentOf('az');
const ProgrammeChild teen = ProgrammeChild(id: 'teen', name: 'Ali', birthDate: '2010-02-01');
const ProgrammeChild kid = ProgrammeChild(id: 'kid-b', name: 'Nur', birthDate: '2020-03-01'); // 6 years → 6–12
final Finder card = find.byKey(const ValueKey('parenting-home-card'));

ProgrammeHarness env({
  bool premium = true,
  List<ProgrammeChild>? kids,
  String? selected,
  String lifeStage = 'mommy',
  String language = 'az',
  Object? setting = 'on',
  List<String> disabled = const [],
  String? birth = '2024-07-07',
  Map<String, Object?>? stored,
}) {
  final h = ProgrammeHarness();
  if (stored != null) h.store.setItem(key, jsonEncode(stored));
  final list = kids ?? [if (birth != null) ProgrammeChild(id: 'c1', name: 'Aysel', birthDate: birth, gender: 'girl')];
  h.inputs = ProgrammeInputs(
    userId: 'u1',
    lifeStage: lifeStage,
    language: language,
    parentingSetting: setting,
    disabledTools: disabled,
    isPremium: premium,
    children: list,
    selectedChild: list.where((k) => k.id == selected).firstOrNull ?? list.firstOrNull,
  );
  return h;
}

void main() {
  setUp(installTestI18n);

  group('Tərbiyə home card is Premium-only', () {
    testWidgets('renders nothing for a free user', (tester) async {
      final h = env(premium: false);
      await h.pump(tester, ParentingHomeCard(onOpen: () {}));
      expect(card, findsNothing);
      await h.finish(tester);
    });
  });

  group('Tərbiyə home card with several children', () {
    testWidgets('stays when the selected child is 13+ but a younger sibling exists, with the sibling’s band', (tester) async {
      final h = env(kids: [teen, kid], selected: 'teen');
      await h.pump(tester, ParentingHomeCard(onOpen: () {}, now: now));
      expect(find.descendant(of: card, matching: find.text('6–12 yaş')), findsOneWidget);
      await h.finish(tester);
    });

    testWidgets('is hidden when every child is 13+', (tester) async {
      final h = env(kids: [teen]);
      await h.pump(tester, ParentingHomeCard(onOpen: () {}, now: now));
      expect(card, findsNothing);
      await h.finish(tester);
    });

    testWidgets('"Continue" opens a sibling’s running programme for that child', (tester) async {
      final p = content.programmes[0];
      final h = env(kids: [const ProgrammeChild(id: 'kid-a', name: 'Aysel', birthDate: '2024-07-07'), kid], stored: {
        'v': 1, 'band': null, 'quizzes': {}, 'saved': <String>[], 'programmes': {}, 'rootChild': 'kid-a', 'rootChildAt': '2026-11-01T00:00:00.000Z', //
        'children': {
          'kid-b': {'band': null, 'quizzes': {}, 'programmes': {p.id: {'startedAt': '2026-11-06', 'done': ['2026-11-06'], 'updatedAt': '2026-11-06T08:00:00.000Z'}}},
        },
      });
      var opened = 0;
      await h.pump(tester, ParentingHomeCard(onOpen: () => opened++, now: now));
      await tapKey(tester, 'parenting-home-continue');
      expect(opened, 1);
      expect(h.targets.peek(), ParentingTarget('programme', p.id, child: 'kid-b'));
      await h.finish(tester);
    });
  });

  group('Tərbiyə home card', () {
    // 2026-11-09: Tərbiyə is Premium-only, so these cases run as a Premium user.
    testWidgets('shows today’s 1–3 tip for the active child and opens the tool', (tester) async {
      final h = env();
      var opened = 0;
      await h.pump(tester, ParentingHomeCard(onOpen: () => opened++, now: now));
      expect(find.descendant(of: card, matching: find.text('Tərbiyə · Günün məsləhəti'.toUpperCase())), findsOneWidget);
      expect(find.descendant(of: card, matching: find.text('1–3 yaş')), findsOneWidget);
      expect(content.tips['1-3']!.any((t) => find.descendant(of: card, matching: find.text(t.title)).evaluate().isNotEmpty), true);
      await tapKey(tester, 'parenting-home-open');
      expect(opened, 1);
      await h.finish(tester);
    });

    testWidgets('follows the band the parent picked inside the tool', (tester) async {
      final h = env(stored: {'v': 1, 'band': '6-12'});
      await h.pump(tester, ParentingHomeCard(onOpen: () {}, now: now));
      expect(find.text('6–12 yaş'), findsOneWidget);
      expect(content.tips['6-12']!.any((t) => find.text(t.title).evaluate().isNotEmpty), true);
      await h.finish(tester);
    });

    testWidgets('shows a "Continue" line for a running programme that opens that programme', (tester) async {
      final p = content.programmes[0];
      final h = env(stored: {
        'v': 1, 'band': null, 'quizzes': {}, 'saved': <String>[], //
        'programmes': {p.id: {'startedAt': '2026-11-05', 'done': ['2026-11-05', '2026-11-06'], 'updatedAt': '2026-11-06T09:00:00.000Z'}},
      });
      var opened = 0;
      await h.pump(tester, ParentingHomeCard(onOpen: () => opened++, now: now));
      final row = find.byKey(const ValueKey('parenting-home-continue'));
      expect(find.descendant(of: row, matching: find.text('Davam et: ${p.title}')), findsOneWidget);
      expect(find.descendant(of: row, matching: find.text('Gün 3/${p.days.length}')), findsOneWidget);
      await tapKey(tester, 'parenting-home-continue');
      expect(opened, 1);
      expect(h.targets.peek(), ParentingTarget('programme', p.id));
      await h.finish(tester);
    });

    testWidgets('has no "Continue" line without a running programme', (tester) async {
      final h = env();
      await h.pump(tester, ParentingHomeCard(onOpen: () {}, now: now));
      expect(card, findsOneWidget);
      expect(find.byKey(const ValueKey('parenting-home-continue')), findsNothing);
      await h.finish(tester);
    });

    for (final (name, make) in [
      ('the admin switch is off', () => env(setting: 'off')),
      ('the switch is missing', () => env(setting: null)),
      ('the app language is not az', () => env(language: 'xx')), // a language without content ('en' has content now)
      ('the module is not Ana', () => env(lifeStage: 'bump')),
      ('the child is 13 or older', () => env(birth: '2013-01-01')),
      ('the tool is disabled for the language', () => env(disabled: ['parenting'])),
    ]) {
      testWidgets('is hidden when $name', (tester) async {
        final h = make();
        await h.pump(tester, ParentingHomeCard(onOpen: () {}, now: now));
        expect(card, findsNothing);
        await h.finish(tester);
      });
    }

    testWidgets('the Ana home slot opens the Tərbiyə tool (Dashboard wiring, no vitest case)', (tester) async {
      final h = env();
      final slots = programmeMommySlots();
      expect(slots.keys, containsAll([MommySlot.weaningHome, MommySlot.weaningFeedingLink, MommySlot.parentingHome]));
      await h.finish(tester);
    });
  });
}
