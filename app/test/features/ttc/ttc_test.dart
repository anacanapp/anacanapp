// Ported from: src/lib/ttc.test.ts (+ chanceFor / monthsTrying / bbtShift cases)
import 'package:anacan/features/ttc/ttc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TTC doctor threshold by age', () {
    final now = DateTime(2026, 11, 8);

    test('uses 6 months from age 35 and 12 months below 35', () {
      expect(doctorThreshold(35), 6);
      expect(doctorThreshold(34), 12);
      expect(doctorThresholdFor({'birth_year': 1991}, now), 6);
      expect(doctorThresholdFor({'birth_year': 1985}, now), 6);
      expect(doctorThresholdFor({'birth_year': 1992}, now), 12);
      expect(doctorThresholdFor({'birth_year': 2000}, now), 12);
    });

    test('keeps 12 months when the age is unknown or invalid', () {
      expect(doctorThresholdFor(null, now), 12);
      expect(doctorThresholdFor({}, now), 12);
      expect(doctorThresholdFor({'birth_year': 1800}, now), 12);
      expect(doctorThresholdFor({'birth_year': 2025}, now), 12);
      expect(doctorThresholdFor({'birth_year': 1990.5}, now), 12);
    });

    test('validates birth years and derives the age', () {
      expect(validBirthYear('1990', now), 1990);
      expect(validBirthYear('abc', now), isNull);
      expect(validBirthYear(2014, now), 2014);
      expect(validBirthYear(2015, now), isNull);
      expect(ageFromBirthYear(1991, now), 35);
      expect(ageFromBirthYear(null, now), isNull);
    });
  });

  group('cycle helpers', () {
    test('chanceFor relative to ovulation', () {
      final ov = DateTime(2026, 9, 24);
      expect(chanceFor(DateTime(2026, 9, 23), ov), 'peak');
      expect(chanceFor(DateTime(2026, 9, 24, 18), ov), 'peak');
      expect(chanceFor(DateTime(2026, 9, 21), ov), 'high');
      expect(chanceFor(DateTime(2026, 9, 25), ov), 'medium');
      expect(chanceFor(DateTime(2026, 9, 26), ov), 'low');
    });

    test('monthsTrying counts whole months', () {
      expect(monthsTrying(null), isNull);
      expect(monthsTrying('2026-09-01', DateTime(2026, 9, 14)), 0);
      expect(monthsTrying('2026-03-15', DateTime(2026, 9, 14)), 5);
      expect(monthsTrying('2026-03-01', DateTime(2026, 9, 14)), 6);
    });

    test('bbtShift: three over six', () {
      expect(bbtShift([36.4, 36.5, 36.4, 36.5, 36.4, 36.5, 36.8, 36.8, 36.9]), 6);
      expect(bbtShift([36.4, 36.5, 36.4, null, 36.5, 36.4, 36.5, 36.6]), isNull);
    });

    test('fill keeps unknown placeholders', () {
      expect(fill('{n}. ay {x}', {'n': 3}), '3. ay {x}');
    });
  });
}
