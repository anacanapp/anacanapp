import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBabyInsight, type BabyInsightStats } from './useBabyInsight';

const mocks = vi.hoisted(() => ({ actor: 'user-a', language: 'en', backend: 'https://api.anacan.az', invoke: vi.fn(), consume: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: mocks.backend }) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: mocks.actor } }) }));
vi.mock('./useSubscription', () => ({ useSubscription: () => ({ peekRemainingDaily: mocks.consume }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: mocks.language }) }));
const stats: BabyInsightStats = { sleepMinutes: 400, sleepCount: 3, feedingCount: 7, breastCount: 4, formulaCount: 2, formulaMl: 160, solidCount: 1, diaperCount: 6, wetCount: 4, dirtyCount: 1, mixedCount: 1 };
const child = { id: 'child-a', ageMonths: 7, ageDays: 220, gender: 'girl' };
const success = (section: string) => ({ data: { success: true, insight: { [section]: { status: 'normal', note: `${section} result` } } }, error: null });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.actor = 'user-a'; mocks.language = 'en'; mocks.backend = 'https://api.anacan.az'; mocks.consume.mockResolvedValue({ remaining: 2, limit: 2 }); mocks.invoke.mockImplementation((_name, { body }) => Promise.resolve(success(body.section))); });
afterEach(cleanup);
it('does not run automatically and sends only the section explicitly requested', async () => {
 const { result } = renderHook(() => useBabyInsight(stats, child)); expect(mocks.invoke).not.toHaveBeenCalled(); expect(mocks.consume).not.toHaveBeenCalled();
 act(() => result.current.sleep.request());
 await waitFor(() => expect(result.current.sleep.insight?.note).toBe('sleep result'));
 expect(mocks.invoke).toHaveBeenCalledOnce(); expect(mocks.invoke.mock.calls[0][1].body.stats).toEqual({ sleepMinutes: 400, sleepCount: 3, localHour: expect.any(Number) });
 expect(result.current.feeding.insight).toBeNull(); expect(result.current.diaper.insight).toBeNull();
 act(() => result.current.feeding.request()); await waitFor(() => expect(result.current.feeding.insight?.note).toBe('feeding result'));
 expect(mocks.invoke.mock.calls[1][1].body.stats).not.toHaveProperty('sleepMinutes'); expect(mocks.invoke.mock.calls[1][1].body.stats).not.toHaveProperty('diaperCount');
 expect(result.current.sleep.insight?.note).toBe('sleep result'); expect(mocks.consume).toHaveBeenCalledTimes(2);
});
it('deduplicates repeated taps but allows independent sections to load concurrently', async () => {
 const resolvers: Record<string, (value: any) => void> = {};
 mocks.invoke.mockImplementation((_name, { body }) => new Promise(resolve => { resolvers[body.section] = resolve; }));
 const { result } = renderHook(() => useBabyInsight(stats, child));
 act(() => { result.current.sleep.request(); result.current.sleep.request(); result.current.diaper.request(); });
 await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2)); expect(result.current.sleep.loading).toBe(true); expect(result.current.diaper.loading).toBe(true); expect(result.current.feeding.loading).toBe(false);
 await act(async () => resolvers.sleep(success('sleep'))); expect(result.current.sleep.loading).toBe(false); expect(result.current.diaper.loading).toBe(true);
 await act(async () => resolvers.diaper(success('diaper')));
});
it('changing feeding does not stale a sleep analysis, and a failed retry never fabricates a result', async () => {
 const { result, rerender } = renderHook(({ data }) => useBabyInsight(data, child), { initialProps: { data: stats } });
 act(() => result.current.sleep.request()); await waitFor(() => expect(result.current.sleep.insight).not.toBeNull());
 rerender({ data: { ...stats, feedingCount: 8 } }); expect(result.current.sleep.stale).toBe(false);
 rerender({ data: { ...stats, sleepMinutes: 450 } }); expect(result.current.sleep.stale).toBe(true);
 mocks.invoke.mockResolvedValue({ data: null, error: {} }); act(() => result.current.diaper.request()); await waitFor(() => expect(result.current.diaper.error).toBe(true));
 expect(result.current.diaper.insight).toBeNull(); expect(result.current.sleep.insight?.note).toBe('sleep result');
});
it.each(['child','actor','language','backend'])('drops delayed results across a %s boundary', async boundary => {
 let finish!: (value: any) => void; mocks.invoke.mockReturnValue(new Promise(resolve => { finish = resolve; }));
 const { result, rerender } = renderHook(({ current }) => useBabyInsight(stats, current), { initialProps: { current: child } });
 act(() => result.current.sleep.request()); await waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
 if (boundary === 'actor') mocks.actor = 'user-b'; if (boundary === 'language') mocks.language = 'ja'; if (boundary === 'backend') mocks.backend = 'https://source.example';
 rerender({ current: boundary === 'child' ? { ...child, id: 'child-b' } : child }); await act(async () => finish(success('sleep')));
 expect(result.current.sleep.insight).toBeNull(); expect(result.current.sleep.loading).toBe(false); expect(localStorage.length).toBe(0);
});
it('stops at the usage limit before invoking a model', async () => {
 mocks.consume.mockResolvedValue({ remaining: 0, limit: 2 }); const { result } = renderHook(() => useBabyInsight(stats, child));
 act(() => result.current.feeding.request()); await waitFor(() => expect(result.current.feeding.limitReached).toBe(true));
 expect(mocks.invoke).not.toHaveBeenCalled(); expect(result.current.feeding.insight).toBeNull(); expect(result.current.sleep.limitReached).toBe(false);
});
it('shows a server-side allowance rejection on only the requested section', async () => {
 mocks.invoke.mockResolvedValue({ data: null, error: { context: { status: 429 } } });
 const { result } = renderHook(() => useBabyInsight(stats, child)); act(() => result.current.diaper.request());
 await waitFor(() => expect(result.current.diaper.limitReached).toBe(true)); expect(result.current.diaper.error).toBe(false); expect(result.current.feeding.limitReached).toBe(false);
});
