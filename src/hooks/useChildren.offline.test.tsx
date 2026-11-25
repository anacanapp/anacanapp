import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ result: { data: [] as unknown[] | null, error: null as unknown }, userId: 'u1' }));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'maybeSingle', 'insert']) c[m] = () => c;
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(mocks.result).then(resolve, reject);
  return c;
}
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => chain() } }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));

import { useChildren } from './useChildren';

const child = (id: string, userId = 'u1') => ({
  id, user_id: userId, name: id, birth_date: '2026-01-01', gender: 'girl', avatar_emoji: 'x',
  is_active: true, sort_order: 0, notes: null, created_at: '2026-01-01T00:00:00Z',
});

beforeEach(() => { localStorage.clear(); mocks.userId = 'u1'; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useChildren offline cache', () => {
  it('shows the last successful children list when a later load fails', async () => {
    mocks.result = { data: [child('a')], error: null };
    const first = renderHook(() => useChildren());
    await waitFor(() => expect(first.result.current.children.map((c) => c.id)).toEqual(['a']));
    first.unmount();

    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const offline = renderHook(() => useChildren());
    // Cached children are there immediately, before the failed request settles
    expect(offline.result.current.children.map((c) => c.id)).toEqual(['a']);
    await waitFor(() => expect(offline.result.current.loadError).toBe(true));
    expect(offline.result.current.children.map((c) => c.id)).toEqual(['a']);
    expect(offline.result.current.hasChildren).toBe(true);
  });

  it('reports a load error instead of an empty list as the final state when nothing is cached', async () => {
    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const { result } = renderHook(() => useChildren());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
    expect(result.current.children).toEqual([]);
  });

  it('never shows another user\'s cached children', async () => {
    mocks.result = { data: [child('a')], error: null };
    const first = renderHook(() => useChildren());
    await waitFor(() => expect(first.result.current.children).toHaveLength(1));
    first.unmount();

    mocks.userId = 'u2';
    mocks.result = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const other = renderHook(() => useChildren());
    expect(other.result.current.children).toEqual([]);
    await waitFor(() => expect(other.result.current.loadError).toBe(true));
    expect(other.result.current.children).toEqual([]);
  });
});
