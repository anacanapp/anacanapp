import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { quotaManagedStorage } from '@/lib/local-storage';

export const BRAND_SOURCE_ORIGIN = 'https://tntbjulojatnrqmylorp.supabase.co';
export const BRAND_AUTH_STORAGE_KEY = 'anacan-brand-portal-auth-v1:source';
export const BRAND_LANGUAGE_KEY = 'anacan-brand-portal-language-v1';
const MANAGED_ORIGINS = ['https://api.anacan.az', 'https://gcp.anacan.az'];
let client: SupabaseClient | undefined;

export function brandBackendConfig(env: Record<string, string | boolean | undefined>) {
  if (env.VITE_BRAND_PORTAL_BACKEND === 'managed-v1') {
    const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (typeof url !== 'string' || !MANAGED_ORIGINS.includes(url) || typeof key !== 'string') throw new Error('BRAND_PORTAL_MANAGED_CONFIGURATION_REQUIRED');
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon' || payload.ref === 'tntbjulojatnrqmylorp') throw new Error('invalid');
    } catch { throw new Error('BRAND_PORTAL_PUBLIC_MANAGED_KEY_REQUIRED'); }
    // The existing RPC protocol calls the managed authority "azure"; its API
    // identity is preserved when its physical hosting moves to Google Cloud.
    return { url, key, reportBackend: 'azure' };
  }
  if (env.VITE_BRAND_PORTAL_BACKEND && env.VITE_BRAND_PORTAL_BACKEND !== 'source') throw new Error('BRAND_PORTAL_BACKEND_MODE_INVALID');
  const key = env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY ||
    (env.VITE_SUPABASE_URL === BRAND_SOURCE_ORIGIN ? env.VITE_SUPABASE_PUBLISHABLE_KEY : '');
  if (typeof key !== 'string' || !key.trim()) throw new Error('BRAND_PORTAL_SOURCE_CONFIGURATION_REQUIRED');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon' || payload.ref !== 'tntbjulojatnrqmylorp') throw new Error('invalid');
    } catch { throw new Error('BRAND_PORTAL_PUBLIC_SOURCE_KEY_REQUIRED'); }
  }
  return { url: BRAND_SOURCE_ORIGIN, key, reportBackend: 'source' };
}

export function brandAuthStorageKey(url: string): string {
  if (url === BRAND_SOURCE_ORIGIN) return BRAND_AUTH_STORAGE_KEY;
  if (!MANAGED_ORIGINS.includes(url)) throw new Error('BRAND_PORTAL_AUTH_REALM_INVALID');
  return `anacan-brand-portal-auth-v1:managed:${new URL(url).hostname}`;
}

/** Independent browser auth realm: never import the application's SDK singleton. */
export function getBrandClient() {
  if (!client) {
    const config = brandBackendConfig(import.meta.env);
    client = createClient(config.url, config.key, { auth: {
      storageKey: brandAuthStorageKey(config.url), persistSession: true, autoRefreshToken: true,
      detectSessionInUrl: false, storage: quotaManagedStorage(window.localStorage),
    } });
  }
  return client;
}
