import './premium-strip.css';

// Weekend Premium campaign strip above the home hero (Azerbaijani site only), same offer as the in-app banner.
// It disappears by itself when the campaign ends; the campaign page itself stays reachable.
export const PREMIUM_STRIP_ENDS_AT = Date.parse('2026-11-08T19:59:59Z');
export const PREMIUM_STRIP_URL = '/website/premium/kampaniya/index.html';

export function premiumStripActive(now = Date.now()) { return now < PREMIUM_STRIP_ENDS_AT; }

function track() {
  try {
    (window as unknown as { anacanAnalytics?: { track: (name: string, params: object) => void } }).anacanAnalytics
      ?.track('select_promotion', { promotion_id: 'premium-weekend-2026-11', promotion_name: 'Premium həftəsonu endirimi', creative_slot: 'home_top_strip' });
  } catch { /* analytics never blocks navigation */ }
}

export default function PremiumStrip() {
  if (!premiumStripActive()) return null;
  return <a className="ps-strip" href={PREMIUM_STRIP_URL} onClick={track} aria-label="Premium həftəsonu endirimi: illik 24,99 ₼, aylıq 4,99 ₼. Endirimi al">
    <span className="ps-badge">Həftəsonu endirimi</span>
    <span className="ps-text">
      <strong>Premium</strong>
      <span className="ps-plan"><span className="ps-brand">Premium · </span>İllik <s>50,98 ₼</s> <b>24,99 ₼</b> <em>−51%</em></span>
      <span className="ps-dot" aria-hidden="true">·</span>
      <span className="ps-plan">Aylıq <s>6,78 ₼</s> <b>4,99 ₼</b></span>
    </span>
    <span className="ps-cta">Endirimi al <span aria-hidden="true">→</span></span>
  </a>;
}
