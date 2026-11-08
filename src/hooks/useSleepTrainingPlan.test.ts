import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

import { planStorageKey, setWake } from '@/lib/sleep-training';
import { planStorageKeyV2, resetPlanTableState } from '@/lib/sleep-training-sync';
import { useSleepTrainingPlan } from './useSleepTrainingPlan';

const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.sleep_training_plans' in the schema cache" } };
const chain = () => {
  const q: Record<string, unknown> = {};
  for (const k of ['select', 'eq', 'is', 'lt', 'update']) q[k] = () => q;
  q.maybeSingle = async () => missing;
  return q;
};

beforeEach(() => { localStorage.clear(); resetPlanTableState(); mocks.from.mockReset(); mocks.from.mockImplementation(chain); });

it('keeps a plan per child on the phone and stays local-only while the table is absent', async () => {
  localStorage.setItem(planStorageKey('u1'), JSON.stringify({ wakeTime: '06:30' }));
  const { result, rerender } = renderHook(({ child }) => useSleepTrainingPlan('u1', child), { initialProps: { child: 'a' } });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.state.wakeTime).toBe('06:30');
  await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

  act(() => result.current.update((s) => setWake(s, '07:30')));
  expect(result.current.state.wakeTime).toBe('07:30');
  expect(result.current.pending).toBe(true);
  expect(JSON.parse(localStorage.getItem(planStorageKeyV2('u1', 'a')) as string).plan.wakeTime).toBe('07:30');

  rerender({ child: 'b' });
  await waitFor(() => expect(result.current.state.wakeTime).toBe('07:00'));
  // After the table turned out to be missing, no further requests go out.
  expect(mocks.from).toHaveBeenCalledTimes(1);
});

it('does not sync for a guest', async () => {
  const { result } = renderHook(() => useSleepTrainingPlan(null, 'a'));
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => result.current.update((s) => setWake(s, '08:00')));
  expect(localStorage.getItem(planStorageKeyV2('guest', 'a'))).toContain('08:00');
  expect(mocks.from).not.toHaveBeenCalled();
});
