import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateDueDate, calculateLMPFromDueDate, getDayInWeek, getDaysElapsed, getDaysUntilDue,
  getPregnancyDay, getPregnancyWeek, getPregnancyWeekAtDate, getRealCalendarAge,
} from './pregnancy-utils';
import { storedCalendarDate } from './stored-date-key';
import { getCycleDayForDate, getNextPeriodDate } from './cycle-utils';
import { getCyclePredictions } from './cycle-predictions';

// Node re-reads process.env.TZ on assignment, so each block runs in a real zone with real DST rules.
const originalTz = process.env.TZ;
const inZone = (tz: string) => {
  beforeAll(() => { process.env.TZ = tz; });
  afterAll(() => { process.env.TZ = originalTz; });
};
const ymd = (d: Date | null) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()];

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('storedCalendarDate', () => {
  inZone('America/New_York');
  it('reads YYYY-MM-DD and UTC-midnight Dates as that calendar day at local midnight', () => {
    expect(ymd(storedCalendarDate('2026-03-01'))).toEqual([2026, 3, 1, 0]);
    expect(ymd(storedCalendarDate(new Date('2026-03-01')))).toEqual([2026, 3, 1, 0]);
    expect(ymd(storedCalendarDate(new Date(2026, 2, 1)))).toEqual([2026, 3, 1, 0]);
    expect(ymd(storedCalendarDate('2026-03-01T15:30:00-05:00'))).toEqual([2026, 3, 1, 0]);
    expect(storedCalendarDate('')).toBeNull();
    expect(storedCalendarDate('nope')).toBeNull();
  });
});

describe('pregnancy dates west of UTC (America/New_York, DST 2026-03-08)', () => {
  inZone('America/New_York');

  it('counts a YYYY-MM-DD LMP from that local day, not the previous one', () => {
    vi.setSystemTime(new Date(2026, 2, 1, 9));
    expect(getPregnancyDay('2026-03-01')).toBe(1);
    expect(getDaysElapsed('2026-03-01')).toBe(0);
    vi.setSystemTime(new Date(2026, 1, 28, 20));
    expect(getDaysElapsed('2026-03-01')).toBe(0); // LMP is tomorrow: clamped, not "1 day in"
  });

  it('turns the week at local midnight right after the spring-forward change', () => {
    vi.setSystemTime(new Date(2026, 2, 15, 0, 30)); // 14 calendar days, only 335 hours
    expect(getPregnancyWeek('2026-03-01')).toBe(2);
    expect(getDayInWeek('2026-03-01')).toBe(0);
    expect(getPregnancyWeek(new Date(2026, 2, 1))).toBe(2);
    expect(getPregnancyWeek(new Date('2026-03-01'))).toBe(2); // UTC-midnight value from an old store
  });

  it('keeps the due date at local midnight of LMP + 280 days across DST', () => {
    expect(ymd(calculateDueDate('2026-06-01'))).toEqual([2027, 3, 8, 0]);
    expect(ymd(calculateLMPFromDueDate('2027-03-08'))).toEqual([2026, 6, 1, 0]);
    vi.setSystemTime(new Date(2027, 2, 7, 23, 30));
    expect(getDaysUntilDue('2026-06-01')).toBe(1);
    expect(getDaysUntilDue(null, '2027-03-08')).toBe(1);
  });

  it('uses the scan calendar day for the fetal growth week', () => {
    expect(getPregnancyWeekAtDate('2026-03-01', '2026-03-15')).toBe(2);
  });

  it('counts baby age from the stored birth day', () => {
    vi.setSystemTime(new Date(2026, 2, 8, 20));
    expect(getRealCalendarAge('2026-03-01').totalDays).toBe(7);
    expect(getRealCalendarAge(new Date('2026-03-01')).totalDays).toBe(7);
  });

  it('cycle day and predictions follow the local calendar', () => {
    expect(getCycleDayForDate(new Date(2026, 2, 15, 0, 30), new Date(2026, 2, 1), 28)).toBe(15);
    vi.setSystemTime(new Date(2026, 2, 15, 0, 30));
    expect(ymd(getNextPeriodDate(new Date(2026, 2, 1), 14))).toEqual([2026, 3, 29, 0]);
    vi.setSystemTime(new Date(2026, 2, 10, 12));
    const p = getCyclePredictions('2026-03-01', [], 28, 5);
    expect(ymd(p.nextPeriodDate)).toEqual([2026, 3, 29, 0]);
    expect(p.daysUntilNextPeriod).toBe(19);
  });
});

describe('pregnancy dates in Europe/Berlin (DST 2026-03-29 and 2026-10-25)', () => {
  inZone('Europe/Berlin');
  it('is not a day late after either change', () => {
    vi.setSystemTime(new Date(2026, 2, 29, 0, 30)); // before 02:00 change, still same day
    expect(getPregnancyDay('2026-03-22')).toBe(8);
    vi.setSystemTime(new Date(2026, 3, 5, 0, 30));
    expect(getPregnancyWeek('2026-03-22')).toBe(2);
    expect(getDayInWeek('2026-03-22')).toBe(0);
    expect(ymd(calculateDueDate('2026-01-18'))).toEqual([2026, 10, 25, 0]);
    expect(ymd(calculateDueDate('2026-05-01'))).toEqual([2027, 2, 5, 0]);
  });
});

// The previous implementation, kept here to prove UTC+3/+4 users (no DST) see identical numbers.
const DAY = 86400000;
const legacyDays = (lmp: string) => {
  const a = new Date(lmp); const t = new Date();
  a.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - a.getTime()) / DAY);
};
const legacyDue = (lmp: string) => { const a = new Date(lmp); a.setHours(0, 0, 0, 0); return new Date(a.getTime() + 280 * DAY); };

describe.each(['Asia/Baku', 'Europe/Istanbul', 'Europe/Moscow'])('no change in %s', (tz) => {
  inZone(tz);
  it('matches the old results for every day of a pregnancy and every hour of a day', () => {
    const lmp = '2026-02-20';
    for (let day = 0; day < 300; day += 1) {
      for (const hour of [0, 3, 12, 23]) {
        vi.setSystemTime(new Date(2026, 1, 20 + day, hour, 15));
        const old = legacyDays(lmp);
        expect(getDaysElapsed(lmp)).toBe(Math.max(0, Math.min(280, old)));
        expect(getPregnancyWeek(lmp)).toBe(Math.max(0, Math.min(40, Math.floor(old / 7))));
        expect(getDayInWeek(lmp)).toBe(old % 7);
      }
    }
    expect(calculateDueDate(lmp)!.getTime()).toBe(legacyDue(lmp).getTime());
    expect(calculateDueDate(new Date(lmp))!.getTime()).toBe(legacyDue(lmp).getTime());
  });
});
