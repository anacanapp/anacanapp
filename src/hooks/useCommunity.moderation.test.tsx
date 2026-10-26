import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreatePost, useEditPost } from './useCommunity';
import { moderationText } from '@/lib/community-moderation-i18n';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn(), toast: vi.fn(), trackPost: vi.fn(),
  auth: { user: { id: 'c35b3d1e-0f96-4cc0-a8c3-80d651c3f60c' } as { id: string } | null }, language: 'az' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, auth: { getUser: mocks.getUser } } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://api.anacan.az' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/customerio', () => ({ customerIo: { postCreated: mocks.trackPost } }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign((selector: (state: object) => unknown) => selector({ language: mocks.language }), { getState: () => ({ language: mocks.language }) }) }));
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const input = { groupId: null, content: 'Sifariş üçün yazın', language: 'az' as const, isAnonymous: true };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.user = { id: 'c35b3d1e-0f96-4cc0-a8c3-80d651c3f60c' }; mocks.language = 'az';
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.auth.user } }));
  mocks.rpc.mockResolvedValue({ data: { id: 'post-id', state: 'checking', revision: 1 }, error: null });
});
afterEach(() => { cleanup(); client.clear(); });
describe('server-held post creation', () => {
  it('keeps anonymous/media/group/blog fields and reports checking instead of publication', async () => {
    const { result } = renderHook(useCreatePost, { wrapper });
    await act(() => result.current.mutateAsync({ ...input, mediaUrls: ['https://example.invalid/image.png'], taggedGroupIds: ['group-a', 'group-a'], blogPostId: 'article-a' }));
    expect(mocks.rpc).toHaveBeenCalledWith('submit_community_post_v2', expect.objectContaining({ p_actor: mocks.auth.user.id, p_content: input.content, p_language: 'az', p_auto_language: false,
      p_is_anonymous: true, p_media_urls: ['https://example.invalid/image.png'], p_tagged_group_ids: ['group-a'], p_blog_post_id: 'article-a', p_id: expect.any(String) }));
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ title: moderationText('checking_title', 'az'), description: moderationText('checking_body', 'az') });
    await waitFor(() => expect(mocks.trackPost).toHaveBeenCalledWith(mocks.auth.user.id, 'https://api.anacan.az', mocks.rpc.mock.calls[0][1].p_id));
  });
  it('distinguishes automatic inference from an explicit language chip choice', async () => {
    const { result } = renderHook(useCreatePost, { wrapper });
    const text = 'Salam qizlar bir sualim var, nece edim?';
    await act(() => result.current.mutateAsync({ groupId: null, content: text }));
    expect(mocks.rpc).toHaveBeenLastCalledWith('submit_community_post_v2', expect.objectContaining({ p_language: 'az', p_auto_language: true }));
    await act(() => result.current.mutateAsync({ groupId: null, content: text, language: 'tr', autoLanguage: false }));
    expect(mocks.rpc).toHaveBeenLastCalledWith('submit_community_post_v2', expect.objectContaining({ p_language: 'tr', p_auto_language: false }));
  });
  it('reuses the request ID after a lost response and never falls back to an unmoderated insert', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'network error' } });
    const { result } = renderHook(useCreatePost, { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toBeDefined(); });
    expect(mocks.trackPost).not.toHaveBeenCalled();
    const id = mocks.rpc.mock.calls[0][1].p_id;
    await act(() => result.current.mutateAsync(input));
    expect(mocks.rpc.mock.calls[1][1].p_id).toBe(id);
    await act(() => result.current.mutateAsync(input));
    expect(mocks.rpc.mock.calls[2][1].p_id).not.toBe(id);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('preserves a draft with a clear unavailable message when Source installation is pending', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    const { result } = renderHook(useCreatePost, { wrapper });
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toBeDefined(); });
    expect(mocks.from).not.toHaveBeenCalled();expect(mocks.toast).toHaveBeenCalledWith({ title: moderationText('unavailable', 'az'), variant: 'destructive' });
  });
  it('does not submit under a changed account while authentication is resolving', async () => {
    const first = mocks.auth.user; let resolve!: (value: unknown) => void;
    mocks.getUser.mockReturnValue(new Promise(value => { resolve = value; }));
    const { result, rerender } = renderHook(useCreatePost, { wrapper });
    act(() => result.current.mutate(input));
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());mocks.auth.user = { id: 'other-user' }; rerender();
    await act(async () => resolve({ data: { user: first } }));
    await waitFor(() => expect(result.current.isError).toBe(true));expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
it('edits use the guarded RPC with the expected revision, without a direct REST fallback', async () => {
  const { result } = renderHook(useEditPost, { wrapper });
  await act(() => result.current.mutateAsync({ postId: 'post-id', content: 'Yeni mətn', currentLanguage: 'az', expectedRevision: 4 }));
  expect(mocks.rpc).toHaveBeenCalledWith('edit_community_post_v1', expect.objectContaining({ p_actor: mocks.auth.user.id, p_post: 'post-id', p_expected_revision: 4 }));
  expect(mocks.from).not.toHaveBeenCalled();
});
