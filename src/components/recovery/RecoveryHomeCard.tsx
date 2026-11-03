import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useRecoveryText } from '@/data/recovery';
import { fill } from '@/lib/feature-text';
import { HOME_CARD_WEEKS, PROGRAM_WEEKS, weekAfterBirth, type BirthType } from '@/lib/recovery';
import '@/styles/care.css';

/** Mother's recovery card on the mommy home during the first 8 weeks after birth. */
export default function RecoveryHomeCard({ onOpen }: { onOpen: () => void }) {
  const language = useUserStore((s) => s.language);
  const t = useRecoveryText(language);
  const { profile } = useAuth();
  const p = profile as { baby_birth_date?: string | null; birth_type?: BirthType | null } | null;
  const week = weekAfterBirth(p?.baby_birth_date);
  if (!t || week == null || week > HOME_CARD_WEEKS) return null;
  const type = p?.birth_type ?? 'vaginal';
  const content = t.weeks[type][Math.min(PROGRAM_WEEKS, week) - 1];
  return (
    <section className="a-section">
      <motion.button type="button" className="cx-card" whileTap={{ scale: .98 }} onClick={onOpen}
      style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'linear-gradient(135deg, var(--a-surface), var(--a-lav-1))' }}>
        <div className="cx-row">
          <span className="cx-icon" style={{ background: 'var(--a-surface)' }}>🌸</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="cx-eyebrow" style={{ display: 'block' }}>{t.title}</span>
            <b style={{ display: 'block', fontSize: 15, color: 'var(--a-ink)' }}>{week > PROGRAM_WEEKS ? t.after_title : fill(t.week_title, { n: week })}</b>
            <span className="cx-sub" style={{ display: 'block' }}>{fill(t.home_card_desc, { focus: week > PROGRAM_WEEKS ? t.kegel_title : content.title })}</span>
          </span>
          <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
        </div>
        <div className="cx-weeks" style={{ marginTop: 12 }} aria-hidden>
          {Array.from({ length: PROGRAM_WEEKS }, (_, i) => <i key={i} className={i + 1 < week ? 'on' : i + 1 === week ? 'now' : ''} />)}
        </div>
      </motion.button>
    </section>);
}
