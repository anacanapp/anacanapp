// Ported from: src/components/tools/weaning/WeaningEntryCards.test.tsx
import 'dart:convert';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/weaning/weaning.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/programme_tools.dart';
import 'package:anacan/features/tools/weaning/weaning_copy.dart';
import 'package:anacan/features/tools/weaning/weaning_entry.dart';
import 'package:anacan/features/tools/weaning/weaning_entry_cards.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../parenting/support/programme_harness.dart';

const String key = 'anacan.weaning.v1.u1';

ProgrammeHarness env({Object? setting = 'on', String birthDate = '2025-06-01', String lifeStage = 'mommy'}) {
  final h = ProgrammeHarness();
  final child = ProgrammeChild(id: 'c1', birthDate: birthDate);
  h.inputs = ProgrammeInputs(userId: 'u1', lifeStage: lifeStage, selectedChild: child, weaningSetting: setting);
  return h;
}

Map<String, dynamic> stored(ProgrammeHarness h) => jsonDecode(h.store.getItem(key) ?? '{}') as Map<String, dynamic>;

void main() {
  setUp(installTestI18n);

  group('WeaningHomeCard', () {
    testWidgets('shows the one-time choice card and remembers "continue breastfeeding"', (tester) async {
      final h = env();
      await h.pump(tester, const WeaningHomeCard());
      expect(find.byKey(const ValueKey('weaning-home-intro')), findsOneWidget);
      await tapText(tester, wt('weaning_home_continue'));
      expect(find.byKey(const ValueKey('weaning-home-intro')), findsNothing);
      expect(stored(h)['continueBF'], true);
      await h.finish(tester);
    });

    testWidgets('can be dismissed for this child', (tester) async {
      final h = env();
      await h.pump(tester, const WeaningHomeCard());
      await tapKey(tester, 'weaning-home-dismiss');
      expect(find.byKey(const ValueKey('weaning-home-intro')), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await h.pump(tester, const WeaningHomeCard());
      expect(find.byKey(const ValueKey('weaning-home-intro')), findsNothing);
      await h.finish(tester);
    });

    testWidgets('is hidden when the admin switch is off, outside the Ana module or under 12 months', (tester) async {
      for (final h in [
        env(setting: 'off'),
        env(lifeStage: 'bump'),
        env(birthDate: isoDay(DateTime.fromMillisecondsSinceEpoch(DateTime.now().millisecondsSinceEpoch - 200 * 86400000))),
      ]) {
        await h.pump(tester, const WeaningHomeCard());
        expect(find.byKey(const ValueKey('weaning-home-intro')), findsNothing);
        expect(find.byKey(const ValueKey('weaning-home-active')), findsNothing);
        await h.finish(tester);
      }
    });

    testWidgets('shows the running plan and opens the tool', (tester) async {
      final h = env();
      final plan = createPlan(feeds: defaultFeeds, pace: 'gentle', nightMode: 'last', start: isoDay(DomainClock.now()), childId: 'c1');
      h.store.setItem(key, jsonEncode({'v': 1, 'plan': plan.toJson(), 'planDirty': false, 'checkins': [], 'lastResult': null, 'continueBF': true}));
      await h.pump(tester, const WeaningHomeCard());
      await tapKey(tester, 'weaning-home-active-button');
      expect(h.openedTools, ['weaning']);
      await h.finish(tester);
    });
  });

  group('WeaningFeedingLink', () {
    testWidgets('prefills the plan builder from the last 7 days and opens the tool', (tester) async {
      final h = env();
      final now = DateTime.now();
      h.feedLogs = [
        for (var d = 1; d <= 3; d++)
          for (final hr in const [7, 11, 15, 20, 2])
            FeedLog(logType: 'feeding', feedType: 'breast_left', startTime: jsToIsoString(DateTime(now.year, now.month, now.day - d, hr, 5))),
      ];
      await h.pump(tester, const WeaningFeedingLink());
      await tapKey(tester, 'weaning-feeding-link');
      await h.flush(tester);
      expect(h.openedTools, ['weaning']);
      expect(stored(h)['feeds'], {'morning': true, 'day': 1, 'nap': true, 'bedtime': true, 'night': 1});
      await h.finish(tester);
    });

    testWidgets('is hidden after "continue breastfeeding"', (tester) async {
      final h = env();
      h.store.setItem(key, jsonEncode({'v': 1, 'plan': null, 'continueBF': true}));
      await h.pump(tester, const WeaningFeedingLink());
      expect(find.byKey(const ValueKey('weaning-feeding-link')), findsNothing);
      await h.finish(tester);
    });
  });

  group('WeaningAiCard', () {
    testWidgets('shows only when the tool is offered', (tester) async {
      final h = env();
      await h.pump(tester, const WeaningAiCard());
      expect(find.byKey(const ValueKey('weaning-ai-card')), findsOneWidget);
      await h.finish(tester);
      final off = env(setting: 'off');
      await off.pump(tester, const WeaningAiCard());
      expect(find.byKey(const ValueKey('weaning-ai-card')), findsNothing);
      await off.finish(tester);
    });

    testWidgets('the Anacan.AI answer card picks the weaning card for a weaning question (mother only), else Tərbiyə (no vitest case)',
        (tester) async {
      final h = env();
      await h.pump(tester, Builder(builder: (context) => programmeAiAnswerCard(context, question: 'How do I wean my toddler?', partner: null)!));
      expect(find.byType(WeaningAiCard), findsOneWidget);
      await h.finish(tester);
    });
  });
}
