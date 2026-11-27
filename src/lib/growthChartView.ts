/**
 * İnkişaf izləyicisinin WHO qrafiki üçün təmiz köməkçilər (BabyGrowthTracker).
 * Çəki, boy və baş çevrəsi; qrafik uşağın yaşına qədər (0-60 ay), uşaq 24 aydan
 * kiçikdirsə 0-24 ay göstərilir ki, oxunaqlı qalsın.
 */
import { MAX_AGE_MONTHS, ageInMonths, headCircumferencePercentile, percentile, percentileLabel, type Measure, type Sex } from './whoGrowth';

export interface GrowthEntryLike {
  entry_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  head_cm: number | null;
}

export interface ChildPoint { month: number; value: number; }

/** Qrafik üçün ən kiçik aralıq (ay). */
export const MIN_CHART_MONTHS = 24;

export const GROWTH_MEASURES: readonly Measure[] = ['weight', 'height', 'head'];

/** Ölçü düyməsinin etiketi (tr açarı + az fallback). */
export function measureLabel(measure: Measure): { key: string; fallback: string } {
  if (measure === 'weight') return { key: 'who_weight', fallback: 'Çəki (kq)' };
  if (measure === 'height') return { key: 'who_height', fallback: 'Boy (sm)' };
  return { key: 'growthtz_who_head', fallback: 'Baş çevrəsi (sm)' };
}

export function measureValue(entry: GrowthEntryLike, measure: Measure): number | null {
  const v = measure === 'weight' ? entry.weight_kg : measure === 'height' ? entry.height_cm : entry.head_cm;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Qrafikin son ayı: uşaq 24 aydan kiçikdirsə 24, sonra yaşa qədər (6-nın misli,
 * yuxarı yuvarlaqlaşdırılır), ən çox 60.
 */
export function chartMaxMonth(ageMonths: number): number {
  if (!Number.isFinite(ageMonths) || ageMonths <= MIN_CHART_MONTHS) return MIN_CHART_MONTHS;
  return Math.min(MAX_AGE_MONTHS, Math.ceil(ageMonths / 6) * 6);
}

/** X oxu bölgüləri: 36 aya qədər hər 6 ay, sonra hər 12 ay; son ay həmişə daxildir. */
export function chartTicks(maxMonth: number): number[] {
  const step = maxMonth <= 36 ? 6 : 12;
  const ticks: number[] = [];
  for (let m = 0; m <= maxMonth; m += step) ticks.push(m);
  if (ticks[ticks.length - 1] !== maxMonth) ticks.push(maxMonth);
  return ticks;
}

/** Uşağın ölçüləri aylara (yaş istinad tarixindən, premature üçün EDD) yerləşdirilmiş, artan sırada. */
export function childPoints(entries: GrowthEntryLike[], measure: Measure, ageReferenceDate: string, maxMonth: number): ChildPoint[] {
  const points: ChildPoint[] = [];
  for (const e of entries) {
    const value = measureValue(e, measure);
    if (value === null) continue;
    const m = ageInMonths(ageReferenceDate, e.entry_date);
    if (!Number.isFinite(m) || m < 0 || m > maxMonth) continue;
    points.push({ month: Math.round(m * 10) / 10, value });
  }
  return points.sort((a, b) => a.month - b.month);
}

/** Ölçünün percentili (baş çevrəsi üçün headCircumferencePercentile). */
export function measurePercentile(measure: Measure, sex: Sex, ageMonths: number, value: number): number | null {
  return measure === 'head' ? headCircumferencePercentile(sex, ageMonths, value) : percentile(measure, sex, ageMonths, value);
}

/** Ən son (tarixə görə) dəyəri olan ölçünün percentili; 0-60 ay xaricində null. */
export function latestPercentile(entries: GrowthEntryLike[], measure: Measure, sex: Sex, ageReferenceDate: string): number | null {
  const points = childPoints(entries, measure, ageReferenceDate, MAX_AGE_MONTHS);
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  return measurePercentile(measure, sex, last.month, last.value);
}

export type PercentileTone = 'ok' | 'watch' | 'alert';

/** Percentil çipinin tonu və etiketi (tr açarı + az fallback). */
export function percentileChip(p: number): { tone: PercentileTone; key: string; fallback: string } {
  const { tone } = percentileLabel(p);
  if (tone === 'ok') return { tone, key: 'who_normal', fallback: 'normal' };
  if (tone === 'watch') return { tone, key: 'who_watch', fallback: 'izləyin' };
  return { tone, key: 'who_alert', fallback: 'həkimlə danışın' };
}
