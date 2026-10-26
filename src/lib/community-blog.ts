import { appBlogSlug, blogLinks, validBlogSlug } from './blog-links';
export interface SharedBlog { id: string; slug: string; title: string; excerpt: string | null; cover_image_url: string | null }
export function blogCommand(text: string, cursor = text.length) {
  const before = text.slice(0, cursor), match = /(?:^|\s)\/blog(?:[ \t]+([^\n]*))?$/i.exec(before);
  if (!match) return null;
  const start = match.index + (/^\s/.test(match[0]) ? 1 : 0);
  return { start, end: cursor, search: (match[1] || '').trim().slice(0, 200) };
}
export function validSharedBlog(value: any): value is SharedBlog {
  return value && typeof value.id === 'string' && /^[a-f0-9-]{36}$/i.test(value.id) && validBlogSlug(value.slug) && typeof value.title === 'string' && !!value.title.trim();
}
export function blogCardUrl(blog: SharedBlog) { return blogLinks(blog.slug).app; }
export function blogImageUrl(value: string | null | undefined) {
  try { const url = new URL(value || ''); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
