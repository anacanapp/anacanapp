import type { WeightGainAnchor } from '@/lib/pregnancyWeightGain';

/**
 * IOM 2009 total gain for a SINGLE pregnancy by pre-pregnancy BMI, as cumulative per-week anchors:
 * first trimester 0.5-2 kg for every category (IOM), then a straight line to the total at week 40.
 * The chart band and the status pill both read these anchors via interpolateGain, so they always agree.
 */
export type PregnancyBmiCategory = 'under' | 'normal' | 'over' | 'obese';

export const IOM_TOTAL_GAIN: Record<PregnancyBmiCategory, [number, number]> = {
  under: [12.5, 18],
  normal: [11.5, 16],
  over: [7, 11.5],
  obese: [5, 9],
};

export const singleGainAnchors = (category: PregnancyBmiCategory): WeightGainAnchor[] => {
  const [min, max] = IOM_TOTAL_GAIN[category];
  return [[0, 0, 0], [13, 0.5, 2], [40, min, max]];
};

export const isValidHeightCm = (h: number) => Number.isFinite(h) && h >= 120 && h <= 220;
export const isValidWeightKg = (w: number) => Number.isFinite(w) && w >= 30 && w <= 250;

/** BMI rounded to one decimal, or null when either value is missing/implausible. */
export function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (weightKg == null || heightCm == null || !isValidWeightKg(weightKg) || !isValidHeightCm(heightCm)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number | null): PregnancyBmiCategory | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'under';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'over';
  return 'obese';
}

/** Accepts "65.5", "65,5" and surrounding spaces; returns NaN for anything else. */
export function parseDecimal(input: string): number {
  const s = input.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
