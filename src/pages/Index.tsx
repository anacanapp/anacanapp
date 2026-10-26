import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { saveScroll, restoreScroll } from '@/lib/scrollMemory';
import SplashScreen, { needsBrandSplash } from '@/components/SplashScreen';
import StartupScreen from '@/components/StartupScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppIntroduction from '@/components/AppIntroduction';
import InitialLanguageScreen from '@/components/InitialLanguageScreen';
import AuthScreen from '@/components/AuthScreen';
import BottomNav from '@/components/BottomNav';
import AppRatingPrompt from '@/components/AppRatingPrompt';
import FloatingTimerWidget from '@/components/FloatingTimerWidget';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { isNative } from '@/lib/native';
import { useAuth } from '@/hooks/useAuth';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useDeviceToken } from '@/hooks/useDeviceToken';
import { usePendingTimerStops } from '@/hooks/usePendingTimerStops';
import { useForceUpdate } from '@/hooks/useForceUpdate';
import { useActiveBlock } from '@/hooks/useUserBlock';
import BlockedScreen from '@/components/BlockedScreen';
import CountryGate from '@/components/CountryGate';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { resetAppScrollPosition } from '@/lib/scroll';
import { initDeeplinkListener, ParsedDeeplink } from '@/lib/deeplink';
import { pushBackHandler } from '@/lib/backButton';
import { PUSH_NAV_EVENT, consumePendingPushNav, type PushNavIntent } from '@/lib/pushNav';
import { isCakesAvailable } from '@/lib/freemium';
import type { CommunityDeepLinkTarget } from '@/components/community/CommunityScreen';
import { AdSurface } from '@/components/ads/AdExperienceProvider';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { hasPendingOnboarding } from '@/lib/onboarding-model';
import { clearPendingBlog, pendingBlog, rememberBlog } from '@/lib/blog-links';
import { BLOG_MODULE_EVENT, consumeBlogModule, isBlogModule, rememberBlogModule, openBlogModule } from '@/lib/blog-module-navigation';
import type { BlogModule } from '@/lib/blog-editorial';
import { normalizeAppLanguage, isAppLanguage } from '@/lib/app-languages';
import BlogLinkHost from '@/components/blog/BlogLinkHost';

// PremiumOnboarding.PENDING_FUNNEL_KEY ilə sinxron saxlanmalıdır
// (lazy chunk-u pozmamaq üçün static import edilmir)
const PENDING_FUNNEL_KEY = 'anacan_pending_funnel';

// Lazy load heavy screens
const PremiumOnboarding = lazy(() => import('@/components/onboarding/PremiumOnboarding'));
const Dashboard = lazy(() => import('@/components/Dashboard'));
const ToolsHub = lazy(() => import('@/components/ToolsHub'));
const DoctorReportScreen = lazy(() => import('@/components/DoctorReportScreen'));
const AIChatScreen = lazy(() => import('@/components/AIChatScreen'));
const PartnerAIPremiumGate = lazy(() => import('@/components/partner/PartnerAIPremiumGate'));
const PartnerChatScreen = lazy(() => import('@/components/partner/PartnerChatScreen'));
const ShopScreen = lazy(() => import('@/components/ShopScreen'));
const AptekScreen = lazy(() => import('@/components/aptek/AptekScreen'));
const CakesScreen = lazy(() => import('@/components/CakesScreen'));
const ProfileScreen = lazy(() => import('@/components/ProfileScreen'));
const PartnerProfileScreen = lazy(() => import('@/components/PartnerProfileScreen'));
const NotificationsScreen = lazy(() => import('@/components/NotificationsScreen'));
const SettingsScreen = lazy(() => import('@/components/SettingsScreen'));
const HealthSyncScreen = lazy(() => import('@/components/HealthSyncScreen'));
const ReferralScreen = lazy(() => import('@/components/ReferralScreen'));
const CalendarScreen = lazy(() => import('@/components/CalendarScreen'));
const AdminPanel = lazy(() => import('@/components/AdminPanel'));
const ModeratorPanel = lazy(() => import('@/components/moderation/ModeratorPanel'));
const MyModerationDecisions = lazy(() => import('@/components/moderation/MyModerationDecisions'));
const MotherChatScreen = lazy(() => import('@/components/MotherChatScreen'));
const MessagesScreen = lazy(() => import('@/components/MessagesScreen'));
const CommunityScreen = lazy(() => import('@/components/community/CommunityScreen'));
const ProfileEditScreen = lazy(() => import('@/components/ProfileEditScreen'));
const HelpScreen = lazy(() => import('@/components/HelpScreen'));
const PrivacyScreen = lazy(() => import('@/components/PrivacyScreen'));
const PartnerPrivacyScreen = lazy(() => import('@/components/PartnerPrivacyScreen'));
const AppearanceScreen = lazy(() => import('@/components/AppearanceScreen'));
const UserProfileScreen = lazy(() => import('@/components/community/UserProfileScreen'));
const BillingScreen = lazy(() => import('@/components/BillingScreen'));
const BlogScreen = lazy(() => import('@/components/BlogScreen'));
const MommyPeriodTracker = lazy(() => import('@/components/mommy/MommyPeriodTracker'));
const LegalScreen = lazy(() => import('@/components/LegalScreen'));
const NameVotingScreen = lazy(() => import('@/components/partner/NameVotingScreen'));
const PartnerHospitalBagScreen = lazy(() => import('@/components/partner/PartnerHospitalBagScreen'));
const DailySummaryScreen = lazy(() => import('@/components/partner/DailySummaryScreen'));
// ── Partner Module 2.0 ──
import { GlobalSearch } from '@/components/home/GlobalSearch';
import { AptekSearchResults, AptekCartButton } from '@/components/aptek/AptekEntry';
const PartnerHomeScreen = lazy(() => import('@/components/partner/v2/PartnerHomeScreen'));
const PartnerTogetherScreen = lazy(() => import('@/components/partner/v2/PartnerTogetherScreen'));
const PartnerShoppingScreen = lazy(() => import('@/components/partner/v2/PartnerShoppingScreen'));
const PartnerAppointmentsScreen = lazy(() => import('@/components/partner/v2/PartnerAppointmentsScreen'));
const PartnerBabyDayScreen = lazy(() => import('@/components/partner/v2/PartnerBabyDayScreen'));
const PartnerWeeklyStatsScreen = lazy(() => import('@/components/partner/v2/PartnerWeeklyStatsScreen'));
const PartnerSurprisesScreen = lazy(() => import('@/components/partner/v2/PartnerSurprisesScreen'));
const HospitalRunScreen = lazy(() => import('@/components/partner/v2/HospitalRunScreen'));
const LiveContractionsScreen = lazy(() => import('@/components/partner/v2/LiveContractionsScreen'));
const PartnerSharingScreen = lazy(() => import('@/components/partner/v2/PartnerSharingScreen'));
const AlertReceiver = lazy(() => import('@/components/partner/v2/AlertReceiver'));
const PartnersScreen = lazy(() => import('@/components/partners/PartnersScreen'));
const AdPreferencesScreen = lazy(() => import('@/components/ads/AdPreferencesScreen'));
// Module scope: a lazy() created during render is a new component type every render.
const ForceUpdateScreen = lazy(() => import('@/components/ForceUpdateScreen'));

const suspenseFallback = <StartupScreen />;

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

type SwipeRestoreState =
  | { type: 'screen'; value: string }
  | { type: 'tool'; value: string; fromDashboard: boolean }
  | { type: 'mother-chat' }
  | { type: 'user-profile'; value: string }
  | null;

const IndexContent = ({ blogOverlayOpen }: { blogOverlayOpen: boolean }) => {
  const [showSplash, setShowSplash] = useState(needsBrandSplash);
  const [showIntro, setShowIntro] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [activeScreen, _setActiveScreen] = useState<string | null>(() => { const slug = pendingBlog(); return slug ? `blog/${slug}` : null; });
  // Bildiriş/push-tap/deeplink ilə "Community-də MƏHZ bu postu/şərhi/story-ni
  // aç" niyyəti — CommunityScreen-ə prop kimi ötürülür (bax applyIntent,
  // handleDeeplink, NotificationsScreen çağırışı aşağıda).
  const [communityDeepLink, setCommunityDeepLink] = useState<CommunityDeepLinkTarget | null>(null);

  // Scroll yaddaşı: alt-ekrana keçəndə cari tabın pozisiyası saxlanır,
  // GERİ qayıdanda (activeScreen → null) bərpa olunur.
  const activeTabRef = useRef('home');
  const setActiveScreen = useCallback((s: string | null) => {
    if (s) saveScroll(`tab:${activeTabRef.current}`);
    _setActiveScreen(s);
    if (s === null) restoreScroll(`tab:${activeTabRef.current}`);
  }, []);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMotherChat, setShowMotherChat] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [blogSection, setBlogSection] = useState<'feeding' | 'sleep' | 'diaper' | null>(null);
  const [toolOpenedFromDashboard, setToolOpenedFromDashboard] = useState(false);
  const [toolsResetKey, setToolsResetKey] = useState(0);
  // Ölkə məcburi seçildikdən sonra gate-i dərhal gizlətmək üçün (profil
  // refresh-i bir anlıq gecikə bilər — ekran yenidən parıldamasın)
  const [countryJustSet, setCountryJustSet] = useState(false);
  const { isAuthenticated, isOnboarded, role, hasSeenIntro, setHasSeenIntro, hasSelectedLanguage, setHasSelectedLanguage, lifeStage, hasCompletedFunnel, setFunnelCompleted, language, countryCode } = useUserStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      isOnboarded: s.isOnboarded,
      role: s.role,
      hasSeenIntro: s.hasSeenIntro,
      setHasSeenIntro: s.setHasSeenIntro,
      hasSelectedLanguage: s.hasSelectedLanguage,
      setHasSelectedLanguage: s.setHasSelectedLanguage,
      lifeStage: s.lifeStage,
      hasCompletedFunnel: s.hasCompletedFunnel,
      setFunnelCompleted: s.setFunnelCompleted,
      language: s.language,
      countryCode: s.countryCode,
    }))
  );
  const { isAdmin, loading, profile, user, profileLoaded } = useAuth();
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('blog_language');
    if (!isAppLanguage(requested || '') || requested === language) return;
    void import('@/lib/i18n').then(async ({ ensureLanguageReady }) => {
      await ensureLanguageReady(requested!); useUserStore.getState().setLanguage(normalizeAppLanguage(requested));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (isAuthenticated && profileLoaded) {
      const slug = pendingBlog();
      if (slug) { setActiveScreen(`blog/${slug}`); clearPendingBlog(); }
    }
  }, [isAuthenticated, profileLoaded, setActiveScreen]);
  useEffect(() => {
    const show = (module: BlogModule) => {
      if (!isAuthenticated || !profileLoaded) { rememberBlogModule(module); return; }
      consumeBlogModule();
      setActiveScreen(null); setShowMotherChat(false); setViewingUserId(null); setActiveTool(null);
      if (module === 'calendar') { setActiveScreen('calendar'); return; }
      if (module === 'hospitalBag' || module === 'babyGrowth') {
        setActiveTab('tools'); setActiveTool(module === 'hospitalBag' ? 'hospital' : 'baby-growth');
        setToolOpenedFromDashboard(true); setToolsResetKey(value => value + 1); return;
      }
      if (lifeStage !== 'mommy' || role === 'partner') { setActiveScreen('blog'); return; }
      setActiveTab('home'); setBlogSection(module);
    };
    const handler = (event: Event) => { const module = (event as CustomEvent).detail?.module; if (isBlogModule(module)) show(module); };
    window.addEventListener(BLOG_MODULE_EVENT, handler);
    if (isAuthenticated && profileLoaded) {
      const url = new URL(window.location.href), requested = url.searchParams.get('blog_module');
      const module = consumeBlogModule() || (isBlogModule(requested) ? requested : null);
      if (module) show(module);
      if (isBlogModule(requested)) { url.searchParams.delete('blog_module'); url.searchParams.delete('blog_language'); window.history.replaceState(window.history.state, '', url); }
    }
    return () => window.removeEventListener(BLOG_MODULE_EVENT, handler);
  }, [isAuthenticated, profileLoaded, lifeStage, role, setActiveScreen]);
  useEffect(() => {
    if (!blogSection || showSplash || loading || activeScreen || activeTab !== 'home') return;
    let count = 0;
    const timer = window.setInterval(() => {
      const element = document.querySelector<HTMLElement>(`[data-blog-module-section="${blogSection}"]`);
      if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); element.focus({ preventScroll: true }); setBlogSection(null); window.clearInterval(timer); }
      else if (++count > 100) { setBlogSection(null); window.clearInterval(timer); }
    }, 100);
    return () => window.clearInterval(timer);
  }, [blogSection, showSplash, loading, activeScreen, activeTab]);
  const appliedAdPreviewLink = useRef(false);
  useEffect(() => {
    if (!isAdmin || !profileLoaded || appliedAdPreviewLink.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('ad_preview') !== '1') return;
    appliedAdPreviewLink.current = true;
    const screen = params.get('ad_screen');
    if (screen === 'home' || screen === 'community' || screen === 'tools') setActiveTab(screen);
    else if (screen === 'blog' || screen === 'article') setActiveScreen('blog');
    else if (screen === 'recipes' || screen === 'names') { setActiveTab('tools'); setActiveTool(screen); setToolOpenedFromDashboard(false); }
    else if (screen === 'ad_preferences') setActiveScreen('ad-preferences');
  }, [isAdmin, profileLoaded, setActiveScreen]);
  const { forceUpdate, updateRequired, isLoading: forceUpdateLoading } = useForceUpdate();
  // Moderasiya: tam blok (block_type='full') → tətbiq əvəzinə blok ekranı
  const { data: activeBlock } = useActiveBlock();
  // Premium onboarding (funnel ilə) — app_settings ilə idarə olunur; setting yoxdursa AKTİVDİR
  const premiumOnbSetting = useAppSetting('premium_onboarding_enabled');
  const premiumOnboardingEnabled = premiumOnbSetting !== false;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const swipeRestoreRef = useRef<SwipeRestoreState>(null);

  // Reset scroll to top when tab or screen changes
  // Screen name mapping for clean GA reports
  const SCREEN_NAME_MAP: Record<string, string> = {
    home: 'Dashboard', tools: 'ToolsHub', ai: 'AIChat', shop: 'Shop',
    cakes: 'Cakes', profile: 'Profile', community: 'Community',
  };

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    resetAppScrollPosition();

    const rafId = requestAnimationFrame(() => {
      resetAppScrollPosition();
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });

    const timeoutId = window.setTimeout(() => {
      resetAppScrollPosition();
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 80);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, activeScreen, activeTool]);

  // Push bildirişi naviqasiyası: toxunuş → düzgün ekran/tab
  useEffect(() => {
    if (!isAuthenticated || loading || !profileLoaded) return;

    const applyIntent = (intent: PushNavIntent) => {
      // Push taps replace the current nested navigation, not just its tab.
      setShowAdmin(false);
      setViewingUserId(null);
      setShowMotherChat(false);
      setActiveScreen(null);
      setActiveTool(null);
      setToolOpenedFromDashboard(false);
      setCommunityDeepLink(null);
      swipeRestoreRef.current = null;
      // ToolsHub reads initialTool only on mount.
      setToolsResetKey((key) => key + 1);

      if (intent.motherChat) {
        // Partner rolunda söhbət ayrıca tab-dır; qadında MessagesScreen
        if (role === 'partner') setActiveTab('chat');else
        setShowMotherChat(true);
        return;
      }
      if (intent.shoppingList) {
        if (role === 'partner') {
          setActiveTab('home');
          setActiveScreen('partner-shopping');
        } else {
          setActiveTab('tools');
          setActiveTool('shopping');
          setToolOpenedFromDashboard(true);
        }
        return;
      }
      if (intent.screen) {setActiveScreen(intent.screen);return;}
      if (intent.tab) {
        setActiveTab(intent.tab);
        if (intent.tab === 'community') {
          setCommunityDeepLink(intent.communityTarget ?? {});
        }
      }
    };

    // Soyuq başlanğıc: push app-ı açıbsa intent gözləyir
    const pendingIntent = consumePendingPushNav();
    if (pendingIntent) applyIntent(pendingIntent);

    const onPushNav = (e: Event) => {
      const intent = (e as CustomEvent<PushNavIntent>).detail;
      if (intent) {
        consumePendingPushNav();
        applyIntent(intent);
      }
    };
    window.addEventListener(PUSH_NAV_EVENT, onPushNav);
    return () => window.removeEventListener(PUSH_NAV_EVENT, onPushNav);
  }, [role, isAuthenticated, loading, profileLoaded, setActiveScreen]);

  // Android hardware geri: ekran iyerarxiyasını addım-addım bağla
  // (sub-screen → tool → user-profil → söhbət → tab → home; sonra backButton.ts çıxış idarə edir)
  useEffect(() => {
    return pushBackHandler(() => {
      if (showAdmin) {setShowAdmin(false);return true;}
      if (viewingUserId) {setViewingUserId(null);return true;}
      if (showMotherChat) {setShowMotherChat(false);return true;}
      if (activeScreen) {setActiveScreen(null);return true;}
      if (activeTool) {setActiveTool(null);setToolsResetKey((k) => k + 1);return true;}
      if (activeTab !== 'home') {setActiveTab('home');return true;}
      return false; // kök: backButton.ts "yenidən bas" göstərəcək
    });
  }, [showAdmin, viewingUserId, showMotherChat, activeScreen, activeTool, activeTab]);

  useEffect(() => {
    // Track screen/tab views with proper naming
    const rawName = activeScreen || activeTool || activeTab;
    const screenName = SCREEN_NAME_MAP[rawName || ''] || rawName;
    const screenClass = activeScreen ? 'Screen' : activeTool ? 'Tools' : 'Tab';
    if (screenName && isAuthenticated) {
      import('@/lib/analytics').then(m => m.analytics.logScreenView(screenName, screenClass)).catch(() => {});
    }
  }, [activeTab, activeScreen, activeTool, isAuthenticated]);

  // Initialize push notification token registration for native apps
  useDeviceToken();

  // Kilid ekranı widget-indən (iOS Live Activity / Android bildiriş) dayandırılan
  // yuxu/əmizdirmə taymerlərini baby_logs-a yaz — HƏMİŞƏ aktiv host (sub-ekranlar
  // açıq olanda da), auth/uşaq siyahısı hazır olmayana qədər təhlükəsiz gözləyir.
  usePendingTimerStops();

  // ─── Deeplink handler ───
  const handleDeeplink = useCallback((parsed: ParsedDeeplink) => {
    console.log('[Deeplink] Handling:', parsed);
    if (parsed.params.language && isAppLanguage(parsed.params.language)) {
      const requested = parsed.params.language;
      void import('@/lib/i18n').then(async ({ ensureLanguageReady }) => { await ensureLanguageReady(requested); useUserStore.getState().setLanguage(requested); }).catch(() => {});
    }
    switch (parsed.action) {
      case 'blog-module':
        if (isBlogModule(parsed.params.module)) openBlogModule(parsed.params.module);
        break;
      case 'tab':
        setActiveTab(parsed.params.tab);
        setActiveTool(null);
        setActiveScreen(null);
        break;
      case 'tool':
        setActiveTab('tools');
        setActiveTool(parsed.params.tool_id);
        setToolOpenedFromDashboard(false);
        break;
      case 'screen':
        if (parsed.params.screen.startsWith('blog/')) rememberBlog(parsed.params.screen.slice(5));
        setActiveScreen(parsed.params.screen);
        break;
      case 'messages':
        setShowMotherChat(true);
        break;
      case 'user-profile':
        setViewingUserId(parsed.params.user_id);
        break;
      case 'community-post':
        setActiveTab('community');
        setActiveScreen(null);
        setCommunityDeepLink({ postId: parsed.params.post_id });
        break;
    }
  }, []);

  useEffect(() => {
    const cleanup = initDeeplinkListener(handleDeeplink);
    return cleanup;
  }, [handleDeeplink]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      // Show intro if user hasn't seen it
      if (!hasSeenIntro) {
        setShowIntro(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasSeenIntro]);

  // Handle tool navigation from Dashboard
  const handleNavigateToTool = (tool: string) => {
    setActiveTool(tool);
    setToolOpenedFromDashboard(true);
    setActiveTab('tools');
  };

  // Handle back from tool - go to Dashboard if opened from there
  const handleToolBack = () => {
    if (toolOpenedFromDashboard) {
      setActiveTool(null);
      setToolOpenedFromDashboard(false);
      setActiveTab('home');
    } else {
      setActiveTool(null);
    }
  };

  const [showSearch, setShowSearch] = useState(false);

  // Handle tab change - reset tool state when clicking Tools tab
  const handleTabChange = (tab: string) => {
    // If clicking Tools tab while already on tools, reset to tools list
    if (tab === 'tools') {
      setActiveTool(null);
      setToolOpenedFromDashboard(false);
      // Increment key to force ToolsHub to reset
      setToolsResetKey(prev => prev + 1);
    }
    // Tab dəyişəndə: cari tabın scroll-u yadda qalır, hədəf tabınki bərpa olunur
    if (tab !== activeTab) {
      saveScroll(`tab:${activeTab}`);
      restoreScroll(`tab:${tab}`);
    }
    setActiveTab(tab);
  };

  // setActiveScreen üçün cari tab referansı
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // iOS-style swipe navigation — only navigates back/forward in the current stack, never switches tabs
  const handleSwipeBack = useCallback(() => {
    if (activeScreen) {
      swipeRestoreRef.current = { type: 'screen', value: activeScreen };
      setActiveScreen(null);
      return;
    }

    if (viewingUserId) {
      swipeRestoreRef.current = { type: 'user-profile', value: viewingUserId };
      setViewingUserId(null);
      return;
    }

    if (showMotherChat) {
      swipeRestoreRef.current = { type: 'mother-chat' };
      setShowMotherChat(false);
      return;
    }

    if (activeTool && activeTab === 'tools') {
      swipeRestoreRef.current = { type: 'tool', value: activeTool, fromDashboard: toolOpenedFromDashboard };
      handleToolBack();
      return;
    }
  }, [activeScreen, viewingUserId, showMotherChat, activeTool, activeTab, toolOpenedFromDashboard, handleToolBack]);

  const handleSwipeForward = useCallback(() => {
    const restore = swipeRestoreRef.current;
    if (!restore) return;

    if (restore.type === 'screen') {
      setActiveScreen(restore.value);
    } else if (restore.type === 'user-profile') {
      setViewingUserId(restore.value);
    } else if (restore.type === 'mother-chat') {
      setShowMotherChat(true);
    } else if (restore.type === 'tool') {
      setActiveTab('tools');
      setActiveTool(restore.value);
      setToolOpenedFromDashboard(restore.fromDashboard);
    }

    swipeRestoreRef.current = null;
  }, []);

  // Enable edge-only swipe navigation for back/forward
  useSwipeNavigation({
    onSwipeBack: handleSwipeBack,
    onSwipeForward: handleSwipeForward,
    edgeWidth: 55,
    threshold: 35,
    enabled: isAuthenticated && !showSplash && !showIntro && !showAdmin && !blogOverlayOpen
  });

  // Bypass language screen for existing users (who have seen intro or are logged in)
  useEffect(() => {
    if (!hasSelectedLanguage && (hasSeenIntro || isOnboarded || isAuthenticated)) {
      setHasSelectedLanguage(true);
    }
  }, [hasSelectedLanguage, hasSeenIntro, isOnboarded, isAuthenticated, setHasSelectedLanguage]);

  useEffect(() => {
    if (activeScreen === 'admin' && isAdmin) {
      setShowAdmin(true);
      setActiveScreen(null);
    }
  }, [activeScreen, isAdmin]);

  const handleUserClick = (userId: string) => {
    setViewingUserId(userId);
  };

  const renderContent = () => {
    if (role === 'partner' && activeTab !== 'community') {
      switch (activeTab) {
        case 'home':
          return (
            <motion.div key="partner-home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <AdSurface id="home_banner" />
              <PartnerHomeScreen onNavigate={setActiveScreen} onOpenChat={() => setActiveTab('chat')} />
            </motion.div>
          );
        case 'together':
          return (
            <motion.div key="partner-together" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <PartnerTogetherScreen onNavigate={setActiveScreen} />
            </motion.div>
          );
        case 'chat':
          return (
            <motion.div key="partner-chat" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="h-full">
              <MessagesScreen onBack={() => setActiveTab('home')} partnerProfileId={profile?.linked_partner_id} />
            </motion.div>
          );
        case 'ai':
          return (
            <motion.div key="partner-ai" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="h-full">
              <PartnerAIPremiumGate />
            </motion.div>
          );
        case 'profile':
          return (
            <motion.div key="partner-profile" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <PartnerProfileScreen onNavigate={setActiveScreen} />
            </motion.div>
          );
        default:
          return null;
      }
    }

    switch (activeTab) {
      case 'home':
        return (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <AdSurface id="home_banner" />
            <Dashboard onOpenChat={() => setShowMotherChat(true)} onNavigateToTool={handleNavigateToTool} onNavigate={setActiveScreen} onOpenAI={() => handleTabChange('ai')} onOpenProfile={() => handleTabChange('profile')} onSearch={() => setShowSearch(true)} topbarExtra={<AptekCartButton onOpen={setActiveScreen} />} />
          </motion.div>
        );
      case 'tools':
        return (
          <motion.div key="tools" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <ToolsHub key={toolsResetKey} initialTool={activeTool} onBack={handleToolBack} />
          </motion.div>
        );
      case 'cakes': {
        // Tortlar yalnız Azərbaycan üçündür — deeplink/başqa keçid yolları ilə bu yoxlamanı
        // bypass etməsin deyə burda (ən üst səviyyə render nöqtəsi) da yoxlanılır.
        const cakesOk = isAdmin || isCakesAvailable((profile as any)?.country_code || countryCode, language);
        if (!cakesOk) return null;
        return (
          <motion.div key="cakes" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <CakesScreen />
          </motion.div>
        );
      }
      case 'community':
        return (
          <motion.div key="community" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <CommunityScreen
              onOpenNotifications={() => setActiveScreen('notifications')}
              onEditProfile={() => { if (user) setCommunityDeepLink({ userId: user.id }); setActiveScreen('edit-profile'); }}
              deepLinkTarget={communityDeepLink}
              onDeepLinkConsumed={() => setCommunityDeepLink(null)}
            />
          </motion.div>
        );
      case 'ai':
        return (
          <motion.div key="ai" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="h-full">
            <AIChatScreen />
          </motion.div>
        );
      // Blog is now accessed via Tools, remove from nav tabs
      case 'profile':
        return (
          <motion.div key="profile" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <ProfileScreen onNavigate={setActiveScreen} />
          </motion.div>
        );
      default:
        return null;
    }
  };

  // Mövcud olmayan/əlçatmaz tab (məs. deeplink ilə tortlar başqa ölkədə) boş ekran
  // göstərməsin — ana səhifəyə qayıdılır.
  const tabContent = renderContent();
  const emptyTab = tabContent === null && activeTab !== 'home';
  useEffect(() => { if (emptyTab) setActiveTab('home'); }, [emptyTab]);

  // Splash screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  const shouldBypassLanguage = hasSeenIntro || isOnboarded || isAuthenticated;

  // Initial Language Selection (First-time users)
  if (!hasSelectedLanguage && !shouldBypassLanguage) {
    return (
      <motion.div key="initial-language" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-background relative overflow-hidden">
        <InitialLanguageScreen />
      </motion.div>
    );
  }

  // App introduction (first time users)
  if (showIntro) {
    return (
      <AppIntroduction 
        onComplete={() => {
          setShowIntro(false);
          setHasSeenIntro(true);
        }} 
      />
    );
  }

  // Loading state
  if (loading) {
    return <StartupScreen />;
  }

  // Force Update check
  if (!forceUpdateLoading && updateRequired && forceUpdate) {
    return (
      <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}>
        <ForceUpdateScreen
          title={forceUpdate.title}
          message={forceUpdate.message}
          androidUrl={forceUpdate.android_url}
          iosUrl={forceUpdate.ios_url}
        />
      </ErrorBoundary></Suspense>
    );
  }

  // Auth screen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Tam blok: istifadəçi tətbiqdən tamamilə kənarlaşdırılıb — səbəb + bitmə
  // tarixi göstərilir (admin moderasiyası, bax user_blocks / Duzelis61).
  // Community bloku isə yalnız CommunityScreen-i bağlayır (orada idarə olunur).
  if (activeBlock?.block_type === 'full') {
    return <BlockedScreen block={activeBlock} />;
  }

  // MƏCBURİ ölkə seçimi: profili olan amma country_code-u boş olan hər kəsə
  // (Apple/Google qeydiyyatı ölkə soruşmurdu; köhnə hesablarda sütun sonradan
  // əlavə olunub) bir dəfəlik seçim ekranı. Server tərəfdə IP-dən avtomatik
  // doldurma da var (Duzelis63) — bu, dəqiq seçim üçün son sığortadır.
  const needsCountry = profileLoaded && !!profile && !(((profile as any).country_code || '') as string).trim();
  if (needsCountry && !countryJustSet) {
    return <CountryGate onDone={() => setCountryJustSet(true)} />;
  }

  // Partners NEVER see standard onboarding or the funnel — detect via either role or life_stage
  const isPartnerUser = role === 'partner' || lifeStage === 'partner';

  // Apple/Google ilə qeydiyyatda ad soruşulmurdu (native-auth.ts ID token-dən
  // kənar məlumat göndərmirdi) → handle_new_user() trigger-i defolt olaraq
  // 'İstifadəçi' yazır. Bunu YALNIZ bir dəfə, məcburi şəkildə düzəltmək üçün
  // adı hələ də bu placeholder/boş olan İSTƏNİLƏN istifadəçi (yeni OAuth VƏ
  // ya köhnədən belə qalmış mövcud hesab) növbəti giriş zamanı onboarding-in
  // ad addımına yönləndirilir — partner istisnasından da asılı olmayaraq.
  const needsName = !!profile && (!profile.name || profile.name.trim() === '' || profile.name === 'İstifadəçi');

  // Onboarding - Partners skip onboarding entirely (ad addımı istisnadır)
  // KRİTİK: login-dən sonra profil hələ yüklənməyibsə (hydration davam edir)
  // onboarding GÖSTƏRMƏ — köhnə istifadəçi hər login-də modul seçiminə atılırdı.
  // Onboarding yalnız profil yüklənəndən SONRA hələ də isOnboarded=false qalıbsa
  // (həqiqətən yeni istifadəçi) və ya ad hələ soruşulmayıbsa açılır.
  const pendingJourney = !!user && !isPartnerUser && hasPendingOnboarding(user.id, getBackendConfig().url, profile?.onboarding_answers);
  // Pre-v3 used an unbound "1" flag. It cannot identify the account after logout,
  // so it must not enroll a different/existing user in a new purchase funnel.
  const legacyPending = isOnboarded && !hasCompletedFunnel && !isPartnerUser && (() => {
    try {
      const value = JSON.parse(localStorage.getItem(PENDING_FUNNEL_KEY) || 'null');
      return value?.userId === user?.id && value?.backend === getBackendConfig().url;
    } catch { return false; }
  })();
  if ((!isOnboarded && !isPartnerUser) || needsName || pendingJourney || legacyPending) {
    if (!profileLoaded) {
      return suspenseFallback;
    }
    return <Suspense fallback={suspenseFallback}><ErrorBoundary key={`onboarding:${user?.id}`}>
      <PremiumOnboarding key={`${getBackendConfig().url}:${user?.id}`} legacyPending={legacyPending} offerEnabled={premiumOnboardingEnabled}
        onComplete={() => { setFunnelCompleted(true); }} />
    </ErrorBoundary></Suspense>;
  }

  // Premium funnel: yalnız YENİ qeydiyyatdan dərhal sonra (PENDING_FUNNEL_KEY bayrağı).
  // Köhnə istifadəçilər / re-login / flag off → funnel atlanır (davranış dəyişməz).
  if (!hasCompletedFunnel) {
    setFunnelCompleted(true);
  }



  // Admin Panel
  if (showAdmin && isAdmin) {
    return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><AdminPanel onExit={() => setShowAdmin(false)} /></ErrorBoundary></Suspense>;
  }

  // User Profile View (Community)
  if (viewingUserId) {
    return <div className="a-subscreen" data-subscreen><Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><UserProfileScreen
      key={viewingUserId} userId={viewingUserId} onBack={() => setViewingUserId(null)} onUserClick={setViewingUserId}
      onSendMessage={(userId) => { setViewingUserId(null); setActiveTab('community'); setCommunityDeepLink({ dmUserId: userId }); }}
      onEditProfile={() => { setViewingUserId(null); setActiveTab('community'); if (user) setCommunityDeepLink({ userId: user.id }); setActiveScreen('edit-profile'); }}
    /></ErrorBoundary></Suspense></div>;
  }

  // Sub-screens
  const subScreen = (() => {
  if (activeScreen === 'mommy-period' && lifeStage === 'mommy') return <Suspense fallback={suspenseFallback}><ErrorBoundary><MommyPeriodTracker onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'moderator') return <Suspense fallback={suspenseFallback}><ErrorBoundary><ModeratorPanel onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'moderation-history') return <Suspense fallback={suspenseFallback}><ErrorBoundary><MyModerationDecisions onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'notifications') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><NotificationsScreen onBack={() => setActiveScreen(null)} onNavigateToModeration={() => setActiveScreen('moderation-history')} onNavigateToCommunity={(target) => { setActiveScreen(null); setActiveTab('community'); if (target) setCommunityDeepLink(target); }} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'settings') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><SettingsScreen onBack={() => setActiveScreen(null)} onNavigate={setActiveScreen} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'ad-preferences') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><AdPreferencesScreen onBack={() => setActiveScreen('settings')} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'health-sync') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><HealthSyncScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'referral') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><ReferralScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'doctor-report') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><DoctorReportScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'calendar') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><CalendarScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'edit-profile') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><ProfileEditScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'help') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><HelpScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'privacy') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PrivacyScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-privacy') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerPrivacyScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'appearance') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><AppearanceScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'billing') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><BillingScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'legal' || activeScreen?.startsWith('legal/')) {
    const initialDocType = activeScreen?.startsWith('legal/') ? activeScreen.replace('legal/', '') : undefined;
    return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><LegalScreen onBack={() => setActiveScreen(null)} initialDocument={initialDocType} /></ErrorBoundary></Suspense>;
  }
  if (activeScreen === 'blog' || activeScreen?.startsWith('blog/')) {
    const initialSlug = activeScreen?.startsWith('blog/') ? activeScreen.replace('blog/', '') : undefined;
    return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><BlogScreen onBack={() => setActiveScreen(null)} initialSlug={initialSlug} lifeStage={lifeStage} /></ErrorBoundary></Suspense>;
  }
  if (activeScreen === 'aptek' || activeScreen?.startsWith('aptek/')) return <Suspense fallback={suspenseFallback}><ErrorBoundary key="aptek"><AptekScreen onBack={() => setActiveScreen(null)} initialScreen={activeScreen} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'shop' && isAdmin) return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><ShopScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'name-voting' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><NameVotingScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-hospital-bag' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerHospitalBagScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'daily-summary' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><DailySummaryScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  {/* ── Partner Module 2.0 sub-screens ── */}
  if (activeScreen === 'partner-shopping' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerShoppingScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-appointments' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerAppointmentsScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-baby-day' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerBabyDayScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-weekly-stats' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerWeeklyStatsScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-surprises' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerSurprisesScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'hospital-run' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><HospitalRunScreen onBack={() => setActiveScreen(null)} onNavigate={setActiveScreen} onOpenContractions={() => setActiveScreen('live-contractions')} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'live-contractions' && role === 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><LiveContractionsScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partner-sharing' && role !== 'partner') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnerSharingScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  if (activeScreen === 'partners') return <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}><PartnersScreen onBack={() => setActiveScreen(null)} /></ErrorBoundary></Suspense>;
  return null;
  })();
  if (subScreen) return <div className="a-subscreen" data-subscreen>{subScreen}</div>;

  // Messages screen (unified: partner + community DMs)
  if (showMotherChat) {
    return (
      <Suspense fallback={suspenseFallback}><ErrorBoundary key={String(activeScreen)}>
        <MessagesScreen 
          onBack={() => setShowMotherChat(false)} 
          partnerProfileId={profile?.linked_partner_id}
        />
      </ErrorBoundary></Suspense>
    );
  }

  // Redesigned (anacan-demo) screens paint their own peach background
  const isAnacanRedesignHome =
    role !== 'partner' && (
      (activeTab === 'home' && (lifeStage === 'mommy' || lifeStage === 'bump' || lifeStage === 'flow')) ||
      activeTab === 'tools' ||
      activeTab === 'community' ||
      activeTab === 'ai' ||
      activeTab === 'profile'
    );

  return (
    <div
      className={`fixed inset-0 flex flex-col overflow-hidden ${isAnacanRedesignHome ? '' : 'bg-background'}`}
      data-app-viewport
      vaul-drawer-wrapper=""
      data-main-dashboard={activeTab === 'home' && !blogOverlayOpen ? 'true' : undefined}
      style={isAnacanRedesignHome ? { background: 'var(--a-bg)' } : undefined}
    >
      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} onOpenTool={handleNavigateToTool} onAskAI={() => handleTabChange('ai')}
        extra={(q, close) => <AptekSearchResults query={q} close={close} onOpen={setActiveScreen} />} />

      {/* App Rating Prompt */}
      <AppRatingPrompt />
      
      {/* SOS / Doğuş siqnalı qəbuledicisi — bağlı olan HƏR İKİ tərəf üçün */}
      {profile?.linked_partner_id &&
        <Suspense fallback={null}>
          <AlertReceiver
            isPartner={role === 'partner'}
            onHospitalRun={() => setActiveScreen('hospital-run')} />
        </Suspense>
      }
      
      {/* Status bar area - fills with card background */}
      <div 
        className={`flex-shrink-0 ${isAnacanRedesignHome ? '' : 'bg-card'}`}
        style={{ height: 'env(safe-area-inset-top)', ...(isAnacanRedesignHome ? { background: 'var(--a-bg)' } : {}) }} 
      />
      
      {/* Main scrollable content area */}
      {/* pb-nav: BottomNav + safe-area klirensi — son elementlər nav altında qalmasın */}
      <div ref={scrollContainerRef} data-scroll-container className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none pb-nav">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {/* QEYD: Əvvəllər burada <AnimatePresence mode="wait"> var idi.
              "wait" rejimində köhnə tab exit animasiyası bitənə qədər DOM-da
              qalırdı — animasiya yarıda kəsiləndə (ağır render, realtime refetch,
              açıq Radix menyu/dialoqun scroll kilidi) köhnə ekran + kilid "asılı"
              qalır və bütün app-da scroll donurdu. Giriş animasiyası (initial→animate)
              motion.div-lərdə qaldığı üçün vizual keçid yenə də hiss olunur. */}
          <ErrorBoundary key={activeTab}>
            {tabContent}
          </ErrorBoundary>
        </Suspense>
      </div>
      
      {/* Floating timer widget - above bottom nav */}
      <FloatingTimerWidget />
      
      {/* Bottom navigation with safe area */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} isPartner={role === 'partner'} />
    </div>
  );
};

const Index = () => <BlogLinkHost>{open => <IndexContent blogOverlayOpen={open} />}</BlogLinkHost>;
export default Index;
