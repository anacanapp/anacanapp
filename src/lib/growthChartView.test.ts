import { describe, expect, it } from 'vitest';
import {
  GROWTH_MEASURES, chartMaxMonth, chartTicks, childPoints, latestPercentile, measureLabel, measurePercentile,
  measureValue, percentileChip, type GrowthEntryLike } from
'./growthChartView';
import { HCFA_BOYS, HCFA_GIRLS } from './whoGrowthData';
import { percentile } from './whoGrowth';

const entry = (entry_date: string, v: Partial<GrowthEntryLike> = {}): GrowthEntryLike =>
  ({ entry_date, weight_kg: null, height_cm: null, head_cm: null, ...v });

describe('growth chart range', () => {
  it('keeps 0-24 months while the child is younger than two', () => {
    for (const age of [0, 3.5, 12, 23.9, 24, Number.NaN, -1]) expect(chartMaxMonth(age)).toBe(24);
  });

  it('extends to the child age in 6-month steps, capped at 60', () => {
    expect(chartMaxMonth(24.1)).toBe(30);
    expect(chartMaxMonth(30)).toBe(30);
    expect(chartMaxMonth(37.2)).toBe(42);
    expect(chartMaxMonth(59)).toBe(60);
    expect(chartMaxMonth(80)).toBe(60);
  });

  it('has readable ticks that always end at the last month', () => {
    expect(chartTicks(24)).toEqual([0, 6, 12, 18, 24]);
    expect(chartTicks(30)).toEqual([0, 6, 12, 18, 24, 30]);
    expect(chartTicks(42)).toEqual([0, 12, 24, 36, 42]);
    expect(chartTicks(60)).toEqual([0, 12, 24, 36, 48, 60]);
  });
});

describe('growth measures', () => {
  it('offers weight, height and head circumference with their labels', () => {
    expect(GROWTH_MEASURES).toEqual(['weight', 'height', 'head']);
    expect(measureLabel('weight')).toEqual({ key: 'who_weight', fallback: 'Çəki (kq)' });
    expect(measureLabel('height')).toEqual({ key: 'who_height', fallback: 'Boy (sm)' });
    expect(measureLabel('head')).toEqual({ key: 'growthtz_who_head', fallback: 'Baş çevrəsi (sm)' });
  });

  it('reads only positive recorded values of the selected measure', () => {
    const e = entry('2024-01-01', { weight_kg: 4, height_cm: 0, head_cm: 36 });
    expect(measureValue(e, 'weight')).toBe(4);
    expect(measureValue(e, 'height')).toBeNull();
    expect(measureValue(e, 'head')).toBe(36);
  });

  it('places points by age from the reference date, sorted and limited to the range', () => {
    const entries = [
      entry('2027-01-01', { head_cm: 50 }), // ~36 m
      entry('2024-07-01', { head_cm: 43 }),
      entry('2023-12-01', { head_cm: 33 }), // before birth: dropped
      entry('2024-01-01', { head_cm: 34.5 }),
      entry('2024-03-01', { weight_kg: 5 }) // no head value
    ];
    const pts = childPoints(entries, 'head', '2024-01-01', 24);
    expect(pts.map((p) => p.value)).toEqual([34.5, 43]);
    expect(pts[0].month).toBe(0);
    expect(childPoints(entries, 'head', '2024-01-01', 60).map((p) => p.value)).toEqual([34.5, 43, 50]);
  });
});

describe('latest percentile', () => {
  it('uses the WHO head circumference table for head (median = P50) per sex', () => {
    expect(latestPercentile([entry('2024-01-01', { head_cm: HCFA_BOYS[0][0] })], 'head', 'boy', '2024-01-01')).toBe(50);
    expect(latestPercentile([entry('2024-01-01', { head_cm: HCFA_GIRLS[0][0] })], 'head', 'girl', '2024-01-01')).toBe(50);
    expect(measurePercentile('weight', 'boy', 6, 8)).toBe(percentile('weight', 'boy', 6, 8));
  });

  it('takes the most recent measurement, not the first row', () => {
    const entries = [
      entry('2024-01-01', { head_cm: HCFA_BOYS[0][0] }),
      entry('2024-07-01', { head_cm: 50 }) // far above P97 at ~6 months
    ];
    expect(latestPercentile(entries, 'head', 'boy', '2024-01-01')).toBeGreaterThan(97);
    expect(latestPercentile([...entries].reverse(), 'head', 'boy', '2024-01-01')).toBeGreaterThan(97);
  });

  it('works up to 60 months (standing height after 24 months) and stops after', () => {
    expect(latestPercentile([entry('2027-01-01', { height_cm: 96 })], 'height', 'girl', '2024-01-01')).not.toBeNull();
    expect(latestPercentile([entry('2029-06-01', { weight_kg: 20 })], 'weight', 'boy', '2024-01-01')).toBeNull();
    expect(latestPercentile([], 'head', 'boy', '2024-01-01')).toBeNull();
  });

  it('uses the given reference date (corrected age for preterm babies)', () => {
    // Same measurement, younger corrected age => higher percentile.
    const entries = [entry('2024-04-01', { head_cm: 38 })];
    const chrono = latestPercentile(entries, 'head', 'boy', '2024-01-01') as number;
    const corrected = latestPercentile(entries, 'head', 'boy', '2024-02-15') as number;
    expect(corrected).toBeGreaterThan(chrono);
  });
});

describe('percentile chip', () => {
  it('maps percentiles to tone and label', () => {
    expect(percentileChip(50)).toEqual({ tone: 'ok', key: 'who_normal', fallback: 'normal' });
    expect(percentileChip(15)).toMatchObject({ tone: 'ok' });
    expect(percentileChip(85)).toMatchObject({ tone: 'ok' });
    expect(percentileChip(10)).toEqual({ tone: 'watch', key: 'who_watch', fallback: 'izləyin' });
    expect(percentileChip(97)).toMatchObject({ tone: 'watch' });
    expect(percentileChip(2)).toEqual({ tone: 'alert', key: 'who_alert', fallback: 'həkimlə danışın' });
    expect(percentileChip(99)).toMatchObject({ tone: 'alert' });
  });
});
