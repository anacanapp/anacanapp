import copy from '../../scripts/i18n/brand-ads-copy.json';
import { normalizeAppLanguage, appLanguageLocale } from './app-languages';
export type BrandText = keyof typeof copy.languages.en;
export const brandText = (key: BrandText, language = 'en'): string => {
  const lang = normalizeAppLanguage(language) as keyof typeof copy.languages;
  return copy.languages[lang]?.[key] || copy.languages.en[key];
};
export const BRAND_PLACEMENTS = ['home_top','home_middle','home_bottom','tools_top','tools_bottom','profile_top','community_top','ai_chat_top'] as const;
export const CONNECTED_BANNER_PLACEMENTS = ['home_top','home_bottom','tools_top','tools_bottom','profile_top','community_top'] as const;
export type BrandPlacement = typeof BRAND_PLACEMENTS[number];
export interface AdBrand { id: string; name: string; website: string | null; logo_url: string | null; report_timezone: string; is_active: boolean; created_at: string; admin_preview?: boolean }
export interface BrandAd { id: string; banner_id: string | null; snapshot: Record<string, any>; status: string; assigned_at: string; deleted_at: string | null; legacy_views: number; legacy_clicks: number; impressions: number; clicks: number; ctr: number | null }
export interface BrandReport {
  protocol: string; brand: AdBrand; from: string; to: string; previous_from: string; previous_to: string; timezone: string; refreshed_at: string;
  backend: string; measurement: string; coverage_start: string | null; partial_coverage: boolean; available: boolean; comparison_available: boolean;
  metrics: { impressions: number; clicks: number; ctr: number | null; previous_impressions: number; previous_clicks: number; previous_ctr: number | null; active_ads: number; total_ads: number };
  legacy: { views: number; clicks: number }; daily: { day: string; impressions: number; clicks: number }[];
  placements: { placement: BrandPlacement; impressions: number; clicks: number; ctr: number | null; ads: number }[];
  platforms: { platform: string; impressions: number; clicks: number }[]; ads: BrandAd[]; ads_total: number; export_truncated: boolean;
}
export interface BrandFilters { from: string; to: string; placement: string; search: string; status: string; sort: string; page: number; ad?: string }
export const brandReportArgs = (brand: string, filters: BrandFilters, exporting = false) => ({ p_brand: brand, p_from: filters.from, p_to: filters.to,
  p_placement: filters.placement === 'all' ? null : filters.placement, p_ad: filters.ad || null, p_search: filters.search, p_status: filters.status,
  p_sort: filters.sort, p_limit: 25, p_offset: filters.page * 25, p_export: exporting });
export function brandDateRange(days: number, timezone = 'Asia/Baku', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const to = `${value('year')}-${value('month')}-${value('day')}`;
  const from = new Date(`${to}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to };
}
export const brandNumber = (value: number | null | undefined, language: string, percent = false) => value == null ? '—' :
  new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: percent ? 2 : 0, ...(percent ? { style: 'percent' as const } : {}) }).format(percent ? value / 100 : value);
export function brandError(error: unknown, language: string) {
  const text = String((error as any)?.message || '') + String((error as any)?.code || '');
  const key: BrandText = /PGRST202|42883/.test(text) ? 'unavailable' : /ACCESS_DENIED|ADMIN_REQUIRED|42501/.test(text) ? 'forbidden'
    : /INVALID_FILTER/.test(text) ? 'invalid_dates' : /ACCOUNT_MISSING/.test(text) ? 'account_missing' : /OWNERSHIP_LOCKED/.test(text) ? 'ownership_locked' : 'error';
  return brandText(key, language);
}
export function safeAdUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function adTitle(snapshot: Record<string, any>, language: string) {
  return String(snapshot[`title_${language}`] || snapshot.title || '');
}
/** Spreadsheet-safe cells, including malicious creative titles and brand names. */
export function brandCsv(rows: unknown[][]): string {
  return '\ufeff' + rows.map(row => row.map(value => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
export function brandReportCsv(report: BrandReport, kind: 'ads' | 'placements' | 'daily', language: string) {
  const t = (key: BrandText) => brandText(key, language);
  const prefix = [report.brand.name, report.from, report.to, report.timezone];
  const header = [t('brand'), t('from'), t('to'), t('timezone'), kind === 'ads' ? t('creative') : kind === 'daily' ? t('date') : t('placement'), t('impressions'), t('clicks'), 'CTR (%)'];
  const data = kind === 'ads' ? report.ads.map(ad => [adTitle(ad.snapshot, language), ad.impressions, ad.clicks, ad.ctr])
    : kind === 'placements' ? report.placements.map(row => [t(row.placement), row.impressions, row.clicks, row.ctr])
    : report.daily.map(row => [row.day, row.impressions, row.clicks, row.impressions ? Number((100 * row.clicks / row.impressions).toFixed(2)) : null]);
  return brandCsv([header, ...data.map(row => [...prefix, ...row])]);
}
