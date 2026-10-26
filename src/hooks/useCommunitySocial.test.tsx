import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityBookmark, useCommunityConnections, useCommunityFeed, useCommunityFollow } from './useCommunitySocial';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), enrich: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), toast: vi.fn(),
  auth: { user: { id: 'viewer-a' } as { id: string } | null, profile: { country_code: 'AZ' }, loading: false },
  language: 'az',
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, channel: mocks.channel, removeChannel: mocks.removeChannel } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useCommunity', () => ({ enrichPosts: mocks.enrich }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: mocks.language, countryCode: 'AZ' }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

function response(value: any) {
  return { abortSignal: vi.fn().mockReturnThis(), then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) };
}
const post = { id: 'post', user_id: 'author', content: 'Older saved post', language: 'az', is_saved: false, is_liked: false, likes_count: 2 };
const stats = { user_id: 'author', posts_count: 1, likes_count: 2, followers_count: 10, following_count: 5, is_following: false };
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const feedKey = (userId: string) => ['community-feed', userId, 'saved'];
const cachedFeed = () => ({ pages: [{ posts: [{ ...post }], nextOffset: undefined }], pageParams: [0] });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'viewer-a' };
  mocks.auth.loading = false;
  mocks.language = 'az';
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.enrich.mockImplementation(async (posts) => posts);
  mocks.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
  mocks.rpc.mockReturnValue(response({ data: [], error: null }));
});
afterEach(() => { cleanup(); client.clear(); });

describe('community feed and private interaction state', () => {
  it('resolves Premium in followers independently of a stale stored badge label', async () => {
    mocks.rpc.mockImplementation(name => response({ data: name === 'get_public_community_profiles_v2'
      ? [{ user_id:'author', name:'Author', is_premium:true, badge_type:'premium' }]
      : [{ user_id:'author', name:'Author', is_following:true, followed_at:'2026-09-21', is_premium:false, badge_type:null }], error:null }));
    const { result } = renderHook(() => useCommunityConnections('someone','followers'), { wrapper });
    await waitFor(() => expect(result.current.connections[0]).toMatchObject({ user_id:'author', is_premium:true, badge_type:'premium', is_following:true }));
    expect(mocks.rpc).toHaveBeenCalledWith('get_public_community_profiles_v2',{p_user_ids:['author']});
  });
  it('loads older personal results by server-side view and pagination, not by filtering the recent feed', async () => {
    const all = Array.from({ length: 34 }, (_, n) => ({ ...post, id: `old-${n}` }));
    mocks.rpc.mockImplementation((_name, args) => response({ data: all.slice(args.p_offset, args.p_offset + args.p_limit), error: null }));
    const { result } = renderHook(() => useCommunityFeed('mine'), { wrapper });
    await waitFor(() => expect(result.current.posts).toHaveLength(20));
    expect(mocks.rpc).toHaveBeenCalledWith('get_community_feed_v2', expect.objectContaining({ p_view: 'mine', p_offset: 0, p_language: 'az' }));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.posts).toHaveLength(34));
    expect(result.current.posts[33].id).toBe('old-33');
    expect(result.current.hasNextPage).toBe(false);
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_community_feed_v2', expect.objectContaining({ p_view: 'mine', p_offset: 20, p_language: 'az' }));
  });

  it('does not show another account saved feed on account changes or sign-out', async () => {
    mocks.rpc.mockImplementation(() => response({ data: mocks.auth.user?.id === 'viewer-a' ? [post] : [], error: null }));
    const { result, rerender } = renderHook(() => useCommunityFeed('saved'), { wrapper });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    mocks.auth.user = { id: 'viewer-b' };
    rerender();
    expect(result.current.posts).toEqual([]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.posts).toEqual([]);
    mocks.auth.user = null;
    rerender();
    expect(result.current.posts).toEqual([]);
  });
  it.each(['recent','popular','mine','saved','following','profile'] as const)('binds %s pagination to the selected language, independently of account country', async view => {
    mocks.language = 'ru';
    mocks.rpc.mockImplementation((_name, args) => response({ data: [{ ...post, id: args.p_language, language: args.p_language }], error: null }));
    const { result, rerender } = renderHook(() => useCommunityFeed(view, null, 'author'), { wrapper });
    await waitFor(() => expect(result.current.posts[0]?.language).toBe('ru'));
    expect(mocks.rpc).toHaveBeenCalledWith('get_community_feed_v2', expect.objectContaining({ p_view: view, p_language: 'ru', p_limit: 21, p_offset: 0 }));
    mocks.language = 'ja'; rerender();
    expect(result.current.posts).toEqual([]);
    await waitFor(() => expect(result.current.posts[0]?.language).toBe('ja'));
  });
  it('counts foreign inserts and patches counters in place instead of refetching the feed', async () => {
    let handler!: (event: any) => void;
    mocks.channel.mockReturnValue({ on: vi.fn((_kind, _filter, callback) => { handler = callback; return { subscribe: vi.fn() }; }) });
    mocks.rpc.mockImplementation(() => response({ data: [{ ...post }], error: null }));
    const { result } = renderHook(() => useCommunityFeed('recent'), { wrapper });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    const calls = mocks.rpc.mock.calls.length;
    act(() => handler({ eventType: 'INSERT', new: { id: 'fresh', user_id: 'other', language: 'az', group_id: null } }));
    act(() => handler({ eventType: 'INSERT', new: { id: 'foreign', user_id: 'other', language: 'ru', group_id: null } }));
    expect(result.current.newPostsCount).toBe(1);
    act(() => handler({ eventType: 'UPDATE', new: { ...post, likes_count: 9, is_active: true }, old: { id: 'post' } }));
    await waitFor(() => expect(result.current.posts[0].likes_count).toBe(9));
    act(() => handler({ eventType: 'DELETE', new: {}, old: { id: 'post' } }));
    await waitFor(() => expect(result.current.posts).toHaveLength(0));
    expect(mocks.rpc.mock.calls.length).toBe(calls);
    await act(async () => { result.current.showNewPosts(); });
    expect(result.current.newPostsCount).toBe(0);
    await waitFor(() => expect(mocks.rpc.mock.calls.length).toBe(calls + 1));
  });
  it('fails closed if a server sends another language and never enriches or caches it', async () => {
    mocks.rpc.mockReturnValue(response({ data: [{ ...post, language: 'ru' }], error: null }));
    const { result } = renderHook(() => useCommunityFeed('recent'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.posts).toEqual([]);
    expect(mocks.enrich).not.toHaveBeenCalled();
  });

  it('shares pending bookmark state and rolls back only the failed save, preserving a concurrent like', async () => {
    client.setQueryData(feedKey('viewer-a'), cachedFeed());
    client.setQueryData(feedKey('viewer-b'), cachedFeed());
    client.setQueryData(['user-posts', 'author', false], [{ ...post }]);
    let finish!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(response(new Promise((resolve) => { finish = resolve; })));
    const { result } = renderHook(() => [useCommunityBookmark('post'), useCommunityBookmark('post')], { wrapper });
    act(() => result.current[0].setSaved(true));
    await waitFor(() => expect((client.getQueryData(feedKey('viewer-a')) as any).pages[0].posts[0].is_saved).toBe(true));
    expect(result.current.every((hook) => hook.isPending)).toBe(true);
    expect((client.getQueryData(feedKey('viewer-b')) as any).pages[0].posts[0].is_saved).toBe(false);
    expect((client.getQueryData(['user-posts', 'author', false]) as any)[0].is_saved).toBe(false);
    client.setQueryData(feedKey('viewer-a'), { pages: [{ posts: [{ ...post, is_saved: true, is_liked: true, likes_count: 3 }] }], pageParams: [0] });
    await act(async () => finish({ data: null, error: { code: '42501' } }));
    await waitFor(() => expect(result.current[0].isPending).toBe(false));
    expect((client.getQueryData(feedKey('viewer-a')) as any).pages[0].posts[0]).toMatchObject({ is_saved: false, is_liked: true, likes_count: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith('set_community_bookmark', { p_expected_user_id: 'viewer-a', p_post_id: 'post', p_saved: true });
  });

  it('keeps a late save failure scoped to the original account', async () => {
    client.setQueryData(feedKey('viewer-a'), cachedFeed());
    client.setQueryData(feedKey('viewer-b'), cachedFeed());
    let finish!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(response(new Promise((resolve) => { finish = resolve; })));
    const { result, rerender } = renderHook(() => useCommunityBookmark('post'), { wrapper });
    act(() => result.current.setSaved(true));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    mocks.auth.user = { id: 'viewer-b' };
    rerender();
    await act(async () => finish({ data: null, error: { code: '42501' } }));
    expect((client.getQueryData(feedKey('viewer-a')) as any).pages[0].posts[0].is_saved).toBe(false);
    expect((client.getQueryData(feedKey('viewer-b')) as any).pages[0].posts[0].is_saved).toBe(false);
  });

  it('updates follow state/count immediately, restores them on failure, and sends an explicit desired state', async () => {
    const key = ['community-profile-stats', 'viewer-a', 'author'];
    client.setQueryData(key, stats);
    let finish!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(response(new Promise((resolve) => { finish = resolve; })));
    const { result } = renderHook(() => useCommunityFollow('author'), { wrapper });
    act(() => result.current.setFollowing(true));
    await waitFor(() => expect(client.getQueryData(key)).toMatchObject({ is_following: true, followers_count: 11 }));
    expect(mocks.rpc).toHaveBeenCalledWith('set_community_follow', { p_expected_user_id: 'viewer-a', p_following_id: 'author', p_follow: true });
    await act(async () => finish({ data: null, error: { code: '42501' } }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(client.getQueryData(key)).toMatchObject({ is_following: false, followers_count: 10 });
  });

  it('does not submit self-follow and loads connection status in the viewer own namespace', async () => {
    const self = renderHook(() => useCommunityFollow('viewer-a'), { wrapper });
    act(() => self.result.current.setFollowing(true));
    expect(mocks.rpc).not.toHaveBeenCalled();
    self.unmount();
    mocks.rpc.mockImplementation(() => response({ data: [{ user_id: 'author', name: 'Author', is_following: mocks.auth.user?.id === 'viewer-a' }], error: null }));
    const { result, rerender } = renderHook(() => useCommunityConnections('someone', 'followers'), { wrapper });
    await waitFor(() => expect(result.current.connections[0]?.is_following).toBe(true));
    mocks.auth.user = { id: 'viewer-b' };
    rerender();
    expect(result.current.connections).toEqual([]);
    await waitFor(() => expect(result.current.connections[0]?.is_following).toBe(false));
  });
});
