import {describe,it,expect} from 'vitest';
import {APP_LANGUAGES} from '../lib/app-languages';
import {PAGE_SLUGS,sitePath,resolveWebsiteRoute,localizedSlug} from './routes';
import articles from './article-routes.json';

describe('locale URLs and durable aliases',()=>{
  it('resolves every real translated route and preserves article identity across all 21 languages',()=>{
    for(const {code} of APP_LANGUAGES){
      expect(resolveWebsiteRoute(sitePath(code),articles).route).toMatchObject({language:code,kind:'home'});
      for(const kind of Object.keys(PAGE_SLUGS[code]))expect(resolveWebsiteRoute(sitePath(code,kind as keyof typeof PAGE_SLUGS.az),articles).route.kind).toBe(kind);
      for(const article of articles)expect(resolveWebsiteRoute(sitePath(code,'article',article.slugs[code]),articles).route).toMatchObject({articleId:article.id,language:code,kind:'article'});
    }
  });
  it('redirects both old blog structures directly to the same localized article',()=>{
    const article=articles[0];
    for(const {code} of APP_LANGUAGES){
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
