import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Heart, Sparkles, AlertCircle, Plus, Calendar as CalendarIcon, Beaker, Pill, Droplet, Moon, Activity, Baby, Sparkle, Wind, CheckCircle2, XCircle, ArrowRight, TrendingUp, Flame, Apple, Dumbbell, Brain, CircleDot } from 'lucide-react';
import { getTranslatedTip } from '@/lib/tip-translations';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { usePhaseTips, PHASE_INFO, CATEGORY_INFO, MenstrualPhase, TipCategory } from '@/hooks/usePhaseTips';
import { format, differenceInDays, differenceInCalendarDays, eachDayOfInterval, parseISO, startOfDay } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { Calendar } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/components/ui/alert-dialog';
import FlowDailyLogger from './FlowDailyLogger';
import FlowMoodChart from './FlowMoodChart';
import FlowCycleStats from './FlowCycleStats';
import FlowRemindersCard from './FlowRemindersCard';
import FlowPeriodCalendar from './FlowPeriodCalendar';
import CycleTrendChart from './CycleTrendChart';
import CycleAnomalyBanner from './CycleAnomalyBanner';
import PeriodDelayBanner from './PeriodDelayBanner';
import PillReminderCard from './PillReminderCard';
import SymptomPatternReport from './SymptomPatternReport';
import DailyStoryCards from './DailyStoryCards';

import WaterWidget from '@/components/dashboard/WaterWidget';
import { getPhaseInfoForDate, getNextPeriodDate, getFertileWindow } from '@/lib/cycle-utils';
import { useCycleHistory } from '@/hooks/useCycleHistory';
import { computeAdaptiveCycleStats, refineOvulation } from '@/lib/cycle-predictions';
import { useFlowDailyLogs } from '@/hooks/useFlowDailyLogs';
import PremiumGate from '@/components/premium/PremiumGate';
import { usePeriodDayLogs, useRecordPeriodDays } from '@/hooks/usePeriodDayLogs';
import { hasPeriodFlow } from '@/lib/period-flow';
import UpcomingAppointments from '@/components/home/UpcomingAppointments';
const FlowDashboard = () => {
  const { getCycleData, cycleLength, periodLength, language } = useUserStore(
    useShallow((s) => ({ getCycleData: s.getCycleData, cycleLength: s.cycleLength, periodLength: s.periodLength, language: s.language }))
  );
  const cycleData = getCycleData();

  // Adaptiv proqnoz statistikası (cycle_history-dən öyrənir)
  const { data: cycleHistoryData = [] } = useCycleHistory();
  const adaptiveStats = computeAdaptiveCycleStats(cycleHistoryData, cycleLength || 28, periodLength || 5);

  const [selectedCategory, setSelectedCategory] = useState<TipCategory | 'all'>('all');
  const [showPeriodConfirm, setShowPeriodConfirm] = useState(false);
  const [showPeriodEndConfirm, setShowPeriodEndConfirm] = useState(false);
  const [markingPeriod, setMarkingPeriod] = useState(false);
  const [periodStartDates, setPeriodStartDates] = useState<Date[]>([new Date()]);
  const [periodEndDate, setPeriodEndDate] = useState<Date>(new Date());
  const recordPeriod = useRecordPeriodDays();
  const { data: periodDays = [] } = usePeriodDayLogs();

  const handleMarkPeriodStarted = async () => {
    setMarkingPeriod(true);
    try {
      await recordPeriod.mutateAsync({ dates: periodStartDates, flow: 'unspecified', preserveExisting: true });
      toast.success(tr('flow_days_saved', 'Period günləri qeyd edildi'), {
        description: tr('flow_selected_day_count', '{count} gün seçilib').replace('{count}', String(periodStartDates.length)),
      });
      setShowPeriodConfirm(false);
    } catch (error) {
      console.error('Error marking period:', error);
      toast.error(tr("flowdashboard_xeta_bas_verdi_yeniden_cehd_ed_816221", "X\u0259ta ba\u015F verdi, yenid\u0259n c\u0259hd edin"));
    } finally {
      setMarkingPeriod(false);
    }
  };

  const handleMarkPeriodEnded = async () => {
    setMarkingPeriod(true);
    try {
      if (!cycleData?.lastPeriodDate) return;
      const start = startOfDay(typeof cycleData.lastPeriodDate === 'string' ? parseISO(cycleData.lastPeriodDate) : new Date(cycleData.lastPeriodDate));
      const end = startOfDay(periodEndDate);
      const actualPeriodLength = differenceInCalendarDays(end, start) + 1;
      if (actualPeriodLength < 1 || actualPeriodLength > 90) throw new Error('INVALID_PERIOD_RANGE');
      await recordPeriod.mutateAsync({ dates: eachDayOfInterval({ start, end }), flow: 'unspecified', complete: true, preserveExisting: true });
      toast.success(tr('flowdashboard_period_bitisi_qeyd_edildi_7aef98', 'Period bitişi qeyd edildi! ✅'));
      setShowPeriodEndConfirm(false);
    } catch (error) {
      console.error('Error marking period end:', error);
      toast.error(tr("flowdashboard_xeta_bas_verdi_yeniden_cehd_ed_816221", "X\u0259ta ba\u015F verdi, yenid\u0259n c\u0259hd edin"));
    } finally {
      setMarkingPeriod(false);
    }
  };

  // Fetch upcoming labels from app_settings
  const { data: upcomingLabels } = useQuery({
    queryKey: ['flow-upcoming-labels'],
    queryFn: async () => {
      const { data } = await supabase.
      from('app_settings').
      select('key, value').
      in('key', ['flow_label_next_period', 'flow_label_fertile_window', 'flow_label_ovulation_day']);
      const labels: Record<string, string> = {};
      data?.forEach((item) => {
        const val = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        labels[item.key] = val.replace(/^"|"$/g, '');
      });
      return labels;
    },
    staleTime: 5 * 60 * 1000
  });

  const getDynamicLabel = (dbValue: string | undefined, defaultAz: string, trKey: string, defaultEn: string) => {
    if (language === 'en') {
      return defaultEn;
    }
    // Admin DB dəyəri AZ mətnidir — yalnız AZ dilində üstünlük verilir;
    // ru/tr-də tr() tərcüməsi işləsin (əvvəllər AZ mətni bütün dilləri üstələyirdi)
    if (language === 'az') {
      return dbValue || tr(trKey, defaultAz);
    }
    return tr(trKey, defaultAz);
  };

  const labelNextPeriod = getDynamicLabel(upcomingLabels?.flow_label_next_period, "Növbəti Period", "flowdashboard_novbeti_period_b29c4a", "Upcoming Period");
  const labelFertileWindow = getDynamicLabel(upcomingLabels?.flow_label_fertile_window, "Reproduktiv Dövr", "flowdashboard_reproduktiv_dovr_80642c", "Fertile Window");
  const labelOvulationDay = getDynamicLabel(upcomingLabels?.flow_label_ovulation_day, "Ovulyasiya Günü", "flowdashboard_ovulyasiya_gunu_811e84", "Ovulation Day");

  // Get last period date
  const lastPeriodDate = cycleData?.lastPeriodDate ?
  (typeof cycleData.lastPeriodDate === 'string' ? parseISO(cycleData.lastPeriodDate) : new Date(cycleData.lastPeriodDate)) :
  new Date();

  // Calculate current phase using accurate utility
  const today = new Date();
  const currentPhaseInfo = getPhaseInfoForDate(today, lastPeriodDate, cycleLength, periodLength);
  const todayPeriod = periodDays.find(log => log.log_date === format(today, 'yyyy-MM-dd'));
  const currentPhase: MenstrualPhase = todayPeriod && hasPeriodFlow(todayPeriod.flow_intensity) ? 'menstrual' : currentPhaseInfo.phase;
  const currentDay = currentPhaseInfo.dayInCycle;

  // Calculate next period and fertile window
  const nextPeriodDate = getNextPeriodDate(lastPeriodDate, cycleLength);
  const fertileWindowData = getFertileWindow(lastPeriodDate, cycleLength);

  // Flow P1: OPK testi + servikal maye ilə ovulyasiyanı dəqiqləşdir
  const { data: recentDailyLogs = [] } = useFlowDailyLogs();
  const refinedOvulation = refineOvulation(recentDailyLogs, lastPeriodDate, fertileWindowData.ovulationDate);
  const fertileStart = refinedOvulation.fertileWindowStart;
  const fertileEnd = refinedOvulation.fertileWindowEnd;

  // Fetch tips for current phase
  const { data: tips = [], isLoading: tipsLoading } = usePhaseTips(currentPhase);

  // Filter tips by category
  const filteredTips = selectedCategory === 'all' ?
  tips :
  tips.filter((t) => t.category === selectedCategory);

  // Calculate days until next period
  const daysUntilPeriod = differenceInDays(nextPeriodDate, new Date());

  // Get phase progress percentage
  const getPhaseProgress = () => {
    const phaseDays = {
      menstrual: periodLength,
      follicular: 8,
      ovulation: 3,
      luteal: 12
    };
    const phaseStart = {
      menstrual: 1,
      follicular: periodLength + 1,
      ovulation: 14,
      luteal: 17
    };
    const daysInPhase = currentDay - phaseStart[currentPhase] + 1;
    return Math.min(100, daysInPhase / phaseDays[currentPhase] * 100);
  };


  const categories: (TipCategory | 'all')[] = ['all', 'nutrition', 'exercise', 'selfcare', 'mood'];

  const categoryIcons: Record<string, any> = {
    all: Sparkles,
    nutrition: Apple,
    exercise: Dumbbell,
    selfcare: Heart,
    mood: Brain
  };

  return (
    <div>
      {/* NOT: <PartnerFlowStatusCard /> əvvəllər səhvən BURADA (qadının öz
      Flow Dashboard-ında) mount olunmuşdu - amma bu komponent
      usePartnerData()-nı çağıranda (yəni QADIN özü) linked_partner-i
      (ƏRİNİN profilini) qaytarır, onun life_stage-i HƏMİŞƏ 'partner'-dir,
      heç vaxt 'flow' olmur - komponentin öz keçidi (life_stage !== 'flow'
      = null qaytar) buna görə HEÇ VAXT keçilmirdi. Düzgün yeri partnyorun
      öz PartnerHomeScreen-idir (bax ora) - orada usePartnerData() əksinə,
      QADIN profilini qaytarır. */}

      {/* Period delay banner (auto-shows if late) */}
      <PeriodDelayBanner />

      {/* Daily Story Cards — phase-personalized */}
      <DailyStoryCards />

      {/* Currently — phase status card (anacan-demo PeriodStatus) */}
      <section className="a-section">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="a-card a-fade-in">
          
          <div className="a-card-head">
            <h3 className="a-card-title a-heading">{tr("flowdashboard_hal_hazirda_b78349", "Hal-hazırda")}</h3>
            <span
              className="a-tag"
              style={{
                cursor: 'default',
                border: 'none',
                background: `${PHASE_INFO[currentPhase].color}22`,
                color: PHASE_INFO[currentPhase].color,
                fontWeight: 700
              }}>
              
              {PHASE_INFO[currentPhase].emoji} {PHASE_INFO[currentPhase].labelAz}
            </span>
          </div>

          <div className="a-ring-hero">
            <div
              className="a-ring"
              style={{
                '--pct': Math.min(100, Math.round(currentDay / (cycleLength || 28) * 100)),
                background: `conic-gradient(${PHASE_INFO[currentPhase].color} calc(var(--pct) * 1%), var(--a-line) 0)`
              } as React.CSSProperties}>
              
              <div className="a-ring-inner">
                <b>{currentDay}</b>
                <span>{tr("flowdashboard_tsikl_gunu_b9e250", "Tsikl günü")}</span>
              </div>
            </div>
            <div className="a-trio" style={{ gridTemplateColumns: 'repeat(3, 1fr)', flex: 1, gap: 6 }}>
              <div className="a-trio-item" style={{ padding: '10px 4px', border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
                <p className="a-trio-value">{daysUntilPeriod > 0 ? daysUntilPeriod : 0}</p>
                <p className="a-trio-label">{tr("flowdashboard_gun_qaldi_993281", "gün qaldı")}</p>
              </div>
              <div className="a-trio-item" style={{ padding: '10px 4px', border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
                <p className="a-trio-value">{cycleLength}</p>
                <p className="a-trio-label">{tr("flowdashboard_gun_tsikl_bb0ab6", "gün tsikl")}</p>
              </div>
              <div className="a-trio-item" style={{ padding: '10px 4px', border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
                <p className="a-trio-value">{periodLength}</p>
                <p className="a-trio-label">{tr("flowdashboard_gun_period_957849", "gün period")}</p>
              </div>
            </div>
          </div>

          {/* Phase Progress */}
          <div className="a-inline-bar" style={{ marginTop: 16 }}>
            <motion.div
              className="a-inline-bar-fill"
              style={{ background: PHASE_INFO[currentPhase].color }}
              initial={{ width: 0 }}
              animate={{ width: `${getPhaseProgress()}%` }}
              transition={{ duration: 0.8 }} />
            
          </div>

          {/* Adaptiv proqnoz etibarı */}
          <div className="flex items-center gap-2 mt-3" style={{ padding: '9px 12px', borderRadius: 13, background: 'var(--a-surface-soft)' }}>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: adaptiveStats.confidence === 'high' ? '#63bd8b' :
                adaptiveStats.confidence === 'medium' ? '#ffc94d' :
                'var(--a-ink-faint)'
              }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--a-ink-soft)', lineHeight: 1.4 }}>
              {adaptiveStats.basedOnCycles >= 2 ?
              tr("flowdashboard_adaptiv_proqnoz", "Proqnoz son {n} tsiklə əsasən öyrənir · dəqiqlik ±{sd} gün").
              replace('{n}', String(adaptiveStats.basedOnCycles)).
              replace('{sd}', String(Math.max(1, Math.round(adaptiveStats.stdDev)))) :
              tr("flowdashboard_proqnoz_deqiqlesir", "Proqnoz dəqiqləşir — period günlərini qeyd etməyə davam edin 📈")}
            </p>
          </div>

          {/* Period Action Buttons */}
          <div className="mt-4 flex gap-2">
            <motion.button
              onClick={() => { setPeriodStartDates([new Date()]); setShowPeriodConfirm(true); }}
              className="a-cta-btn"
              style={{ flex: 1, justifyContent: 'center', background: 'var(--a-ink)', color: 'var(--a-bg)', height: 46 }}
              whileTap={{ scale: 0.97 }}>
              
              <CircleDot size={16} strokeWidth={2.2} />
              {tr('flow_record_days', 'Period günlərini qeyd et')}
            </motion.button>
            {currentPhase === 'menstrual' && cycleData?.lastPeriodDate &&
            <motion.button
              onClick={() => { setPeriodEndDate(new Date()); setShowPeriodEndConfirm(true); }}
              className="a-cta-btn"
              style={{ flex: 1, justifyContent: 'center', background: 'var(--a-grad-pink)', color: 'var(--a-alert-ink)', height: 46 }}
              whileTap={{ scale: 0.97 }}>
              
                {tr("flowdashboard_periodum_bitdi_c1b3ea", "✅ Periodum bitdi")}
              </motion.button>
            }
          </div>
        </motion.div>
      </section>

      {/* Interactive Period Calendar (Apple Health style) */}
      <div className="a-section">
        <FlowPeriodCalendar />
      </div>

      {/* Water Tracking Widget */}
      <div className="a-section">
        <WaterWidget variant="anacan" />
      </div>

      {/* Phase Tips Section (anacan-demo PhaseTips) */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("flowdashboard_bu_faza_ucun_meslehetler_14b952", "Bu Faza \xDC\xE7\xFCn M\u0259sl\u0259h\u0259tl\u0259r")}</h2>
          <span
            className="a-tag"
            style={{
              cursor: 'default',
              border: 'none',
              background: `${PHASE_INFO[currentPhase].color}22`,
              color: PHASE_INFO[currentPhase].color,
              fontWeight: 700
            }}>
            
            {PHASE_INFO[currentPhase].emoji} {PHASE_INFO[currentPhase].labelAz}
          </span>
        </div>

        {/* Category Filter */}
        <div className="a-tabs hide-scrollbar" style={{ display: 'flex', overflowX: 'auto', width: '100%', marginBottom: 14 }}>
          {categories.map((cat) => {
            const Icon = categoryIcons[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`a-tab${selectedCategory === cat ? ' active' : ''}`}
                style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                
                <Icon size={13} strokeWidth={2.2} />
                {cat === 'all' ? tr("flowdashboard_hamisi_c73c4d", "Ham\u0131s\u0131") : CATEGORY_INFO[cat].labelAz}
              </button>);

          })}
        </div>

        {/* Tips List */}
        {tipsLoading ?
        <div className="a-card" style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
            <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
          </div> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AnimatePresence mode="popLayout">
              {filteredTips.slice(0, 5).map((tip, index) =>
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="a-card">
              
                  <div className="a-list-row" style={{ padding: 0 }}>
                    <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 18 }}>
                      {tip.emoji}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p className="a-list-title">
                    {tip.title}
                      </p>
                      <span className="a-list-value" style={{ color: PHASE_INFO[currentPhase].color }}>
                        {CATEGORY_INFO[tip.category].labelAz}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--a-ink-soft)' }}>
                {tip.content}
                  </p>
                </motion.div>
            )}
            </AnimatePresence>

            {filteredTips.length === 0 &&
          <div className="a-card" style={{ textAlign: 'center', padding: '28px 18px' }}>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("flowdashboard_bu_kateqoriyada_meslehet_yoxdur_2e13ec", "Bu kateqoriyada məsləhət yoxdur")}</p>
              </div>
          }
          </div>
        }
      </section>

      {/* Upcoming Events (anacan-demo Upcoming list) */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("flowdashboard_qarsidan_gelenler_dc6614", "Qar\u015F\u0131dan G\u0259l\u0259nl\u0259r")}</h2>
        </div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="a-list-card a-fade-in">
          
          {/* Next Period */}
          <div className="a-list-row">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
              <Droplets size={17} strokeWidth={2} />
            </span>
            <div>
              <p className="a-list-title">{labelNextPeriod}</p>
              <p className="a-list-sub">{format(nextPeriodDate, 'd MMMM', { locale: getCurrentDateLocale() })}</p>
            </div>
            <span className="a-list-trail">
              <p className="a-list-value">
                {daysUntilPeriod > 0 ? tr("flowdashboard_x_gun_qaldi", "{days} gün qaldı").replace("{days}", String(daysUntilPeriod)) : tr("flowdashboard_bu_gun_786fd4", "Bu g\xFCn")}
              </p>
            </span>
          </div>

          {/* Fertile Window */}
          <div className="a-list-row">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
              <Heart size={17} strokeWidth={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="a-list-title">{labelFertileWindow}</p>
              <p className="a-list-sub">
                {format(fertileStart, 'd MMMM', { locale: getCurrentDateLocale() })} – {format(fertileEnd, 'd MMMM', { locale: getCurrentDateLocale() })}
              </p>
            </div>
            {refinedOvulation.confirmed &&
            <span className="a-list-trail">
                <span className="a-rank-tag" style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>
                  {refinedOvulation.source === 'mucus' ?
                tr("flowdashboard_maye_tesdiqli", "💧 Maye təsdiqli") :
                tr("flowdashboard_test_tesdiqli", "✓ Test təsdiqli")}
                </span>
              </span>
            }
          </div>

          {/* Ovulation */}
          <div className="a-list-row">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
              <Sparkles size={17} strokeWidth={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="a-list-title">{labelOvulationDay}</p>
              <p className="a-list-sub">
                {format(refinedOvulation.ovulationDate, 'd MMMM', { locale: getCurrentDateLocale() })}
              </p>
            </div>
            {refinedOvulation.confirmed &&
            <span className="a-list-trail">
                <span className="a-rank-tag" style={{ background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>
                  {refinedOvulation.source === 'opk_peak' ?
                tr("flowdashboard_pik_lh", "🌟 Pik LH") :
                refinedOvulation.source === 'opk_positive' ?
                tr("flowdashboard_lh_yukselisi", "➕ LH yüksəlişi") :
                tr("flowdashboard_maye_siqnali", "💧 Maye siqnalı")}
                </span>
              </span>
            }
          </div>
        </motion.div>
      </section>

      {/* Upcoming appointments: add / edit in a sheet, server push reminders */}
      <UpcomingAppointments />

      {/* Daily Logger — PREMIUM (freemium siyasəti) */}
      <motion.div
        className="a-section"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}>
        
        <PremiumGate
          title={tr("flowdailylogger_gundelik_qeyd_32e154", "Gündəlik Qeyd")}
          description={tr("pgate_flow_logger", "Əhval, simptom, qanaxma və fertillik qeydləri — proqnozlar bunlarla dəqiqləşir")}
          emoji="📝" feature="flow_daily_logger">
          <FlowDailyLogger compact />
        </PremiumGate>
      </motion.div>

      {/* Mood Chart — PREMIUM */}
      <motion.div
        className="a-section"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}>
        
        <PremiumGate
          title={tr("pgate_mood_chart_title", "Əhval qrafiki")}
          description={tr("pgate_mood_chart", "30 günlük əhval, enerji və ağrı analizi")}
          emoji="📊" feature="flow_mood_chart">
          <FlowMoodChart />
        </PremiumGate>
      </motion.div>

      {/* Cycle Stats — PREMIUM */}
      <motion.div
        className="a-section"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}>
        
        <PremiumGate
          title={tr("pgate_cycle_stats_title", "Tsikl statistikası")}
          description={tr("pgate_cycle_stats", "Tsikl tarixçəniz və dəqiqlik göstəriciləri")}
          emoji="📈" feature="flow_cycle_stats">
          <FlowCycleStats />
        </PremiumGate>
      </motion.div>

      {/* Cycle Trend Chart — PREMIUM · Anomaly banner FREE (xəbərdarlıq) */}
      <motion.div className="a-section" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.65 }}>
        <PremiumGate
          title={tr("pgate_trend_title", "Tsikl trendi")}
          description={tr("pgate_trend", "Son tsikllərin müqayisəli trend qrafiki")}
          emoji="📉" feature="flow_trend_chart">
          <CycleTrendChart />
        </PremiumGate>
      </motion.div>
      <CycleAnomalyBanner />

      {/* Symptom Pattern Analysis — PREMIUM */}
      <motion.div className="a-section" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.68 }}>
        <PremiumGate
          title={tr("pgate_symptom_title", "Simptom analizi")}
          description={tr("pgate_symptom", "Fazalara görə simptom nümunələriniz")}
          emoji="🧠" feature="flow_symptom_report">
          <SymptomPatternReport />
        </PremiumGate>
      </motion.div>

      {/* Pill + Reminders — PREMIUM (tək gate altında) */}
      <motion.div className="a-section" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
        <PremiumGate
          title={tr("pgate_reminders_title", "Xatırladıcılar")}
          description={tr("pgate_reminders", "Period, PMS, dərman və su xatırladıcıları")}
          emoji="🔔" feature="flow_reminders">
          <div className="space-y-3">
            <PillReminderCard />
            <FlowRemindersCard />
          </div>
        </PremiumGate>
      </motion.div>

      {/* Daily Insights (anacan-demo quick stats) */}
      <motion.div
        className="a-section a-grid-2"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}>
        
        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
            <Flame size={15} color="var(--a-peach-2)" />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("flowdashboard_enerji_seviyyesi_961691", "Enerji Səviyyəsi")}</p>
            <p className="a-stat-tile-value">
              {currentPhase === 'follicular' || currentPhase === 'ovulation' ? tr("flowdashboard_yuksek_492584", "Y\xFCks\u0259k") : tr("common_normal", "Normal")}
            </p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
            <Moon size={15} color="var(--a-peach-2)" />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("flowdashboard_tovsiye_edilen_yuxu_e219dd", "Tövsiyə Edilən Yuxu")}</p>
            <p className="a-stat-tile-value">
              {currentPhase === 'luteal' ? `8-9 ${tr("common_hours", 'saat')}` : `7-8 ${tr("common_hours", 'saat')}`}
            </p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
            <Apple size={15} color="var(--a-peach-2)" />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("untranslated_fokus_qida_lyi3h2", "Fokus Qida")}</p>
            <p className="a-stat-tile-value">
              {currentPhase === 'menstrual' ? tr("flowdashboard_demir_30bf6c", "D\u0259mir") : currentPhase === 'luteal' ? tr("flowdashboard_maqnezium_f7238a", "Maqnezium") : tr("flowdashboard_protein_a47bc2", "Protein")}
            </p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
            <Dumbbell size={15} color="var(--a-peach-2)" />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("flowdashboard_mesq_intensivliyi_f59d1b", "Məşq İntensivliyi")}</p>
            <p className="a-stat-tile-value">
              {currentPhase === 'menstrual' ? tr("flowdashboard_yungul_2a8010", "Y\xFCng\xFCl") : currentPhase === 'ovulation' ? tr("flowdashboard_intensiv_f123bc", "İntensiv") : tr("common_orta", "Orta")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Period Start Confirmation Dialog */}
      <AlertDialog open={showPeriodConfirm} onOpenChange={(open) => {
        setShowPeriodConfirm(open);
        if (open) setPeriodStartDates([new Date()]);
      }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('flow_record_days', 'Period günlərini qeyd et')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('flow_select_observed_days', 'Axın olan günləri seçin. Hər gün ayrıca qeyd olunur; gələcək günlər proqnoz olaraq qalır.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center py-2">
            <Calendar
              mode="multiple"
              selected={periodStartDates}
              onSelect={(dates) => setPeriodStartDates(dates ?? [])}
              disabled={(date) => date > new Date()}
              locale={getCurrentDateLocale()}
              className="rounded-xl border pointer-events-auto" />
            
          </div>
          <p className="text-sm text-center text-muted-foreground">
            {tr('flow_selected_day_count', '{count} gün seçilib').replace('{count}', String(periodStartDates.length))}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingPeriod}>{tr("flowdashboard_legv_et_b5e49c", "Ləğv et")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void handleMarkPeriodStarted(); }}
              disabled={markingPeriod || periodStartDates.length === 0}
              className="bg-red-500 hover:bg-red-600">
              
              {markingPeriod ? tr("untranslated_qeyd_edilir_df7cba", "Qeyd edilir...") : tr("flow_qeyd_et", 'Qeyd et')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Period End Confirmation Dialog */}
      <AlertDialog open={showPeriodEndConfirm} onOpenChange={(open) => {
        setShowPeriodEndConfirm(open);
        if (open) setPeriodEndDate(new Date());
      }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("flowdashboard_period_bitisi_d0fdcc", "✅ Period bitişi")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("flowdashboard_periodunuzun_bitdiyi_tarixi_se_aa37b7", "Periodunuzun bitdiyi tarixi seçin:")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center py-2">
            <Calendar
              mode="single"
              selected={periodEndDate}
              onSelect={(date) => date && setPeriodEndDate(date)}
              disabled={(date) => date > new Date() || (cycleData?.lastPeriodDate ? date < startOfDay(lastPeriodDate) : false)}
              locale={getCurrentDateLocale()}
              className="rounded-xl border pointer-events-auto" />
            
          </div>
          <p className="text-sm text-center text-muted-foreground">
            {tr("flowdashboard_secilen_tarix_104372", "Seçilən tarix:")} <strong>{format(periodEndDate, 'd MMMM yyyy', { locale: getCurrentDateLocale() })}</strong>
            {cycleData?.lastPeriodDate &&
            <> • Period: <strong>{differenceInCalendarDays(periodEndDate, lastPeriodDate) + 1} {tr("flowdashboard_gun_54e78d", "gün")}</strong></>
            }
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingPeriod}>{tr("flowdashboard_legv_et_b5e49c", "Ləğv et")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void handleMarkPeriodEnded(); }}
              disabled={markingPeriod}
              className="bg-green-600 hover:bg-green-700">
              
              {markingPeriod ? tr("untranslated_qeyd_edilir_df7cba", "Qeyd edilir...") : tr("flow_qeyd_et", 'Qeyd et')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

};

export default FlowDashboard;
