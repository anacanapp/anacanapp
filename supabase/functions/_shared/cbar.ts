// Central Bank of Azerbaijan (cbar.az) daily USD → AZN rate for the in-app Epoint Premium prices (USD set by the admin,
// charged in AZN). The rate is cached in app_settings.fx_usd_azn through web_premium_fx_store_v1: fetched at most once
// per Baku day, attempts at most hourly; on any failure the last cached rate stays in use, then the admin fallback rate
// (web_premium_usd_azn_rate_v1 decides). Fetching never blocks a checkout for longer than the timeout.

/** Baku calendar date (UTC+4, no DST) as YYYY-MM-DD. */
export function bakuDate(now = Date.now()): string {
  return new Date(now + 4 * 3600_000).toISOString().slice(0, 10);
}

/** https://www.cbar.az/currencies/DD.MM.YYYY.xml for a YYYY-MM-DD date. */
export function cbarUrl(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `https://www.cbar.az/currencies/${d}.${m}.${y}.xml`;
}

/** USD value (AZN per 1 USD, divided by Nominal) from the CBAR XML; null when absent or implausible. */
export function parseCbarUsd(xml: string): number | null {
  if (typeof xml !== 'string' || xml.length > 200_000) return null;
  const block = /<Valute\b[^>]*\bCode\s*=\s*"USD"[^>]*>([\s\S]*?)<\/Valute>/i.exec(xml)?.[1];
  if (!block) return null;
  const value = Number((/<Value>\s*([0-9]+(?:[.,][0-9]+)?)\s*<\/Value>/i.exec(block)?.[1] ?? '').replace(',', '.'));
  const nominal = Number(/<Nominal>\s*([0-9]+)\s*<\/Nominal>/i.exec(block)?.[1] ?? '1') || 1;
  const rate = value / nominal;
  return Number.isFinite(rate) && rate >= 0.5 && rate <= 5 ? Math.round(rate * 10_000) / 10_000 : null;
}

interface FxCache { rate?: unknown; date?: unknown; last_attempt_at?: unknown }

/** Whether the cached rate should be refreshed now: not today's, and no attempt in the last hour. */
export function fxRefreshDue(cache: FxCache | null, now = Date.now()): boolean {
  if (cache && cache.date === bakuDate(now) && Number(cache.rate) > 0) return false;
  const attempted = typeof cache?.last_attempt_at === 'string' ? Date.parse(cache.last_attempt_at) : NaN;
  return !(Number.isFinite(attempted) && now - attempted < 3600_000);
}

function readObject(value: unknown): FxCache | null {
  let v = value;
  for (let i = 0; i < 2 && typeof v === 'string'; i++) { try { v = JSON.parse(v); } catch { return null; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as FxCache : null;
}

interface SettingsClient {
  from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { value?: unknown } | null }> } } };
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
}

/** Refreshes app_settings.fx_usd_azn from cbar.az when due. Never throws. */
export async function ensureUsdAznRate(admin: SettingsClient, fetcher: typeof fetch = fetch, now = Date.now()): Promise<void> {
  try {
    const { data } = await admin.from('app_settings').select('value').eq('key', 'fx_usd_azn').maybeSingle();
    if (!fxRefreshDue(readObject(data?.value), now)) return;
    const date = bakuDate(now);
    let rate: number | null = null;
    try {
      const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5_000) : undefined;
      const response = await fetcher(cbarUrl(date), { redirect: 'follow', signal,
        headers: { 'User-Agent': 'Anacan/1.0 (+https://anacan.az)', Accept: 'application/xml,text/xml' } });
      if (response.ok) rate = parseCbarUsd(await response.text());
    } catch { /* unreachable: keep the cached / fallback rate */ }
    const { error } = await admin.rpc('web_premium_fx_store_v1', { p_rate: rate, p_date: rate ? date : null });
    if (error) console.error('[cbar] rate store failed');
    if (!rate) console.error('[cbar] USD rate unavailable; using the cached or fallback rate');
  } catch {
    console.error('[cbar] rate refresh failed');
  }
}
