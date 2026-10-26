import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';
import { useUserStore } from '@/store/userStore';

export type InsightSection = 'sleep' | 'feeding' | 'diaper';
export type SectionStatus = 'normal' | 'low' | 'high' | 'watch';
export interface SectionInsight { status: SectionStatus; note: string }
export interface BabyInsightStats {
  sleepMinutes: number; sleepCount: number; feedingCount: number; breastCount: number;
  formulaCount: number; formulaMl: number; solidCount: number; diaperCount: number; wetCount: number; dirtyCount: number; mixedCount: number;
}
export interface BabyInsightChild { id: string; ageMonths: number; ageDays: number; gender?: string }
interface SectionState { insight: SectionInsight | null; hash: string | null; loading: boolean; error: boolean; limitReached: boolean }
export type BabyInsightApi = Record<InsightSection, SectionState & { stale: boolean; request: () => void }>;
const FIELDS = {
  sleep: ['sleepMinutes', 'sleepCount'],
  feeding: ['feedingCount', 'breastCount', 'formulaCount', 'formulaMl', 'solidCount'],
  diaper: ['diaperCount', 'wetCount', 'dirtyCount', 'mixedCount'],
} as const;
const empty = (): SectionState => ({ insight: null, hash: null, loading: false, error: false, limitReached: false });
const fresh = () => ({ sleep: empty(), feeding: empty(), diaper: empty() });
const valid = (value: any): value is SectionInsight => value && ['normal','low','high','watch'].includes(value.status) && typeof value.note === 'string' && !!value.note.trim() && value.note.length <= 1000;

export function useBabyInsight(stats: BabyInsightStats | null, child: BabyInsightChild | null): BabyInsightApi {
  const { user } = useAuth(), { peekRemainingDaily } = useSubscription();
  const language = useUserStore(state => state.language), backend = getBackendConfig().url;
  const scope = user && child ? JSON.stringify([backend, user.id, child.id, language]) : null;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const alive = useRef(true), pending = useRef(new Set<string>());
  const [state, setState] = useState(fresh), stateRef = useRef(state); stateRef.current = state;
  const [stateScope, setStateScope] = useState(scope);
  const selectedStats = (section: InsightSection) => stats ? { ...Object.fromEntries(FIELDS[section].map(key => [key, stats[key]])), localHour: new Date().getHours() } : null;
  const hashFor = (section: InsightSection) => JSON.stringify([scope, format(new Date(), 'yyyy-MM-dd'), child?.ageMonths, child?.ageDays, child?.gender, selectedStats(section)]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const next = fresh();
    if (scope) for (const section of Object.keys(FIELDS) as InsightSection[]) {
      try {
        const stored = JSON.parse(localStorage.getItem(`anacan-baby-insight-v2:${scope}:${section}`) || 'null');
        if (valid(stored?.insight) && typeof stored.hash === 'string') next[section] = { ...empty(), hash: stored.hash, insight: stored.insight };
      } catch { /* Optional private cache; another account's cache is never read. */ }
    }
    setStateScope(scope); setState(next);
  }, [scope]);
  const request = useCallback(async (section: InsightSection) => {
    if (!scope || !stats || !child) return;
    const lock = `${scope}:${section}`, hash = hashFor(section);
    if (pending.current.has(lock) || stateRef.current[section].hash === hash && stateRef.current[section].insight) return;
    pending.current.add(lock);
    const update = (patch: Partial<SectionState>) => {
      if (alive.current && scopeRef.current === scope) setState(current => ({ ...current, [section]: { ...current[section], ...patch } }));
    };
    update({ loading: true, error: false, limitReached: false });
    try {
      // The Edge Function consumes the allowance once. The client only checks it.
      const { remaining } = await peekRemainingDaily('baby_insight');
      if (remaining <= 0) { update({ limitReached: true }); return; }
      if (scopeRef.current !== scope) return;
      const { data, error } = await supabase.functions.invoke('baby-insight', { body: {
        section, language, child: { ageMonths: child.ageMonths, ageDays: child.ageDays, gender: child.gender }, stats: selectedStats(section),
      } });
      if ((error as any)?.context?.status === 429 || data?.error === 'daily_limit_exceeded') { update({ limitReached: true }); return; }
      const insight = data?.insight?.[section];
      if (error || !data?.success || !valid(insight)) throw new Error('BABY_INSIGHT_UNAVAILABLE');
      if (scopeRef.current !== scope || !alive.current) return;
      update({ insight, hash });
      try { localStorage.setItem(`anacan-baby-insight-v2:${scope}:${section}`, JSON.stringify({ hash, insight })); } catch { /* no cache is required to show a result */ }
    } catch { update({ error: true }); }
    finally { pending.current.delete(lock); update({ loading: false }); }
  }, [scope, stats, child, language, peekRemainingDaily]);
  return Object.fromEntries((Object.keys(FIELDS) as InsightSection[]).map(section => [section, {
    ...(stateScope === scope ? state[section] : empty()), stale: stateScope === scope && !!state[section].insight && state[section].hash !== hashFor(section), request: () => { void request(section); },
  }])) as BabyInsightApi;
}
