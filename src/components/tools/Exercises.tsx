import { useState, forwardRef, useMemo } from 'react';
import { tr } from '@/lib/tr';
import { useIsRtl, rtlX } from '@/lib/rtl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Flame, Check, ChevronRight, Star,
  Award, Dumbbell, Sparkles, Play, Trophy, HeartPulse } from
'lucide-react';
import { useExerciseLogs } from '@/hooks/useExerciseLogs';
import { useUserStore } from '@/store/userStore';
import { useExercises } from '@/hooks/useDynamicConfig';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { isHealthConnected } from '@/lib/health';
import { useHealthWorkouts } from '@/hooks/useHealthData';

interface ExercisesProps {
  onBack: () => void;
}

// Level → anacan palette
const levelStyles: Record<string, {bg: string;ink: string;}> = {
  easy: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  medium: { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  hard: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const Exercises = forwardRef<HTMLDivElement, ExercisesProps>(({ onBack }, ref) => {
  useScrollToTop();
  const isRtl = useIsRtl();
  useScreenAnalytics('Exercises', 'Tools');

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const { loading: logsLoading, addLog, isCompletedToday, getTodayStats, getStreak } = useExerciseLogs();
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const lifeStage = useUserStore((s) => s.lifeStage);
  const getPostpartumWeek = useUserStore((s) => s.getPostpartumWeek);
  const { data: dbExercises, isLoading: exercisesLoading } = useExercises();

  const pregnancyData = getPregnancyData();
  const currentTrimester = pregnancyData?.trimester || 2;

  // "mommy" mərhələsində trimester deyil, doğuşdan neçənci həftə keçdiyi əsas götürülür —
  // əvvəllər bu ekran postpartum istifadəçilərinə də sabit "trimester" başlığı göstərirdi
  // və heç bir doğuşdan-sonra məşqi görünmürdü (bütün məzmun trimester-only filtrlənirdi).
  const isMommy = lifeStage === 'mommy';
  const postpartumData = isMommy ? getPostpartumWeek() : null;
  const currentPostpartumWeek = postpartumData?.week ?? 0;
  const deliveryType = postpartumData?.deliveryType ?? null;

  const exercises = useMemo(() => {
    if (!dbExercises) return [];
    return dbExercises.map((e) => ({
      id: e.id,
      name: e.name,
      duration: e.duration_minutes,
      calories: e.calories,
      level: e.level,
      trimester: Array.isArray(e.trimester) ? e.trimester : [1, 2, 3],
      icon: e.icon || '🏃',
      description: e.description || '',
      steps: Array.isArray(e.steps) ? e.steps : [],
      isPostpartum: !!e.is_postpartum,
      postpartumWeekStart: e.postpartum_week_start ?? null,
      postpartumWeekEnd: e.postpartum_week_end ?? null,
      postpartumDeliveryTypes: Array.isArray(e.postpartum_delivery_types) ? e.postpartum_delivery_types : null
    }));
  }, [dbExercises]);

  const filteredExercises = isMommy ?
  exercises.filter((e) => {
    if (!e.isPostpartum) return false;
    const afterStart = e.postpartumWeekStart == null || currentPostpartumWeek >= e.postpartumWeekStart;
    const beforeEnd = e.postpartumWeekEnd == null || currentPostpartumWeek <= e.postpartumWeekEnd;
    const deliveryOk = !e.postpartumDeliveryTypes?.length || !deliveryType || e.postpartumDeliveryTypes.includes(deliveryType);
    return afterStart && beforeEnd && deliveryOk;
  }) :
  exercises.filter((e) => e.trimester.includes(currentTrimester));
  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) || null;
  const todayStats = getTodayStats();
  const streak = getStreak();

  // Bu ekrandakı "Bitirdim" qeydləri sabit/təxmini dəyərlərdir (məsələn "Yoqa = 20 kal"),
  // Health-dən oxunan həqiqi məşqlər isə tamamilə ayrı, ölçülmüş məlumatdır. Avtomatik
  // uyğunlaşdırmaq (vaxt-əsaslı matching) etibarsız olduğu üçün, sadəcə hər ikisini
  // görünən edirik ki, istifadəçi real fəaliyyətini də bir yerdə görsün.
  const healthConnected = isHealthConnected();
  const { data: healthWorkouts = [] } = useHealthWorkouts(7, healthConnected);
  const weekRealMinutes = Math.round(healthWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60);
  const weekRealCalories = healthWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0);

  const handleComplete = async () => {
    if (selectedExercise) {
      await addLog(
        selectedExercise.id,
        selectedExercise.name,
        selectedExercise.duration,
        selectedExercise.calories
      );
    }
    setSelectedExerciseId(null);
    setCurrentStep(0);
  };

  if (logsLoading || exercisesLoading) {
    return <ToolLoading />;
  }

  const getLevelLabel = (level: string) =>
  level === 'easy' ? tr("exercises_level_easy", 'Asan') : level === 'medium' ? tr("exercises_level_medium", 'Orta') : tr("exercises_cetin_4bf032", "\xC7\u0259tin");

  return (
    <div ref={ref}>
      <ToolPage>
        <ToolHeader
          onBack={selectedExercise ? () => {setSelectedExerciseId(null);setCurrentStep(0);} : onBack}
          eyebrow={isMommy ?
          `${tr('exercises_postpartum_week_prefix', 'Doğuşdan')} ${currentPostpartumWeek}. ${tr('exercises_postpartum_week_suffix', 'həftə')}` :
          `${currentTrimester}${tr("exercises_trimester_ucun_a94dca", ". trimester \xFC\xE7\xFCn")}`}
          title={selectedExercise ? selectedExercise.name : isMommy ? tr('exercises_postpartum_title', 'Doğuşdan Sonra Məşqlər') : tr("exercises_hamile_mesqleri_139b99", "Hamil\u0259 M\u0259\u015Fql\u0259ri")} />

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <motion.div
            className="rounded-2xl p-3 text-center"
            style={{ background: 'var(--a-blue-1)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}>
            
            <Check className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-blue-ink)' }} />
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-blue-ink)' }}>{todayStats.completedCount}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-blue-ink)', opacity: 0.8 }}>{tr("exercises_bu_gun_786fd4", "Bu gün")}</p>
          </motion.div>
          <motion.div
            className="rounded-2xl p-3 text-center"
            style={{ background: 'var(--a-peach-1)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}>
            
            <Flame className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-accent-ink)' }} />
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-accent-ink)' }}>{todayStats.totalCalories}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-accent-ink)', opacity: 0.8 }}>{tr("untranslated_kalori_y6oaf2", "Kalori")}</p>
          </motion.div>
          <motion.div
            className="rounded-2xl p-3 text-center"
            style={{ background: 'var(--a-yellow-1)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}>
            
            <Trophy className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--a-warn-ink)' }} />
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-warn-ink)' }}>{streak}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.8 }}>{tr("exercises_gun_ardicil_42e659", "Gün ardıcıl")}</p>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {!selectedExercise ?
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            
              {/* Daily Recommendation */}
              <motion.div
              className="a-card mb-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}>
              
                <div className="flex items-center gap-3">
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', flexShrink: 0 }}>
                    <Star size={17} strokeWidth={2.2} style={{ color: 'var(--a-warn-ink)' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="a-list-title" style={{ margin: 0 }}>{tr("exercises_gunun_tovsiyesi_f10d9b", "Günün tövsiyəsi")}</h3>
                    <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("exercises_20_deq_gezinti_kegel_mesqleri_797636", "20 dəq gəzinti + Kegel məşqləri")}</p>
                  </div>
                  <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)', flexShrink: 0 }}>
                    {tr("exercises_tovsiye_712d0f", "T\xF6vsiy\u0259")}
                  </span>
                </div>
              </motion.div>

              {/* Health-dən real fəaliyyət — yuxarıdakı "Bitirdim" qeydlərindən ayrı,
                  faktiki ölçülmüş Apple Health / Health Connect məlumatı */}
              {healthConnected && healthWorkouts.length > 0 &&
            <motion.div
              className="a-card mb-4"
              style={{ background: 'var(--a-lav-1)' }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}>
              
                  <div className="flex items-center gap-3">
                    <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', flexShrink: 0 }}>
                      <HeartPulse size={17} strokeWidth={2.2} style={{ color: 'var(--a-lav-ink)' }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="a-list-title" style={{ margin: 0 }}>{tr('exercises_health_real_activity', 'Bu həftə real fəaliyyətiniz (Health-dən)')}</h3>
                      <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
                        {healthWorkouts.length} {tr('health_workouts_week', 'Məşq (7 gün)').toLowerCase()} · {weekRealMinutes} {tr('health_min', 'dəq')} · {weekRealCalories} kcal
                      </p>
                    </div>
                  </div>
                </motion.div>
            }

              {/* Exercise List */}
              <div className="a-section-head">
                <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
                  {tr("exercises_sizin_ucun_mesqler_d614cc", "Sizin \xFC\xE7\xFCn m\u0259\u015Fql\u0259r")}
                </h2>
                <Sparkles size={15} style={{ color: 'var(--a-peach-2)' }} />
              </div>
              
              {filteredExercises.length === 0 ?
            <motion.div
              className="a-card text-center"
              style={{ padding: '34px 18px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>
              
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-blue-1)' }}>
                    <Dumbbell className="w-10 h-10" style={{ color: 'var(--a-blue-2)' }} />
                  </div>
                  <p className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("exercises_mesq_tapilmadi_088b54", "Məşq tapılmadı")}</p>
                  <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("exercises_admin_panelden_mesq_elave_edin_acce7f", "Admin paneldən məşq əlavə edin")}</p>
                </motion.div> :

            <div className="space-y-3 pb-4">
                  {filteredExercises.map((exercise, index) => {
                const isCompleted = isCompletedToday(exercise.id);
                return (
                  <motion.button
                    key={exercise.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.08, 0.4) }}
                    onClick={() => setSelectedExerciseId(exercise.id)}
                    className="a-card w-full flex items-center gap-4 text-start"
                    style={{
                      cursor: 'pointer',
                      ...(isCompleted ? { background: 'var(--a-green-1)', border: 'none' } : {})
                    }}>
                    
                        <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: isCompleted ? 'var(--a-grad-green)' : 'var(--a-blue-1)' }}>
                          {isCompleted ? '✅' : exercise.icon}
                        </div>
                        <div className="flex-1 text-start min-w-0">
                          <h3 className="a-list-title" style={{ margin: 0, color: isCompleted ? 'var(--a-green-ink)' : undefined }}>{exercise.name}</h3>
                          <p className="a-list-sub line-clamp-1" style={{ margin: 0, whiteSpace: 'normal', color: isCompleted ? 'color-mix(in srgb, var(--a-green-ink) 70%, transparent)' : undefined }}>{exercise.description}</p>
                          <div className="flex gap-3 mt-1 items-center flex-wrap">
                            <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: isCompleted ? 'var(--a-green-ink)' : 'var(--a-blue-ink)' }}>
                              <Clock className="w-3.5 h-3.5" /> {exercise.duration} {tr("exercises_deq_780a5c", "d\u0259q")}
                            </span>
                            <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: isCompleted ? 'var(--a-green-ink)' : 'var(--a-accent-ink)' }}>
                              <Flame className="w-3.5 h-3.5" /> {exercise.calories} kcal
                            </span>
                            <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: isCompleted ? 'var(--a-chip-overlay)' : levelStyles[exercise.level]?.bg || 'var(--a-surface-soft)',
                            color: isCompleted ? 'var(--a-green-ink)' : levelStyles[exercise.level]?.ink || 'var(--a-ink-soft)'
                          }}>
                              {getLevelLabel(exercise.level)}
                            </span>
                          </div>
                        </div>
                        <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isCompleted ? 'var(--a-chip-overlay)' : 'var(--a-surface-soft)' }}>
                          {isCompleted ?
                      <Check className="w-5 h-5" style={{ color: 'var(--a-green-ink)' }} /> :
                      <ChevronRight className="rtl:rotate-180 w-5 h-5" style={{ color: 'var(--a-ink-faint)' }} />
                      }
                        </div>
                      </motion.button>);

              })}
                </div>
            }
            </motion.div> :

          <motion.div
            key="detail"
            initial={{ opacity: 0, x: rtlX(50, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-50, isRtl) }}>
            
              {/* Exercise Detail Card */}
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                {/* Exercise Header */}
                <div className="p-6 text-center" style={{ background: 'var(--a-grad-blue)' }}>
                  <motion.div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-3 text-4xl"
                  style={{ background: 'rgba(255,255,255,0.35)' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: 2 }}>
                  
                    {selectedExercise.icon}
                  </motion.div>
                  <h2 className="text-xl font-bold mb-1 a-heading" style={{ margin: '0 0 4px', color: '#153e57' }}>{selectedExercise.name}</h2>
                  <p className="text-sm" style={{ margin: 0, color: '#153e57', opacity: 0.8 }}>{selectedExercise.description}</p>
                </div>
                
                {/* Stats */}
                <div className="p-4 grid grid-cols-3 gap-3" style={{ borderBottom: '1px solid var(--a-line)' }}>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ background: 'var(--a-blue-1)' }}>
                      <Clock className="w-5 h-5" style={{ color: 'var(--a-blue-ink)' }} />
                    </div>
                    <p className="font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{selectedExercise.duration}</p>
                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("exercises_deqiqe_94641a", "dəqiqə")}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ background: 'var(--a-peach-1)' }}>
                      <Flame className="w-5 h-5" style={{ color: 'var(--a-accent-ink)' }} />
                    </div>
                    <p className="font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{selectedExercise.calories}</p>
                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>kcal</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ background: 'var(--a-lav-1)' }}>
                      <Award className="w-5 h-5" style={{ color: 'var(--a-lav-ink)' }} />
                    </div>
                    <p className="font-bold capitalize" style={{ margin: 0, color: 'var(--a-ink)' }}>
                      {getLevelLabel(selectedExercise.level)}
                    </p>
                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("exercises_seviyye_f242cf", "səviyyə")}</p>
                  </div>
                </div>

                {/* Steps */}
                <div className="p-4">
                  <h3 className="font-bold mb-3 flex items-center gap-2 a-heading" style={{ margin: '0 0 12px', color: 'var(--a-ink)' }}>
                    <Play className="w-4 h-4" style={{ color: 'var(--a-blue-2)' }} />
                    {tr("exercises_addimlar_7d0a29", "Add\u0131mlar")}
                  </h3>
                  <div className="space-y-2">
                    {selectedExercise.steps.map((step, i) =>
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.1, 0.5) }}
                    className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                    style={{ background: i === currentStep ? 'var(--a-blue-1)' : 'var(--a-surface-soft)' }}>
                    
                        <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={
                      i < currentStep ?
                      { background: 'var(--a-green-2)', color: '#fff' } :
                      i === currentStep ?
                      { background: 'var(--a-blue-2)', color: '#fff' } :
                      { background: 'var(--a-line-strong)', color: 'var(--a-ink-soft)' }}>
                          {i < currentStep ? '✓' : i + 1}
                        </div>
                        <span
                      className="text-sm pt-0.5"
                      style={{ color: i === currentStep ? 'var(--a-blue-ink)' : 'var(--a-ink-soft)', fontWeight: i === currentStep ? 600 : 400 }}>
                          {step}
                        </span>
                      </motion.div>
                  )}
                  </div>
                </div>

                {/* Controls */}
                <div className="p-4 flex gap-3">
                  <motion.button
                  onClick={() => {
                    setSelectedExerciseId(null);
                    setCurrentStep(0);
                  }}
                  className="a-btn-soft flex-1"
                  style={{ justifyContent: 'center', height: 48 }}
                  whileTap={{ scale: 0.98 }}>
                  
                    {tr("common_back", "Geri")}
                  </motion.button>
                  <motion.button
                  onClick={handleComplete}
                  className="a-cta-btn flex-1"
                  style={{ justifyContent: 'center', height: 48, background: 'var(--a-green-2)' }}
                  whileTap={{ scale: 0.98 }}>
                  
                    <Check size={16} strokeWidth={2.2} />
                    {tr("exercises_bitirdim", "Bitirdim")}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </ToolPage>
    </div>);

});

Exercises.displayName = 'Exercises';

export default Exercises;
