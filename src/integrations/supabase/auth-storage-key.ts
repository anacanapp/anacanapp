export const LEGACY_AUTH_STORAGE_KEY = 'sb-tntbjulojatnrqmylorp-auth-token';
export const SOURCE_AUTH_REALM = 'https://tntbjulojatnrqmylorp.supabase.co';

/** Select before createClient; never move credentials or infer validity from a JWT. */
export function resolveAuthStorage(
  supabaseUrl: string,
  cutover = false,
  browser: Pick<Window, 'location' | 'localStorage'> | undefined =
    typeof window === 'undefined' ? undefined : window,
) {
  const url = new URL(supabaseUrl);
  const realm = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  const storageKey = `sb-${url.hostname.split('.')[0]}-auth-token`;
  const defaults = { storageKey, realm, allowLegacyFallback: realm === SOURCE_AUTH_REALM };
  if (cutover !== true || defaults.allowLegacyFallback || !browser) return defaults;

  try {
    const host = browser.location.hostname;
    // No Lovable broker, localhost, or Azure preview host may opt itself in.
    if (host !== 'anacan.az' && !host.endsWith('.anacan.az')) return defaults;

    const storage = browser.localStorage;
    const marker = `anacan.auth-key.v1:${encodeURIComponent(realm)}`;
    const pinned = storage.getItem(marker);
    if (pinned !== null && pinned !== storageKey && pinned !== LEGACY_AUTH_STORAGE_KEY) {
      return defaults;
    }
    const selected = pinned ?? (storage.getItem(storageKey) !== null
      ? storageKey
      : LEGACY_AUTH_STORAGE_KEY);
    // This non-secret pin survives logout; absence must not revive the other key.
    if (pinned === null) writeStorageItem(storage, marker, selected);
    return selected === LEGACY_AUTH_STORAGE_KEY
      ? { storageKey: selected, realm: SOURCE_AUTH_REALM, allowLegacyFallback: true }
      : defaults;
  } catch {
    // Without a durable choice, never expose a source session to the new backend.
    return defaults;
  }
}
import { writeStorageItem } from '@/lib/local-storage';
