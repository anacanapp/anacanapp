import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { prepareBlogContent } from '@/lib/blog-content.mjs';
import '@/styles/blog-content.css';

export default function BlogContent({ content, className = '', prepared = false }: { content: string; className?: string; prepared?: boolean }) {
  // `prepared` is supplied only by the website's sanitized SSR/browser renderer.
  const html = useMemo(() => {
    if (prepared) return content;
    if (typeof document === 'undefined') throw new Error('BLOG_SERVER_FORMATTER_REQUIRED');
    return prepareBlogContent(content, { document, sanitize: (html, options) => DOMPurify.sanitize(html, options) }).content;
  }, [content, prepared]);
  return <div className={`blog-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
