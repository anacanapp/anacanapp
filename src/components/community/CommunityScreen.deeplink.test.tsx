import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommunityScreen, { type CommunityDeepLinkTarget } from './CommunityScreen';
import { intentFromPushData } from '@/lib/pushNav';
import type { PublicProfileCard } from '@/lib/public-profile-cards';

const { getCard } = vi.hoisted(() => ({ getCard: vi.fn() }));
const SENDER = '01234567-89ab-4cde-8fab-0123456789ab';
const OTHER = '11234567-89ab-4cde-8fab-0123456789ab';
const card: PublicProfileCard = {
  user_id: SENDER, name: 'Database Sender', avatar_url: '/verified-avatar.png', badge_type: null,
};

vi.mock('@/lib/public-profile-cards', () => ({ getPublicProfileCard: getCard }));
vi.mock('@/hooks/useCommunity', () => ({
  useCommunityGroups: () => ({ data: [] }), useUserMemberships: () => ({ data: [] }),
}));
vi.mock('@/hooks/useDirectMessages', () => ({ useDirectMessages: () => ({ totalUnread: 0 }) }));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ unreadCount: 3 }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: '11234567-89ab-4cde-8fab-0123456789ab' }, profile: null }) }));
vi.mock('@/hooks/useUserBlock', () => ({ useActiveBlock: () => ({ data: null }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => undefined }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: object) => unknown) => selector({ lifeStage: 'mommy' }) }));
vi.mock('@/lib/tr', () => ({ tr: (key: string) => key }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));
vi.mock('@/components/banners/BannerSlot', () => ({ default: () => null }));
vi.mock('./GroupsList', () => ({ default: () => null }));
vi.mock('./GroupFeed', () => ({ default: ({ onCreatePost, onUserClick }: any) => <section data-testid="feed">
  <button onClick={onCreatePost}>Create post</button>
  <button onClick={() => onUserClick('profile-user')}>View profile</button>
</section> }));
vi.mock('./CreatePostScreen', () => ({ default: ({ onBack }: any) => <button onClick={onBack}>Close composer</button> }));
vi.mock('./UserProfileScreen', () => ({ default: ({ userId, onBack }: any) => <section data-testid="profile" data-user={userId}><button onClick={onBack}>Close profile</button></section> }));
vi.mock('./SinglePostView', () => ({ default: ({ postId, commentId, onBack }: any) =>
  <section data-testid="post" data-post={postId} data-comment={commentId || ''}>
    <button onClick={onBack}>Close post</button>
  </section>,
}));
vi.mock('./StoriesBar', async () => {
  const { useEffect, useState } = await import('react');
  return { default: ({ autoOpenStoryId, onAutoOpenConsumed }: any) => {
    const [opened, setOpened] = useState<string | null>(null);
    useEffect(() => {
      if (!autoOpenStoryId) return;
      setOpened(autoOpenStoryId);
      onAutoOpenConsumed?.();
    }, [autoOpenStoryId, onAutoOpenConsumed]);
    return <section data-testid="stories" data-story={opened || ''} data-pending-story={autoOpenStoryId || ''}>
      <button onClick={() => setOpened(null)}>Close story</button>
    </section>;
  } };
});
vi.mock('./ConversationListScreen', () => ({ default: ({ onBack, onOpenChat }: any) => <section data-testid="conversations">
  <button onClick={onBack}>Close conversations</button>
  <button onClick={() => onOpenChat('existing-dm-user', 'Existing DM', null)}>Open existing DM</button>
</section> }));
vi.mock('./DirectMessageScreen', () => ({ default: ({ userId, userName, userAvatar, onBack }: any) =>
  <section data-testid="dm" data-user={userId} data-avatar={userAvatar || ''}>
    <h1>{userName}</h1><button onClick={onBack}>Close DM</button>
  </section>,
}));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  return {
    motion: Object.fromEntries(['div', 'button'].map((tag) => [tag, forwardRef((props: any, ref) => {
      const { initial, animate, exit, transition, whileTap, ...rest } = props;
      return createElement(tag, { ...rest, ref });
    })])),
    AnimatePresence: ({ children }: any) => children,
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  getCard.mockResolvedValue(card);
});
afterEach(cleanup);

describe('Community push deep links', () => {
  it('opens the signed-in user community profile from its header', () => {
    render(<CommunityScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'community_my_profile' }));
    expect(screen.getByTestId('profile')).toHaveAttribute('data-user', OTHER);
  });

  it('opens a follower profile target while consuming the deep link once', () => {
    const consumed = vi.fn();
    render(<CommunityScreen deepLinkTarget={{ userId: SENDER }} onDeepLinkConsumed={consumed} />);
    expect(screen.getByTestId('profile')).toHaveAttribute('data-user', SENDER);
    expect(consumed).toHaveBeenCalledOnce();
  });
  it('places notifications immediately before messages and opens them through the parent', () => {
    const open = vi.fn();
    render(<CommunityScreen onOpenNotifications={open} />);
    const notifications = screen.getByRole('button', { name: 'notificationsscreen_bildirisler_54eb88' });
    const messages = screen.getByRole('button', { name: 'bottomnav_mesajlar' });
    expect(notifications.nextElementSibling).toBe(messages);
    expect(notifications).toHaveTextContent('3');
    fireEvent.click(notifications);
    expect(open).toHaveBeenCalledOnce();
  });
  it('opens the actual sender DM using the backend card, never push display data, and consumes it once', async () => {
    const target = intentFromPushData({
      type: 'direct_message', sender_id: SENDER,
      userName: 'Forged payload name', name: 'Forged payload name', avatar_url: '/forged.png',
    })!.communityTarget;
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={target} onDeepLinkConsumed={consumed} />);
    const dm = await screen.findByTestId('dm');
    expect(dm).toHaveAttribute('data-user', SENDER);
    expect(dm).toHaveAttribute('data-avatar', card.avatar_url);
    expect(screen.getByRole('heading')).toHaveTextContent('Database Sender');
    expect(screen.queryByText('Forged payload name')).not.toBeInTheDocument();
    expect(getCard).toHaveBeenCalledExactlyOnceWith(SENDER);
    expect(consumed).toHaveBeenCalledOnce();

    view.rerender(<CommunityScreen deepLinkTarget={null} onDeepLinkConsumed={consumed} />);
    expect(screen.getByTestId('dm')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close DM'));
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    view.rerender(<CommunityScreen deepLinkTarget={null} onDeepLinkConsumed={consumed} />);
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    expect(consumed).toHaveBeenCalledOnce();
  });

  it.each([
    { conversations: true }, { dmUserId: '' }, { dmUserId: 'not-a-uuid' },
    { dmUserId: `${SENDER},receiver_id.eq.other` },
  ])('shows conversations without a lookup for %j', (target) => {
    const consumed = vi.fn();
    render(<CommunityScreen deepLinkTarget={target} onDeepLinkConsumed={consumed} />);
    expect(screen.getByTestId('conversations')).toBeInTheDocument();
    expect(getCard).not.toHaveBeenCalled();
    expect(consumed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Close conversations'));
    expect(screen.getByTestId('feed')).toBeInTheDocument();
  });

  it.each(['missing', 'mismatched', 'error'])('falls back to conversations for a %s card', async (result) => {
    if (result === 'error') getCard.mockRejectedValue(new Error('Profile lookup failed'));
    else getCard.mockResolvedValue(result === 'missing' ? null : { ...card, user_id: OTHER });
    const consumed = vi.fn();
    render(<CommunityScreen deepLinkTarget={{ dmUserId: SENDER }} onDeepLinkConsumed={consumed} />);
    expect(await screen.findByTestId('conversations')).toBeInTheDocument();
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    expect(consumed).toHaveBeenCalledOnce();
  });

  it('does not restart a pending lookup when only the parent callback changes', async () => {
    let resolve!: (value: PublicProfileCard) => void;
    getCard.mockReturnValue(new Promise<PublicProfileCard>((done) => { resolve = done; }));
    const target = { dmUserId: SENDER };
    const oldConsumed = vi.fn();
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={target} onDeepLinkConsumed={oldConsumed} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    view.rerender(<CommunityScreen deepLinkTarget={target} onDeepLinkConsumed={consumed} />);
    await act(async () => { resolve(card); });
    expect(screen.getByTestId('dm')).toBeInTheDocument();
    expect(getCard).toHaveBeenCalledOnce();
    expect(oldConsumed).toHaveBeenCalledOnce();
    expect(consumed).not.toHaveBeenCalled();
  });

  it('consumes a DM immediately without cancelling its lookup when the parent clears the target', async () => {
    let resolve!: (value: PublicProfileCard) => void;
    getCard.mockReturnValue(new Promise<PublicProfileCard>((done) => { resolve = done; }));
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={{ dmUserId: SENDER }} onDeepLinkConsumed={consumed} />);
    expect(consumed).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toBeInTheDocument();
    view.rerender(<CommunityScreen deepLinkTarget={null} onDeepLinkConsumed={consumed} />);
    await act(async () => { resolve(card); });
    expect(screen.getByTestId('dm')).toHaveAttribute('data-user', SENDER);
    expect(consumed).toHaveBeenCalledOnce();
  });

  it.each([
    [{ postId: 'new-post', commentId: 'new-comment' }, 'post'],
    [{ storyId: 'new-story' }, 'stories'],
    [{ conversations: true }, 'conversations'],
    [{ dmUserId: OTHER }, 'dm'],
  ] as [CommunityDeepLinkTarget, string][])('ignores an old DM response after a new target %j', async (target, expected) => {
    let resolve!: (value: PublicProfileCard) => void;
    getCard.mockReturnValueOnce(new Promise<PublicProfileCard>((done) => { resolve = done; }))
      .mockResolvedValue({ ...card, user_id: OTHER, name: 'New Sender' });
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={{ dmUserId: SENDER }} onDeepLinkConsumed={consumed} />);
    view.rerender(<CommunityScreen deepLinkTarget={target} onDeepLinkConsumed={consumed} />);
    await screen.findByTestId(expected);
    await act(async () => { resolve(card); });
    expect(screen.getByTestId(expected)).toBeInTheDocument();
    expect(screen.queryByText('Database Sender')).not.toBeInTheDocument();
    expect(consumed).toHaveBeenCalledTimes(2);
    if (expected === 'dm') expect(screen.getByTestId('dm')).toHaveAttribute('data-user', OTHER);
  });

  it('does not replay a consumed target or navigate after unmount during a lookup', async () => {
    let resolve!: (value: PublicProfileCard) => void;
    getCard.mockReturnValue(new Promise<PublicProfileCard>((done) => { resolve = done; }));
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={{ dmUserId: SENDER }} onDeepLinkConsumed={consumed} />);
    expect(consumed).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () => { resolve(card); });
    expect(consumed).toHaveBeenCalledOnce();
    render(<CommunityScreen deepLinkTarget={null} />);
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    expect(getCard).toHaveBeenCalledOnce();
  });

  it.each(['composer', 'profile', 'conversations', 'dm', 'post'])('replaces a stale %s with a post/comment and clears its back stack', (nested) => {
    const view = render(<CommunityScreen deepLinkTarget={nested === 'post' ? { postId: 'old-post' } : null} />);
    if (nested === 'composer') fireEvent.click(screen.getByText('Create post'));
    if (nested === 'profile') fireEvent.click(screen.getByText('View profile'));
    if (nested === 'conversations' || nested === 'dm') {
      fireEvent.click(screen.getByRole('button', { name: 'bottomnav_mesajlar' }));
      if (nested === 'dm') fireEvent.click(screen.getByText('Open existing DM'));
    }
    view.rerender(<CommunityScreen deepLinkTarget={{ postId: 'new-post', commentId: 'new-comment' }} />);
    expect(screen.getByTestId('post')).toHaveAttribute('data-post', 'new-post');
    expect(screen.getByTestId('post')).toHaveAttribute('data-comment', 'new-comment');
    fireEvent.click(screen.getByText('Close post'));
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('conversations')).not.toBeInTheDocument();
  });

  it('preserves post, comment and story targets without letting any hide a newer DM', async () => {
    const consumed = vi.fn();
    const view = render(<CommunityScreen deepLinkTarget={{ postId: 'post', commentId: 'comment' }} onDeepLinkConsumed={consumed} />);
    expect(screen.getByTestId('post')).toHaveAttribute('data-comment', 'comment');
    view.rerender(<CommunityScreen deepLinkTarget={{ storyId: 'story' }} onDeepLinkConsumed={consumed} />);
    expect(screen.getByTestId('stories')).toHaveAttribute('data-story', 'story');
    expect(screen.getByTestId('stories')).toHaveAttribute('data-pending-story', '');
    expect(screen.queryByTestId('post')).not.toBeInTheDocument();
    view.rerender(<CommunityScreen deepLinkTarget={{ dmUserId: SENDER }} onDeepLinkConsumed={consumed} />);
    await screen.findByTestId('dm');
    fireEvent.click(screen.getByText('Close DM'));
    expect(screen.getByTestId('feed')).toBeInTheDocument();
    expect(screen.getByTestId('stories')).toHaveAttribute('data-story', '');
    expect(consumed).toHaveBeenCalledTimes(3);
  });

  it.each(['dm', 'story'])('clears an old %s on a generic Community push without reopening it', async (kind) => {
    const view = render(<CommunityScreen deepLinkTarget={kind === 'dm' ? { dmUserId: SENDER } : { storyId: 'story' }} />);
    if (kind === 'dm') await screen.findByTestId('dm');
    else expect(screen.getByTestId('stories')).toHaveAttribute('data-story', 'story');
    view.rerender(<CommunityScreen deepLinkTarget={{}} />);
    await waitFor(() => expect(screen.getByTestId('feed')).toBeInTheDocument());
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    expect(screen.getByTestId('stories')).toHaveAttribute('data-story', '');
  });

  it('keeps an opened story stable when its parent target is consumed', () => {
    const view = render(<CommunityScreen deepLinkTarget={{ storyId: 'story' }} />);
    view.rerender(<CommunityScreen deepLinkTarget={null} />);
    expect(screen.getByTestId('stories')).toHaveAttribute('data-story', 'story');
    expect(screen.getByTestId('stories')).toHaveAttribute('data-pending-story', '');
  });
});
