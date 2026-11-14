import { GOOGLE_PLAY_URL } from './routes';

/**
 * Store links with install attribution (owner request 2026-11-14).
 * - App Store: campaign link `?pt=<provider>&ct=<campaign>&mt=8`, read in App Store Connect → Analytics → Acquisition → Campaigns.
 *   `ct` only counts when `pt` (the App Store Connect provider ID) is set.
 * - Google Play: `referrer=utm_source=anacan.az&utm_medium=website&utm_campaign=<campaign>&utm_content=<language>`, read in
 *   Play Console → Statistics / Store listing acquisition, and by Firebase Analytics (first_open campaign) in the app.
 * - Every click also sends the GA4 event `store_click` {store, link_campaign, placement, page_type, language}.
 * The campaign name says where the link was: `web_<placement>`, e.g. web_download_page_from_article, web_tool_ovulation.
 */
export const APPLE_PROVIDER_TOKEN = '';
export const APP_STORE_CAMPAIGN_URL = 'https://apps.apple.com/app/anacan/id6758301924';
export type StorePlatform = 'ios' | 'android';

export function storeCampaign(placement: string): string {
  const slug = placement.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
  return `web_${slug}`.slice(0, 80);
}

export function storeUrl(store: StorePlatform, placement: string, language: string): string {
  const campaign = storeCampaign(placement);
  if (store === 'ios') {
    const params = new URLSearchParams();
    if (APPLE_PROVIDER_TOKEN) params.set('pt', APPLE_PROVIDER_TOKEN);
    params.set('ct', campaign);
    params.set('mt', '8');
    return `${APP_STORE_CAMPAIGN_URL}?${params.toString()}`;
  }
  const referrer = new URLSearchParams({ utm_source: 'anacan.az', utm_medium: 'website', utm_campaign: campaign, utm_content: language });
  return `${GOOGLE_PLAY_URL}&referrer=${encodeURIComponent(referrer.toString())}`;
}

export function trackStoreClick(store: StorePlatform, placement: string, pageType: string, language: string, url: string): void {
  try {
    (window as unknown as { anacanAnalytics?: { track: (name: string, params: Record<string, string>) => void } }).anacanAnalytics
      ?.track('store_click', { store, link_campaign: storeCampaign(placement), placement, page_type: pageType, language, link_url: url });
  } catch { /* analytics never blocks navigation */ }
}

/** Where a visitor came from before opening the download page (set by the download card / tool buttons). */
const FROM_KEY = 'anacan_download_from';
export function rememberDownloadSource(source: string): void {
  try { sessionStorage.setItem(FROM_KEY, source); } catch { /* storage unavailable */ }
}
export function downloadSource(): string | null {
  try { return sessionStorage.getItem(FROM_KEY); } catch { return null; }
}
