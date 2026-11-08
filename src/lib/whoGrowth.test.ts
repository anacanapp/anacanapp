import { describe, it, expect } from 'vitest';
import { percentile, zScore, percentileLabel, ageInMonths, valueAtPercentile, buildCurveData, headCircumferencePercentile, headCircumferenceZScore } from './whoGrowth';

// WHO böyümə faizi hesablaması — səhv olarsa, körpənin böyümə problemini
// (failure-to-thrive) gizlədə və ya səhv həyəcan siqnalı verə bilər.
describe('whoGrowth.percentile / zScore', () => {
  it('returns exactly the 50th percentile when the value equals the median (z=0)', () => {
    // WFA_BOYS[0] median (M) = 3.3464 kg (WHO rəsmi cədvəl, 0 ay)
    const p = percentile('weight', 'boy', 0, 3.3464);
    expect(p).toBe(50);
  });

  it('is monotonically increasing: a heavier baby at the same age/sex has a higher percentile', () => {
    const low = percentile('weight', 'boy', 6, 6.0);
    const mid = percentile('weight', 'boy', 6, 7.9340); // ~median at 6mo
    const high = percentile('weight', 'boy', 6, 10.5);
    expect(low).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(high).not.toBeNull();
    expect((low as number) < (mid as number)).toBe(true);
    expect((mid as number) < (high as number)).toBe(true);
  });

  it('flags a significantly underweight value with a low percentile (<15, "watch/alert" territory)', () => {
    // ~5kg heavily below the ~7.9kg median at 6 months
    const p = percentile('weight', 'boy', 6, 5.0);
    expect(p).not.toBeNull();
    expect((p as number) < 15).toBe(true);
  });

  it('flags a significantly overweight value with a high percentile (>85)', () => {
    const p = percentile('weight', 'boy', 6, 11.5);
    expect(p).not.toBeNull();
    expect((p as number) > 85).toBe(true);
  });

  it('returns null for an age outside the supported 0-60 month range', () => {
    expect(percentile('weight', 'boy', -1, 5)).toBeNull();
    expect(percentile('weight', 'boy', 61, 15)).toBeNull();
    expect(zScore('height', 'girl', 72, 110)).toBeNull();
    expect(zScore('head', 'boy', Number.NaN, 45)).toBeNull();
  });

  it('returns null for a non-positive measured value (invalid input, not a real measurement)', () => {
    expect(percentile('weight', 'girl', 3, 0)).toBeNull();
    expect(percentile('weight', 'girl', 3, -2)).toBeNull();
  });

  it('boy and girl medians differ (uses sex-specific WHO tables, not a shared curve)', () => {
    const boyMedianWeight = 3.3464; // WFA_BOYS[0]
    const girlPercentileAtBoyMedian = percentile('weight', 'girl', 0, boyMedianWeight);
    // Boy median weight is ABOVE the girl median at birth (girls' median is 3.2322kg) →
    // should read as (slightly) above the 50th percentile on the girls' curve.
    expect(girlPercentileAtBoyMedian).not.toBeNull();
    expect((girlPercentileAtBoyMedian as number) >= 50).toBe(true);
  });
});

describe('whoGrowth.percentileLabel', () => {
  it('labels the healthy "ok" range as 15-85 inclusive', () => {
    expect(percentileLabel(50).tone).toBe('ok');
    expect(percentileLabel(15).tone).toBe('ok');
    expect(percentileLabel(85).tone).toBe('ok');
  });

  it('labels the "watch" range as 3-14 and 86-97', () => {
    expect(percentileLabel(10).tone).toBe('watch');
    expect(percentileLabel(3).tone).toBe('watch');
    expect(percentileLabel(97).tone).toBe('watch');
    expect(percentileLabel(90).tone).toBe('watch');
  });

  it('labels extreme percentiles (<3 or >97) as "alert"', () => {
    expect(percentileLabel(2).tone).toBe('alert');
    expect(percentileLabel(0).tone).toBe('alert');
    expect(percentileLabel(98).tone).toBe('alert');
    expect(percentileLabel(100).tone).toBe('alert');
  });
});

describe('whoGrowth.ageInMonths', () => {
  it('computes ~1 month for a 30.4375-day gap (WHO average month length)', () => {
    const birth = new Date('2026-01-01T00:00:00Z');
    const at = new Date('2026-01-31T10:30:00Z'); // ~30.4375 days later
    expect(ageInMonths(birth, at)).toBeCloseTo(1, 1);
  });

  it('returns 0 for the same date', () => {
    const d = '2026-06-15T00:00:00Z';
    expect(ageInMonths(d, d)).toBe(0);
  });
});

// WHO Child Growth Standards z-score tables (-2 SD / median / +2 SD), rounded to 0.1 as published.
describe('whoGrowth 2-5 years and head circumference (WHO reference points)', () => {
  const sdValue = (measure: 'weight' | 'height' | 'head', sex: 'boy' | 'girl', age: number, z: number) => {
    let lo = 1, hi = 200;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if ((zScore(measure, sex, age, mid) as number) < z) lo = mid; else hi = mid;
    }
    return Math.round(lo * 10) / 10;
  };
  const cases: [('weight' | 'height' | 'head'), ('boy' | 'girl'), number, number, number, number][] = [
    ['weight', 'boy', 36, 11.3, 14.3, 18.3],
    ['weight', 'boy', 60, 14.1, 18.3, 24.2],
    ['weight', 'girl', 60, 13.7, 18.2, 24.9],
    ['height', 'boy', 24, 81.0, 87.1, 93.2],
    ['height', 'boy', 60, 100.7, 110.0, 119.2],
    ['height', 'girl', 60, 99.9, 109.4, 118.9],
    ['head', 'boy', 0, 31.9, 34.5, 37.0],
    ['head', 'boy', 12, 43.5, 46.1, 48.6],
    ['head', 'girl', 24, 44.4, 47.2, 50.0],
    ['head', 'boy', 60, 47.7, 50.7, 53.7],
    ['head', 'girl', 60, 47.1, 49.9, 52.8],
  ];
  it.each(cases)('%s %s %i months matches WHO -2SD/median/+2SD', (measure, sex, age, minus2, median, plus2) => {
    expect(Math.round((valueAtPercentile(measure, sex, age, 50) as number) * 10) / 10).toBe(median);
    expect(sdValue(measure, sex, age, -2)).toBe(minus2);
    expect(sdValue(measure, sex, age, 2)).toBe(plus2);
  });

  it('uses recumbent length before 24 months and standing height from 24 months', () => {
    // WHO: length-for-age median at 24 m boys 87.8 cm, height-for-age median 87.1 cm.
    expect(Math.round((valueAtPercentile('height', 'boy', 23.999, 50) as number) * 10) / 10).toBe(87.8);
    expect(valueAtPercentile('height', 'boy', 24, 50)).toBe(87.12);
  });

  it('keeps the 0-24 month values unchanged', () => {
    expect(percentile('weight', 'boy', 0, 3.3464)).toBe(50);
    expect(percentile('height', 'girl', 12, 74.015)).toBe(50);
    expect(buildCurveData('weight', 'boy')).toHaveLength(25);
    expect(buildCurveData('head', 'girl', 60)).toHaveLength(61);
  });

  it('head circumference helpers', () => {
    expect(headCircumferencePercentile('boy', 0, 34.46)).toBe(50);
    expect(headCircumferencePercentile('girl', 0, 33.88)).toBe(50);
    expect(headCircumferenceZScore('boy', 12, 46.07)).toBeCloseTo(0, 2);
    expect((headCircumferencePercentile('boy', 6, 40) as number) < 3).toBe(true);
    expect(headCircumferencePercentile('boy', 6, 0)).toBeNull();
  });
});
