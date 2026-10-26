import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HtmlContentProps {
  content: string;
  className?: string;
}

const HtmlContent = ({ content, className }: HtmlContentProps) => {
  const isHtml = content.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(content);

  // Sanitize HTML to prevent XSS attacks. Strips <script>, <iframe>,
  // event handlers (on*), and javascript: URIs while keeping safe formatting.
  const sanitized = useMemo(() => {
    if (!isHtml) return '';
    return DOMPurify.sanitize(content, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
      ALLOW_DATA_ATTR: false,
    });
  }, [content, isHtml]);

  if (isHtml) {
    return (
      <div 
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          // Rich text editor output styling
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3',
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2',
          '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
          '[&_p]:my-2 [&_p]:leading-relaxed',
          '[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:my-3 [&_ul]:space-y-1',
          '[&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:my-3 [&_ol]:space-y-1',
          '[&_li]:text-sm [&_li]:leading-relaxed',
          '[&_blockquote]:border-s-4 [&_blockquote]:border-primary/50 [&_blockquote]:ps-4 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
          '[&_a]:text-primary [&_a]:underline [&_a]:hover:no-underline',
          '[&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full',
          '[&_strong]:font-semibold',
          '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono',
          '[&_hr]:my-6 [&_hr]:border-border',
          // Table styles
          '[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse',
          '[&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden',
          '[&_thead]:bg-muted/70',
          '[&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs [&_th]:border-b [&_th]:border-border',
          '[&_td]:px-3 [&_td]:py-2 [&_td]:text-muted-foreground [&_td]:text-xs [&_td]:border-b [&_td]:border-border',
          '[&_tr:last-child_td]:border-b-0',
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap', className)}>
      {content}
    </div>
  );
};

export default HtmlContent;
