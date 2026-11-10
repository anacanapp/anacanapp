import { useWebsite } from './context';
import './campaign-1111.css';

// 11.11 Poz-Aç campaign banners on the website (same creatives as the in-app banners). Each site language shows its
// own creative and opens the matching 11.11 landing (?lang=); languages without their own version get English.
// Banner 3 sits above the home hero, banner 2 above the journal list, banner 1 at the end of each article.
// Only languages in CAMPAIGN_1111_ENABLED are shown (owner 2026-11-10: every language).
export const CAMPAIGN_1111_STARTS_AT = Date.parse('2026-11-10T18:15:00Z');
export const CAMPAIGN_1111_ENDS_AT = Date.parse('2026-11-11T19:59:59Z');
export const CAMPAIGN_1111_ENABLED: ReadonlySet<string> = new Set(['az', 'en', 'tr', 'kk', 'uz']);
type BannerLanguage = 'az' | 'en' | 'tr' | 'kk' | 'uz';
const OWN = new Set<BannerLanguage>(['az', 'tr', 'kk', 'uz']);
const ALT: Record<BannerLanguage, string> = {
  az: 'Anacan Premium 11.11: kartı poz, illik Premium endirimini aç',
  en: 'Anacan Premium 11.11: scratch the card and reveal your yearly Premium discount',
  tr: 'Anacan Premium 11.11: kartı kazı, yıllık Premium indirimini aç',
  kk: 'Anacan Premium 11.11: картаны қыр да, жылдық Premium жеңілдігін аш',
  uz: 'Anacan Premium 11.11: kartani qiring va yillik Premium chegirmasini oching',
};

export function campaign1111Language(language: string): BannerLanguage {
  return OWN.has(language as BannerLanguage) ? language as BannerLanguage : 'en';
}
export function campaign1111Active(language: string, now = Date.now()) {
  return now >= CAMPAIGN_1111_STARTS_AT && now < CAMPAIGN_1111_ENDS_AT && CAMPAIGN_1111_ENABLED.has(campaign1111Language(language));
}

function track(slot: string, language: string) {
  try {
    (window as unknown as { anacanAnalytics?: { track: (name: string, params: object) => void } }).anacanAnalytics
      ?.track('select_promotion', { promotion_id: 'premium-1111-2026', promotion_name: 'Premium 11.11 Poz-Aç', creative_slot: slot, language });
  } catch { /* analytics never blocks navigation */ }
}

export default function Campaign1111Banner({ slot, variant }: { slot: 'home' | 'journal' | 'article'; variant: 1 | 2 | 3 }) {
  const { route } = useWebsite();
  if (!campaign1111Active(route.language)) return null;
  const lang = campaign1111Language(route.language);
  const href = `/website/premium/1111/index.html?lang=${lang}&utm_source=website&utm_medium=banner&utm_campaign=1111&utm_content=${slot}`;
  return <a className={`c1111-banner c1111-${slot}`} href={href} onClick={() => track(slot, route.language)}>
    <img src={`/website/premium/1111/banners/${lang}-${variant}.webp`} width="1200" height="500" alt={ALT[lang]}
      loading={slot === 'home' ? 'eager' : 'lazy'} decoding="async" lang={lang}/>
  </a>;
}
