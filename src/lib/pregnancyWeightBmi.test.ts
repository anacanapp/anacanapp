import { expect, it } from 'vitest';
import { interpolateGain } from './pregnancyWeightGain';
import { bmiCategory, computeBmi, parseDecimal, singleGainAnchors } from './pregnancyWeightBmi';

it('classifies pre-pregnancy BMI with the WHO/IOM cut-offs', () => {
  expect(bmiCategory(computeBmi(50, 170))).toBe('under'); // 17.3
  expect(bmiCategory(computeBmi(60, 165))).toBe('normal'); // 22.0
  expect(bmiCategory(computeBmi(75, 165))).toBe('over'); // 27.5
  expect(bmiCategory(computeBmi(90, 165))).toBe('obese'); // 33.1
  expect(bmiCategory(18.5)).toBe('normal');
  expect(bmiCategory(25)).toBe('over');
  expect(bmiCategory(30)).toBe('obese');
  expect(computeBmi(60, null)).toBeNull();
  expect(computeBmi(60, 80)).toBeNull();
});

it('ends at the IOM 2009 single-pregnancy totals at 40 weeks', () => {
  expect(interpolateGain(40, singleGainAnchors('under'))).toEqual([12.5, 18]);
  expect(interpolateGain(40, singleGainAnchors('normal'))).toEqual([11.5, 16]);
  expect(interpolateGain(40, singleGainAnchors('over'))).toEqual([7, 11.5]);
  expect(interpolateGain(40, singleGainAnchors('obese'))).toEqual([5, 9]);
  expect(interpolateGain(13, singleGainAnchors('obese'))).toEqual([0.5, 2]);
});

it('accepts comma and dot decimals only', () => {
  expect(parseDecimal('65,5')).toBe(65.5);
  expect(parseDecimal(' 65.5 ')).toBe(65.5);
  expect(parseDecimal('70')).toBe(70);
  expect(Number.isNaN(parseDecimal('6a'))).toBe(true);
  expect(Number.isNaN(parseDecimal(''))).toBe(true);
});
