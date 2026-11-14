import type { LucideIcon } from 'lucide-react';
import {
  Activity, AlertTriangle, Baby, Eye, BadgeCheck, Ban, BarChart3, Bell, BookOpen, Cake, Camera, CreditCard, Crown, Database, FileText, Flag,
  Gift, Globe, Globe2, HeartHandshake, HeartPulse, Image, Images, KeyRound, Languages, LayoutDashboard, LifeBuoy, Link2, Map, Megaphone, MessageCircle,
  MessagesSquare, Package, Palette, PiggyBank, Pill, Rocket, Scale, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Sparkles,
  Stethoscope, Store, Syringe, Tag, Ticket, Users, Utensils, Wallet, Wrench, Zap, LayoutGrid,
} from 'lucide-react';

/**
 * Single source of truth for admin sections: the menu, the command palette, the mobile
 * "Hamısı" list, deep links (/admin/:section) and the lazy component map all read this.
 * Every id that existed before the redesign still resolves (see registry.test.ts).
 */
export interface AdminSection {
  id: string;
  /** Azerbaijani label (owner copy). */
  label: string;
  group: AdminGroupId;
  /** File name in src/components/admin without extension (or the special RevenueCat page). */
  component: string;
  icon: LucideIcon;
  keywords?: string;
}
export type AdminGroupId = 'overview' | 'people' | 'commerce' | 'content' | 'design' | 'tools' | 'places' | 'system';
export interface AdminGroup { id: AdminGroupId; label: string; icon: LucideIcon }

/** Groups ordered by how often an operator needs them. */
export const ADMIN_GROUPS: AdminGroup[] = [
  { id: 'overview', label: 'İdarəetmə', icon: LayoutDashboard },
  { id: 'people', label: 'İstifadəçilər və icma', icon: Users },
  { id: 'commerce', label: 'Satış və reklam', icon: ShoppingBag },
  { id: 'content', label: 'Məzmun', icon: FileText },
  { id: 'design', label: 'Görünüş və onboarding', icon: Crown },
  { id: 'tools', label: 'Alətlər və modullar', icon: Wrench },
  { id: 'places', label: 'Məkanlar və partnyorlar', icon: Globe },
  { id: 'system', label: 'Sistem və dillər', icon: Settings },
];

const s = (id: string, label: string, group: AdminGroupId, component: string, icon: LucideIcon, keywords?: string): AdminSection =>
  ({ id, label, group, component, icon, keywords });

export const ADMIN_SECTIONS: AdminSection[] = [
  // İdarəetmə
  s('dashboard', 'İcmal', 'overview', 'AdminDashboard', LayoutDashboard, 'dashboard ana səhifə statistika kpi'),
  s('analytics', 'İstifadə analitikası', 'overview', 'AdminAnalytics', BarChart3, 'analytics aktivlik insights hesabat'),
  s('premium-analytics', 'Premium mərkəzi', 'overview', 'AdminPremiumAnalytics', Crown, 'premium abunə trial gəlir revenuecat'),
  s('push-notifications', 'Bildiriş kampaniyaları', 'overview', 'AdminPushNotifications', Bell, 'push notification bildiriş kampaniya göndər fcm'),
  s('country-stats', 'Ölkələr', 'overview', 'AdminCountryStats', Globe2, 'country ölkə statistika'),
  s('quick-actions', 'Sürətli keçidlər', 'overview', 'AdminQuickActions', Zap, 'quick actions qısayol'),
  // İstifadəçilər və icma
  s('users', 'İstifadəçilər', 'people', 'AdminUsers', Users, 'users istifadəçi hesab rol şifrə profil'),
  s('subscriptions', 'Premium hüquqlarının idarəsi', 'people', 'AdminSubscriptions', Crown, 'subscription abunəlik premium ver ləğv'),
  s('support', 'Dəstək müraciətləri', 'people', 'AdminSupport', LifeBuoy, 'support ticket dəstək müraciət cavab'),
  s('moderation', 'Moderasiya', 'people', 'AdminModeration', Flag, 'moderation şikayət report blok post şərh'),
  s('ad-moderation', 'Reklam moderasiyası', 'people', 'AdminAdModeration', Ban, 'ad moderation reklam yoxlama'),
  s('community', 'Cəmiyyət', 'people', 'AdminCommunity', MessagesSquare, 'community qrup post icma'),
  s('verified-badges', 'Mavi tik', 'people', 'AdminVerifiedBadges', BadgeCheck, 'verified badge mavi tik təsdiq'),
  s('messages', 'Mesajlar', 'people', 'AdminMessages', MessageCircle, 'messages mesaj'),
  s('mommy-daily-messages', 'Anaya mesaj', 'people', 'AdminMommyDailyMessages', MessageCircle, 'mommy daily ana mesaj gündəlik'),
  // Satış və reklam
  s('orders', 'Sifarişlər', 'commerce', 'AdminOrders', Package, 'orders aptek sifariş çatdırılma mağaza'),
  s('cakes', 'Tortlar', 'commerce', 'AdminCakes', Cake, 'cake tort sifariş'),
  s('books', 'PDF kitablar', 'commerce', 'AdminBooks', BookOpen, 'books kitab pdf satış'),
  s('qaygicash', 'QayğıCash', 'commerce', 'AdminQaygiCash', PiggyBank, 'qaygicash cashback bonus keşbek'),
  s('epoint', 'Epoint ödəniş', 'commerce', 'AdminEpoint', CreditCard, 'epoint payment ödəniş kart əməliyyat'),
  s('epoint-evidence', 'Epoint sübutu', 'commerce', 'AdminEpointEvidence', FileText, 'epoint sübut compliance chargeback transaction əməliyyat'),
  s('coupons', 'Kuponlar', 'commerce', 'AdminCoupons', Ticket, 'coupon kupon endirim promo kod'),
  s('products', 'Məhsullar', 'commerce', 'AdminProducts', Store, 'products məhsul aptek mağaza'),
  s('admob', 'AdMob reklamları', 'commerce', 'AdminAdmob', Megaphone, 'admob ads reklam banner'),
  s('affiliate', 'Affiliate məhsullar', 'commerce', 'AdminAffiliateProducts', Link2, 'affiliate məhsul link'),
  s('marketplace', 'İkinci əl bazarı', 'commerce', 'AdminMarketplace', ShoppingCart, 'marketplace ikinci əl bazar elan'),
  s('play-activities', 'Ağıllı oyun qutusu', 'commerce', 'AdminPlayActivities', Gift, 'play activities oyun qutusu'),
  s('album-orders', 'Albom sifarişləri', 'commerce', 'AdminAlbumOrders', Images, 'album albom sifariş'),
  s('photoshoot', 'Fotosessiya', 'commerce', 'AdminPhotoshoot', Camera, 'photoshoot fotosessiya ai foto'),
  // Məzmun
  s('blog', 'Bloq', 'content', 'AdminBlog', FileText, 'blog məqalə yazı seo'),
  s('stories', 'Story-lər', 'content', 'AdminStories', Sparkles, 'story stories hekayə yeni əlavə gizlət server'),
  s('story-stats', 'Story statistikası', 'content', 'AdminStoryStats', Eye, 'story stories hekayə baxış statistika'),
  s('dynamic-content', 'Dinamik məzmun', 'content', 'AdminDynamicContent', Sparkles, 'dynamic content dinamik'),
  s('content', 'Digər kontent', 'content', 'AdminContentManager', FileText, 'content kontent'),
  s('data', 'Məlumatlar', 'content', 'AdminData', Database, 'data məlumat'),
  s('faq', 'FAQ', 'content', 'AdminFAQ', LifeBuoy, 'faq sual cavab'),
  s('pregnancy', 'Hamiləlik', 'content', 'AdminPregnancyContent', Baby, 'pregnancy hamiləlik həftə gün'),
  s('flow-content', 'Menstruasiya', 'content', 'AdminFlowContent', HeartPulse, 'flow menstruasiya dövr simptom'),
  s('partner-tips', 'Partnyor məsləhətləri', 'content', 'AdminPartnerTips', Users, 'partner tips partnyor'),
  s('mental-health', 'Mental sağlamlıq', 'content', 'AdminMentalHealth', HeartPulse, 'mental health psixoloji'),
  s('first-aid', 'İlk yardım', 'content', 'AdminFirstAid', Stethoscope, 'first aid ilk yardım'),
  s('recipes', 'Reseptlər', 'content', 'AdminRecipes', Utensils, 'recipes resept yemək'),
  s('parenting-content', 'Tərbiyə məzmunu', 'content', 'AdminParentingContent', HeartHandshake, 'parenting tərbiyə sos məqalə proqram cms mətn'),
  // Görünüş və onboarding
  s('banners', 'Bannerlər', 'design', 'AdminBanners', Image, 'banner reklam kampaniya'),
  s('premium-config', 'Premium səhifəsi', 'design', 'AdminPremiumConfig', Crown, 'premium config paywall səhifə'),
  s('intro-slides', 'Qarşılama ekranları', 'design', 'AdminIntroSlides', Rocket, 'intro slides qarşılama'),
  s('onboarding', 'Qeydiyyat mərhələləri', 'design', 'AdminOnboarding', Rocket, 'onboarding qeydiyyat mərhələ'),
  s('branding', 'Branding', 'design', 'AdminBranding', Palette, 'branding logo rəng'),
  s('baby-illustrations', 'Körpə illüstrasiyaları', 'design', 'AdminBabyIllustrations', Baby, 'baby illustrations körpə şəkil'),
  s('fetus-illustrations', 'Fetus şəkilləri', 'design', 'AdminFetusIllustrations', Baby, 'fetus şəkil'),
  s('fruit-images', 'Körpə ölçüsü şəkilləri', 'design', 'AdminFruitImages', Image, 'fruit meyvə ölçü şəkil'),
  // Alətlər və modullar
  s('tools-config', 'Alət konfiqurasiyaları', 'tools', 'AdminToolsConfig', Wrench, 'tools config alət'),
  s('tools', 'Alət sıralaması', 'tools', 'AdminTools', Wrench, 'tools alət sıra'),
  s('development-tips', 'İnkişaf tövsiyələri', 'tools', 'AdminDevelopmentTips', Activity, 'development tips inkişaf'),
  s('baby-growth', 'İnkişaf izləyicisi', 'tools', 'AdminBabyGrowth', Activity, 'baby growth boy çəki'),
  s('teething', 'Diş çıxarma', 'tools', 'AdminTeething', Baby, 'teething diş'),
  s('crisis-calendar', 'Kriz təqvimi', 'tools', 'AdminBabyCrisisCalendar', AlertTriangle, 'crisis kriz təqvim'),
  s('baby-daily-info', 'Günlük ana məlumatları', 'tools', 'AdminBabyDailyInfo', Baby, 'baby daily günlük'),
  s('phase-tips', 'Faza məsləhətləri', 'tools', 'AdminPhaseTips', HeartPulse, 'phase tips faza'),
  s('trimester-tips', 'Trimester tövsiyələri', 'tools', 'AdminTrimesterTips', Baby, 'trimester'),
  s('vitamins', 'Vitaminlər', 'tools', 'AdminVitamins', Pill, 'vitamin'),
  s('vaccines', 'Peyvənd təqvimi', 'tools', 'AdminVaccines', Syringe, 'vaccine peyvənd'),
  s('maternity', 'Dekret kalkulyatoru', 'tools', 'AdminMaternityBenefits', Wallet, 'maternity dekret kalkulyator'),
  s('default-shopping', 'Alışveriş siyahısı', 'tools', 'AdminDefaultShoppingItems', ShoppingCart, 'shopping alış-veriş siyahı'),
  s('fairy-tales', 'Sehrli nağılçı', 'tools', 'AdminFairyTales', BookOpen, 'fairy tales nağıl'),
  // Məkanlar və partnyorlar
  s('places', 'Ana dostu məkanlar', 'places', 'AdminPlaces', Map, 'places məkan'),
  s('places-config', 'Məkan konfiqurasiyası', 'places', 'AdminPlacesConfig', Map, 'places config məkan'),
  s('healthcare-reviews', 'Həkim / klinika rəyləri', 'places', 'AdminHealthcareReviews', Stethoscope, 'healthcare həkim klinika rəy'),
  s('partner-config', 'Partnyor konfiqurasiyası', 'places', 'AdminPartnerConfig', Users, 'partner config'),
  s('partner-venues', 'Partnyor məkanları', 'places', 'AdminPartnerVenues', Store, 'partner venues'),
  s('partner-redemptions', 'Endirim hesabatı', 'places', 'AdminPartnerRedemptions', Tag, 'partner redemptions endirim hesabat'),
  // Sistem və dillər
  s('settings', 'Tənzimləmələr', 'system', 'AdminSettings', Settings, 'settings ayarlar tənzimləmə aptek'),
  s('crash-reports', 'Xəta hesabatları', 'system', 'AdminCrashReports', AlertTriangle, 'crash xəta hesabat error'),
  s('security', 'Təhlükəsizlik', 'system', 'AdminSecurity', ShieldCheck, 'security admin rol təhlükəsizlik'),
  s('legal', 'Hüquqi sənədlər', 'system', 'AdminLegal', Scale, 'legal hüquqi məxfilik'),
  s('app-updates', 'Yeniləmə mərkəzi', 'system', 'AdminAppUpdates', Smartphone, 'update yeniləmə versiya force məcburi store app store google play'),
  s('force-update', 'Köhnə yeniləmə ayarı', 'system', 'AdminForceUpdate', Smartphone, 'force update versiya legacy'),
  s('languages', 'Dillər', 'system', 'AdminLanguages', Languages, 'languages dil'),
  s('translations', 'Tərcümələr', 'system', 'AdminTranslations', Languages, 'translations tərcümə'),
  s('content-i18n', 'Kontent tərcüməsi', 'system', 'AdminContentTranslations', Languages, 'content i18n tərcümə'),
  s('deeplinks', 'Deeplinklər', 'system', 'AdminDeeplinks', Link2, 'deeplink link'),
  s('revenuecat-debug', 'RevenueCat diaqnostika', 'system', 'RevenueCatDebug', KeyRound, 'revenuecat debug diaqnostika'),
];

/** Legacy/alternate ids kept for deep links. */
export const SECTION_ALIASES: Record<string, string> = {
  premium: 'premium-analytics', notifications: 'push-notifications', ads: 'admob', 'flow-symptoms': 'flow-content',
};

const byId = new globalThis.Map(ADMIN_SECTIONS.map(section => [section.id, section]));

/** Canonical section id for any known id or alias; `null` for unknown ids. */
export function canonicalSection(id: string | null | undefined): string | null {
  if (!id) return null;
  if (byId.has(id)) return id;
  const alias = SECTION_ALIASES[id];
  return alias && byId.has(alias) ? alias : null;
}
export const getSection = (id: string | null | undefined) => { const key = canonicalSection(id); return key ? byId.get(key)! : null; };
export const isKnownSection = (id: string) => canonicalSection(id) !== null;
export const sectionsInGroup = (group: AdminGroupId) => ADMIN_SECTIONS.filter(section => section.group === group);
export const groupOf = (id: string) => ADMIN_GROUPS.find(group => group.id === getSection(id)?.group) ?? null;
/** Component file for an id (aliases keep their historical component). */
export const componentFor = (id: string) => getSection(id)?.component ?? null;

/** Mobile bottom tabs. `section` navigates; `group` opens the section list filtered to that group; `all` opens everything. */
export const MOBILE_TABS: Array<{ key: string; label: string; icon: LucideIcon; section?: string; group?: AdminGroupId; all?: boolean; match: string[] }> = [
  { key: 'home', label: 'İcmal', icon: LayoutDashboard, section: 'dashboard', match: ['dashboard', 'analytics', 'premium-analytics', 'country-stats'] },
  { key: 'orders', label: 'Sifarişlər', icon: Package, section: 'orders', match: ['orders', 'cakes', 'books', 'epoint', 'qaygicash', 'coupons', 'album-orders'] },
  { key: 'users', label: 'İstifadəçilər', icon: Users, section: 'users', match: ['users', 'subscriptions', 'support', 'moderation', 'ad-moderation', 'verified-badges'] },
  { key: 'content', label: 'Məzmun', icon: FileText, group: 'content', match: ADMIN_SECTIONS.filter(item => item.group === 'content').map(item => item.id) },
  { key: 'all', label: 'Hamısı', icon: LayoutGrid, all: true, match: [] },
];
