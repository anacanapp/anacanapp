import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { APP_LANGUAGES, isAppLanguage, normalizeAppLanguage, type AppLanguageCode } from '@/lib/app-languages';
import { blogPath, blogCoverUrl, type BlogModule } from '@/lib/blog-editorial';
import { blogText } from '@/lib/blog-i18n';
import { copyBlogLink } from '@/lib/blog-links';
import { fetchPublicArticles } from './api';
import { updatePublicBlogHead } from './seo';
import type { PublicBlogArticle, PublicBlogBoot } from './model';
import BlogContent from '@/components/blog/BlogContent';
import { usePreparedBlogContent } from '@/components/blog/usePreparedBlogContent';
import '@/styles/public-blog.css';
import { entryDecision } from '@/web-entry/policy.mjs';

function readBoot(): PublicBlogBoot | null {
  try { const value = JSON.parse(document.getElementById('anacan-blog-boot')?.textContent || 'null'); return value?.language ? value : null; }
  catch { return null; }
}
function ArticleContent({ content }: { content: string }) {
  return <BlogContent content={content} className="public-blog-prose" />;
}
export default function BlogPage({ indexLanguage }: { indexLanguage?: AppLanguageCode } = {}) {
  const params = useParams(), location = useLocation(), navigate = useNavigate();
  const routeLanguage = indexLanguage || params.language;
  const language: AppLanguageCode = normalizeAppLanguage(routeLanguage || 'az');
  const slug = params.slug;
  const [boot] = useState(readBoot);
  const [article, setArticle] = useState<PublicBlogArticle | null>(() => boot?.language === language && boot.slug === slug ? boot.article || null : null);
  const [articles, setArticles] = useState<PublicBlogArticle[]>(() => boot?.language === language ? boot.articles || [] : []);
  const [loading, setLoading] = useState(!article && !!slug), [error, setError] = useState(false), [missing, setMissing] = useState(false);
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [stage, setStage] = useState('');
  const [shareStatus, setShareStatus] = useState(''), [attempt, setAttempt] = useState(0);
  const invalidLanguage = !!routeLanguage && !isAppLanguage(routeLanguage);
  useEffect(() => { document.documentElement.classList.add('anacan-public-blog'); return () => document.documentElement.classList.remove('anacan-public-blog'); }, []);
  useEffect(() => { if (!location.pathname.endsWith('/')) navigate(location.pathname + '/' + location.search, { replace: true }); }, [location.pathname, location.search, navigate]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(false); setMissing(invalidLanguage); setLoading(true); setShareStatus('');
    const initial = readBoot();
    setArticle(initial?.language === language && initial.slug === slug ? initial.article || null : null);
    if (initial?.language === language && initial.articles) setArticles(initial.articles); else setArticles([]);
    if (invalidLanguage) { setLoading(false); return; }
    void Promise.all([fetchPublicArticles(language, slug, controller.signal), slug ? fetchPublicArticles(language, undefined, controller.signal) : Promise.resolve(null)])
      .then(([values, catalog]) => {
        if (cancelled) return;
        if (slug) { setArticle(values[0] || null); setMissing(!values.length); if (catalog) setArticles(catalog); }
        else { setArticles(values); setArticle(null); }
      }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [language, slug, attempt, invalidLanguage]);
  useEffect(() => { updatePublicBlogHead(language, article, missing); }, [language, article, missing]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  const t = (key: Parameters<typeof blogText>[0]) => blogText(key, language);
  const moduleHref = (module: BlogModule) => `/?blog_module=${module}&blog_language=${language}`;
  const { headings } = usePreparedBlogContent(article?.content || '');
  const related = articles.filter(post => post.id !== article?.id).sort((left, right) =>
    Number(article?.relatedSlugs.includes(right.slug)) - Number(article?.relatedSlugs.includes(left.slug))).slice(0, 4);
  const effectiveQuery = query || new URLSearchParams(location.search).get('q') || '';
  const filtered = articles.filter(post => (!stage || post.lifeStages.includes(stage) || post.lifeStages.includes('all'))
    && (!category || post.category_slugs.includes(category))
    && `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLocaleLowerCase(language).includes(effectiveQuery.toLocaleLowerCase(language)));
  const share = async () => {
    const url = new URL(blogPath(slug, language), window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: article?.title || t('blog'), url });
      else { await copyBlogLink(url); setShareStatus(t('copied')); }
    } catch (error) { if ((error as Error)?.name !== 'AbortError') setShareStatus(t('error')); }
  };
  const adminPreview = entryDecision(window.location.href) === 'admin';
  const adminPath = (path: string) => {
    if (!adminPreview) return path;
    const url = new URL(path, window.location.origin); url.searchParams.set('web', 'admin'); return url.pathname + url.search;
  };
  return <div className="public-blog" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
    <a className="public-blog-skip" href="#blog-main">{t('articles')}</a>
    <header className="public-blog-header">
      <Link to={adminPath(blogPath(undefined, language))} className="public-blog-brand"><img src="/brand-mark.png" width="44" height="44" alt="" />Anacan</Link>
      <nav aria-label={t('blog')}><Link to={adminPath(blogPath(undefined, language))}>{t('blog')}</Link><a href="/">{t('openApp')}</a></nav>
      <label className="public-blog-language"><span className="public-blog-sr">{t('language')}</span>
        <select value={language} aria-label={t('language')} onChange={event => navigate(adminPath(blogPath(slug, event.target.value)))}>
          {APP_LANGUAGES.filter(item => !article || article.languages.includes(item.code)).map(item => <option value={item.code} key={item.code}>{item.native_name}</option>)}
        </select>
      </label>
    </header>
    <main id="blog-main" className="public-blog-main">
      {error && <div role="status" className="public-blog-status">{t('error')} <button onClick={() => setAttempt(value => value + 1)}>{t('retry')}</button></div>}
      {missing ? <section className="public-blog-status"><h1>{t('unavailable')}</h1><Link to={adminPath(blogPath(undefined, language))}>{t('back')}</Link></section>
        : slug && !article ? <p role="status">{loading ? t('articles') + '…' : t('unavailable')}</p>
        : article ? <>
          <nav className="public-blog-breadcrumb" aria-label={t('back')}><Link to={adminPath(blogPath(undefined, language))}>{t('back')}</Link><span aria-hidden="true"> / </span><span>{article.title}</span></nav>
          <article data-public-blog-article={article.slug}>
            <header className="public-blog-article-header">
              <p className="public-blog-eyebrow">{article.lifeStages.map(value => ['mommy','bump','flow'].includes(value) ? t(value as 'mommy' | 'bump' | 'flow') : '').filter(Boolean).join(' · ')}</p>
              <h1>{article.title}</h1><p className="public-blog-summary">{article.excerpt}</p>
              <div className="public-blog-meta"><span>{t('author')}</span><span>{t('readMinutes').replace('{count}', String(article.reading_time))}</span>
                <span>{t('updated')}: <time dateTime={article.updated_at}>{new Intl.DateTimeFormat(APP_LANGUAGES.find(item => item.code === language)!.locale, { dateStyle: 'medium' }).format(new Date(article.updated_at))}</time></span></div>
              <button className="public-blog-button" onClick={() => void share()}>{t('share')}</button><span role="status" className="public-blog-share-status">{shareStatus}</span>
            </header>
            {article.cover_image_url && <img className="public-blog-cover" src={blogCoverUrl(article.cover_image_url)} width="1200" height="630" alt={article.coverAlt} fetchPriority="high" />}
            <div className="public-blog-reader">
              <aside><nav className="public-blog-toc" aria-label={t('toc')}><h2>{t('toc')}</h2><ol>{headings.map(heading => <li key={heading.id}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol></nav></aside>
              <div>
                <ArticleContent content={article.content} />
                {!!article.faq.length && <section className="public-blog-section" data-public-blog-faq><h2>{t('faq')}</h2>
                  {article.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
                {!!article.modules.length && <section className="public-blog-section" data-public-blog-modules><h2>{t('modules')}</h2>
                  <div className="public-blog-tags">{article.modules.map(module => <a className="public-blog-button" key={module} href={moduleHref(module)}>{t(module)}</a>)}</div></section>}
                {!!article.references.length && <section className="public-blog-section" data-public-blog-references><h2>{t('references')}</h2>
                  <ul>{article.references.map(reference => <li key={reference.url}><a href={reference.url} rel="noopener noreferrer" target="_blank">{reference.title}</a></li>)}</ul></section>}
                <div className="public-blog-tags">{article.tags.map(tag => <Link key={tag} to={adminPath(`${blogPath(undefined, language)}?q=${encodeURIComponent(tag)}`)}>{tag}</Link>)}</div>
              </div>
            </div>
          </article>
          {!!related.length && <section className="public-blog-related"><h2>{t('related')}</h2><div className="public-blog-grid">{related.map(post => <ArticleCard key={post.id} article={post} language={language} />)}</div></section>}
        </> : <>
          <section className="public-blog-intro"><p className="public-blog-eyebrow">Anacan</p><h1>{t('blog')}</h1><p>{t('introduction')}</p></section>
          <div className="public-blog-filters">
            <input aria-label={t('search')} placeholder={t('search')} type="search" value={query || new URLSearchParams(location.search).get('q') || ''} onChange={event => { setQuery(event.target.value); if (location.search) navigate(adminPath(location.pathname), { replace: true }); }} />
            <select aria-label={t('categoryBaby')} value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">{t('all')}</option><option value="korpe-baximi">{t('categoryBaby')}</option><option value="qidalanma">{t('categoryFeeding')}</option><option value="hamiləlik">{t('categoryPregnancy')}</option>
            </select>
          </div>
          <div className="public-blog-tags public-blog-stage">{['','bump','mommy','flow'].map(value => <button className="public-blog-button" aria-pressed={stage === value} key={value} onClick={() => setStage(value)}>{value ? t(value as 'bump'|'mommy'|'flow') : t('all')}</button>)}</div>
          {!filtered.length && !loading && <p role="status">{t('noResults')}</p>}
          <div className="public-blog-grid">{filtered.map(post => <ArticleCard key={post.id} article={post} language={language} />)}</div>
        </>}
    </main>
    <footer className="public-blog-footer"><strong>Anacan</strong><Link to={adminPath(blogPath(undefined, language))}>{t('articles')}</Link><a href="/">{t('openApp')}</a></footer>
  </div>;
}
function ArticleCard({ article, language }: { article: PublicBlogArticle; language: AppLanguageCode }) {
  const query = entryDecision(window.location.href) === 'admin' ? '?web=admin' : '';
  return <article className="public-blog-card"><Link to={blogPath(article.slug, language) + query}>
    {article.cover_image_url && <img src={blogCoverUrl(article.cover_image_url)} alt={article.coverAlt} width="1200" height="630" loading="lazy" />}
    <div><h2>{article.title}</h2><p>{article.excerpt}</p><span>{blogText('readMinutes', language).replace('{count}', String(article.reading_time))}</span></div>
  </Link></article>;
}
