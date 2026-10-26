import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { prepareBlogContent } from '@/lib/blog-content.mjs';

export function usePreparedBlogContent(content: string) {
  return useMemo(() => prepareBlogContent(content, {
    document, sanitize: (html, options) => DOMPurify.sanitize(html, options),
  }), [content]);
}
