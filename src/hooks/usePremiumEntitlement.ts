import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';

interface Grant { active: boolean; expiresAt: string | null; source: string }
interface Access { protocol: 'anacan-premium-access-v1'; userId: string; own: Grant; household: Grant; checkedAt: string; validUntil: string }
const entitlementRoots = new Set(['premium-access-v1','subscription','household-premium']);
const roots = new Set([...entitlementRoots,'community-feed','community-profile-card','stories','chat-authors-v2','banners']);
const contentRoots = new Set([...roots].filter(root => !entitlementRoots.has(root)));
const RESUME_COALESCE_MS = 2000;
export function usePremiumEntitlement(monitor = false) {
  const { user, profile } = useAuth(), backend = getBackendConfig().url, client = useQueryClient();
  const actor = user?.id ?? null;
  const partner = profile?.user_id === actor ? profile?.linked_partner_id ?? null : null;
  const query = useQuery({
    queryKey: ['premium-access-v1', backend, actor, partner], enabled: !!actor, staleTime: 0, gcTime: 0, retry: false,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', refetchInterval: monitor ? 15000 : false,
    queryFn: async () => {
      const requestedAt = performance.now();
      const { data, error } = await (supabase as any).rpc('get_premium_access_v1', { p_user_id: actor });
      if (error) throw error;
      const access = data as Access;
      if (access?.protocol !== 'anacan-premium-access-v1' || access.userId !== actor || typeof access.own?.active !== 'boolean' || typeof access.household?.active !== 'boolean') throw new Error('PREMIUM_ACCESS_INVALID');
      const checked = Date.parse(access.checkedAt), lease = Date.parse(access.validUntil);
      if (!Number.isFinite(checked) || !Number.isFinite(lease) || lease <= checked || lease - checked > 31000) throw new Error('PREMIUM_LEASE_INVALID');
      const deadline = (grant: Grant) => grant.active ? Math.min(lease - checked, grant.expiresAt === null ? Infinity : Date.parse(grant.expiresAt) - checked) : 0;
      return { access, ownDeadline: requestedAt + Math.max(0, deadline(access.own)), householdDeadline: requestedAt + Math.max(0, deadline(access.household)) };
    },
  });
  const [, tick] = useState(0), data = query.data;
  const own = !!actor && data?.access.userId === actor && data.ownDeadline > performance.now();
  const household = !!actor && data?.access.userId === actor && data.householdDeadline > performance.now();
  useEffect(() => {
    const next = Math.min(...[data?.ownDeadline, data?.householdDeadline].filter((value): value is number => typeof value === 'number' && value > performance.now()));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.max(1, next - performance.now() + 1));
    return () => clearTimeout(timer);
  });
  const premium = own || household, resolved = !!actor && query.isSuccess;
  const lastPremiumRef = useRef<{ key: string; premium: boolean } | null>(null);
  useEffect(() => {
    // Content that renders Premium state is refreshed only when the resolved
    // status actually changes, not on every resume/focus.
    if (!monitor || !actor || !resolved) return;
    const key = `${backend}:${actor}`, previous = lastPremiumRef.current;
    lastPremiumRef.current = { key, premium };
    if (previous && previous.key === key && previous.premium !== premium)
      void client.invalidateQueries({ predicate: query => contentRoots.has(String(query.queryKey[0])) });
  }, [monitor, actor, backend, resolved, premium, client]);
  useEffect(() => {
    if (!monitor || !actor) return;
    const refresh = () => { void client.invalidateQueries({ predicate: query => roots.has(String(query.queryKey[0])) }); };
    // focus + visibilitychange (+ online) all fire on one resume: coalesce them
    // and only re-check the entitlement itself.
    let lastResume = -Infinity;
    const resume = () => {
      const now = performance.now();
      if (now - lastResume < RESUME_COALESCE_MS) return;
      lastResume = now;
      void client.invalidateQueries({ predicate: query => entitlementRoots.has(String(query.queryKey[0])) }, { cancelRefetch: false });
    };
    const visible = () => { if (document.visibilityState === 'visible') resume(); };
    const channel = supabase.channel(`premium-access:${actor}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${actor}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${actor}` }, refresh).subscribe();
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', resume); window.addEventListener('online', resume);
    return () => { void supabase.removeChannel(channel); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); };
  }, [monitor, actor, backend, client]);
  return { ownPremium: own, householdPremium: household, isPremium: own || household, ready: !!actor && query.isSuccess, loading: !!actor && query.isLoading, refresh: query.refetch };
}
export function PremiumEntitlementMonitor() {
  const { isPremium } = usePremiumEntitlement(true);
  const playing = useWhiteNoiseStore(state => state.isPlaying);
  useEffect(() => {
    // Playback survives the tool screen. Expiry must stop that global activity,
    // including audio still running while the dashboard is open.
    if (!isPremium && playing) useWhiteNoiseStore.getState().stop();
  }, [isPremium, playing]);
  return null;
}
