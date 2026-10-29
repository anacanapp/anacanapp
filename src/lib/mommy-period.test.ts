import { describe, expect, it } from 'vitest';
import { mommyCycleInsights, mommyPeriodStatus, phaseForCycleDay, recentDays } from './mommy-period';

const T = '2026-10-29';

describe('mommyPeriodStatus', () => {
  it('is none without recorded days', () => {
    expect(mommyPeriodStatus([], T, null)).toMatchObject({ state: 'none', dayNumber: 0 });
  });

  it('counts the current period from its first day when today is recorded', () => {
    expect(mommyPeriodStatus(['2026-10-27', '2026-10-28', '2026-10-29'], T, null))
      .toEqual({ state: 'today', start: '2026-10-27', lastDay: T, dayNumber: 3 });
  });

  it('keeps one missed log inside the same period', () => {
    expect(mommyPeriodStatus(['2026-10-26', '2026-10-28', '2026-10-29'], T, null)).toMatchObject({ start: '2026-10-26', dayNumber: 4 });
    expect(mommyPeriodStatus(['2026-10-20', '2026-10-29'], T, null)).toMatchObject({ start: T, dayNumber: 1 });
  });

  it('asks about today when the period was recorded until yesterday', () => {
    expect(mommyPeriodStatus(['2026-10-27', '2026-10-28'], T, null)).toMatchObject({ state: 'askToday', dayNumber: 3 });
  });

  it('is idle once ended or when the last day is older', () => {
    expect(mommyPeriodStatus(['2026-10-28', T], T, T)).toMatchObject({ state: 'idle', lastDay: T });
    expect(mommyPeriodStatus(['2026-10-27', '2026-10-28'], T, '2026-10-28')).toMatchObject({ state: 'idle' });
    expect(mommyPeriodStatus(['2026-10-01', '2026-10-02'], T, null)).toMatchObject({ state: 'idle', start: '2026-10-01' });
  });

  it('starts again after an ended period when a new day is recorded', () => {
    expect(mommyPeriodStatus(['2026-10-01', T], T, '2026-10-05')).toMatchObject({ state: 'today', start: T, dayNumber: 1 });
  });

  it('ignores future dates', () => {
    expect(mommyPeriodStatus(['2026-10-30'], T, null)).toMatchObject({ state: 'none' });
  });
});

describe('recentDays', () => {
  it('returns the last 14 days ending today, across months', () => {
    const days = recentDays('2026-11-03');
    expect(days).toHaveLength(14);
    expect(days[0]).toBe('2026-10-21');
    expect(days.at(-1)).toBe('2026-11-03');
  });
});

describe('mommyCycleInsights', () => {
  it('is null without recorded days', () => {
    expect(mommyCycleInsights([], T)).toBeNull();
  });

  it('forecasts from 28 days until two normal cycles are recorded', () => {
    expect(mommyCycleInsights(['2026-10-20', '2026-10-21', '2026-10-22'], T)).toMatchObject({
      cycleDay: 10, cycleLength: 28, periodLength: 3, nextPeriod: '2026-11-17', daysUntilNext: 19, cycles: [], learned: false });
  });

  it('learns normal cycles and flags a 53-day delay as an anomaly', () => {
    const insights = mommyCycleInsights(['2026-06-01', '2026-06-02', '2026-07-01',
      '2026-07-30', '2026-09-21', '2026-10-20'], T)!;
    expect(insights.cycles).toEqual([
      { start: '2026-09-21', length: 29, anomalous: false },
      { start: '2026-07-30', length: 53, anomalous: true },
      { start: '2026-07-01', length: 29, anomalous: false },
      { start: '2026-06-01', length: 30, anomalous: false },
    ]);
    expect(insights).toMatchObject({ learned: true, cycleLength: 29, nextPeriod: '2026-11-18' });
  });
});

describe('phaseForCycleDay', () => {
  it('maps cycle days to phases for a 28-day cycle with 5 period days', () => {
    expect(phaseForCycleDay(3, 28, 5)).toBe('menstrual');
    expect(phaseForCycleDay(9, 28, 5)).toBe('follicular');
    expect(phaseForCycleDay(14, 28, 5)).toBe('ovulation');
    expect(phaseForCycleDay(20, 28, 5)).toBe('luteal');
  });
});
