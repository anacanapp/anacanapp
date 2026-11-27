// Ported from: src/lib/sleep-training.test.ts

import 'package:anacan/domain/baby/baby_logs_range.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/sleep/sleep_training.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime at(int y, int mo, int d, [int h = 0, int mi = 0]) => DateTime(y, mo, d, h, mi);

void main() {
  group('age', () {
    test('counts whole months and maps them to bands; only 1–12 months are eligible', () {
      expect(monthsOld(at(2026, 5, 20), at(2026, 10, 19)), 4);
      expect(monthsOld(at(2026, 5, 20), at(2026, 10, 20)), 5);
      expect(ageBand(0), isNull);
      expect(ageBand(3), '1-3');
      expect(ageBand(6), '4-6');
      expect(ageBand(12), '10-12');
      expect(ageBand(13), isNull);
      expect(sleepTrainingEligible(lifeStage: 'mommy', birthDate: at(2026, 6, 1), now: at(2026, 10, 26)), true);
      expect(sleepTrainingEligible(lifeStage: 'bump', birthDate: at(2026, 6, 1), now: at(2026, 10, 26)), false);
      expect(sleepTrainingEligible(lifeStage: 'mommy', birthDate: at(2026, 10, 10), now: at(2026, 10, 26)), false);
    });
  });

  group('buildSchedule', () {
    test('builds wake/nap blocks ending in a bedtime between 19:00 and 20:30', () {
      final s = buildSchedule(wakeTime: '07:00', band: '4-6');
      expect([s.first.type, s.first.start], ['wake', '07:00']);
      expect([s.last.type, s.last.start], ['bedtime', '20:00']);
      expect(s.where((b) => b.type == 'nap'), hasLength(3));
      expect(buildSchedule(wakeTime: '06:30', band: '10-12').where((b) => b.type == 'nap'), hasLength(2));
      expect(buildSchedule(wakeTime: 'bad', band: '1-3'), isEmpty);
    });

    test('reports the current and next block and wraps the night past midnight', () {
      final s = buildSchedule(wakeTime: '07:00', band: '4-6');
      final st = scheduleStatus(s, at(2026, 10, 26, 7, 30));
      expect(st.currentIndex, 0);
      expect(st.nextIndex, 1);
      expect(timelineSegments(s).where((seg) => seg.kind == 'night'), hasLength(2));
    });

    test('clamps the wake time to 05:00–10:30', () {
      expect(shiftWake('05:00', -15), '05:00');
      expect(shiftWake('10:30', 15), '10:30');
      expect(shiftWake('07:00', 15), '07:15');
    });
  });

  group('sleepSummary', () {
    BabyLogRow log(String id, DateTime s, DateTime e) => BabyLogRow(id: id, logType: 'sleep', startTime: jsToIsoString(s), endTime: jsToIsoString(e));
    test('classifies night vs nap and asks for more data under 3 days', () {
      final entries = sleepEntries([log('n', at(2026, 10, 25, 20), at(2026, 10, 26, 6)), log('p', at(2026, 10, 25, 13), at(2026, 10, 25, 14))]);
      expect(entries.map((e) => e.kind), ['nap', 'night']);
      expect(sleepSummary(sessions: entries, band: '4-6', now: at(2026, 10, 27, 12)).insights, ['need_more_data']);
      expect(sleepSummary(sessions: const [], band: '4-6', now: at(2026, 10, 27, 12)).insights, ['no_data']);
    });
    test('flags short nights over a few days', () {
      final logs = [for (final d in [1, 2, 3, 4]) log('n$d', at(2026, 10, 20 + d, 21), at(2026, 10, 21 + d, 1))];
      final s = sleepSummary(sessions: sleepEntries(logs), band: '7-9', now: at(2026, 10, 26, 12));
      expect(s.daysWithData, greaterThanOrEqualTo(3));
      expect(s.insights, contains('night_short'));
    });
  });

  group('plan state', () {
    test('rates plan days only after a method is picked and counts progress', () {
      var s = ratePlanDay(defaultPlanState, 1, 'easy');
      expect(s.planDone, isEmpty);
      s = pickMethod(s, 'chair', '2026-10-20');
      s = ratePlanDay(s, 1, 'easy');
      s = ratePlanDay(s, 2, 'hard');
      expect(planProgress(s).completed, 2);
      expect(planDayNumber('2026-10-20', '2026-10-26'), 7);
      expect(ratePlanDay(s, 2, null, true).planDone, {'1': 'easy'});
    });
    test('counts routine streaks and keeps night wake-ups within 0–20', () {
      var s = defaultPlanState;
      for (final k in ['2026-10-24', '2026-10-25']) {
        for (final step in routineSteps) {
          s = toggleRoutine(s, k, step);
        }
      }
      expect(routineStreak(s.routineDone, '2026-10-26'), 2);
      expect(adjustNightWakes(defaultPlanState, 'k', -3).nightWakes['k'], 0);
      expect(nightKey(at(2026, 10, 26, 3)), '2026-10-25');
    });
    test('parses stored state safely, including the old planDays format, and prunes old days', () {
      final parsed = parsePlanState({'wakeTime': '99:99', 'method': 'nope', 'planDays': [1, 3], 'stepsDone': ['chair_step_1', 'x'], 'pendingSleepStart': 'nope'});
      expect(parsed.wakeTime, '07:00');
      expect(parsed.method, isNull);
      expect(parsed.planDone, {'1': null, '3': null});
      expect(parsed.stepsDone, ['chair_step_1']);
      expect(parsed.pendingSleepStart, isNull);
      final pruned = prunePlanState(const PlanState(nightWakes: {'2026-08-01': 2, '2026-10-25': 1}), '2026-10-26');
      expect(pruned.nightWakes, {'2026-10-25': 1});
      expect(identical(parsePlanState(null), defaultPlanState), true);
    });
  });
}
