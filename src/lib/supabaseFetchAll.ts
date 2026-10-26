/**
 * Supabase/PostgREST-in defolt "db-max-rows" (1000) həddini aşaraq BÜTÜN
 * sətirləri gətirmək üçün paylaşılan köməkçi.
 *
 * VACİB: `.limit(N)` N > 1000 olsa BELƏ server-tərəfi YENƏ 1000-də kəsir —
 * client-in istədiyi limit-dən TAM ASILI OLMAYARAQ (bu, PostgREST-in özünün
 * sənədləşdirdiyi davranışdır). YEGANƏ etibarlı yol `.range()` ilə
 * səhifə-səhifə "loop" edib nəticələri client tərəfində birləşdirməkdir.
 *
 * Bu funksiya yazılmazdan ƏVVƏL bu EYNİ ~15 sətirlik loop 7 dəfə müxtəlif
 * fayllarda əl ilə köçürülmüşdü (i18n.ts, useBabyDailyInfo.ts,
 * useMommyDailyMessages.ts, useMommyDayNotifications.ts, AdminTranslations.tsx)
 * — bu, TƏK, paylaşılan versiyadır, həm YENİ, həm KÖHNƏ (indi düzəldilməli
 * olan) sorğular üçün.
 *
 * İstifadə:
 *   const rows = await fetchAllRows<ProfileRow>((from, to) =>
 *     supabase.from('profiles').select('user_id, name').order('created_at').range(from, to)
 *   );
 */
export async function fetchAllRows<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  /**
   * İxtiyari üst hədd — çox böyük cədvəllər üçün (məs. analytics_events, hər
   * istifadəçi-hərəkəti üçün bir sətir, milyonlara çata bilər) sonsuz sayda
   * səhifə çəkməkdənsə, məqbul bir "kifayət qədər böyük nümunə" ilə dayanır.
   * Verilməzsə, HƏQİQƏTƏN bütün sətirlər gətirilir (kiçik/orta cədvəllər üçün
   * normaldır — profiles, subscriptions və s.).
   */
  maxRows?: number
): Promise<T[]> {
  let allRows: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await queryFn(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    if (maxRows && allRows.length >= maxRows) {
      allRows = allRows.slice(0, maxRows);
      break;
    }
    if (data.length < pageSize) break; // son səhifə (tam dolu deyil)
    from += pageSize;
  }

  return allRows;
}
