import { describe, it, expect } from 'vitest';
import { interpolateGain, SINGLE_GAIN_ANCHORS, MULTIPLE_GAIN_ANCHORS } from './pregnancyWeightGain';

// Bu, WeightTracker-in "Az/Normal/Çox" çəki-artım statusunu hesabladığı əsas
// məntiqdir. Əkiz/çoxdöllü ankerini (daha yüksək, 37-ci həftə həddi ilə) tək
// hamiləlik ankeri ilə qarışdırmaq real əkiz anaya SƏHV "çox artırırsınız"
// xəbərdarlığı verər (bax WeightTracker.tsx-dəki şərh).
describe('interpolateGain — singleton anchors', () => {
  it('returns [0,0] at or before week 0', () => {
    expect(interpolateGain(0, SINGLE_GAIN_ANCHORS)).toEqual([0, 0]);
    expect(interpolateGain(-5, SINGLE_GAIN_ANCHORS)).toEqual([0, 0]);
  });

  it('matches the exact anchor values at week 13, 26, 40', () => {
    expect(interpolateGain(13, SINGLE_GAIN_ANCHORS)).toEqual([0.5, 2]);
    expect(interpolateGain(26, SINGLE_GAIN_ANCHORS)).toEqual([4, 8]);
    expect(interpolateGain(40, SINGLE_GAIN_ANCHORS)).toEqual([8, 14]);
  });

  it('linearly interpolates midway between two anchors', () => {
    // Week 33 is exactly halfway between week 26 [4,8] and week 40 [8,14]
    // (33 = 26 + (40-26)/2)
    const [min, max] = interpolateGain(33, SINGLE_GAIN_ANCHORS);
    expect(min).toBeCloseTo(6, 5); // 4 + 0.5*(8-4)
    expect(max).toBeCloseTo(11, 5); // 8 + 0.5*(14-8)
  });

  it('holds steady at the last anchor value beyond week 40 (no extrapolation)', () => {
    expect(interpolateGain(42, SINGLE_GAIN_ANCHORS)).toEqual([8, 14]);
    expect(interpolateGain(45, SINGLE_GAIN_ANCHORS)).toEqual([8, 14]);
  });

  it('is monotonically non-decreasing across the full pregnancy', () => {
    let prevMin = -Infinity;
    let prevMax = -Infinity;
    for (let week = 0; week <= 42; week++) {
      const [min, max] = interpolateGain(week, SINGLE_GAIN_ANCHORS);
      expect(min).toBeGreaterThanOrEqual(prevMin);
      expect(max).toBeGreaterThanOrEqual(prevMax);
      prevMin = min;
      prevMax = max;
    }
  });
});

describe('interpolateGain — multiples (twin/triplet) anchors', () => {
  it('matches the exact anchor values at week 13, 26, 37', () => {
    expect(interpolateGain(13, MULTIPLE_GAIN_ANCHORS)).toEqual([0.5, 2]);
    expect(interpolateGain(26, MULTIPLE_GAIN_ANCHORS)).toEqual([6, 10]);
    expect(interpolateGain(37, MULTIPLE_GAIN_ANCHORS)).toEqual([16.8, 24.5]);
  });

  it('holds steady at the last anchor from week 37 onward (twins\' "full-term" is earlier than 40wk)', () => {
    expect(interpolateGain(37, MULTIPLE_GAIN_ANCHORS)).toEqual([16.8, 24.5]);
    expect(interpolateGain(40, MULTIPLE_GAIN_ANCHORS)).toEqual([16.8, 24.5]);
  });

  it('CRITICAL: gives a HIGHER recommended range than singleton at every week from 26 onward', () => {
    // Bu, əsl bugın idi: əkiz ana səhvən tək-hamiləlik ankeri ilə
    // qiymətləndirilirdisə, normal artımı ilə belə "çox artırırsınız"
    // xəbərdarlığı alırdı. Çoxdöllü ankeri HƏR ZAMAN tək-hamiləlikdən
    // yüksək/bərabər olmalıdır ki, bu SƏHV baş verməsin.
    for (const week of [26, 28, 30, 32, 34, 36, 37]) {
      const [singleMin, singleMax] = interpolateGain(week, SINGLE_GAIN_ANCHORS);
      const [multiMin, multiMax] = interpolateGain(week, MULTIPLE_GAIN_ANCHORS);
      expect(multiMin).toBeGreaterThanOrEqual(singleMin);
      expect(multiMax).toBeGreaterThan(singleMax);
    }
  });
});
