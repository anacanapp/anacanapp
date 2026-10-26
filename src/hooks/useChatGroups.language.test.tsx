import { createElement, type ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useChatGroups } from './useChatGroups';

const mocks = vi.hoisted(() => ({ language: 'ru', rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, channel: mocks.channel, removeChannel: mocks.removeChannel } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://api.anacan.az' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: mocks.language }) }));
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  vi.clearAllMocks(); mocks.language = 'ru'; client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.channel.mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() });
  mocks.rpc.mockImplementation(async name => ({ data: name === 'chat_group_people_v3' ? [] : [
    { id: 'ru-group', discovery_language: 'ru', is_member: true }, { id: 'az-group', discovery_language: 'az', is_member: true },
  ], error: null }));
});
afterEach(() => { cleanup(); client.clear(); });
it('filters discovery by creator language and immediately clears the previous-language cache on a switch', async () => {
  const { result, rerender } = renderHook(() => useChatGroups(), { wrapper });
  await waitFor(() => expect(result.current.groups.map(g => g.id)).toEqual(['ru-group']));
  expect(mocks.rpc).toHaveBeenCalledWith('chat_groups_v4', expect.objectContaining({ p_language: 'ru' }));
  mocks.language = 'az'; rerender(); expect(result.current.groups).toEqual([]);
  await waitFor(() => expect(result.current.groups.map(g => g.id)).toEqual(['az-group']));
});
it('keeps joined chats and an explicit group accessible through the membership contract', async () => {
  const inbox = renderHook(() => useChatGroups(undefined, 'mine', '', false), { wrapper });
  await waitFor(() => expect(inbox.result.current.groups).toHaveLength(2));
  expect(mocks.rpc).toHaveBeenCalledWith('chat_groups_v3', { p_scope: 'mine', p_group: null, p_search: '' });
  const single = renderHook(() => useChatGroups('az-group'), { wrapper });
  await waitFor(() => expect(single.result.current.group?.id).toBe('az-group'));
});
