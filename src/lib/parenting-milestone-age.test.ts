import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));

import az from '@/data/parenting/az';
import { checkpointFor, milestoneAge, milestoneCheckEnd, milestoneCheckOffered, tooEarlyForMilestones } from './parenting';

const NOW = new Date(2026, 10, 8, 10);
const cps = az.milestoneQuiz.checkpoints;

describe('Tərbiyə milestone check: age limits', () => {
  it('ends 12 months after the last checkpoint (6 years → offered until the 7th birthday)', () => {
    expect(Math.max(...cps.map((c) => c.fromMonths))).toBe(72);
    expect(milestoneCheckEnd(cps)).toBe(84);
    expect(milestoneCheckEnd([])).toBeNull();
  });

  it('is offered from birth until 6 years and never in the 6–12 band (owner decision)', () => {
    expect(milestoneCheckOffered(cps, 2, '0-1')).toBe(true); // the "too early" note handles newborns
    expect(milestoneCheckOffered(cps, 30, '1-3')).toBe(true);
    expect(milestoneCheckOffered(cps, 71, '3-6')).toBe(true);
    expect(milestoneCheckOffered(cps, 72, '6-12')).toBe(false);
    expect(milestoneCheckOffered(cps, 83, '6-12')).toBe(false);
    expect(milestoneCheckOffered(cps, 84, '6-12')).toBe(false);
    expect(milestoneCheckOffered(cps, 120, '6-12')).toBe(false);
    // An age wins over a manually chosen band.
    expect(milestoneCheckOffered(cps, 30, '6-12')).toBe(true);
    expect(milestoneCheckOffered([], 30, '1-3')).toBe(false);
  });

  it('without a birth date: offered for 0–6 bands, never for the 6–12 band', () => {
    expect(milestoneCheckOffered(cps, null, '0-1')).toBe(true);
    expect(milestoneCheckOffered(cps, null, '3-6')).toBe(true);
    expect(milestoneCheckOffered(cps, null, '6-12')).toBe(false);
  });
});

describe('Tərbiyə milestone check: corrected age for preterm babies', () => {
  it('uses the calendar age without a due date, for a term baby or an implausible due date', () => {
    expect(milestoneAge('2026-03-08', null, NOW)).toEqual({ months: 8, corrected: false });
    expect(milestoneAge('2026-03-08', '2026-03-15', NOW)).toEqual({ months: 8, corrected: false }); // 39 weeks: term
    expect(milestoneAge('2026-03-08', '2026-03-08', NOW)).toEqual({ months: 8, corrected: false }); // 40 weeks
    expect(milestoneAge('2026-03-08', '2026-12-30', NOW)).toEqual({ months: 8, corrected: false }); // 'born at 1 week': a typing error
    expect(milestoneAge(null, '2026-03-08', NOW)).toEqual({ months: null, corrected: false });
  });

  it('counts a preterm baby’s age from the due date (32 weeks → 2 months younger)', () => {
    // Born 2026-03-08 at 32 weeks: due 8 weeks later (2026-05-03).
    expect(milestoneAge('2026-03-08', '2026-05-03', NOW)).toEqual({ months: 6, corrected: true });
    // 36+6 weeks is still preterm (< 37 weeks).
    expect(milestoneAge('2026-03-08', '2026-03-30', NOW)).toEqual({ months: 7, corrected: true });
  });

  it('is 0 months before the due date and stops correcting at 24 corrected months', () => {
    expect(milestoneAge('2026-10-01', '2026-12-01', NOW)).toEqual({ months: 0, corrected: true });
    expect(milestoneAge('2024-08-01', '2024-10-01', NOW)).toEqual({ months: 27, corrected: false }); // 25 corrected → calendar
    expect(milestoneAge('2024-10-01', '2024-12-01', NOW)).toEqual({ months: 23, corrected: true }); // 25 calendar, 23 corrected
  });

  it('a preterm 5-month-old (3 months corrected) is still "too early" and a preterm 10-month-old reads the 4-month checkpoint', () => {
    const young = milestoneAge('2026-06-08', '2026-08-08', NOW); // 5 months, born ~31 weeks
    expect(young).toEqual({ months: 3, corrected: true });
    expect(tooEarlyForMilestones(cps, young.months)).toBe(4);
    const older = milestoneAge('2026-01-08', '2026-03-15', NOW); // 10 months, ~30–31 weeks
    expect(older.corrected).toBe(true);
    expect(checkpointFor(cps, older.months)?.fromMonths).toBe(4);
    expect(checkpointFor(cps, 10)?.fromMonths).toBe(9);
  });
});
