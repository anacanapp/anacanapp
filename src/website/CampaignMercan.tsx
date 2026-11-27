import { useWebsite } from './context';
import ALT from './campaign-mercan-alt.json';
import './campaign-mercan.css';

// Mərcan Cümə banners on the website (same creatives as the in-app banners, scripts/banners/mercan). Every site language
// has its own creative and opens the Mərcan page in that language. Coral design above the home hero, peach design
// above the journal list, light design after each article. Hidden outside the campaign window.
export const MERCAN_STARTS_AT = Date.parse('2026-11-23T00:00:00Z');
export const MERCAN_ENDS_AT = Date.parse('2026-11-30T19:59:59Z');
const DESIGN = { home: 'coral', journal: 'peach', article: 'light' } as const;
type Slot = keyof typeof DESIGN;
const ALT_TEXT = ALT as Record<string, string>;

export function mercanLanguage(language: string): string {
  return ALT_TEXT[language] ? language : 'en';
}
export function mercanActive(now = Date.now()) {
  return now >= MERCAN_STARTS_AT && now < MERCAN_ENDS_AT;
}

function track(slot: string, language: string) {
  try {
    (window as unknown as { anacanAnalytics?: { track: (name: string, params: object) => void } }).anacanAnalytics
      ?.track('select_promotion', { promotion_id: 'premium-mercan-2026', promotion_name: 'Premium Mərcan Cümə', creative_slot: slot, language });
  } catch { /* analytics never blocks navigation */ }
}

export default function CampaignMercanBanner({ slot }: { slot: Slot }) {
  const { route } = useWebsite();
  if (!mercanActive()) return null;
  const lang = mercanLanguage(route.language);
  const design = DESIGN[slot];
  const href = `/website/premium/mercan/index.html?lang=${lang}&utm_source=website&utm_medium=banner&utm_campaign=mercan&utm_content=${slot}`;
  return <a className={`cm-banner cm-${slot}`} href={href} onClick={() => track(slot, route.language)}>
    {/* Wide web creative (1120×160, 2× file) from 720 px up; the app creative (1200×500) on phones. */}
    <picture>
      <source media="(min-width: 720px)" srcSet={`/website/premium/mercan/banners/${design}-${lang}-wide.webp`} width="2240" height="320"/>
      <img src={`/website/premium/mercan/banners/${design}-${lang}.webp`} width="1200" height="500" alt={ALT_TEXT[lang]}
        loading={slot === 'home' ? 'eager' : 'lazy'} decoding="async" lang={lang}/>
    </picture>
  </a>;
}
