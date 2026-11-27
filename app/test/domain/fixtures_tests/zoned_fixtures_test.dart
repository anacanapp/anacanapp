// Cross-language fixtures for the zone-dependent modules: the expected values come from running the original
// TypeScript in Node with the same TZ (app/tool/domain/gen_fixtures.mjs, zones UTC, America/New_York,
// Europe/Berlin, Asia/Baku). This file runs against the fixture of the current process zone; use
// app/tool/domain/run_tz_tests.sh to cover all four.

import 'package:anacan/domain/baby/baby_logs_range.dart';
import 'package:anacan/domain/cycle/cycle_predictions.dart';
import 'package:anacan/domain/cycle/cycle_utils.dart';
import 'package:anacan/domain/cycle/period_flow.dart';
import 'package:anacan/domain/dates/local_date.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/notifications/local_notification_plan.dart';
import 'package:anacan/domain/pregnancy/pregnancy_utils.dart';
import 'package:anacan/domain/sleep/sleep_predict.dart';
import 'package:anacan/domain/sleep/sleep_training.dart';
import 'package:anacan/domain/vaccines/vaccine_schedule.dart';
import 'package:anacan/domain/weaning/weaning.dart' as weaning;
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

final _histories = [
  <CycleHistory>[],
  [_h(1, 30, 5), _h(2, 27, 4)],
  [_h(3, 26, 6), _h(1, 31, 5), _h(2, 53, 5), _h(4, 29, null), _h(5, 28, 13)],
];
CycleHistory _h(int n, num? len, num? period) => CycleHistory(id: '$n', userId: 'u', cycleNumber: n, startDate: '', cycleLength: len, periodLength: period);

Map<String, Object?> _predictions(CyclePredictions p) => {
      ...p.toJson(),
      'nextPeriodDate': p.nextPeriodDate,
      'daysUntilNextPeriod': p.daysUntilNextPeriod,
      'ovulationDate': p.ovulationDate,
      'fertileWindowStart': p.fertileWindowStart,
      'fertileWindowEnd': p.fertileWindowEnd,
      'pmsStart': p.pmsStart,
      'isLate': p.isLate,
      'lateDays': p.lateDays,
    };

void main() {
  test('cycle-utils and cycle-predictions match the TypeScript', () {
    final f = loadFixture('cycle')! as Map;
    for (final c in (f['cases'] as List).cast<Map>()) {
      setSystemTime(DateTime.fromMillisecondsSinceEpoch(c['now'] as int));
      final lpd = c['lpd'] as String;
      final where = '${c['fn']} now=${DateTime.fromMillisecondsSinceEpoch(c['now'] as int)} lpd=$lpd';
      if (c['fn'] == 'cycle') {
        final l = c['L'] as int, now = DomainClock.now(), start = storedCalendarDate(lpd)!;
        final fw = getFertileWindow(start, l);
        expectJsonClose(fx({
          'cycleDay': getCycleDayForDate(now, start, l),
          'phase': getPhaseInfoForDate(now, start, l, 5).toJson(),
          'next': getNextPeriodDate(start, l),
          'fertile': {'start': fw.start, 'end': fw.end, 'ovulationDate': fw.ovulationDate},
        }), {'cycleDay': c['cycleDay'], 'phase': c['phase'], 'next': c['next'], 'fertile': c['fertile']}, path: '$where L=$l');
      } else {
        expectJsonClose(fx(_predictions(getCyclePredictions(lpd, _histories[c['history'] as int], 28, 5))), c['out'], path: where);
      }
    }
    final stats = (f['stats'] as List).cast<Map>();
    for (var i = 0; i < _histories.length; i++) {
      final h = _histories[i];
      expectJsonClose(computeAdaptiveCycleStats(h).toJson(), stats[i]['adaptive'], path: 'adaptive $i');
      expect(effectiveCycleLength(h, 40), stats[i]['effective']);
      expectJsonClose(
          calculateCycleStats([for (final c in h) (cycleLength: c.cycleLength, periodLength: c.periodLength)]).toJson(), stats[i]['simple'],
          path: 'simple $i');
    }
    setSystemTime(DateTime(2026, 4, 2, 12));
    final logs = [
      const OvulationSignalLog(logDate: '2026-03-03', ovulationTest: 'peak'),
      const OvulationSignalLog(logDate: '2026-03-12', cervicalMucus: 'eggwhite'),
      const OvulationSignalLog(logDate: '2026-03-14', cervicalMucus: 'eggwhite'),
      const OvulationSignalLog(logDate: '2026-03-15', ovulationTest: 'positive'),
      const OvulationSignalLog(logDate: '2026-03-16', ovulationTest: 'peak'),
      const OvulationSignalLog(logDate: '2026-05-01', ovulationTest: 'peak'),
    ];
    final variants = [logs, logs.sublist(0, 4), logs.sublist(0, 3), logs.sublist(0, 1), <OvulationSignalLog>[]];
    for (var i = 0; i < variants.length; i++) {
      final r = refineOvulation(variants[i], '2026-03-01', DateTime(2026, 3, 15));
      expectJsonClose(
          fx({'ovulationDate': r.ovulationDate, 'fertileWindowStart': r.fertileWindowStart, 'fertileWindowEnd': r.fertileWindowEnd, 'source': r.source, 'confirmed': r.confirmed}),
          (f['refine'] as List)[i],
          path: 'refine $i');
    }
  }, skip: fixtureSkip('cycle'));

  test('pregnancy-utils and stored-date-key match the TypeScript', () {
    for (final c in (loadFixture('pregnancy')! as List).cast<Map>()) {
      setSystemTime(DateTime.fromMillisecondsSinceEpoch(c['now'] as int));
      final v = c['v'] as String?;
      expectJsonClose(fx({
        'day': getPregnancyDay(v), 'week': getPregnancyWeek(v), 'dayInWeek': getDayInWeek(v), 'until': getDaysUntilDue(v), 'untilDue': getDaysUntilDue(null, v),
        'elapsed': getDaysElapsed(v), 'progress': getPregnancyProgress(v), 'due': calculateDueDate(v) ?? (v == null ? null : jsInvalidDate), 'lmp': calculateLMPFromDueDate(v) ?? (v == null ? null : jsInvalidDate),
        'age': getRealCalendarAge(v).toJson(), 'weekAt': v == null ? null : getPregnancyWeekAtDate(v, '2026-10-26'), 'str': getWeekDayString(v),
        'prem': getPrematurityInfo(v, '2026-11-01').toJson(), 'key': storedDateKey(v), 'cal': storedCalendarDate(v),
      }), {for (final e in c.entries) if (e.key != 'now' && e.key != 'v') e.key: e.value}, path: 'now=${DomainClock.now()} v=$v', tol: 1e-12);
    }
  }, skip: fixtureSkip('pregnancy'));

  test('vaccine-schedule matches the TypeScript', () {
    ScheduleLike row(Map<String, Object?>? meta) => ScheduleLike(
          id: 'dose-2', doseNumber: 2, recommendedAgeDays: 60, minAgeDays: 50, maxAgeDays: 120,
          scheduleMeta: meta == null
              ? null
              : {'protocol': 'anacan-vaccine-schedule-v1', 'version': 'f', 'kind': 'routine', 'age': {'months': 2, 'days': 0}, 'end_age': null,
                  'expected_age_days': 60, 'expected_dose_number': 2, 'source_url': '', 'source_label': '', ...meta},
        );
    final rows = [
      row(null), row({}), row({'end_age': {'months': 4, 'days': -1}}), row({'age': {'months': 1, 'days': 14}, 'end_age': {'months': 12, 'days': 0}}),
      row({'relative': {'schedule_id': 'dose-1', 'min': {'months': 1, 'days': 0}, 'max': {'months': 3, 'days': 0}}}),
    ];
    final logs = [<String, VaccinationLike>{}, {'dose-1': const VaccinationLike(administeredAt: '2026-03-31')}];
    for (final c in (loadFixture('vaccines')! as List).cast<Map>()) {
      final now = DateTime.fromMillisecondsSinceEpoch(c['now'] as int);
      expect(vaccineStatus(rows[c['row'] as int], c['birth'] as String, logs[c['logs'] as int], now), c['status'], reason: '$c');
    }
  }, skip: fixtureSkip('vaccines'));

  test('sleep-training, sleep-predict and baby-logs-range match the TypeScript around DST', () {
    for (final c in (loadFixture('sleep')! as List).cast<Map>()) {
      final date = (c['date'] as List).cast<int>();
      DateTime at(int h, [int mi = 0, int off = 0]) => DateTime(date[0], date[1], date[2] + off, h, mi);
      final logs = <BabyLogRow>[];
      for (var off = -7; off <= 0; off++) {
        logs.add(BabyLogRow(id: 'n$off', logType: 'sleep', startTime: jsToIsoString(at(20, 30, off - 1)), endTime: jsToIsoString(at(6, 10, off))));
        logs.add(BabyLogRow(id: 'a$off', logType: 'sleep', startTime: jsToIsoString(at(9, 15, off)), endTime: jsToIsoString(at(10, 5, off))));
        if (off < 0) logs.add(BabyLogRow(id: 'b$off', logType: 'sleep', startTime: jsToIsoString(at(12, 40, off)), endTime: jsToIsoString(at(14, 0, off))));
        logs.add(BabyLogRow(id: 'f$off', logType: 'feeding', feedType: off.remainder(2) != 0 ? 'formula' : 'breast_left', notes: '90 ml',
            startTime: jsToIsoString(at(1, 30, off)), endTime: jsToIsoString(at(1, 50, off))));
      }
      final entries = sleepEntries(logs);
      final band = c['band'] as String;
      final now = DateTime.fromMillisecondsSinceEpoch(c['now'] as int);
      setSystemTime(now);
      final where = '$date $band ${now.hour}:${now.minute}';
      final next = predictNextNap(entries: entries, band: band, now: now, morningWake: at(6, 10));
      expectJsonClose(fx({
        'state': next.state, 'lastWake': next.lastWake, 'awakeMinutes': next.awakeMinutes, 'windowStart': next.windowStart, 'windowEnd': next.windowEnd,
        'minutesToStart': next.minutesToStart, 'progress': next.progress, 'napIndex': next.napIndex, 'isBedtime': next.isBedtime,
      }), c['next'], path: '$where next');
      expectJsonClose(fx([for (final p in predictDay(entries: entries, band: band, now: now, next: next)) {'kind': p.kind, 'start': p.start, 'end': p.end, 'status': p.status, 'minutes': p.minutes}]),
          c['day'], path: '$where day');
      final ww = personalWakeWindow(entries, band, now);
      expectJsonClose({'minutes': ww.minutes, 'range': ww.range, 'personal': ww.personal, 'samples': ww.samples}, c['ww'], path: '$where ww');
      final s = sleepSummary(sessions: entries, band: band, now: now);
      expectJsonClose({
        'daysWithData': s.daysWithData, 'avgDailyMinutes': s.avgDailyMinutes, 'avgNapsPerDay': s.avgNapsPerDay, 'avgNapMinutes': s.avgNapMinutes,
        'avgLongestNightMinutes': s.avgLongestNightMinutes, 'avgWakeWindowMinutes': s.avgWakeWindowMinutes, 'medianBedtime': s.medianBedtime,
        'medianWakeTime': s.medianWakeTime, 'insights': s.insights,
      }, c['summary'], path: '$where summary');
      expectJsonClose([for (final d in sleepDays(entries, now)) [d.key, d.totalMinutes, d.napCount, d.nightMinutes]], c['days'], path: '$where days');
      expectJsonClose(fx([for (final r in upcomingRegressions(at(0, 0, -120), now)) {'key': r.key, 'start': r.start, 'end': r.end, 'daysUntil': r.daysUntil, 'active': r.active}]),
          c['regressions'], path: '$where regressions');
      final st = scheduleStatus(buildSchedule(wakeTime: '06:45', band: band), now);
      expectJsonClose({'currentIndex': st.currentIndex, 'nextIndex': st.nextIndex, 'minutesToNext': st.minutesToNext, 'minutesLeft': st.minutesLeft}, c['schedule'], path: '$where schedule');
      expectJsonClose([for (final p in trendPoints(logs, 'sleep', now, 7)) [p.key, p.count, p.minutes]], c['trend'], path: '$where trend');
      expectJsonClose([for (final r in dailyHistory(logs, now, 3)) [r.key, r.feedings, r.formulaMl, r.sleepMinutes, r.diapers]], c['history'], path: '$where history');
      final fs = feedingStats(logs);
      expectJsonClose(fx({
        'total': fs.total, 'left': fs.left, 'right': fs.right, 'breastMinutes': fs.breastMinutes, 'formulaCount': fs.formulaCount, 'formulaMl': fs.formulaMl,
        'solidCount': fs.solidCount, 'averageGapMinutes': fs.averageGapMinutes, 'last': fs.last == null ? null : {'at': fs.last!.at, 'kind': fs.last!.kind},
      }), c['feeding'], path: '$where feeding');
      final ss = sleepStats(logs);
      expectJsonClose(fx({
        'sessions': [for (final x in ss.sessions) {'id': x.id, 'start': x.start, 'end': x.end, 'minutes': x.minutes}],
        'totalMinutes': ss.totalMinutes, 'averageMinutes': ss.averageMinutes, 'longestMinutes': ss.longestMinutes, 'lastEnd': ss.lastEnd,
      }), c['sleepStats'], path: '$where sleepStats');
    }
  }, skip: fixtureSkip('sleep'));

  test('local notification planning (nearest 60) matches the TypeScript', () {
    for (final c in (loadFixture('notifications')! as List).cast<Map>()) {
      final now = c['now'] as int;
      final ns = <String, List<StoredNotification>>{
        for (final e in (c['ns'] as Map).entries) e.key as String: [for (final n in e.value as List) StoredNotification.tryParse(n)!],
      };
      expect([for (final p in planLocalNotifications(ns, now)) [p.id, p.namespace, p.next]], c['plan'], reason: 'now=$now');
      expect([for (final p in planLocalNotifications(ns, now, 7)) p.id], c['small']);
      expect([for (final w in ns['water']!) nextFireAt(at: w.at, repeat: w.repeat, now: now)], c['next']);
      expect([for (final n in [...ns['water']!, ...ns['nap']!]) fingerprint(n)], c['fps']);
    }
  }, skip: fixtureSkip('notifications'));

  test('weaning calendar days and reminders match the TypeScript', () {
    final f = loadFixture('weaning')! as Map;
    for (final c in (f['out'] as List).cast<Map>()) {
      expect(weaning.daysBetween(c['a'] as String, c['b'] as String), c['between'], reason: '$c');
      expect(weaning.addDaysToDay(c['a'] as String, 9), c['add'], reason: '$c');
    }
    const days = ['2024-02-28', '2024-02-29', '2024-03-01', '2025-12-31', '2026-01-01', '2026-01-31', '2026-02-28', '2026-03-07', '2026-03-08', '2026-03-09',
      '2026-03-28', '2026-03-29', '2026-03-30', '2026-06-15', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-31', '2026-11-01', '2026-11-02', '2026-12-31'];
    for (final c in (f['plans'] as List).cast<Map>()) {
      final now = DateTime.fromMillisecondsSinceEpoch(c['now'] as int);
      setSystemTime(now);
      final p = weaning.createPlan(feeds: const weaning.Feeds(morning: true, day: 2, nap: true, bedtime: true, night: 1), pace: 'medium', nightMode: 'last', start: '2026-03-27', childId: null);
      expect([for (final d in days) weaning.ageInMonths(d, now)], c['age']);
      expectJsonClose(fx([for (final r in weaning.reminderDays(p, now)) [r.step.id, r.at]]), c['reminders'], path: 'reminders $now');
    }
  }, skip: fixtureSkip('weaning'));

  test('period-flow validation matches the TypeScript', () {
    final todays = [DateTime(2026, 3, 29, 1), DateTime(2026, 10, 25, 23), DateTime(2026, 1, 1)];
    final inputs = <List<Object>>[
      ['2026-03-28', '2026-03-29', '2026-03-29'], ['2025-12-31', '2026-01-01'], [DateTime(2026, 3, 29, 0, 30), '2026-03-30'], ['2026-10-25T23:30:00'],
    ];
    final f = (loadFixture('period_dates')! as List).cast<Map>();
    var i = 0;
    for (final today in todays) {
      for (final dates in inputs) {
        final c = f[i++];
        Object out;
        try {
          out = validatePeriodDates(dates, today);
        } on PeriodDateError catch (e) {
          out = e.code;
        }
        expect(out, c.containsKey('ok') ? c['ok'] : c['error'], reason: '$today $dates');
      }
    }
  }, skip: fixtureSkip('period_dates'));
}
