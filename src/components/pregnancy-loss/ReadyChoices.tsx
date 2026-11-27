import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { endPregnancyLossRecovery } from '@/lib/pregnancy-loss';
import type { PregnancyLossText } from '@/data/pregnancy-loss';

/**
 * "Hazır olanda": the mother's own choice to leave the recovery mode. Nothing is offered by the app on its
 * own; each choice asks once more before it changes anything.
 */
type Choice = 'cycle' | 'pregnant' | 'stay';

const ReadyChoices = ({ text, onNavigate }: { text: PregnancyLossText; onNavigate?: (screen: string) => void }) => {
  const t = text.ui;
  const { refreshProfile } = useAuth();
  const [asking, setAsking] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const rows: [Choice, string, string, string, string][] = [
    ['cycle', '🌸', 'var(--a-pink-1)', t.ready_cycle, t.ready_cycle_sub],
    ['pregnant', '🤰', 'var(--a-peach-1)', t.ready_pregnant, t.ready_pregnant_sub],
    ['stay', '🌿', 'var(--loss-soft)', t.ready_stay, t.ready_stay_sub],
  ];

  const confirm = async () => {
    if (!asking || asking === 'stay' || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await endPregnancyLossRecovery(asking === 'cycle');
      await refreshProfile();
      const next = asking;
      setAsking(null);
      onNavigate?.(next === 'pregnant' ? 'edit-profile' : 'home');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="loss-card" aria-labelledby="loss-ready-title">
      <h3 id="loss-ready-title" style={{ fontSize: 15, fontWeight: 900, color: 'var(--a-ink)' }}>{t.ready_title}</h3>
      <p className="loss-row-sub" style={{ marginBottom: 6 }}>{t.ready_sub}</p>
      {rows.map(([id, icon, tint, title, sub]) => (
        <div key={id}>
          <button type="button" className="loss-row" aria-expanded={asking === id} onClick={() => setAsking(id === 'stay' ? null : asking === id ? null : id)}>
            <span className="loss-row-icon" style={{ background: tint }} aria-hidden>{icon}</span>
            <span className="flex-1 min-w-0">
              <span className="loss-row-title block">{title}</span>
              <span className="loss-row-sub block">{sub}</span>
            </span>
            <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
          </button>
          <AnimatePresence>
            {asking === id && id !== 'stay' &&
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ background: 'var(--loss-soft)', borderRadius: 16, padding: 12, margin: '4px 0 8px' }}>
                  <p className="loss-body" style={{ fontSize: 13 }}>{id === 'cycle' ? t.ready_confirm_cycle : t.ready_confirm_pregnant}</p>
                  {failed && <p role="alert" style={{ fontSize: 12, color: 'var(--a-alert-ink)', marginTop: 6 }}>{t.sheet_error}</p>}
                  <div className="flex gap-2" style={{ marginTop: 10 }}>
                    <button type="button" className="loss-cta flex items-center justify-center gap-2" style={{ padding: 11, fontSize: 13.5 }} disabled={saving} onClick={confirm}>
                      {saving && <Loader2 size={14} className="animate-spin" />}{t.ready_yes}
                    </button>
                    <button type="button" className="loss-ghost" style={{ padding: 11, fontSize: 13.5, background: 'var(--a-surface)' }} disabled={saving} onClick={() => setAsking(null)}>{t.ready_no}</button>
                  </div>
                </div>
              </motion.div>}
          </AnimatePresence>
        </div>
      ))}
    </section>
  );
};

export default ReadyChoices;
