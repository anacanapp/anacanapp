import { Capacitor } from '@capacitor/core';
// Application-owned backend-aware SDK factory.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database-types';
import { brokeredPreviewStorage } from './authStorage';
import { resolveAuthStorage } from './auth-storage-key';
import { LEGACY_AUTH_STORAGE_KEY, SOURCE_AUTH_REALM } from './auth-storage-key';
import { getBackendConfig } from './backend-config';

const backend = getBackendConfig();

let storage: ReturnType<typeof brokeredPreviewStorage>;
try { storage = brokeredPreviewStorage(); } catch { /* Let the SDK use memory if storage is blocked. */ }
export const authStorage = {
  ...(backend.sourceFirst
    ? { storageKey: LEGACY_AUTH_STORAGE_KEY, realm: SOURCE_AUTH_REALM, allowLegacyFallback: true }
    : resolveAuthStorage(backend.url, import.meta.env.VITE_AUTH_CUTOVER === 'true')),
  storage,
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Native builds tell the server their version (X-Anacan-Version) so banners and features can be targeted by
// app version on the server (public.request_app_version_v1). Native only: requests go through the native HTTP
// layer there (no CORS); the web app is always current and edge functions keep their fixed CORS header list.
const appVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
const versionHeaders: Record<string, string> =
  appVersion && Capacitor.isNativePlatform() ? { 'X-Anacan-Version': String(appVersion) } : {};

export const supabase = createClient<Database>(backend.url, backend.publishableKey, {
  auth: {
    storage: authStorage.storage,
    storageKey: authStorage.storageKey,
    persistSession: true,
    autoRefreshToken: true,
  },
  ...(Object.keys(versionHeaders).length ? { global: { headers: versionHeaders } } : {}),
});
