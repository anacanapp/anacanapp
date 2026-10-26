import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AdBrand } from '@/lib/brand-ads';
import { BRAND_AUTH_STORAGE_KEY, BRAND_SOURCE_ORIGIN } from './client';

export interface BrandAccess { protocol: 'anacan-brand-portal-v1'; user_id: string; allowed: boolean; admin: boolean; brands: AdBrand[] }
const AuthContext = createContext<{
  client: SupabaseClient; session: Session | null; access: BrandAccess | null;
  backendOrigin: string; reportBackend: string;
  loading: boolean; accessError: boolean; reload: () => void;
  signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>;
} | null>(null);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function parseBrandAccess(value: unknown, actor: string): BrandAccess {
  const access = value as BrandAccess;
  if (access?.protocol !== 'anacan-brand-portal-v1' || access.user_id !== actor || typeof access.admin !== 'boolean' || typeof access.allowed !== 'boolean'
    || !Array.isArray(access.brands) || access.brands.some(brand => !uuid.test(brand.id) || typeof brand.name !== 'string' || typeof brand.report_timezone !== 'string')) {
    throw new Error('BRAND_PORTAL_ACCESS_RESPONSE_INVALID');
  }
  return access;
}

export function BrandAuthProvider({ client, children, backendOrigin = BRAND_SOURCE_ORIGIN, storageKey = BRAND_AUTH_STORAGE_KEY, reportBackend = 'source' }: {
  client: SupabaseClient; children: ReactNode; backendOrigin?: string; storageKey?: string; reportBackend?: string;
}) {
  const queries = useQueryClient();
  const [session, setSession] = useState<Session | null>(null), [initializing, setInitializing] = useState(true);
  const actor = useRef<string | null>(null), generation = useRef(0);
  useEffect(() => {
    let alive = true;
    const accept = (next: Session | null) => {
      if (!alive) return;
      generation.current++;
      const id = next?.user?.id ?? null;
      if (actor.current !== id) { void queries.cancelQueries(); queries.clear(); actor.current = id; }
      setSession(next); setInitializing(false);
    };
    const start = generation.current;
    const subscription = client.auth.onAuthStateChange((_event, next) => accept(next));
    const storage = (event: StorageEvent) => { if (event.key === storageKey && event.newValue === null) accept(null); };
    window.addEventListener('storage', storage);
    void client.auth.getSession().then(({ data, error }) => {
      if (generation.current === start) accept(error ? null : data.session);
    }).catch(() => { if (generation.current === start) accept(null); });
    return () => { alive = false; subscription.data.subscription.unsubscribe(); window.removeEventListener('storage', storage); };
  }, [client, queries, storageKey]);
  const userId = session?.user.id;
  const access = useQuery({ queryKey: ['brand-portal-access', backendOrigin, userId], enabled: !!userId,
    staleTime: 0, gcTime: 0, retry: false, refetchInterval: 30000, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('get_brand_portal_access_v1').abortSignal(signal);
      if (error) throw error;
      return parseBrandAccess(data, userId!);
    } });
  const signOut = async () => {
    generation.current++; actor.current = null; setSession(null);
    await queries.cancelQueries(); queries.clear();
    // Logging out of this portal must not revoke a consumer application's session.
    try { await client.auth.signOut({ scope: 'local' }); }
    finally { localStorage.removeItem(storageKey); localStorage.removeItem(storageKey + '-code-verifier'); }
  };
  const signIn = async (email: string, password: string) => {
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('BRAND_PORTAL_LOGIN_FAILED');
  };
  return <AuthContext.Provider value={{ client, session, backendOrigin, reportBackend,
    access: !access.isError && access.data?.user_id === userId ? access.data : null,
    loading: initializing || !!userId && access.isLoading, accessError: access.isError,
    reload: () => { void access.refetch(); }, signIn, signOut }}>{children}</AuthContext.Provider>;
}
export function useBrandAuth() {
  const value = useContext(AuthContext); if (!value) throw new Error('BRAND_PORTAL_AUTH_REQUIRED'); return value;
}
