import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { saveScroll, restoreScroll } from '@/lib/scrollMemory';
import { pushBackHandler } from '@/lib/backButton';
import { isToolFree, isCakesAvailable } from '@/lib/freemium';
import { motion } from 'framer-motion';
import {
  Search, Shield, Timer, Scale, Baby, Briefcase,
  Volume2, Heart, Footprints, ChevronRight,
  Utensils, Activity, ArrowLeft, Camera, Lock, ShoppingCart, LucideIcon, Wrench, BookOpen, ChefHat,
  Stethoscope, Droplet, ImagePlus, Package, Mic, Scan, CloudSun, Gauge, Store,
  MapPin, Gamepad2, ShieldAlert, BookHeart, Stars, Crown, Ruler, Sparkles, TrendingUp, Zap,
  Pill, Cake, Syringe, Dumbbell, Brain } from
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
import { PremiumModal } from './PremiumModal';
import PremiumToolBoundary from './premium/PremiumToolBoundary';

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
  'Brain': Brain
};

// Import Calculator icon
import { Calculator } from 'lucide-react';
import { tr } from "@/lib/tr";
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { followupText } from '@/lib/followup-i18n';
import { localizedCountryName } from '@/lib/app-languages';
import { regionalCountry } from '@/lib/vaccine-schedule';

interface ToolsHubProps {
  initialTool?: string | null;
  onBack?: () => void;
}

const ToolsHub = ({ initialTool = null, onBack }: ToolsHubProps = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(initialTool);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Alət açılanda yuxarıdan başla; siyahıya QAYIDANDA isə əvvəlki
  // pozisiya bərpa olunur (restoreScroll useScrollToTop resetindən sonra qalib gəlir).
  useScrollToTop([activeTool]);
  const prevToolRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevToolRef.current && !activeTool) restoreScroll('toolshub');
    prevToolRef.current = activeTool;
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
    if (!isPremium && !isToolFree(toolId)) {
      import('@/lib/analytics').then((m) => m.analytics.logPaywallShown(toolId)).catch(() => {});
      setShowPremiumModal(true);
      return;
    }
    openTool(toolId);
  };
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
  const { data: toolConfigs = [], isLoading: toolsLoading } = useToolConfigs(isAdmin ? undefined : lifeStage || undefined);

  const hasPartner = !!profile?.linked_partner_id;

  // Get locked field based on life stage
  const getLockedStatus = (config: ToolConfig): boolean => {
    if (lifeStage === 'flow') return config.flow_locked || false;
    if (lifeStage === 'bump') return config.bump_locked || false;
    if (lifeStage === 'mommy') return config.mommy_locked || false;
    return false;
  };

  // Build tools from DB configs
  const isNonAz = language !== 'az';
  const { disabledTools, isToolDisabled } = useDisabledTools();
  const tools: Tool[] = useMemo(() => {
    if (toolConfigs.length === 0) {
      return [];
    }

    // Filter out tools disabled for the current language
    const activeConfigs = toolConfigs.filter((config) => !disabledTools.includes(config.tool_id));

    return activeConfigs.map((config) => {
      const name = hasPartner && config.requires_partner && config.partner_name ?
      config.partner_name :
      (config as any).display_name || config.name;

      const description = ['names','baby-names'].includes(config.tool_id) ? followupText('names_country', language, { country: localizedCountryName(regionalCountry(language, profile?.country_code, storeCountry), language) }) : hasPartner && config.requires_partner && config.partner_description ?
      config.partner_description :
      config.description || '';


      return {
        id: config.tool_id,
        name,
        description,
        icon: iconMap[config.icon] || Wrench,
        color: config.color,
        bgColor: config.bg_color,
        minWeek: config.min_week || undefined,
        stages: config.life_stages,
        // Freemium siyasəti (yalnız bu build): free siyahısında olmayan HƏR alət premium.
        // DB flag-larına toxunulmur → köhnə versiyalar təsirlənmir.
        isPremium: (config.is_premium || false) || !isToolFree(config.tool_id),
        premiumType: config.premium_type || 'none',
        premiumLimit: config.premium_limit || 0,
        isLocked: getLockedStatus(config)
      };
    });
  }, [toolConfigs, hasPartner, lifeStage, language, isNonAz, disabledTools, profile?.country_code, storeCountry]);

  // Set initial tool from props on mount (Dashboard qısayolları / banner deeplink-ləri)
  // Freemium: free olmayan alət premium-suz açılmır — paywall göstərilir.
  useEffect(() => {
    if (initialTool) {
      if (!isPremium && !isToolFree(initialTool)) {
        import('@/lib/analytics').then((m) => m.analytics.logPaywallShown(initialTool)).catch(() => {});
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
          description: tr("toolshub_only_maternity_use", "Bu alət yalnız hamiləlik dövründə istifadə oluna bilər"),
          variant: 'destructive'
        });
      }
      return;
    }

    if (tool.isLocked && !isPremium) {
      import('@/lib/analytics').then((m) => m.analytics.logPaywallShown(tool.id)).catch(() => {});
      setShowPremiumModal(true);
      return;
    }

    if (tool.isPremium && !isPremium) {
      import('@/lib/analytics').then((m) => m.analytics.logPaywallShown(tool.id)).catch(() => {});
      setShowPremiumModal(true);
      return;
    }

    // Track tool opened
    import('@/lib/analytics').then((m) => m.analytics.logToolOpened(tool.id, tool.name)).catch(() => {});
    openTool(tool.id);
  };

  // Get hero tool IDs to exclude from grid
  const heroToolIds = new Set(toolConfigs.filter((t) => t.is_hero).map((t) => t.tool_id));

  // Filter by search and category, exclude hero tools from grid
  const filteredTools = tools.filter((tool) => {
    if (heroToolIds.has(tool.id)) return false;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Inject virtual Cakes tool (moved here from bottom nav)
  const cakesVirtual: Tool = {
    id: 'cakes',
    name: 'Tortlar',
    description: tr("toolshub_xususi_gunler_ucun_tortlar_8a2248", "X\xFCsusi g\xFCnl\u0259r \xFC\xE7\xFCn tortlar"),
    icon: Cake,
    color: 'pink',
    bgColor: 'pink',
    stages: ['bump', 'mommy']
  };
  // Tortlar: yalnız AZ bazarı (dil az/ru + ölkə AZ) — admin istisna
  const cakesMarketOk = isAdmin || isCakesAvailable((profile as any)?.country_code, language);
  const showCakes = !isToolDisabled('cakes') && cakesMarketOk && (lifeStage === 'bump' || lifeStage === 'mommy' || isAdmin) && (
  cakesVirtual.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  cakesVirtual.description.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayedTools: Tool[] = showCakes ? [cakesVirtual, ...filteredTools] : filteredTools;

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


  // Render active tool
  const toolComponent = (() => {
    switch (activeTool) {
      case 'photoshoot':return <BabyPhotoshoot onBack={handleBack} />;
      case 'nutrition':return <Nutrition onBack={handleBack} />;
      case 'shopping':return <ShoppingList onBack={handleBack} />;
      case 'safety':return <SafetyLookup onBack={handleBack} />;
      case 'kick':return <KickCounter onBack={handleBack} />;
      case 'contraction':return <ContractionTimer onBack={handleBack} />;
      case 'weight':return <WeightTracker onBack={handleBack} />;
      case 'whitenoise':case 'white-noise':return <WhiteNoise onBack={handleBack} />;
      case 'names':return <BabyNames onBack={handleBack} />;
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
      case 'mini-games':return <MiniGamesHub onBack={handleBack} />;
      default:return null;
    }
  })();

  if (toolComponent) {
    const config = toolConfigs.find(config => config.tool_id === activeTool);
    const protectedTool = !isToolFree(activeTool!) || !!config?.is_premium || !!config && getLockedStatus(config);
    return (
      protectedTool ? <PremiumToolBoundary onClose={handleBack}><Suspense fallback={toolFallback}>{toolComponent}</Suspense></PremiumToolBoundary>
        : <Suspense fallback={toolFallback}>{toolComponent}</Suspense>);

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
  // Featured (hero) banner backgrounds cycle
  const HERO_BGS = ['var(--a-grad-lav)', 'var(--a-grad-peach)', 'var(--a-grad-green)', 'var(--a-grad-blue)'];
  // Dark mode düzəlişi: 3 hardcoded hex (#3c2e5c/#14532d/#153e57) dark modda
  // öz uyğun --a-grad-* fonlarının tünd tint-lərinə qarşı ~1:1 kontrast
  // verirdi (oxunmurdu) — TILE_INKS-dəki kimi CSS dəyişənlərinə keçirilib.
  const HERO_INKS = ['var(--a-lav-ink)', 'var(--a-cta-ink)', 'var(--a-green-ink)', 'var(--a-blue-ink)'];

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

        {/* Featured trio — Mini Games + DB hero tools as compact side-by-side tiles */}
        {!searchQuery &&
        (() => {
          const heroTools = toolConfigs.
          filter((t) => t.is_hero && !disabledTools.includes(t.tool_id)).
          sort((a, b) => (a.hero_order || 0) - (b.hero_order || 0));

          const featuredItems: {key: string;label: string;icon: LucideIcon;emoji?: string;bg: string;ink: string;premium: boolean;onClick: () => void;}[] = [];

          if (!isToolDisabled('mini-games')) {
            featuredItems.push({
              key: 'mini-games',
              label: tr("toolshub_minigames_title", "Mini Oyunlar"),
              icon: Gamepad2,
              bg: 'var(--a-grad-green)',
              ink: 'var(--a-green-ink)',
              premium: !isToolFree('mini-games'),
              onClick: () => gatedOpenTool('mini-games')
            });
          }

          heroTools.forEach((hero, idx) => {
            const HeroIcon = iconMap[hero.icon] || Wrench;
            const displayName = (hero as any).display_name || hero.name;
            featuredItems.push({
              key: hero.tool_id,
              label: displayName,
              icon: HeroIcon,
              bg: HERO_BGS[idx % HERO_BGS.length],
              ink: HERO_INKS[idx % HERO_INKS.length],
              premium: !!hero.is_premium || !isToolFree(hero.tool_id),
              onClick: () => gatedOpenTool(hero.tool_id)
            });
          });

          if (featuredItems.length === 0) return null;

          return (
            <section className="a-section">
              <div className="a-section-head">
                <h2 className="a-section-title a-heading">{tr("toolshub_featured_title", "Seçilmişlər")}</h2>
              </div>
              <div className="a-trio" style={{ gridTemplateColumns: `repeat(${Math.min(3, featuredItems.length)}, 1fr)` }}>
                {featuredItems.slice(0, 3).map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <motion.button
                      key={item.key}
                      onClick={item.onClick}
                      className="a-trio-item a-fade-in"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileTap={{ scale: 0.92 }}>
                      
                      {item.premium &&
                      <span className="a-crown-chip">
                          <Crown size={11} strokeWidth={2.6} />
                        </span>
                      }
                      <span className="a-trio-icon" style={{ background: item.bg, color: item.ink }}>
                        <ItemIcon size={17} strokeWidth={2} />
                      </span>
                      <p className="a-trio-label" style={{ color: 'var(--a-ink)' }}>{item.label}</p>
                    </motion.button>);

                })}
              </div>
            </section>);

        })()
        }

        {/* Tools grid section */}
        <section className="a-section">
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">
              {searchQuery ? `${displayedTools.length} ${tr("toolshub_netice", "nəticə")}` : tr("toolshub_butun_aletler_88b643", "B\xFCt\xFCn Al\u0259tl\u0259r")}
            </h2>
            <span className="a-section-link">
              {displayedTools.length} {tr("toolshub_alet_9a099a", "al\u0259t")}
            </span>
          </div>

          {/* Tools Grid - anacan-demo 2 columns */}
          <AdInlineAnchor id="tools_banner" />
          <div className="a-tool-grid">
            {/* layout/popLayout yoxdur: axtarışda hər kafel üçün layout ölçmə zəif cihazları dondururdu */}
              {displayedTools.map((tool, index) => {
                const Icon = tool.icon;
                const available = isToolAvailable(tool);
                const needsPremium = (tool.isLocked || tool.isPremium) && !isPremium;

                return (
                  <motion.button
                    key={tool.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(index * 0.015, 0.18) }}
                    onClick={() => tool.id === 'cakes' ? openTool('cakes') : handleToolClick(tool)}
                    className="a-tool-tile"
                    style={!available ? { opacity: 0.4 } : undefined}>
                    
                    {/* Premium/Lock indicator */}
                    {needsPremium &&
                    <span className="a-crown-chip">
                        <Lock size={10} strokeWidth={2.6} />
                      </span>
                    }
                    {!needsPremium && tool.isPremium &&
                    <span className="a-crown-chip">
                        <Crown size={10} strokeWidth={2.6} />
                      </span>
                    }
                    
                    {/* Icon */}
                    <span className="a-tool-icon" style={{ background: TILE_GRADIENTS[index % TILE_GRADIENTS.length], color: TILE_INKS[index % TILE_INKS.length] }}>
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    
                    <p className="a-tool-title">{tool.name}</p>
                    <p className="a-tool-sub">
                      {(() => {
                        if (language === 'en' && tool.id === 'photoshoot') return 'Create magical photoshoots for your baby';
                        if (language === 'en' && tool.id === 'recipes' && tool.description?.includes('resept')) return 'Healthy and delicious recipes';
                        return tool.description;
                      })()}
                    </p>
                  </motion.button>);

              })}
          </div>
        </section>

        {/* Empty State */}
        {displayedTools.length === 0 &&
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
        feature="tool" />
      
    </div>);

};

export default ToolsHub;
