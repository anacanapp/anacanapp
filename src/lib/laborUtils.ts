// ============================================================
// laborUtils.ts — Doğuş/kontraksiya ilə bağlı saf (React-dan asılı olmayan)
// hesablama məntiqi. useContractions.ts-dən çıxarılıb ki, "get to the
// hospital now" siqnalı verən kritik qayda unit-test edilə bilsin.
// ============================================================

/**
 * 5-1-1 Qaydası (ABŞ-da geniş istifadə olunan doğuş göstəricisi):
 * kontraksiyalar bir-birindən ~5 dəqiqə (300 saniyə) aralı, hər biri
 * ~1 dəqiqə (60 saniyə) davam edir, VƏ bu, azı 1 saat ərzində (təxmini
 * olaraq ≥3 ardıcıl qeyd) davam edir → xəstəxanaya getmə vaxtıdır.
 *
 * @param avgIntervalSeconds son qeydlərin orta intervalı (saniyə). 0 və ya
 *   mənfi = interval məlum deyil (məs. yalnız 1 qeyd var) → HƏMİŞƏ false.
 * @param avgDurationSeconds son qeydlərin orta müddəti (saniyə)
 * @param recentCount son qeydlərin sayı (minimum 3 ardıcıl qeyd tələb olunur)
 */
export function is511Rule(
  avgIntervalSeconds: number,
  avgDurationSeconds: number,
  recentCount: number
): boolean {
  return (
    avgIntervalSeconds > 0 &&
    avgIntervalSeconds <= 300 &&
    avgDurationSeconds >= 60 &&
    recentCount >= 3
  );
}
