import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPrematurityInfo, PREMATURE_GESTATION_LIMIT_DAYS } from './pregnancy-utils';

describe('getPrematurityInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns neutral info when due_date is missing', () => {
    const info = getPrematurityInfo('2026-05-01', null);
    expect(info.isKnown).toBe(false);
    expect(info.isPremature).toBe(false);
    expect(info.correctionApplies).toBe(false);
    expect(info.corrected).toBeNull();
  });

  it('term baby (born on due date) is not premature', () => {
    const info = getPrematurityInfo('2026-05-01', '2026-05-01');
    expect(info.isKnown).toBe(true);
    expect(info.isPremature).toBe(false);
    expect(info.gestationalDaysAtBirth).toBe(280);
    expect(info.correctionDays).toBe(0);
  });

  it('baby born 8 days early (38w6d) is NOT premature', () => {
    // gestational = 280 - 8 = 272 days = 38w6d >= 259
    const info = getPrematurityInfo('2026-04-23', '2026-05-01');
    expect(info.isPremature).toBe(false);
    expect(info.gestationalDaysAtBirth).toBe(272);
    expect(info.correctionApplies).toBe(false);
  });

  it('baby born at 34 weeks is premature with correct gestational breakdown', () => {
    // 34w = 238 days; born 42 days before due date
    // birth 2026-06-01, due 2026-07-13 (42 days later)
    const info = getPrematurityInfo('2026-06-01', '2026-07-13');
    expect(info.isPremature).toBe(true);
    expect(info.gestationalDaysAtBirth).toBe(238);
    expect(info.gestationalWeeksAtBirth).toBe(34);
    expect(info.gestationalExtraDays).toBe(0);
    expect(info.correctionDays).toBe(42);
    expect(info.correctionApplies).toBe(true);
    // corrected age = time since due date = 2026-07-13 -> 2026-08-27 = 45 days
    expect(info.corrected?.totalDays).toBe(45);
  });

  it('boundary: exactly 37 weeks (259 days) is NOT premature', () => {
    // born 21 days before due: gestational = 259
    const info = getPrematurityInfo('2026-06-01', '2026-06-22');
    expect(info.gestationalDaysAtBirth).toBe(PREMATURE_GESTATION_LIMIT_DAYS);
    expect(info.isPremature).toBe(false);
  });

  it('boundary: 258 days (36w6d) IS premature', () => {
    const info = getPrematurityInfo('2026-06-01', '2026-06-23');
    expect(info.gestationalDaysAtBirth).toBe(258);
    expect(info.isPremature).toBe(true);
  });

  it('clamps corrected age to 0 when baby has not reached the due date yet', () => {
    // premature baby born 2026-08-20, due 2026-10-01 (in the future)
    const info = getPrematurityInfo('2026-08-20', '2026-10-01');
    expect(info.isPremature).toBe(true);
    expect(info.corrected?.totalDays).toBe(0);
  });

  it('rejects implausible due dates (bad data)', () => {
    // due 200 days after birth => gestational = 80 days — impossible
    const info = getPrematurityInfo('2026-01-01', '2026-07-20');
    expect(info.isKnown).toBe(false);
    expect(info.correctionApplies).toBe(false);
  });

  it('stops applying correction after 24 months corrected age', () => {
    // premature baby: born 2024-05-01, due 2024-06-26 (56 days early = 32w)
    // corrected age at 2026-08-27 = ~26 months > 24
    const info = getPrematurityInfo('2024-05-01', '2024-06-26');
    expect(info.isPremature).toBe(true);
    expect(info.corrected!.months).toBeGreaterThanOrEqual(24);
    expect(info.correctionApplies).toBe(false);
  });
});
