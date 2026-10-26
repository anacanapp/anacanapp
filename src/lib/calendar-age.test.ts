import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBabyDayNumber, getPrematurityInfo, getRealCalendarAge } from './pregnancy-utils';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('calendar age and day-of-life content', () => {
  it('opens Day 1 at birth without adding a completed day or month to medical age', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 12));
    expect(getRealCalendarAge('2026-09-14')).toMatchObject({
      totalDays: 0, dayNumber: 1, months: 0, days: 0, displayText: '1-ci gün',
    });
    vi.setSystemTime(new Date(2026, 8, 15, 0, 1));
    expect(getRealCalendarAge('2026-09-14')).toMatchObject({ totalDays: 1, dayNumber: 2, months: 0 });
  });

  it('does not advance the 11-month anniversary from September 17 to September 11', () => {
    vi.setSystemTime(new Date(2026, 8, 11, 12));
    expect(getRealCalendarAge('2025-10-17')).toMatchObject({ months: 10, days: 25 });
    vi.setSystemTime(new Date(2026, 8, 16, 12));
    expect(getRealCalendarAge('2025-10-17').months).toBe(10);
    vi.setSystemTime(new Date(2026, 8, 17, 0, 1));
    expect(getRealCalendarAge('2025-10-17')).toMatchObject({ months: 11, days: 0 });
  });

  it.each([
    ['2025-01-31', new Date(2025, 1, 28, 12), 1, 0],
    ['2025-01-31', new Date(2025, 2, 30, 12), 1, 30],
    ['2025-01-31', new Date(2025, 2, 31, 12), 2, 0],
    ['2024-01-31', new Date(2024, 1, 29, 12), 1, 0],
    ['2024-02-29', new Date(2025, 1, 28, 12), 12, 0],
  ])('anchors month-end anniversaries to %s', (birth, today, months, days) => {
    vi.setSystemTime(today);
    expect(getRealCalendarAge(birth)).toMatchObject({ months, days });
  });

  it('parses a date-only birthday in the local calendar west of UTC', () => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.setSystemTime(new Date(2026, 8, 14, 0, 1));
    expect(getRealCalendarAge('2026-09-14')).toMatchObject({ totalDays: 0, dayNumber: 1 });
  });

  it.each([
    [new Date(2026, 2, 9, 12), '2026-03-07'],
    [new Date(2026, 10, 2, 12), '2026-10-31'],
  ])('counts calendar days across daylight-saving changes', (today, birth) => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.setSystemTime(today);
    expect(getRealCalendarAge(birth)).toMatchObject({ totalDays: 2, dayNumber: 3 });
  });

  it('keeps premature content available at Day 1 before the due date', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 12));
    const info = getPrematurityInfo('2026-09-14', '2026-10-26');
    expect(info.correctionApplies).toBe(true);
    expect(info.corrected).toMatchObject({ totalDays: 0, dayNumber: 1, months: 0 });
  });

  it('does not fabricate Day 1 for missing, invalid or future birthdays', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 12));
    for (const birth of [null, 'not-a-date', '2026-09-15']) {
      expect(getRealCalendarAge(birth).dayNumber).toBe(0);
    }
    expect(getBabyDayNumber(NaN)).toBe(0);
  });
});
