import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { saveScroll, restoreScroll } from '@/lib/scrollMemory';
import { pushBackHandler } from '@/lib/backButton';
import { isToolFree, isCakesAvailable, toolAccess, type ToolAccess } from '@/lib/freemium';
import { isPlayTileVisible } from '@/lib/play-together';
import { foldText } from '@/lib/parenting-search';
import { motion } from 'framer-motion';
import {
  Search, Shield, Timer, Scale, Baby, Briefcase,
  Volume2, Heart, Footprints, ChevronRight,
  Utensils, Activity, ArrowLeft, Camera, Lock, ShoppingCart, LucideIcon, Wrench, BookOpen, ChefHat,
  Stethoscope, Droplet, ImagePlus, Package, Mic, Scan, CloudSun, Gauge, Store,
  MapPin, Gamepad2, ShieldAlert, BookHeart, Stars, Crown, Ruler, Sparkles, TrendingUp, Zap,
  Pill, Cake, Syringe, Dumbbell, Brain, Sprout, HeartHandshake, WifiOff, RefreshCw } from
'lucide-react';
import BlogScreen from '@/components/BlogScreen';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
const SafetyLookup = lazy(() => import('./tools/SafetyLookup'));
const KickCounter = lazy(() => import('./tools/KickCounter'));
const ContractionTimer = lazy(() => import('./tools/ContractionTimer'));
const WeightTracker = lazy(() => import('./tools/WeightTracker'));
const WhiteNoise = lazy(() => import('./tools/WhiteNoise'));
const BabyNames = lazy(() => import('./tools/BabyNames'));
const HospitalBag = lazy(() => import('./tools/HospitalBag'));
const Nutrition = lazy(() => import('./tools/Nutrition'));
const Exercises = lazy(() => import('./tools/Exercises'));
const MoodDiary = lazy(() => import('./tools/MoodDiary'));
const BabyPhotoshoot = lazy(() => import('./tools/BabyPhotoshoot'));
const ShoppingList = lazy(() => import('./tools/ShoppingList'));
const Recipes = lazy(() => import('./tools/Recipes'));
const DoctorsHospitals = lazy(() => import('./tools/DoctorsHospitals'));
const BloodSugarTracker = lazy(() => import('./tools/BloodSugarTracker'));
const BloodPressureTracker = lazy(() => import('./tools/BloodPressureTracker'));
const DangerSignsScreen = lazy(() => import('./tools/DangerSignsScreen'));
const PreemieHubScreen = lazy(() => import('./tools/PreemieHubScreen'));
const PregnancyAlbum = lazy(() => import('./tools/PregnancyAlbum'));
const AffiliateProducts = lazy(() => import('./tools/AffiliateProducts'));
const CryTranslator = lazy(() => import('./tools/CryTranslator'));
const PoopScanner = lazy(() => import('./tools/PoopScanner'));
const WeatherClothing = lazy(() => import('./tools/WeatherClothing'));
const NoiseMeter = lazy(() => import('./tools/NoiseMeter'));
const SecondHandMarket = lazy(() => import('./tools/SecondHandMarket'));
const MomFriendlyMap = lazy(() => import('./tools/MomFriendlyMap'));
const SmartPlayBox = lazy(() => import('./tools/SmartPlayBox'));
const PlayTogetherTool = lazy(() => import('./tools/play/PlayTogetherTool'));
const MentalHealthTracker = lazy(() => import('./tools/MentalHealthTracker'));
const FirstAidGuide = lazy(() => import('./tools/FirstAidGuide'));
const FairyTaleGenerator = lazy(() => import('./tools/FairyTaleGenerator'));
const HoroscopeCompatibility = lazy(() => import('./tools/HoroscopeCompatibility'));
const BabyGrowthTracker = lazy(() => import('./tools/BabyGrowthTracker'));
const FetalGrowthTracker = lazy(() => import('./tools/FetalGrowthTracker'));
const MaternityCalculator = lazy(() => import('./tools/MaternityCalculator'));
const TeethingTracker = lazy(() => import('./tools/TeethingTracker'));
const VitaminTracker = lazy(() => import('./tools/VitaminTracker'));
const VaccineCalendar = lazy(() => import('./tools/VaccineCalendar'));
const BabyMonthlyAlbum = lazy(() => import('./baby/BabyMonthlyAlbum'));
const CakesScreen = lazy(() => import('./CakesScreen'));
const MiniGamesHub = lazy(() => import('./games/MiniGamesHub'));
const BabyTracker = lazy(() => import('./tools/BabyTracker'));
const SleepTraining = lazy(() => import('./tools/SleepTraining'));
const SolidFoodGuide = lazy(() => import('./tools/SolidFoodGuide'));
const WeaningTool = lazy(() => import('./tools/weaning/WeaningTool'));
const ParentingTool = lazy(() => import('./tools/parenting/ParentingTool'));
// Aptek product hits under the tool search; loaded only once the user types.
const AptekSearchResults = lazy(() => import('./aptek/AptekEntry').then((m) => ({ default: m.AptekSearchResults })));
const openAptek = (screen: string) =>
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen } }));
const foldQuery = (v: string) => v.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
import { PremiumModal } from './PremiumModal';
import PremiumToolBoundary from './premium/PremiumToolBoundary';
import { ToolSectionsContext, type ToolSectionsValue } from './tools/anacan/ToolKit';
import { HOST_SECTIONS, TOOL_COMPANION, canonicalToolId, isMergedAway, resolveToolTarget } from '@/lib/merged-tools';

import { useToast } from '@/hooks/use-toast';
import { useToolConfigs, ToolConfig } from '@/hooks/useDynamicTools';
import BannerSlot from '@/components/banners/BannerSlot';
import { AdInlineAnchor, AdSurface } from '@/components/ads/AdExperienceProvider';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  minWeek?: number;
  stages?: string[];
  isPremium?: boolean;
  premiumType?: string;
  premiumLimit?: number;
  isLocked?: boolean;
  /** Free users can open it; the tool enforces its own free limit (premium_type limited_* or code list). */
  limited?: boolean;
  preview?: boolean;
}

// Icon mapping for dynamic tool configs
const iconMap: Record<string, LucideIcon> = {
  'Ruler': Ruler,
  'Camera': Camera,
  'Utensils': Utensils,
  'ShoppingCart': ShoppingCart,
  'Shield': Shield,
  'Footprints': Footprints,
  'Timer': Timer,
  'Scale': Scale,
  'Baby': Baby,
  'Briefcase': Briefcase,
  'Volume2': Volume2,
  'Activity': Activity,
  'Heart': Heart,
  'Wrench': Wrench,
  'BookOpen': BookOpen,
  'ChefHat': ChefHat,
  'Stethoscope': Stethoscope,
  'Droplet': Droplet,
  'ImagePlus': ImagePlus,
  'Package': Package,
  'Mic': Mic,
  'Scan': Scan,
  'CloudSun': CloudSun,
  'Gauge': Gauge,
  'Store': Store,
  'MapPin': MapPin,
  'Gamepad2': Gamepad2,
  'ShieldAlert': ShieldAlert,
  'BookHeart': BookHeart,
  'Stars': Stars,
  'Calculator': Calculator,
  'Pill': Pill,
  'Syringe': Syringe,
  'TrendingUp': TrendingUp,
  'Dumbbell': Dumbbell,
  'Brain': Brain,
  'Sprout': Sprout,
  'HeartHandshake': HeartHandshake
};

// Import Calculator icon
import { Calculator, MoonStar, Puzzle, Salad } from 'lucide-react';
import { bc } from '@/lib/babycare-i18n';
import { feature37Text } from '@/lib/feature37-i18n';
import { sleepTrainingEligible } from '@/lib/sleep-training';
import { useChildren } from '@/hooks/useChildren';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import { tr } from "@/lib/tr";
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { followupText } from '@/lib/followup-i18n';
import { localizedCountryName } from '@/lib/app-languages';
import { regionalCountry } from '@/lib/vaccine-schedule';
import { useAppSetting } from '@/hooks/useAppSettings';
import { isWeaningTileVisible } from '@/lib/weaning';
import { wt as weaningText } from '@/lib/weaning-copy';
import { isParentingTileVisible } from '@/lib/parenting';
import { pt as parentingText } from '@/lib/parenting-copy';
import { usePrefetchFirstAid } from '@/hooks/useFirstAid';

interface ToolsHubProps {
  initialTool?: string | null;
  onBack?: () => void;
}

const ToolsHub = ({ initialTool = null, onBack }: ToolsHubProps = {}) => {
  // First aid must work offline: cache every scenario in the background while there is a connection.
  usePrefetchFirstAid();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(initialTool);
  // Section of a merged tool (src/lib/merged-tools.ts); reset whenever another tool opens.
  const [toolSection, setToolSection] = useState<string | null>(null);
  useEffect(() => { setToolSection(null); }, [activeTool]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  /** Which tool opened the paywall (analytics source; before 2026-11-08 every hub paywall was logged as 'tool'). */
  const [paywallTool, setPaywallTool] = useState<string | null>(null);

  // Alət açılanda yuxarıdan başla; siyahıya QAYIDANDA isə əvvəlki
  // pozisiya bərpa olunur (restoreScroll useScrollToTop resetindən sonra qalib gəlir).
  useScrollToTop([activeTool]);
  const prevToolRef = useRef<string | null>(null);
  // Tool session length: a visit of 5 s or more is logged as tool_used/session when the tool closes or the hub unmounts.
  const toolSessionRef = useRef<{ id: string; start: number } | null>(null);
  useEffect(() => {
    const flush = () => {
      const s = toolSessionRef.current;
      toolSessionRef.current = null;
      if (!s) return;
      const seconds = (Date.now() - s.start) / 1000;
      if (seconds >= 5) import('@/lib/analytics').then((m) => m.analytics.logToolSession(s.id, seconds)).catch(() => {});
    };
    flush();
    if (activeTool && (isPremium || accessFor(activeTool) !== 'premium')) toolSessionRef.current = { id: activeTool, start: Date.now() };
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);
  useEffect(() => () => {
    const s = toolSessionRef.current;
    if (s && (Date.now() - s.start) / 1000 >= 5) {
      const seconds = (Date.now() - s.start) / 1000;
      import('@/lib/analytics').then((m) => m.analytics.logToolSession(s.id, seconds)).catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (prevToolRef.current && !activeTool) restoreScroll('toolshub');
    // One tool_opened per real open, whatever the entry point (hub, dashboard shortcut, deep link, push).
    // Premium tools a free user cannot open show the paywall instead and are logged as paywall views.
    if (activeTool && activeTool !== prevToolRef.current && (isPremium || accessFor(activeTool) !== 'premium')) {
      import('@/lib/analytics').then((m) => m.analytics.logToolOpened(activeTool)).catch(() => {});
    }
    prevToolRef.current = activeTool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // Android geri: açıq alət → alətlər siyahısına qayıt (Index-dən ƏVVƏL işləyir)
  useEffect(() => {
    if (!activeTool) return;
    return pushBackHandler(() => {
      if (onBack && initialTool) {
        onBack(); // Dashboard-dan açılıb → Dashboard-a
      } else {
        setActiveTool(null);
      }
      return true;
    });
  }, [activeTool, onBack, initialTool]);

  const openTool = (toolId: string) => {
    saveScroll('toolshub'); // geri qayıdanda siyahı pozisiyası bərpa olunsun
    setActiveTool(toolId);
  };

  // Freemium gate — hero/mini-games kimi birbaşa açılışlar üçün
  const gatedOpenTool = (toolId: string) => {
    if (!isPremium && accessFor(toolId) === 'premium') {
      setPaywallTool(toolId); // the modal logs the paywall view with this tool id
      setShowPremiumModal(true);
      return;
    }
    openTool(toolId);
  };
  const childrenInfo = useChildren();
  const childBirthDate = (childrenInfo.selectedChild ?? childrenInfo.children[0])?.birth_date ?? null;
  const { lifeStage, getPregnancyData } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, getPregnancyData: s.getPregnancyData }))
  );
  const { profile, isAdmin } = useAuth();
  const { isPremium } = useSubscription();
  const { toast } = useToast();
  const pregData = getPregnancyData();
  const language = useUserStore((state) => state.language);
  const storeCountry = useUserStore(state => state.countryCode);
  // Admins see ALL tools regardless of life stage
  const {
    data: toolConfigs = [], isPending: toolsPending, isError: toolsError, fetchStatus: toolsFetchStatus, refetch: refetchTools,
  } = useToolConfigs(isAdmin ? undefined : lifeStage || undefined);
  // First launch / offline: no cached config yet. Show a skeleton while it loads and a retry card when it cannot load
  // (error, or paused because the device is offline); "not found" is only for a real empty search.
  const configsMissing = toolConfigs.length === 0;
  const toolsLoadFailed = configsMissing && (toolsError || (toolsPending && toolsFetchStatus === 'paused'));
  const toolsLoading = configsMissing && !toolsLoadFailed && (toolsPending || toolsFetchStatus === 'fetching');

  const hasPartner = !!profile?.linked_partner_id;

  // Get locked field based on life stage
  const getLockedStatus = (config: ToolConfig): boolean => {
    if (lifeStage === 'flow') return config.flow_locked || false;
    if (lifeStage === 'bump') return config.bump_locked || false;
    if (lifeStage === 'mommy') return config.mommy_locked || false;
    return false;
  };

  // Free / limited / premium for one tool id; DB config (premium flag, admin premium_type, stage lock) when loaded.
  const accessFor = (toolId: string): ToolAccess => {
    const config = toolConfigs.find((c) => c.tool_id === toolId);
    return config
      ? toolAccess({ toolId, isPremiumFlag: config.is_premium, premiumType: config.premium_type, stageLocked: getLockedStatus(config) })
      : toolAccess({ toolId });
  };

  // Build tools from DB configs
  const isNonAz = language !== 'az';
  const { disabledTools, isToolDisabled } = useDisabledTools();
  // Süddən ayırma: Ana module only, active child 9+ months, admin switch app_settings.weaning_tool = 'on'.
  const weaningSetting = useAppSetting('weaning_tool');
  const showWeaning = !disabledTools.includes('weaning') && isWeaningTileVisible({ lifeStage, birthDate: childBirthDate, setting: weaningSetting });
  // Tərbiyə: Ana module, content registered for the app language, child under 13, app_settings.parenting_tool = 'on'.
  const parentingSetting = useAppSetting('parenting_tool');
  const showParenting = !disabledTools.includes('parenting') && isParentingTileVisible({ lifeStage, language, birthDate: childBirthDate, birthDates: (childrenInfo.children ?? []).map((c) => c.birth_date), setting: parentingSetting });
  const tools: Tool[] = useMemo(() => {
    if (toolConfigs.length === 0) {
      return [];
    }

    // Filter out tools disabled for the current language
    const activeConfigs = toolConfigs.filter((config) => !disabledTools.includes(config.tool_id) && (config.tool_id !== 'weaning' || showWeaning) && (config.tool_id !== 'parenting' || showParenting)
      // Code tools keep their own eligibility; their rows only carry order and per-stage visibility (src/lib/code-tools.ts).
      && (config.tool_id !== 'cakes' || ((isAdmin || isCakesAvailable((profile as any)?.country_code, language)) && (lifeStage === 'bump' || lifeStage === 'mommy' || isAdmin)))
      && (config.tool_id !== 'solid-food-guide' || lifeStage === 'mommy')
      && (config.tool_id !== 'play-together' || isPlayTileVisible({ lifeStage, language, isAdmin }))
      && (config.tool_id !== 'sleep-training' || sleepTrainingEligible({ lifeStage, birthDate: childBirthDate ? new Date(childBirthDate) : null, now: new Date() })));
    // Name, description and icon of code tools come from code translations (all 23 languages), not from the row.
    const codeMeta = (id: string): { name: string; description: string; icon: typeof Wrench } | null => {
      switch (id) {
        case 'cakes': return { name: tr('toolshub_cakes_name', 'Tortlar'), description: tr("toolshub_xususi_gunler_ucun_tortlar_8a2248", "X\xFCsusi g\xFCnl\u0259r \xFC\xE7\xFCn tortlar"), icon: Cake };
        case 'mini-games': return { name: tr("toolshub_minigames_title", "Mini Oyunlar"), description: '', icon: Gamepad2 };
        case 'baby-tracker': return { name: bc('babytracker_tool_name'), description: bc('babytracker_tool_desc'), icon: Baby };
        case 'sleep-training': return { name: bc('sleeptraining_title'), description: bc('sleeptraining_tool_desc'), icon: MoonStar };
        case 'solid-food-guide': return { name: feature37Text('sfg_home_title', language), description: feature37Text('sfg_tool_desc', language), icon: Salad };
        case 'parenting': return { name: parentingText('par_tool_name'), description: parentingText('par_tool_desc'), icon: HeartHandshake };
        // Azerbaijani only (isPlayTileVisible), so the name stays in code like the content.
        case 'play-together': return { name: 'Uşaqla oyun', description: 'Ekransız oyunlar və kitablar', icon: Puzzle };
        default: return null;
      }
    };

    const fromDb: Tool[] = activeConfigs.map((config) => {
      const name = hasPartner && config.requires_partner && config.partner_name ?
      config.partner_name :
      (config as any).display_name || config.name;

      const description = ['names','baby-names'].includes(config.tool_id) ? followupText('names_country', language, { country: localizedCountryName(regionalCountry(language, profile?.country_code, storeCountry), language) }) : hasPartner && config.requires_partner && config.partner_description ?
      config.partner_description :
      config.description || '';


      const meta = codeMeta(config.tool_id);
      const isWeaning = config.tool_id === 'weaning';
      const isParenting = config.tool_id === 'parenting';
      // Stage lock is tracked separately (isLocked), so access is computed without it here.
      const access = toolAccess({ toolId: config.tool_id, isPremiumFlag: config.is_premium, premiumType: config.premium_type });
      return {
        id: config.tool_id,
        name: meta ? meta.name : isWeaning ? weaningText('weaning_tool_name') : isParenting ? parentingText('par_tool_name') : name,
        description: meta ? meta.description : isWeaning ? weaningText('weaning_tool_desc') : isParenting ? parentingText('par_tool_desc') : description,
        icon: meta ? meta.icon : iconMap[config.icon] || Wrench,
        color: config.color,
        bgColor: config.bg_color,
        minWeek: config.min_week || undefined,
        stages: config.life_stages,
        // Freemium siyasəti (yalnız bu build): free siyahısında olmayan HƏR alət premium, "limitli" alətlər
        // (kod siyahısı və ya admin premium_type limited_total/limited_monthly) açılır, limit alətin içindədir.
        // DB flag-larına toxunulmur → köhnə versiyalar təsirlənmir.
        // preview tools (Ağ səs, Fotosessiya) sit in the Premium section but open for everyone; play/generate gates.
        isPremium: access === 'premium' || access === 'preview',
        preview: access === 'preview',
        limited: access === 'limited',
        premiumType: config.premium_type || 'none',
        premiumLimit: config.premium_limit || 0,
        isLocked: getLockedStatus(config)
      };
    });

    // Baby tracker and Sleep training are app-defined tools (no tool_configs row needed);
    // a DB row with the same id wins, and both respect disabled tools.
    const virtual = (id: string, name: string, description: string, icon: typeof Wrench): Tool => ({
      id, name, description, icon, color: 'pink', bgColor: 'pink', stages: ['mommy'],
      isPremium: toolAccess({ toolId: id }) === 'premium', limited: toolAccess({ toolId: id }) === 'limited',
      premiumType: 'none', premiumLimit: 0, isLocked: false,
    });
    const extra: Tool[] = [];
    // Körpə izləyicisi, Yuxu təlimi, Əlavə qida, Tərbiyə, Tortlar, Mini oyunlar: tool_configs rows (code tools).
    if (showWeaning && !fromDb.some((t) => t.id === 'weaning')) {
      extra.push(virtual('weaning', weaningText('weaning_tool_name'), weaningText('weaning_tool_desc'), Sprout));
    }
    return [...fromDb, ...extra];
  }, [toolConfigs, hasPartner, lifeStage, language, isNonAz, disabledTools, profile?.country_code, storeCountry, childBirthDate, showWeaning, showParenting, isAdmin]);

  // Set initial tool from props on mount (Dashboard qısayolları / banner deeplink-ləri)
  // Freemium: free olmayan alət premium-suz açılmır — paywall göstərilir.
  useEffect(() => {
    if (initialTool) {
      if (!isPremium && accessFor(initialTool) === 'premium') {
        setPaywallTool(initialTool); // the modal logs the paywall view with this tool id
        setShowPremiumModal(true);
        return;
      }
      setActiveTool(initialTool);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isToolAvailable = (tool: Tool) => {
    // Admins have full access to everything
    if (isAdmin) return true;

    if (tool.stages && !tool.stages.includes(lifeStage || '')) {
      return false;
    }
    if (tool.minWeek && lifeStage === 'bump') {
      const currentWeek = pregData?.currentWeek || 0;
      if (currentWeek < tool.minWeek) {
        return false;
      }
    }
    return true;
  };

  const handleToolClick = (tool: Tool) => {
    // Admins bypass all restrictions
    if (!isToolAvailable(tool)) {
      if (tool.minWeek && lifeStage === 'bump') {
        toast({
          title: `${tool.name} ${tr("toolshub_not_active_yet", "hələ aktiv deyil")}`,
          description: `${tr("toolshub_activate_after_week_prefix", "Bu alət")} ${tool.minWeek}${tr("toolshub_activate_after_week_suffix", ". həftədən sonra aktivləşəcək")}`,
          variant: 'destructive'
        });
      } else if (tool.stages) {
        toast({
          title: `${tool.name} ${tr("toolshub_not_available", "mövcud deyil")}`,
          description: tr("toolshub_not_for_stage", "Bu alət hazırkı mərhələ üçün nəzərdə tutulmayıb"),
          variant: 'destructive'
        });
      }
      return;
    }

    if (tool.preview && !tool.isLocked) {
      openTool(tool.id);
      return;
    }

    if (tool.isLocked && !isPremium) {
      setPaywallTool(tool.id); // the modal logs the paywall view with this tool id
      setShowPremiumModal(true);
      return;
    }

    if (tool.isPremium && !isPremium) {
      setPaywallTool(tool.id); // the modal logs the paywall view with this tool id
      setShowPremiumModal(true);
      return;
    }

    openTool(tool.id);
  };

  // Hero tools (admin "is_hero") lead their section in hero_order instead of a separate strip.
  const heroOrder = new Map(toolConfigs.filter((t) => t.is_hero).map((t) => [t.tool_id, t.hero_order || 0]));

  // Filter by search: accent-insensitive (ə/ı/ş/ç/ğ/ö/ü/İ and other diacritics fold to plain Latin).
  const foldedQuery = foldText(searchQuery);
  const matchesSearch = (...texts: string[]) => !foldedQuery || texts.some((t) => foldText(t).includes(foldedQuery));
  const filteredTools = tools.filter((tool) => matchesSearch(tool.name, tool.description));

  // Tortlar and Mini oyunlar are tool_configs rows now (code tools, src/lib/code-tools.ts): ordered like every other tool.
  // Tiles of tools that now live inside another tool are hidden where that host is available.
  const displayedTools: Tool[] = filteredTools.filter((t) => !isMergedAway(t.id, (id) => tools.some((x) => canonicalToolId(x.id) === id)));
  // Free vs Premium sections: a tool is free only when no DB flag, stage lock or freemium rule gates it.
  const byHero = (a: Tool, b: Tool) => (heroOrder.has(a.id) ? 0 : 1) - (heroOrder.has(b.id) ? 0 : 1) || (heroOrder.get(a.id) ?? 0) - (heroOrder.get(b.id) ?? 0);
  const freeTools = displayedTools.filter((t) => !t.isPremium && !t.isLocked).sort(byHero);
  const premiumTools = displayedTools.filter((t) => t.isPremium || t.isLocked).sort(byHero);

  const handleBack = () => {
    if (activeTool) {
      // If opened from Dashboard (onBack exists and we have initialTool), go back to Dashboard
      if (onBack && initialTool) {
        onBack();
      } else {
        // useScrollToTop([activeTool]) siyahını da yuxarıdan açır
        setActiveTool(null);
      }
    } else if (onBack) {
      onBack();
    }
  };

  const toolFallback =
  <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;


  // Render a tool by id
  const renderToolById = (toolId: string | null) => {
    switch (toolId) {
      case 'photoshoot':return <BabyPhotoshoot onBack={handleBack} />;
      case 'nutrition':return <Nutrition onBack={handleBack} />;
      case 'shopping':return <ShoppingList onBack={handleBack} />;
      case 'safety':return <SafetyLookup onBack={handleBack} />;
      case 'kick':return <KickCounter onBack={handleBack} />;
      case 'contraction':return <ContractionTimer onBack={handleBack} />;
      case 'weight':return <WeightTracker onBack={handleBack} />;
      case 'whitenoise':case 'white-noise':return <WhiteNoise onBack={handleBack} />;
      case 'names':case 'baby-names':return <BabyNames onBack={handleBack} />;
      case 'hospital':return <HospitalBag onBack={handleBack} />;
      case 'exercise':case 'exercises':return <Exercises onBack={handleBack} />;
      case 'mood':case 'mood-diary':return <MoodDiary onBack={handleBack} />;
      case 'blog':return <BlogScreen onBack={handleBack} />;
      case 'recipes':return <Recipes onBack={handleBack} />;
      case 'doctors':return <DoctorsHospitals onBack={handleBack} />;
      case 'blood-sugar':return <BloodSugarTracker onBack={handleBack} />;
      case 'blood-pressure':return <BloodPressureTracker onBack={handleBack} />;
      case 'danger-signs':return <DangerSignsScreen onBack={handleBack} />;
      case 'preemie-hub':return <PreemieHubScreen onBack={handleBack} />;
      case 'pregnancy-album':return <PregnancyAlbum onBack={handleBack} />;
      case 'baby-album':return <BabyMonthlyAlbum onBack={handleBack} />;
      case 'cry-translator':return <CryTranslator onBack={handleBack} />;
      case 'poop-scanner':return <PoopScanner onBack={handleBack} />;
      case 'weather-clothing':return <WeatherClothing onBack={handleBack} />;
      case 'noise-meter':return <NoiseMeter onBack={handleBack} />;
      case 'secondhand-market':case 'second-hand-market':return <SecondHandMarket onBack={handleBack} />;
      case 'mom-friendly-map':return <MomFriendlyMap onBack={handleBack} />;
      case 'smart-play-box':return <SmartPlayBox onBack={handleBack} />;
      case 'play-together':return <PlayTogetherTool onBack={handleBack} />;
      case 'mental-health':return <MentalHealthTracker onBack={handleBack} />;
      case 'first-aid':return <FirstAidGuide onBack={handleBack} />;
      case 'fairy-tale':return <FairyTaleGenerator onBack={handleBack} />;
      case 'horoscope':return <HoroscopeCompatibility onBack={handleBack} />;
      case 'baby-growth':case 'growth-tracker':return <BabyGrowthTracker onBack={handleBack} />;
      case 'fetal-growth':return <FetalGrowthTracker onBack={handleBack} />;
      case 'affiliate':case 'affiliate-products':return <AffiliateProducts onBack={handleBack} />;
      case 'maternity-calculator':case 'maternity':return <MaternityCalculator onBack={handleBack} />;
      case 'teething':case 'teething-tracker':return <TeethingTracker onBack={handleBack} />;
      case 'vaccine-calendar':case 'vaccines-calendar':return <VaccineCalendar onBack={handleBack} />;
      case 'vitamin-tracker':case 'vitamins':return <VitaminTracker onBack={handleBack} />;
      case 'cakes':return <CakesScreen onBack={handleBack} />;
      case 'baby-tracker':return <BabyTracker onBack={handleBack} />;
      case 'sleep-training':return <SleepTraining onBack={handleBack} />;
      case 'solid-food-guide':return <SolidFoodGuide onBack={handleBack} />;
      case 'weaning':return <WeaningTool onBack={handleBack} />;
      case 'parenting':return <ParentingTool onBack={handleBack} />;
      case 'mini-games':return <MiniGamesHub onBack={handleBack} />;
      default:return null;
    }
  };

  // Merged tools: a child id opens its host on that section; the host shows its sections as tabs under the
  // header, and the sleep pair links to each other with the tool's own (translated) description as a short intro.
  const toolAvailable = (id: string) => isAdmin || tools.some((t) => canonicalToolId(t.id) === id);
  const toolMeta = (id: string) => tools.find((t) => canonicalToolId(t.id) === id);
  const target = activeTool ? resolveToolTarget(activeTool, toolAvailable) : null;
  const hostSections = target ? (HOST_SECTIONS[target.host] ?? [target.host]).filter((id) => id === target.host || toolAvailable(id)) : [];
  const shownTool = target ? (toolSection && hostSections.includes(toolSection) ? toolSection : target.section) : null;
  const toolComponent = shownTool ? renderToolById(shownTool) : null;

  if (toolComponent && target && shownTool) {
    const companion = TOOL_COMPANION[shownTool];
    const companionOk = !!companion && toolAvailable(companion);
    const sectionCtx: ToolSectionsValue = {
      sections: hostSections.length > 1 ? hostSections.map((id) => ({ id, label: toolMeta(id)?.name ?? id, locked: !isPremium && accessFor(id) === 'premium' })) : undefined,
      active: shownTool,
      onSelect: (id) => {
        setToolSection(id);
        import('@/lib/analytics').then((m) => m.analytics.logToolUsed(target.host, 'section', id)).catch(() => {});
      },
      intro: companionOk ? toolMeta(shownTool)?.description || undefined : undefined,
      link: companionOk ? { label: toolMeta(companion)?.name ?? companion, onOpen: () => openTool(companion) } : undefined,
    };
    // Free and limited tools render directly (limited ones enforce their own free limit inside). A Premium
    // section of a free host shows the paywall and returns to the host when closed.
    const protectedTool = accessFor(shownTool) === 'premium';
    const closeGate = shownTool !== target.host ? () => setToolSection(target.host) : handleBack;
    return (
      <ToolSectionsContext.Provider value={sectionCtx}>
        {protectedTool ? <PremiumToolBoundary onClose={closeGate}><Suspense fallback={toolFallback}>{toolComponent}</Suspense></PremiumToolBoundary>
          : <Suspense fallback={toolFallback}>{toolComponent}</Suspense>}
      </ToolSectionsContext.Provider>);
  }

  const getLifeStageInfo = () => {
    switch (lifeStage) {
      case 'flow':return { label: tr("toolshub_dovriyye_f65b93", 'Dövriyyə'), emoji: '🌸' };
      case 'bump':return { label: tr("toolshub_hamilelik_e86feb", 'Hamiləlik'), emoji: '🤰' };
      case 'mommy':return { label: tr("toolshub_analiq_9e762d", 'Analıq'), emoji: '👶' };
      default:return { label: tr("toolshub_aletler_4778b4", 'Alətlər'), emoji: '✨' };
    }
  };

  const stageInfo = getLifeStageInfo();

  // anacan-demo tool tile gradient cycle
  const TILE_GRADIENTS = ['var(--a-grad-peach)', 'var(--a-grad-pink)', 'var(--a-grad-lav)', 'var(--a-grad-blue)', 'var(--a-grad-green)', 'var(--a-grad-yellow)'];
  const TILE_INKS = ['var(--a-accent-ink)', 'var(--a-berry-ink)', 'var(--a-lav-ink)', 'var(--a-blue-ink)', 'var(--a-green-ink)', 'var(--a-warn-ink)'];

  return (
    <div className="a-scope pb-8 overflow-x-hidden" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <AdSurface id="tools_banner" />
      <div className="a-shell">
        {/* Search header */}
        <div style={{ paddingTop: 14 }}>
          <div className="a-search">
            <span style={{ fontSize: 15 }}>{stageInfo.emoji}</span>
            <input
              type="text"
              placeholder={tr("toolshub_alet_axtarin_fad58b", "Alət axtarın...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={tr("toolshub_alet_axtarin_fad58b", "Alət axtarın...")} />
            
            {!searchQuery && <Search size={15} strokeWidth={2} color="var(--a-ink-faint)" />}
          </div>
        </div>

        {/* Top Banner */}
        <BannerSlot placement="tools_top" onNavigate={() => {}} onToolOpen={gatedOpenTool} className="mt-3" />

        {searchQuery.trim() &&
        <Suspense fallback={null}>
            <AptekSearchResults query={foldQuery(searchQuery)} close={() => setSearchQuery('')} onOpen={openAptek} />
          </Suspense>
        }

        {/* Tools: search results as one list, otherwise Ödənişsiz / Premium sections (compact 3-column tiles) */}
        <AdInlineAnchor id="tools_banner" />
        {toolsLoading &&
        <section className="a-section" aria-busy="true" aria-label={tr('hub_tools_loading', 'Alətlər yüklənir')}>
            <div className="a-section-head">
              <span className="animate-pulse" style={{ display: 'block', width: 120, height: 16, borderRadius: 8, background: 'var(--a-line)' }} />
            </div>
            <div className="a-tool-grid compact" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) =>
              <div key={i} className="a-tool-tile animate-pulse" style={{ cursor: 'default' }}>
                  <span className="a-tool-icon" style={{ background: 'var(--a-line)' }} />
                  <span style={{ display: 'block', width: '70%', height: 10, borderRadius: 5, background: 'var(--a-line)' }} />
                </div>
              )}
            </div>
          </section>
        }

        {toolsLoadFailed &&
        <div className="a-card a-section" role="alert" style={{ textAlign: 'center', padding: '28px 18px' }}>
            <WifiOff size={32} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} aria-hidden="true" />
            <p className="a-list-title" style={{ marginBottom: 3 }}>{tr('hub_tools_offline_title', 'Alətlər yüklənmədi')}</p>
            <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
              {tr('hub_tools_offline_sub', 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.')}
            </p>
            <button type="button" onClick={() => { void refetchTools(); }} className="a-btn-soft" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} aria-hidden="true" />{tr('hub_tools_retry', 'Yenidən cəhd edin')}
            </button>
          </div>
        }

        {!toolsLoading && (searchQuery.trim()
          ? [{ key: 'results', title: `${displayedTools.length} ${tr("toolshub_netice", "nəticə")}`, list: displayedTools, premiumSection: false }]
          : [{ key: 'free', title: tr("toolshub_free_tools", "Ödənişsiz alətlər"), list: freeTools, premiumSection: false },
             { key: 'premium', title: tr("toolshub_premium_tools", "Premium alətlər"), list: premiumTools, premiumSection: true }]
        ).filter((group) => group.list.length > 0).map((group) => (
          <section className="a-section" key={group.key} data-tour={`tools-${group.key}`}>
            <div className="a-section-head">
              <h2 className="a-section-title a-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {group.premiumSection && <Crown size={15} strokeWidth={2.4} style={{ color: 'var(--a-yellow-2)' }} />}
                {group.title}
              </h2>
              <span className="a-section-link">
                {group.premiumSection && isPremium ? tr("toolshub_premium_open", "Sizdə açıqdır") : `${group.list.length} ${tr("toolshub_alet_9a099a", "al\u0259t")}`}
              </span>
            </div>
            <div className="a-tool-grid compact">
              {group.list.map((tool, index) => {
                const Icon = tool.icon;
                const available = isToolAvailable(tool);
                const needsPremium = (tool.isLocked || tool.isPremium) && !isPremium;
                const limitedHint = !!tool.limited && !needsPremium && !isPremium;
                return (
                  <motion.button
                    key={tool.id}
                    data-tour={`tool-${tool.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index * 0.012, 0.15) }}
                    onClick={() => tool.id === 'cakes' ? openTool('cakes') : tool.id === 'mini-games' ? gatedOpenTool('mini-games') : handleToolClick(tool)}
                    className={`a-tool-tile${needsPremium ? ' is-locked' : ''}`}
                    aria-label={needsPremium ? `${tool.name} · Premium` : limitedHint ? `${tool.name} · ${tr('hub_tools_free_limited', 'Pulsuz · limitli')}` : tool.name}
                    style={!available ? { opacity: 0.4 } : undefined}>
                    {needsPremium && <span className="a-crown-chip"><Lock size={9} strokeWidth={2.8} /></span>}
                    <span className="a-tool-icon" style={{ background: TILE_GRADIENTS[index % TILE_GRADIENTS.length], color: TILE_INKS[index % TILE_INKS.length] }}>
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <p className="a-tool-title">{tool.name}</p>
                    {limitedHint &&
                    <span aria-hidden="true" style={{ marginTop: 3, fontSize: 9.5, fontWeight: 700, lineHeight: 1.2, color: 'var(--a-green-ink)' }}>
                        {tr('hub_tools_free_limited', 'Pulsuz · limitli')}
                      </span>
                    }
                  </motion.button>);
              })}
            </div>
          </section>
        ))}

        {/* Empty State: a real empty search (or an empty, successfully loaded list); never while loading/failed */}
        {displayedTools.length === 0 && !toolsLoading && !toolsLoadFailed &&
        <motion.div
          className="a-card a-section"
          style={{ textAlign: 'center', padding: '36px 18px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}>
          
            <Search size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} />
            <p className="a-list-title" style={{ marginBottom: 3 }}>{tr("toolshub_alet_tapilmadi_f358cb", "Alət tapılmadı")}</p>
            <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
              {searchQuery ? `"${searchQuery}" ${tr("toolshub_no_matching_tools", "ilə uyğun alət yoxdur")}` : tr("toolshub_bu_kateqoriyada_alet_yoxdur_6c04fc", "Bu kateqoriyada al\u0259t yoxdur")}
            </p>
            <motion.button
            onClick={() => {setSearchQuery('');}}
            className="a-btn-soft"
            style={{ marginTop: 14 }}
            whileTap={{ scale: 0.95 }}>
              {tr("toolshub_hamisini_goster_b13d82", "Ham\u0131s\u0131n\u0131 g\xF6st\u0259r")}
            
          </motion.button>
          </motion.div>
        }

        {/* Bottom Banner */}
        <BannerSlot placement="tools_bottom" onNavigate={() => {}} onToolOpen={gatedOpenTool} className="mt-6" />
      </div>

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="tool"
        analyticsSource={paywallTool ?? 'tool'} />
      
    </div>);

};

export default ToolsHub;
