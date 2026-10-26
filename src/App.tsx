import { useEffect, lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { isLowEndDevice } from "@/lib/device-tier";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, removeOldestQuery } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLockGate from "@/components/security/AppLockGate";
import Index from "./pages/Index";
import BlogLink from './pages/BlogLink';
import ResetPassword from "./pages/ResetPassword";
import LegalPage from "./pages/LegalPage";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./components/payment/PaymentSuccess";
import PaymentError from "./components/payment/PaymentError";
import RevenueCatDebug from "./pages/RevenueCatDebug";
import PartnerVerifyPage from "./pages/PartnerVerifyPage";
import MiniGamesPage from "./pages/MiniGamesPage";
import { initRevenueCat } from "@/lib/revenuecat";
import { loadTranslations } from "@/lib/i18n";
import { DirectionProvider } from "@radix-ui/react-direction";
import { applyDocumentDirection, isRtlLang } from "@/lib/rtl";
import { useUserStore } from "@/store/userStore";
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { shouldPersistQuery } from '@/lib/query-persist-policy';
import { AdExperienceProvider } from '@/components/ads/AdExperienceProvider';
import '@/styles/ads.css';
import '@/styles/keyboard.css';
import { installKeyboardViewport } from '@/lib/keyboard-viewport';
import { PremiumEntitlementMonitor } from '@/hooks/usePremiumEntitlement';
import ScreenCaptureGuard from '@/components/security/ScreenCaptureGuard';
import { Capacitor } from '@capacitor/core';
import ModeratorEnforcement from '@/components/moderation/ModeratorEnforcement';
import CustomerIoSession from '@/components/CustomerIoSession';
import ThemeStatusBarSync from '@/components/ThemeStatusBarSync';
import StartupScreen from '@/components/StartupScreen';
const AdmobAdminPage = lazy(() => import('./pages/AdmobAdminPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ModeratorPage = lazy(() => import('./pages/ModeratorPage'));
const PublicBlogPage = lazy(() => import('./public-blog/BlogPage'));

// Offline-first: sorğu cache-i localStorage-da saxlanılır ki, şəbəkəsiz açılışda
// son vəziyyət (dashboard datası, kontent, partner məlumatı və s.) dərhal görünsün.
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 gün

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Persist bərpası üçün gcTime ≥ maxAge olmalıdır, əks halda cache atılır
      gcTime: CACHE_MAX_AGE,
      // staleTime=0 default-u ilə hər focus/reconnect/mount HƏR sorğunu yenidən
      // çəkir — yüzlərlə paralel istifadəçidə bu, server üzərinə refetch "storm"u
      // yaradır. 30san bir çox ekran üçün kifayət qədər təzədir; daha tez-tez
      // yenilənməli sorğular öz staleTime-larını override edə bilər (artıq edirlər).
      staleTime: 30 * 1000
    }
  }
});

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'anacan-rq-cache',
  // Böyük cache-in tez-tez serializasiyası zəif cihazlarda main thread-i bloklayır
  throttleTime: 10_000,
  // localStorage dolarsa ən köhnə sorğunu silib yenidən cəhd et
  retry: removeOldestQuery
});

const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE,
  // Keep source's offline cache on upgrade; do not hydrate source/preview query
  // results after an admitted authority change (credentials are a separate store).
  buster: getBackendConfig().sourceFirst && getBackendConfig().azure
    ? `anacan-rq-v1:azure:${getBackendConfig().admission?.policy.handoffSha256}` : 'anacan-rq-v1',
  dehydrateOptions: {
    // Yalnız uğurlu, offline üçün dəyərli sorğular persist olunur (bax query-persist-policy)
    shouldDehydrateQuery: shouldPersistQuery
  }
};

// Zəif cihazlarda (≤4 nüvə / ≤4GB RAM) ağır effektlər söndürülür: CSS `html.a-lite`
// qaydaları backdrop-filter/sonsuz CSS animasiyaları dayandırır, framer-motion isə
// transform/layout animasiyalarını atlayır. Digər cihazlarda sistem "reduce motion" ayarına hörmət edilir.
const LITE_DEVICE = isLowEndDevice();
if (LITE_DEVICE && typeof document !== 'undefined') document.documentElement.classList.add('a-lite');

// Initialize RevenueCat on app startup
initRevenueCat().catch(console.error);

// Preload translations for current language (after Zustand rehydrate)
setTimeout(() => {
  const lang = useUserStore.getState().language;
  // getLocaleTag() üçün sync — mövcud istifadəçilərdə localStorage boş qala bilərdi
  try { localStorage.setItem('language', lang || 'az'); } catch { /* boş */ }
  if (lang && lang !== 'az') loadTranslations(lang).catch(console.error);
}, 0);

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 180 })).catch(() => {});
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  useEffect(installKeyboardViewport, []);
  // Subscribe to language so the whole tree re-renders when the user switches
  // language. tr() reads language synchronously from the store, but without a
  // subscription nothing would re-render and translations would appear "stuck".
  const language = useUserStore((s) => s.language);

  useEffect(() => {
    if (language) {
      // dir + lang birlikdə (ar → rtl); main.tsx boot-da da təyin olunur
      applyDocumentDirection(language);
      if (language !== 'az') {
        loadTranslations(language).catch(console.error);
      }
    }
  }, [language]);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion={LITE_DEVICE ? 'always' : 'user'}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeStatusBarSync />
          {/* Radix primitivləri (dropdown/select/dialog align) RTL-i buradan öyrənir */}
          <DirectionProvider dir={isRtlLang(language) ? 'rtl' : 'ltr'}>
          <AuthProvider>
            <CustomerIoSession />
            <PremiumEntitlementMonitor />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              {/* Təhlükəsizlik kilidi — bütün ekranların üstündə (z-400) */}
              <AppLockGate />
              <ScreenCaptureGuard />
              <BrowserRouter>
                <AdExperienceProvider>
                <ModeratorEnforcement>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/blog/:slug" element={<BlogLink />} />
                  <Route path="/blog" element={<Suspense fallback={<StartupScreen />}><PublicBlogPage /></Suspense>} />
                  <Route path="/blog/:language/:slug" element={<BlogLink />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/legal/:docType" element={<LegalPage />} />
                  <Route path="/payment/success" element={<PaymentSuccess />} />
                  <Route path="/payment/error" element={<PaymentError />} />
                  <Route path="/debug/revenuecat" element={<RevenueCatDebug />} />
                  <Route path="/revenuecat-debug" element={<RevenueCatDebug />} />
                  <Route path="/p/v/:token" element={<PartnerVerifyPage />} />
                  <Route path="/mini-games" element={<MiniGamesPage />} />
                  <Route path="/admin/ads" element={<Suspense fallback={<div className="p-8 text-center">Yüklənir…</div>}><AdmobAdminPage /></Suspense>} />
                  <Route path="/admin" element={<Suspense fallback={<div className="p-8 text-center">Yüklənir…</div>}><AdminPage /></Suspense>} />
                  <Route path="/admin/:section" element={<Suspense fallback={<div className="p-8 text-center">Yüklənir…</div>}><AdminPage /></Suspense>} />
                  <Route path="/moderator" element={<Suspense fallback={<div className="p-8 text-center">Yüklənir…</div>}><ModeratorPage /></Suspense>} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </ModeratorEnforcement>
                </AdExperienceProvider>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
          </DirectionProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
};

export default App;
