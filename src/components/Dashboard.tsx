import { useState, useEffect, useRef, useMemo } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import TrackerAIInsight, { useBabyInsight } from '@/components/baby/TrackerAIInsight';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Moon, Utensils, Activity, Plus, TrendingUp, Heart, Sparkles,
  Bell, ChevronRight, Flame, Target, Calendar, Zap, Sun, Cloud, Wind,
  ThermometerSun, Pill, Baby, Footprints, Scale, Clock, Star, Award,
  MessageCircle, Check, Lightbulb, BookOpen, PartyPopper, RefreshCw, ChevronUp, ChevronDown, FileText } from
'lucide-react';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useTimerStore } from '@/store/timerStore';
import { FRUIT_SIZES } from '@/types/anacan';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useBabyLogs } from '@/hooks/useBabyLogs';

import { useAuth } from '@/hooks/useAuth';
import { isCakesAvailable } from '@/lib/freemium';
import { useKickSessions } from '@/hooks/useKickSessions';
import { useWeightEntries } from '@/hooks/useWeightEntries';
import { useBabyMilestones } from '@/hooks/useBabyMilestones';
import { useAchievements } from '@/hooks/useAchievements';
import { useWeeklyTips } from '@/hooks/useDynamicContent';
import { usePregnancyContentByDay } from '@/hooks/usePregnancyContent';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useNotifications } from '@/hooks/useNotifications';
import { useFruitImages, getDynamicFruitData } from '@/hooks/useFruitData';
import { useTrimesterTips } from '@/hooks/useTrimesterTips';
import { useFlowSymptoms, useFlowPhaseTips, useFlowInsights } from '@/hooks/useFlowData';
import { useBabyIllustrationByMonth } from '@/hooks/useBabyMonthIllustrations';
import { useBabyDailyInfoByDay } from '@/hooks/useBabyDailyInfo';
import { useMommyDailyMessageByDay } from '@/hooks/useMommyDailyMessages';
import { useCurrentBabyCrisis, useUpcomingBabyCrises } from '@/hooks/useBabyCrisisPeriods';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useChildren } from '@/hooks/useChildren';
import { useSubscription } from '@/hooks/useSubscription';
import { usePregnancyDayNavigation } from '@/hooks/usePregnancyDayNavigation';
import { formatDateAz } from '@/lib/date-utils';
import { getPregnancyDay, getDaysUntilDue, getDaysElapsed, getPregnancyProgress, getTrimester } from '@/lib/pregnancy-utils';
import FeedingHistoryPanel from '@/components/baby/FeedingHistoryPanel';
import SleepHistoryPanel from '@/components/baby/SleepHistoryPanel';
import QuickStatsWidget from '@/components/mommy/QuickStatsWidget';
import PremiumBlurGate from '@/components/premium/PremiumBlurGate';
import AdFreePremiumOffer from '@/components/premium/AdFreePremiumOffer';
import GrowthTrackerWidget from '@/components/mommy/GrowthTrackerWidget';
import DevelopmentTipsWidget from '@/components/mommy/DevelopmentTipsWidget';
import PrematurityBackfillCard from '@/components/mommy/PrematurityBackfillCard';
import BabyCrisisWidget from '@/components/mommy/BabyCrisisWidget';
import ChildSelector from '@/components/mommy/ChildSelector';
import TeethingWidget from '@/components/mommy/TeethingWidget';
import BannerSlot from '@/components/banners/BannerSlot';
import { AdInlineAnchor } from '@/components/ads/AdExperienceProvider';
import { AptekHomeCard } from '@/components/aptek/AptekEntry';
import UpcomingAppointments from '@/components/home/UpcomingAppointments';
import DailySummaryAutoSync from '@/components/partner/DailySummaryAutoSync';
import PartnerCareCard from '@/components/partner/v2/PartnerCareCard';
import RedFlagBanner from '@/components/dashboard/RedFlagBanner';
import RecentBlogPosts from '@/components/dashboard/RecentBlogPosts';
import FlowDashboard from '@/components/flow/FlowDashboard';
import BirthOnboardingModal from '@/components/BirthOnboardingModal';
import WaterWidget from '@/components/dashboard/WaterWidget';
import { MommyPeriodBanner } from '@/components/mommy/MommyPeriodTracker';

// Fetus images by month
import FetusMonth1 from '@/assets/fetus/month-1.svg';
import FetusMonth2 from '@/assets/fetus/month-2.svg';
import FetusMonth3 from '@/assets/fetus/month-3.svg';
import FetusMonth4 from '@/assets/fetus/month-4.svg';
import FetusMonth5 from '@/assets/fetus/month-5.svg';
import FetusMonth6 from '@/assets/fetus/month-6.svg';
import FetusMonth7 from '@/assets/fetus/month-7.svg';
import FetusMonth8 from '@/assets/fetus/month-8.svg';
import FetusMonth9 from '@/assets/fetus/month-9.svg';
import { tr } from "@/lib/tr";
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useFetusIllustrationByMonth } from '@/hooks/useFetusIllustrations';

const FETUS_IMAGES: {[key: number]: string;} = {
  1: FetusMonth1,
  2: FetusMonth2,
  3: FetusMonth3,
  4: FetusMonth4,
  5: FetusMonth5,
  6: FetusMonth6,
  7: FetusMonth7,
  8: FetusMonth8,
  9: FetusMonth9
};

interface QuickActionProps {
  icon: any;
  label: string;
  color: string;
  value?: string;
  onClick?: () => void;
}

const QuickActionButton = ({ icon: Icon, label, color, value, onClick }: QuickActionProps) =>
<motion.button
  onClick={async () => {
    await hapticFeedback.light();
    onClick?.();
  }}
  className={`${color} p-3 rounded-xl flex flex-col items-center gap-1 shadow-card relative overflow-hidden`}
  whileHover={{ scale: 1.05, y: -2 }}
  whileTap={{ scale: 0.95 }}>
  
    <Icon className="w-5 h-5" />
    <span className="text-[10px] font-bold">{label}</span>
    {value &&
  <span className="absolute top-1.5 end-1.5 text-[9px] font-bold bg-white/30 px-1 py-0.5 rounded-full">
        {value}
      </span>
  }
  </motion.button>;


// Animated Progress Ring
const ProgressRing = ({ progress, size = 100, strokeWidth = 8, color = "stroke-primary"




}: {progress: number;size?: number;strokeWidth?: number;color?: string;}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress / 100 * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted" />
      
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={color}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ strokeDasharray: circumference }} />
      
    </svg>);

};

// FlowDashboard is now imported from @/components/flow/FlowDashboard


const BumpDashboard = ({ onNavigateToTool }: {onNavigateToTool?: (tool: string) => void;}) => {
  const { getPregnancyData, setLifeStage, language } = useUserStore(
    useShallow((s) => ({ getPregnancyData: s.getPregnancyData, setLifeStage: s.setLifeStage, language: s.language }))
  );
  const { toast } = useToast();
  const { profile } = useAuth();
  // Əkiz/üçüz və s. — hero başlığı və digər "körpəniz" mətnləri buna görə uyğunlaşır
  const isMultiple = !!(profile as any)?.multiples_type && (profile as any).multiples_type !== 'single';
  const pregData = getPregnancyData();
  const { todayLog, updateWaterIntake, updateMood } = useDailyLogs();
  const { getTodayStats, addSession } = useKickSessions();
  const { entries: weightEntries } = useWeightEntries();
  const { data: fruitImages = [] } = useFruitImages();
  const { isPremium } = useSubscription();

  // Birth onboarding modal state
  const [showBirthModal, setShowBirthModal] = useState(false);

  // Calculate actual current pregnancy day (1-280)
  const actualPregnancyDay = pregData?.lastPeriodDate ?
  getPregnancyDay(pregData.lastPeriodDate) :
  1;

  // Day hook — naviqasiya UI silinib, həmişə cari gün göstərilir
  const {
    selectedDay: pregnancyDay,
    selectedWeek,
    selectedDayInWeek,
    selectedTrimester,
    daysUntilDueFromSelected
  } = usePregnancyDayNavigation({
    lastPeriodDate: pregData?.lastPeriodDate || null,
    dueDate: pregData?.dueDate
  });

  // Fetch weekly tip from database based on selected week
  const { data: weeklyTips = [] } = useWeeklyTips(selectedWeek, 'bump');
  const currentWeekTip = weeklyTips[0];

  // Fetch dynamic pregnancy content by selected day
  const { data: dayContent } = usePregnancyContentByDay(pregnancyDay);

  // Fetch dynamic trimester tips from database based on selected trimester
  const { data: dynamicTrimesterTips = [] } = useTrimesterTips(selectedTrimester);

  const todayStats = getTodayStats();
  const kickCount = todayStats.totalKicks;
  const waterCount = todayLog?.water_intake || 0;
  const currentMood = todayLog?.mood || 0;

  // Calculate weight gain from first entry
  const latestWeight = weightEntries[0]?.weight;
  const firstWeight = weightEntries[weightEntries.length - 1]?.weight;
  const weightGain = latestWeight && firstWeight ? (latestWeight - firstWeight).toFixed(1) : '0';

  // Show "I gave birth" button from 3rd trimester (last 3 months, week 27+)
  const showBirthButton = pregData?.currentWeek ? pregData.currentWeek >= 27 : false;

  // Hooks must run before the early return below: when pregnancy data appeared
  // after a null render, React threw "Rendered more hooks" and blanked the screen.
  const fetusMonth = Math.min(Math.ceil(selectedWeek / 4.4), 9);
  const fetusImageFromDb = useFetusIllustrationByMonth(fetusMonth);

  if (!pregData) return null;

  // Trimester color scheme
  const getTrimesterColors = (trimester: number) => {
    switch (trimester) {
      case 1:
        return {
          bg: 'from-green-500/10 via-green-400/5 to-green-500/10 dark:from-green-500/20 dark:via-green-400/10 dark:to-green-500/20',
          border: 'border-green-500/20',
          accent: 'bg-green-500/10 dark:bg-green-500/20',
          text: 'text-green-600 dark:text-green-400',
          badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
          progress: 'bg-green-500',
          icon: 'text-green-600 dark:text-green-400'
        };
      case 2:
        return {
          bg: 'from-amber-500/10 via-amber-400/5 to-amber-500/10 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-amber-500/20',
          border: 'border-amber-500/20',
          accent: 'bg-amber-500/10 dark:bg-amber-500/20',
          text: 'text-amber-600 dark:text-amber-400',
          badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          progress: 'bg-amber-500',
          icon: 'text-amber-600 dark:text-amber-400'
        };
      case 3:
      default:
        return {
          bg: 'from-primary/10 via-primary/5 to-primary/10 dark:from-primary/20 dark:via-primary/10 dark:to-primary/20',
          border: 'border-primary/20',
          accent: 'bg-primary/10 dark:bg-primary/20',
          text: 'text-primary',
          badge: 'bg-primary/10 text-primary',
          progress: 'bg-primary',
          icon: 'text-primary'
        };
    }
  };

  // Use selected trimester for colors (based on navigated day)
  const trimesterColors = getTrimesterColors(selectedTrimester);

  // Trimester info for display
  const getTrimesterInfo = (trimester: number) => {
    switch (trimester) {
      case 1:
        return { title: tr("dashboard_1_ci_trimester_tovsiyeleri_0a4c84", '1-ci Trimester Tövsiyələri'), emoji: '🌱' };
      case 2:
        return { title: tr("dashboard_2_ci_trimester_tovsiyeleri_16e100", '2-ci Trimester Tövsiyələri'), emoji: '🌸' };
      case 3:
      default:
        return { title: tr("dashboard_3_cu_trimester_tovsiyeleri_93f711", '3-cü Trimester Tövsiyələri'), emoji: '🍼' };
    }
  };

  const trimesterInfo = getTrimesterInfo(selectedTrimester);

  // Get mood emoji
  const getMoodEmoji = (mood: number) => {
    if (mood >= 4) return '😊';
    if (mood >= 3) return '🙂';
    if (mood >= 2) return '😐';
    if (mood >= 1) return '😔';
    return '❓';
  };

  // Get fruit data from unified hook - priority: pregnancy_daily_content > fruit_size_images > static
  const getFruitData = () => {
    return getDynamicFruitData(
      fruitImages,
      pregnancyDay,
      selectedWeek,
      dayContent
    );
  };

  const weekData = getFruitData();

  // Fetus şəkli: bazadan (admin paneldən idarə olunur, tətbiq
  // yeniləmədən dəyişir). Bazada yoxdursa daxili SVG fallback işləyir.
  const fetusImageSrc = fetusImageFromDb || FETUS_IMAGES[fetusMonth] || FETUS_IMAGES[1];

  // For progress bar and development milestones, use actual current day
  const daysLeft = daysUntilDueFromSelected;
  const totalDays = 280;
  const daysElapsed = pregnancyDay;
  const progressPercent = pregnancyDay / totalDays * 100;

  // Dynamic baby message from database
  const babyMessage = dayContent?.baby_message || tr("dashboard_salam_ana_bu_gun_cox_boyudum_4e9d53", "Salam ana! Bu g\xFCn \xE7ox b\xF6y\xFCd\xFCm. \uD83D\uDC95");

  // Development milestones based on selected week
  const weeklyDevelopment = {
    eyes: selectedWeek >= 8,
    ears: selectedWeek >= 16,
    fingers: selectedWeek >= 10,
    kicks: selectedWeek >= 18,
    hair: selectedWeek >= 22
  };

  const addKick = async () => {
    await hapticFeedback.medium();
    // Add a quick single-kick session for tracking
    await addSession(1, 0);
    toast({
      title: tr("dashboard_tepik_qeyd_edildi_284f06", "Təpik qeyd edildi! 👶"),
      description: `${tr("dashboard_today", "Bu gün")} ${kickCount + 1} ${tr("dashboard_kick", "təpik")}`
    });
  };

  const addWater = async () => {
    await hapticFeedback.light();
    await updateWaterIntake(1);
    toast({
      title: tr("dashboard_su_elave_edildi_7b894d", "Su əlavə edildi! 💧"),
      description: `${waterCount + 1}/8 ${tr("dashboard_glasses", "stəkan")}`
    });
  };

  return (
    <div>
      {/* Qırmızı bayraq: bu günkü BP ≥140/90 → avtomatik xəbərdarlıq */}
      <RedFlagBanner onOpenTool={onNavigateToTool} />

      {/* Editorial hero (anacan-demo pregnancy design) —
          gün naviqatoru silinib: həmişə cari gün göstərilir */}
      <section className="a-hero-min a-hero-compact a-fade-in">
        <p className="a-hero-eyebrow">
          {selectedWeek}{tr("dashboard_hefte_5af01f", ". h\u0259ft\u0259,")} <strong>{selectedDayInWeek}{tr("dashboard_gun_a4ba4e", ". g\xFCn \u2022")}</strong> {selectedTrimester === 1 ? tr("dashboard_1_trimester", "1-ci Trimester") :
          selectedTrimester === 2 ? tr("dashboard_2_trimester", "2-ci Trimester") :
          tr("dashboard_3_trimester", "3-cü Trimester")}
        </p>

        {/* Fetus illustration with heart badge */}
        <div className="a-egg-wrap" style={{ width: 128, margin: '4px auto 8px' }}>
          <span className="a-egg-heart">
            <span style={{ fontSize: 13 }}>💗</span>
          </span>
          {/* Üzmə hərəkəti CSS-dədir (compositor) — framer-in sonsuz JS döngüsü əvəzinə */}
          <div className="a-float">
          <motion.img
            src={fetusImageSrc}
            onError={(event) => {
              const fallback = FETUS_IMAGES[fetusMonth] || FETUS_IMAGES[1];
              if (event.currentTarget.src !== new URL(fallback, window.location.href).href) {
                event.currentTarget.src = fallback;
              }
            }}
            alt={`${selectedWeek} ${tr("dashboard_week_baby", "həftəlik körpə")}`}
            style={{ width: 128, height: 128, objectFit: 'contain', filter: 'drop-shadow(0 14px 18px rgba(217, 108, 74, 0.3))' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              scale: { delay: 0.2, type: "spring" },
              opacity: { delay: 0.2 }
            }} />
          </div>
          
        </div>

        <h1 className="a-hero-headline a-heading">
          {(() => {
            // Tək körpədə "mən danışıram" (1-ci şəxs) səsi təbiidir; əkiz/üçüzdə
            // isə hər körpə fərqli ölçüdə ola bilər — ona görə fərqli, ana-yönümlü
            // (2-ci şəxs cəm) şablona keçirik ki, "mən alma boydayam" kimi TƏK
            // körpə iddiası yaranmasın.
            const tpl = isMultiple ?
            tr("dashboard_hero_fruit_tpl_multiple", "Körpələriniz təxminən {fruit} boydadır") :
            tr("dashboard_hero_fruit_tpl", "Anacan, hazırda {fruit} boydayam");
            const [before, after] = tpl.split('{fruit}');
            return <>{before}<em>{weekData.fruit}</em>{after ?? ''}</>;
          })()}
        </h1>

        <div className="a-tag-row" style={{ justifyContent: 'center', marginTop: 12, marginBottom: 0 }}>
          <span className="a-tag" style={{ cursor: 'default' }}>{pregnancyDay}{tr("dashboard_gun_d96b5d", ". g\xFCn")}</span>
          <span className="a-tag" style={{ cursor: 'default' }}>{weekData.lengthCm} {tr("dashboard_sm", "sm")}</span>
          <span className="a-tag" style={{ cursor: 'default' }}>{weekData.weightG} {tr("dashboard_qr", "qr")}</span>
          <span className="a-tag" style={{ cursor: 'default' }}>{daysLeft} {tr("dashboard_gun_qaldi_993281", "g\xFCn qald\u0131")}</span>
        </div>

        {/* Progress Bar */}
        <div className="a-pbar">
          <div className="a-pbar-track">
            <motion.div
              className="a-pbar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, delay: 0.3 }} />
            
            <span className="a-pbar-pct" style={{ insetInlineStart: `${Math.min(94, Math.max(6, progressPercent))}%` }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="a-pbar-labels">
            <span>{tr("dashboard_baslangic_e9d2d5", "Başlanğıc")}</span>
            <span>{tr("dashboard_dogus_6b7bfd", "Doğuş")}</span>
          </div>
        </div>
      </section>

      {/* Daily messages come straight after the hero; the days-left / weight trio was removed (days left is in the hero chips). */}
      {/* Daily Content Cards - Separated */}
      {dayContent &&
      <>
          {/* Baby Message Card — CTA banner with organic shapes */}
          {dayContent.baby_message &&
        <section className="a-section">
            <motion.div
            className="a-cta a-fade-in"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}>
            
              <span className="a-cta-shape" style={{ width: 140, height: 140, top: -50, insetInlineEnd: -40 }} />
              <span className="a-cta-shape" style={{ width: 90, height: 90, bottom: -30, insetInlineStart: -20 }} />
              <div className="a-cta-top">
                <span className="a-cta-badge">
                  {tr("dashboard_gun_18b2f4", "G\xFCn")} {pregnancyDay} / 280 · {tr("dashboard_korpeden_mesaj_89353a", "Körpədən Mesaj")}
                </span>
                <span className="a-cta-deco">
                  <Baby size={18} strokeWidth={2} />
                </span>
              </div>
              <p className="a-cta-text" style={{ position: 'relative', marginTop: 14, fontSize: 13.5, fontWeight: 500, color: 'var(--a-ink-soft)', lineHeight: 1.65 }}>
                {dayContent.baby_message}
              </p>
            </motion.div>
          </section>
        }

          {/* Body Changes Card */}
          {dayContent.body_changes &&
        <section className="a-section">
            <motion.div
            className="a-card a-fade-in"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}>
            
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading" style={{ fontSize: 15 }}>
                  🤰 {tr("dashboard_bedendeki_deyisiklikler_7a5c81", "Bədəndəki Dəyişikliklər")}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                {dayContent.body_changes}
              </p>
            </motion.div>
          </section>
        }

          {/* Baby Development Card */}
          {dayContent.baby_development &&
        <section className="a-section">
            <motion.div
            className="a-card a-fade-in"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}>
            
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading" style={{ fontSize: 15 }}>
                  🌱 {tr("dashboard_korpenin_inkisafi_485a30", "Körpənin İnkişafı")}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                {dayContent.baby_development}
              </p>
            </motion.div>
          </section>
        }

          {/* Əkiz/çoxdöllü hamiləliyə xas məsləhət — YALNIZ isMultiple=true olanlara,
              yalnız məzmun mövcud olan günlərdə (bax Duzelis29/32.sql). applyLanguage()
              (usePregnancyContent.ts) UI dilinə uyğun multiples_tip_{lang} dəyərini
              artıq multiples_tip sahəsinə köçürüb — burda UI dilindən asılı deyil. */}
          {isMultiple && (dayContent as any).multiples_tip &&
        <section className="a-section">
            <motion.div
            className="a-card a-fade-in"
            style={{ background: 'var(--a-blue-1)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.42 }}>
            
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading" style={{ fontSize: 15 }}>
                  👶👶 {tr("dashboard_ekiz_hameleliyiniz_ucun", "Əkiz Hamiləliyiniz üçün")}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                {(dayContent as any).multiples_tip}
              </p>
            </motion.div>
          </section>
        }

          {/* Daily Tip Card */}
          {dayContent.daily_tip &&
        <section className="a-section">
            <motion.div
            className="a-card a-fade-in"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}>
            
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading" style={{ fontSize: 15 }}>
                  💡 {tr("dashboard_gunun_tovsiyesi_b3a563", "Günün Tövsiyəsi")}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                {dayContent.daily_tip}
              </p>
            </motion.div>
          </section>
        }
        </>
      }

      {/* Calendar after the daily messages (bump) */}
      <UpcomingAppointments />

      {/* Baby Development - Static Icons */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("dashboard_korpenin_inkisafi_269d83", "Körpənin inkişafı")}</h2>
        </div>
        <div className="a-trio" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {[
          { icon: '👀', label: tr("dashboard_goz_fbc05e", 'Göz'), active: weeklyDevelopment.eyes },
          { icon: '👂', label: tr("dashboard_qulaq_93ab", 'Qulaq'), active: weeklyDevelopment.ears },
          { icon: '✋', label: tr("dashboard_barmaq_18bc", 'Barmaq'), active: weeklyDevelopment.fingers },
          { icon: '🦶', label: tr("dashboard_tepik_9a873a", 'Təpik'), active: weeklyDevelopment.kicks },
          { icon: '💇', label: tr("dashboard_sac_a09eaa", 'Saç'), active: weeklyDevelopment.hair }].
          map((item, index) =>
          <motion.div
            key={item.label}
            className="a-trio-item"
            style={{ padding: '12px 2px', minWidth: 0, opacity: item.active ? 1 : 0.65, cursor: 'default' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + index * 0.08 }}>
            
              <span className="a-trio-icon" aria-hidden="true" style={{
                background: item.active ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
                width: 32, height: 36, fontSize: 22, fontWeight: 400, lineHeight: 1,
                fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
              }}>
                {item.icon}
              </span>
              <p className="a-trio-label" style={{ overflowWrap: 'anywhere', ...(item.active ? { color: 'var(--a-ink)' } : {}) }}>
                {item.label}
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Trimester Tips Section */}
      {dynamicTrimesterTips.length > 0 &&
      <section className="a-section">
          <div className="a-section-head" style={{ justifyContent: 'center' }}>
            <h2 className="a-section-title a-heading" style={{ textAlign: 'center' }}>
              {trimesterInfo.emoji} {trimesterInfo.title} {trimesterInfo.emoji}
            </h2>
          </div>
          <div className="a-list-card a-list-compact a-fade-in">
            {dynamicTrimesterTips.map((tip, index) =>
          <motion.div
            key={tip.id}
            className="a-list-row"
            initial={{ x: document.documentElement.dir === 'rtl' ? 20 : -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + index * 0.05 }}>
            
                <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 17 }}>{tip.icon}</span>
                <p className="a-list-title" style={{ fontWeight: 600, whiteSpace: 'normal', lineHeight: 1.5 }}>{tip.tip_text}</p>
              </motion.div>
          )}
          </div>
        </section>
      }

      {/* Weekly Tip from Database */}
      {currentWeekTip &&
      <section className="a-section">
          <motion.div
          className="a-card a-fade-in"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}>
          
            <div className="a-today-info-head" style={{ marginBottom: 10 }}>
              <span className="a-today-info-icon" style={{ width: 38, height: 38, borderRadius: 12 }}>
                <Lightbulb size={17} strokeWidth={2} />
              </span>
              <div>
                <p className="a-today-info-eyebrow">{tr("dashboard_hefte_3aa886", "H\u0259ft\u0259")} {selectedWeek} {tr("dashboard_tovsiyesi_6412b4", "T\xF6vsiy\u0259si")}</p>
                <p className="a-today-info-meta">{currentWeekTip.title}</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>{currentWeekTip.content}</p>
          </motion.div>
        </section>
      }

      {/* Water + quick logs (anacan-demo QuickLog) */}
      <section className="a-section">
        <motion.div
          className="a-card a-fade-in"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55 }}>
          
          <div className="a-list-row" style={{ padding: '2px 0 16px', borderTop: 'none' }}>
            <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
              <Droplets size={17} strokeWidth={2} />
            </span>
            <div>
              <p className="a-list-title">{tr("common_su_water", "Su")}</p>
              <p className="a-list-sub">
                {waterCount} / 10 {tr('waterwidget_glass_unit', 'stəkan')} · {tr('dashboard_today_label', 'Bu gün')}
              </p>
            </div>
            <button
              type="button"
              className="a-list-trail"
              aria-label={tr("dashboard_su_elave_edildi_7b894d", "Su əlavə edildi! 💧")}
              onClick={addWater}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--a-ink)',
                color: 'var(--a-bg)',
                border: 'none',
                cursor: 'pointer'
              }}>
              
              <Plus size={16} strokeWidth={2.6} />
            </button>
          </div>

          <div className="a-trio">
            <motion.button
              className="a-trio-item"
              style={{ boxShadow: 'none', background: 'var(--a-surface-soft)' }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (onNavigateToTool) onNavigateToTool('vitamin-tracker');
              }}>
              
              <span className="a-trio-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
                <Pill size={17} strokeWidth={2} />
              </span>
              <p className="a-trio-label">{tr("dashboard_vitamin_8331ee", "Vitamin")}</p>
            </motion.button>
            <motion.button
              className="a-trio-item"
              style={{ boxShadow: 'none', background: 'var(--a-surface-soft)' }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (onNavigateToTool) onNavigateToTool('safety');
              }}>
              
              <span className="a-trio-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
                <Activity size={17} strokeWidth={2} />
              </span>
              <p className="a-trio-label">{tr("dashboard_mesq_046a80", "Məşq")}</p>
            </motion.button>
            <motion.button
              className="a-trio-item"
              style={{ boxShadow: 'none', background: 'var(--a-surface-soft)' }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (onNavigateToTool) onNavigateToTool('mood-diary');
              }}>
              
              <span className="a-trio-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)', fontSize: 17 }}>
                {currentMood ? getMoodEmoji(currentMood) : <Heart size={17} strokeWidth={2} />}
              </span>
              <p className="a-trio-label">{tr("dashboard_ehval_0457f9", "Əhval")}</p>
            </motion.button>
          </div>
        </motion.div>
      </section>


      {/* Anacan Aptek: pregnancy offer or store banner (hidden while the store is off) */}
      <AptekHomeCard stage="bump" />

      {/* "I Gave Birth" Button - Shown from week 27+ */}
      {showBirthButton &&
      <section className="a-section">
          <motion.button
          onClick={() => setShowBirthModal(true)}
          className="a-cta a-fade-in"
          style={{ width: '100%', textAlign: 'start', cursor: 'pointer' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.98 }}>
          
            <span className="a-cta-shape" style={{ width: 140, height: 140, top: -50, insetInlineEnd: -40, background: 'var(--a-pink-1)' }} />
            <span className="a-cta-shape" style={{ width: 90, height: 90, bottom: -30, insetInlineStart: -20, background: 'var(--a-pink-1)' }} />
            <div className="a-cta-top">
              <span className="a-cta-badge" style={{ background: 'var(--a-pink-1)', color: 'var(--a-berry-ink)' }}>
                {tr("dashboard_hefte_3aa886", "H\u0259ft\u0259")} {selectedWeek} 🎉
              </span>
              <span className="a-cta-deco" style={{ background: 'var(--a-pink-1)', color: 'var(--a-berry-ink)' }}>
                <PartyPopper size={18} strokeWidth={2} />
              </span>
            </div>
            <h2 className="a-cta-title a-heading">{tr("dashboard_dogum_etdim_e3eca9", "Doğum etdim! 🎉")}</h2>
            <p className="a-cta-text">{tr("dashboard_analiq_seyahetinize_baslayin_b03582", "Analıq səyahətinizə başlayın")}</p>
            <span className="a-cta-btn" style={{ marginTop: 16, background: 'var(--a-pink-2)' }}>
              {tr("dashboard_dogum_etdim_e3eca9", "Doğum etdim! 🎉").replace(' 🎉', '')} <ChevronRight className="rtl:rotate-180" size={14} />
            </span>
          </motion.button>
        </section>
      }

      {/* Birth Onboarding Modal */}
      <BirthOnboardingModal
        isOpen={showBirthModal}
        onClose={() => setShowBirthModal(false)}
        onComplete={() => {
          setShowBirthModal(false);
          window.location.reload();
        }} />
      
    </div>);

};




























const getBabyFunFacts = (): string[] => [
  tr('baby_fun_fact_1', 'Körpəniz hər gün yeni şeylər öyrənir!'),
  tr('baby_fun_fact_2', 'Sevgi və qulluq beynin sağlam inkişafına kömək edir.'),
  tr('baby_fun_fact_3', 'Körpələr ana səsini doğumdan əvvəl tanıyır.'),
];

const getBabyDailyFunFact = (ageInDays: number): string => {
  const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const facts = getBabyFunFacts();
  const factIndex = (ageInDays + dayOfYear) % facts.length;
  return facts[factIndex];
};

const formatTimerDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Aktiv taymerin saniyəlik sayğacı öz komponentindədir: əvvəllər bütün MommyDashboard
// (2000+ sətir) taymer işlədikcə — bəzən bütün gecə — hər saniyə yenidən render olunurdu.
const ElapsedTime = ({ id }: { id: string }) => {
  const getElapsedSeconds = useTimerStore(state => state.getElapsedSeconds);
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{formatTimerDuration(getElapsedSeconds(id))}</>;
};

const MommyDashboard = ({ onNavigateToTool, onNavigate }: {onNavigateToTool?: (tool: string) => void;onNavigate?: (screen: string) => void;}) => {
  const { toast } = useToast();
  const language = useUserStore((s) => s.language);
  const { profile: mommyProfile } = useAuth();
  const { isMilestoneAchieved, toggleMilestone, getMilestoneDate, MILESTONES } = useBabyMilestones();
  const { unlockAchievement, getTotalPoints } = useAchievements();
  const { activeTimers, startTimer, stopTimer, getActiveTimer } = useTimerStore();
  const { todayLogs, addLog, getTodayStats, refetch } = useBabyLogs();
  const { isToolDisabled } = useDisabledTools();

  const { children, selectedChild, hasChildren, hasMultipleChildren, getChildAge, refetch: refetchChildren } = useChildren();

  // Derive baby data from selectedChild for multi-child support
  const childAge = selectedChild ? getChildAge(selectedChild) : null;
  const babyData = selectedChild && childAge ? {
    id: selectedChild.id,
    name: selectedChild.name,
    birthDate: new Date(selectedChild.birth_date),
    gender: selectedChild.gender as 'boy' | 'girl',
    ageInDays: childAge.days,
    dayNumber: childAge.dayNumber,
    ageInMonths: childAge.months,
    ageRemainingDays: childAge.remainingDays
  } : null;

  // PREMATURE DƏSTƏYİ: inkişaf məzmunu (illüstrasiya, günlük məlumat, ana
  // mesajı) korreksiya olunmuş yaşla seçilir — premature deyilsə correctedDays/
  // correctedMonths xronoloji ilə eynidir, heç nə dəyişmir.
  const babyAgeMonths = (childAge?.correctionApplied ? childAge.correctedMonths : childAge?.months) || 1;
  const contentDay = childAge ? (childAge.correctionApplied ? childAge.correctedDayNumber : childAge.dayNumber) : 0;
  const { imageUrl: babyIllustration, title: illustrationTitle, description: illustrationDescription } = useBabyIllustrationByMonth(Math.max(1, Math.min(36, babyAgeMonths)));
  const { data: dailyInfo } = useBabyDailyInfoByDay(contentDay > 0 ? contentDay : null);
  const { data: mommyMessage } = useMommyDailyMessageByDay(contentDay > 0 ? contentDay : null);

  // Current time for timer display
  const [, setTick] = useState(0);

  // Milestone carousel state
  const [milestonePageIndex, setMilestonePageIndex] = useState(0);

  // Get today's stats from database
  const todayStats = getTodayStats();

  // Each tracker is analyzed only when its own button is pressed.
  const aiInsightStats = useMemo(() => ({
    sleepMinutes: todayStats.sleepMinutes || Math.round((todayStats.sleepHours || 0) * 60),
    sleepCount: todayStats.sleepLogs.length,
    feedingCount: todayStats.feedingCount,
    breastCount: todayStats.breastFeedingCount,
    formulaCount: todayStats.formulaCount,
    formulaMl: todayStats.feedingLogs.reduce((sum, l) => {
      if (l.feed_type !== 'formula') return sum;
      const ml = (l as any).amount_ml ?? parseInt(String(l.notes || '').match(/(\d+)\s*ml/i)?.[1] || '0', 10);
      return sum + (Number.isFinite(ml) ? Number(ml) : 0);
    }, 0),
    solidCount: todayStats.solidCount,
    diaperCount: todayStats.diaperCount,
    wetCount: todayStats.wetCount,
    dirtyCount: todayStats.dirtyCount,
    mixedCount: todayStats.bothCount,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [todayLogs]);
  const insightApi = useBabyInsight(
    babyData ? aiInsightStats : null,
    babyData ? { id: babyData.id, ageMonths: babyData.ageInMonths, ageDays: babyData.ageInDays, gender: babyData.gender } : null
  );

  // Əkiz/üçüzlərdə hər körpənin MÜSTƏQİL taymeri olsun deyə — seçilmiş uşağın id-si
  // taymer sorğularına ötürülür (əvvəllər qlobal idi, uşaq dəyişəndə data qarışırdı)
  const selectedChildId = selectedChild?.id;
  // UI-də uşaq adı yalnız BİRDƏN ÇOX uşaq olanda göstərilir (tək uşaqlı ailələrdə əlavə söz olmasın)
  const timerChildName = hasMultipleChildren ? selectedChild?.name : undefined;

  // Sleep tracking
  const sleepTimer = getActiveTimer('sleep', undefined, selectedChildId);

  // Feeding tracking with live timer
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [showFormulaMLInput, setShowFormulaMLInput] = useState(false);
  const [formulaML, setFormulaML] = useState('');
  const formulaMLPresets = [30, 60, 90, 120, 150, 180];
  const [showSolidFoodInput, setShowSolidFoodInput] = useState(false);
  const [solidFoodName, setSolidFoodName] = useState('');
  const leftFeedTimer = getActiveTimer('feeding', 'left', selectedChildId);
  const rightFeedTimer = getActiveTimer('feeding', 'right', selectedChildId);

  // Diaper tracking
  const [showDiaperModal, setShowDiaperModal] = useState(false);
  const feedingSummaryRef = useRef<HTMLDivElement>(null);
  const [sleepExpanded, setSleepExpanded] = useState(false);

  // Nisbi "x dəq əvvəl" mətnləri üçün dəqiqəlik yeniləmə. Saniyəlik taymer mətni
  // <ElapsedTime> içində yenilənir ki, bütün dashboard hər saniyə render olunmasın.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Use all dynamic milestones from hook - with carousel if > 5
  const allMilestones = MILESTONES.map((m) => ({
    ...m,
    achieved: isMilestoneAchieved(m.id),
    achievedDate: getMilestoneDate(m.id)
  }));

  // Paginate milestones (5 per page)
  const milestonesPerPage = 5;
  const totalMilestonePages = Math.ceil(allMilestones.length / milestonesPerPage);

  const getInitialMilestonePage = () => {
    for (let page = 0; page < totalMilestonePages; page++) {
      const pageItems = allMilestones.slice(page * milestonesPerPage, (page + 1) * milestonesPerPage);
      if (pageItems.some((m) => !m.achieved)) return page;
    }
    return 0;
  };

  // Auto-advance when all on current page are completed
  useEffect(() => {
    const currentPageItems = allMilestones.slice(
      milestonePageIndex * milestonesPerPage,
      (milestonePageIndex + 1) * milestonesPerPage
    );
    const allCompleted = currentPageItems.length > 0 && currentPageItems.every((m) => m.achieved);
    if (allCompleted && milestonePageIndex < totalMilestonePages - 1) {
      setMilestonePageIndex(milestonePageIndex + 1);
    }
  }, [allMilestones.map((m) => m.achieved).join(',')]);

  // Set initial page on mount
  useEffect(() => {
    setMilestonePageIndex(getInitialMilestonePage());
  }, []);

  // Show setup prompt if baby data is missing
  if (!babyData) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[200px]">
        <p className="text-muted-foreground text-sm animate-pulse">{tr("dashboard_yuklenir_5557de", "Yüklənir...")}</p>
      </div>);

  }

  const displayMilestones = allMilestones.slice(
    milestonePageIndex * milestonesPerPage,
    (milestonePageIndex + 1) * milestonesPerPage
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleSleep = async () => {
    await hapticFeedback.medium();
    if (sleepTimer) {
      // End sleep - save to database
      const result = stopTimer(sleepTimer.id);
      if (result) {
        await addLog({
          log_type: 'sleep',
          start_time: new Date(Date.now() - result.durationSeconds * 1000).toISOString(),
          end_time: new Date().toISOString()
        });
        toast({ title: tr("dashboard_sleep_ended", "Yuxu bitdi! ☀️"), description: `${formatDuration(result.durationSeconds)} ${tr("dashboard_slept", "yatdı")}` });
      }
    } else {
      // Start sleep
      startTimer('sleep', undefined, undefined, selectedChildId, timerChildName);
      toast({ title: tr("dashboard_yuxu_basladi_b503f7", "Yuxu başladı! 😴"), description: tr("dashboard_bitirmek_ucun_yeniden_basin_37b592", "Bitirmək üçün yenidən basın") });
    }
  };

  const toggleFeeding = async (type: 'left' | 'right') => {
    await hapticFeedback.medium();
    const activeTimer = type === 'left' ? leftFeedTimer : rightFeedTimer;

    if (activeTimer) {
      // Stop feeding - save to database
      const result = stopTimer(activeTimer.id);
      if (result) {
        await addLog({
          log_type: 'feeding',
          feed_type: type === 'left' ? 'breast_left' : 'breast_right',
          start_time: new Date(Date.now() - result.durationSeconds * 1000).toISOString(),
          end_time: new Date().toISOString()
        });
        toast({
          title: type === 'left' ? tr("dashboard_left_breast_done", "Sol sinə bitti!") : tr("dashboard_right_breast_done", "Sağ sinə bitti!"),
          description: `${tr("dashboard_duration", "Müddət:")} ${formatDuration(result.durationSeconds)}`
        });

        // Check for achievement
        if (todayStats.feedingCount >= 9) {
          unlockAchievement('feeding_pro', 'mommy');
        }
      }
    } else {
      // Start feeding
      startTimer('feeding', type, undefined, selectedChildId, timerChildName);
      setShowFeedingModal(false);
    }
  };

  const addFeeding = async (type: 'formula' | 'solid', amountMl?: number, foodName?: string) => {
    await hapticFeedback.medium();
    let notes: string | undefined;
    if (type === 'formula' && amountMl) notes = `${amountMl} ml`;
    if (type === 'solid' && foodName) notes = foodName;

    await addLog({
      log_type: 'feeding',
      feed_type: type,
      notes
    });
    setShowFeedingModal(false);
    setShowFormulaMLInput(false);
    setFormulaML('');
    setShowSolidFoodInput(false);
    setSolidFoodName('');

    const typeLabels = {
      formula: amountMl ? `${tr("dashboard_sud_evezedicisi", "Süd əvəzedicisi")} ${amountMl} ml 🍼` : tr("dashboard_sud_evezedicisi_057b37", "S\xFCd \u0259v\u0259zedicisi \uD83C\uDF7C"),
      solid: foodName ? `${foodName} 🥣` : tr("dashboard_elave_qida_0e11a2", "\u018Flav\u0259 qida \uD83E\uDD63")
    };
    toast({ title: `${typeLabels[type]} ${tr("dashboard_qeyd_edildi", "qeyd edildi!")}` });
  };

  const handleFormulaClick = () => {
    setShowFormulaMLInput(true);
  };

  const submitFormula = () => {
    const ml = parseInt(formulaML);
    addFeeding('formula', ml > 0 ? ml : undefined);
  };

  const addDiaper = async (type: 'wet' | 'dirty' | 'both') => {
    await hapticFeedback.medium();
    await addLog({
      log_type: 'diaper',
      diaper_type: type === 'both' ? 'mixed' : type
    });
    setShowDiaperModal(false);

    const typeEmojis = {
      wet: '💧',
      dirty: '💩',
      both: '💧💩'
    };
    toast({ title: `${tr("dashboard_diaper_change", "Bez dəyişmə:")} ${typeEmojis[type]}` });

    // Check for achievement
    if (todayStats.diaperCount >= 9) {
      unlockAchievement('diaper_hero', 'mommy');
    }
  };

  const getFeedingIcon = (type: string) => {
    switch (type) {
      case 'left':return '🤱L';
      case 'right':return '🤱R';
      case 'formula':return '🍼';
      case 'solid':return '🥣';
      default:return '🍼';
    }
  };

  const getDiaperIcon = (type: string) => {
    switch (type) {
      case 'wet':return '💧';
      case 'dirty':return '💩';
      case 'both':return '💧💩';
      case 'mixed':return '💧💩';
      default:return '💧';
    }
  };

  const handleMilestoneClick = async (milestoneId: string) => {
    await hapticFeedback.medium();
    await toggleMilestone(milestoneId);

    // Check for milestone achievements
    const achievedCount = displayMilestones.filter((m) => isMilestoneAchieved(m.id)).length;
    if (achievedCount === 0) {
      unlockAchievement('milestone_first', 'mommy');
    } else if (achievedCount >= 4) {
      unlockAchievement('milestone_5', 'mommy');
    }
  };

  // Calculate exact age using real calendar months
  const exactMonths = babyData.ageInMonths;
  const remainingDays = babyData.ageRemainingDays;

  // Editorial hero headline template (anacan-demo design)
  const heroHeadlineTpl = tr('mommy_hero_headline', '{days} gündür {name} həyatınızdadır')
    .replace('{days}', String(babyData.dayNumber));
  const [heroBefore, heroAfter = ''] = heroHeadlineTpl.split('{name}');

  return (
    <div>
      {/* Editorial hero */}
      <section className="a-hero-min a-fade-in">
        <p className="a-hero-eyebrow">
          {tr('mommy_hero_day_label', 'Gün')} <strong>{babyData.dayNumber}</strong> · {babyData.name}
        </p>
        <h1 className="a-hero-headline a-heading">
          {heroBefore}<em>{babyData.name}</em>{heroAfter}
        </h1>
        {childAge?.correctionApplied &&
        <p className="a-hero-eyebrow" style={{ marginTop: 6, opacity: 0.85 }}>
            {tr('preemie_corrected_label', 'Korreksiya olunmuş yaş')}: <strong>{childAge.correctedDisplayText}</strong>
            {childAge.gestationalWeeksAtBirth !== null &&
          <> · {childAge.gestationalWeeksAtBirth}{childAge.gestationalExtraDays ? `+${childAge.gestationalExtraDays}` : ''} {tr('preemie_weeks_born', 'həftəlik doğulub')}</>
          }
          </p>
        }
      </section>

      {/* Premature backfill — yalnız due_date məlum olmayanda görünür */}
      <MommyPeriodBanner onOpen={() => onNavigate?.('mommy-period')} />
      {selectedChild &&
      <PrematurityBackfillCard child={selectedChild} onSaved={refetchChildren} />
      }

      {/* Preemie Bələdçisi girişi — yalnız premature körpələrdə (36 aya qədər) */}
      {!isToolDisabled('preemie-hub') && childAge?.isPremature && babyData.ageInMonths < 36 &&
      <section className="a-section">
          <motion.button
          className="a-card a-fade-in w-full flex items-center gap-3 text-start"
          style={{ padding: 14 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigateToTool?.('preemie-hub')}>

            <span className="a-rank-avatar" style={{ background: 'var(--a-peach-1)', fontSize: 20 }}>💛</span>
            <span className="flex-1 min-w-0">
              <span className="a-rank-title block">{tr('preemie_dash_entry_title', 'Preemie Bələdçisi')}</span>
              <span className="a-rank-sub block">{tr('preemie_dash_entry_sub', 'NICU, kenquru qayğısı, qidalanma və korreksiya olunmuş yaş')}</span>
            </span>
            <ChevronRight size={16} style={{ color: 'var(--a-ink-faint)' }} className="rtl:rotate-180 shrink-0" />
          </motion.button>
        </section>
      }

      {/* Bu günün məlumatları — standalone card */}
      {dailyInfo &&
      <section className="a-section">
          <div className="a-today-info a-fade-in">
            <div className="a-today-info-head">
              <span className="a-today-info-icon">
                <Lightbulb size={19} strokeWidth={2} />
              </span>
              <div>
                <p className="a-today-info-eyebrow">{tr('dashboard_todays_info', 'Bu günün məlumatları')}</p>
                <p className="a-today-info-meta">
                  {tr('mommy_hero_day_label', 'Gün')} {contentDay}
                  {childAge?.correctionApplied && <> ({tr('preemie_corrected_short', 'korreksiya')})</>}
                  {' '}· {babyData.ageInDays === 0 ? tr('pregnancy_utils_first_day', '1-ci gün') : <>{exactMonths} {tr('mommy_meta_months', 'ay')}, {remainingDays} {tr('mommy_meta_days', 'gün')}</>}
                </p>
              </div>
              <span className="a-today-info-badge">{tr('dashboard_daily_badge', 'Gündəlik')}</span>
            </div>
            <div className="a-today-info-text">
              {dailyInfo.info.
            split('\n').
            filter((line) => line.trim().length > 0).
            map((line, index) =>
            <p key={index}>{line.trim()}</p>
            )
            }
            </div>
          </div>
        </section>
      }

      {/* Anaya Mesaj — CTA banner */}
      {mommyMessage &&
      <section className="a-section">
          <div className="a-cta a-fade-in">
            <div className="a-cta-top">
              <span className="a-cta-badge">
                {tr('mommy_hero_day_label', 'Gün')} {contentDay} · {tr('dashboard_message_for_mom', 'Anaya Mesaj')}
              </span>
              <span className="a-cta-deco">
                <Heart size={18} strokeWidth={2} />
              </span>
            </div>
            <div className="a-cta-text">
              {mommyMessage.message.
            split('\n').
            filter((line: string) => line.trim().length > 0).
            map((line: string, index: number) =>
            <p key={index} style={{ margin: index === 0 ? 0 : '8px 0 0' }}>{line.trim()}</p>
            )
            }
            </div>
          </div>
        </section>
      }

      {/* Calendar: upcoming appointments, add / edit in a sheet, server push reminders */}
      <UpcomingAppointments />

      {/* Month illustration info */}
      {illustrationTitle &&
      <section className="a-section">
          <div className="a-card a-fade-in">
            <div className="a-list-row" style={{ padding: 0, borderTop: 'none', alignItems: 'flex-start' }}>
              <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                <Baby size={18} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-list-title">{illustrationTitle}</p>
                {illustrationDescription &&
              <p className="a-list-sub" style={{ whiteSpace: 'normal', lineHeight: 1.6 }}>
                    {illustrationDescription}
                  </p>
              }
              </div>
            </div>
          </div>
        </section>
      }

      {/* Log today — water + trackers + summary */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr('mommy_log_today_title', 'Bu günü qeyd et')}</h2>
          <span className="a-section-link">{tr('mommy_log_today_hint', 'Toxun və əlavə et')}</span>
        </div>
        <WaterWidget variant="anacan" />
      </section>

      {/* Qulluq izləmə alətləri (Yuxu/Qidalanma/Bez/Bugünkü xülasə) — Premium.
          Tək PremiumBlurGate-lə əhatə olunub (4 ayrı overlay yerinə BİR
          səliqəli overlay — hər kartın başlığı/ikonu blur arxasından görünür,
          amma tıklana bilmir). Timer-lər (yuxu/qidalanma) YALNIZ bu kartların
          düymələrindən başladılır (bax toggleSleep/toggleFeeding) — pointer-
          events:none blur-u bu düymələri də əhatə etdiyi üçün premium
          olmayan istifadəçi heç vaxt taymer başlada bilmir. */}
      <PremiumBlurGate
        feature="baby_care_tracking"
        title={tr('premiumgate_babycare_title', 'Qulluq izləmə alətləri')}
        subtitle={tr('premiumgate_babycare_sub', 'Yuxu, qidalanma və bez dəyişmə qeydləri Premium-da')}
      >
      {/* Sleep Tracker */}
      <motion.div
        data-blog-module-section="sleep" tabIndex={-1}
        className="a-card a-fade-in"
        style={{ marginTop: 10 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
              <Moon size={17} strokeWidth={2} />
            </span>
            <div>
              <p className="a-list-title">{tr("dashboard_yuxu_izleme_adaa4f", "Yuxu İzləmə")}</p>
              <p className="a-list-sub">
                {tr('dashboard_today_label', 'Bu gün')}: {(() => {
                  const m = todayStats.sleepMinutes || Math.round(todayStats.sleepHours * 60);
                  const h = Math.floor(m / 60);
                  const rm = m % 60;
                  if (h === 0 && rm === 0) return tr("dashboard_0_deq_86d70a", "0 dəq");
                  if (h === 0) return `${rm} ${tr("common_minutes_short", "dəq")}`;
                  if (rm === 0) return `${h} ${tr("common_hours", "saat")}`;
                  return `${h}${tr("common_h_short", "s")} ${rm}${tr("common_m_short", "d")}`;
                })()}
              </p>
            </div>
          </div>
          <motion.button
            onClick={toggleSleep}
            className={sleepTimer ? 'a-btn-solid' : 'a-btn-soft'}
            whileTap={{ scale: 0.95 }}
            >
            
            {sleepTimer ? <>☀️ <ElapsedTime id={sleepTimer.id} /></> : '😴 ' + tr('dashboard_slept_btn', 'Yatdı')}
          </motion.button>
        </div>
        
        {sleepTimer &&
        <motion.div
          className="a-today-info-tip"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}>
          
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--a-peach-2)', flexShrink: 0, marginTop: 3 }} />
            <span>
              {tr('dashboard_sleep_ongoing', 'Yuxu davam edir')}: <ElapsedTime id={sleepTimer.id} />
            </span>
          </motion.div>
        }
        <TrackerAIInsight section="sleep" api={insightApi} />
      </motion.div>

      {/* Feeding Tracker */}
      <motion.div
        data-blog-module-section="feeding" tabIndex={-1}
        className="a-card a-fade-in"
        style={{ marginTop: 10 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}>
        
        <div className="flex items-center justify-between mb-3">
          <button
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => feedingSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            
            <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
              <Baby size={17} strokeWidth={2} />
            </span>
            <div className="text-start">
              <p className="a-list-title">{tr("dashboard_qidalanmaya_nezaret_1b60b4", "Qidalanmaya nəzarət")}</p>
              <p className="a-list-sub">{tr('dashboard_today_label', 'Bu gün')}: {todayStats.feedingCount} {tr('dashboard_times_unit', 'dəfə')}</p>
            </div>
          </button>
          <motion.button
            onClick={() => setShowFeedingModal(true)}
            className="a-btn-soft"
            whileTap={{ scale: 0.95 }}>
            {tr("dashboard_elave_et_a5fb21", "+ \u018Flav\u0259 et")}
          
          </motion.button>
        </div>
        
        <AnimatePresence>
          {showFeedingModal &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-2 mb-3">
            
              {/* Breastfeeding buttons - hide after 12 months */}
              {babyData && babyData.ageInMonths < 12 &&
            <>
                  <motion.button
                onClick={() => toggleFeeding('left')}
                className={`a-choice pink${leftFeedTimer ? ' running' : ''}`}
                whileTap={{ scale: 0.95 }}>
                
                    <span className="text-2xl">🤱</span>
                    <span className="a-choice-label">
                      {leftFeedTimer ? <ElapsedTime id={leftFeedTimer.id} /> : tr("dashboard_sol_sine_92503e", "Sol Sin\u0259")}
                    </span>
                  </motion.button>
                  <motion.button
                onClick={() => toggleFeeding('right')}
                className={`a-choice pink${rightFeedTimer ? ' running' : ''}`}
                whileTap={{ scale: 0.95 }}>
                
                    <span className="text-2xl">🤱</span>
                    <span className="a-choice-label">
                      {rightFeedTimer ? <ElapsedTime id={rightFeedTimer.id} /> : tr("dashboard_sag_sine_590332", "Sa\u011F Sin\u0259")}
                    </span>
                  </motion.button>
                </>
            }
              <motion.button
              onClick={handleFormulaClick}
              className="a-choice blue"
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-xl">🍼</span>
                <span className="a-choice-label">{tr("dashboard_sud_evezedicisi_4ba2dd", "Süd Əvəzedicisi")}</span>
              </motion.button>
              <motion.button
              onClick={() => setShowSolidFoodInput(true)}
              className="a-choice peach"
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-xl">🥣</span>
                <span className="a-choice-label">{tr("dashboard_elave_qida_676032", "Əlavə Qida")}</span>
              </motion.button>
            </motion.div>
          }
        </AnimatePresence>

        {/* Formula ML Input Modal */}
        <AnimatePresence>
          {showFormulaMLInput &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="a-inset-panel">
            
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🍼</span>
                <span className="a-list-title">{tr("dashboard_nece_ml_c9f7a6", "Neçə ml?")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formulaMLPresets.map((ml) =>
              <motion.button
                key={ml}
                onClick={() => addFeeding('formula', ml)}
                className="a-tag on"
                whileTap={{ scale: 0.95 }}>
                
                    {ml} ml
                  </motion.button>
              )}
              </div>
              <div className="flex gap-2">
                <input
                type="number"
                value={formulaML}
                onChange={(e) => setFormulaML(e.target.value)}
                placeholder={tr("dashboard_diger_ml_ph", "Digər (ml)")}
                className="a-input"
                min="1"
                max="500" />
              
                <motion.button
                onClick={submitFormula}
                className="a-btn-solid"
                whileTap={{ scale: 0.95 }}>
                
                  {tr("dashboard_qeyd_et_f12345", "Qeyd et")}
                </motion.button>
                <motion.button
                onClick={() => {setShowFormulaMLInput(false);setFormulaML('');}}
                className="a-tag"
                whileTap={{ scale: 0.95 }}>
                  {tr("dashboard_legv_f7100a", "L\u0259\u011Fv")}
                
              </motion.button>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* Solid Food Input */}
        <AnimatePresence>
          {showSolidFoodInput &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="a-inset-panel">
            
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🥣</span>
                <span className="a-list-title">{tr("dashboard_elave_qida_676032", "Əlavə Qida")}</span>
              </div>
              <div className="flex gap-2">
                <input
                type="text"
                value={solidFoodName}
                onChange={(e) => setSolidFoodName(e.target.value)}
                placeholder={tr("dashboard_qida_ph", "Məs: balkabaqlı püre")}
                className="a-input" />
              
                <motion.button
                onClick={() => {
                  if (solidFoodName.trim()) addFeeding('solid', undefined, solidFoodName.trim());
                }}
                className="a-btn-solid"
                whileTap={{ scale: 0.95 }}>
                
                  {tr("dashboard_qeyd_et_f12345", "Qeyd et")}
                </motion.button>
                <motion.button
                onClick={() => {setShowSolidFoodInput(false);setSolidFoodName('');}}
                className="a-tag"
                whileTap={{ scale: 0.95 }}>
                  {tr("dashboard_legv_f7100a", "L\u0259\u011Fv")}
                
              </motion.button>
              </div>
            </motion.div>
          }
        </AnimatePresence>
        
        {/* Active feeding timer indicator */}
        {(leftFeedTimer || rightFeedTimer) && !showFeedingModal &&
        <motion.div
          className="a-inset-panel flex items-center justify-between"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}>
          
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--a-pink-2)' }} />
              <span className="a-list-title">
                {leftFeedTimer ? tr('dashboard_left_breast', 'Sol sinə') : tr('dashboard_right_breast', 'Sağ sinə')}: <ElapsedTime id={(leftFeedTimer || rightFeedTimer)!.id} />
              </span>
            </div>
            <motion.button
            onClick={() => toggleFeeding(leftFeedTimer ? 'left' : 'right')}
            className="a-btn-solid"
            whileTap={{ scale: 0.95 }}>
            
              {tr("dashboard_bitir_btn", "Bitir")}
            </motion.button>
          </motion.div>
        }
        <TrackerAIInsight section="feeding" api={insightApi} />
      </motion.div>

      {/* Diaper Tracker */}
      <motion.div
        data-blog-module-section="diaper" tabIndex={-1}
        className="a-card a-fade-in"
        style={{ marginTop: 10 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
              <Clock size={17} strokeWidth={2} />
            </span>
            <div>
              <p className="a-list-title">{tr("dashboard_bez_deyisme_ba242a", "Bez Dəyişmə")}</p>
              <p className="a-list-sub">{tr('dashboard_today_label', 'Bu gün')}: {todayStats.diaperCount} {tr('dashboard_times_unit', 'dəfə')}</p>
            </div>
          </div>
          <motion.button
            onClick={() => setShowDiaperModal(true)}
            className="a-btn-soft"
            whileTap={{ scale: 0.95 }}>
            {tr("dashboard_elave_et_a5fb21", "+ \u018Flav\u0259 et")}
          
          </motion.button>
        </div>
        
        <AnimatePresence>
          {showDiaperModal &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-3 gap-2 mb-3">
            
              <motion.button
              onClick={() => addDiaper('wet')}
              className="a-choice blue"
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-2xl">💧</span>
              </motion.button>
              <motion.button
              onClick={() => addDiaper('dirty')}
              className="a-choice yellow"
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-2xl">💩</span>
              </motion.button>
              <motion.button
              onClick={() => addDiaper('both')}
              className="a-choice lav"
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-xl">💧💩</span>
              </motion.button>
            </motion.div>
          }
        </AnimatePresence>
        
        {/* Recent Diapers */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {todayStats.diaperLogs.slice(-5).reverse().map((log) =>
          <div
            key={log.id}
            className="a-tag flex-shrink-0"
            style={{ cursor: 'default' }}>
            
              <span className="text-base">{getDiaperIcon(log.diaper_type || 'wet')}</span>
              <span>
                {new Date(log.start_time).toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
        <TrackerAIInsight section="diaper" api={insightApi} />
      </motion.div>

      {/* Today's Summary */}
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 10 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
        <div className="a-card-head">
          <h3 className="a-card-title a-heading">{tr("dashboard_bugunku_xulase_e1e1b3", "Bugünkü xülasə")}</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {onNavigate &&
            <button
              onClick={() => onNavigate('doctor-report')}
              className="a-icon-btn"
              style={{ width: 30, height: 30 }}
              aria-label={tr("dash_pdf_report", 'Həkim hesabatı (PDF)')}
              title={tr("dash_pdf_report", 'Həkim hesabatı (PDF)')}>
              <FileText size={13} />
            </button>
            }
            <button
              onClick={() => refetch()}
              className="a-icon-btn"
              style={{ width: 30, height: 30 }}>
              
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        <div className="a-list-card" style={{ border: '1px solid var(--a-line)', boxShadow: 'none' }}>
          {/* Sleep Summary - Expandable */}
          <div>
            <button
              onClick={() => setSleepExpanded(!sleepExpanded)}
              className="a-list-row w-full"
              style={{ cursor: 'pointer', width: '100%', textAlign: 'start', background: 'none', border: 'none', borderTop: 'none' }}>
              
              <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                <Moon size={17} strokeWidth={2} />
              </span>
              <div>
                <p className="a-list-title">{tr("dashboard_yuxu_xulasesi_b2dc87", "Yuxu xülasəsi")}</p>
                <p className="a-list-sub">
                  {todayStats.sleepLogs?.length || 0} {tr('dashboard_sleep_recorded', 'yuxu qeydə alınıb')}
                </p>
              </div>
              <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  <p className="a-list-value">
                    {(() => {
                      const totalMin = todayStats.sleepMinutes || Math.round(todayStats.sleepHours * 60);
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      if (h === 0 && m === 0) return tr("dashboard_0_deq_86d70a", "0 d\u0259q");
                      if (h === 0) return `${m} ${tr("dashboard_min", "dəq")}`;
                      if (m === 0) return `${h} ${tr("common_hours", "saat")}`;
                      return `${h} ${tr("dashboard_hour", "saat")} ${m} ${tr("dashboard_min", "dəq")}`;
                    })()}
                  </p>
                  <p className="a-list-time">{tr("dashboard_bu_gun_7d7f30", "bu gün")}</p>
                </span>
                {sleepExpanded ?
                <ChevronUp size={15} className="a-list-chevron" /> :

                <ChevronDown size={15} className="a-list-chevron" />
                }
              </span>
            </button>
            <AnimatePresence>
              {sleepExpanded &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden">
                
                  <div className="px-4 pb-3 space-y-1.5">
                    {todayStats.sleepLogs && todayStats.sleepLogs.length > 0 ?
                  [...todayStats.sleepLogs].reverse().map((log) => {
                    const start = new Date(log.start_time);
                    const end = log.end_time ? new Date(log.end_time) : null;
                    const durationSec = end ? Math.round((end.getTime() - start.getTime()) / 1000) : 0;
                    const dH = Math.floor(durationSec / 3600);
                    const dM = Math.floor(durationSec % 3600 / 60);
                    const dS = durationSec % 60;
                    const durText = dH > 0 ? `${dH}${tr("dashboard_h", "s")} ${dM}${tr("dashboard_m", "d")}` : dM > 0 ? `${dM} ${tr("dashboard_min", "dəq")} ${dS} ${tr("dashboard_sec", "san")}` : `${dS} ${tr("dashboard_sec", "san")}`;

                    return (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">😴</span>
                              <div>
                                <p className="a-list-sub" style={{ margin: 0, color: 'var(--a-ink)' }}>
                                  {start.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}
                                  {end && ` – ${end.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                              </div>
                            </div>
                            <span className="a-list-value" style={{ color: 'var(--a-accent-ink)' }}>
                              {end ? durText : tr("dashboard_davam_edir_88d3a2", 'Davam edir...')}
                            </span>
                          </div>);

                  }) :

                  <p className="a-list-sub text-center py-2" style={{ margin: 0 }}>{tr("dashboard_bu_gun_yuxu_qeyde_alinmayib_8a3535", "Bu gün yuxu qeydə alınmayıb")}</p>
                  }
                  </div>
                </motion.div>
              }
            </AnimatePresence>
          </div>
          
          {/* Enhanced Feeding History Panel */}
          <div ref={feedingSummaryRef} style={{ borderTop: '1px solid var(--a-line)', padding: '10px 12px' }}>
            <FeedingHistoryPanel />
          </div>
          <button
            onClick={() => setShowDiaperModal(true)}
            className="a-list-row w-full"
            style={{ cursor: 'pointer', width: '100%', textAlign: 'start', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', borderTop: '1px solid var(--a-line)' }}>
            
            <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
              <Clock size={17} strokeWidth={2} />
            </span>
            <div>
              <p className="a-list-title">{tr("dashboard_bez_deyisme_647cbc", "Bez dəyişmə")}</p>
              <p className="a-list-sub">
                💧{todayStats.wetCount} 💩{todayStats.dirtyCount} 💧💩{todayStats.bothCount}
              </p>
            </div>
            <span className="a-list-trail">
              <p className="a-list-value" style={{ color: 'var(--a-accent-ink)' }}>{todayStats.diaperCount} {tr("dashboard_defe_420246", "d\u0259f\u0259")}</p>
              <p className="a-list-time">{tr("dashboard_bu_gun_7d7f30", "bu gün")}</p>
            </span>
          </button>
        </div>
      </motion.div>
      </PremiumBlurGate>

      {/* Weekly review — Premium (Flo-stil blur teaser) */}
      <PremiumBlurGate
        feature="weekly_stats"
        title={tr('premiumgate_weekly_title', 'Həftəlik inkişaf icmalı')}
        subtitle={tr('premiumgate_weekly_sub', 'Yuxu, qidalanma və bez statistikası — körpənizin həftəlik analizi Premium-da')}
      >
        <QuickStatsWidget />
      </PremiumBlurGate>

      {/* Teething — Premium */}
      <div className="a-section">
        <PremiumBlurGate
          feature="teething"
          title={tr('premiumgate_teething_title', 'Diş çıxarma izləyicisi')}
          subtitle={tr('premiumgate_teething_sub', 'Hər dişin vaxtı, simptomlar və rahatlatma bələdçisi Premium-da')}
          blur="sm"
        >
          <TeethingWidget onOpen={() => onNavigateToTool?.('teething')} />
        </PremiumBlurGate>
      </div>

      {/* Growth — Premium */}
      <div className="a-section">
        <PremiumBlurGate
          feature="growth"
          title={tr('premiumgate_growth_title', 'Boy-çəki artım əyriləri')}
          subtitle={tr('premiumgate_growth_sub', 'ÜST standartları ilə müqayisəli inkişaf qrafikləri Premium-da')}
        >
          <GrowthTrackerWidget />
        </PremiumBlurGate>
      </div>

      {/* Anacan Aptek: age-based offer or store banner (hidden while the store is off) */}
      <AptekHomeCard stage="mommy" babyMonths={exactMonths} babyName={babyData.name} onOpen={onNavigate} />

      {/* Cakes cross-sell — yalnız AZ bazarı (dil az/ru + ölkə AZ), 12 aydan sonra gizli */}
      {!isToolDisabled('cakes') && isCakesAvailable((mommyProfile as any)?.country_code, language) && babyData.ageInMonths < 12 &&
      <section className="a-section">
          <motion.button
          className="a-card a-fade-in"
          style={{ width: '100%', textAlign: 'start', cursor: 'pointer', padding: '14px 18px' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigateToTool?.('cakes')}>
          
            <div className="a-rank-row" style={{ borderTop: 'none', padding: 0 }}>
              <span className="a-rank-avatar" style={{ background: 'var(--a-peach-1)', fontSize: 20 }}>🎂</span>
              <div style={{ minWidth: 0 }}>
                <p className="a-rank-title">{tr("dashboard_xususi_tortlar_ba1400", "Xüsusi Tortlar")}</p>
                <p className="a-rank-sub">
                  {babyData.ageInMonths > 0 ? tr('dashboard_order_monthly_cake', '{n}-ci aylıq tortunu sifariş ver!').replace('{n}', String(babyData.ageInMonths + 1)) : tr("dashboard_korpeniz_ucun_milestone_tortla_3bcbc1", "K\xF6rp\u0259niz \xFC\xE7\xFCn milestone tortlar\u0131")}
                </p>
              </div>
              <ChevronRight className="rtl:rotate-180 a-list-chevron" style={{ marginInlineStart: 'auto' }} size={18} />
            </div>
          </motion.button>
        </section>
      }

      {/* Development: milestones (swipe row) + one age-based tip, in one compact card */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("dashboard_inkisaf_merheleleri_d6d887", "İnkişaf mərhələləri")}</h2>
          <span className="a-section-link">
            {allMilestones.filter((m) => m.achieved).length}/{allMilestones.length}
          </span>
        </div>
        <div className="a-card a-fade-in a-dev-card">
          <div
            className="a-dev-rail"
            ref={(el) => {
              // Start at the first milestone that is not achieved yet (once per mount).
              if (!el || el.dataset.positioned) return;
              el.dataset.positioned = '1';
              const first = el.querySelector<HTMLElement>('[data-achieved="false"]');
              if (first) el.scrollLeft = Math.max(0, first.offsetLeft - el.offsetLeft - 14);
            }}>
            {allMilestones.map((milestone) =>
            <button
              key={milestone.id}
              type="button"
              data-achieved={milestone.achieved ? 'true' : 'false'}
              onClick={() => handleMilestoneClick(milestone.id)}
              className={`a-dev-ms${milestone.achieved ? ' on' : ''}`}
              aria-pressed={milestone.achieved}>
                <span className="a-dev-ms-ico">
                  {milestone.emoji}
                  {milestone.achieved && <span className="a-dev-ms-check"><Check className="w-2.5 h-2.5" /></span>}
                </span>
                <span className="a-dev-ms-label">{milestone.label}</span>
              </button>
            )}
          </div>
          <DevelopmentTipsWidget embedded />
        </div>
      </section>

      {/* Baby Crisis Calendar Widget - hide after week 75 (last crisis ends) */}
      {Math.floor(babyData.ageInDays / 7) <= 75 &&
      <div className="a-section">
          <BabyCrisisWidget
          babyAgeWeeks={Math.floor(babyData.ageInDays / 7)}
          babyName={babyData.name} />
        </div>
      }




    </div>);

};

interface DashboardProps {
  onOpenChat?: () => void;
  onNavigateToTool?: (tool: string) => void;
  onNavigate?: (screen: string) => void;
}

const Dashboard = ({ onOpenChat, onNavigateToTool, onNavigate }: DashboardProps) => {
  const { lifeStage, name } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, name: s.name }))
  );
  const { profile } = useAuth();
  const { unreadCount: partnerUnread } = useUnreadMessages();
  const { conversations } = useDirectMessages();
  const { unreadCount: notificationCount } = useNotifications();

  // Combined unread from partner + community DMs
  const totalUnread = partnerUnread + (conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return tr('dashboard_good_morning_xeyir', 'Sabahınız xeyir');
    if (hour < 18) return tr('dashboard_good_afternoon_xeyir', 'Günortanız xeyir');
    return tr('dashboard_good_evening_xeyir', 'Axşamınız xeyir');
  };

  const hasPartner = !!profile?.linked_partner_id;

  // ——— Anacan redesign (github.com/Jmlsltnl/anacan-demo-app): mommy + bump + flow home ———
  if (lifeStage === 'mommy' || lifeStage === 'bump' || lifeStage === 'flow') {
    return (
      <div className="a-scope a-dash pb-6 overflow-x-hidden">
        {/* Watercolor sky behind topbar + hero */}
        <div className="a-sky" aria-hidden>
          <span className="a-cloud c1" />
          <span className="a-cloud c2" />
          <span className="a-cloud c3" />
          <span className="a-cloud c4" />
          <span className="a-cloud c5" />
          <span className="a-cloud c6 deep" />
          <span className="a-cloud c7 deep" />
        </div>
        <div className="a-shell">
          {/* Top bar */}
          <motion.header
            className="a-topbar"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}>
            
            <div>
              <p className="a-eyebrow">{getGreeting()}</p>
              <p className="a-wordmark">{name || tr("dashboard_xanim_39ff6a", "Xan\u0131m")} 👋</p>
            </div>
            <div className="a-topbar-actions">
              {lifeStage === 'mommy' ?
              <ChildSelector compact /> :

              <button
                type="button"
                className="a-icon-btn"
                onClick={onOpenChat}
                aria-label={tr("bottomnav_mesajlar", "Mesajlar")}
                style={{ cursor: 'pointer' }}>
                
                  <MessageCircle size={16} strokeWidth={2} />
                  {totalUnread > 0 &&
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    insetInlineEnd: -4,
                    minWidth: 15,
                    height: 15,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: '#e05555',
                    color: '#fff',
                    fontSize: 8.5,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                  
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                }
                </button>
              }
            </div>
          </motion.header>

          {/* Top Banner Slot */}
          <BannerSlot placement="home_top" onNavigate={() => {}} onToolOpen={onNavigateToTool} className="mb-2" />
          <AdFreePremiumOffer position="top" />

          {lifeStage === 'mommy' && <MommyDashboard onNavigateToTool={onNavigateToTool} onNavigate={onNavigate} />}
          {lifeStage === 'bump' && <BumpDashboard onNavigateToTool={onNavigateToTool} />}
          {lifeStage === 'flow' && <FlowDashboard />}
          <AdInlineAnchor id="home_banner" />

          {/* Daily summary auto-syncs to partner in background */}
          {lifeStage === 'bump' && profile?.linked_partner_id && <DailySummaryAutoSync />}

          {/* Partnyorum kartı — sevgi statistikası, təşəkkür, SOS/Doğuş siqnalı */}
          {profile?.linked_partner_id &&
          <div className="a-section" style={{ marginTop: 14 }}>
            <PartnerCareCard lifeStage={lifeStage} onOpenSharing={onNavigate ? () => onNavigate('partner-sharing') : undefined} />
          </div>
          }

          {/* Recent Blog Posts */}
          {onNavigate && <RecentBlogPosts onNavigate={onNavigate} lifeStage={lifeStage} variant="anacan" />}

          {/* Bottom Banner Slot */}
          <BannerSlot placement="home_bottom" onNavigate={() => {}} onToolOpen={onNavigateToTool} className="mt-2" />

          {/* Small medical disclaimer — Google Play Health Content policy */}
          <MedicalDisclaimer variant="anacan" />
          <AdFreePremiumOffer position="bottom" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 pt-2 px-3">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-2"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}>
        
        <div>
          <p className="text-xs text-muted-foreground font-medium">{getGreeting()}</p>
          <h1 className="text-lg font-black text-foreground">{name || tr("dashboard_xanim_39ff6a", "Xan\u0131m")} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onOpenChat}
            className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}>
            
              <MessageCircle className="w-4 h-4 text-primary" />
              {totalUnread > 0 &&
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -end-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              
                  {totalUnread > 9 ? '9+' : totalUnread}
                </motion.span>
            }
            </motion.button>
          {/* Notification bell temporarily disabled */}
        </div>

      </motion.div>

      {/* Top Banner Slot */}
      <BannerSlot placement="home_top" onNavigate={() => {}} onToolOpen={onNavigateToTool} className="mb-2" />
      <AdFreePremiumOffer position="top" />

      {/* Recent Blog Posts - filtered by life stage (partner uses bump stage content) */}
      {onNavigate && <RecentBlogPosts onNavigate={onNavigate} lifeStage="bump" />}

      <AdInlineAnchor id="home_banner" />
      {/* Bottom Banner Slot */}
      <BannerSlot placement="home_bottom" onNavigate={() => {}} onToolOpen={onNavigateToTool} className="mt-2" />

      {/* Small medical disclaimer for all modules — Google Play Health Content policy */}
      <MedicalDisclaimer variant="inline" className="mt-3 px-1" />
      <AdFreePremiumOffer position="bottom" />
    </div>);

};

export default Dashboard;
