import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ result: { data: [] as unknown[] | null, error: null as unknown }, userId: 'u1', fromCount: 0 }));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'maybeSingle', 'insert']) c[m] = () => c;
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(mocks.result).then(resolve, reject);
  return c;
}
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => { mocks.fromCount++; return chain(); } } }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));

import { useChildren } from './useChildren';

const child = (id: string, userId = 'u1') => ({
  id, user_id: userId, name: id, birth_date: '2026-01-01', gender: 'girl', avatar_emoji: 'x',
  is_active: true, sort_order: 0, notes: null, created_at: '2026-01-01T00:00:00Z',
});

// Each renderHook gets a wrapper. A fresh QueryClient per call models a separate app
// session (cold/offline relaunch); a shared one models repeat mounts within one session.
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const wrapperFor = (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const freshWrapper = () => wrapperFor(newClient());

beforeEach(() => { localStorage.clear(); mocks.userId = 'u1'; mocks.fromCount = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useChildren offline cache', () => {
  it('shows the last successful children list when a later load fails', async () => {
    mocks.result = { data: [child('a')], error: null };
    const first = renderHook(() => useChildren(), { wrapper: freshWrapper() });
    await waitFor(() => expect(first.result.current.children.map((c) => c.id)).toEqual(['a']));
    first.unmount();

    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const offline = renderHook(() => useChildren(), { wrapper: freshWrapper() });
    // Cached children are there immediately, before the failed request settles
    expect(offline.result.current.children.map((c) => c.id)).toEqual(['a']);
    await waitFor(() => expect(offline.result.current.loadError).toBe(true));
    expect(offline.result.current.children.map((c) => c.id)).toEqual(['a']);
    expect(offline.result.current.hasChildren).toBe(true);
  });

  it('reports a load error instead of an empty list as the final state when nothing is cached', async () => {
    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const { result } = renderHook(() => useChildren(), { wrapper: freshWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
    expect(result.current.children).toEqual([]);
  });

  it('never shows another user\'s cached children', async () => {
    mocks.result = { data: [child('a')], error: null };
    const first = renderHook(() => useChildren(), { wrapper: freshWrapper() });
    await waitFor(() => expect(first.result.current.children).toHaveLength(1));
    first.unmount();

    mocks.userId = 'u2';
    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const other = renderHook(() => useChildren(), { wrapper: freshWrapper() });
    expect(other.result.current.children).toEqual([]);
    await waitFor(() => expect(other.result.current.loadError).toBe(true));
    expect(other.result.current.children).toEqual([]);
  });
});

describe('useChildren react-query cache', () => {
  it('serves repeat mounts from cache without re-SELECTing within staleTime', async () => {
    mocks.result = { data: [child('a')], error: null };
    const client = newClient();
    const wrapper = wrapperFor(client);

    const first = renderHook(() => useChildren(), { wrapper });
    await waitFor(() => expect(first.result.current.children).toHaveLength(1));
    const fromCallsAfterFirst = mocks.fromCount;
    expect(fromCallsAfterFirst).toBeGreaterThan(0);

    // A second component mounting the same hook (same QueryClient) reuses the cached
    // user_children instead of firing another SELECT — the whole point of the migration.
    const second = renderHook(() => useChildren(), { wrapper });
    expect(second.result.current.children).toHaveLength(1);
    expect(second.result.current.loading).toBe(false);
    await waitFor(() => expect(second.result.current.children).toHaveLength(1));
    expect(mocks.fromCount).toBe(fromCallsAfterFirst);
  });

  it('refetches when the children-updated event fires', async () => {
    mocks.result = { data: [child('a')], error: null };
    const client = newClient();
    const wrapper = wrapperFor(client);
    const { result } = renderHook(() => useChildren(), { wrapper });
    await waitFor(() => expect(result.current.children).toHaveLength(1));
    const before = mocks.fromCount;

    mocks.result = { data: [child('a'), child('b')], error: null };
    window.dispatchEvent(new Event('anacan:children-updated'));
    await waitFor(() => expect(result.current.children.map((c) => c.id)).toEqual(['a', 'b']));
    expect(mocks.fromCount).toBeGreaterThan(before);
  });
});
