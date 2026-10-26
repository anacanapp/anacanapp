/**
 * Fetal Growth Tracker — USM-əsaslı təxmini körpə çəkisi (EFW) üçün persentil
 * arayış datası + köməkçi funksiyalar.
 *
 * MƏNBƏ: Hadlock-tipli fetal çəki nomoqramları (standart akuşerlik təcrübəsində
 * istifadə olunan ümumi qəbul edilmiş yanaşma) — 50-ci persentil (median) dəyərləri
 * tətbiqin özündəki FRUIT_SIZES (src/types/anacan.ts) datası ilə 20/24/28/32/36/40-cı
 * həftələrdə QƏSDƏN eynidir (tutarlılıq üçün — Dashboard-dakı "meyvə boyu" ilə bu
 * qrafik arasında ziddiyyət olmasın deyə). ARALIQ həftələr üçün hamar interpolyasiya,
 * p3/p10/p90/p97 isə median-a nisbətdə təxmini əmsallarla hesablanıb.
 *
 * QEYD: Bu, ÜMUMİ maarifləndirmə/trend izləmə vasitəsidir — HƏKİMİNİZİN USM
 * hesabatındakı dəqiq persentili əvəz ETMİR (bax MedicalDisclaimer).
 */

export interface FetalWeightBand {
  week: number;
  p3: number;
  p10: number;
  p50: number;
  p90: number;
  p97: number;
}

// Həftə → 50-ci persentil (median) EFW (qram). 20/24/28/32/36/40 = FRUIT_SIZES ilə eyni.
const MEDIAN_EFW_BY_WEEK: Record<number, number> = {
  20: 300, 21: 350, 22: 410, 23: 480,
  24: 600, 25: 660, 26: 760, 27: 875,
  28: 1000, 29: 1150, 30: 1320, 31: 1500,
  32: 1700, 33: 1920, 34: 2150, 35: 2380,
  36: 2600, 37: 2850, 38: 3080, 39: 3250,
  40: 3400
};

// Median-a nisbətdə təxmini persentil əmsalları (sağa-çarpıq paylanma — real EFW
// statistikasına uyğun, whoGrowth.ts-dəki LMS metodu ilə oxşar məntiq).
const PCT_MULTIPLIERS = { p3: 0.72, p10: 0.80, p90: 1.20, p97: 1.32 } as const;

export const FETAL_GROWTH_MIN_WEEK = 20;
export const FETAL_GROWTH_MAX_WEEK = 40;

/** Verilmiş həftə üçün tam persentil zolağı (20-dən aşağı/40-dan yuxarı klamplanır). */
export const getFetalWeightBand = (week: number): FetalWeightBand => {
  const w = Math.max(FETAL_GROWTH_MIN_WEEK, Math.min(FETAL_GROWTH_MAX_WEEK, Math.round(week)));
  const p50 = MEDIAN_EFW_BY_WEEK[w];
  return {
    week: w,
    p3: Math.round(p50 * PCT_MULTIPLIERS.p3 / 5) * 5,
    p10: Math.round(p50 * PCT_MULTIPLIERS.p10 / 5) * 5,
    p50,
    p90: Math.round(p50 * PCT_MULTIPLIERS.p90 / 5) * 5,
    p97: Math.round(p50 * PCT_MULTIPLIERS.p97 / 5) * 5
  };
};

/** Bütün qrafik üçün 20-40 həftə aralığında tam persentil zolağı massivi. */
export const buildFetalGrowthChartData = (): FetalWeightBand[] => {
  const data: FetalWeightBand[] = [];
  for (let w = FETAL_GROWTH_MIN_WEEK; w <= FETAL_GROWTH_MAX_WEEK; w++) {
    data.push(getFetalWeightBand(w));
  }
  return data;
};

/**
 * Verilmiş həftə + qram üçün TƏXMİNİ persentil (0-100) — 5 nöqtə arasında xətti
 * interpolyasiya. Diaqnostik dəqiqlik iddiası yoxdur, ümumi trend göstəricisidir.
 */
export const estimatePercentileForWeight = (week: number, grams: number): number => {
  const band = getFetalWeightBand(week);
  const points: [number, number][] = [
  [3, band.p3],
  [10, band.p10],
  [50, band.p50],
  [90, band.p90],
  [97, band.p97]];


  if (grams <= points[0][1]) return 3;
  if (grams >= points[points.length - 1][1]) return 97;

  for (let i = 1; i < points.length; i++) {
    const [pPrev, gPrev] = points[i - 1];
    const [pCur, gCur] = points[i];
    if (grams <= gCur) {
      const t = (grams - gPrev) / (gCur - gPrev);
      return Math.round(pPrev + t * (pCur - pPrev));
    }
  }
  return 50;
};

export type PercentileTone = 'watch-low' | 'ok' | 'watch-high';

/** Persentilin ümumi tonu — 10-90 arası "normal aralıq", kənarlar həkimlə müzakirəyə dəyər. */
export const percentileTone = (percentile: number): PercentileTone => {
  if (percentile < 10) return 'watch-low';
  if (percentile > 90) return 'watch-high';
  return 'ok';
};

export type DiscordanceLevel = 'normal' | 'watch' | 'high';

/**
 * Əkiz/üçüz hamiləlikdə körpələr arası çəki UYĞUNSUZLUĞU (discordance) —
 * (ən böyük − ən kiçik) / ən böyük × 100. Klinik olaraq ≥20% əhəmiyyətli
 * uyğunsuzluq sayılır və daha yaxın izləmə tələb edə bilər.
 */
export const calculateDiscordance = (efwGramsList: number[]): {percent: number;level: DiscordanceLevel;} | null => {
  const valid = efwGramsList.filter((v) => v > 0);
  if (valid.length < 2) return null;

  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const percent = Math.round(max > 0 ? (max - min) / max * 100 : 0);

  const level: DiscordanceLevel = percent >= 20 ? 'high' : percent >= 10 ? 'watch' : 'normal';

  return { percent, level };
};

/** Əkiz/üçüz/dördüz üçün baby_label seçimləri — user_children hələ yoxdur (doğuşdan əvvəl). */
export const BABY_LABELS = ['A', 'B', 'C', 'D'] as const;
export type BabyLabel = typeof BABY_LABELS[number];
