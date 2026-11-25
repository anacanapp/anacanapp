/**
 * Shared app links opened as web pages (https://app.anacan.az/tools, /premium, /tool/kick-counter,
 * /community/post/<id>, ...). The installed app receives them as Universal/App Links (src/lib/deeplink.ts);
 * when the web app itself renders such a path (signed-in web, admin preview, another app host, a WebView
 * navigation) the router used to show the 404 card. Known app paths are turned into an in-app link that
 * Index routes after sign-in; anything else stays a 404.
 */
import { parseDeeplink } from '@/lib/deeplink';
import { isAppLanguage } from '@/lib/app-languages';
import { safeGetItem, safeRemoveItem, safeSetItem } from '@/lib/safe-storage';

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;
const STORAGE_KEY = 'anacan_pending_app_link';
/** A sign-in (including a provider redirect) normally finishes well inside this window. */
export const APP_LINK_TTL_MS = 30 * 60 * 1000;

/**
 * The anacan:// link for a web path the app knows (e.g. "/tool/kick-counter" -> "anacan://tool/kick-counter"),
 * or null for "/" and unknown paths. Only the language query is carried over.
 */
export function appLinkForPath(pathname: string, search = ''): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length || !parts.every((part) => SEGMENT.test(part))) return null;
  let language: string | null = null;
  try { language = new URLSearchParams(search).get('language'); } catch { /* ignore a malformed query */ }
  const href = `anacan://${parts.join('/')}` + (isAppLanguage(language) ? `?language=${language}` : '');
  const parsed = parseDeeplink(href);
  // Blog and legal pages have their own routes; a blog module link is a home-page query, not a path.
  if (!parsed || parsed.action === 'blog-module') return null;
  if (parsed.action === 'screen' && /^(?:blog|legal)(?:\/|$)/.test(parsed.params.screen)) return null;
  return href;
}

/** Keeps the link for this tab until the user is signed in (survives a sign-in provider redirect). */
export function rememberAppLink(href: string, now = Date.now()): void {
  safeSetItem('sessionStorage', STORAGE_KEY, JSON.stringify({ href, at: now }));
}

/** The remembered link if it is still fresh; it is removed either way. */
export function takeAppLink(now = Date.now()): string | null {
  const raw = safeGetItem('sessionStorage', STORAGE_KEY);
  if (raw === null) return null;
  safeRemoveItem('sessionStorage', STORAGE_KEY);
  try {
    const { href, at } = JSON.parse(raw) as { href?: unknown; at?: unknown };
    if (typeof href !== 'string' || typeof at !== 'number' || now - at > APP_LINK_TTL_MS || now < at) return null;
    return href.startsWith('anacan://') && parseDeeplink(href) ? href : null;
  } catch {
    return null;
  }
}
