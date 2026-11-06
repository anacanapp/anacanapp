import { AZURE_API_ORIGIN } from '@/integrations/supabase/backend-admission';

// Admin-managed illustration rows (pregnancy_fetus_illustrations,
// baby_month_illustrations) store absolute public Storage URLs. Rows uploaded
// before the Google cutover point at the Azure gateway, which is now Stopped,
// so those images never load. The same object paths are served by the Google
// Storage API, so retired hosts are rewritten at read time. This works for
// persisted React Query caches and older native shells running this bundle.
const RETIRED_STORAGE_HOSTS = new Set([
  'anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io',
]);
const GOOGLE_STORAGE_HOSTS = new Set(['api.anacan.az', 'gcp.anacan.az']);
const PUBLIC_OBJECT_PATH = /^\/storage\/v1\/object\/public\/[^/]+\/.+/;

export function resolvePublicStorageUrl(raw: string | null | undefined): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  // Bundled assets, data/blob URLs and relative paths stay unchanged.
  if (!/^https?:\/\//i.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (RETIRED_STORAGE_HOSTS.has(url.hostname)) {
    // Only public object paths can move to Google; anything else on a stopped host is dead.
    return PUBLIC_OBJECT_PATH.test(url.pathname) ? `${AZURE_API_ORIGIN}${url.pathname}${url.search}` : null;
  }
  // Mixed content is blocked inside the https WebView.
  if (url.protocol === 'http:' && GOOGLE_STORAGE_HOSTS.has(url.hostname)) url.protocol = 'https:';
  return url.href;
}

// ---------------------------------------------------------------------------
// Background loading with retry, so the UI can show a bundled fallback right
// away and swap to the remote image only after it has fully loaded.

const loaded = new Set<string>();
const failed = new Set<string>();
const inflight = new Map<string, Promise<boolean>>();

export const isImageReady = (url: string | null | undefined): boolean => !!url && loaded.has(url);
export const hasImageFailed = (url: string | null | undefined): boolean => !!url && failed.has(url);

const RETRY_DELAYS_MS = [1500, 5000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitUntilOnline = () => new Promise<void>((resolve) => {
  if (typeof navigator === 'undefined' || navigator.onLine !== false || typeof window === 'undefined') {
    resolve();
    return;
  }
  const done = () => { window.removeEventListener('online', done); resolve(); };
  window.addEventListener('online', done);
});

function attempt(url: string, priority: 'high' | 'low'): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(false); return; }
    const img = new Image();
    img.decoding = 'async';
    try { (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority; } catch { /* old WebViews */ }
    img.onload = () => {
      // Decode off the main thread before the swap; ignore decode failures (image is still usable).
      const decoded = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
      void decoded.then(() => resolve(true));
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Loads an image with retries. Resolves true once it is decoded and cached by the browser. */
export function preloadImage(url: string | null | undefined, priority: 'high' | 'low' = 'high'): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (loaded.has(url)) return Promise.resolve(true);
  if (failed.has(url)) return Promise.resolve(false);
  const existing = inflight.get(url);
  if (existing) return existing;
  const run = (async () => {
    for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
      await waitUntilOnline();
      if (await attempt(url, priority)) {
        loaded.add(url);
        return true;
      }
      if (i < RETRY_DELAYS_MS.length) await wait(RETRY_DELAYS_MS[i]);
    }
    failed.add(url);
    return false;
  })().finally(() => inflight.delete(url));
  inflight.set(url, run);
  return run;
}

/** True on Save-Data or 2G connections, where speculative preloads are skipped. */
export function isConstrainedNetwork(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!connection && (connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType || ''));
}

/** Test-only reset of the module caches. */
export function __resetIllustrationImageCache() {
  loaded.clear();
  failed.clear();
  inflight.clear();
}
