import { describe, it, expect, vi, beforeEach } from 'vitest';

const results: { scenarios: any; steps: any } = { scenarios: null, steps: null };

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string) => {
    const result = () => (table === 'first_aid_scenarios' ? results.scenarios : results.steps);
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve: any, reject: any) => {
        const r = result();
        return (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)).then(resolve, reject);
      },
    };
    return chain;
  };
  return { supabase: { from: vi.fn((t: string) => builder(t)) } };
});

import { buildFirstAidBundle, fetchFirstAidBundle, readFirstAidCache, FIRST_AID_CACHE_KEY } from './useFirstAid';

const scenarioRows = [
  { id: 's1', title: 'Choking', title_az: 'Boğulma', title_en: 'Choking', description: null, description_az: 'Desc', icon: '🫁', color: 'red', emergency_level: 'critical' },
  { id: 's2', title: 'Burns', title_az: 'Yanıq', title_en: 'Burns', description: null, description_az: null, icon: '🔥', color: 'orange', emergency_level: 'high' },
];
const stepRows = [
  { id: 'a2', scenario_id: 's1', step_number: 2, title: 'T2', title_az: 'A2', instruction: 'I2', instruction_az: 'B2', duration_seconds: 10, is_critical: false },
  { id: 'a1', scenario_id: 's1', step_number: 1, title: 'T1', title_az: 'A1', instruction: 'I1', instruction_az: 'B1', duration_seconds: null, is_critical: true },
  { id: 'b1', scenario_id: 's2', step_number: 1, title: 'U1', title_az: 'C1', instruction: 'J1', instruction_az: 'D1', duration_seconds: null, is_critical: false },
  { id: 'x1', scenario_id: 'inactive', step_number: 1, title: 'X', title_az: 'X', instruction: 'X', instruction_az: 'X', is_critical: false },
];

beforeEach(() => {
  localStorage.clear();
  results.scenarios = { data: scenarioRows, error: null };
  results.steps = { data: stepRows, error: null };
});

describe('buildFirstAidBundle', () => {
  it('groups steps of active scenarios, sorted, with localized text', () => {
    const b = buildFirstAidBundle(scenarioRows, stepRows, 'az', 1);
    expect(b.scenarios.map((s) => s.title)).toEqual(['Boğulma', 'Yanıq']);
    expect(b.stepsByScenario.s1.map((s) => s.instruction)).toEqual(['B1', 'B2']);
    expect(b.stepsByScenario.s2).toHaveLength(1);
    expect(b.stepsByScenario.inactive).toBeUndefined();
  });

  it('uses the app language for display text', () => {
    const b = buildFirstAidBundle(scenarioRows, stepRows, 'en', 1);
    expect(b.scenarios[0].title).toBe('Choking');
  });
});

describe('fetchFirstAidBundle', () => {
  it('persists all scenarios with all steps so unopened scenarios work offline', async () => {
    await fetchFirstAidBundle('az');
    const cached = readFirstAidCache();
    expect(cached?.language).toBe('az');
    expect(Object.keys(cached!.stepsByScenario).sort()).toEqual(['s1', 's2']);
  });

  it('falls back to the saved bundle when the network fails', async () => {
    await fetchFirstAidBundle('az');
    results.scenarios = new Error('offline');
    const b = await fetchFirstAidBundle('az');
    expect(b.stepsByScenario.s2[0].instruction).toBe('D1');
  });

  it('throws when offline with nothing saved (UI shows the retry state)', async () => {
    results.steps = { data: null, error: { message: 'offline' } };
    await expect(fetchFirstAidBundle('az')).rejects.toEqual({ message: 'offline' });
    expect(localStorage.getItem(FIRST_AID_CACHE_KEY)).toBeNull();
  });

  it('does not overwrite good content with an empty response', async () => {
    await fetchFirstAidBundle('az');
    results.scenarios = { data: [], error: null };
    await fetchFirstAidBundle('az');
    expect(readFirstAidCache()?.scenarios).toHaveLength(2);
  });
});
