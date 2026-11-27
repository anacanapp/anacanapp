import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn((_name: string, _args: unknown) => ({ abortSignal: () => Promise.resolve({ data: [], error: null }) })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => { const c: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'order', 'in']) c[m] = () => c; c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r); return c; },
  },
}));
vi.mock('@/store/userStore', () => ({ useUserStore: (sel: (s: unknown) => unknown) => sel({ language: 'az', countryCode: 'AZ' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { life_stage: 'bump', country_code: 'AZ' } }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'http://backend' }) }));
vi.mock('@/lib/tr', () => ({ mapRowsTranslation: (rows: unknown[]) => rows }));

import { useBanners } from './useBanners';

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const wrapperFor = (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => { mocks.rpc.mockClear(); });
afterEach(() => { cleanup(); });

describe('useBanners inventory caching', () => {
  it('fetches inventory once per placement and serves repeat mounts from cache', async () => {
    const wrapper = wrapperFor(newClient());

    const first = renderHook(() => useBanners('home_top'), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe('get_banner_inventory_v3');

    // A second BannerSlot for the same placement (same QueryClient) must not re-fire the
    // RPC within staleTime — previously every placement/screen mount triggered its own call.
    const second = renderHook(() => useBanners('home_top'), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(second.result.current.isStale).toBe(false);
  });

  it('keys the cache per placement', async () => {
    const wrapper = wrapperFor(newClient());

    const top = renderHook(() => useBanners('home_top'), { wrapper });
    await waitFor(() => expect(top.result.current.isSuccess).toBe(true));
    const bottom = renderHook(() => useBanners('home_bottom'), { wrapper });
    await waitFor(() => expect(bottom.result.current.isSuccess).toBe(true));

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.map((c) => c[1])).toEqual([
      { p_actor: 'u1', p_placement: 'home_top', p_language: 'az' },
      { p_actor: 'u1', p_placement: 'home_bottom', p_language: 'az' },
    ]);
  });
});
