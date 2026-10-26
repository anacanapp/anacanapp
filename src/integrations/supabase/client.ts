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

export const supabase = createClient<Database>(backend.url, backend.publishableKey, {
  auth: {
    storage: authStorage.storage,
    storageKey: authStorage.storageKey,
    persistSession: true,
    autoRefreshToken: true,
  }
});
