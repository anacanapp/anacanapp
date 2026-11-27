import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';
import { evaluateGrant, readGrantRecord, recordFromServer, writeGrantRecord } from '@/lib/premium-grant-cache';

interface Grant { active: boolean; expiresAt: string | null; source: string }
interface Access { protocol: 'anacan-premium-access-v1'; userId: string; own: Grant; household: Grant; checkedAt: string; validUntil: string }
const entitlementRoots = new Set(['premium-access-v1','subscription','household-premium']);
const roots = new Set([...entitlementRoots,'community-feed','community-profile-card','stories','chat-authors-v2','banners']);
const contentRoots = new Set([...roots].filter(root => !entitlementRoots.has(root)));
const RESUME_COALESCE_MS = 2000;
export const PREMIUM_ACCESS_POLL_MS = 10 * 60_000;
/** A hung request (captive portal, stalled token refresh) becomes an error instead of an endless spinner. */
const PREMIUM_ACCESS_TIMEOUT_MS = 15_000;
export const PREMIUM_ACCESS_QUERY_OPTIONS = {
  staleTime: 60_000, gcTime: 5 * 60_000, retry: false,
  refetchOnMount: true, refetchOnWindowFocus: true, refetchOnReconnect: true,
} as const;
function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([Promise.resolve(work), new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('PREMIUM_ACCESS_TIMEOUT')), ms);
  })]).finally(() => clearTimeout(timer));
}
export function usePremiumEntitlement(monitor = false) {
  const { user, profile } = useAuth(), backend = getBackendConfig().url, client = useQueryClient();
  const actor = user?.id ?? null;
  const partner = profile?.user_id === actor ? profile?.linked_partner_id ?? null : null;
  const query = useQuery({
    // Many components mount this hook: one shared answer is reused for 60s. Fresh reads come from
    // resume/focus/online (the monitor below), realtime subscription/profile changes, explicit
    // invalidation after purchase/restore/promo, and a slow 10 min foreground poll. Between reads
    // the confirmed grant (premium-grant-cache) carries Premium, so the 31s lease is not polled.
    queryKey: ['premium-access-v1', backend, actor, partner], enabled: !!actor, ...PREMIUM_ACCESS_QUERY_OPTIONS,
    refetchInterval: monitor ? PREMIUM_ACCESS_POLL_MS : false,
    queryFn: async () => {
      const { data, error } = await withTimeout<{ data: unknown; error: unknown }>((supabase as any).rpc('get_premium_access_v1', { p_user_id: actor }), PREMIUM_ACCESS_TIMEOUT_MS);
      if (error) throw error;
      const access = data as Access;
      if (access?.protocol !== 'anacan-premium-access-v1' || access.userId !== actor || typeof access.own?.active !== 'boolean' || typeof access.household?.active !== 'boolean') throw new Error('PREMIUM_ACCESS_INVALID');
      const checked = Date.parse(access.checkedAt), lease = Date.parse(access.validUntil);
      if (!Number.isFinite(checked) || !Number.isFinite(lease) || lease <= checked || lease - checked > 31000) throw new Error('PREMIUM_LEASE_INVALID');
      // Only a validated answer for this backend/account/partner is recorded. An explicit
      // inactive answer replaces (and removes) any earlier offline grant at once.
      const record = recordFromServer({ backend, userId: actor!, partner, checkedAt: access.checkedAt, own: access.own, household: access.household });
      writeGrantRecord(record);
      // Monotonic anchor: in this session the grant ages with performance.now(), so moving
      // the device clock neither extends nor cuts it.
      return { access, record, monoAt: performance.now() };
    },
  });
  const [, tick] = useState(0), data = query.data;
  // The stored record carries a confirmed grant across restarts and offline periods;
  // the in-memory one covers storage that is unavailable.
  const stored = useMemo(() => actor ? readGrantRecord(backend, actor) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backend, actor, query.dataUpdatedAt]);
  // This session's answer (also after a failed refresh, which keeps the last data) ages
  // monotonically; after a restart the stored record is checked against the wall clock.
  const memory = data && data.access.userId === actor ? data : null;
  const record = memory ? memory.record : stored;
  const now = memory ? memory.record.confirmedAt + (performance.now() - memory.monoAt) : Date.now();
  const grant = evaluateGrant(record, { backend, userId: actor, partner }, now);
  const own = !!actor && grant.own;
  const household = !!actor && grant.household;
  useEffect(() => {
    if (grant.nextChange === null) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.max(1, Math.min(grant.nextChange - now + 1, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  });
  const premium = own || household, resolved = !!actor && query.isSuccess;
  // Revocation is an explicit server answer or the confirmed grant reaching its end;
  // a timeout or network error alone never revokes.
  const revoked = !!actor && !premium && (query.isSuccess || grant.hadGrant);
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
  return {
    ownPremium: own, householdPremium: household, isPremium: premium,
    ready: !!actor && (query.isSuccess || premium), loading: !!actor && query.isLoading && !premium,
    /** The latest entitlement request failed (offline/timeout); Premium then rests on the confirmed grant. */
    error: !!actor && query.isError, revoked,
    ownSource: own ? record?.ownSource ?? null : null,
    refresh: query.refetch,
  };
}
export function PremiumEntitlementMonitor() {
  const { revoked } = usePremiumEntitlement(true);
  const playing = useWhiteNoiseStore(state => state.isPlaying);
  useEffect(() => {
    // Playback survives the tool screen. Expiry or an explicit server revocation
    // stops that global activity; a timeout/network error never does.
    if (revoked && playing) useWhiteNoiseStore.getState().stop();
  }, [revoked, playing]);
  return null;
}
