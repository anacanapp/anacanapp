// Ported from: src/lib/local-date.test.ts (+ storedCalendarDate cases of src/lib/calendar-dates-tz.test.ts)

import 'package:anacan/domain/dates/local_date.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  group('local date keys', () {
    test('uses the local calendar day, not UTC', () {
      final lateNight = DateTime(2026, 11, 8, 1, 30);
      expect(localDateKey(lateNight), '2026-11-08');
      expect(daysAgoKey(1, lateNight), '2026-11-07');
      expect(daysAgoKey(8, DateTime(2026, 3, 3, 12)), '2026-02-23');
    });
  });

  group('storedCalendarDate (America/New_York)', () {
    test('reads YYYY-MM-DD and UTC-midnight Dates as that calendar day at local midnight', () {
      expect(ymd(storedCalendarDate('2026-03-01')), [2026, 3, 1, 0]);
      expect(ymd(storedCalendarDate(DateTime.parse('2026-03-01T00:00:00Z'))), [2026, 3, 1, 0]);
      expect(ymd(storedCalendarDate(DateTime(2026, 3, 1))), [2026, 3, 1, 0]);
      expect(ymd(storedCalendarDate('2026-03-01T15:30:00-05:00')), [2026, 3, 1, 0]);
      expect(storedCalendarDate(''), isNull);
      expect(storedCalendarDate('nope'), isNull);
    }, skip: needsZone('America/New_York'));
  });

  group('storedDateKey (any zone)', () {
    test('keeps a YYYY-MM-DD string and the UTC day of a UTC-midnight instant', () {
      expect(storedDateKey('2026-03-01'), '2026-03-01');
      expect(storedDateKey(DateTime.utc(2026, 3, 1)), '2026-03-01');
      expect(storedDateKey(null), isNull);
      expect(storedDateKey(''), isNull);
      expect(storedDateKey(DateTime(2026, 3, 1, 12)), '2026-03-01');
      expect(localDayStartIso('2026-03-01'), DateTime(2026, 3, 1).toUtc().toIso8601String());
    });
  });
}
