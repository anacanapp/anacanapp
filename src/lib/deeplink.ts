import { tr } from "@/lib/tr";import { Capacitor } from '@capacitor/core';
import { appLaunchDestination, APP_ENTRY_HOSTS } from '@/web-entry/policy.mjs';
import { isAppLanguage } from '@/lib/app-languages';

// ═══════════════════════════════════════════════════════════════════════════
// DEEPLINK SYSTEM — anacan:// + https://app.anacan.az Universal Links
// ═══════════════════════════════════════════════════════════════════════════

export interface DeeplinkRoute {
  key: string;
  label: string;
  label_az: string;
  pattern: string; // e.g. /tool/{id}
  example: string;
  category: string;
  description_az: string;
}

// All supported deeplink routes
export const DEEPLINK_ROUTES: DeeplinkRoute[] = [
// ─── Tabs ───
{ key: 'home', label: 'Home', label_az: tr("deeplink_ana_sehife_39721f", "Ana s\u0259hif\u0259"), pattern: '/', example: '/', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_ana_sehifeni_acir_3d8ab0", "Ana s\u0259hif\u0259ni a\xE7\u0131r") },
{ key: 'tools', label: 'Tools', label_az: tr("deeplink_aletler_4778b4", "Al\u0259tl\u0259r"), pattern: '/tools', example: '/tools', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_aletler_hubunu_acir_45ec0e", "Al\u0259tl\u0259r hubunu a\xE7\u0131r") },
{ key: 'ai', label: 'AI Chat', label_az: tr("deeplink_ai_sohbet_b8298c", "AI S\xF6hb\u0259t"), pattern: '/ai', example: '/ai', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_ai_sohbeti_acir_7e3442", "AI s\xF6hb\u0259ti a\xE7\u0131r") },
{ key: 'community', label: 'Community', label_az: 'İcma', pattern: '/community', example: '/community', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_i_cma_bolmesini_acir_7abff0", "\u0130cma b\xF6lm\u0259sini a\xE7\u0131r") },
{ key: 'profile', label: 'Profile', label_az: 'Profil', pattern: '/profile', example: '/profile', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_profil_bolmesini_acir_d98cb4", "Profil b\xF6lm\u0259sini a\xE7\u0131r") },
{ key: 'cakes', label: 'Cakes', label_az: 'Tortlar', pattern: '/cakes', example: '/cakes', category: tr("deeplink_esas_6d87f7", "\u018Fsas"), description_az: tr("deeplink_tortlar_bolmesini_acir_fdf182", "Tortlar b\xF6lm\u0259sini a\xE7\u0131r") },

// ─── Tools ───
{ key: 'tool', label: 'Specific Tool', label_az: tr("deeplink_spesifik_alet_3c4b49", "Spesifik Al\u0259t"), pattern: '/tool/{tool_id}', example: '/tool/baby-names', category: tr("deeplink_aletler_4778b4", "Al\u0259tl\u0259r"), description_az: tr("deeplink_mueyyen_bir_aleti_acir_c91de9", "M\xFC\u0259yy\u0259n bir al\u0259ti a\xE7\u0131r") },

// ─── Screens ───
{ key: 'premium', label: 'Premium', label_az: 'Premium', pattern: '/premium', example: '/premium', category: 'Ekranlar', description_az: tr("deeplink_premium_paywall_u_acir_a7d504", "Premium paywall-u a\xE7\u0131r") },
{ key: 'settings', label: 'Settings', label_az: tr("deeplink_tenzimlemeler_085659", "T\u0259nziml\u0259m\u0259l\u0259r"), pattern: '/settings', example: '/settings', category: 'Ekranlar', description_az: tr("deeplink_tenzimlemeleri_acir_f49067", "T\u0259nziml\u0259m\u0259l\u0259ri a\xE7\u0131r") },
{ key: 'notifications', label: 'Notifications', label_az: tr("deeplink_bildirisler_54eb88", "Bildiri\u015Fl\u0259r"), pattern: '/notifications', example: '/notifications', category: 'Ekranlar', description_az: tr("deeplink_bildirisleri_acir_81bd18", "Bildiri\u015Fl\u0259ri a\xE7\u0131r") },
{ key: 'calendar', label: 'Calendar', label_az: tr("deeplink_teqvim_584bdd", "T\u0259qvim"), pattern: '/calendar', example: '/calendar', category: 'Ekranlar', description_az: tr("deeplink_teqvimi_acir_4bb0e4", "T\u0259qvimi a\xE7\u0131r") },
{ key: 'help', label: 'Help', label_az: tr("deeplink_komek_2bdf68", "K\xF6m\u0259k"), pattern: '/help', example: '/help', category: 'Ekranlar', description_az: tr("deeplink_komek_bolmesini_acir_c2a6fc", "K\xF6m\u0259k b\xF6lm\u0259sini a\xE7\u0131r") },
{ key: 'edit-profile', label: 'Edit Profile', label_az: tr("deeplink_profil_redakte_aac872", "Profil Redakt\u0259"), pattern: '/edit-profile', example: '/edit-profile', category: 'Ekranlar', description_az: tr("deeplink_profil_redakte_sehifesini_acir_08b41e", "Profil redakt\u0259 s\u0259hif\u0259sini a\xE7\u0131r") },
{ key: 'appearance', label: 'Appearance', label_az: tr("deeplink_gorunus_165fe3", "G\xF6r\xFCn\xFC\u015F"), pattern: '/appearance', example: '/appearance', category: 'Ekranlar', description_az: tr("deeplink_gorunus_tenzimlemelerini_acir_0fb0db", "G\xF6r\xFCn\xFC\u015F t\u0259nziml\u0259m\u0259l\u0259rini a\xE7\u0131r") },

// ─── Blog ───
{ key: 'blog', label: 'Blog', label_az: 'Bloq', pattern: '/blog', example: '/blog', category: tr("deeplink_mezmun_f1d51d", "M\u0259zmun"), description_az: tr("deeplink_bloq_bolmesini_acir_5071e9", "Bloq b\xF6lm\u0259sini a\xE7\u0131r") },
{ key: 'blog-post', label: 'Blog Post', label_az: tr("deeplink_bloq_yazisi_062ec4", "Bloq Yaz\u0131s\u0131"), pattern: '/blog/{slug}', example: '/blog/my-article', category: tr("deeplink_mezmun_f1d51d", "M\u0259zmun"), description_az: tr("deeplink_mueyyen_bir_bloq_yazisini_acir_15e9fc", "M\xFC\u0259yy\u0259n bir bloq yaz\u0131s\u0131n\u0131 a\xE7\u0131r") },

// ─── Messages ───
{ key: 'messages', label: 'Messages', label_az: 'Mesajlar', pattern: '/messages', example: '/messages', category: 'Mesajlar', description_az: tr("deeplink_mesajlar_siyahisini_acir_d55b87", "Mesajlar siyah\u0131s\u0131n\u0131 a\xE7\u0131r") },
{ key: 'messages-user', label: 'Chat with User', label_az: tr("deeplink_i_stifadeci_ile_sohbet_43af6f", "\u0130stifad\u0259\xE7i il\u0259 S\xF6hb\u0259t"), pattern: '/messages/{user_id}', example: '/messages/abc-123', category: 'Mesajlar', description_az: tr("deeplink_mueyyen_bir_istifadeci_ile_soh_619b0a", "M\xFC\u0259yy\u0259n bir istifad\u0259\xE7i il\u0259 s\xF6hb\u0259ti a\xE7\u0131r") },

// ─── Community ───
{ key: 'community-post', label: 'Community Post', label_az: tr("deeplink_i_cma_paylasimi_0b84e6", "\u0130cma Payla\u015F\u0131m\u0131"), pattern: '/community/post/{post_id}', example: '/community/post/abc-123', category: 'İcma', description_az: tr("deeplink_mueyyen_bir_icma_paylasimini_a_07c886", "M\xFC\u0259yy\u0259n bir icma payla\u015F\u0131m\u0131n\u0131 a\xE7\u0131r") },
{ key: 'user-profile', label: 'User Profile', label_az: tr("deeplink_i_stifadeci_profili_69e0a9", "\u0130stifad\u0259\xE7i Profili"), pattern: '/user/{user_id}', example: '/user/abc-123', category: 'İcma', description_az: tr("deeplink_i_stifadeci_profilini_acir_d3ae0f", "\u0130stifad\u0259\xE7i profilini a\xE7\u0131r") },

// ─── Legal ───
{ key: 'legal', label: 'Legal', label_az: tr("deeplink_huquqi_ceb5d3", "H\xFCquqi"), pattern: '/legal/{doc_type}', example: '/legal/privacy', category: tr("deeplink_diger_293b3a", "Dig\u0259r"), description_az: tr("deeplink_huquqi_senedi_acir_bc1b2e", "H\xFCquqi s\u0259n\u0259di a\xE7\u0131r") }];


export interface ParsedDeeplink {
  action: string;
  params: Record<string, string>;
}

/**
 * Parse a deeplink URL (both anacan:// and https://app.anacan.az paths)
 */
function parseDeeplinkRoute(url: string): ParsedDeeplink | null {
  let path = '';
  let query = '';

  try {
    if (url.startsWith('anacan://') || url.startsWith('com.atlasoon.anacan://')) {
      const parsed = new URL(url);
      if (parsed.username || parsed.password || parsed.port) return null;
      path = '/' + parsed.hostname + parsed.pathname;
      query = parsed.search;
    } else if (/^https:\/\//.test(url)) {
      const parsed = new URL(url);
      if (!APP_ENTRY_HOSTS.includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) return null;
      path = parsed.pathname;
      query = parsed.search;
    } else if (url.startsWith('/')) {
      const parsed = new URL(url, 'https://app.anacan.az'); if (parsed.origin !== 'https://app.anacan.az') return null;
      path = parsed.pathname; query = parsed.search;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  // Remove trailing slash
  path = path.replace(/\/$/, '') || '/';

  const parameters = new URLSearchParams(query), requestedModule = parameters.get('blog_module');
  if (requestedModule && ['sleep','feeding','diaper','babyGrowth','hospitalBag','calendar'].includes(requestedModule)) {
    const destination = appLaunchDestination('https://app.anacan.az' + path + query);
    return { action: 'blog-module', params: { module: requestedModule, language: destination.language } };
  }
  const localizedBlog = /^\/blog\/(az|en|tr|ru|de|ar|ka|kk|uz|zh|id|fr|es|pt|vi|hi|ja|ko|pl|nl|sv)(?:\/([^/]+))?$/.exec(path);
  if (localizedBlog) {
    try {
      const slug = localizedBlog[2] ? decodeURIComponent(localizedBlog[2]) : '';
      if (slug && /[\s/\\\u0000-\u001f<>?#]/u.test(slug)) return null;
      return { action: 'screen', params: { screen: slug ? `blog/${slug}` : 'blog', language: localizedBlog[1] } };
    } catch { return null; }
  }

  // Match against routes
  // /tool/{tool_id} → regex /^\/tool\/([^/]+)$/
  if (path === '/') return { action: 'tab', params: { tab: 'home' } };
  if (path === '/tools') return { action: 'tab', params: { tab: 'tools' } };
  if (path === '/ai') return { action: 'tab', params: { tab: 'ai' } };
  if (path === '/community') return { action: 'tab', params: { tab: 'community' } };
  if (path === '/profile') return { action: 'tab', params: { tab: 'profile' } };
  if (path === '/cakes') return { action: 'tab', params: { tab: 'cakes' } };

  // Tool
  const toolMatch = path.match(/^\/tool\/([^/]+)$/);
  if (toolMatch) return { action: 'tool', params: { tool_id: toolMatch[1] } };

  // Screens
  if (path === '/premium') return { action: 'screen', params: { screen: 'billing' } };
  if (path === '/settings') return { action: 'screen', params: { screen: 'settings' } };
  if (path === '/notifications') return { action: 'screen', params: { screen: 'notifications' } };
  if (path === '/calendar') return { action: 'screen', params: { screen: 'calendar' } };
  if (path === '/help') return { action: 'screen', params: { screen: 'help' } };
  if (path === '/edit-profile') return { action: 'screen', params: { screen: 'edit-profile' } };
  if (path === '/appearance') return { action: 'screen', params: { screen: 'appearance' } };

  // Blog
  if (path === '/blog') return { action: 'screen', params: { screen: 'blog' } };
  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    try { const slug = decodeURIComponent(blogMatch[1]); if (/[\s/\\\u0000-\u001f<>]/.test(slug) || slug === '.' || slug === '..') return null;
      return { action: 'screen', params: { screen: `blog/${slug}` } }; } catch { return null; }
  }

  // Messages
  if (path === '/messages') return { action: 'messages', params: {} };
  const msgMatch = path.match(/^\/messages\/([^/]+)$/);
  if (msgMatch) return { action: 'messages', params: { user_id: msgMatch[1] } };

  // Community post
  const postMatch = path.match(/^\/community\/post\/([^/]+)$/);
  if (postMatch) return { action: 'community-post', params: { post_id: postMatch[1] } };

  // User profile
  const userMatch = path.match(/^\/user\/([^/]+)$/);
  if (userMatch) return { action: 'user-profile', params: { user_id: userMatch[1] } };

  // Legal
  const legalMatch = path.match(/^\/legal\/([^/]+)$/);
  if (legalMatch) return { action: 'screen', params: { screen: `legal/${legalMatch[1]}` } };

  return null;
}

export function parseDeeplink(url: string): ParsedDeeplink | null {
  const parsed = parseDeeplinkRoute(url);
  if (!parsed) return null;
  const query = new URL(url, 'https://app.anacan.az').searchParams;
  const language = query.get('blog_language') || query.get('language');
  if (isAppLanguage(language)) parsed.params.language = language;
  return parsed;
}

/**
 * Generate a deeplink URL
 */
export function generateDeeplink(
pattern: string,
params: Record<string, string> = {},
format: 'scheme' | 'universal' = 'universal')
: string {
  let path = pattern;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, value);
  }

  if (format === 'scheme') {
    // anacan://tool/baby-names (strip leading /)
    return path === '/' ? 'anacan:///' : 'anacan:/' + path;
  }
  // https://app.anacan.az/tool/baby-names
  return 'https://app.anacan.az' + path;
}

/**
 * Initialize native deeplink listener (Capacitor App plugin)
 */
export function initDeeplinkListener(handler: (parsed: ParsedDeeplink) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};

  let cleanup: (() => void) | undefined, cancelled = false;

  import('@capacitor/app').then(async ({ App }) => {
    // Handle app opened via URL (cold start or background)
    const listener = App.addListener('appUrlOpen', (event) => {
      const parsed = parseDeeplink(event.url);
      if (parsed && !cancelled) {
        handler(parsed);
      }
    });

    cleanup = () => {
      listener.then((l) => l.remove());
    };
    if (cancelled) { cleanup(); return; }
    if (!launchLinkChecked) {
      launchLinkChecked = true;
      const launch = await App.getLaunchUrl().catch(() => undefined);
      if (launch?.url && !cancelled) { const parsed = parseDeeplink(launch.url); if (parsed) handler(parsed); }
    }
  }).catch((err) => {
    console.warn('[Deeplink] Failed to init listener:', err);
  });

  return () => { cancelled = true; cleanup?.(); };
}
let launchLinkChecked = false;
