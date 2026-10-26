import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { communityUnreadScope, unreadCommunityStore, useUnreadCommunityPosts } from './useUnreadCommunityPosts';

const mocks = vi.hoisted(() => ({
  language: 'ru', backend: 'https://api.anacan.az', from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(),
  posts: [] as any[], reads: new Set<string>(), calls: [] as any[], failWrite: false,
  delayed: null as null | ((filters: Record<string, any>) => Promise<any> | null), events: [] as { filter: any; callback: (event: any) => void }[],
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, channel: mocks.channel, removeChannel: mocks.removeChannel } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: mocks.backend }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign((select: any) => select({ language: mocks.language }), { getState: () => ({ language: mocks.language }) }) }));
const post = (id: string, language: string) => ({ id, language, user_id: 'author', created_at: '2026-09-24T10:00:00Z', is_active: true, group_id: null });

beforeEach(() => {
  vi.clearAllMocks(); mocks.language = 'ru'; mocks.backend = 'https://api.anacan.az'; mocks.posts = [post('ru-1', 'ru'), post('az-1', 'az')];
  mocks.reads.clear(); mocks.calls = []; mocks.events = []; mocks.failWrite = false; mocks.delayed = null;
  unreadCommunityStore.getState().reset(); localStorage.clear();
  mocks.from.mockImplementation(table => {
    const filters: Record<string, any> = {}, query: any = {};
    for (const method of ['select','order']) query[method] = vi.fn(() => query);
    for (const method of ['eq','neq','is','gt','in']) query[method] = vi.fn((key, value) => { filters[`${method}:${key}`] = value; return query; });
    query.limit = vi.fn(value => { filters.limit = value; return query; });
    query.upsert = vi.fn(value => {
      mocks.calls.push({ table, write: value });
      if (mocks.failWrite) return Promise.resolve({ error: { code: '42501' } });
      for (const row of Array.isArray(value) ? value : [value]) mocks.reads.add(`${row.user_id}:${row.post_id}`);
      return Promise.resolve({ error: null });
    });
    query.then = (resolve: any, reject: any) => {
      mocks.calls.push({ table, filters });
      if (table === 'community_posts') {
        const delayed = mocks.delayed?.(filters);
        if (delayed) return delayed.then(resolve, reject);
        const data = mocks.posts.filter(row => row.language === filters['eq:language'] && row.is_active && !row.group_id
          && row.user_id !== filters['neq:user_id'] && (!filters['gt:created_at'] || row.created_at > filters['gt:created_at'])).slice(0, filters.limit);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
      if (table === 'community_post_reads') return Promise.resolve({ data: (filters['in:post_id'] || []).filter((id: string) => mocks.reads.has(`${filters['eq:user_id']}:${id}`)).map((post_id: string) => ({ post_id })), error: null }).then(resolve, reject);
      throw new Error(`Unexpected table ${table}`);
    };
    return query;
  });
  mocks.channel.mockImplementation(() => {
    const channel = { on: vi.fn((_kind, filter, callback) => { mocks.events.push({ filter, callback }); return channel; }), subscribe: vi.fn(() => channel) };
    return channel;
  });
});
afterEach(() => { cleanup(); unreadCommunityStore.getState().reset(); localStorage.clear(); });

it('filters before the 500-row bound and isolates last-seen markers by language and backend', async () => {
  await unreadCommunityStore.getState().hydrateForUser('viewer', 'ru');
  expect(unreadCommunityStore.getState().unreadCount).toBe(1);
  expect(mocks.calls.find(call => call.table === 'community_posts').filters).toMatchObject({ 'eq:language': 'ru', limit: 500 });
  await unreadCommunityStore.getState().markCommunitySeen('viewer', 'ru');
  expect(unreadCommunityStore.getState().unreadCount).toBe(0);
  expect(mocks.reads.has('viewer:ru-1')).toBe(true); expect(mocks.reads.has('viewer:az-1')).toBe(false);
  await unreadCommunityStore.getState().hydrateForUser('viewer', 'az');
  expect(unreadCommunityStore.getState().unreadCount).toBe(1);
  expect(mocks.calls.some(call => call.table === 'user_preferences')).toBe(false);
  const azure = communityUnreadScope('viewer', 'ru'); mocks.backend = 'https://tntbjulojatnrqmylorp.supabase.co';
  expect(communityUnreadScope('viewer', 'ru')).not.toBe(azure);
});
it('ignores a late hydration from the previous language and a response after reset', async () => {
  let finish!: (value: any) => void;
  mocks.delayed = filters => filters['eq:language'] === 'ru' ? new Promise(resolve => { finish = resolve; }) : null;
  const pending = unreadCommunityStore.getState().hydrateForUser('viewer', 'ru');
  await unreadCommunityStore.getState().hydrateForUser('viewer', 'az');
  finish({ data: [post('ru-late', 'ru')], error: null }); await pending;
  expect(unreadCommunityStore.getState().scope).toBe(communityUnreadScope('viewer', 'az'));
  expect(unreadCommunityStore.getState().unreadPostIds).toEqual({ 'az-1': true });
  const previousFinish = finish;
  const resetting = unreadCommunityStore.getState().hydrateForUser('viewer', 'ru');
  await waitFor(() => expect(finish).not.toBe(previousFinish));
  unreadCommunityStore.getState().reset(); finish({ data: [post('ru-late', 'ru')], error: null }); await resetting;
  expect(unreadCommunityStore.getState().scope).toBeNull(); expect(unreadCommunityStore.getState().unreadCount).toBe(0);
});
it('refresh drops deleted/inactive posts and a failed mark-all does not manufacture read receipts', async () => {
  await unreadCommunityStore.getState().hydrateForUser('viewer', 'ru');
  mocks.failWrite = true;
  await expect(unreadCommunityStore.getState().markCommunitySeen('viewer', 'ru')).rejects.toMatchObject({ code: '42501' });
  expect(unreadCommunityStore.getState().unreadCount).toBe(1);
  expect(localStorage.getItem(`community_seen_at_v2:${communityUnreadScope('viewer', 'ru')}`)).toBeNull();
  mocks.posts = mocks.posts.filter(p => p.id !== 'ru-1');
  await unreadCommunityStore.getState().hydrateForUser('viewer', 'ru');
  expect(unreadCommunityStore.getState().unreadCount).toBe(0);
});
it('realtime excludes foreign, inactive and group posts, deduplicates events and changes subscription with language', async () => {
  const { result, rerender } = renderHook(useUnreadCommunityPosts);
  await waitFor(() => expect(result.current.unreadCount).toBe(1));
  expect(mocks.events[0].filter.filter).toBe('language=eq.ru');
  const emit = mocks.events[0].callback;
  act(() => {
    emit({ new: post('foreign', 'az') }); emit({ new: { ...post('inactive', 'ru'), is_active: false } });
    emit({ new: { ...post('group', 'ru'), group_id: 'private' } });
    emit({ new: post('new', 'ru') }); emit({ new: post('new', 'ru') });
  });
  expect(result.current.unreadCount).toBe(2);
  mocks.language = 'az'; rerender();
  expect(result.current.unreadCount).toBe(0);
  await waitFor(() => expect(result.current.unreadCount).toBe(1));
  expect(mocks.removeChannel).toHaveBeenCalled();
  act(() => emit({ new: post('stale-subscription', 'ru') }));
  expect(result.current.unreadCount).toBe(1);
});
