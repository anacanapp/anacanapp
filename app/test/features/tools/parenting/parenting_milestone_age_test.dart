// Ported from: src/lib/parenting-milestone-age.test.ts
import 'package:anacan/domain/parenting/parenting.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

final DateTime now = DateTime(2026, 11, 8, 10);
final List<MilestoneCheckpoint> cps = contentOf('az').milestoneQuiz!.checkpoints;

void expectAge(({int? months, bool corrected}) actual, int? months, bool corrected) {
  expect(actual.months, months);
  expect(actual.corrected, corrected);
}

void main() {
  group('Tərbiyə milestone check: age limits', () {
    test('ends 12 months after the last checkpoint (6 years → offered until the 7th birthday)', () {
      expect(cps.map((c) => c.fromMonths).reduce((a, b) => a > b ? a : b), 72);
      expect(milestoneCheckEnd(cps), 84);
      expect(milestoneCheckEnd(const []), isNull);
    });

    test('is offered from birth until 6 years and never in the 6–12 band (owner decision)', () {
      expect(milestoneCheckOffered(cps, 2, '0-1'), true); // the "too early" note handles newborns
      expect(milestoneCheckOffered(cps, 30, '1-3'), true);
      expect(milestoneCheckOffered(cps, 71, '3-6'), true);
      expect(milestoneCheckOffered(cps, 72, '6-12'), false);
      expect(milestoneCheckOffered(cps, 83, '6-12'), false);
      expect(milestoneCheckOffered(cps, 84, '6-12'), false);
      expect(milestoneCheckOffered(cps, 120, '6-12'), false);
      // An age wins over a manually chosen band.
      expect(milestoneCheckOffered(cps, 30, '6-12'), true);
      expect(milestoneCheckOffered(const [], 30, '1-3'), false);
    });

    test('without a birth date: offered for 0–6 bands, never for the 6–12 band', () {
      expect(milestoneCheckOffered(cps, null, '0-1'), true);
      expect(milestoneCheckOffered(cps, null, '3-6'), true);
      expect(milestoneCheckOffered(cps, null, '6-12'), false);
    });
  });

  group('Tərbiyə milestone check: corrected age for preterm babies', () {
    test('uses the calendar age without a due date, for a term baby or an implausible due date', () {
      expectAge(milestoneAge('2026-03-08', null, now), 8, false);
      expectAge(milestoneAge('2026-03-08', '2026-03-15', now), 8, false); // 39 weeks: term
      expectAge(milestoneAge('2026-03-08', '2026-03-08', now), 8, false); // 40 weeks
      expectAge(milestoneAge('2026-03-08', '2026-12-30', now), 8, false); // 'born at 1 week': a typing error
      expectAge(milestoneAge(null, '2026-03-08', now), null, false);
    });

    test('counts a preterm baby’s age from the due date (32 weeks → 2 months younger)', () {
      // Born 2026-03-08 at 32 weeks: due 8 weeks later (2026-05-03).
      expectAge(milestoneAge('2026-03-08', '2026-05-03', now), 6, true);
      // 36+6 weeks is still preterm (< 37 weeks).
      expectAge(milestoneAge('2026-03-08', '2026-03-30', now), 7, true);
    });

    test('is 0 months before the due date and stops correcting at 24 corrected months', () {
      expectAge(milestoneAge('2026-10-01', '2026-12-01', now), 0, true);
      expectAge(milestoneAge('2024-08-01', '2024-10-01', now), 27, false); // 25 corrected → calendar
      expectAge(milestoneAge('2024-10-01', '2024-12-01', now), 23, true); // 25 calendar, 23 corrected
    });

    test('a preterm 5-month-old (3 months corrected) is still "too early" and a preterm 10-month-old reads the 4-month checkpoint', () {
      final young = milestoneAge('2026-06-08', '2026-08-08', now); // 5 months, born ~31 weeks
      expectAge(young, 3, true);
      expect(tooEarlyForMilestones(cps, young.months), 4);
      final older = milestoneAge('2026-01-08', '2026-03-15', now); // 10 months, ~30–31 weeks
      expect(older.corrected, true);
      expect(checkpointFor(cps, older.months)?.fromMonths, 4);
      expect(checkpointFor(cps, 10)?.fromMonths, 9);
    });
  });
}
