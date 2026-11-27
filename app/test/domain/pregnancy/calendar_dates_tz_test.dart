// Ported from: src/lib/calendar-dates-tz.test.ts
// Each block runs only in its zone: TZ=America/New_York, TZ=Europe/Berlin, and the "no change" block in
// TZ=Asia/Baku (the vitest suite also runs it in Europe/Istanbul and Europe/Moscow, both UTC+3 without DST,
// which behave like Baku for this purpose). Use app/tool/domain/run_tz_tests.sh.

import 'package:anacan/domain/cycle/cycle_predictions.dart';
import 'package:anacan/domain/cycle/cycle_utils.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/pregnancy/pregnancy_utils.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

DateTime _utc(String iso) => DateTime.parse('${iso}T00:00:00Z');

void main() {
  group('pregnancy dates west of UTC (America/New_York, DST 2026-03-08)', () {
    final skip = needsZone('America/New_York');

    test('counts a YYYY-MM-DD LMP from that local day, not the previous one', () {
      setSystemTime(DateTime(2026, 3, 1, 9));
      expect(getPregnancyDay('2026-03-01'), 1);
      expect(getDaysElapsed('2026-03-01'), 0);
      setSystemTime(DateTime(2026, 2, 28, 20));
      expect(getDaysElapsed('2026-03-01'), 0);
    }, skip: skip);

    test('turns the week at local midnight right after the spring-forward change', () {
      setSystemTime(DateTime(2026, 3, 15, 0, 30));
      expect(getPregnancyWeek('2026-03-01'), 2);
      expect(getDayInWeek('2026-03-01'), 0);
      expect(getPregnancyWeek(DateTime(2026, 3, 1)), 2);
      expect(getPregnancyWeek(_utc('2026-03-01')), 2);
    }, skip: skip);

    test('keeps the due date at local midnight of LMP + 280 days across DST', () {
      expect(ymd(calculateDueDate('2026-06-01')), [2027, 3, 8, 0]);
      expect(ymd(calculateLMPFromDueDate('2027-03-08')), [2026, 6, 1, 0]);
      setSystemTime(DateTime(2027, 3, 7, 23, 30));
      expect(getDaysUntilDue('2026-06-01'), 1);
      expect(getDaysUntilDue(null, '2027-03-08'), 1);
    }, skip: skip);

    test('uses the scan calendar day for the fetal growth week', () {
      expect(getPregnancyWeekAtDate('2026-03-01', '2026-03-15'), 2);
    }, skip: skip);

    test('counts baby age from the stored birth day', () {
      setSystemTime(DateTime(2026, 3, 8, 20));
      expect(getRealCalendarAge('2026-03-01').totalDays, 7);
      expect(getRealCalendarAge(_utc('2026-03-01')).totalDays, 7);
    }, skip: skip);

    test('cycle day and predictions follow the local calendar', () {
      expect(getCycleDayForDate(DateTime(2026, 3, 15, 0, 30), DateTime(2026, 3, 1), 28), 15);
      setSystemTime(DateTime(2026, 3, 15, 0, 30));
      expect(ymd(getNextPeriodDate(DateTime(2026, 3, 1), 14)), [2026, 3, 29, 0]);
      setSystemTime(DateTime(2026, 3, 10, 12));
      final p = getCyclePredictions('2026-03-01', const [], 28, 5);
      expect(ymd(p.nextPeriodDate), [2026, 3, 29, 0]);
      expect(p.daysUntilNextPeriod, 19);
    }, skip: skip);
  });

  group('pregnancy dates in Europe/Berlin (DST 2026-03-29 and 2026-10-25)', () {
    test('is not a day late after either change', () {
      setSystemTime(DateTime(2026, 3, 29, 0, 30));
      expect(getPregnancyDay('2026-03-22'), 8);
      setSystemTime(DateTime(2026, 4, 5, 0, 30));
      expect(getPregnancyWeek('2026-03-22'), 2);
      expect(getDayInWeek('2026-03-22'), 0);
      expect(ymd(calculateDueDate('2026-01-18')), [2026, 10, 25, 0]);
      expect(ymd(calculateDueDate('2026-05-01')), [2027, 2, 5, 0]);
    }, skip: needsZone('Europe/Berlin'));
  });

  // The previous implementation, kept to prove UTC+3/+4 users (no DST) see identical numbers.
  const day = 86400000;
  int legacyDays(String lmp) {
    final a = DateTime.parse('${lmp}T00:00:00Z').toLocal();
    final t = DomainClock.now();
    final a0 = DateTime(a.year, a.month, a.day), t0 = DateTime(t.year, t.month, t.day);
    return ((t0.millisecondsSinceEpoch - a0.millisecondsSinceEpoch) / day).floor();
  }

  DateTime legacyDue(String lmp) {
    final a = DateTime.parse('${lmp}T00:00:00Z').toLocal();
    return DateTime.fromMillisecondsSinceEpoch(DateTime(a.year, a.month, a.day).millisecondsSinceEpoch + 280 * day);
  }

  group('no change in Asia/Baku', () {
    test('matches the old results for every day of a pregnancy and every hour of a day', () {
      const lmp = '2026-02-20';
      for (var d = 0; d < 300; d++) {
        for (final hour in [0, 3, 12, 23]) {
          setSystemTime(DateTime(2026, 2, 20 + d, hour, 15));
          final old = legacyDays(lmp);
          expect(getDaysElapsed(lmp), old.clamp(0, 280));
          expect(getPregnancyWeek(lmp), (old / 7).floor().clamp(0, 40));
          expect(getDayInWeek(lmp), old.remainder(7));
        }
      }
      expect(calculateDueDate(lmp)!.millisecondsSinceEpoch, legacyDue(lmp).millisecondsSinceEpoch);
      expect(calculateDueDate(_utc(lmp))!.millisecondsSinceEpoch, legacyDue(lmp).millisecondsSinceEpoch);
    }, skip: needsZone('Asia/Baku'));
  });
}
