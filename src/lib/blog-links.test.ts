import { afterEach, expect, it, vi } from 'vitest';
import { appBlogSlug, blogLinks, clearPendingBlog, isWebsiteBlogLink, openAppBlog, OPEN_BLOG_EVENT, pendingBlog, rememberBlog } from './blog-links';
afterEach(() => { clearPendingBlog(); vi.useRealTimers(); });
it('keeps exact article identity and distinguishes the public website from the app', () => {
  const links = blogLinks('körpənin-yuxusu');
  expect(links.website).toBe('https://anacan.az/blog/k%C3%B6rp%C9%99nin-yuxusu');
  expect(appBlogSlug(links.website)).toBeNull(); expect(isWebsiteBlogLink(links.website)).toBe(true);
  expect(appBlogSlug(links.app)).toBe('körpənin-yuxusu'); expect(appBlogSlug('anacan://blog/k%C3%B6rp%C9%99nin-yuxusu')).toBe('körpənin-yuxusu');
});
it.each(['https://api.anacan.az.evil.com/blog/a','https://api.anacan.az@evil.com/blog/a','https://evil.com/?url=https://api.anacan.az/blog/a','https://api.anacan.az/blog/%2fadmin','javascript:alert(1)','https://api.anacan.az:444/blog/a','https://api.anacan.az/blog/%00'])('rejects unsafe or non-app destinations: %s', value => expect(appBlogSlug(value)).toBeNull());
it('dispatches the article event and retains an expiring cold-start/auth handoff', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
  const listener = vi.fn(); window.addEventListener(OPEN_BLOG_EVENT, listener);
  expect(openAppBlog(blogLinks('sleep-guide').app)).toBe(true); expect(pendingBlog()).toBe('sleep-guide'); expect(listener).toHaveBeenCalledOnce();
  window.removeEventListener(OPEN_BLOG_EVENT, listener); vi.advanceTimersByTime(86400001); expect(pendingBlog()).toBeNull();
  rememberBlog('../admin'); expect(pendingBlog()).toBeNull();
});
