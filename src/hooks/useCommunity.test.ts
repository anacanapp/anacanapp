import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupPosts, useSinglePost, useToggleLike, type CommunityPost } from './useCommunity';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getUser: vi.fn(), profiles: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(),
  auth: { user: { id: 'viewer-a' } as { id: string } | null, profile: { country_code: 'AZ' }, loading: false }
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser }, channel: mocks.channel, removeChannel: mocks.removeChannel }
}));
vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCards: mocks.profiles }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/store/userStore', () => ({
  useUserStore: Object.assign((selector: (state: object) => unknown) => selector({ language: 'az' }), {
    getState: () => ({ countryCode: 'AZ' })
  })
}));

function query(data: unknown) {
  const execute = vi.fn().mockResolvedValue({ data, error: null });
  return {
    execute,
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(), maybeSingle: vi.fn(() => execute()),
    then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
}

const post: CommunityPost = {
  id: 'p1', user_id: 'author-a', group_id: 'g1', content: 'Post', media_urls: null,
  likes_count: 7, comments_count: 2, is_pinned: false, is_anonymous: false,
  created_at: '2026-09-10T00:00:00Z', language: 'az'
};
const author = {
  user_id: 'author-a', name: 'Ayla', avatar_url: '/avatar.png', badge_type: 'admin',
  is_verified: true, verified_until: '2027-09-10T00:00:00Z', life_stage: 'mommy'
};
let client: QueryClient;
let postsQuery: ReturnType<typeof query>;
let likesQuery: ReturnType<typeof query>;
let bookmarksQuery: ReturnType<typeof query>;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'viewer-a' };
  mocks.auth.loading = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  postsQuery = query([post]);
  likesQuery = query([{ post_id: 'p1' }]);
  bookmarksQuery = query([]);
  mocks.from.mockImplementation((table) => {
    if (table === 'community_posts') return postsQuery;
    if (table === 'post_likes') return likesQuery;
    if (table === 'community_post_bookmarks') return bookmarksQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.profiles.mockResolvedValue({ 'author-a': author });
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.auth.user }, error: null }));
  mocks.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });

describe('post enrichment', () => {
  it('executes author and like batches concurrently, preserving anonymity, fields and order', async () => {
    postsQuery.execute.mockResolvedValue({ data: [post, { ...post, id: 'p2', is_anonymous: true }], error: null });
    let resolveAuthors!: (value: object) => void;
    mocks.profiles.mockReturnValue(new Promise((resolve) => { resolveAuthors = resolve; }));
    const { result } = renderHook(() => useGroupPosts('g1'), { wrapper });

    await waitFor(() => expect(likesQuery.execute).toHaveBeenCalledOnce());
    expect(mocks.profiles).toHaveBeenCalledExactlyOnceWith(['author-a', 'author-a']);
    expect(result.current.isPending).toBe(true);
    await act(async () => resolveAuthors({ 'author-a': author }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      {
        ...post, is_liked: true, is_saved: false,
        author: {
          name: 'Ayla', avatar_url: '/avatar.png', badge_type: 'admin',
          is_premium: false, can_share_links: true,
          is_verified: true, verified_until: author.verified_until, life_stage: 'mommy'
        }
      },
      {
        ...post, id: 'p2', is_anonymous: true, is_liked: false, is_saved: false,
        author: { name: 'Anonim', avatar_url: null, badge_type: null, is_verified: false, verified_until: null }
      }
    ]);
    expect(likesQuery.in).toHaveBeenCalledExactlyOnceWith('post_id', ['p1', 'p2']);
    expect(likesQuery.eq).toHaveBeenCalledExactlyOnceWith('user_id', 'viewer-a');
    expect(postsQuery.limit).toHaveBeenCalledExactlyOnceWith(150);
    expect(postsQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(postsQuery.eq).toHaveBeenCalledWith('group_id', 'g1');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('keeps signed-out reads available without fetching likes', async () => {
    mocks.auth.user = null;
    const { result } = renderHook(() => useGroupPosts(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0]).toMatchObject({ is_liked: false, author: { name: 'Ayla' } });
    expect(postsQuery.is).toHaveBeenCalledWith('group_id', null);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('community_posts');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each(['group', 'single'] as const)('does not enrich an empty %s response', async (kind) => {
    postsQuery.execute.mockResolvedValue({ data: kind === 'group' ? [] : null, error: null });
    const { result } = renderHook(() => kind === 'group' ? useGroupPosts('g1') : useSinglePost('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(kind === 'group' ? [] : null);
    expect(mocks.profiles).not.toHaveBeenCalled();
    expect(likesQuery.execute).not.toHaveBeenCalled();
  });

  it.each(['authors', 'likes', 'bookmarks'] as const)('does not cache fallback fields after a failed %s batch', async (batch) => {
    const error = { code: '42501', message: 'denied' };
    if (batch === 'authors') mocks.profiles.mockRejectedValue(error);
    else (batch === 'likes' ? likesQuery : bookmarksQuery).execute.mockResolvedValue({ data: null, error });
    const { result } = renderHook(() => useGroupPosts('g1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(client.getQueryData(['group-posts', 'g1', 'viewer-a'])).toBeUndefined();
  });
});

describe.each(['group', 'single'] as const)('%s post cache identity', (kind) => {
  const key = (userId: string | null) => kind === 'group'
    ? ['group-posts', 'g1', userId, 'az'] : ['single-post', 'p1', userId];
  const usePosts = () => kind === 'group' ? useGroupPosts('g1') : useSinglePost('p1');
  const first = (data: CommunityPost | CommunityPost[]) => Array.isArray(data) ? data[0] : data;

  it('waits for auth bootstrap, but does not make a redundant auth request', async () => {
    if (kind === 'single') postsQuery.execute.mockResolvedValue({ data: post, error: null });
    mocks.auth.loading = true;
    const { result, rerender } = renderHook(usePosts, { wrapper });
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.auth.loading = false;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getUser).not.toHaveBeenCalled();
    if (kind === 'single') expect(postsQuery.eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('never reuses another account or signed-out like flags', async () => {
    if (kind === 'single') postsQuery.execute.mockResolvedValue({ data: post, error: null });
    const { result, rerender } = renderHook(usePosts, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(first(result.current.data).is_liked).toBe(true);

    mocks.auth.user = { id: 'viewer-b' };
    likesQuery.execute.mockResolvedValue({ data: [], error: null });
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(first(result.current.data).is_liked).toBe(false);
    expect(first(client.getQueryData(key('viewer-a'))).is_liked).toBe(true);

    mocks.auth.user = null;
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(first(client.getQueryData(key(null))).is_liked).toBe(false);
    expect(likesQuery.execute).toHaveBeenCalledTimes(2);
    expect(mocks.getUser).not.toHaveBeenCalled();
    if (kind === 'group') expect(mocks.channel).toHaveBeenCalledOnce();
  });
});

it('scopes optimistic group likes and rollback while keeping existing profile-cache updates', async () => {
  const ownKeys = [['group-posts', 'g1', 'viewer-a'], ['group-posts', null, 'viewer-a'], ['user-posts', 'author-a', false]];
  const otherKey = ['group-posts', 'g1', 'viewer-b'];
  const cached = [{ ...post, is_liked: true }];
  [...ownKeys, otherKey].forEach((key) => client.setQueryData(key, cached));
  let finish!: (value: object) => void;
  likesQuery.execute.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(useToggleLike, { wrapper });
  act(() => result.current.mutate({ postId: 'p1', isLiked: true, groupId: 'g1' }));
  await waitFor(() => expect(likesQuery.execute).toHaveBeenCalledOnce());
  ownKeys.forEach((key) => expect(client.getQueryData<CommunityPost[]>(key)[0]).toMatchObject({ is_liked: false, likes_count: 6 }));
  expect(client.getQueryData(otherKey)).toEqual(cached);

  mocks.auth.user = { id: 'viewer-b' };
  rerender();
  await act(async () => finish({ data: null, error: { code: '42501' } }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  [...ownKeys, otherKey].forEach((key) => expect(client.getQueryData(key)).toEqual(cached));
  expect(mocks.getUser).toHaveBeenCalledOnce();
  await client.invalidateQueries({ queryKey: ['group-posts', 'g1'] });
  expect(client.getQueryState(ownKeys[0]).isInvalidated).toBe(true);
  expect(client.getQueryState(otherKey).isInvalidated).toBe(true);
});
