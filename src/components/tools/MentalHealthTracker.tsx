import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, AlertTriangle, CheckCircle, ChevronRight, Brain, Wind, Smile, ChevronLeft, ExternalLink, Sparkles, Activity, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import {
  useMoodCheckins,
  useTodayMoodCheckin,
  useAddMoodCheckin,
  useEPDSAssessments,
  useSubmitEPDS,
  useMentalHealthResources,
  useShouldShowEPDSPrompt,
  EPDS_QUESTIONS as FALLBACK_EPDS_QUESTIONS,
  EPDSAssessment } from
'@/hooks/useMentalHealth';
import {
  useMoodLevelsDB,
  useBreathingExercisesDB,
  useEPDSQuestionsDB,
  FALLBACK_MOOD_LEVELS,
  FALLBACK_BREATHING_EXERCISES } from
'@/hooks/useMentalHealthData';
import { format, subDays } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { analytics } from '@/lib/analytics';
import { isHealthConnected } from '@/lib/health';
import { useHealthDaily } from '@/hooks/useHealthData';
import { useDailyLogs } from '@/hooks/useDailyLogs';

interface MentalHealthTrackerProps {
  onBack: () => void;
}

// Fallback mood colors mapped to the anacan palette
const FALLBACK_MOOD_COLORS: Record<number, {color: string;soft: string;}> = {
  1: { color: '#ff8aa4', soft: 'var(--a-pink-1)' },
  2: { color: 'var(--a-peach-2)', soft: 'var(--a-peach-1)' },
  3: { color: '#ffc94d', soft: 'var(--a-yellow-1)' },
  4: { color: '#8fd19e', soft: 'var(--a-green-1)' },
  5: { color: '#63bd8b', soft: 'var(--a-green-1)' }
};

// Risk level → anacan palette
const riskStyles: Record<string, {bg: string;ink: string;}> = {
  high: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
  moderate: { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  low: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' }
};

const MentalHealthTracker = ({ onBack }: MentalHealthTrackerProps) => {
  useScrollToTop();
  useScreenAnalytics('MentalHealthTracker', 'Tools');
  const isRtl = useIsRtl();

  // Fetch data from database
  const { data: moodLevelsDB = [] } = useMoodLevelsDB();
  const { data: breathingExercisesDB = [] } = useBreathingExercisesDB();
  const { data: epdsQuestionsDB = [] } = useEPDSQuestionsDB();

  // Map DB EPDS questions to component format, fallback to hardcoded
  const EPDS_QUESTIONS = useMemo(() => {
    if (epdsQuestionsDB.length > 0) {
      return epdsQuestionsDB.map((q) => ({
        id: q.question_number,
        question: q.question_text,
        options: (q.options || []).map((o) => ({
          value: o.value,
          label: o.text
        }))
      }));
    }
    return FALLBACK_EPDS_QUESTIONS;
  }, [epdsQuestionsDB]);

  // Use DB data (color preserved as inline value) or fallback
  const MOOD_LEVELS = useMemo(() => {
    if (moodLevelsDB.length > 0) {
      return moodLevelsDB.map((m) => ({
        value: m.mood_value,
        emoji: m.emoji,
        label: m.label,
        color: m.color || FALLBACK_MOOD_COLORS[m.mood_value]?.color || 'var(--a-peach-2)',
        soft: m.color ? `${m.color}1f` : FALLBACK_MOOD_COLORS[m.mood_value]?.soft || 'var(--a-surface-soft)'
      }));
    }
    return FALLBACK_MOOD_LEVELS.map((m) => ({
      value: m.mood_value,
      emoji: m.emoji,
      label: m.label,
      color: FALLBACK_MOOD_COLORS[m.mood_value]?.color || 'var(--a-peach-2)',
      soft: FALLBACK_MOOD_COLORS[m.mood_value]?.soft || 'var(--a-surface-soft)'
    }));
  }, [moodLevelsDB]);

  const BREATHING_EXERCISES = useMemo(() => {
    if (breathingExercisesDB.length > 0) {
      return breathingExercisesDB.map((e) => ({
        name: e.name,
        inhale: e.inhale_seconds,
        hold: e.hold_seconds,
        exhale: e.exhale_seconds,
        description: e.description || '',
        emoji: e.icon === 'Wind' ? '🌙' : e.icon === 'Square' ? '📦' : '💨'
      }));
    }
    return FALLBACK_BREATHING_EXERCISES.map((e) => ({
      name: e.name,
      inhale: e.inhale_seconds,
      hold: e.hold_seconds,
      exhale: e.exhale_seconds,
      description: e.description || '',
      emoji: e.icon === 'Wind' ? '🌙' : e.icon === 'Square' ? '📦' : '💨'
    }));
  }, [breathingExercisesDB]);

  const [showEPDS, setShowEPDS] = useState(false);
  const [epdsAnswers, setEpdsAnswers] = useState<Record<string, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState<EPDSAssessment | null>(null);
  const [showBreathing, setShowBreathing] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [breathingCount, setBreathingCount] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(BREATHING_EXERCISES[0]);
  const [notes, setNotes] = useState('');

  // Update selected exercise when exercises load
  useEffect(() => {
    if (BREATHING_EXERCISES.length > 0 && !selectedExercise) {
      setSelectedExercise(BREATHING_EXERCISES[0]);
    }
  }, [BREATHING_EXERCISES]);

  const { data: moodCheckins = [] } = useMoodCheckins(14);
  const { data: todayCheckin } = useTodayMoodCheckin();
  const { data: epdsAssessments = [] } = useEPDSAssessments();
  const { data: resources = [] } = useMentalHealthResources();
  // Dashboard-dakı Əhval vərəqəsi ilə eyni "daily_logs" mənbəyi — EPDS təklifi hər iki
  // qeyd yerini nəzərə alsın, əhval qeydi isə hər iki yerdə sinxron görünsün deyə
  const { logs: dailyLogs, updateMood: mirrorMoodToDailyLog } = useDailyLogs();

  const addMoodCheckin = useAddMoodCheckin();
  const submitEPDS = useSubmitEPDS();
  const shouldShowEPDSPrompt = useShouldShowEPDSPrompt(dailyLogs);

  // Health-dən mindfulness dəqiqələri — nəfəs məşqi ilə eyni mövzu, "körpü" kimi göstərilir
  const healthConnected = isHealthConnected();
  const { data: healthDaily } = useHealthDaily(7, healthConnected);
  const weekMindfulnessMin = (healthDaily?.mindfulness || []).reduce((sum, s) => sum + s.value, 0);

  const handleMoodSelect = async (level: number) => {
    await addMoodCheckin.mutateAsync({ mood_level: level, notes: notes || undefined });
    // Dashboard-dakı Əhval vərəqəsi/həftəlik xülasələr eyni qalsın deyə daily_logs-a da güzgülənir
    // (uğursuz olsa belə əsas qeyd artıq saxlanılıb, buna görə nəticəsi gözlənilmir)
    void mirrorMoodToDailyLog(level);
    setNotes('');
    toast.success(tr("mentalhealthtracker_ehvaliniz_qeyd_edildi_dd9071", "\u018Fhval\u0131n\u0131z qeyd edildi \u2728"));
  };

  const handleEPDSAnswer = (questionId: number, value: number) => {
    // Update the answer for the current question
    setEpdsAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goToNextQuestion = () => {
    if (currentQuestion < EPDS_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleSubmitEPDS = async () => {
    if (Object.keys(epdsAnswers).length < EPDS_QUESTIONS.length) {
      toast.error(tr("mentalhealthtracker_butun_suallara_cavab_verin_3e999d", "B\xFCt\xFCn suallara cavab verin"));
      return;
    }

    const result = await submitEPDS.mutateAsync(epdsAnswers);
    setShowResult(result);
    setShowEPDS(false);
    setEpdsAnswers({});
    setCurrentQuestion(0);
  };

  useEffect(() => {
    if (breathingPhase === 'idle') return;

    const durations: Record<string, number> = {
      inhale: selectedExercise.inhale * 1000,
      hold: selectedExercise.hold * 1000,
      exhale: selectedExercise.exhale * 1000
    };

    const timer = setTimeout(() => {
      if (breathingPhase === 'inhale') {
        setBreathingPhase('hold');
      } else if (breathingPhase === 'hold') {
        setBreathingPhase('exhale');
      } else if (breathingPhase === 'exhale') {
        if (breathingCount < 3) {
          setBreathingCount((c) => c + 1);
          setBreathingPhase('inhale');
        } else {
          setBreathingPhase('idle');
          setBreathingCount(0);
          toast.success(tr("mentalhealthtracker_tamamlandi_ozunuzu_nece_hiss_e_9a2212", "Tamamland\u0131! \xD6z\xFCn\xFCz\xFC nec\u0259 hiss edirsiniz?"));
          // Analitika üçün qeyd — funksiya artıq mövcud idi, amma heç bir yerdən çağırılmırdı
          analytics.logBreathingExercise(selectedExercise.name);
        }
      }
    }, durations[breathingPhase]);

    return () => clearTimeout(timer);
  }, [breathingPhase, breathingCount, selectedExercise]);

  const startBreathing = () => {
    setBreathingPhase('inhale');
    setBreathingCount(0);
  };

  const getRiskStyle = (level: string) => riskStyles[level] || riskStyles.low;

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high':return tr("mentalhealthtracker_yuksek_risk_29a5a3", "Y\xFCks\u0259k Risk");
      case 'moderate':return tr("mentalhealthtracker_risk_orta", 'Orta Risk');
      default:return tr("mentalhealthtracker_risk_normal", 'Normal');
    }
  };

  const moodTrend = moodCheckins.length >= 2 ?
  moodCheckins.slice(0, 7).reduce((sum, c) => sum + c.mood_level, 0) / Math.min(7, moodCheckins.length) :
  null;

  const last7Days = [...Array(7)].map((_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const checkin = moodCheckins.find((c) => c.checked_at === date);
    return { date, mood: checkin?.mood_level || 0, day: format(subDays(new Date(), 6 - i), 'EEE', { locale: getCurrentDateLocale() }) };
  });

  const emergencyResources = resources.filter((r) => r.is_emergency);
  const otherResources = resources.filter((r) => !r.is_emergency);

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("mentalhealthtracker_rahatlama_ve_stress_azaltma_1a97bc", "Rahatlama və stress azaltma")}
        title={tr("mentalhealthtracker_mental_saglamliq_68e65e", "Mental Sa\u011Flaml\u0131q")} />

      <MedicalDisclaimer variant="anacan" className="mb-4" />

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-green-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
          <Smile className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-green-ink)' }} />
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-green-ink)' }}>{moodCheckins.length}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-green-ink)', opacity: 0.8 }}>{tr("untranslated_qeyd_z0999u", "Qeyd")}</p>
        </motion.div>
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-blue-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          
          <Activity className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-blue-ink)' }} />
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-blue-ink)' }}>{moodTrend ? moodTrend.toFixed(1) : '—'}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-blue-ink)', opacity: 0.8 }}>{tr("untranslated_ortalama_qxgps6", "Ortalama")}</p>
        </motion.div>
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-lav-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
          <Calendar className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-lav-ink)' }} />
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-lav-ink)' }}>{epdsAssessments.length}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>EPDS</p>
        </motion.div>
      </div>

      <div className="space-y-4">
        {/* EPDS Alert */}
        {shouldShowEPDSPrompt && !epdsAssessments.length &&
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card"
          style={{ background: 'var(--a-yellow-1)', border: 'none' }}>
          
            <div className="flex items-start gap-3">
              <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', flexShrink: 0 }}>
                <AlertTriangle size={17} strokeWidth={2.2} style={{ color: 'var(--a-warn-ink)' }} />
              </span>
              <div className="flex-1">
                <h3 className="a-list-title" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>{tr("mentalhealthtracker_sizinle_danisaq_a4ad3a", "Sizinlə danışaq?")}</h3>
                <p className="text-sm mt-1" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.85 }}>
                  {tr("mentalhealthtracker_qisa_sorgu_ile_veziyyeti_qiyme_97ab4c", "Q\u0131sa sor\u011Fu il\u0259 v\u0259ziyy\u0259ti qiym\u0259tl\u0259ndir\u0259k?")}
                </p>
                <button
                className="a-cta-btn mt-3"
                style={{ height: 38, padding: '0 16px', fontSize: 11.5 }}
                onClick={() => setShowEPDS(true)}>
                  {tr("mentalhealthtracker_sorguya_basla_0563f3", "Sor\u011Fuya ba\u015Fla")}
                
              </button>
              </div>
            </div>
          </motion.div>
        }

        {/* Today's Check-in */}
        <motion.div
          className="a-card overflow-hidden"
          style={{ padding: 0 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>
          
          <div className="p-4" style={{ background: 'var(--a-grad-green)' }}>
            <h3 className="font-bold flex items-center gap-2 a-heading" style={{ margin: 0, color: 'var(--a-green-ink)' }}>
              <Smile className="w-5 h-5" />
              {tr("mentalhealthtracker_bu_gun_necesen_26ad26", "Bu g\xFCn nec\u0259s\u0259n?")}
            </h3>
          </div>
          <div className="p-4">
            {todayCheckin ?
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-6">
              
                <motion.div
                className="text-7xl mb-3"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: 2, repeatDelay: 2 }}>
                
                  {MOOD_LEVELS.find((m) => m.value === todayCheckin.mood_level)?.emoji}
                </motion.div>
                <p className="text-lg font-medium" style={{ margin: 0, color: 'var(--a-ink)' }}>
                  {tr("mentalhealthtracker_bu_gun_ozunuzu_24fed0", "Bu g\xFCn \xF6z\xFCn\xFCz\xFC")} <span className="font-bold" style={{ color: 'var(--a-accent-ink)' }}>{MOOD_LEVELS.find((m) => m.value === todayCheckin.mood_level)?.label.toLowerCase()}</span> hiss edirsiniz
                </p>
                <p className="a-list-sub mt-2" style={{ margin: '8px 0 0' }}>
                  {tr("mentalhealthtracker_qeyd_etdiyiniz_ucun_tesekkurle_52b458", "\u2728 Qeyd etdiyiniz \xFC\xE7\xFCn t\u0259\u015F\u0259kk\xFCrl\u0259r!")}
                </p>
              </motion.div> :

            <div className="space-y-4">
                <div className="flex justify-between items-end py-2">
                  {MOOD_LEVELS.map((mood, index) =>
                <motion.button
                  key={mood.value}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleMoodSelect(mood.value)}
                  disabled={addMoodCheckin.isPending}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all hover:scale-110"
                  style={{ background: mood.soft, cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                      <span className="text-3xl">{mood.emoji}</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--a-ink)' }}>{mood.label}</span>
                    </motion.button>
                )}
                </div>
                <div>
                  <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tr("mentalhealthtracker_i_steyirsinizse_qisa_qeyd_elave_edin_9043bb", "İstəyirsinizsə, qısa qeyd əlavə edin...")}
                  className="a-input h-16 resize-none"
                  style={{ height: 64, width: '100%' }} />
                
                </div>
              </div>
            }
          </div>
        </motion.div>

        {/* Weekly Mood Chart */}
        {moodCheckins.length > 0 &&
        <motion.div
          className="a-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
            <h3 className="font-bold mb-4 flex items-center gap-2 a-heading" style={{ margin: '0 0 16px', color: 'var(--a-ink)' }}>
              <Activity className="w-5 h-5" style={{ color: 'var(--a-green-2)' }} />
              {tr("mentalhealthtracker_son_7_gun_1d4103", "Son 7 G\xFCn")}
            </h3>
            <div className="flex items-end justify-between h-28 gap-2">
              {last7Days.map((day, i) =>
            <motion.div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ height: '100%', justifyContent: 'flex-end' }}>
              
                  <div
                className="w-full rounded-xl transition-all"
                style={{
                  height: day.mood > 0 ? `${day.mood / 5 * 100}%` : '15%',
                  background: day.mood > 0 ? MOOD_LEVELS.find((m) => m.value === day.mood)?.color || 'var(--a-peach-2)' : 'var(--a-line-strong)'
                }} />
              
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--a-ink-soft)' }}>{day.day}</span>
                </motion.div>
            )}
            </div>
            {moodTrend !== null &&
          <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--a-green-1)' }}>
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-3xl">{MOOD_LEVELS.find((m) => m.value === Math.round(moodTrend))?.emoji}</span>
                  <span className="font-bold text-lg" style={{ color: 'var(--a-green-ink)' }}>Ortalama: {moodTrend.toFixed(1)}/5</span>
                </div>
                <p className="text-xs text-center" style={{ margin: 0, color: 'var(--a-green-ink)' }}>
                  {moodTrend >= 4 ? tr("mentalhealthtracker_ela_gedir_ozunuze_qaygi_goster_f76926", "\uD83C\uDF1F \u018Fla gedir! \xD6z\xFCn\xFCz\u0259 qay\u011F\u0131 g\xF6st\u0259rm\u0259y\u0259 davam edin.") :
              moodTrend >= 3 ? tr("mentalhealthtracker_yaxsi_gedir_ozunuze_vaxt_ayiri_a89726", "\uD83D\uDCAA Yax\u015F\u0131 gedir. \xD6z\xFCn\xFCz\u0259 vaxt ay\u0131r\u0131n.") : tr("mentalhealthtracker_biraz_cetin_dovr_kecirirsiniz__85fe81", "\uD83D\uDC9D Biraz \xE7\u0259tin d\xF6vr ke\xE7irirsiniz. Yard\u0131m ist\u0259m\u0259kd\u0259n \xE7\u0259kinm\u0259yin.")
              }
                </p>
              </div>
          }
          </motion.div>
        }

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Breathing Exercise */}
          <motion.button
            onClick={() => setShowBreathing(true)}
            className="a-card text-start"
            style={{ cursor: 'pointer' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.98 }}>
            
            <span className="a-list-icon mb-3" style={{ background: 'var(--a-grad-blue)', marginBottom: 12 }}>
              <Wind size={17} strokeWidth={2.2} style={{ color: 'var(--a-blue-ink)' }} />
            </span>
            <h3 className="a-list-title" style={{ margin: 0 }}>{tr("mentalhealthtracker_nefes_mesqi_8d98bb", "Nəfəs Məşqi")}</h3>
            <p className="a-list-sub mt-1" style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>{tr("mentalhealthtracker_rahatlama_ve_stress_azaltma_1a97bc", "Rahatlama və stress azaltma")}</p>
          </motion.button>

          {/* EPDS Assessment */}
          <motion.button
            onClick={() => setShowEPDS(true)}
            className="a-card text-start"
            style={{ cursor: 'pointer' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.98 }}>
            
            <span className="a-list-icon mb-3" style={{ background: 'var(--a-grad-green)', marginBottom: 12 }}>
              <Brain size={17} strokeWidth={2.2} style={{ color: 'var(--a-green-ink)' }} />
            </span>
            <h3 className="a-list-title" style={{ margin: 0 }}>{tr("mentalhealthtracker_epds_testi_3c7a2d", "EPDS Testi")}</h3>
            <p className="a-list-sub mt-1" style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>{tr("mentalhealthtracker_depressiya_riski_qiymetlendirme_2729fe", "Depressiya riski qiymətləndirmə")}</p>
          </motion.button>
        </div>

        {/* Previous Assessments */}
        {epdsAssessments.length > 0 &&
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
            <div className="a-section-head">
              <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>
                {tr("mentalhealthtracker_kecmis_neticeler_072044", "Ke\xE7mi\u015F N\u0259tic\u0259l\u0259r")}
              </h3>
              <Sparkles size={15} style={{ color: 'var(--a-green-2)' }} />
            </div>
            <div className="a-list-card">
              {epdsAssessments.slice(0, 3).map((assessment, index) =>
            <motion.button
              key={assessment.id}
              onClick={() => setShowResult(assessment)}
              className="a-list-row w-full text-start"
              style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}>
              
                  <span className="a-list-icon" style={{ background: 'var(--a-green-1)' }}>
                    <Brain size={17} strokeWidth={2.2} style={{ color: 'var(--a-green-ink)' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="a-list-title">
                      {format(new Date(assessment.completed_at), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
                    </p>
                    <p className="a-list-sub">{tr('mentalhealthtracker_bal_label', 'Bal:')} {assessment.total_score}/30</p>
                  </div>
                  <span className="a-rank-tag" style={{ margin: 0, background: getRiskStyle(assessment.risk_level).bg, color: getRiskStyle(assessment.risk_level).ink }}>
                    {getRiskLabel(assessment.risk_level)}
                  </span>
                </motion.button>
            )}
            </div>
          </motion.div>
        }

        {/* Emergency Resources */}
        {emergencyResources.length > 0 &&
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}>
          
            <div className="a-section-head">
              <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>
                {tr("mentalhealthtracker_tecili_yardim_283100", "T\u0259cili Yard\u0131m")}
              </h3>
              <Phone size={15} style={{ color: 'var(--a-pink-2)' }} />
            </div>
            <div className="space-y-2">
              {emergencyResources.map((resource) =>
            <div key={resource.id} className="rounded-2xl p-4" style={{ background: 'var(--a-alert-bg)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold" style={{ margin: 0, color: 'var(--a-alert-ink)' }}>{resource.name}</p>
                      <p className="text-xs" style={{ margin: 0, color: 'var(--a-alert-soft)' }}>{resource.description}</p>
                    </div>
                    {resource.phone &&
                <a
                  href={`tel:${resource.phone}`}
                  className="a-cta-btn flex-shrink-0"
                  style={{ height: 38, padding: '0 14px', fontSize: 11.5, background: 'var(--a-pink-2)', color: '#fff', textDecoration: 'none' }}>
                        <Phone size={13} strokeWidth={2.2} />
                        {resource.phone}
                      </a>
                }
                  </div>
                </div>
            )}
            </div>
          </motion.div>
        }

        {/* Other Resources */}
        {otherResources.length > 0 &&
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}>
          
            <div className="a-section-head">
              <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("mentalhealthtracker_destek_resurslari_345241", "Dəstək Resursları")}</h3>
            </div>
            <div className="space-y-2 pb-4">
              {otherResources.map((resource) =>
            <div key={resource.id} className="a-card">
                  <p className="a-list-title" style={{ margin: 0 }}>{resource.name}</p>
                  <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{resource.description}</p>
                  <div className="flex gap-2 mt-3">
                    {resource.phone &&
                <a
                  href={`tel:${resource.phone}`}
                  className="a-btn-soft"
                  style={{ height: 36, padding: '0 14px', fontSize: 11.5, textDecoration: 'none' }}>
                        <Phone size={13} strokeWidth={2.2} />
                        {tr("mentalhealthtracker_zeng_et_15094d", "Zəng et")}
                      </a>
                }
                    {resource.website &&
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="a-btn-soft"
                  style={{ height: 36, padding: '0 14px', fontSize: 11.5, textDecoration: 'none' }}>
                        <ExternalLink size={13} strokeWidth={2.2} />
                        {tr("mentalhealthtracker_sayt_3c7a2d", "Sayt")}
                      </a>
                }
                  </div>
                </div>
            )}
            </div>
          </motion.div>
        }
      </div>

      {/* Breathing Exercise Modal */}
      <Dialog open={showBreathing} onOpenChange={setShowBreathing}>
        <DialogContent className="a-scope max-w-md rounded-[26px] max-h-[85dvh] overflow-y-auto" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <Wind className="w-5 h-5" style={{ color: 'var(--a-blue-2)' }} />
              {tr("mentalhealthtracker_nefes_mesqi_8d98bb", "Nəfəs Məşqi")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {breathingPhase === 'idle' ?
            <>
                {healthConnected && weekMindfulnessMin > 0 &&
              <div className="flex items-center gap-2.5 p-3 rounded-2xl" style={{ background: 'var(--a-lav-1)' }}>
                    <Wind size={15} style={{ color: 'var(--a-lav-ink)', flexShrink: 0 }} />
                    <p style={{ fontSize: 11.5, color: 'var(--a-lav-ink)', fontWeight: 600 }}>
                      {tr('mh_health_mindfulness_bridge', 'Bu həftə Apple Health / Health Connect-də {min} dəqiqə rahatlama qeydə alınıb').replace('{min}', String(weekMindfulnessMin))}
                    </p>
                  </div>
              }
                <div className="space-y-3">
                  {BREATHING_EXERCISES.map((ex, i) =>
                <motion.button
                  key={i}
                  onClick={() => setSelectedExercise(ex)}
                  className="w-full p-4 rounded-2xl text-start transition-all flex items-center gap-3"
                  style={selectedExercise.name === ex.name ?
                  { background: 'var(--a-green-1)', border: '2px solid var(--a-green-2)', cursor: 'pointer' } :
                  { background: 'var(--a-surface-soft)', border: '2px solid transparent', cursor: 'pointer' }}
                  whileTap={{ scale: 0.98 }}>
                  
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'var(--a-grad-blue)' }}>
                        {ex.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="a-list-title" style={{ margin: 0 }}>{ex.name}</p>
                        <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{ex.description}</p>
                        <p className="text-xs mt-1 font-semibold" style={{ margin: '4px 0 0', color: 'var(--a-green-ink)' }}>
                          {tr("mentalhealthtracker_nefes_al_56f3c5", "Nəfəs al:")} {ex.inhale}s • {tr('mentalhealthtracker_saxla_colon', 'Saxla:')} {ex.hold}s • {tr('mentalhealthtracker_burax_colon', 'Burax:')} {ex.exhale}s
                        </p>
                      </div>
                    </motion.button>
                )}
                </div>
                <button
                className="a-cta-btn w-full"
                style={{ justifyContent: 'center', height: 48, background: 'var(--a-green-2)' }}
                onClick={startBreathing}>
                
                  <Wind size={16} strokeWidth={2.2} />
                  {tr("mentalhealthtracker_basla_4820bc", "Başla")}
                </button>
              </> :

            <div className="text-center py-8">
                <motion.div
                className="w-44 h-44 mx-auto rounded-full flex items-center justify-center shadow-xl"
                animate={{
                  scale: breathingPhase === 'inhale' ? 1.4 : breathingPhase === 'exhale' ? 1 : 1.4,
                  backgroundColor: breathingPhase === 'inhale' ? '#63bd8b' : breathingPhase === 'hold' ? '#63acdf' : 'var(--a-peach-2)'
                }}
                transition={{
                  duration: breathingPhase === 'inhale' ? selectedExercise.inhale :
                  breathingPhase === 'hold' ? selectedExercise.hold :
                  selectedExercise.exhale
                }}>
                
                  <span className="text-white text-2xl font-bold">
                    {breathingPhase === 'inhale' ? tr("mentalhealthtracker_nefes_al_50ff18", "Nəfəs al") :
                  breathingPhase === 'hold' ? tr("mentalhealthtracker_saxla_3c7a2d", "Saxla") : tr("mentalhealthtracker_burax_3c7a2d", "Burax")}
                  </span>
                </motion.div>
                <p className="mt-8 text-xl font-bold" style={{ color: 'var(--a-ink)' }}>
                  {tr("mentalhealthtracker_dovre_a52cde", "Dövrə:")} {breathingCount + 1} / 4
                </p>
                <button className="a-btn-soft mt-4" style={{ height: 40, padding: '0 18px' }} onClick={() => setBreathingPhase('idle')}>
                  {tr("mentalhealthtracker_dayandir_b2ea06", "Dayandır")}
                </button>
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>

      {/* EPDS Quiz Modal */}
      <Dialog open={showEPDS} onOpenChange={setShowEPDS}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <Brain className="w-5 h-5" style={{ color: 'var(--a-green-2)' }} />
              {tr("mentalhealthtracker_epds_sorgusu_564f52", "EPDS Sorğusu")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {EPDS_QUESTIONS.map((_, i) =>
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-all"
                style={{ background: i <= currentQuestion ? 'var(--a-green-2)' : 'var(--a-line-strong)' }} />

              )}
            </div>
            <p className="a-list-sub text-center" style={{ margin: 0 }}>
              Sual {currentQuestion + 1} / {EPDS_QUESTIONS.length}
            </p>
            
            <AnimatePresence mode="wait">
              {EPDS_QUESTIONS[currentQuestion] &&
              <motion.div
                key={currentQuestion}
                initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: rtlX(-20, isRtl) }}>
                
                  <p className="font-bold mb-4 text-lg a-heading" style={{ color: 'var(--a-ink)' }}>{EPDS_QUESTIONS[currentQuestion].question}</p>
                  <div className="space-y-2">
                    {EPDS_QUESTIONS[currentQuestion].options.map((option) => {
                    const isSelected = epdsAnswers[EPDS_QUESTIONS[currentQuestion].id] === option.value;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        className="w-full flex items-center space-x-3 rtl:space-x-reverse p-4 rounded-2xl transition-all text-start"
                        style={isSelected ?
                        { background: 'var(--a-green-1)', border: '2px solid var(--a-green-2)', cursor: 'pointer' } :
                        { background: 'var(--a-surface-soft)', border: '2px solid transparent', cursor: 'pointer' }}
                        onClick={() => handleEPDSAnswer(EPDS_QUESTIONS[currentQuestion].id, option.value)}
                        whileTap={{ scale: 0.98 }}>
                        
                          <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ border: isSelected ? '2px solid var(--a-green-2)' : '2px solid var(--a-line-strong)', background: isSelected ? 'var(--a-green-2)' : 'transparent' }}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="flex-1 font-medium text-sm" style={{ color: 'var(--a-ink)' }}>{option.label}</span>
                        </motion.button>);

                  })}
                  </div>
                </motion.div>
              }
            </AnimatePresence>

            <div className="flex gap-2 pt-4">
              <button
                className="a-btn-soft"
                style={{ height: 44, padding: '0 16px', opacity: currentQuestion === 0 ? 0.45 : 1 }}
                onClick={goToPrevQuestion}
                disabled={currentQuestion === 0}>
                
                <ChevronLeft className="rtl:rotate-180" size={14} strokeWidth={2.2} />
                {tr("common_back", "Geri")}
              </button>
              
              {currentQuestion < EPDS_QUESTIONS.length - 1 ?
              <button
                className="a-cta-btn flex-1"
                style={{ justifyContent: 'center', height: 44, background: 'var(--a-green-2)', opacity: epdsAnswers[EPDS_QUESTIONS[currentQuestion].id] === undefined ? 0.5 : 1 }}
                onClick={goToNextQuestion}
                disabled={epdsAnswers[EPDS_QUESTIONS[currentQuestion].id] === undefined}>
                  {tr("mentalhealthtracker_novbeti_6e8661", "Növbəti")}
                  
                <ChevronRight className="rtl:rotate-180" size={14} strokeWidth={2.2} />
                </button> :

              <button
                className="a-cta-btn flex-1"
                style={{ justifyContent: 'center', height: 44, background: 'var(--a-green-2)', opacity: submitEPDS.isPending || Object.keys(epdsAnswers).length < EPDS_QUESTIONS.length ? 0.5 : 1 }}
                onClick={handleSubmitEPDS}
                disabled={submitEPDS.isPending || Object.keys(epdsAnswers).length < EPDS_QUESTIONS.length}>
                  {tr("mentalhealthtracker_neticeni_gor_d2fef0", "Nəticəni Gör")}
                
              </button>
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Modal */}
      <Dialog open={!!showResult} onOpenChange={() => setShowResult(null)}>
        <DialogContent className="a-scope max-w-md rounded-[26px] max-h-[85dvh] overflow-y-auto" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          {showResult &&
          <>
              <DialogHeader>
                <DialogTitle className="text-center a-heading" style={{ color: 'var(--a-ink)' }}>{tr("mentalhealthtracker_neticeniz_d14591", "Nəticəniz")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 text-center">
                <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-lg font-bold"
                style={{ background: getRiskStyle(showResult.risk_level).bg, color: getRiskStyle(showResult.risk_level).ink }}>
                
                  {showResult.risk_level === 'low' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  {getRiskLabel(showResult.risk_level)}
                </motion.div>
                
                <div>
                  <p className="a-heading" style={{ margin: 0, fontSize: 52, color: 'var(--a-ink)' }}>{showResult.total_score}</p>
                  <p style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("mentalhealthtracker_30_bal_suffix", "/ 30 bal")}</p>
                </div>

                <p className="text-sm p-4 rounded-2xl" style={{ margin: 0, background: 'var(--a-surface-soft)', color: 'var(--a-body-text)' }}>{showResult.recommendation}</p>

                {showResult.risk_level === 'high' && emergencyResources.length > 0 &&
              <div className="p-4 rounded-2xl" style={{ background: 'var(--a-alert-bg)' }}>
                    <p className="text-sm font-bold mb-3" style={{ margin: '0 0 12px', color: 'var(--a-alert-ink)' }}>
                      {tr("mentalhealthtracker_zehmet_olmasa_mutexessisle_ela_07b456", "🆘 Zəhmət olmasa mütəxəssislə əlaqə saxlayın:")}
                    </p>
                    <div className="space-y-2">
                      {emergencyResources.map((r) =>
                  <a
                    key={r.id}
                    href={`tel:${r.phone}`}
                    className="a-cta-btn w-full"
                    style={{ justifyContent: 'center', height: 44, background: 'var(--a-pink-2)', color: '#fff', textDecoration: 'none' }}>
                          <Phone size={15} strokeWidth={2.2} />
                          {r.name}: {r.phone}
                        </a>
                  )}
                    </div>
                  </div>
              }
              </div>
            </>
          }
        </DialogContent>
      </Dialog>
    </ToolPage>);

};

export default MentalHealthTracker;
