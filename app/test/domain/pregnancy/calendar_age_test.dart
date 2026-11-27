// Ported from: src/lib/calendar-age.test.ts
// The two `vi.stubEnv('TZ', 'America/New_York')` cases run only when the process zone is America/New_York.

import 'package:anacan/domain/pregnancy/pregnancy_utils.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  group('calendar age and day-of-life content', () {
    test('opens Day 1 at birth without adding a completed day or month to medical age', () {
      setSystemTime(DateTime(2026, 9, 14, 12));
      final a = getRealCalendarAge('2026-09-14');
      expect([a.totalDays, a.dayNumber, a.months, a.days, a.displayText], [0, 1, 0, 0, '1-ci gün']);
      setSystemTime(DateTime(2026, 9, 15, 0, 1));
      final b = getRealCalendarAge('2026-09-14');
      expect([b.totalDays, b.dayNumber, b.months], [1, 2, 0]);
    });

    test('does not advance the 11-month anniversary from September 17 to September 11', () {
      setSystemTime(DateTime(2026, 9, 11, 12));
      var a = getRealCalendarAge('2025-10-17');
      expect([a.months, a.days], [10, 25]);
      setSystemTime(DateTime(2026, 9, 16, 12));
      expect(getRealCalendarAge('2025-10-17').months, 10);
      setSystemTime(DateTime(2026, 9, 17, 0, 1));
      a = getRealCalendarAge('2025-10-17');
      expect([a.months, a.days], [11, 0]);
    });

    for (final (birth, today, months, days) in [
      ('2025-01-31', DateTime(2025, 2, 28, 12), 1, 0),
      ('2025-01-31', DateTime(2025, 3, 30, 12), 1, 30),
      ('2025-01-31', DateTime(2025, 3, 31, 12), 2, 0),
      ('2024-01-31', DateTime(2024, 2, 29, 12), 1, 0),
      ('2024-02-29', DateTime(2025, 2, 28, 12), 12, 0),
    ]) {
      test('anchors month-end anniversaries to $birth', () {
        setSystemTime(today);
        final a = getRealCalendarAge(birth);
        expect([a.months, a.days], [months, days]);
      });
    }

    test('parses a date-only birthday in the local calendar west of UTC', () {
      setSystemTime(DateTime(2026, 9, 14, 0, 1));
      final a = getRealCalendarAge('2026-09-14');
      expect([a.totalDays, a.dayNumber], [0, 1]);
    }, skip: needsZone('America/New_York'));

    for (final (today, birth) in [
      (DateTime(2026, 3, 9, 12), '2026-03-07'),
      (DateTime(2026, 11, 2, 12), '2026-10-31'),
    ]) {
      test('counts calendar days across daylight-saving changes ($birth)', () {
        setSystemTime(today);
        final a = getRealCalendarAge(birth);
        expect([a.totalDays, a.dayNumber], [2, 3]);
      }, skip: needsZone('America/New_York'));
    }

    test('keeps premature content available at Day 1 before the due date', () {
      setSystemTime(DateTime(2026, 9, 14, 12));
      final info = getPrematurityInfo('2026-09-14', '2026-10-26');
      expect(info.correctionApplies, true);
      expect([info.corrected!.totalDays, info.corrected!.dayNumber, info.corrected!.months], [0, 1, 0]);
    });

    test('does not fabricate Day 1 for missing, invalid or future birthdays', () {
      setSystemTime(DateTime(2026, 9, 14, 12));
      for (final birth in [null, 'not-a-date', '2026-09-15']) {
        expect(getRealCalendarAge(birth).dayNumber, 0);
      }
      expect(getBabyDayNumber(double.nan), 0);
    });
  });
}
