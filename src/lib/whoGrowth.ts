/**
 * WHO Child Growth Standards (0-24 ay) — LMS metodu.
 * Mənbə: WHO Child Growth Standards, weight-for-age & length/height-for-age.
 *
 * z = ((X/M)^L − 1) / (L·S)   (L≠0)
 * percentil = Φ(z) × 100
 */

export type Sex = 'boy' | 'girl';
export type Measure = 'weight' | 'height';

interface LMS {L: number;M: number;S: number;}

// [ay][L, M, S] — WHO rəsmi cədvəlləri
const WFA_BOYS: [number, number, number][] = [
[0.3487, 3.3464, 0.14602], [0.2297, 4.4709, 0.13395], [0.1970, 5.5675, 0.12385],
[0.1738, 6.3762, 0.11727], [0.1553, 7.0023, 0.11316], [0.1395, 7.5105, 0.11080],
[0.1257, 7.9340, 0.10958], [0.1134, 8.2970, 0.10902], [0.1021, 8.6151, 0.10882],
[0.0917, 8.9014, 0.10881], [0.0820, 9.1649, 0.10891], [0.0730, 9.4122, 0.10906],
[0.0644, 9.6479, 0.10925], [0.0563, 9.8749, 0.10949], [0.0487, 10.0953, 0.10976],
[0.0413, 10.3108, 0.11007], [0.0343, 10.5228, 0.11041], [0.0275, 10.7319, 0.11079],
[0.0211, 10.9385, 0.11119], [0.0148, 11.1430, 0.11164], [0.0087, 11.3462, 0.11211],
[0.0029, 11.5486, 0.11261], [-0.0028, 11.7504, 0.11314], [-0.0083, 11.9514, 0.11369],
[-0.0137, 12.1515, 0.11426]];


const WFA_GIRLS: [number, number, number][] = [
[0.3809, 3.2322, 0.14171], [0.1714, 4.1873, 0.13724], [0.0962, 5.1282, 0.13000],
[0.0402, 5.8458, 0.12619], [-0.0050, 6.4237, 0.12402], [-0.0430, 6.8985, 0.12274],
[-0.0756, 7.2970, 0.12204], [-0.1039, 7.6422, 0.12178], [-0.1288, 7.9487, 0.12181],
[-0.1507, 8.2254, 0.12199], [-0.1700, 8.4800, 0.12223], [-0.1872, 8.7192, 0.12247],
[-0.2024, 8.9481, 0.12268], [-0.2158, 9.1699, 0.12283], [-0.2278, 9.3870, 0.12294],
[-0.2384, 9.6008, 0.12299], [-0.2478, 9.8124, 0.12303], [-0.2562, 10.0226, 0.12306],
[-0.2637, 10.2315, 0.12309], [-0.2703, 10.4393, 0.12315], [-0.2762, 10.6464, 0.12323],
[-0.2815, 10.8534, 0.12335], [-0.2862, 11.0608, 0.12350], [-0.2903, 11.2688, 0.12369],
[-0.2941, 11.4775, 0.12390]];


// Boy uzunluğu üçün L=1 (WHO length/height-for-age)
const LFA_BOYS: [number, number][] = [
[49.8842, 0.03795], [54.7244, 0.03557], [58.4249, 0.03424], [61.4292, 0.03328],
[63.8860, 0.03257], [65.9026, 0.03204], [67.6236, 0.03165], [69.1645, 0.03139],
[70.5994, 0.03124], [71.9687, 0.03117], [73.2812, 0.03118], [74.5388, 0.03125],
[75.7488, 0.03137], [76.9186, 0.03154], [78.0497, 0.03174], [79.1458, 0.03197],
[80.2113, 0.03222], [81.2487, 0.03250], [82.2587, 0.03279], [83.2418, 0.03310],
[84.1996, 0.03342], [85.1348, 0.03376], [86.0477, 0.03410], [86.9410, 0.03445],
[87.8161, 0.03481]];


const LFA_GIRLS: [number, number][] = [
[49.1477, 0.03790], [53.6872, 0.03640], [57.0673, 0.03568], [59.8029, 0.03520],
[62.0899, 0.03486], [64.0301, 0.03463], [65.7311, 0.03448], [67.2873, 0.03441],
[68.7498, 0.03440], [70.1435, 0.03444], [71.4818, 0.03452], [72.7710, 0.03464],
[74.0150, 0.03479], [75.2176, 0.03496], [76.3817, 0.03514], [77.5099, 0.03534],
[78.6055, 0.03555], [79.6710, 0.03576], [80.7079, 0.03598], [81.7182, 0.03620],
[82.7036, 0.03643], [83.6654, 0.03666], [84.6040, 0.03688], [85.5202, 0.03711],
[86.4153, 0.03734]];


function getLMS(measure: Measure, sex: Sex, ageMonths: number): LMS | null {
  if (ageMonths < 0 || ageMonths > 24) return null;
  const lo = Math.floor(ageMonths);
  const hi = Math.min(24, Math.ceil(ageMonths));
  const t = ageMonths - lo;

  const pick = (m: number): LMS => {
    if (measure === 'weight') {
      const row = (sex === 'boy' ? WFA_BOYS : WFA_GIRLS)[m];
      return { L: row[0], M: row[1], S: row[2] };
    }
    const row = (sex === 'boy' ? LFA_BOYS : LFA_GIRLS)[m];
    return { L: 1, M: row[0], S: row[1] };
  };

  const a = pick(lo);
  if (lo === hi) return a;
  const b = pick(hi);
  // Xətti interpolasiya (aylar arası)
  return {
    L: a.L + t * (b.L - a.L),
    M: a.M + t * (b.M - a.M),
    S: a.S + t * (b.S - a.S)
  };
}

/** Normal paylanmanın CDF-i (Abramowitz-Stegun erf approx.) */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (z > 0) p = 1 - p;
  return p;
}

/** Yaş (ay) — kəsrli. */
export function ageInMonths(birthDate: string | Date, atDate: string | Date): number {
  const b = new Date(birthDate);
  const a = new Date(atDate);
  return (a.getTime() - b.getTime()) / (30.4375 * 24 * 3600 * 1000);
}

/** Ölçünün z-score-u. null = yaş aralıqdan kənar. */
export function zScore(measure: Measure, sex: Sex, ageMonths: number, value: number): number | null {
  const lms = getLMS(measure, sex, ageMonths);
  if (!lms || value <= 0) return null;
  const { L, M, S } = lms;
  if (Math.abs(L) < 1e-6) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/** Percentil (0-100). null = hesablanmır. */
export function percentile(measure: Measure, sex: Sex, ageMonths: number, value: number): number | null {
  const z = zScore(measure, sex, ageMonths, value);
  if (z === null) return null;
  return Math.round(normCdf(z) * 100);
}

/** Verilmiş percentil üçün gözlənilən dəyər (əyri çəkmək üçün). */
export function valueAtPercentile(measure: Measure, sex: Sex, ageMonths: number, p: number): number | null {
  const lms = getLMS(measure, sex, ageMonths);
  if (!lms) return null;
  // Φ⁻¹ approx (Acklam qısa versiyası kifayətdir — sabit percentillər üçün dəqiq z-lər)
  const Z: Record<number, number> = { 3: -1.8808, 15: -1.0364, 50: 0, 85: 1.0364, 97: 1.8808 };
  const z = Z[p];
  if (z === undefined) return null;
  const { L, M, S } = lms;
  const val = Math.abs(L) < 1e-6 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
  return Math.round(val * 100) / 100;
}

export const CURVE_PERCENTILES = [3, 15, 50, 85, 97] as const;

export interface GrowthCurvePoint {
  month: number;
  p3: number | null;
  p15: number | null;
  p50: number | null;
  p85: number | null;
  p97: number | null;
  /** Uşağın ölçüsü (bu aya düşürsə) */
  child?: number | null;
}

/** 0-24 ay əyri məlumatı (recharts üçün). */
export function buildCurveData(measure: Measure, sex: Sex): GrowthCurvePoint[] {
  const data: GrowthCurvePoint[] = [];
  for (let m = 0; m <= 24; m++) {
    data.push({
      month: m,
      p3: valueAtPercentile(measure, sex, m, 3),
      p15: valueAtPercentile(measure, sex, m, 15),
      p50: valueAtPercentile(measure, sex, m, 50),
      p85: valueAtPercentile(measure, sex, m, 85),
      p97: valueAtPercentile(measure, sex, m, 97)
    });
  }
  return data;
}

/** Percentil şərhi (UI çipi üçün). */
export function percentileLabel(p: number): {tone: 'ok' | 'watch' | 'alert';} {
  if (p >= 15 && p <= 85) return { tone: 'ok' };
  if (p >= 3 && p <= 97) return { tone: 'watch' };
  return { tone: 'alert' };
}
