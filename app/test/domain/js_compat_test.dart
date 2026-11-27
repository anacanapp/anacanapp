// Tests for app/lib/domain/js_compat.dart: JavaScript / date-fns semantics the ports rely on.
// Expected values were checked against Node 22 (V8) and date-fns 3.6.

import 'package:anacan/domain/js_compat.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  group('numbers', () {
    test('Math.round rounds .5 up, also for negatives', () {
      expect(jsRound(2.5), 3);
      expect(jsRound(-2.5), -2);
      expect(jsRound(-2.6), -3);
      expect(jsRound(0.49999999999999994), 0);
      expect(jsRound(1.005 * 100) / 100, 1);
      expect(jsRound(double.nan).isNaN, isTrue);
    });

    test('% keeps the sign of the dividend', () {
      expect(jsRem(-3, 7), -3);
      expect(-3 % 7, 4); // Dart, for contrast
      expect(jsRem(10, 7), 3);
    });

    test('Number() coercion', () {
      expect(jsNumber(null), 0);
      expect(jsNumber(''), 0);
      expect(jsNumber(' 12.5 '), 12.5);
      expect(jsNumber('0x1F'), 31);
      expect(jsNumber('12px').isNaN, isTrue);
      expect(jsNumber(true), 1);
      expect(jsNumber('Infinity'), double.infinity);
    });

    test('String(number) has no ".0" and toFixed matches JS', () {
      expect(jsNumberToString(331.0), '331');
      expect(jsNumberToString(0.01), '0.01');
      expect(jsNumberToString(-0.5), '-0.5');
      expect((2.5).toStringAsFixed(0), '3');
      expect((-2.5).toStringAsFixed(0), '-3');
      expect((1.005).toStringAsFixed(2), '1.00');
      expect((0.125).toStringAsFixed(2), '0.13');
    });

    test('FNV-1a with Math.imul and >>> 0', () {
      expect(fnv1a32(''), 2166136261);
      expect(fnv1a32('a'), 3826002220);
      expect(fnv1a32('2026-11-12|c1|3y|g1'), fnv1a32('2026-11-12|c1|3y|g1'));
      expect(fnv1a32('ə'), isNot(fnv1a32('e')));
    });

    test('sort is stable and treats NaN as equal', () {
      final items = [('a', 1), ('b', 0), ('c', 1), ('d', 0), ('e', 1)];
      expect(jsSorted(items, (a, b) => a.$2 - b.$2).map((e) => e.$1).join(), 'bdace');
      expect(jsSorted([3, 1, 2], (a, b) => double.nan), [3, 1, 2]);
    });
  });

  group('JS Date parsing', () {
    test('date-only ISO is UTC midnight, date-time without offset is local', () {
      expect(jsParseDate('2026-03-01')!.toUtc(), DateTime.utc(2026, 3, 1));
      expect(jsParseDate('2026-03-01T10:00:00'), DateTime(2026, 3, 1, 10));
      expect(jsParseDate('2026-03-01 10:00'), DateTime(2026, 3, 1, 10));
      expect(jsParseDate('2026-03-01T10:00:00Z')!.toUtc(), DateTime.utc(2026, 3, 1, 10));
      expect(jsParseDate('2026-03-01T10:00+0400')!.toUtc(), DateTime.utc(2026, 3, 1, 6));
      expect(jsParseDate('2026-03-01T15:30:00-05:00')!.toUtc(), DateTime.utc(2026, 3, 1, 20, 30));
      expect(jsParseDate('2026-03-01T10:00:00.123456Z')!.millisecond, 123);
    });

    test('V8 lets the day overflow up to 31 and rejects the rest', () {
      expect(jsParseDate('2026-02-30')!.toUtc(), DateTime.utc(2026, 3, 2));
      expect(jsParseDate('2026-13-01'), isNull);
      expect(jsParseDate('2026-03-01T25:00'), isNull);
      expect(jsParseDate('not-a-date'), isNull);
      expect(jsParseDate('bad'), isNull);
      expect(jsParseDate('2026-3-1'), DateTime(2026, 3, 1));
    });

    test('toISOString', () {
      expect(jsToIsoString(DateTime.utc(2026, 11, 8, 10)), '2026-11-08T10:00:00.000Z');
    });
  });

  group('date-fns', () {
    test('parseISO keeps date-only values on the local day and rejects impossible days', () {
      expect(parseIsoDateFns('2026-09-14'), DateTime(2026, 9, 14));
      expect(parseIsoDateFns('20260914'), DateTime(2026, 9, 14));
      expect(parseIsoDateFns('2026-09-14T10:00'), DateTime(2026, 9, 14, 10));
      expect(parseIsoDateFns('2026-09-14T10:00:00Z')!.toUtc(), DateTime.utc(2026, 9, 14, 10));
      expect(parseIsoDateFns('2026-02-30'), isNull);
      expect(parseIsoDateFns('not-a-date'), isNull);
      expect(parseIsoDateFns('2026-9-14'), isNull);
    });

    test('addMonths clamps month ends; differenceInCalendarDays counts civil days', () {
      expect(addMonths(DateTime(2024, 1, 31), 1), DateTime(2024, 2, 29));
      expect(addMonths(DateTime(2025, 1, 31), 1), DateTime(2025, 2, 28));
      expect(addMonths(DateTime(2024, 2, 29), 12), DateTime(2025, 2, 28));
      expect(addMonths(DateTime(2026, 5, 31, 13, 5), -2), DateTime(2026, 3, 31, 13, 5));
      expect(differenceInCalendarDays(DateTime(2026, 3, 15, 0, 30), DateTime(2026, 3, 1, 23)), 14);
      expect(differenceInCalendarDays(DateTime(2026, 1, 1), DateTime(2026, 1, 2)), -1);
      expect(formatYmd(DateTime(2026, 1, 5)), '2026-01-05');
    });

    test('DST: a local wall time inside the spring gap moves forward like JS', () {
      // new Date(2026, 2, 29, 2, 30) in Europe/Berlin is 03:30 CEST.
      expect(DateTime(2026, 3, 29, 2, 30).hour, 3);
    }, skip: needsZone('Europe/Berlin'));

    test('addDays keeps the wall-clock time across the US spring change', () {
      final d = addDays(DateTime(2026, 3, 7, 9), 2);
      expect([d.day, d.hour], [9, 9]);
      expect(d.difference(DateTime(2026, 3, 7, 9)).inHours, 47);
    }, skip: needsZone('America/New_York'));
  });
}
