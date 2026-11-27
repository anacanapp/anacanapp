// Ported from: src/lib/parenting.test.ts (all groups except "device store" round-trips, which test the not yet
// ported sanitizeParenting/readParenting store; its toggleSaved and readingMinutes cases are included)

import 'package:anacan/domain/common/app_languages.dart';
import 'package:anacan/domain/parenting/data/parenting_data.g.dart';
import 'package:anacan/domain/parenting/parenting.dart';
import 'package:flutter_test/flutter_test.dart';

final now = DateTime(2026, 11, 7, 10);

bool tile({String? lifeStage = 'mommy', String? language = 'az', Object? setting = 'on', String? birthDate = '2024-07-01'}) =>
    isParentingTileVisible(lifeStage: lifeStage, language: language, setting: setting, birthDate: birthDate, now: now);

void main() {
  group('Tərbiyə tile visibility', () {
    test('shows for an Azerbaijani-language mother with the switch on', () => expect(tile(), true));
    test('is hidden while the admin switch is off or missing', () {
      expect(tile(setting: 'off'), false);
      expect(tile(setting: null), false);
      expect(tile(setting: true), false);
    });
    test('is shown exactly for the app languages with registered content (az today; others as they are registered)', () {
      for (final language in appLanguageCodes) {
        expect(tile(language: language), parentingContentLanguages.contains(language), reason: language);
      }
      expect(tile(language: 'az'), true);
      for (final language in ['', null, 'xx', 'constructor']) {
        expect(tile(language: language), false);
      }
    });
    test('is shown only in the Ana module, never in flow, bump or partner', () {
      for (final lifeStage in ['flow', 'bump', 'partner', null]) {
        expect(tile(lifeStage: lifeStage), false);
      }
    });
    test('covers children up to 12 years and stays visible when the birth date is unknown', () {
      expect(tile(birthDate: '2026-11-01'), true);
      expect(tile(birthDate: '2013-11-08'), true);
      expect(tile(birthDate: '2013-11-07'), false);
      expect(tile(birthDate: null), true);
    });
  });

  group('age bands', () {
    test('maps months to the four bands', () {
      expect(ageBandFor(0), '0-1');
      expect(ageBandFor(11), '0-1');
      expect(ageBandFor(12), '1-3');
      expect(ageBandFor(35), '1-3');
      expect(ageBandFor(36), '3-6');
      expect(ageBandFor(71), '3-6');
      expect(ageBandFor(72), '6-12');
      expect(ageBandFor(maxMonths - 1), '6-12');
      expect(ageBandFor(maxMonths), isNull);
      expect(ageBandFor(null), isNull);
      expect(ageBandFor(-1), isNull);
    });
    test('rotates the daily tip once a day', () {
      final a = dailyTipIndex('2026-11-07', 10);
      expect(dailyTipIndex('2026-11-07', 10), a);
      expect(dailyTipIndex('2026-11-08', 10), (a + 1) % 10);
      expect(dailyTipIndex('2026-11-07', 0), -1);
    });
  });

  group('programme progress', () {
    test('allows one check-off per calendar day, in order', () {
      var p = startProgramme('2026-11-01');
      expect(nextDayIndex(p), 0);
      expect(canCompleteToday(p, 7, '2026-11-01'), true);
      p = completeDay(p, 7, '2026-11-01');
      expect(p.done, ['2026-11-01']);
      expect(canCompleteToday(p, 7, '2026-11-01'), false);
      expect(identical(completeDay(p, 7, '2026-11-01'), p), true);
      p = completeDay(p, 7, '2026-11-03');
      expect(nextDayIndex(p), 2);
      expect(progressPercent(p, 7), 29);
    });
    test('undoes only the last check-off and finishes at the last day', () {
      var p = startProgramme('2026-11-01');
      for (var d = 1; d <= 7; d++) {
        p = completeDay(p, 7, '2026-11-0$d');
      }
      expect(isFinished(p, 7), true);
      expect(progressPercent(p, 7), 100);
      expect(canCompleteToday(p, 7, '2026-11-09'), false);
      p = undoLastDay(p, '2026-11-07');
      expect(p.done, hasLength(6));
      expect(isFinished(p, 7), false);
      expect(nextDayIndex(null), 0);
      expect(progressPercent(null, 7), 0);
    });
    test('keeps the first days free and locks the rest without Premium', () {
      expect(freeProgrammeDays, 3);
      expect(isDayLocked(0, false), false);
      expect(isDayLocked(2, false), false);
      expect(isDayLocked(3, false), true);
      expect(isDayLocked(20, true), false);
    });
  });

  group('quizzes', () {
    const items = ['warmth', 'warmth', 'structure', 'structure', 'giveIn', 'harsh', 'harsh'];
    test('scores the parenting style without judging', () {
      expect(styleResult(styleScores(items, [3, 3, 3, 2, 0, 0, 1])), 'balanced');
      expect(styleResult(styleScores(items, [3, 3, 1, 0, 3, 0, 0])), 'gentle');
      expect(styleResult(styleScores(items, [3, 2, 2, 2, 0, 2, 2])), 'storm');
      expect(styleResult(styleScores(items, [0, 1, 3, 3, 0, 2, 2])), 'strict');
      expect(styleResult(styleScores(items, [1, 0, 1, 0, 3, 0, 1])), 'stretched');
    });
    const cp = MilestoneCheckpoint(id: 't', fromMonths: 18, title: '18', items: [
      MilestoneItem(text: 'a', flag: true), MilestoneItem(text: 'b'), MilestoneItem(text: 'c'), MilestoneItem(text: 'd'),
    ]);
    MilestoneCheckpoint at(String id, int from) => MilestoneCheckpoint(id: id, fromMonths: from, title: cp.title, items: cp.items);
    test('sends red flags and lost skills to the doctor', () {
      expect(milestoneResult(cp, ['yes', 'yes', 'yes', 'yes'], 'no').id, 'ontrack');
      expect(milestoneResult(cp, ['no', 'yes', 'yes', 'yes'], 'no').id, 'talk');
      expect(milestoneResult(cp, ['yes', 'yes', 'yes', 'yes'], 'yes').id, 'talk');
      final watch = milestoneResult(cp, ['unsure', 'no', 'no', 'unsure'], 'no');
      expect(watch.id, 'watch');
      expect(watch.notYet, [0, 1, 2, 3]);
      expect(watch.flagged, isEmpty);
    });
    test('picks the latest reached checkpoint', () {
      final cps = [at('a', 4), at('b', 9), at('c', 18)];
      expect(checkpointFor(cps, 2)?.id, 'a');
      expect(checkpointFor(cps, 12)?.id, 'b');
      expect(checkpointFor(cps, 40)?.id, 'c');
      expect(checkpointFor(cps, null)?.id, 'a');
    });
    test('is not offered before the first checkpoint (a 1-month-old would get a false "talk to a doctor")', () {
      final cps = [at('a', 4), at('b', 9)];
      expect(tooEarlyForMilestones(cps, 1), 4);
      expect(tooEarlyForMilestones(cps, 0), 4);
      expect(tooEarlyForMilestones(cps, 4), isNull);
      expect(tooEarlyForMilestones(cps, null), isNull);
      expect(tooEarlyForMilestones(const [], 1), isNull);
    });
    test('quiz navigation keeps answers when going back (no vitest case)', () {
      var nav = startQuiz<int>();
      nav = quizAnswer(nav, 2, 3);
      nav = quizAnswer(nav, 1, 3);
      nav = quizBack(nav);
      expect([nav.pos, nav.answers], [1, [2, 1]]);
      nav = quizAnswer(nav, 3, 3);
      nav = quizAnswer(nav, 0, 3);
      expect(quizDone(nav, 3), true);
      expect(milestoneCheckOffered([at('a', 4), at('b', 60)], 71, '6-12'), true);
      expect(milestoneCheckOffered([at('a', 4), at('b', 60)], null, '6-12'), false);
    });
  });

  group('device store', () {
    test('toggles bookmarks newest first', () {
      expect(toggleSaved([], 'a:x'), ['a:x']);
      expect(toggleSaved(['a:x'], 's:y'), ['s:y', 'a:x']);
      expect(toggleSaved(['s:y', 'a:x'], 'a:x'), ['s:y']);
    });
    test('estimates reading time', () {
      expect(readingMinutes(['one two']), 1);
      expect(readingMinutes([List.filled(540, 'söz').join(' ')]), 3);
    });
  });

  group('Tərbiyə home card', () {
    const tips = {'0-1': ['a0', 'a1'], '1-3': ['b0', 'b1', 'b2'], '3-6': ['c0'], '6-12': ['d0', 'd1']};
    bool card({String? lifeStage = 'mommy', String? language = 'az', Object? setting = 'on', String? birthDate = '2024-07-01', bool toolDisabled = false, bool recovering = false}) =>
        isParentingHomeCardVisible(lifeStage: lifeStage, language: language, setting: setting, birthDate: birthDate, now: now, toolDisabled: toolDisabled, recovering: recovering);
    test('uses the tile rules and also hides for a disabled tool or the loss-recovery home', () {
      expect(card(), true);
      expect(card(setting: 'off'), false);
      expect(card(language: 'xx'), false);
      expect(card(lifeStage: 'flow'), false);
      expect(card(birthDate: '2013-11-01'), false);
      expect(card(toolDisabled: true), false);
      expect(card(recovering: true), false);
    });
    test('picks the band like the tool: chosen band, else the child, else 1–3', () {
      expect(homeTipFor(tips, birthDate: '2026-05-01', now: now)?.band, '0-1');
      expect(homeTipFor(tips, birthDate: '2021-01-01', now: now)?.band, '3-6');
      expect(homeTipFor(tips, birthDate: '2021-01-01', chosenBand: '6-12', now: now)?.band, '6-12');
      expect(homeTipFor(tips, birthDate: null, now: now)?.band, '1-3');
    });
    test('shows the same tip as the tool for the day', () {
      final r = homeTipFor(tips, birthDate: '2024-07-01', now: now)!;
      expect(r.index, dailyTipIndex('2026-11-07', 3));
      expect(r.tip, tips['1-3']![r.index]);
      expect(homeTipFor({...tips, '1-3': <String>[]}, now: now), isNull);
    });
  });
}
