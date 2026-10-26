// ============================================================
// pregnancyWeightGain.ts — IOM (Institute of Medicine, 2009) hamiləlik
// çəki-artım anker nöqtələri + xətti interpolyasiya.
//
// WeightTracker.tsx-dən çıxarılıb (əvvəllər komponentin içində, test edilə
// bilməyən yerli funksiya idi) ki, saf məntiq React-dan asılı olmadan test
// oluna bilsin — bu, tibbi məsləhət (çəki artımı Az/Normal/Çox statusu)
// hesablayan kritik məntiqdir.
//
// Əkiz/çoxdöllü ankeri (MULTIPLE_GAIN_ANCHORS) 37-ci həftəni son nöqtə kimi
// istifadə edir (40 yox) — əkiz hamiləlikdə "tam vaxtında" həddi daha erkəndir
// (bax Duzelis29/32 ACOG mənbəli məzmun). Bunu səhv salmaq əkiz anaya real
// artımla belə səhv "çox artırırsınız" xəbərdarlığı verə bilər.
// ============================================================

/** [həftə, min_kq, max_kq] üçlükləri — kumulyativ çəki artımı */
export type WeightGainAnchor = [number, number, number];

export const SINGLE_GAIN_ANCHORS: WeightGainAnchor[] = [[0, 0, 0], [13, 0.5, 2], [26, 4, 8], [40, 8, 14]];
export const MULTIPLE_GAIN_ANCHORS: WeightGainAnchor[] = [[0, 0, 0], [13, 0.5, 2], [26, 6, 10], [37, 16.8, 24.5]];

/**
 * Verilmiş həftə üçün [min, max] kumulyativ çəki artımını (kq) xətti
 * interpolyasiya ilə hesablayır. Son ankerdən sonrakı həftələr üçün son
 * ankerin dəyərində sabit qalır (ekstrapolyasiya etmir).
 */
export function interpolateGain(week: number, anchors: WeightGainAnchor[]): [number, number] {
  const lastWeek = anchors[anchors.length - 1][0];
  const last = anchors[anchors.length - 1];
  if (week <= 0) return [0, 0];
  if (week >= lastWeek) return [last[1], last[2]];
  for (let i = 1; i < anchors.length; i++) {
    if (week <= anchors[i][0]) {
      const [w0, min0, max0] = anchors[i - 1];
      const [w1, min1, max1] = anchors[i];
      const t = (week - w0) / (w1 - w0);
      return [min0 + t * (min1 - min0), max0 + t * (max1 - max0)];
    }
  }
  return [last[1], last[2]];
}
