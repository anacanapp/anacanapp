import { useEffect } from 'react';
import { useUserStore } from '@/store/userStore';
import { blogLocale, blogPath, BLOG_CANONICAL_ORIGIN } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import type { BlogPost } from '@/hooks/useBlog';

/** In-app/overlay readers receive the same article metadata as the public,
 * prerendered route. Restore the surrounding page's head on close. */
export default function BlogSeo({ post }: { post?: BlogPost }) {
  const language = useUserStore(state => state.language);
  useEffect(() => {
    const locale = blogLocale(post?.editorial_metadata, language);
    const title = locale?.seoTitle || post?.title || blogText('seoTitle', language);
    const description = locale?.seoDescription || post?.excerpt || blogText('seoDescription', language);
    const url = BLOG_CANONICAL_ORIGIN + blogPath(post?.slug, language);
    const previousTitle = document.title;
    const cleanups: Array<() => void> = [];
    document.title = `${title} | Anacan`;
    for (const [attribute, key, value] of [
      ['name','description',description], ['property','og:title',title], ['property','og:description',description],
      ['property','og:url',url], ['property','og:type',post ? 'article' : 'website'],
      ['name','twitter:title',title], ['name','twitter:description',description],
    ]) {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const element = existing || document.createElement('meta'), previous = existing?.getAttribute('content');
      element.setAttribute(attribute, key); element.content = value;
      if (!existing) document.head.append(element);
      cleanups.push(() => { if (!existing) element.remove(); else if (previous !== null && previous !== undefined) element.content = previous; });
    }
    const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const canonical = existing || document.createElement('link'), previous = existing?.href;
    canonical.rel = 'canonical'; canonical.href = url;
    if (!existing) document.head.append(canonical);
    cleanups.push(() => { if (!existing) canonical.remove(); else if (previous) canonical.href = previous; });
    return () => { document.title = previousTitle; cleanups.reverse().forEach(cleanup => cleanup()); };
  }, [post, language]);
  return null;
}
