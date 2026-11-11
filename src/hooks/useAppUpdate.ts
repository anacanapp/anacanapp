import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { readAppLanguage } from '@/lib/app-languages';

/** Decision returned by get_app_update_v1 (server picks the strongest matching rule; texts already in the user's
 *  language, falling back to English). */
export interface AppUpdateDecision {
  protocol: 'anacan-app-update-v1';
  rule_id: string;
  mode: 'force' | 'soft' | 'banner';
  frequency: 'every_launch' | 'daily' | 'once';
  target_version: string;
  store_version: string | null;
  title: string | null;
  body: string | null;
  whats_new: string[];
  button: string | null;
  later: string | null;
  store_url: string;
}

const CACHE_KEY = 'anacan_app_update_v1';
const LATER_KEY = (ruleId: string) => `anacan_app_update_later_${ruleId}`;
const CACHE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// One sheet per launch for every_launch rules (module scope survives re-renders, not a cold start).
const shownThisLaunch = new Set<string>();

function readCache(): AppUpdateDecision | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, decision } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS ? decision : null;
  } catch { return null; }
}
function writeCache(decision: AppUpdateDecision | null) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), decision })); } catch { /* storage blocked */ }
}

/** Whether a soft rule's sheet may show now, given when "Later" was last tapped. Exported for tests. */
export function softSheetAllowed(decision: AppUpdateDecision, laterAt: number | null, now = Date.now()): boolean {
  if (decision.mode !== 'soft') return false;
  if (decision.frequency === 'every_launch') return !shownThisLaunch.has(decision.rule_id);
  if (laterAt === null) return true;
  if (decision.frequency === 'once') return false;
  return now - laterAt >= DAY_MS;
}

function isDecision(value: unknown): value is AppUpdateDecision {
  const v = value as AppUpdateDecision | null;
  return !!v && v.protocol === 'anacan-app-update-v1' && ['force', 'soft', 'banner'].includes(v.mode) && typeof v.store_url === 'string';
}

/**
 * Asks the server what to show this app: nothing, a banner, a soft sheet or a forced update. Native only (the web
 * app is always current). Checks at launch, when the app returns to the foreground and every 6 hours; the last
 * answer is kept for 24 hours so an offline start still enforces a forced update.
 */
export function useAppUpdate(country?: string | null) {
  const native = Capacitor.isNativePlatform();
  const [laterTick, setLaterTick] = useState(0);
  const query = useQuery({
    queryKey: ['app-update-decision', country || null],
    queryFn: async () => {
      const info = await App.getInfo();
      const { data, error } = await supabase.rpc('get_app_update_v1' as never, {
        p_platform: Capacitor.getPlatform(), p_version: info.version, p_language: readAppLanguage(), p_country: country || null,
      } as never);
      if (error) throw error;
      const decision = isDecision(data) ? data : null;
      writeCache(decision);
      return { decision, version: info.version };
    },
    enabled: native,
    staleTime: 60_000,
    refetchInterval: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  // Re-check when the app comes back to the foreground.
  const { refetch } = query;
  useEffect(() => {
    if (!native) return;
    let remove: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) void refetch(); })
      .then((handle) => { remove = () => void handle.remove(); })
      .catch(() => {});
    return () => remove?.();
  }, [native, refetch]);

  const decision = native ? (query.data?.decision ?? (query.isError ? readCache() : null)) : null;
  const laterAt = useMemo(() => {
    if (!decision) return null;
    try { const v = Number(localStorage.getItem(LATER_KEY(decision.rule_id))); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision?.rule_id, laterTick]);

  const showSheet = !!decision && softSheetAllowed(decision, laterAt);
  // A dismissed (or banner-only) rule stays visible as a banner on the home screen.
  const showBanner = !!decision && (decision.mode === 'banner' || (decision.mode === 'soft' && !showSheet));

  const later = useCallback(() => {
    if (!decision) return;
    shownThisLaunch.add(decision.rule_id);
    try { localStorage.setItem(LATER_KEY(decision.rule_id), String(Date.now())); } catch { /* storage blocked */ }
    setLaterTick((n) => n + 1);
  }, [decision]);

  const openStore = useCallback(() => {
    if (!decision) return;
    window.open(decision.store_url, '_system');
  }, [decision]);

  return {
    decision,
    currentVersion: query.data?.version ?? null,
    forceRequired: decision?.mode === 'force',
    showSheet,
    showBanner,
    later,
    openStore,
  };
}
