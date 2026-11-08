import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

/**
 * First aid must work offline in an emergency. All active scenarios and ALL of
 * their steps are fetched together for the app language and kept in a small
 * dedicated localStorage entry (independent of the shared react-query persist
 * cache, which may evict old queries when storage is full). Every later open
 * reads that entry first, so a scenario never opened before still has its
 * steps without network.
 */

export interface FirstAidScenario {
  id: string;
  /** Localized display title (already mapped to the app language). */
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  emergency_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface FirstAidStep {
  id: string;
  scenario_id: string;
  step_number: number;
  /** Localized display title / instruction. */
  title: string;
  instruction: string;
  duration_seconds: number | null;
  is_critical: boolean;
}

export interface FirstAidBundle {
  v: 1;
  language: string;
  savedAt: number;
  scenarios: FirstAidScenario[];
  stepsByScenario: Record<string, FirstAidStep[]>;
}

export const FIRST_AID_CACHE_KEY = 'anacan-firstaid-v1';
const FRESH_MS = 1000 * 60 * 60 * 24; // refetch online at most once a day

export const firstAidQueryKey = (language: string) => ['first-aid-bundle', language] as const;

function isBundle(value: unknown): value is FirstAidBundle {
  const b = value as FirstAidBundle | null;
  return !!b && b.v === 1 && typeof b.language === 'string' && Array.isArray(b.scenarios)
    && !!b.stepsByScenario && typeof b.stepsByScenario === 'object';
}

/** Cached bundle of any language (the most recently saved one). */
export function readFirstAidCache(): FirstAidBundle | null {
  try {
    const raw = localStorage.getItem(FIRST_AID_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeFirstAidCache(bundle: FirstAidBundle): void {
  try {
    localStorage.setItem(FIRST_AID_CACHE_KEY, JSON.stringify(bundle));
  } catch {
    /* storage full / blocked: in-memory query data still works this session */
  }
}

/** Builds the compact, language-projected bundle from raw DB rows. */
export function buildFirstAidBundle(
  scenarioRows: Record<string, any>[] | null | undefined,
  stepRows: Record<string, any>[] | null | undefined,
  language: string,
  now = Date.now(),
): FirstAidBundle {
  const scenarios = mapRowsTranslation(scenarioRows ?? [], language, ['title', 'description']).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? row.title_az ?? ''),
    description: row.description ?? row.description_az ?? null,
    icon: row.icon ?? null,
    color: row.color ?? null,
    emergency_level: row.emergency_level ?? 'medium',
  })) as FirstAidScenario[];
  const active = new Set(scenarios.map((s) => s.id));
  const stepsByScenario: Record<string, FirstAidStep[]> = {};
  for (const row of mapRowsTranslation(stepRows ?? [], language, ['title', 'instruction'])) {
    const scenarioId = String(row.scenario_id);
    if (!active.has(scenarioId)) continue;
    (stepsByScenario[scenarioId] ??= []).push({
      id: String(row.id),
      scenario_id: scenarioId,
      step_number: Number(row.step_number) || 0,
      title: String(row.title ?? row.title_az ?? ''),
      instruction: String(row.instruction ?? row.instruction_az ?? ''),
      duration_seconds: row.duration_seconds ?? null,
      is_critical: !!row.is_critical,
    });
  }
  for (const steps of Object.values(stepsByScenario)) steps.sort((a, b) => a.step_number - b.step_number);
  return { v: 1, language, savedAt: now, scenarios, stepsByScenario };
}

/**
 * Network first, cache second: fetches scenarios + all steps in parallel and
 * persists them. If the network fails, the last saved bundle (even in another
 * language: something beats nothing in an emergency) is returned instead.
 */
export async function fetchFirstAidBundle(language: string): Promise<FirstAidBundle> {
  try {
    const [scenarioRes, stepRes] = await Promise.all([
      supabase.from('first_aid_scenarios').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('first_aid_steps').select('*').order('scenario_id').order('step_number'),
    ]);
    if (scenarioRes.error) throw scenarioRes.error;
    if (stepRes.error) throw stepRes.error;
    const bundle = buildFirstAidBundle(scenarioRes.data, stepRes.data, language);
    // An empty response is not worth overwriting good offline content with.
    if (bundle.scenarios.length > 0 || !readFirstAidCache()) writeFirstAidCache(bundle);
    return bundle;
  } catch (error) {
    const cached = readFirstAidCache();
    if (cached && cached.scenarios.length > 0) return cached;
    throw error;
  }
}

function firstAidQueryOptions(language: string) {
  const cached = readFirstAidCache();
  const initial = cached && cached.language === language ? cached : undefined;
  return {
    queryKey: firstAidQueryKey(language),
    queryFn: () => fetchFirstAidBundle(language),
    initialData: initial,
    initialDataUpdatedAt: initial?.savedAt,
    staleTime: FRESH_MS,
    // Run the query function even offline so it can fall back to the cache
    // (or fail fast into the retry state) instead of pausing with no data.
    networkMode: 'always' as const,
    retry: (failureCount: number) =>
      failureCount < 2 && (typeof navigator === 'undefined' || navigator.onLine !== false),
    retryDelay: 800,
    // Has its own localStorage entry; do not duplicate it in the shared persist cache.
    meta: { persist: false },
  };
}

/** All scenarios + steps for the app language, cache first. */
export const useFirstAidContent = () => {
  const language = useUserStore((state) => state.language) || 'az';
  return useQuery(firstAidQueryOptions(language));
};

/**
 * Background warm-up so first aid is ready before the first emergency.
 * Skips the network when the saved bundle for this language is fresh.
 */
export function prefetchFirstAidContent(queryClient: QueryClient, language: string): Promise<void> {
  const cached = readFirstAidCache();
  if (cached && cached.language === language && Date.now() - cached.savedAt < FRESH_MS) {
    return Promise.resolve();
  }
  return queryClient.prefetchQuery(firstAidQueryOptions(language)).catch(() => undefined);
}

/** Mount anywhere (e.g. tools hub / app shell) to warm the offline first-aid cache once per language. */
export const usePrefetchFirstAid = () => {
  const queryClient = useQueryClient();
  const language = useUserStore((state) => state.language) || 'az';
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const id = setTimeout(() => { void prefetchFirstAidContent(queryClient, language); }, 1500);
    return () => clearTimeout(id);
  }, [queryClient, language]);
};
