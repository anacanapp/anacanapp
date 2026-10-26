import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useCurrentBabyCrisis, useUpcomingBabyCrises } from '@/hooks/useBabyCrisisPeriods';
import { tr } from '@/lib/tr';

/**
 * Mommy: Kriz dövrü kartı — partnyor körpənin "wonder week" dövrünü bilir
 * və ananı necə dəstəkləyəcəyini öyrənir.
 * Mənbə: baby_crisis_periods (admin content, public oxunur).
 */

interface Props {
  babyAgeWeeks: number;
  babyName: string;
}

// FUNKSIYA: tr() render anında (modul-load AZ bake tələsinə qarşı)
const SEVERITY_META = (): Record<string, {bg: string;ink: string;label: string;}> => ({
  mild: { bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)', label: tr('babycrisiswidget_yungul_2a8010', 'Yüngül') },
  medium: { bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)', label: tr('babycrisiswidget_medium', 'Orta') },
  intense: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', label: tr('babycrisiswidget_i_ntensiv_45a63b', 'İntensiv') }
});

const PartnerBabyCrisisCard = ({ babyAgeWeeks, babyName }: Props) => {
  const currentCrises = useCurrentBabyCrisis(babyAgeWeeks);
  const upcomingCrises = useUpcomingBabyCrises(babyAgeWeeks, 1);
  const [expanded, setExpanded] = useState(false);

  const current = currentCrises[0];
  const upcoming = upcomingCrises[0];

  if (!current && !upcoming) return null;

  // ── Aktiv kriz ──
  if (current) {
    const sevMap = SEVERITY_META();
  const sev = sevMap[current.severity] || sevMap.mild;
    const tips = (current.tips || []).slice(0, expanded ? 4 : 1);
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-card"
        style={{ border: '1.5px solid var(--a-pink-2)' }}>

        <div className="flex items-center gap-3 mb-2.5">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: 2 }}
            className="w-11 h-11 flex items-center justify-center text-2xl shrink-0"
            style={{ borderRadius: 14, background: 'var(--a-pink-1)' }}>
            {current.emoji || '⚡'}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate" style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>
                {tr('partnerv2_kriz_dovru', 'Kriz dövrü')}: {current.title}
              </h3>
            </div>
            <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>
              {current.week_start}–{current.week_end}. {tr('partnerv2_hefte_short', 'həftə')}
              {current.leap_number ? ` · Leap ${current.leap_number}` : ''}
            </p>
          </div>
          <span className="shrink-0" style={{ background: sev.bg, color: sev.ink, borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>
            {sev.label}
          </span>
        </div>

        {current.description &&
        <p className="leading-relaxed mb-2.5" style={{ fontSize: 12, color: 'var(--a-body-text)' }}>
            {current.description}
          </p>
        }

        {/* Partnyora xüsusi mesaj */}
        <div className="flex items-start gap-2 mb-2.5" style={{ background: 'var(--a-pink-1)', borderRadius: 13, padding: '10px 12px' }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--a-pink-ink)' }} />
          <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-alert-ink)', lineHeight: 1.45 }}>
            {tr('partnerv2_kriz_partner_mesaj', '{baby} bu dövrdə daha narahat ola bilər — ana da yorulur. Gecə növbəsi və səbir sənin növbəndir. 💪').replace('{baby}', babyName)}
          </p>
        </div>

        {/* Tövsiyələr */}
        {tips.length > 0 &&
        <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {tips.map((tip, i) =>
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2">
                  <Lightbulb size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--a-yellow-ink)' }} />
                  <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', lineHeight: 1.45 }}>{tip}</p>
                </motion.div>
            )}
            </AnimatePresence>
            {(current.tips || []).length > 1 &&
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-1"
            style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
                {expanded ?
            <>{tr('partnerv2_yigcam_gorunus', 'Yığcam görünüş')} <ChevronUp size={13} /></> :
            <>{tr('partnerv2_butun_tovsiyeler', 'Bütün tövsiyələr')} <ChevronDown size={13} /></>}
              </button>
          }
          </div>
        }
      </motion.div>);
  }

  // ── Yaxınlaşan kriz ──
  const weeksLeft = upcoming.week_start - babyAgeWeeks;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3"
      style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', padding: 15, boxShadow: 'var(--a-card-shadow)' }}>

      <div className="w-11 h-11 flex items-center justify-center text-2xl shrink-0" style={{ borderRadius: 14, background: 'var(--a-yellow-1)' }}>
        {upcoming.emoji || '📅'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>
          {tr('partnerv2_novbeti_kriz', 'Növbəti kriz dövrü')}: {upcoming.title}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>
          {upcoming.week_start}. {tr('partnerv2_hefte_short', 'həftə')} · {weeksLeft} {tr('partnerv2_hefte_sonra', 'həftə sonra')} — {tr('partnerv2_hazir_ol', 'hazır ol')} 😉
        </p>
      </div>
      <CalendarClock size={17} className="shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
    </motion.div>);

};

export default PartnerBabyCrisisCard;
