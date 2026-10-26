import { blogEditorial, blogLocale } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import { useUserStore } from '@/store/userStore';
import { openBlogModule } from '@/lib/blog-module-navigation';
import type { BlogPost } from '@/hooks/useBlog';
import { usePreparedBlogContent } from './usePreparedBlogContent';

export function BlogContents({ post }: { post: BlogPost }) {
  const language = useUserStore(state => state.language);
  const { headings } = usePreparedBlogContent(post.content);
  if (!headings.length) return null;
  return <nav className="a-card mt-3" aria-label={blogText('toc', language)} data-blog-toc>
    <h2 className="a-list-title mb-3">{blogText('toc', language)}</h2>
    <ol className="space-y-2 list-decimal ps-5">{headings.map(heading => <li key={heading.id}>
      <a href={`#${heading.id}`} className="text-sm underline text-primary" onClick={event => {
        event.preventDefault(); document.querySelector(`[data-blog-post="${post.id}"] [id="${heading.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}>{heading.title}</a>
    </li>)}</ol>
  </nav>;
}
export default function BlogEditorialSections({ post }: { post: BlogPost }) {
  const language = useUserStore(state => state.language), stage = useUserStore(state => state.lifeStage);
  const metadata = blogEditorial(post.editorial_metadata), locale = blogLocale(post.editorial_metadata, language);
  if (!metadata || !locale) return null;
  const modules = metadata.modules.filter(module => !['feeding','sleep','diaper'].includes(module) || stage === 'mommy');
  return <>
    {!!modules.length && <section className="a-card mt-3" data-blog-modules>
      <h2 className="a-list-title mb-3">{blogText('modules', language)}</h2>
      <div className="flex flex-wrap gap-2">{modules.map(module => <button key={module} className="a-tag" onClick={() => openBlogModule(module)}>{blogText(module, language)}</button>)}</div>
    </section>}
    {!!locale.faq.length && <section className="a-card mt-3" data-blog-faq>
      <h2 className="a-list-title mb-3">{blogText('faq', language)}</h2>
      {locale.faq.map(item => <details key={item.question} className="py-3 border-b last:border-0" style={{ borderColor: 'var(--a-line)' }}>
        <summary className="cursor-pointer font-semibold text-sm">{item.question}</summary>
        <p className="text-sm leading-relaxed mt-2">{item.answer}</p>
      </details>)}
    </section>}
    {!!locale.references?.length && <section className="a-card mt-3" data-blog-references>
      <h2 className="a-list-title mb-3">{blogText('references', language)}</h2>
      <ul className="space-y-2">{locale.references.map(reference => <li key={reference.url}><a className="text-sm underline text-primary" href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}</a></li>)}</ul>
    </section>}
  </>;
}
