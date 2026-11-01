import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useIllnessEpisodes } from '@/hooks/useIllness';
import { useIllnessText } from '@/data/illness';
import { fill } from '@/lib/feature-text';
import { BAND_COLOR, KIND_EMOJI, episodeDay, tempBand } from '@/lib/illness';
import '@/styles/care.css';

/**
 * Home entry to the illness journal. `mode="active"` shows only an open episode (top of the home);
 * `mode="entry"` shows the quiet entry row when nothing is open.
 */
export default function IllnessHomeCard({ mode, onOpen }: { mode: 'active' | 'entry'; onOpen: () => void }) {
  const language = useUserStore((s) => s.language);
  const t = useIllnessText(language);
  const { data: episodes = [], isLoading } = useIllnessEpisodes();
  const active = episodes.find((e) => !e.ended_at) ?? null;
  if (!t || isLoading) return null;
  if (mode === 'active' && !active) return null;
  if (mode === 'entry' && active) return null;

  return (
    <section className="a-section">
      <motion.button type="button" className="cx-card cx-row" whileTap={{ scale: .98 }} onClick={onOpen}
      style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: active ? 'linear-gradient(135deg, var(--a-surface), var(--a-pink-1))' : 'var(--a-surface)' }}>
        <span className="cx-icon" style={{ background: active ? 'var(--a-surface)' : 'var(--a-peach-1)', fontSize: 22 }}>{active ? KIND_EMOJI[active.kind] : '🌡️'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14.5, color: 'var(--a-ink)' }}>
            {active ? fill(t.home_card_active, { kind: t.kinds[active.kind], n: episodeDay(active.started_at) }) : t.home_card_entry}
          </b>
          <span className="cx-sub" style={{ display: 'block' }}>
            {active ? active.child_name || t.title : t.home_card_entry_desc}
          </span>
        </span>
        {active?.last_temp != null &&
        <strong style={{ fontSize: 18, color: BAND_COLOR[tempBand(Number(active.last_temp))] }}>{Number(active.last_temp).toFixed(1)}°</strong>
        }
        <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
      </motion.button>
    </section>);
}
