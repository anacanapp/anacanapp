import { describe, expect, it } from 'vitest';
import { mommyPeriodStatus, recentDays } from './mommy-period';

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
