import { describe, it, expect } from 'vitest';
import { estimateConception, estimateGrowth, estimatePeriodCalendar, estimatePregnancyWeight, makeCalendarFile, normalCdf, recommendedGainAtWeek, whoLms, whoZScore, CalculatorInputError, ToolInputError } from './calculators';

describe('pregnancy weight gain (IOM 2009)', () => {
  it('classifies BMI and gives the cumulative range for the current week', () => {
    const result = estimatePregnancyWeight({ preWeightKg: 60, heightCm: 165, currentWeightKg: 65, week: 20, twins: false });
    expect(result).toMatchObject({ bmi: 22, category: 'normal', totalRange: [11.5, 16], weeklyRate: [0.35, 0.5], weekRange: [3, 5.5], gain: 5, position: 'within' });
    expect(estimatePregnancyWeight({ preWeightKg: 60, heightCm: 165, currentWeightKg: 67, week: 20, twins: false }).position).toBe('above');
    expect(estimatePregnancyWeight({ preWeightKg: 60, heightCm: 165, currentWeightKg: 61, week: 20, twins: false }).position).toBe('below');
  });
  it('prorates 0.5-2 kg through the first trimester and uses category rates after it', () => {
    expect(recommendedGainAtWeek('normal', 10)).toEqual([0.4, 1.5]);
    expect(recommendedGainAtWeek('normal', 13)).toEqual([0.5, 2]);
    expect(recommendedGainAtWeek('underweight', 40)).toEqual([12.4, 17.7]);
    expect(recommendedGainAtWeek('obese', 40)).toEqual([5.1, 9.3]);
  });
  it('uses the WHO BMI cut-offs on the rounded BMI', () => {
    expect(estimatePregnancyWeight({ preWeightKg: 50, heightCm: 165, currentWeightKg: 50, week: 8, twins: false }).category).toBe('underweight');
    expect(estimatePregnancyWeight({ preWeightKg: 68, heightCm: 165, currentWeightKg: 68, week: 8, twins: false })).toMatchObject({ bmi: 25, category: 'overweight' });
    expect(estimatePregnancyWeight({ preWeightKg: 82, heightCm: 165, currentWeightKg: 82, week: 8, twins: false }).category).toBe('obese');
  });
  it('gives the provisional twin totals without a weekly rate and none for underweight', () => {
    expect(estimatePregnancyWeight({ preWeightKg: 95, heightCm: 160, currentWeightKg: 100, week: 22, twins: true })).toMatchObject({ category: 'obese', totalRange: [11, 19], weekRange: null, position: null });
    expect(estimatePregnancyWeight({ preWeightKg: 45, heightCm: 165, currentWeightKg: 50, week: 22, twins: true }).totalRange).toBeNull();
  });
  it('rejects impossible input', () => {
    expect(() => estimatePregnancyWeight({ preWeightKg: NaN, heightCm: 165, currentWeightKg: 60, week: 20, twins: false })).toThrow(ToolInputError);
    expect(() => estimatePregnancyWeight({ preWeightKg: 60, heightCm: 165, currentWeightKg: 60, week: 43, twins: false })).toThrow('weekError');
    expect(() => estimatePregnancyWeight({ preWeightKg: 60, heightCm: 165, currentWeightKg: 60, week: 12.5, twins: false })).toThrow('weekError');
  });
});

describe('conception date', () => {
  it('estimates from the last period, adjusted by cycle length', () => {
    expect(estimateConception({ from: 'lmp', date: '2026-09-01', cycleLength: 28 }, '2026-10-06')).toEqual({ conception: '2026-09-15', windowStart: '2026-09-13', windowEnd: '2026-09-17',
      fertileStart: '2026-09-10', fertileEnd: '2026-09-15', dueDate: '2027-06-08', lastPeriod: '2026-09-01' });
    expect(estimateConception({ from: 'lmp', date: '2026-09-01', cycleLength: 32 }, '2026-10-06')).toMatchObject({ conception: '2026-09-19', dueDate: '2027-06-12' });
  });
  it('estimates from a due date as due date minus 266 days, across a leap day', () => {
    expect(estimateConception({ from: 'due', date: '2027-06-08', cycleLength: 28 }, '2026-10-06')).toMatchObject({ conception: '2026-09-15', lastPeriod: '2026-09-01' });
    expect(estimateConception({ from: 'due', date: '2024-03-15', cycleLength: 28 }, '2026-10-06')).toMatchObject({ conception: '2023-06-23', lastPeriod: '2023-06-09' });
  });
  it('rejects future periods, invalid cycles and implausible due dates', () => {
    expect(() => estimateConception({ from: 'lmp', date: '2026-11-01', cycleLength: 28 }, '2026-10-06')).toThrow(CalculatorInputError);
    expect(() => estimateConception({ from: 'lmp', date: '2026-09-01', cycleLength: 50 }, '2026-10-06')).toThrow('cycleError');
    expect(() => estimateConception({ from: 'due', date: '2028-01-01', cycleLength: 28 }, '2026-10-06')).toThrow('dueDateError');
    expect(() => estimateConception({ from: 'due', date: '2026-02-30', cycleLength: 28 }, '2026-10-06')).toThrow('dateError');
  });
});

describe('period calendar', () => {
  it('repeats the cycle estimate for six cycles and exports them to .ics', () => {
    const cycles = estimatePeriodCalendar({ lastPeriod: '2026-10-01', cycleLength: 28, periodLength: 5, lutealLength: 14 }, 6, '2026-10-06');
    expect(cycles).toHaveLength(6);
    expect(cycles[0]).toMatchObject({ periodStart: '2026-10-01', periodEnd: '2026-10-05', ovulation: '2026-10-15', nextPeriod: '2026-10-29' });
    expect(cycles[1]).toMatchObject({ periodStart: '2026-10-29', ovulation: '2026-11-12', fertileStart: '2026-11-07' });
    expect(cycles[5].nextPeriod).toBe('2027-03-18');
    const ics = makeCalendarFile(cycles.map(cycle => ({ date: cycle.nextPeriod, title: 'Period', description: 'Estimate', id: 'period' })), new Date('2026-10-06T12:00:00Z'));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(6);
    expect(new Set(ics.match(/UID:[^\r]+/g)).size).toBe(6);
  });
  it('rolls an old last period forward so the list starts with the upcoming period', () => {
    const cycles = estimatePeriodCalendar({ lastPeriod: '2026-07-01', cycleLength: 28, periodLength: 5, lutealLength: 14 }, 6, '2026-10-06');
    expect(cycles[0]).toMatchObject({ periodStart: '2026-09-23', nextPeriod: '2026-10-21', ovulation: '2026-10-07' });
    expect(estimatePeriodCalendar({ lastPeriod: '2026-09-08', cycleLength: 28, periodLength: 5, lutealLength: 14 }, 6, '2026-10-06')[0].nextPeriod).toBe('2026-10-06');
  });
});

describe('WHO growth standards', () => {
  // Expected z-scores come from WHO's daily LMS tables (anthro package) with the WHO formula.
  it('matches WHO z-scores at tabulated days, including the restricted tails', () => {
    const z = (indicator: 'weight' | 'length' | 'head', sex: 'male' | 'female', day: number, value: number) => Math.round(whoZScore(value, whoLms(indicator, sex, day)) * 100) / 100;
    expect(z('weight', 'male', 364, 10)).toBe(0.34);
    expect(z('length', 'female', 182, 65)).toBe(-0.31);
    expect(z('head', 'male', 0, 34.5)).toBe(0.03);
    expect(z('head', 'female', 497, 44)).toBe(-1.4);
    expect(z('length', 'male', 1096, 90)).toBe(-1.64);
    expect(z('weight', 'female', 1001, 8)).toBe(-4.1);
    expect(z('weight', 'male', 98, 10)).toBe(3.88);
    expect(whoLms('weight', 'male', 0)).toEqual({ l: 0.3487, m: 3.3464, s: 0.14602 });
  });
  it('interpolates between weekly rows within 0.01 z of the daily table', () => {
    const z = (indicator: 'weight' | 'length' | 'head', sex: 'male' | 'female', day: number, value: number) => whoZScore(value, whoLms(indicator, sex, day));
    expect(z('weight', 'male', 365, 10)).toBeCloseTo(0.33, 1);
    expect(Math.abs(z('weight', 'male', 366, 10) - 0.32)).toBeLessThan(0.011);
    expect(Math.abs(z('length', 'female', 180, 65) + 0.26)).toBeLessThan(0.011);
    expect(Math.abs(z('weight', 'female', 1000, 8) + 4.1)).toBeLessThan(0.011);
    expect(Math.abs(z('weight', 'male', 100, 10) - 3.82)).toBeLessThan(0.011);
  });
  it('reports age, percentile and validates input', () => {
    const result = estimateGrowth({ indicator: 'weight', sex: 'male', birthDate: '2025-10-06', measureDate: '2026-10-05', value: 10 }, '2026-10-06');
    expect(result).toMatchObject({ ageDays: 364, ageMonths: 11, z: 0.34 });
    expect(result.percentile).toBeCloseTo(63.3, 1);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(-1.881)).toBeCloseTo(0.03, 3);
    expect(normalCdf(1.036)).toBeCloseTo(0.85, 3);
    expect(() => estimateGrowth({ indicator: 'weight', sex: 'male', birthDate: '2022-01-01', measureDate: '2026-10-05', value: 10 }, '2026-10-06')).toThrow('ageError');
    expect(() => estimateGrowth({ indicator: 'head', sex: 'female', birthDate: '2026-01-01', measureDate: '2026-10-05', value: 80 }, '2026-10-06')).toThrow('measureError');
    expect(() => estimateGrowth({ indicator: 'length', sex: 'female', birthDate: '2026-10-07', measureDate: '2026-10-05', value: 60 }, '2026-10-06')).toThrow('dateError');
  });
});
