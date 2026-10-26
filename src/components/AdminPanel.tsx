import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AdminLanguageProvider } from '@/contexts/AdminLanguageContext';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from './ErrorBoundary';
import AdminLayout from './admin/AdminLayout';

const files = import.meta.glob<{ default: ComponentType<{ onNavigate?: (section: string) => void }> }>(['./admin/Admin*.tsx', '!./admin/**/*.test.tsx']);
const panels = Object.fromEntries(Object.entries(files).map(([path, load]) => [path.split('/').pop()!.replace('.tsx', ''), lazy(load)]));
const RevenueCatDebug = lazy(() => import('@/pages/RevenueCatDebug'));
const sections: Record<string, string> = {
  dashboard: 'AdminDashboard', users: 'AdminUsers', 'verified-badges': 'AdminVerifiedBadges', support: 'AdminSupport',
  blog: 'AdminBlog', orders: 'AdminOrders', products: 'AdminProducts', community: 'AdminCommunity', content: 'AdminContentManager',
  pregnancy: 'AdminPregnancyContent', 'fruit-images': 'AdminFruitImages', vitamins: 'AdminVitamins', 'dynamic-content': 'AdminDynamicContent',
  'trimester-tips': 'AdminTrimesterTips', 'flow-symptoms': 'AdminFlowContent', 'flow-content': 'AdminFlowContent', photoshoot: 'AdminPhotoshoot',
  subscriptions: 'AdminSubscriptions', 'premium-analytics': 'AdminPremiumAnalytics', premium: 'AdminPremiumAnalytics', moderation: 'AdminModeration',
  'ad-moderation': 'AdminAdModeration',
  data: 'AdminData', messages: 'AdminMessages', settings: 'AdminSettings', branding: 'AdminBranding', legal: 'AdminLegal',
  'push-notifications': 'AdminPushNotifications', notifications: 'AdminPushNotifications', affiliate: 'AdminAffiliateProducts', tools: 'AdminTools',
  marketplace: 'AdminMarketplace', 'first-aid': 'AdminFirstAid', 'fairy-tales': 'AdminFairyTales', places: 'AdminPlaces',
  'play-activities': 'AdminPlayActivities', 'quick-actions': 'AdminQuickActions', 'development-tips': 'AdminDevelopmentTips', banners: 'AdminBanners',
  'baby-growth': 'AdminBabyGrowth', recipes: 'AdminRecipes', 'partner-tips': 'AdminPartnerTips', faq: 'AdminFAQ', onboarding: 'AdminOnboarding',
  'mental-health': 'AdminMentalHealth', 'tools-config': 'AdminToolsConfig', 'places-config': 'AdminPlacesConfig', 'partner-config': 'AdminPartnerConfig',
  'default-shopping': 'AdminDefaultShoppingItems', 'premium-config': 'AdminPremiumConfig', maternity: 'AdminMaternityBenefits',
  'baby-illustrations': 'AdminBabyIllustrations', 'fetus-illustrations': 'AdminFetusIllustrations', 'crisis-calendar': 'AdminBabyCrisisCalendar',
  'phase-tips': 'AdminPhaseTips', teething: 'AdminTeething', 'healthcare-reviews': 'AdminHealthcareReviews', cakes: 'AdminCakes',
  'baby-daily-info': 'AdminBabyDailyInfo', 'mommy-daily-messages': 'AdminMommyDailyMessages', 'intro-slides': 'AdminIntroSlides',
  'album-orders': 'AdminAlbumOrders', coupons: 'AdminCoupons', analytics: 'AdminAnalytics', 'country-stats': 'AdminCountryStats',
  epoint: 'AdminEpoint', 'force-update': 'AdminForceUpdate', security: 'AdminSecurity', languages: 'AdminLanguages', translations: 'AdminTranslations',
  'content-i18n': 'AdminContentTranslations', deeplinks: 'AdminDeeplinks', 'crash-reports': 'AdminCrashReports',
  'partner-venues': 'AdminPartnerVenues', 'partner-redemptions': 'AdminPartnerRedemptions', vaccines: 'AdminVaccines', admob: 'AdminAdmob', ads: 'AdminAdmob',
};
export const isAdminSection = (value: string) => Object.prototype.hasOwnProperty.call(sections, value) || value === 'revenuecat-debug';
interface AdminPanelProps { onExit: () => void; initialTab?: string; onSectionChange?: (section: string) => void }

export default function AdminPanel({ onExit, initialTab = 'dashboard', onSectionChange }: AdminPanelProps) {
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const navigate = (section: string) => { if (isAdminSection(section)) { setActiveTab(section); onSectionChange?.(section); } };
  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user || !isAdmin) return <div className="grid min-h-[50vh] place-content-center gap-3 p-6 text-center"><ShieldCheck className="mx-auto" />Administrator hesabı tələb olunur.<button onClick={onExit}>Tətbiqə qayıt</button></div>;
  const Content = activeTab === 'revenuecat-debug' ? RevenueCatDebug : panels[sections[activeTab] || 'AdminDashboard'];
  return <AdminLanguageProvider><AdminLayout activeTab={activeTab} onTabChange={navigate} onExit={onExit}>
    <ErrorBoundary key={activeTab}><Suspense fallback={<div className="admin-page-loading" role="status"><Loader2 className="animate-spin" />Bölmə yüklənir…</div>}>
      <Content onNavigate={navigate} />
    </Suspense></ErrorBoundary>
  </AdminLayout></AdminLanguageProvider>;
}
