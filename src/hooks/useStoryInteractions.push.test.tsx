import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToggleStoryLike } from './useStories';
import { useCreateStoryReply } from './useStoryReplies';
import { usePartnerNotifications } from './usePartnerNotifications';

const ids = { actor: '11111111-1111-4111-8111-111111111111', target: '22222222-2222-4222-8222-222222222222',
  story: '33333333-3333-4333-8333-333333333333', row: '44444444-4444-4444-8444-444444444444' };
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), push: vi.fn(), sharing: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.push }));
vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCards: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: ids.actor }, profile: { linked_partner_id: 'fixture-profile' } }) }));
vi.mock('@/hooks/usePartnerSharing', () => ({ getOwnSharingSettings: mocks.sharing }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

function query(data: unknown, error: unknown = null) {
  const q = { insert: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  q.insert.mockReturnValue(q); q.select.mockReturnValue(q); q.eq.mockReturnValue(q);
  return q;
}
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.getUser.mockResolvedValue({ data: { user: { id: ids.actor } }, error: null });
  mocks.sharing.mockResolvedValue({ share_contractions: true });
  mocks.push.mockResolvedValue({ ok: true, sent: 1 });
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });

describe('remaining push callers use persisted interaction identities', () => {
  it.each(['like', 'reply'])('uses the saved %s row ID', async (kind) => {
    const inserted = query({ id: ids.row });
    mocks.from.mockImplementation((table) => table === 'community_stories' ? query({ user_id: ids.target })
      : table === 'public_profile_cards' ? query({ name: 'Fixture' }) : inserted);
    const { result } = renderHook(() => ({ like: useToggleStoryLike(), reply: useCreateStoryReply() }), { wrapper });
    await act(async () => {
      if (kind === 'like') await result.current.like.mutateAsync({ storyId: ids.story, isLiked: false });
      else await result.current.reply.mutateAsync({ storyId: ids.story, content: 'Fixture reply', storyAuthorId: ids.target });
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ userId: ids.target,
      data: { type: `story_${kind}`, context: 'community_story', storyId: ids.story, interactionId: ids.row } }));
  });

  it('sends no second push after an already-existing story like', async () => {
    mocks.from.mockReturnValue(query(null, { code: '23505' }));
    const { result } = renderHook(useToggleStoryLike, { wrapper });
    await act(async () => { await result.current.mutateAsync({ storyId: ids.story, isLiked: false }); });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each([false, true])('511 push requires a confirmed database insert (failure=%s)', async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.from.mockImplementation((table) => table === 'profiles' ? query({ user_id: ids.target })
      : query(failure ? null : { id: ids.row }, failure ? { code: '42501' } : null));
    const { result } = renderHook(usePartnerNotifications);
    await act(async () => { await result.current.notifyContraction511(); });
    if (failure) expect(mocks.push).not.toHaveBeenCalled();
    else expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({
      data: { type: 'contraction_511', context: 'partner', interactionId: ids.row },
    }));
  });
});
