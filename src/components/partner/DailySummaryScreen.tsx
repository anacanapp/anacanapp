import React from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Droplets,
  Heart,
  Activity,
  RefreshCw } from
'lucide-react';
import { useDailySummary, DailySummary } from '@/hooks/useDailySummary';
import { format, isToday, isYesterday } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { SYMPTOMS } from '@/types/anacan';

interface DailySummaryScreenProps {
  onBack: () => void;
}

const DailySummaryScreen: React.FC<DailySummaryScreenProps> = ({ onBack }) => {
  const { summaries, loading } = useDailySummary();

  const getMoodEmoji = (mood: number | null) => {
    if (!mood) return '❓';
    const emojis = ['😢', '😔', '😐', '🙂', '😊'];
    return emojis[mood - 1] || '❓';
  };

  const getMoodLabel = (mood: number | null) => {
    if (!mood) return tr("partner_qeyd_yox", 'Qeyd yox');
    const labels = [tr("dailysummaryscreen_cox_pis_e041c5", "\xC7ox pis"), tr("common_pis", 'Pis'), tr("common_normal", 'Normal'), tr("dailysummaryscreen_yaxsi_9d8595", "Yax\u015F\u0131"), tr("dailysummaryscreen_ela_720a0e", "\u018Fla")];
    return labels[mood - 1] || tr("partner_qeyd_yox", 'Qeyd yox');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return tr("dailysummaryscreen_bu_gun_786fd4", "Bu g\xFCn");
    if (isYesterday(date)) return tr("dailysummaryscreen_dunen_52b701", "D\xFCn\u0259n");
    return format(date, 'd MMMM', { locale: getCurrentDateLocale() });
  };

  const getSymptomLabel = (symptomId: string) => {
    const symptom = SYMPTOMS.find((s) => s.id === symptomId);
    return symptom ? `${symptom.icon} ${symptom.label}` : symptomId;
  };

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--a-blue-2)' }} />
      </div>);

  }

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("dailysummaryscreen_gundelik_xulase_3d07a5", "Gündəlik Xülasə")}</p>
          </div>
        </header>

        {summaries.length === 0 ?
        <div className="a-card" style={{ textAlign: 'center', padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <Calendar size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>
              {tr("dailysummaryscreen_helelik_xulase_yoxdur_f1d180", "H\u0259l\u0259lik x\xFClas\u0259 yoxdur")}
            </h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr("dailysummaryscreen_partnyorunuz_gundelik_melumatl_0be3a8", "Partnyorunuz g\xFCnd\u0259lik m\u0259lumatlar\u0131n\u0131 qeyd etdikd\u0259 burada x\xFClas\u0259 g\xF6r\u0259c\u0259ksiniz")}
            </p>
          </div> :

        <div className="space-y-3.5">
            {summaries.map((summary, index) =>
          <SummaryCard
            key={summary.id}
            summary={summary}
            formatDate={formatDate}
            getMoodEmoji={getMoodEmoji}
            getMoodLabel={getMoodLabel}
            getSymptomLabel={getSymptomLabel}
            index={index} />

          )}
          </div>
        }
      </div>
    </div>);

};

interface SummaryCardProps {
  summary: DailySummary;
  formatDate: (date: string) => string;
  getMoodEmoji: (mood: number | null) => string;
  getMoodLabel: (mood: number | null) => string;
  getSymptomLabel: (symptomId: string) => string;
  index: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  formatDate,
  getMoodEmoji,
  getMoodLabel,
  getSymptomLabel,
  index
}) => {
  const isRecent = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="overflow-hidden"
      style={{
        background: 'var(--a-surface)',
        borderRadius: 'var(--a-radius-md)',
        boxShadow: 'var(--a-card-shadow)',
        border: isRecent ? '1.5px solid var(--a-blue-2)' : '1.5px solid transparent'
      }}>

      {/* Date header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--a-line)' }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--a-ink)' }}>{formatDate(summary.summary_date)}</span>
          {isRecent &&
          <span style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '3px 10px', fontSize: 10.5, fontWeight: 800 }}>
              {tr("dailysummaryscreen_en_son_473654", "\u018Fn son")}
            </span>
          }
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Mood */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-2xl shrink-0"
          style={{
            borderRadius: 14,
            background: summary.mood && summary.mood >= 4 ?
            'var(--a-green-1)' :
            summary.mood && summary.mood <= 2 ?
            'var(--a-pink-1)' :
            'var(--a-surface-soft)'
          }}>
            {getMoodEmoji(summary.mood)}
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>{tr("dailysummaryscreen_ehval_0457f9", "Əhval")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--a-ink)' }}>{getMoodLabel(summary.mood)}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="text-center" style={{ background: 'var(--a-blue-1)', borderRadius: 14, padding: 12 }}>
            <Droplets size={18} className="mx-auto mb-1" style={{ color: 'var(--a-blue-ink)' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--a-blue-ink)' }}>
              {summary.water_intake}ml
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--a-blue-ink)' }}>{tr("untranslated_su_yvcozn", "Su")}</div>
          </div>

          <div className="text-center" style={{ background: 'var(--a-pink-1)', borderRadius: 14, padding: 12 }}>
            <Heart size={18} className="mx-auto mb-1" style={{ color: 'var(--a-pink-ink)' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--a-alert-ink)' }}>
              {summary.kick_count}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--a-pink-ink)' }}>{tr("dailysummaryscreen_tepik_9a873a", "Təpik")}</div>
          </div>

          <div className="text-center" style={{ background: 'var(--a-lav-1)', borderRadius: 14, padding: 12 }}>
            <Activity size={18} className="mx-auto mb-1" style={{ color: 'var(--a-lav-ink)' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--a-lav-ink)' }}>
              {summary.contraction_count}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--a-lav-ink)' }}>{tr("dailysummaryscreen_sanci_350c2d", "Sancı")}</div>
          </div>
        </div>

        {/* Symptoms */}
        {summary.symptoms && summary.symptoms.length > 0 &&
        <div>
            <div style={{ fontSize: 12, color: 'var(--a-ink-soft)', marginBottom: 8 }}>{tr("untranslated_simptomlar_xhm7bx", "Simptomlar")}</div>
            <div className="flex flex-wrap gap-2">
              {summary.symptoms.map((symptom) =>
            <span key={symptom} className="a-tag" style={{ cursor: 'default' }}>
                  {getSymptomLabel(symptom)}
                </span>
            )}
            </div>
          </div>
        }

        {/* Notes */}
        {summary.notes &&
        <div>
            <div style={{ fontSize: 12, color: 'var(--a-ink-soft)', marginBottom: 4 }}>{tr("dailysummaryscreen_qeydler_a7a98b", "Qeydlər")}</div>
            <p style={{ fontSize: 13, color: 'var(--a-body-text)' }}>{summary.notes}</p>
          </div>
        }
      </div>
    </motion.div>);

};

export default DailySummaryScreen;
