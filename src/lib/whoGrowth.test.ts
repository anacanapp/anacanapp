import { describe, it, expect } from 'vitest';
import { percentile, zScore, percentileLabel, ageInMonths } from './whoGrowth';

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

  it('returns null for an age outside the supported 0-24 month range', () => {
    expect(percentile('weight', 'boy', -1, 5)).toBeNull();
    expect(percentile('weight', 'boy', 25, 5)).toBeNull();
    expect(zScore('weight', 'boy', 30, 5)).toBeNull();
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
