import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsScreen from './NotificationsScreen';

const mocks = vi.hoisted(() => ({ mark: vi.fn(), remove: vi.fn(), notifications: [] as any[] }));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({
  notifications: mocks.notifications, loading: false, unreadCount: 2,
  markAsRead: mocks.mark, markAllAsRead: vi.fn(), deleteNotification: mocks.remove,
}) }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'az-AZ' }));
vi.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ language: 'az' }) } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifications = [
    { id: 'system', user_id: 'viewer', title: 'Daily message', message: 'Long daily content. '.repeat(30) + 'The very last sentence.', notification_type: 'tip', is_read: false, created_at: new Date().toISOString() },
    { id: 'comment', user_id: 'viewer', title: 'New reply', message: 'Long community content. '.repeat(30), notification_type: 'community_reply', is_read: false, created_at: new Date().toISOString(), action_data: { postId: 'post', commentId: 'reply' } },
  ];
});
afterEach(cleanup);

describe('notification expansion', () => {
  it('opens the full system message in place and marks it read', () => {
    render(<NotificationsScreen onBack={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Daily message' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('notification-message-system')).not.toHaveClass('line-clamp-2');
    expect(button).toHaveTextContent('The very last sentence.');
    expect(mocks.mark).toHaveBeenCalledWith('system');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands community text without losing it to navigation, with a separate exact-target action', () => {
    const navigate = vi.fn();
    render(<NotificationsScreen onBack={vi.fn()} onNavigateToCommunity={navigate} />);
    const button = screen.getByRole('button', { name: 'New reply' });
    fireEvent.click(button);
    expect(navigate).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Paylaşıma keç' }));
    expect(navigate).toHaveBeenCalledWith({ postId: 'post', commentId: 'reply' });
  });

  it('does not expand a row when its delete action is used', () => {
    render(<NotificationsScreen onBack={vi.fn()} />);
    const row = document.querySelector('[data-notification-id="system"]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Sil' }));
    expect(mocks.remove).toHaveBeenCalledWith('system');
    expect(screen.getByRole('button', { name: 'Daily message' })).toHaveAttribute('aria-expanded', 'false');
    expect(mocks.mark).not.toHaveBeenCalled();
  });

  it('opens the follower profile from a follow notification', () => {
    mocks.notifications = [{ ...mocks.notifications[1], notification_type: 'community_follow', action_data: { userId: 'follower' } }];
    const navigate = vi.fn();
    render(<NotificationsScreen onBack={vi.fn()} onNavigateToCommunity={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Profilə bax' }));
    expect(navigate).toHaveBeenCalledWith({ userId: 'follower' });
  });
});
