import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BlogPost } from '@/hooks/useBlog';

const state = vi.hoisted(() => ({ posts: [] as BlogPost[], loading: false }));
vi.mock('@/hooks/useBlog', () => ({ useBlog: () => ({ posts: state.posts, loading: state.loading }) }));
vi.mock('@/lib/blog-editorial', () => ({ blogMatchesStage: () => true }));

import RecentBlogPosts from './RecentBlogPosts';

const post = (i: number) => ({
  id: `p${i}`, slug: `post-${i}`, title: `Post ${i}`, excerpt: `Excerpt ${i}`, cover_image_url: null,
  reading_time: 4, view_count: 1, created_at: '2026-10-01T00:00:00Z',
}) as unknown as BlogPost;

beforeEach(() => {
  vi.useFakeTimers();
  state.posts = Array.from({ length: 12 }, (_, i) => post(i + 1));
  state.loading = false;
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('RecentBlogPosts carousel', () => {
  it('shows at most nine article cards with dots and opens a post', () => {
    const onNavigate = vi.fn();
    const { container } = render(<RecentBlogPosts onNavigate={onNavigate} variant="anacan" />);
    expect(container.querySelectorAll('.a-blog-card')).toHaveLength(9);
    expect(container.querySelectorAll('.a-blog-dots span')).toHaveLength(9);
    expect(screen.queryByText('Post 10')).toBeNull();
    fireEvent.click(screen.getByText('Post 2'));
    expect(onNavigate).toHaveBeenCalledWith('blog/post-2');
  });

  it('advances automatically and pauses after the user touches it', () => {
    const { container } = render(<RecentBlogPosts onNavigate={vi.fn()} variant="anacan" />);
    const rail = container.querySelector('.a-blog-rail') as HTMLElement;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(rail.scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.touchStart(rail);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(rail.scrollTo).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(rail.scrollTo).toHaveBeenCalledTimes(2);
  });
});
