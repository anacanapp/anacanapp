// PostgREST hər sorğuda maksimum 1000 sətir qaytarır. Cron funksiyaları
// profiles/device_tokens/user_preferences cədvəllərini limitsiz oxuduğunu
// zənn edirdi — nəticədə istifadəçilərin böyük hissəsi "no_device_token"
// kimi atlanırdı və pushlar getmirdi. Bu köməkçi bütün səhifələri yığır.
// deno-lint-ignore-file no-explicit-any
export async function fetchAllPaged<T>(
  makeQuery: () => any,
  pageSize = 1000,
  maxPages = 100,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) {
      console.error('[fetchAllPaged] error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
