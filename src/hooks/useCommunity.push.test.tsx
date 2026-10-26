import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateComment, useToggleCommentLike, useToggleLike } from './useCommunity';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  invokePush: vi.fn(),
  toast: vi.fn()
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
    channel: vi.fn(),
    removeChannel: vi.fn()
  }
}));
vi.mock('@/lib/push', () => ({ invokeSendPush: mocks.invokePush }));
vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCards: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: actorId }, profile: null, loading: false })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/store/userStore', () => ({
  useUserStore: Object.assign((selector: (state: object) => unknown) => selector({ language: 'az' }), {
    getState: () => ({ countryCode: 'AZ', language: 'az' })
  })
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const authorId = '22222222-2222-4222-8222-222222222222';
const postId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const interactionId = '55555555-5555-4555-8555-555555555555';
const commentId = '66666666-6666-4666-8666-666666666666';

function query(result: unknown) {
  const execute = vi.fn().mockResolvedValue({ data: result, error: null });
  const builder = {
    execute,
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(() => execute()),
    maybeSingle: vi.fn(() => execute()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject)
  };
  builder.insert.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mocks.invokePush.mockResolvedValue({ ok: true, sent: 1 });
});

afterEach(() => {
  cleanup();
  client.clear();
});

describe('community push interaction binding', () => {
  it('uses the inserted post-like id and the post row instead of the caller group value', async () => {
    const likeInsert = query({ id: interactionId });
    const postLookup = query({ id: postId, user_id: authorId, group_id: groupId });
    const profileLookup = query({ name: 'Actor' });
    mocks.from.mockImplementation((table) => ({
      post_likes: likeInsert,
      community_posts: postLookup,
      public_profile_cards: profileLookup
    })[table]);

    const { result } = renderHook(useToggleLike, { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ postId, isLiked: false, groupId: null });
    });
    await waitFor(() => expect(mocks.invokePush).toHaveBeenCalledOnce());

    expect(likeInsert.select).toHaveBeenCalledWith('id');
    expect(mocks.invokePush).toHaveBeenCalledWith(expect.objectContaining({
      userId: authorId,
      data: {
        type: 'community_like',
        context: 'community_post',
        postId,
        groupId,
        interactionId
      }
    }));
  });

  it('binds a comment-like push to the inserted like row', async () => {
    const likeInsert = query({ id: interactionId });
    const commentLookup = query({ id: commentId, user_id: authorId, post_id: postId, content: 'Comment' });
    const profileLookup = query({ name: 'Actor' });
    mocks.from.mockImplementation((table) => ({
      comment_likes: likeInsert,
      post_comments: commentLookup,
      public_profile_cards: profileLookup
    })[table]);

    const { result } = renderHook(useToggleCommentLike, { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ commentId, postId, isLiked: false });
    });
    await waitFor(() => expect(mocks.invokePush).toHaveBeenCalledOnce());

    expect(mocks.invokePush).toHaveBeenCalledWith(expect.objectContaining({
      userId: authorId,
      data: {
        type: 'comment_like',
        context: 'post_comment',
        commentId,
        postId,
        interactionId
      }
    }));
  });

  it('resolves a root comment recipient from the post and sends the inserted comment id', async () => {
    const commentInsert = query({ id: interactionId, post_id: postId, parent_comment_id: null });
    const postLookup = query({ user_id: authorId });
    mocks.from.mockImplementation((table) => ({
      post_comments: commentInsert,
      community_posts: postLookup
    })[table]);

    const { result } = renderHook(useCreateComment, { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        postId,
        content: 'New comment',
        postAuthorId: '77777777-7777-4777-8777-777777777777',
        commenterName: 'Actor'
      });
    });

    expect(mocks.invokePush).toHaveBeenCalledWith(expect.objectContaining({
      userId: authorId,
      data: {
        type: 'community_comment',
        context: 'community_post',
        postId,
        interactionId
      }
    }));
  });

  it('binds a reply to its inserted row and persisted parent context', async () => {
    const replyInsert = query({ id: interactionId, post_id: postId, parent_comment_id: commentId });
    const parentLookup = query({ user_id: authorId, post_id: postId });
    mocks.from.mockImplementation((table) => table === 'post_comments'
      ? mocks.from.mock.calls.filter(([name]) => name === 'post_comments').length === 1
        ? replyInsert
        : parentLookup
      : undefined);

    const { result } = renderHook(useCreateComment, { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        postId,
        content: 'Reply',
        parentCommentId: commentId,
        commenterName: 'Actor'
      });
    });

    expect(mocks.invokePush).toHaveBeenCalledWith(expect.objectContaining({
      userId: authorId,
      data: {
        type: 'community_reply',
        context: 'post_comment',
        commentId,
        postId,
        interactionId
      }
    }));
  });
});
