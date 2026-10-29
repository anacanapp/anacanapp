import { useState, forwardRef, useMemo } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Calendar, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { hapticFeedback } from '@/lib/native';
import { useMoodOptions, useSymptoms } from '@/hooks/useDynamicConfig';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';

interface MoodDiaryProps {
  onBack: () => void;
}

const MoodDiary = forwardRef<HTMLDivElement, MoodDiaryProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('MoodDiary', 'Tools');
  const isRtl = useIsRtl();

  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'insights'>('log');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedBleeding, setSelectedBleeding] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { logs, todayLog, loading: logsLoading, addLog } = useDailyLogs();
  const { lifeStage, language } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, language: s.language }))
  );
  const { data: dbMoods, isLoading: moodsLoading } = useMoodOptions();
  const { data: dbSymptoms, isLoading: symptomsLoading } = useSymptoms(lifeStage);

  const locale = getLocaleTag();

  // Map DB data to component format
  const moodEmojis = useMemo(() => {
    if (!dbMoods || dbMoods.length === 0) {
      return [
      { value: 1, emoji: '😢', label: tr("mooddiary_cox_pis_e041c5", 'Çox pis'), color: 'bg-red-100 border-red-300' },
      { value: 2, emoji: '😔', label: tr("mooddiary_pis_3c7a2d", "Pis"), color: 'bg-orange-100 border-orange-300' },
      { value: 3, emoji: '😐', label: tr("common_normal", "Normal"), color: 'bg-yellow-100 border-yellow-300' },
      { value: 4, emoji: '🙂', label: tr("mooddiary_yaxsi_9d8595", 'Yaxşı'), color: 'bg-lime-100 border-lime-300' },
      { value: 5, emoji: '😊', label: tr("mooddiary_ela_720a0e", 'Əla'), color: 'bg-green-100 border-green-300' }];

    }
    return dbMoods.map((m) => ({
      value: m.value,
      emoji: m.emoji,
      label: m.label,
      color: m.color_class || 'bg-gray-100 border-gray-300'
    }));
  }, [dbMoods]);

  const symptomOptions = useMemo(() => {
    if (!dbSymptoms || dbSymptoms.length === 0) {
      return [
      { id: 'tired', label: tr("mooddiary_yorgunluq_c68d62", 'Yorğunluq'), emoji: '😴' },
      { id: 'nausea', label: tr("mooddiary_urekbulanma_a42830", 'Ürəkbulanma'), emoji: '🤢' },
      { id: 'headache', label: tr("mooddiary_bas_agrisi_ff6f4c", 'Baş ağrısı'), emoji: '🤕' }];

    }
    return dbSymptoms.map((s) => ({
      id: s.symptom_key,
      label: s.label,
      emoji: s.icon || '🩺'
    }));
  }, [dbSymptoms]);

  // Initialize from today's log if exists
  useState(() => {
    if (todayLog) {
      setSelectedMood(todayLog.mood || null);
      setSelectedSymptoms(todayLog.symptoms || []);
      setSelectedBleeding(todayLog.bleeding || null);
      setNotes(todayLog.notes || '');
    }
  });

  // Qanaxma yalnız bump (hamiləlikdə ləkələnmə) və mommy (doğuşdan sonra lokia izləmə) üçün
  // mənalıdır — flow-da artıq ayrıca period-axını (flow_daily_logs.flow_intensity) var
  const showBleedingTracker = lifeStage === 'bump' || lifeStage === 'mommy';
  const BLEEDING_OPTIONS = [
  { id: 'none', label: tr('mooddiary_bleeding_none', 'Yoxdur'), emoji: '⚪' },
  { id: 'spotting', label: tr('mooddiary_bleeding_spotting', 'Ləkələnmə'), emoji: '🩸' },
  { id: 'light', label: tr('mooddiary_bleeding_light', 'Az'), emoji: '🩸' },
  { id: 'medium', label: tr('mooddiary_bleeding_medium', 'Orta'), emoji: '🩸' },
  { id: 'heavy', label: tr('mooddiary_bleeding_heavy', 'Çox'), emoji: '🩸' }];

  const toggleSymptom = async (symptomId: string) => {
    await hapticFeedback.light();
    setSelectedSymptoms((prev) =>
    prev.includes(symptomId) ?
    prev.filter((s) => s !== symptomId) :
    [...prev, symptomId]
    );
  };

  const handleSave = async () => {
    if (selectedMood === null) return;

    await hapticFeedback.medium();
    await addLog({
      log_date: new Date().toISOString().split('T')[0],
      mood: selectedMood,
      symptoms: selectedSymptoms,
      notes: notes || null,
      water_intake: todayLog?.water_intake || null,
      temperature: todayLog?.temperature || null,
      bleeding: showBleedingTracker ? selectedBleeding : todayLog?.bleeding || null
    });

    setActiveTab('history');
  };

  const averageMood = logs.length > 0 ?
  (logs.reduce((sum, e) => sum + (e.mood || 0), 0) / logs.filter((l) => l.mood).length).toFixed(1) :
  0;

  const loading = logsLoading || moodsLoading || symptomsLoading;

  if (loading) {
    return <ToolLoading />;
  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={<>{tr("mooddiary_bu_hefte_a5f60b", "Bu həftə")}: {logs.length} {tr("common_qeyd", "qeyd")}</>}
        title={tr("mooddiary_ehval_gundeliyi_831844", "\u018Fhval G\xFCnd\u0259liyi")} />

      <MedicalDisclaimer variant="compact" className="mb-3" />

      {/* Mood Summary */}
      <motion.div
        className="a-grid-2 a-fade-in"
        style={{ marginTop: 0 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}>
        
        <div className="a-stat-tile" style={{ background: 'var(--a-pink-1)' }}>
          <span style={{ fontSize: 26 }}>{logs[0]?.mood ? moodEmojis.find((m) => m.value === logs[0].mood)?.emoji : '😊'}</span>
          <div>
            <p className="a-stat-tile-label" style={{ color: 'var(--a-berry-ink)' }}>{tr("mooddiary_ortalama_ehval_72856f", "Ortalama əhval")}</p>
            <p className="a-stat-tile-value" style={{ fontSize: 17 }}>{averageMood}</p>
          </div>
        </div>
        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
            <Calendar size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("mooddiary_bu_hefte_a5f60b", "Bu həftə")}</p>
            <p className="a-stat-tile-value" style={{ fontSize: 17 }}>{logs.length} {tr("common_qeyd", "qeyd")}</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="a-tabs" style={{ display: 'flex', width: '100%', marginTop: 12 }}>
        {[
        { id: 'log', label: tr("mooddiary_qeyd", 'Qeyd'), icon: Plus },
        { id: 'history', label: tr("mooddiary_tarixce_b09a14", 'Tarixçə'), icon: Calendar },
        { id: 'insights', label: tr("mooddiary_analiz", 'Analiz'), icon: TrendingUp }].
        map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`a-tab${activeTab === tab.id ? ' active' : ''}`}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              
              <Icon size={13} strokeWidth={2.2} />
              {tab.label}
            </button>);

        })}
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'log' &&
          <motion.div
            key="log"
            initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(20, isRtl) }}
            className="space-y-3">
            
              {/* Mood Selection */}
              <div className="a-card">
                <h2 className="a-card-title a-heading text-center" style={{ marginBottom: 12 }}>{tr("mooddiary_bu_gun_ozunuzu_nece_hiss_edirsiniz_b2d818", "Bu gün özünüzü necə hiss edirsiniz?")}</h2>
                <div className="flex justify-between">
                  {moodEmojis.map((mood, index) =>
                <motion.button
                  key={mood.value}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg border-2 transition-all ${
                  selectedMood === mood.value ?
                  `${mood.color} scale-110 shadow-lg` :
                  ''}`
                  }
                  style={selectedMood === mood.value ? { cursor: 'pointer' } : { background: 'var(--a-surface-soft)', borderColor: 'transparent', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                      {mood.emoji}
                    </motion.button>
                )}
                </div>
                {selectedMood &&
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center a-list-value"
                style={{ marginTop: 10, color: 'var(--a-accent-ink)', fontSize: 12.5 }}>
                
                    {moodEmojis.find((m) => m.value === selectedMood)?.label}
                  </motion.p>
              }
              </div>

              {/* Symptoms */}
              <div className="a-card">
                <h2 className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr("untranslated_simptomlar_xhm7bx", "Simptomlar")}</h2>
                <div className="a-tag-row" style={{ marginBottom: 0 }}>
                  {symptomOptions.map((symptom) =>
                <motion.button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`a-tag${selectedSymptoms.includes(symptom.id) ? ' on' : ''}`}
                  whileTap={{ scale: 0.95 }}>
                  
                      <span className="text-xs">{symptom.emoji}</span>
                      {symptom.label}
                    </motion.button>
                )}
                </div>
              </div>

              {/* Bleeding — yalnız bump/mommy */}
              {showBleedingTracker &&
              <div className="a-card">
                  <h2 className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr('mooddiary_bleeding_title', 'Qanaxma')}</h2>
                  <div className="a-tag-row" style={{ marginBottom: 0 }}>
                    {BLEEDING_OPTIONS.map((opt) => {
                    const isSelected = opt.id === 'none' ? selectedBleeding === null : selectedBleeding === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        onClick={() => setSelectedBleeding(opt.id === 'none' ? null : opt.id)}
                        className={`a-tag${isSelected ? ' on' : ''}`}
                        whileTap={{ scale: 0.95 }}>
                        
                          <span className="text-xs">{opt.emoji}</span>
                          {opt.label}
                        </motion.button>);

                  })}
                  </div>
                  {selectedBleeding === 'heavy' &&
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs"
                  style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 12, background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', fontWeight: 600 }}>
                  
                      🆘 {lifeStage === 'mommy' ?
                  tr('mooddiary_bleeding_heavy_warning_mommy', 'Ağır qanaxma (1 saatda bir bezi doldurur və ya iri laxtalar) təhlükəli ola bilər — dərhal həkiminizlə əlaqə saxlayın.') :
                  tr('mooddiary_bleeding_heavy_warning_bump', 'Hamiləlikdə ağır qanaxma təcili tibbi vəziyyət ola bilər — dərhal həkiminizlə və ya təcili yardımla əlaqə saxlayın.')}
                    </motion.p>
                }
                </div>
              }

              {/* Notes */}
              <div className="a-card">
                <h2 className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr("mooddiary_qeydler_a7a98b", "Qeydlər")}</h2>
                <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("mooddiary_bu_gun_haqqinda_yazmaq_istedikleriniz_1e2d2d", "Bu gün haqqında yazmaq istədikləriniz...")}
                  className="a-input w-full resize-none"
                  rows={2} />
              
              </div>

              {/* Save Button */}
              <motion.button
              onClick={handleSave}
              disabled={selectedMood === null}
              className="a-btn-solid w-full"
              style={{ justifyContent: 'center', padding: '13px 18px', opacity: selectedMood === null ? 0.45 : 1 }}
              whileTap={{ scale: 0.98 }}>{tr("untranslated_yadda_saxla_bpdu9v", "Yadda saxla")}</motion.button>
            </motion.div>
          }

          {activeTab === 'history' &&
          <motion.div
            key="history"
            initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(20, isRtl) }}
            className="space-y-3">
            
              <div className="a-section-head" style={{ marginBottom: 8 }}>
                <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("mooddiary_son_qeydler_181e41", "Son qeydlər")}</h2>
              </div>
                {logs.length === 0 ?
            <p className="a-list-sub text-center" style={{ padding: '24px 0', margin: 0 }}>{tr("mooddiary_hele_qeyd_yoxdur_a3d826", "Hələ qeyd yoxdur")}</p> :

            <div className="a-list-card">
              {logs.slice(0, 10).map((entry, index) =>
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.3) }}
              className="a-list-row"
              style={{ alignItems: 'flex-start' }}>
              
                    <span className="a-list-icon" style={{ background: 'var(--a-pink-1)', fontSize: 19 }}>
                      {entry.mood ? moodEmojis.find((m) => m.value === entry.mood)?.emoji : '😐'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="a-list-title" style={{ fontSize: 12.5 }}>
                          {new Date(entry.log_date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) =>
                    <Heart
                      key={i}
                      size={13}
                      style={i < (entry.mood || 0) ? { color: 'var(--a-pink-2)', fill: 'var(--a-pink-2)' } : { color: 'var(--a-line-strong)' }} />

                    )}
                        </div>
                      </div>
                      {entry.notes &&
                <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBottom: 6 }}>{entry.notes}</p>
                }
                      <div className="a-tag-row" style={{ marginBottom: 0, gap: 5 }}>
                        {(entry.symptoms || []).map((s) => {
                    const symptom = symptomOptions.find((opt) => opt.id === s);
                    return symptom ?
                    <span key={s} className="a-tag" style={{ cursor: 'default', padding: '4px 9px', fontSize: 10, background: 'var(--a-pink-1)', color: 'var(--a-berry-ink)' }}>
                              {symptom.emoji} {symptom.label}
                            </span> :
                    null;
                  })}
                        {entry.bleeding &&
                  <span className="a-tag" style={{ cursor: 'default', padding: '4px 9px', fontSize: 10, background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)' }}>
                            🩸 {BLEEDING_OPTIONS.find((opt) => opt.id === entry.bleeding)?.label || entry.bleeding}
                          </span>
                  }
                      </div>
                    </div>
                  </motion.div>
            )}
            </div>
            }
            </motion.div>
          }

          {activeTab === 'insights' &&
          <motion.div
            key="insights"
            initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(20, isRtl) }}
            className="space-y-3">
            
              <div className="a-card">
                <div className="a-card-head" style={{ marginBottom: 10 }}>
                  <h2 className="a-card-title a-heading">✨ {tr("mooddiary_ai_analizi_070626", "AI Analizi")}</h2>
                  <Sparkles size={15} style={{ color: 'var(--a-lav-2)' }} />
                </div>
                <p className="a-cta-text" style={{ marginBottom: 12 }}>
                  {tr("mooddiary_son_bir_heftede_ehvaliniz_umum_c383f6", "Son bir h\u0259ft\u0259d\u0259 \u0259hval\u0131n\u0131z \xFCmumiyy\u0259tl\u0259 yax\u015F\u0131 olub. \u018Fn \xE7ox qeyd etdiyiniz simptomlar\u0131 izl\u0259yin.")}
                </p>
                <div className="a-today-info-tip">
                  <span style={{ fontSize: 15, lineHeight: 1 }}>💡</span>
                  <span>
                    <strong>{tr("mooddiary_meslehet_6a93f2", "Məsləhət:")}</strong> {tr("mooddiary_yorgunluq_hiss_etdiyiniz_gunle_478815", "Yor\u011Funluq hiss etdiyiniz g\xFCnl\u0259rd\u0259 istirah\u0259t etm\u0259yi unutmay\u0131n. Hamil\u0259lik zaman\u0131 b\u0259d\u0259ninizin ehtiyaclar\u0131na qulaq asmaq vacibdir.")}
                  </span>
                </div>
              </div>

              {/* Weekly Mood Chart */}
              <div className="a-card">
                <div className="a-card-head">
                  <h3 className="a-card-title a-heading">{tr("mooddiary_heftelik_ehval_trendi_5796d9", "Həftəlik əhval trendi")}</h3>
                </div>
                <div className="a-trend-bars">
                  {Array.from({ length: 7 }).map((_, i) => {
                  const day = new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' });
                  const dayLog = logs.find((l) => new Date(l.log_date).getDay() === (i + 1) % 7);
                  const height = dayLog?.mood ? dayLog.mood / 5 * 100 : 50;
                  return (
                    <div key={i} className="a-trend-bar-col">
                        <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className={`a-trend-bar${dayLog?.mood ? ' hi' : ''}`} />
                      
                        <span className="a-trend-bar-label">{day}</span>
                      </div>);

                })}
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </ToolPage>);

});

MoodDiary.displayName = 'MoodDiary';

export default MoodDiary;