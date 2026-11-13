import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isAdmin: false, loading: false }) }));
import { ADMIN_GROUPS, ADMIN_SECTIONS, MOBILE_TABS, SECTION_ALIASES, canonicalSection, componentFor, getSection } from './registry';
import { hasLoader, sectionLoader } from './sections';
import { isAdminSection } from '../AdminPanel';

/** Every id the pre-redesign AdminPanel accepted (sections map + revenuecat-debug). Deep links must keep resolving. */
const LEGACY_IDS: Record<string, string> = {
  dashboard: 'AdminDashboard', users: 'AdminUsers', 'verified-badges': 'AdminVerifiedBadges', support: 'AdminSupport', blog: 'AdminBlog', orders: 'AdminOrders',
  products: 'AdminProducts', community: 'AdminCommunity', content: 'AdminContentManager', pregnancy: 'AdminPregnancyContent', 'fruit-images': 'AdminFruitImages',
  vitamins: 'AdminVitamins', 'dynamic-content': 'AdminDynamicContent', 'trimester-tips': 'AdminTrimesterTips', 'flow-symptoms': 'AdminFlowContent', 'flow-content': 'AdminFlowContent',
  photoshoot: 'AdminPhotoshoot', subscriptions: 'AdminSubscriptions', 'premium-analytics': 'AdminPremiumAnalytics', premium: 'AdminPremiumAnalytics', moderation: 'AdminModeration',
  'ad-moderation': 'AdminAdModeration', data: 'AdminData', messages: 'AdminMessages', settings: 'AdminSettings', branding: 'AdminBranding', legal: 'AdminLegal',
  'push-notifications': 'AdminPushNotifications', notifications: 'AdminPushNotifications', affiliate: 'AdminAffiliateProducts', tools: 'AdminTools', marketplace: 'AdminMarketplace',
  'first-aid': 'AdminFirstAid', 'fairy-tales': 'AdminFairyTales', places: 'AdminPlaces', 'play-activities': 'AdminPlayActivities', 'quick-actions': 'AdminQuickActions',
  'development-tips': 'AdminDevelopmentTips', banners: 'AdminBanners', 'baby-growth': 'AdminBabyGrowth', recipes: 'AdminRecipes', 'partner-tips': 'AdminPartnerTips', faq: 'AdminFAQ',
  onboarding: 'AdminOnboarding', 'mental-health': 'AdminMentalHealth', 'tools-config': 'AdminToolsConfig', 'places-config': 'AdminPlacesConfig', 'partner-config': 'AdminPartnerConfig',
  'default-shopping': 'AdminDefaultShoppingItems', 'premium-config': 'AdminPremiumConfig', maternity: 'AdminMaternityBenefits', 'baby-illustrations': 'AdminBabyIllustrations',
  'fetus-illustrations': 'AdminFetusIllustrations', 'crisis-calendar': 'AdminBabyCrisisCalendar', 'phase-tips': 'AdminPhaseTips', teething: 'AdminTeething',
  'healthcare-reviews': 'AdminHealthcareReviews', cakes: 'AdminCakes', 'baby-daily-info': 'AdminBabyDailyInfo', 'mommy-daily-messages': 'AdminMommyDailyMessages',
  'intro-slides': 'AdminIntroSlides', 'album-orders': 'AdminAlbumOrders', coupons: 'AdminCoupons', analytics: 'AdminAnalytics', 'country-stats': 'AdminCountryStats',
  epoint: 'AdminEpoint', 'epoint-evidence': 'AdminEpointEvidence', books: 'AdminBooks', qaygicash: 'AdminQaygiCash', 'force-update': 'AdminForceUpdate', 'app-updates': 'AdminAppUpdates', security: 'AdminSecurity', languages: 'AdminLanguages',
  translations: 'AdminTranslations', 'content-i18n': 'AdminContentTranslations', deeplinks: 'AdminDeeplinks', 'crash-reports': 'AdminCrashReports',
  'partner-venues': 'AdminPartnerVenues', 'partner-redemptions': 'AdminPartnerRedemptions', vaccines: 'AdminVaccines', admob: 'AdminAdmob', ads: 'AdminAdmob',
  'revenuecat-debug': 'RevenueCatDebug', 'parenting-content': 'AdminParentingContent', 'story-stats': 'AdminStoryStats', stories: 'AdminStories', 'daily-quiz': 'AdminDailyQuiz',
};

describe('admin section registry', () => {
  it.each(Object.entries(LEGACY_IDS))('keeps the legacy id %s resolving to %s with a lazy chunk', (id, component) => {
    expect(isAdminSection(id)).toBe(true);
    expect(componentFor(id)).toBe(component);
    expect(hasLoader(component)).toBe(true);
    expect(typeof sectionLoader(id)).toBe('function');
  });
  it('rejects unknown ids so /admin/<typo> falls back to the dashboard', () => {
    for (const id of ['', 'nope', 'Dashboard', 'admin', '__proto__', 'constructor']) expect(isAdminSection(id)).toBe(false);
    expect(canonicalSection('constructor')).toBeNull();
  });
  it('maps aliases to one canonical menu entry', () => {
    expect(canonicalSection('premium')).toBe('premium-analytics');
    expect(canonicalSection('notifications')).toBe('push-notifications');
    expect(canonicalSection('ads')).toBe('admob');
    expect(canonicalSection('flow-symptoms')).toBe('flow-content');
    for (const target of Object.values(SECTION_ALIASES)) expect(getSection(target)).not.toBeNull();
  });
  it('lists every menu section exactly once in one of the 8 groups', () => {
    const ids = ADMIN_SECTIONS.map(section => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ADMIN_GROUPS).toHaveLength(8);
    for (const section of ADMIN_SECTIONS) expect(ADMIN_GROUPS.some(group => group.id === section.group)).toBe(true);
    const canonical = new Set(Object.keys(LEGACY_IDS).map(id => canonicalSection(id)));
    expect(canonical).toEqual(new Set(ids));
  });
  it('has the five mobile tabs in the owner order', () => {
    expect(MOBILE_TABS.map(tab => tab.label)).toEqual(['İcmal', 'Sifarişlər', 'İstifadəçilər', 'Məzmun', 'Hamısı']);
  });
});
