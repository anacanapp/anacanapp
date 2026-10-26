import { tr } from "@/lib/tr";import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lock } from 'lucide-react';
import { useFlowDailyLogs, useFlowSymptoms } from '@/hooks/useFlowDailyLogs';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useSubscription } from '@/hooks/useSubscription';
import { getCycleDayForDate, getPhaseInfoForDate } from '@/lib/cycle-utils';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';

interface Props {
  onUpgrade?: () => void;
}

const PHASE_LABEL: Record<string, {label: string;emoji: string;}> = {
  menstrual: { label: tr("symptompatternreport_menstruasiya_1c9b68", 'Menstruasiya'), emoji: '🩸' },
  follicular: { label: tr("symptompatternreport_follikular_f123bc", 'Follikular'), emoji: '🌱' },
  ovulation: { label: tr("symptompatternreport_ovulyasiya_f123bc", 'Ovulyasiya'), emoji: '🌸' },
  luteal: { label: tr("symptompatternreport_lutein_f123bc", 'Lutein'), emoji: '🌙' }
};

const SymptomPatternReport = ({ onUpgrade }: Props) => {
  const { isPremium } = useSubscription();
  const { lastPeriodDate, cycleLength, periodLength } = useUserStore(
    useShallow((s) => ({ lastPeriodDate: s.lastPeriodDate, cycleLength: s.cycleLength, periodLength: s.periodLength }))
  );
  const start = format(subDays(new Date(), 90), 'yyyy-MM-dd');
  const end = format(new Date(), 'yyyy-MM-dd');
  const { data: logs = [], isLoading } = useFlowDailyLogs(start, end);
  const { data: symptomsList = [] } = useFlowSymptoms();

  const patterns = useMemo(() => {
    if (!lastPeriodDate || logs.length === 0) return [];
    const lpd = new Date(lastPeriodDate);
    const counts: Record<string, {phase: Record<string, number>;total: number;}> = {};

    logs.forEach((log) => {
      if (!log.symptoms || log.symptoms.length === 0) return;
      const date = new Date(log.log_date);
      const phaseInfo = getPhaseInfoForDate(date, lpd, cycleLength || 28, periodLength || 5);
      log.symptoms.forEach((sym) => {
        if (!counts[sym]) counts[sym] = { phase: {}, total: 0 };
        counts[sym].phase[phaseInfo.phase] = (counts[sym].phase[phaseInfo.phase] || 0) + 1;
        counts[sym].total += 1;
      });
    });

    return Object.entries(counts).
    map(([sym, data]) => {
      const dominantPhase = Object.entries(data.phase).sort((a, b) => b[1] - a[1])[0];
      const symInfo = symptomsList.find((s) => s.symptom_key === sym);
      return {
        symptom: sym,
        label: symInfo?.label || sym,
        emoji: symInfo?.emoji || '•',
        dominantPhase: dominantPhase?.[0] || 'unknown',
        dominantCount: dominantPhase?.[1] || 0,
        total: data.total,
        percentage: dominantPhase ? Math.round(dominantPhase[1] / data.total * 100) : 0
      };
    }).
    sort((a, b) => b.total - a.total).
    slice(0, 5);
  }, [logs, lastPeriodDate, cycleLength, periodLength, symptomsList]);

  if (!isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-cta a-fade-in">
        
        <div className="a-cta-top">
          <span className="a-cta-badge">
            <Sparkles size={12} strokeWidth={2.2} /> {tr("symptompatternreport_title_e8cbea", "Simptom Pattern Analizi")}
          </span>
          <span className="a-cta-deco">
            <Lock size={16} strokeWidth={2} />
          </span>
        </div>
        <p className="a-cta-text" style={{ margin: '14px 0 14px' }}>
          {tr("symptompatternreport_simptomlarinizin_tsikl_merhele_e8cc92", "Simptomlar\u0131n\u0131z\u0131n tsikl m\u0259rh\u0259l\u0259l\u0259ri \xFCzr\u0259 paylanmas\u0131n\u0131 g\xF6r\xFCn. Hans\u0131 simptomun hans\u0131 fazada ba\u015F verdiyini AI il\u0259 k\u0259\u015Ff edin.")}
        </p>
        <button onClick={onUpgrade} className="a-cta-btn">
          {tr("symptompatternreport_premium_a_kec_9dadb6", "Premium-a ke\xE7")}
        </button>
      </motion.div>);

  }

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '50%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 48, borderRadius: 14, background: 'var(--a-surface-soft)' }} />
          <div style={{ height: 48, borderRadius: 14, background: 'var(--a-surface-soft)' }} />
        </div>
      </div>);

  }

  if (patterns.length === 0) {
    return (
      <div className="a-card">
        <div className="a-card-head" style={{ marginBottom: 8 }}>
          <h3 className="a-card-title a-heading">{tr("symptompatternreport_title_e8cbea", "Simptom Pattern Analizi")}</h3>
        </div>
        <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
          {tr("symptompatternreport_hele_kifayet_qeder_data_yoxdur_8ad930", "H\u0259l\u0259 kifay\u0259t q\u0259d\u0259r data yoxdur. G\xFCnd\u0259lik simptomlar\u0131n\u0131z\u0131 qeyd edin v\u0259 1-2 tsikld\u0259n sonra burada paylanma g\xF6r\u0259c\u0259ksiniz.")}
        </p>
      </div>);

  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in">
      
      <div className="a-card-head" style={{ marginBottom: 8 }}>
        <h3 className="a-card-title a-heading">{tr("symptompatternreport_title_e8cbea", "Simptom Pattern Analizi")}</h3>
        <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>{tr("flowmoodchart_son_90_gun", "Son 90 gün")}</span>
      </div>
      <p className="a-list-sub" style={{ margin: '0 0 6px', whiteSpace: 'normal' }}>{tr("symptompatternreport_son_90_gun_uzre_top_5_simptom__c1b6a8", "Son 90 g\xFCn \xFCzr\u0259 top 5 simptom v\u0259 dominant faza:")}</p>

      <div>
        {patterns.map((p) => {
          const phase = PHASE_LABEL[p.dominantPhase] || { label: p.dominantPhase, emoji: '•' };
          return (
            <div key={p.symptom} className="a-list-row" style={{ display: 'block', paddingInlineStart: 0, paddingInlineEnd: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 17 }}>
                  {p.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="a-list-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</p>
                  <p className="a-list-sub">
                    {p.total} {tr("symptompatternreport_defe_05c318", "d\u0259f\u0259 \u2022")} {p.percentage}% {phase.emoji} {phase.label}
                  </p>
                </div>
                <span className="a-list-value">{p.percentage}%</span>
              </div>
              <div className="a-inline-bar" style={{ marginInlineStart: 53 }}>
                <div className="a-inline-bar-fill" style={{ width: `${p.percentage}%` }} />
              </div>
            </div>);

        })}
      </div>
    </motion.div>);

};

export default SymptomPatternReport;