import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2, Crown } from 'lucide-react';
import PremiumModal from '@/components/PremiumModal';
import { tr } from '@/lib/tr';
import { followupText } from '@/lib/followup-i18n';
import type { BabyInsightApi, InsightSection, SectionStatus } from '@/hooks/useBabyInsight';
export { useBabyInsight } from '@/hooks/useBabyInsight';
export type { BabyInsightApi, BabyInsightChild, BabyInsightStats, InsightSection } from '@/hooks/useBabyInsight';

const STATUS_CONF: Record<SectionStatus, { color: string; bg: string; labelKey: string; labelAz: string }> = {
  normal: { color: 'var(--a-green-ink)', bg: 'rgba(28, 122, 77, 0.12)', labelKey: 'babyai_status_normal', labelAz: 'Normal' },
  low: { color: 'var(--a-yellow-ink)', bg: 'rgba(148, 98, 0, 0.12)', labelKey: 'babyai_status_low', labelAz: 'Az' },
  high: { color: 'var(--a-yellow-ink)', bg: 'rgba(148, 98, 0, 0.12)', labelKey: 'babyai_status_high', labelAz: 'Çox' },
  watch: { color: '#b3261e', bg: 'rgba(179, 38, 30, 0.12)', labelKey: 'babyai_status_watch', labelAz: 'Diqqət' },
};
export default function TrackerAIInsight({ section, api: all }: { section: InsightSection; api: BabyInsightApi }) {
  const api = all[section], data = api.insight, [showModal, setShowModal] = useState(false);
  const meta = data ? STATUS_CONF[data.status] : STATUS_CONF.normal;
  return <div data-ai-insight={section} style={{ marginTop: 10, padding: '9px 11px', borderRadius: 12, background: 'var(--a-surface-soft)', border: '1px solid var(--a-line)' }}>
    {!data && !api.loading && <button type="button" onClick={() => api.limitReached ? setShowModal(true) : api.request()}
      className="flex items-center gap-2 w-full text-start" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      {api.limitReached ? <Crown size={13} style={{ color: '#b8860b', flexShrink: 0 }} /> : <Sparkles size={13} style={{ color: 'var(--a-accent-ink)', flexShrink: 0 }} />}
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-accent-ink)' }}>{api.limitReached ? tr('babyai_limit_cta', 'Gündəlik pulsuz analiz bitdi — Premium ilə limitsiz')
        : api.error ? tr('babyai_error_retry', 'AI analiz alınmadı — yenidən cəhd et') : followupText(`ai_${section}`)}</span>
    </button>}
    {api.loading && !data && <div className="flex items-center gap-2" role="status"><Loader2 size={13} className="animate-spin" />
      <span style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>{tr('babyai_loading', 'AI analiz edir...')}</span></div>}
    {data && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}><Sparkles size={12} />
        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--a-ink-soft)' }}>{tr('babyai_title', 'AI Analiz')}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, color: meta.color, background: meta.bg }}>{tr(meta.labelKey, meta.labelAz)}</span>
        {(api.stale || api.loading || api.error) && <button type="button" onClick={() => api.limitReached ? setShowModal(true) : api.request()} disabled={api.loading}
          aria-label={tr('babyai_refresh', 'Yenilə')} style={{ marginInlineStart: 'auto', padding: 2 }}>
          {api.loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>}
      </div><p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--a-ink)' }}>{data.note}</p>
    </motion.div>}
    <PremiumModal isOpen={showModal} onClose={() => setShowModal(false)} feature="baby_insight" />
  </div>;
}
