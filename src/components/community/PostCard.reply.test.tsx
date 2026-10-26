import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostCard from './PostCard';
import type { CommunityPost, PostComment } from '@/hooks/useCommunity';

const mocks = vi.hoisted(() => ({ create: vi.fn(), comments: [] as any[], userClick: vi.fn() }));
vi.mock('@/hooks/useCommunity', () => ({
  usePostComments: () => ({ data: mocks.comments, isLoading: false, refetch: vi.fn() }),
  useCreateComment: () => ({ mutateAsync: mocks.create, isPending: false }),
  useToggleLike: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleCommentLike: () => ({ mutate: vi.fn(), isPending: false }),
  useEditPost: () => ({ mutate: vi.fn() }), useDeletePost: () => ({ mutate: vi.fn() }),
  useTogglePinPost: () => ({ mutate: vi.fn() }), useEditComment: () => ({ mutate: vi.fn() }),
  useDeleteComment: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({
  user: { id: 'viewer', user_metadata: { name: 'Reader' } }, profile: { name: 'Reader' }, isAdmin: false,
}) }));
vi.mock('@/hooks/useModerator', () => ({ useMyModerationStatus: () => ({ data: null }), useModeratorAccess: () => ({ data: { allowed: false } }) }));
vi.mock('@/hooks/useCommunitySocial', () => ({ useCommunityBookmark: () => ({ setSaved: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: 'az' }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/date-utils', () => ({ getCurrentDateLocale: () => undefined }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: vi.fn(), medium: vi.fn() }, nativeShare: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('./MediaCarousel', () => ({ default: () => null }));
vi.mock('@/components/PhotoGalleryViewer', () => ({ default: () => null }));
vi.mock('@/components/moderation/BlockUserDialog', () => ({ default: () => null }));
vi.mock('./UserBadge', () => ({ UserBadge: () => null, VerifiedTick: () => null, isVerifiedActive: () => false }));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  return {
    motion: Object.fromEntries(['article', 'div', 'button', 'span'].map((tag) => [tag, forwardRef((props: any, ref) => {
      const { initial, animate, exit, transition, whileTap, ...rest } = props;
      return createElement(tag, { ...rest, ref });
    })])),
    AnimatePresence: ({ children }: any) => children,
  };
});

const post: CommunityPost = {
  id: 'post', user_id: 'author', group_id: null, content: 'Discussion', media_urls: [],
  likes_count: 0, comments_count: 7, is_pinned: false, is_anonymous: false,
  created_at: '2026-09-14T00:00:00Z', language: 'az', author: { name: 'Author', avatar_url: null },
};
const comment = (index: number): PostComment => ({
  id: `comment-${index}`, post_id: post.id, user_id: `author-${index}`,
  parent_comment_id: index === 0 ? null : `comment-${index - 1}`,
  content: `Reply ${index}`, likes_count: 0, created_at: `2026-09-14T00:0${index}:00Z`,
  author: { name: `Author ${index}`, avatar_url: null },
});
const input = () => screen.getByRole('textbox', { name: 'Şərh və ya cavab yaz' });
const reply = (index: number) => fireEvent.click(within(document.querySelector(`[data-comment-id="comment-${index}"]`) as HTMLElement).getAllByRole('button', { name: 'Cavab' })[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.comments = Array.from({ length: 7 }, (_, i) => comment(i));
  mocks.create.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shared full-width comment composer', () => {
  it('uses the same editor through six reply levels and sends the exact selected parent', async () => {
    render(<PostCard post={post} groupId={null} forceShowComments />);
    const editor = input();
    for (let depth = 0; depth <= 6; depth++) {
      reply(depth);
      expect(input()).toBe(editor);
      expect(editor).toHaveFocus();
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect(editor.closest('[data-comment-id]')).toBeNull();
    }
    fireEvent.change(editor, { target: { value: 'A reply to the sixth reply\nwith a second line' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Göndər' })); });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ postId: 'post', parentCommentId: 'comment-6', content: 'A reply to the sixth reply\nwith a second line' }));
    expect(editor).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Cavabı ləğv et' })).not.toBeInTheDocument();
  });

  it('keeps a failed reply draft, anonymity and parent available for retry', async () => {
    mocks.create.mockRejectedValueOnce(new Error('offline'));
    render(<PostCard post={post} groupId={null} forceShowComments />);
    reply(5);
    fireEvent.change(input(), { target: { value: 'Do not lose my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anonim olaraq yaz' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Göndər' })); });
    expect(input()).toHaveValue('Do not lose my draft');
    expect(screen.getByText('Author 5 üçün cavab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anonim olaraq yaz' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Göndər' })); });
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ parentCommentId: 'comment-5', isAnonymous: true, content: 'Do not lose my draft' }));
  });

  it('does not send ordinary Enter or IME composition; Ctrl+Enter sends', async () => {
    render(<PostCard post={post} groupId={null} forceShowComments />);
    fireEvent.change(input(), { target: { value: 'Multiline comment' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(mocks.create).not.toHaveBeenCalled();
    await act(async () => { fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true }); });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it('keeps replies visible when an ancestor was removed and does not expose anonymous profiles', () => {
    mocks.comments = [{ ...comment(5), parent_comment_id: 'deleted', is_anonymous: true, author: { name: 'Anonim', avatar_url: null } }];
    render(<PostCard post={post} groupId={null} onUserClick={mocks.userClick} forceShowComments />);
    expect(screen.getByText('Reply 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anonim' }));
    expect(mocks.userClick).not.toHaveBeenCalled();
    reply(5);
    expect(screen.getByText('Anonim üçün cavab')).toBeInTheDocument();
  });
});
