/**
 * Fetal Growth Tracker — USM-əsaslı təxmini körpə çəkisi (EFW) üçün persentil arayış datası + köməkçi funksiyalar.
 *
 * MƏNBƏ (2026-11-12): Hadlock FP, Harrist RB, Martinez-Poyer J. In utero analysis of fetal growth: a sonographic
 * weight standard. Radiology 1991;181:129-133, Cədvəl 1: 3, 10, 50, 90, 97-ci persentillər birbaşa cədvəldən
 * (src/lib/fetal-size.ts). Əvvəlki versiya medianı 6-17 % aşağı və persentilləri təxmini əmsallarla verirdi; orta
 * çəkili körpə alətdə 63-91-ci persentil kimi görünürdü. Audit: docs/FETAL_SIZE_DATA.md.
 *
 * QEYD: Bu, ÜMUMİ maarifləndirmə/trend izləmə vasitəsidir — HƏKİMİNİZİN USM hesabatındakı dəqiq persentili əvəz
 * ETMİR (bax MedicalDisclaimer).
 */
import { HADLOCK_EFW } from './fetal-size';

export interface FetalWeightBand {
  week: number;
  p3: number;
  p10: number;
  p50: number;
  p90: number;
  p97: number;
}

export const FETAL_GROWTH_MIN_WEEK = 20;
export const FETAL_GROWTH_MAX_WEEK = 40;

/** Verilmiş həftə üçün tam persentil zolağı (20-dən aşağı/40-dan yuxarı klamplanır). */
export const getFetalWeightBand = (week: number): FetalWeightBand => {
  const w = Math.max(FETAL_GROWTH_MIN_WEEK, Math.min(FETAL_GROWTH_MAX_WEEK, Math.round(week)));
  const [p3, p10, p50, p90, p97] = HADLOCK_EFW[w];
  return { week: w, p3, p10, p50, p90, p97 };
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
