import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useGameLeaderboard } from './useGameScores';

const fixture = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false, realm: 'source',
  rows: [{ user_id: 'player', best_score: 42, best_level: 2 }], cards: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixture.user, loading: fixture.loading }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: fixture.realm }) }));
vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCards: fixture.cards }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback, getPersistedLanguage: () => 'az' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: fixture.rows, error: null }) }) }) }) }) } }));
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  fixture.user = null; fixture.loading = false; fixture.realm = 'source'; fixture.cards.mockReset();
});
describe('authenticated, realm-bound game leaderboard', () => {
  it('waits for authentication instead of caching anonymous generic names', async () => {
    fixture.loading = true;
    const view = renderHook(() => useGameLeaderboard('color-sort'), { wrapper });
    expect(view.result.current.fetchStatus).toBe('idle'); expect(fixture.cards).not.toHaveBeenCalled();
    fixture.loading = false; fixture.user = { id: 'account-a' };
    fixture.cards.mockResolvedValue({ player: { name: 'Aysel', avatar_url: null } });
    view.rerender();
    await waitFor(() => expect(view.result.current.data?.[0].name).toBe('Aysel'));
  });
  it('refetches when an account or backend changes', async () => {
    fixture.user = { id: 'account-a' }; fixture.cards.mockResolvedValue({ player: { name: 'Aysel', avatar_url: null } });
    const view = renderHook(() => useGameLeaderboard('color-sort'), { wrapper });
    await waitFor(() => expect(view.result.current.data?.[0].name).toBe('Aysel'));
    fixture.user = { id: 'account-b' }; fixture.cards.mockResolvedValue({ player: { name: 'Leyla', avatar_url: null } }); view.rerender();
    await waitFor(() => expect(view.result.current.data?.[0].name).toBe('Leyla'));
    fixture.realm = 'azure'; fixture.cards.mockResolvedValue({ player: { name: 'Nigar', avatar_url: null } }); view.rerender();
    await waitFor(() => expect(view.result.current.data?.[0].name).toBe('Nigar'));
    expect(fixture.cards).toHaveBeenCalledTimes(3);
    await act(async () => client.clear());
  });
  it('surfaces a failed profile query instead of substituting everyone with a fallback name', async () => {
    fixture.user = { id: 'account-a' }; fixture.cards.mockRejectedValue(new Error('read failed'));
    const view = renderHook(() => useGameLeaderboard('color-sort'), { wrapper });
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toBeUndefined();
  });
});
