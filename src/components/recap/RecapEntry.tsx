import { Sparkles } from 'lucide-react';
import { useRecap, RECAP_YEAR } from '@/hooks/useRecap';
import { fillRecap } from '@/lib/recap/copy';
import { rt } from '@/lib/recap/recap-i18n';

/** Dashboard: "Your 2026 is ready ✨" — only while anacan_recap_v1 says available (admins now, everyone from 10 Dec). */
export function RecapHomeCard({ onOpen }: { onOpen?: () => void }) {
  const { recap } = useRecap(RECAP_YEAR);
  if (!recap || !onOpen) return null;
  // Brand name: never localized.
  const kicker = ['ANACAN RECAP', recap.year].join(' ');
  return (
    <section className="a-section" data-testid="recap-home-card">
      <button type="button" onClick={onOpen}
        style={{ width: '100%', border: 0, cursor: 'pointer', textAlign: 'start', borderRadius: 22, padding: '18px 18px 16px', color: '#fff', position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(120% 140% at 100% 0%, #FFC977 0%, rgba(255,201,119,0) 45%), linear-gradient(135deg, #3A0F23 0%, #B92B4B 55%, #FF5A5F 100%)', boxShadow: '0 10px 28px rgba(185,43,75,0.28)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.9 }}>
          <Sparkles size={14} />{kicker}
        </span>
        <b style={{ display: 'block', fontSize: 21, lineHeight: 1.2, marginTop: 8 }}>{fillRecap(rt('recap_home_title'), { year: recap.year })}</b>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4, marginTop: 4, opacity: 0.9 }}>{rt('recap_home_text')}</span>
        <span style={{ display: 'inline-flex', marginTop: 12, background: '#fff', color: '#E63E4B', fontWeight: 900, fontSize: 14, borderRadius: 999, padding: '8px 18px' }}>{rt('recap_home_cta')}</span>
        <span aria-hidden style={{ position: 'absolute', insetInlineEnd: 14, bottom: 6, fontSize: 64, fontWeight: 900, opacity: 0.14, lineHeight: 1 }}>{String(recap.year)}</span>
      </button>
    </section>
  );
}

/** Profile row data (null when the recap is not available for this person). */
export function useRecapProfileRow(): { id: 'recap'; label: string; sub: string } | null {
  const { recap } = useRecap(RECAP_YEAR);
  return recap ? { id: 'recap', label: ['Anacan Recap', recap.year].join(' '), sub: rt('recap_profile_sub') } : null;
}
