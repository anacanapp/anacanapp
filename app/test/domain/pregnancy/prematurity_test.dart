// Ported from: src/lib/prematurity.test.ts

import 'package:anacan/domain/pregnancy/pregnancy_utils.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  group('getPrematurityInfo', () {
    setUp(() => setSystemTime(DateTime.parse('2026-08-27T12:00:00Z')));

    test('returns neutral info when due_date is missing', () {
      final info = getPrematurityInfo('2026-05-01', null);
      expect(info.isKnown, false);
      expect(info.isPremature, false);
      expect(info.correctionApplies, false);
      expect(info.corrected, isNull);
    });

    test('term baby (born on due date) is not premature', () {
      final info = getPrematurityInfo('2026-05-01', '2026-05-01');
      expect(info.isKnown, true);
      expect(info.isPremature, false);
      expect(info.gestationalDaysAtBirth, 280);
      expect(info.correctionDays, 0);
    });

    test('baby born 8 days early (38w6d) is NOT premature', () {
      final info = getPrematurityInfo('2026-04-23', '2026-05-01');
      expect(info.isPremature, false);
      expect(info.gestationalDaysAtBirth, 272);
      expect(info.correctionApplies, false);
    });

    test('baby born at 34 weeks is premature with correct gestational breakdown', () {
      final info = getPrematurityInfo('2026-06-01', '2026-07-13');
      expect(info.isPremature, true);
      expect(info.gestationalDaysAtBirth, 238);
      expect(info.gestationalWeeksAtBirth, 34);
      expect(info.gestationalExtraDays, 0);
      expect(info.correctionDays, 42);
      expect(info.correctionApplies, true);
      expect(info.corrected?.totalDays, 45);
    });

    test('boundary: exactly 37 weeks (259 days) is NOT premature', () {
      final info = getPrematurityInfo('2026-06-01', '2026-06-22');
      expect(info.gestationalDaysAtBirth, prematureGestationLimitDays);
      expect(info.isPremature, false);
    });

    test('boundary: 258 days (36w6d) IS premature', () {
      final info = getPrematurityInfo('2026-06-01', '2026-06-23');
      expect(info.gestationalDaysAtBirth, 258);
      expect(info.isPremature, true);
    });

    test('clamps corrected age to 0 when baby has not reached the due date yet', () {
      final info = getPrematurityInfo('2026-08-20', '2026-10-01');
      expect(info.isPremature, true);
      expect(info.corrected?.totalDays, 0);
    });

    test('rejects implausible due dates (bad data)', () {
      final info = getPrematurityInfo('2026-01-01', '2026-07-20');
      expect(info.isKnown, false);
      expect(info.correctionApplies, false);
    });

    test('stops applying correction after 24 months corrected age', () {
      final info = getPrematurityInfo('2024-05-01', '2024-06-26');
      expect(info.isPremature, true);
      expect(info.corrected!.months, greaterThanOrEqualTo(24));
      expect(info.correctionApplies, false);
    });
  });
}
