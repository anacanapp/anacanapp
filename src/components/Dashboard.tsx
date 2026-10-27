import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Droplets, Moon,
 ChevronRight,
 Pill, Baby, Footprints, Scale,
  MessageCircle, Check, Smile, Droplet } from
'lucide-react';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useTimerStore } from '@/store/timerStore';
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
import { useBabyIllustrationByMonth } from '@/hooks/useBabyMonthIllustrations';
import { useBabyDailyInfoByDay } from '@/hooks/useBabyDailyInfo';
import { useMommyDailyMessageByDay } from '@/hooks/useMommyDailyMessages';
import { useChildren } from '@/hooks/useChildren';
import { usePregnancyDayNavigation } from '@/hooks/usePregnancyDayNavigation';
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
import DailySummaryAutoSync from '@/components/partner/DailySummaryAutoSync';
import PartnerCareCard from '@/components/partner/v2/PartnerCareCard';
import RedFlagBanner from '@/components/dashboard/RedFlagBanner';
import RecentBlogPosts from '@/components/dashboard/RecentBlogPosts';
import FlowDashboard, { type FlowHeroContext } from '@/components/flow/FlowDashboard';
import BirthOnboardingModal from '@/components/BirthOnboardingModal';
import { MommyPeriodBanner } from '@/components/mommy/MommyPeriodTracker';
import MotherSleepWidget from '@/components/dashboard/MotherSleepWidget';

import { tr } from "@/lib/tr";
import { rd } from '@/lib/redesign-i18n';
import { waterTarget } from '@/lib/water-target';
import { useVitaminSchedules } from '@/hooks/useVitaminSchedules';
import { TrackerTile } from '@/components/anacan/TrackerTile';
import { Section, InfoTabs } from '@/components/anacan/Section';
import { Mascot } from '@/components/anacan/Mascot';
import { AskBar, DayPlan, Upcoming, QuickTools, HomeTopbar, greetingKey } from '@/components/home/HomeParts';
import { MommyHero, useVaccineEvents, clockDuration } from '@/components/home/MommyHome';
import { FeedingWidget, SleepWidget } from '@/components/home/BabyCareWidgets';
import { AptekHomeCard } from '@/components/aptek/AptekEntry';
import { BumpHero, MonthGallery, WeekSheet, pregnancyMilestones, fetusMonthOf } from '@/components/home/BumpHome';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useFetusIllustrationByMonth } from '@/hooks/useFetusIllustrations';


// FlowDashboard is now imported from @/components/flow/FlowDashboard


const BumpDashboard = ({ onNavigateToTool, onNavigate, onOpenAI }: {onNavigateToTool?: (tool: string) => void;onNavigate?: (screen: string) => void;onOpenAI?: () => void;}) => {
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const name = useUserStore((s) => s.name);
  const { toast } = useToast();
  const { profile } = useAuth();
  // Əkiz/üçüz və s. — hero başlığı və digər "körpəniz" mətnləri buna görə uyğunlaşır
  const isMultiple = !!(profile as any)?.multiples_type && (profile as any).multiples_type !== 'single';
  const pregData = getPregnancyData();
  const { todayLog, updateWaterIntake } = useDailyLogs();
  const { getTodayStats, addSession } = useKickSessions();
  const { entries: weightEntries } = useWeightEntries();
  const { schedules: vitaminSchedules, todayLogs: vitaminLogs } = useVitaminSchedules();
  const { data: fruitImages = [] } = useFruitImages();

  const [showBirthModal, setShowBirthModal] = useState(false);
  const [weekSheet, setWeekSheet] = useState<number | null>(null);

  const {
    selectedDay: pregnancyDay,
    selectedWeek,
    selectedDayInWeek,
    selectedTrimester,
    daysUntilDueFromSelected,
    isViewingCurrentDay
  } = usePregnancyDayNavigation({
    lastPeriodDate: pregData?.lastPeriodDate || null,
    dueDate: pregData?.dueDate
  });

  const { data: weeklyTips = [] } = useWeeklyTips(selectedWeek, 'bump');
  const currentWeekTip = weeklyTips[0];
  const { data: dayContent } = usePregnancyContentByDay(pregnancyDay);
  const { data: dynamicTrimesterTips = [] } = useTrimesterTips(selectedTrimester);

  // Hooks must run before the early return below: when pregnancy data appeared
  // after a null render, React threw "Rendered more hooks" and blanked the screen.
  const fetusMonth = fetusMonthOf(selectedWeek);
  const fetusImageFromDb = useFetusIllustrationByMonth(fetusMonth);

  if (!pregData) return null;

  const todayStats = getTodayStats();
  const kickCount = todayStats.totalKicks;
  const waterCount = todayLog?.water_intake || 0;
  const currentMood = todayLog?.mood || 0;
  const latestWeight = weightEntries[0]?.weight;
  const showBirthButton = pregData?.currentWeek ? pregData.currentWeek >= 27 : false;
  const weekData = getDynamicFruitData(fruitImages, pregnancyDay, selectedWeek, dayContent);
  const [greetKey, greetFallback] = greetingKey();

  const headline = (() => {
    // Tək körpədə "mən danışıram" (1-ci şəxs) səsi təbiidir; əkiz/üçüzdə isə hər körpə
    // fərqli ölçüdə ola bilər — ona görə ana-yönümlü (2-ci şəxs cəm) şablona keçirik.
    const tpl = isMultiple ?
    tr("dashboard_hero_fruit_tpl_multiple", "Körpələriniz təxminən {fruit} boydadır") :
    tr("dashboard_hero_fruit_tpl", "Anacan, hazırda {fruit} boydayam");
    const [before, after] = tpl.split('{fruit}');
    return <>{before}<em>{weekData.fruit}</em>{after ?? ''}</>;
  })();

  const addKick = async () => {
    await addSession(1, 0);
    toast({
      title: tr("dashboard_tepik_qeyd_edildi_284f06", "Təpik qeyd edildi! 👶"),
      description: `${tr("dashboard_today", "Bu gün")} ${kickCount + 1} ${tr("dashboard_kick", "təpik")}`
    });
  };

  const infoTabs = [
  { label: rd('tab_baby'), text: dayContent?.baby_development },
  { label: rd('tab_you'), text: dayContent?.body_changes },
  { label: rd('tab_tip'), text: dayContent?.daily_tip || currentWeekTip?.content }].
  filter((t): t is {label: string;text: string;} => !!t.text);

  return (
    <div className="a3-enter">
      {/* Qırmızı bayraq: bu günkü BP ≥140/90 → avtomatik xəbərdarlıq */}
      <RedFlagBanner onOpenTool={onNavigateToTool} />

      <BumpHero
        greeting={`${tr(greetKey, greetFallback)}, ${name || tr("dashboard_xanim_39ff6a", "Xanım")}`}
        week={selectedWeek}
        dayInWeek={selectedDayInWeek}
        day={pregnancyDay}
        trimester={selectedTrimester}
        isNow={isViewingCurrentDay}
        daysLeft={daysUntilDueFromSelected}
        fruit={weekData.fruit}
        lengthCm={weekData.lengthCm}
        weightG={weekData.weightG}
        headline={headline}
        firstLine={dayContent?.baby_development?.split('. ')[0]}
        fetusSrc={fetusImageFromDb}
        onOpenWeek={() => setWeekSheet(selectedWeek)} />

      {dayContent?.baby_message &&
      <section className="a3-sec">
          <figure className="a3-quote" style={{ margin: 0 }}>
            <div className="a3-quote-head">
              <span className="a3-quote-ava"><Baby size={18} /></span>
              <div><p className="a3-quote-label">{rd('baby_message')}</p><p className="a3-quote-sub a3-num">{rd('day_n_of', { n: pregnancyDay })}</p></div>
            </div>
            <blockquote className="a3-quote-text">{dayContent.baby_message}</blockquote>
          </figure>
        </section>
      }

      <div className="a3-today" aria-label={rd('today')}>
        <TrackerTile icon={Droplets} tone="c-blue" value={`${waterCount}/${waterTarget('bump')}`} label={rd('tk_water')} plus count={waterCount} ariaLabel={rd('add_water')} onClick={() => { void updateWaterIntake(1); }} />
        {selectedWeek >= 16 ?
        <TrackerTile icon={Footprints} tone="c-peach" value={kickCount} label={rd('tk_kicks')} plus count={kickCount} ariaLabel={rd('add_kick')} onClick={addKick} /> :
        <TrackerTile icon={Scale} tone="c-green" value={latestWeight ? Number(latestWeight).toLocaleString() : '—'} label={rd('tk_weight')} onClick={() => onNavigateToTool?.('weight')} />}
        <TrackerTile icon={Pill} tone="c-yellow" value={vitaminSchedules.length ? `${vitaminLogs.length}/${vitaminSchedules.length}` : '—'} label={rd('tk_vitamin')} onClick={() => onNavigateToTool?.('vitamin-tracker')} />
        <TrackerTile icon={Smile} tone="c-pink" value={currentMood ? `${currentMood}/5` : '—'} label={rd('tk_mood')} onClick={() => onNavigateToTool?.('mood')} />
      </div>

      <AskBar placeholder={rd('ask_placeholder')} onAsk={onOpenAI} />

      {infoTabs.length > 0 &&
      <Section title={isViewingCurrentDay ? rd('this_week') : rd('week_n', { n: selectedWeek })}>
          <InfoTabs tabs={infoTabs} />
        </Section>
      }

      <DayPlan stage="bump" week={selectedWeek} onNavigateToTool={onNavigateToTool} />

      {/* Əkiz/çoxdöllü hamiləliyə xas məsləhət — YALNIZ isMultiple=true olanlara,
          yalnız məzmun mövcud olan günlərdə (bax Duzelis29/32.sql). applyLanguage()
          (usePregnancyContent.ts) UI dilinə uyğun multiples_tip_{lang} dəyərini
          artıq multiples_tip sahəsinə köçürüb — burda UI dilindən asılı deyil. */}
      {isMultiple && (dayContent as any)?.multiples_tip &&
      <section className="a3-sec">
          <article className="a3-card a3-pad">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="a3-ico-sq sm c-blue"><Baby size={16} /></span><p style={{ margin: 0, fontWeight: 600 }}>{tr("dashboard_ekiz_hameleliyiniz_ucun", "Əkiz Hamiləliyiniz üçün")}</p></div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{(dayContent as any).multiples_tip}</p>
          </article>
        </section>
      }

      {currentWeekTip && dayContent?.daily_tip &&
      <section className="a3-sec">
          <article className="a3-card a3-pad">
            <p className="a3-eyebrow" style={{ color: 'var(--a-accent-ink)' }}>{tr("dashboard_hefte_3aa886", "Həftə")} {selectedWeek} {tr("dashboard_tovsiyesi_6412b4", "T\xF6vsiyəsi")}</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{currentWeekTip.title}</p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{currentWeekTip.content}</p>
          </article>
        </section>
      }

      <MonthGallery currentWeek={selectedWeek} onOpenWeek={(w) => setWeekSheet(w)} />

      {dynamicTrimesterTips.length > 0 &&
      <Section title={[rd('tri_1'), rd('tri_2'), rd('tri_3')][selectedTrimester - 1] || rd('tri_3')}>
          <div className="a3-card a3-pad" style={{ paddingBlock: 4 }}>
            <div className="a3-list">
              {dynamicTrimesterTips.map((tip, index) =>
            <div key={tip.id} className="a3-li" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span className="a3-chip ac a3-num" style={{ minWidth: 26, justifyContent: 'center' }}>{index + 1}</span>
                  <span className="grow" style={{ fontSize: 14.5, lineHeight: 1.5 }}>{tip.tip_text}</span>
                </div>
            )}
            </div>
          </div>
        </Section>
      }

      <Upcoming
        events={pregnancyMilestones(new Date(pregData.lastPeriodDate), onNavigateToTool)} />

      {onNavigate && <AptekHomeCard stage="bump" onOpen={onNavigate} />}

      <QuickTools stage="bump" ids={['kick', 'contraction', 'hospital', 'names', 'safety', 'blood-pressure', 'danger-signs', 'vitamin-tracker', 'weight', 'fetal-growth']} onNavigateToTool={onNavigateToTool} />

      {showBirthButton &&
      <section className="a3-sec">
          <button type="button" className="a3-card a3-pad" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, border: 0, textAlign: 'start', cursor: 'pointer', width: '100%' }} onClick={() => setShowBirthModal(true)}>
            <Mascot stage="mommy" pose="welcome" width={64} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{rd('gave_birth')}</span>
              <span className="a3-meta">{rd('gave_birth_sub')}</span>
            </span>
            <ChevronRight size={18} className="rtl:rotate-180" />
          </button>
        </section>
      }

      <BirthOnboardingModal
        isOpen={showBirthModal}
        onClose={() => setShowBirthModal(false)}
        onComplete={() => {
          setShowBirthModal(false);
          window.location.reload();
        }} />

      <WeekSheet week={weekSheet} onClose={() => setWeekSheet(null)} onChangeWeek={(w) => setWeekSheet(Math.max(4, Math.min(40, w)))} />
    </div>);

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

const MommyDashboard = ({ onNavigateToTool, onNavigate, onOpenAI }: {onNavigateToTool?: (tool: string) => void;onNavigate?: (screen: string) => void;onOpenAI?: () => void;}) => {
  const language = useUserStore((s) => s.language);
  const { profile: mommyProfile } = useAuth();
  const { isMilestoneAchieved, toggleMilestone, getMilestoneDate, MILESTONES } = useBabyMilestones();
  const { unlockAchievement } = useAchievements();
  const { getActiveTimer } = useTimerStore();
  const { todayLogs, getTodayStats } = useBabyLogs();
  const { isToolDisabled } = useDisabledTools();
  const mommyName = useUserStore((s) => s.name);
  const { todayLog: mommyDayLog, updateWaterIntake: addMommyWater } = useDailyLogs();

  const { selectedChild, getChildAge, refetch: refetchChildren } = useChildren();

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
  const { title: illustrationTitle, description: illustrationDescription } = useBabyIllustrationByMonth(Math.max(1, Math.min(36, babyAgeMonths)));
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

  const vaccineEvents = useVaccineEvents(selectedChild ?? null, isToolDisabled('vaccine-calendar') ? undefined : () => onNavigateToTool?.('vaccine-calendar'));

  // Əkiz/üçüzlərdə hər körpənin MÜSTƏQİL taymeri olsun deyə — seçilmiş uşağın id-si
  // taymer sorğularına ötürülür (əvvəllər qlobal idi, uşaq dəyişəndə data qarışırdı)
  const selectedChildId = selectedChild?.id;
  // UI-də uşaq adı yalnız BİRDƏN ÇOX uşaq olanda göstərilir (tək uşaqlı ailələrdə əlavə söz olmasın)

  // Sleep tracking
  const sleepTimer = getActiveTimer('sleep', undefined, selectedChildId);

  // Feeding tracking with live timer
  const leftFeedTimer = getActiveTimer('feeding', 'left', selectedChildId);
  const rightFeedTimer = getActiveTimer('feeding', 'right', selectedChildId);

  // Diaper tracking

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
  const hasMoreMilestones = allMilestones.length > milestonesPerPage;


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

  const [greetKey, greetFallback] = greetingKey();
  const mommyWater = mommyDayLog?.water_intake || 0;
  const lastFeedIso = todayStats.feedingLogs.reduce<string | null>((last, l) => (!last || l.start_time > last ? l.start_time : last), null);


  return (
    <div>
      <MommyHero
        greeting={`${tr(greetKey, greetFallback)}, ${mommyName || tr("dashboard_xanim_39ff6a", "Xanım")}`}
        babyName={babyData.name}
        ageInDays={babyData.ageInDays}
        months={exactMonths}
        remainingDays={remainingDays}
        dayNumber={babyData.dayNumber}
        correctedText={childAge?.correctionApplied ? `${tr('preemie_corrected_label', 'Korreksiya olunmuş yaş')}: ${childAge.correctedDisplayText}` : null}
        lastFeedIso={lastFeedIso}
        sleepMinutes={aiInsightStats.sleepMinutes}
        onOpenDay={() => onNavigateToTool?.('baby-tracker')} />

      {/* Bu günün məlumatı, anaya mesaj və ayın inkişafı — bir kartda, tablarla */}
      {(dailyInfo || mommyMessage || illustrationTitle) &&
      <Section title={tr('dashboard_todays_info', 'Bu günün məlumatları')} meta={<span className="a3-chip a3-num">{tr('mommy_hero_day_label', 'Gün')} {contentDay}</span>}>
          <InfoTabs tabs={[
          { label: tr('dashboard_daily_badge', 'Gündəlik'), text: dailyInfo?.info },
          { label: tr('dashboard_message_for_mom', 'Anaya Mesaj'), text: mommyMessage?.message },
          { label: illustrationTitle || '', text: illustrationDescription }].
          filter((t): t is {label: string;text: string;} => !!t.label && !!t.text)} />
        </Section>
      }

      <div className="a3-today" aria-label={rd('today')} data-blog-module-section="diaper" tabIndex={-1}>
        <TrackerTile icon={Baby} tone="c-peach" value={todayStats.feedingCount} label={rd('tk_feed')} live={!!(leftFeedTimer || rightFeedTimer)} onClick={() => onNavigateToTool?.('baby-tracker')} />
        <TrackerTile icon={Moon} tone="c-lav" value={sleepTimer ? <ElapsedTime id={sleepTimer.id} /> : clockDuration(aiInsightStats.sleepMinutes)} label={rd('tk_sleep')} live={!!sleepTimer} onClick={() => onNavigateToTool?.('baby-tracker')} />
        <TrackerTile icon={Droplet} tone="c-yellow" value={todayStats.diaperCount} label={rd('tk_diaper')} onClick={() => onNavigateToTool?.('baby-tracker')} />
        <TrackerTile icon={Droplets} tone="c-blue" value={`${mommyWater}/${waterTarget('mommy')}`} label={rd('tk_water_mom')} plus count={mommyWater} ariaLabel={rd('add_water')} onClick={() => { void addMommyWater(1); }} />
      </div>

      <AskBar placeholder={rd('ask_baby', { name: babyData.name })} onAsk={onOpenAI} />

      <DayPlan stage="mommy" babyMonths={exactMonths} onNavigateToTool={onNavigateToTool} />

      {/* Qidalanma və yuxu — evdən birbaşa qeyd; tam tarixçə Körpə izləyicisi alətindədir.
          data-blog-module-section anker-ləri (feeding / sleep / diaper) məqalə deep link-ləri üçündür. */}
      <FeedingWidget feedingsToday={todayStats.feedingCount} lastFeedIso={lastFeedIso} onOpenTracker={() => onNavigateToTool?.('baby-tracker')} />
      <SleepWidget sleepMinutesToday={aiInsightStats.sleepMinutes} onOpenTracker={() => onNavigateToTool?.('baby-tracker')} />

      <Upcoming
        events={vaccineEvents} />

      {onNavigate && <AptekHomeCard stage="mommy" babyMonths={exactMonths} babyName={babyData.name} onOpen={onNavigate} />}

      {/* Premature backfill — yalnız due_date məlum olmayanda görünür */}
      <MommyPeriodBanner onOpen={() => onNavigate?.('mommy-period')} />
      {selectedChild &&
      <PrematurityBackfillCard child={selectedChild} onSaved={refetchChildren} />
      }

      {/* Preemie Bələdçisi girişi — yalnız premature körpələrdə (36 aya qədər) */}
      {!isToolDisabled('preemie-hub') && childAge?.isPremature && babyData.ageInMonths < 36 &&
      <section className="a3-sec">
          <button type="button" className="a3-card a3-pad a3-li a3-entry" onClick={() => onNavigateToTool?.('preemie-hub')}>
            <span className="a3-ico-sq c-peach" aria-hidden="true">💛</span>
            <span className="grow"><span className="a3-entry-title">{tr('preemie_dash_entry_title', 'Preemie Bələdçisi')}</span>
              <span className="a3-meta">{tr('preemie_dash_entry_sub', 'NICU, kenquru qayğısı, qidalanma və korreksiya olunmuş yaş')}</span></span>
            <ChevronRight size={18} className="rtl:rotate-180" />
          </button>
        </section>
      }

      <section className="a3-sec"><MotherSleepWidget /></section>

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

      {/* Cakes cross-sell — yalnız AZ bazarı (dil az/ru + ölkə AZ), 12 aydan sonra gizli */}
      {!isToolDisabled('cakes') && isCakesAvailable((mommyProfile as {country_code?: string} | null)?.country_code, language) && babyData.ageInMonths < 12 &&
      <section className="a3-sec">
          <button type="button" className="a3-card a3-pad a3-li a3-entry" onClick={() => onNavigateToTool?.('cakes')}>
            <span className="a3-ico-sq c-pink" aria-hidden="true">🎂</span>
            <span className="grow"><span className="a3-entry-title">{tr("dashboard_xususi_tortlar_ba1400", "Xüsusi Tortlar")}</span>
              <span className="a3-meta">{babyData.ageInMonths > 0 ? tr('dashboard_order_monthly_cake', '{n}-ci aylıq tortunu sifariş ver!').replace('{n}', String(babyData.ageInMonths + 1)) : tr("dashboard_korpeniz_ucun_milestone_tortla_3bcbc1", "Körpəniz üçün milestone tortları")}</span></span>
            <ChevronRight size={18} className="rtl:rotate-180" />
          </button>
        </section>
      }

      {/* Milestones with Carousel */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("dashboard_inkisaf_merheleleri_d6d887", "İnkişaf mərhələləri")}</h2>
          <span className="a-section-link">
            {allMilestones.filter((m) => m.achieved).length}/{allMilestones.length}
          </span>
        </div>
        <motion.div
          className="a-card a-fade-in"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}>
          
          {/* Carousel navigation + page indicator */}
          {hasMoreMilestones &&
          <div className="flex items-center justify-between mb-3">
              <motion.button
              onClick={() => setMilestonePageIndex((p) => Math.max(0, p - 1))}
              disabled={milestonePageIndex === 0}
              className="a-icon-btn"
              style={{ width: 30, height: 30 }}
              whileTap={{ scale: 0.9 }}>
              
                <ChevronRight size={15} className="rtl:rotate-180 rotate-180" />
              </motion.button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalMilestonePages }).map((_, i) =>
              <span
                key={i}
                style={{
                  width: i === milestonePageIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === milestonePageIndex ? 'var(--a-peach-2)' : 'var(--a-line-strong)',
                  transition: 'all 150ms ease'
                }} />

              )}
              </div>
              <motion.button
              onClick={() => setMilestonePageIndex((p) => Math.min(totalMilestonePages - 1, p + 1))}
              disabled={milestonePageIndex === totalMilestonePages - 1}
              className="a-icon-btn"
              style={{ width: 30, height: 30 }}
              whileTap={{ scale: 0.9 }}>
              
                <ChevronRight className="rtl:rotate-180" size={15} />
              </motion.button>
            </div>
          }
          
          <div className="flex justify-between overflow-hidden">
            {displayMilestones.map((milestone, index) =>
            <motion.button
              key={milestone.id}
              onClick={() => handleMilestoneClick(milestone.id)}
              className="text-center flex-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05 + index * 0.05 }}
              whileTap={{ scale: 0.9 }}>
              
                <div
                className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg mb-1 relative"
                style={milestone.achieved ?
                { background: 'var(--a-grad-peach)', boxShadow: '0 8px 16px -8px rgba(255, 157, 99, 0.8)' } :
                { background: 'var(--a-surface-soft)', opacity: 0.65 }}>
                  {milestone.emoji}
                  {milestone.achieved &&
                <div className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--a-green-2)' }}>
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                }
                </div>
                <span
                className="text-[10px] line-clamp-1"
                style={{ color: milestone.achieved ? 'var(--a-ink)' : 'var(--a-ink-soft)', fontWeight: milestone.achieved ? 700 : 500 }}>
                  {milestone.label}
                </span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </section>

      {/* Baby Crisis Calendar Widget - hide after week 75 (last crisis ends) */}
      {Math.floor(babyData.ageInDays / 7) <= 75 &&
      <div className="a-section">
          <BabyCrisisWidget
          babyAgeWeeks={Math.floor(babyData.ageInDays / 7)}
          babyName={babyData.name} />
        </div>
      }


      {/* Development Tips - Dynamic based on age */}
      <div className="a-section">
        <DevelopmentTipsWidget />
      </div>
    </div>);

};

interface DashboardProps {
  onOpenChat?: () => void;
  onNavigateToTool?: (tool: string) => void;
  onNavigate?: (screen: string) => void;
  /** Switches to the Anacan.AI tab. */
  onOpenAI?: () => void;
  /** Switches to the profile tab. */
  onOpenProfile?: () => void;
  /** Opens the global search sheet. */
  onSearch?: () => void;
  /** Extra top-bar actions (e.g. the Aptek cart). */
  topbarExtra?: React.ReactNode;
}

// Ask bar, day plan and upcoming cycle events, slotted under the flow hero.
const FlowHomeExtras = ({ ctx, onNavigateToTool, onNavigate, onOpenAI }: {ctx: FlowHeroContext;onNavigateToTool?: (tool: string) => void;onNavigate?: (screen: string) => void;onOpenAI?: () => void;}) => {
  const events = useMemo(() => [
  { date: ctx.nextPeriodDate, title: rd('ms_next_period') },
  { date: ctx.fertileStart, title: rd('ms_fertile_high') },
  { date: ctx.ovulationDate, title: rd('ms_ovulation') }],
  [ctx.nextPeriodDate, ctx.fertileStart, ctx.ovulationDate]);
  return (
    <>
      <AskBar placeholder={rd('ask_cycle')} onAsk={onOpenAI} />
      <DayPlan stage="flow" onNavigateToTool={onNavigateToTool} />
      <Upcoming
        events={events} />
    </>);
};

const Dashboard = ({ onOpenChat, onNavigateToTool, onNavigate, onOpenAI, onOpenProfile, onSearch, topbarExtra }: DashboardProps) => {
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


  // ——— Anacan redesign (github.com/Jmlsltnl/anacan-demo-app): mommy + bump + flow home ———
  if (lifeStage === 'mommy' || lifeStage === 'bump' || lifeStage === 'flow') {
    return (
      <div className="a-scope a-dash pb-6 overflow-x-hidden">
        <div className="a-shell">
          <HomeTopbar
            name={name || tr("dashboard_xanim_39ff6a", "Xanım")}
            avatarUrl={profile?.avatar_url}
            onSearch={onSearch}
            extra={<>{lifeStage === 'mommy' && <ChildSelector compact />}{topbarExtra}</>}
            onChat={lifeStage === 'mommy' ? undefined : onOpenChat}
            chatUnread={totalUnread}
            onNotifications={onNavigate ? () => onNavigate('notifications') : undefined}
            notificationCount={notificationCount}
            onProfile={onOpenProfile} />

          {/* Top Banner Slot */}
          <BannerSlot placement="home_top" onNavigate={() => {}} onToolOpen={onNavigateToTool} className="mb-2" />
          <AdFreePremiumOffer position="top" />

          {lifeStage === 'mommy' && <MommyDashboard onNavigateToTool={onNavigateToTool} onNavigate={onNavigate} onOpenAI={onOpenAI} />}
          {lifeStage === 'bump' && <BumpDashboard onNavigateToTool={onNavigateToTool} onNavigate={onNavigate} onOpenAI={onOpenAI} />}
          {lifeStage === 'flow' && <FlowDashboard afterHero={(c) => <FlowHomeExtras ctx={c} onNavigateToTool={onNavigateToTool} onNavigate={onNavigate} onOpenAI={onOpenAI} />} />}
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
