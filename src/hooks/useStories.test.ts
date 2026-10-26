import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStories, useToggleStoryLike, type Story } from './useStories';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getUser: vi.fn(), profiles: vi.fn(),
  auth: { user: { id: 'viewer-a' } as { id: string } | null, loading: false }
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCards: mocks.profiles }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

function query(data: unknown) {
  const execute = vi.fn().mockResolvedValue({ data, error: null });
  return {
    execute,
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
}

const story: Story = {
  id: 's1', user_id: 'a', group_id: 'g1', media_url: '/story.png', media_type: 'image',
  text_overlay: null, background_color: null, created_at: '2026-09-10T00:00:00Z',
  expires_at: '2026-09-11T00:00:00Z', likes_count: 7, replies_count: 2, view_count: 12
};
const rows = [
  { ...story, id: 'b-new', user_id: 'b', created_at: '2026-09-10T12:00:00Z' },
  { ...story, id: 'c-viewed', user_id: 'c', created_at: '2026-09-10T11:00:00Z', likes_count: null, replies_count: null },
  { ...story, id: 'a-new', created_at: '2026-09-10T10:00:00Z' },
  { ...story, id: 'own', user_id: 'viewer-a', created_at: '2026-09-10T09:00:00Z' },
  { ...story, id: 'a-old', created_at: '2026-09-10T08:00:00Z' }
];
const profiles = {
  a: { user_id: 'a', name: 'Ayla', avatar_url: '/a.png' },
  b: { user_id: 'b', name: 'Maya', avatar_url: null },
  'viewer-a': { user_id: 'viewer-a', name: 'Me', avatar_url: null }
};
let client: QueryClient;
let storiesQuery: ReturnType<typeof query>;
let likesQuery: ReturnType<typeof query>;
let viewsQuery: ReturnType<typeof query>;
const key = (userId: string | null, groupId: string | null = 'g1') => ['stories', userId, groupId];
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'viewer-a' };
  mocks.auth.loading = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  storiesQuery = query(rows);
  likesQuery = query([{ story_id: 'b-new' }, { story_id: 'a-old' }]);
  viewsQuery = query([{ story_id: 'c-viewed' }, { story_id: 'a-old' }, { story_id: 'own' }]);
  mocks.from.mockImplementation((table) => {
    if (table === 'community_stories') return storiesQuery;
    if (table === 'story_likes') return likesQuery;
    if (table === 'story_views') return viewsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.profiles.mockResolvedValue(profiles);
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.auth.user }, error: null }));
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });

describe('story enrichment', () => {
  it('executes three independent batches, not per-story view queries, and preserves flags and ordering', async () => {
    let resolveAuthors!: (value: object) => void;
    let resolveLikes!: (value: object) => void;
    mocks.profiles.mockReturnValue(new Promise((resolve) => { resolveAuthors = resolve; }));
    likesQuery.execute.mockReturnValue(new Promise((resolve) => { resolveLikes = resolve; }));
    const { result } = renderHook(() => useStories('g1'), { wrapper });

    await waitFor(() => expect(viewsQuery.execute).toHaveBeenCalledOnce());
    expect(mocks.profiles).toHaveBeenCalledExactlyOnceWith(rows.map((s) => s.user_id));
    expect(likesQuery.execute).toHaveBeenCalledOnce();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      resolveAuthors(profiles);
      resolveLikes({ data: [{ story_id: 'b-new' }, { story_id: 'a-old' }], error: null });
    });
    await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));

    [likesQuery, viewsQuery].forEach((batch) => {
      expect(batch.select).toHaveBeenCalledExactlyOnceWith('story_id');
      expect(batch.eq).toHaveBeenCalledExactlyOnceWith('user_id', 'viewer-a');
      expect(batch.in).toHaveBeenCalledExactlyOnceWith('story_id', rows.map((s) => s.id));
      expect(batch.single).not.toHaveBeenCalled();
      expect(batch.execute).toHaveBeenCalledOnce();
    });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['community_stories', 'story_likes', 'story_views']);
    expect(storiesQuery.order).toHaveBeenCalledExactlyOnceWith('created_at', { ascending: false });
    expect(storiesQuery.eq).toHaveBeenCalledExactlyOnceWith('group_id', 'g1');
    expect(storiesQuery.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(result.current.stories.map((s) => [s.id, s.is_liked, s.is_viewed])).toEqual([
      ['b-new', true, false], ['c-viewed', false, true], ['a-new', false, false],
      ['own', false, true], ['a-old', true, true]
    ]);
    expect(result.current.stories[2]).toMatchObject({
      likes_count: 7, replies_count: 2, view_count: 12, author: { name: 'Ayla', avatar_url: '/a.png' }
    });
    expect(result.current.stories[1]).toMatchObject({
      likes_count: 0, replies_count: 0, view_count: 12, author: { name: '\u0130stifad\u0259\u00e7i', avatar_url: null }
    });
    expect(result.current.storyGroups.map((g) => [g.user_id, g.has_unviewed])).toEqual([
      ['viewer-a', false], ['b', true], ['a', true], ['c', false]
    ]);
    expect(result.current.storyGroups.find((g) => g.user_id === 'a').stories.map((s) => s.id)).toEqual(['a-old', 'a-new']);
  });

  it('makes no enrichment requests when there are no stories', async () => {
    storiesQuery.execute.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useStories('g1'), { wrapper });
    await waitFor(() => expect(client.getQueryState(key('viewer-a')).status).toBe('success'));
    expect(result.current.stories).toEqual([]);
    expect(result.current.storyGroups).toEqual([]);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('community_stories');
    expect(mocks.profiles).not.toHaveBeenCalled();
  });

  it.each([true, false])('uses false flags only for empty results or signed-out reads (authenticated=%s)', async (authenticated) => {
    if (!authenticated) mocks.auth.user = null;
    likesQuery.execute.mockResolvedValue({ data: [], error: null });
    viewsQuery.execute.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useStories('g1'), { wrapper });
    await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));
    expect(result.current.stories.every((s) => s.is_liked === false && s.is_viewed === false)).toBe(true);
    expect(result.current.storyGroups.every((g) => g.has_unviewed)).toBe(true);
    expect(likesQuery.execute).toHaveBeenCalledTimes(authenticated ? 1 : 0);
    expect(viewsQuery.execute).toHaveBeenCalledTimes(authenticated ? 1 : 0);
    expect(mocks.profiles).toHaveBeenCalledOnce();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each(['stories', 'authors', 'likes', 'views'] as const)('does not cache false flags after a failed %s query', async (batch) => {
    const error = { code: '42501', message: 'denied' };
    if (batch === 'authors') mocks.profiles.mockRejectedValue(error);
    else ({ stories: storiesQuery, likes: likesQuery, views: viewsQuery })[batch].execute.mockResolvedValue({ data: null, error });
    renderHook(() => useStories('g1'), { wrapper });
    await waitFor(() => expect(client.getQueryState(key('viewer-a')).status).toBe('error'));
    expect(client.getQueryState(key('viewer-a')).error).toBe(error);
    expect(client.getQueryData(key('viewer-a'))).toBeUndefined();
    if (batch === 'stories') {
      expect(mocks.profiles).not.toHaveBeenCalled();
      expect(mocks.from).toHaveBeenCalledExactlyOnceWith('community_stories');
    }
  });

  it.each(['likes', 'views'] as const)('preserves known flags when a %s refetch fails', async (batch) => {
    const { result } = renderHook(() => useStories('g1'), { wrapper });
    await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));
    const previous = result.current.stories;
    const error = { code: '42501', message: 'denied' };
    (batch === 'likes' ? likesQuery : viewsQuery).execute.mockResolvedValue({ data: null, error });

    await act(async () => { await client.invalidateQueries({ queryKey: ['stories'] }); });
    expect(client.getQueryState(key('viewer-a')).status).toBe('error');
    expect(client.getQueryData(key('viewer-a'))).toEqual(previous);
    expect(result.current.stories).toEqual(previous);
  });
});

it('waits for auth bootstrap and isolates account/signed-out caches while preserving root invalidation', async () => {
  mocks.auth.loading = true;
  const { result, rerender } = renderHook(() => useStories('g1'), { wrapper });
  expect(mocks.from).not.toHaveBeenCalled();
  mocks.auth.loading = false;
  rerender();
  await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));
  const firstAccount = result.current.stories;

  mocks.auth.user = { id: 'viewer-b' };
  likesQuery.execute.mockResolvedValue({ data: [], error: null });
  viewsQuery.execute.mockResolvedValue({ data: [], error: null });
  rerender();
  expect(result.current.stories).toEqual([]);
  await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));
  expect(result.current.stories.every((s) => !s.is_liked && !s.is_viewed)).toBe(true);
  expect(client.getQueryData(key('viewer-a'))).toEqual(firstAccount);

  mocks.auth.user = null;
  rerender();
  expect(result.current.stories).toEqual([]);
  await waitFor(() => expect(result.current.stories).toHaveLength(rows.length));
  expect(likesQuery.execute).toHaveBeenCalledTimes(2);
  expect(viewsQuery.execute).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(key(null))).toEqual(result.current.stories);
  await act(async () => { await client.invalidateQueries({ queryKey: ['stories'] }); });
  expect(client.getQueryState(key('viewer-a')).isInvalidated).toBe(true);
  expect(client.getQueryState(key('viewer-b')).isInvalidated).toBe(true);
  expect(storiesQuery.execute).toHaveBeenCalledTimes(4);
});

it.each([
  { outcome: 'successful', error: null, viewed: true },
  { outcome: 'failed', error: { code: '42501' }, viewed: false }
])('marks only this viewer cache on a $outcome view write, without refetching', async ({ error, viewed }) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const ownKeys = [key('viewer-a'), key('viewer-a', null)];
  const otherKeys = [key('viewer-b'), key(null)];
  const cached = [{ ...story, is_viewed: false }];
  [...ownKeys, ...otherKeys].forEach((queryKey) => client.setQueryData(queryKey, cached));
  viewsQuery.execute.mockResolvedValue({ data: null, error });
  const { result } = renderHook(() => useStories('g1'), { wrapper });
  await act(async () => { await result.current.markAsViewed('s1'); });

  ownKeys.forEach((queryKey) => expect(client.getQueryData<Story[]>(queryKey)[0].is_viewed).toBe(viewed));
  otherKeys.forEach((queryKey) => expect(client.getQueryData(queryKey)).toEqual(cached));
  expect(viewsQuery.upsert).toHaveBeenCalledExactlyOnceWith(
    { story_id: 's1', user_id: 'viewer-a' }, { onConflict: 'story_id,user_id' }
  );
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith('story_views');
  expect(mocks.profiles).not.toHaveBeenCalled();
});

it('scopes optimistic story likes and their rollback to the original viewer across groups', async () => {
  const ownKeys = [key('viewer-a'), key('viewer-a', null)];
  const otherKeys = [key('viewer-b'), key(null)];
  const cached = [{ ...story, is_liked: true }];
  [...ownKeys, ...otherKeys].forEach((queryKey) => client.setQueryData(queryKey, cached));
  let finish!: (value: object) => void;
  likesQuery.execute.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(useToggleStoryLike, { wrapper });
  act(() => result.current.mutate({ storyId: 's1', isLiked: true }));
  await waitFor(() => expect(likesQuery.execute).toHaveBeenCalledOnce());
  ownKeys.forEach((queryKey) => expect(client.getQueryData<Story[]>(queryKey)[0]).toMatchObject({ is_liked: false, likes_count: 6 }));
  otherKeys.forEach((queryKey) => expect(client.getQueryData(queryKey)).toEqual(cached));

  mocks.auth.user = { id: 'viewer-b' };
  rerender();
  await act(async () => finish({ data: null, error: { code: '42501' } }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  [...ownKeys, ...otherKeys].forEach((queryKey) => expect(client.getQueryData(queryKey)).toEqual(cached));
  expect(mocks.getUser).toHaveBeenCalledOnce();
  expect(likesQuery.eq).toHaveBeenCalledWith('user_id', 'viewer-a');
});
