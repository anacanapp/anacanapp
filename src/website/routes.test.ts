import {describe,it,expect} from 'vitest';
import {WEBSITE_LANGUAGES} from '../lib/app-languages';
import {PAGE_SLUGS,sitePath,resolveWebsiteRoute,localizedSlug} from './routes';
import articles from './article-routes.json';

describe('locale URLs and durable aliases',()=>{
  it('resolves every real translated route and preserves article identity across all 21 languages',()=>{
    for(const {code} of WEBSITE_LANGUAGES){
      expect(resolveWebsiteRoute(sitePath(code),articles).route).toMatchObject({language:code,kind:'home'});
      for(const kind of Object.keys(PAGE_SLUGS[code]))expect(resolveWebsiteRoute(sitePath(code,kind as keyof typeof PAGE_SLUGS.az),articles).route.kind).toBe(kind);
      for(const article of articles)expect(resolveWebsiteRoute(sitePath(code,'article',article.slugs[code]),articles).route).toMatchObject({articleId:article.id,language:code,kind:'article'});
    }
  });
  it('redirects both old blog structures directly to the same localized article',()=>{
    const article=articles[0];
    for(const {code} of WEBSITE_LANGUAGES){
      const target=sitePath(code,'article',article.slugs[code]);
      expect(resolveWebsiteRoute(`/blog/${code}/${article.legacySlug}`,articles).redirect).toBe(target);
      expect(resolveWebsiteRoute(`/${code}/blog/${article.legacySlug}`,articles).redirect).toBe(target);
    }
    expect(resolveWebsiteRoute('/ovulyasiya-kalkulyatoru').redirect).toBe('/az/ovulyasiya-kalkulyatoru/');
    expect(resolveWebsiteRoute('/hamilelik-elamtleri').redirect).toBe('/az/hamilelik-elametleri/');
  });
  it('handles encoded non-Latin slugs, pagination and malformed paths without fallback content',()=>{
    expect(resolveWebsiteRoute('/en/journal/2/',articles).route).toMatchObject({kind:'journal',page:2});
    expect(resolveWebsiteRoute('/xx/anything',articles).route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/en/%E0%A4',articles).route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/site/ru/'+encodeURIComponent(articles[0].slugs.ru)+'/',articles).route.articleId).toBe(articles[0].id);
    expect(localizedSlug('Körpənin qayğısı: Əmizdirmə')).toBe('korpenin-qaygisi-emizdirme');
  });
});

describe('shop pages (Azerbaijani only)', () => {
  it('resolves /az/kitablar/ and /az/tortlar/ and redirects without a trailing slash', async () => {
    const { resolveWebsiteRoute, sitePath, alternateRoute } = await import('./routes');
    expect(resolveWebsiteRoute('/az/kitablar/').route.kind).toBe('books');
    expect(resolveWebsiteRoute('/az/tortlar/').route.kind).toBe('cakes');
    expect(resolveWebsiteRoute('/az/tortlar').redirect).toBe('/az/tortlar/');
    expect(resolveWebsiteRoute('/en/kitablar/').route.kind).toBe('notFound');
    expect(sitePath('az', 'books')).toBe('/az/kitablar/');
    expect(alternateRoute({ language: 'az', kind: 'cakes' }, 'en')).toBeUndefined();
  });
});

describe('news pages (English)', () => {
  const BOOKS = 'usaqlar-ucun-pdf-cap-kitablari-70-kitab-evde-cap';
  it('resolves /en/news/ and every English detail page, with az <-> en alternates', async () => {
    const { resolveWebsiteRoute, sitePath, alternateRoute } = await import('./routes');
    const { NEWS, newsIn } = await import('./news');
    expect(resolveWebsiteRoute('/en/news/').route).toMatchObject({ language: 'en', kind: 'news' });
    expect(resolveWebsiteRoute('/en/news/').redirect).toBeUndefined();
    expect(resolveWebsiteRoute('/en/news').redirect).toBe('/en/news/');
    expect(sitePath('en', 'news')).toBe('/en/news/');
    expect(alternateRoute({ language: 'az', kind: 'news' }, 'en')).toBe('/en/news/');
    expect(alternateRoute({ language: 'en', kind: 'news' }, 'az')).toBe('/az/xeberler/');
    expect(alternateRoute({ language: 'en', kind: 'news' }, 'ru')).toBeUndefined();
    const english = newsIn('en');
    expect(english.length).toBe(NEWS.length - 1);
    for (const item of english) {
      const path = `/en/news/${item.slug}/`;
      expect(sitePath('en', 'newsArticle', item.slug)).toBe(path);
      expect(resolveWebsiteRoute(path).route).toMatchObject({ language: 'en', kind: 'newsArticle', slug: item.slug });
      expect(resolveWebsiteRoute(path.slice(0, -1)).redirect).toBe(path);
      expect(alternateRoute({ language: 'en', kind: 'newsArticle', slug: item.slug }, 'az')).toBe(`/az/xeberler/${item.id}/`);
      expect(alternateRoute({ language: 'az', kind: 'newsArticle', slug: item.id }, 'en')).toBe(path);
      expect(alternateRoute({ language: 'en', kind: 'newsArticle', slug: item.slug }, 'de')).toBeUndefined();
      // The Azerbaijani slug is not an English URL.
      expect(resolveWebsiteRoute(`/en/news/${item.id}/`).route.kind).toBe('notFound');
    }
  });
  it('keeps the PDF books item Azerbaijani-only', async () => {
    const { resolveWebsiteRoute, alternateRoute } = await import('./routes');
    const { NEWS, newsIn } = await import('./news');
    const books = NEWS.find((item) => item.slug === BOOKS)!;
    expect(books).toBeTruthy();
    expect(books.en).toBeUndefined();
    expect(newsIn('en').some((item) => item.id === BOOKS)).toBe(false);
    expect(resolveWebsiteRoute(`/en/news/${BOOKS}/`).route.kind).toBe('notFound');
    expect(alternateRoute({ language: 'az', kind: 'newsArticle', slug: BOOKS }, 'en')).toBeUndefined();
    expect(alternateRoute({ language: 'az', kind: 'newsArticle', slug: BOOKS }, 'az')).toBe(`/az/xeberler/${BOOKS}/`);
  });
  it('keeps English data well formed: unique ASCII slugs, newest first, partner names, no long dashes', async () => {
    const { NEWS, newsIn } = await import('./news');
    const english = newsIn('en');
    const slugs = english.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (let i = 1; i < english.length; i++) expect(english[i - 1].date >= english[i].date).toBe(true);
    for (const item of NEWS) if (item.en) {
      expect(JSON.stringify(item.en)).not.toMatch(/[—–<>]/);
      expect(item.en.body.length).toBe(item.body.length);
      expect(item.en.body.map((block) => block.type)).toEqual(item.body.map((block) => block.type));
      if (item.source) expect(item.en.sourceLabel).toBeTruthy();
      if (!item.partner) expect(item.en.coverSub).toBeTruthy();
    }
    const tech = english.find((item) => item.partner === 'thetech')!;
    expect(tech.source?.href).toMatch(/^https:\/\/the-tech\.kz\//);
    const text = JSON.stringify(english);
    for (const name of ['Microsoft for Startups', 'Google for Startups Cloud Program', 'AWS Activate', 'NVIDIA Inception', 'Anthropic for Startups', 'Inmerge Innovation Summit', 'The Tech'])
      expect(text).toContain(name);
    expect(text).toContain('(Türkan Sultanlı, co-founder and CEO of Anacan)');
  });
  it('uses a localized cover only for art covers with text', async () => {
    const { NEWS, newsCover } = await import('./news');
    for (const item of NEWS) if (item.en) {
      const cover = newsCover(item, 'en');
      expect(cover.src).toBe(item.partner ? `/website/news/${item.slug}.jpg` : `/website/news/en/${item.en.slug}.jpg`);
    }
  });
});

describe('news pages (Azerbaijani)', () => {
  it('resolves the list and detail pages, redirects without a trailing slash and keeps the az URLs', async () => {
    const { resolveWebsiteRoute, sitePath, alternateRoute } = await import('./routes');
    const { NEWS } = await import('./news');
    const slug = NEWS[0].slug;
    expect(resolveWebsiteRoute('/az/xeberler/').route).toMatchObject({ language: 'az', kind: 'news' });
    expect(resolveWebsiteRoute('/az/xeberler/').redirect).toBeUndefined();
    expect(resolveWebsiteRoute('/az/xeberler').redirect).toBe('/az/xeberler/');
    expect(resolveWebsiteRoute(`/az/xeberler/${slug}/`).route).toMatchObject({ language: 'az', kind: 'newsArticle', slug });
    expect(resolveWebsiteRoute(`/az/xeberler/${slug}`).redirect).toBe(`/az/xeberler/${slug}/`);
    expect(sitePath('az', 'news')).toBe('/az/xeberler/');
    expect(sitePath('az', 'newsArticle', slug)).toBe(`/az/xeberler/${slug}/`);
    expect(alternateRoute({ language: 'az', kind: 'news' }, 'ru')).toBeUndefined();
    expect(alternateRoute({ language: 'az', kind: 'newsArticle', slug }, 'az')).toBe(`/az/xeberler/${slug}/`);
  });
  it('answers notFound for other languages and unknown slugs', async () => {
    const { resolveWebsiteRoute } = await import('./routes');
    const { NEWS } = await import('./news');
    expect(resolveWebsiteRoute('/en/xeberler/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute(`/ru/xeberler/${NEWS[0].slug}/`).route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/ru/news/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute(`/de/news/${NEWS[0].en!.slug}/`).route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/news/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/xeberler/x/').route.kind).toBe('notFound');
    expect(resolveWebsiteRoute('/az/xeberler/x').redirect).toBeUndefined();
    expect(resolveWebsiteRoute(`/az/xeberler/${NEWS[0].slug}/extra/`).route.kind).toBe('notFound');
  });
  it('keeps news data well formed: unique slugs, newest first, plain text without long dashes', async () => {
    const { NEWS } = await import('./news');
    const { validWebsiteSlug } = await import('./routes');
    expect(new Set(NEWS.map((item) => item.slug)).size).toBe(NEWS.length);
    for (let i = 1; i < NEWS.length; i++) expect(NEWS[i - 1].date >= NEWS[i].date).toBe(true);
    for (const item of NEWS) {
      expect(validWebsiteSlug(item.slug) && /^[a-z0-9-]+$/.test(item.slug)).toBe(true);
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const text = JSON.stringify(item);
      expect(text).not.toMatch(/[—–<>]/);
    }
  });
});
