// Source-bound catalog translations for the 16 pack languages (NEW_LANGUAGE_CODES).
// They are not bundled into the app: scripts/i18n/content-packs.mjs publishes sharded,
// content-hashed packs at https://app.anacan.az/content-packs/<lang>/ and this module
// downloads only the shards a screen asks for, caches them in IndexedDB and reuses
// them offline. Until a shard is ready, lookups return undefined (tr.ts falls back to
// en/ru) and the shard's arrival is signalled via subscribeContentTranslations.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { NEW_LANGUAGE_CODES, normalizeAppLanguage } from './app-languages';
import { createContentPackLoader, createIndexedDbStore, createMemoryStore } from './content-packs';

const NATIVE_ORIGIN = 'https://app.anacan.az';

function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}
function packOrigin(): string {
  const configured = import.meta.env.VITE_CONTENT_PACKS_ORIGIN as string | undefined;
  if (configured) return configured;
  // Android serves the bundle itself at https://app.anacan.az, so native requests go
  // through CapacitorHttp (real network) rather than the WebView's local asset host.
  return isNative() ? NATIVE_ORIGIN : '';
}

async function fetchPack(url: string, { fresh, timeoutMs }: { fresh: boolean; timeoutMs: number }): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('CONTENT_PACK_TIMEOUT')), timeoutMs); });
  try {
    if (isNative()) {
      const request = CapacitorHttp.request({ url, method: 'GET', responseType: 'text', connectTimeout: timeoutMs, readTimeout: timeoutMs,
        headers: fresh ? { 'Cache-Control': 'no-cache' } : {} });
      const response = await Promise.race([request, timeout]);
      if (response.status !== 200) throw new Error('CONTENT_PACK_HTTP');
      return response.data;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const response = await Promise.race([fetch(url, { cache: fresh ? 'no-cache' : 'default', signal: controller?.signal }), timeout])
      .catch(error => { controller?.abort(); throw error; });
    if (!response.ok) throw new Error('CONTENT_PACK_HTTP');
    return await Promise.race([response.text(), timeout]);
  } finally { clearTimeout(timer); }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) {
    try { return bytesToHex(new Uint8Array(await subtle.digest('SHA-256', bytes))); } catch { /* insecure context */ }
  }
  return bytesToHex(sha256(bytes));
}

const HOT_PREFIX = 'anacan_content_pack_hot:';
const hot = {
  read(language: string): string[] {
    try { const value = JSON.parse(localStorage.getItem(HOT_PREFIX + language) || '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; }
    catch { return []; }
  },
  write(language: string, ids: string[]) { try { localStorage.setItem(HOT_PREFIX + language, JSON.stringify(ids)); } catch { /* optional */ } },
};

const loader = createContentPackLoader({
  baseUrl: packOrigin(),
  languages: NEW_LANGUAGE_CODES,
  fetchPack,
  store: createIndexedDbStore() ?? createMemoryStore(),
  sha256Hex,
  hot,
});
if (typeof window !== 'undefined') window.addEventListener('online', () => loader.retry());

/** Starts (or reuses) the background load for a language. Never rejects; callers
 * must not await it before the first render. */
export function prepareContentLanguage(language: string): Promise<void> {
  return loader.prepare(normalizeAppLanguage(language));
}
export function getBundledContentTranslation(row: Record<string, unknown>, field: string, language: string): unknown {
  return loader.lookup(row, field, normalizeAppLanguage(language));
}
/** Fires after a shard that a lookup was waiting for became available. */
export const subscribeContentTranslations = loader.subscribe;
export const getContentTranslationsVersion = loader.getVersion;
