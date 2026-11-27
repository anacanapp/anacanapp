/**
 * Technical SEO audit for the public website (docs/seo/TECHNICAL_SEO.md).
 * - Static pages (every language): title <= 60 and description 70-160 (display width), hard failure.
 * - CMS articles (scripts/website/catalog): measured and reported, never a build failure.
 *   `SEO_AUDIT_REPORT=1 npx vitest run src/website/seo-audit.test.ts` rewrites docs/seo/article-meta-audit.md.
 * - hreflang reciprocity, x-default and self canonical for every page kind and article.
 * - Tool pages (baby names az/ka, AZ dekret calculator) are included through toolSitemapEntries();
 *   name detail and letter pages are single-language by design (self + x-default only).
 */
import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {WEBSITE_LANGUAGES,type WebsiteLanguageCode} from '../lib/app-languages';
import {PAGE_SLUGS,SHOP_PAGES,resolveWebsiteRoute,routePath,WEBSITE_ORIGIN,type WebsiteRoute,type StaticPage} from './routes';
import {websiteMeta,websiteSchema,seoTextWidth,SEO_TITLE_MAX,SEO_DESCRIPTION_MIN,SEO_DESCRIPTION_MAX} from './seo';
import {findNews,isNewsLanguage,newsIn} from './news';
import './tools/tool-data-server';
import './calc-content/all';
import {toolSitemapEntries} from './tools/tool-routes';
import type {WebsiteArticle,WebsiteBoot,WebsiteCopy} from './model';

const root=join(__dirname,'../..');
const json=(path:string)=>JSON.parse(readFileSync(join(root,path),'utf8'));
const TITLE_MAX=SEO_TITLE_MAX,DESCRIPTION_MIN=SEO_DESCRIPTION_MIN,DESCRIPTION_MAX=SEO_DESCRIPTION_MAX;
/** Display width (East Asian wide characters count twice), see seoTextWidth in seo.ts. */
const length=seoTextWidth;
const languages=WEBSITE_LANGUAGES.map(item=>item.code) as WebsiteLanguageCode[];
const copies=Object.fromEntries(languages.map(code=>[code,json(`src/website/copy/${code}.json`)])) as Record<WebsiteLanguageCode,WebsiteCopy>;
const details=Object.fromEntries(languages.map(code=>[code,json(`src/website/details/${code}.json`)])) as Record<WebsiteLanguageCode,NonNullable<WebsiteBoot['details']>>;
/** Article cards without bodies: the catalog is ~22 MB, keep only what metadata needs. */
const catalogs=Object.fromEntries(languages.map(code=>{
  const data=json(`scripts/website/catalog/${code}.json`);
  return [code,{...data,articles:data.articles.map(({content:_content,...article}:WebsiteArticle)=>({...article,faq:article.faq||[],references:article.references||[],headings:[]}))}];
})) as Record<WebsiteLanguageCode,{generatedAt:string;articles:WebsiteArticle[]}>;
const routeTable=catalogs.az.articles;
const pageCount=(code:WebsiteLanguageCode)=>Math.ceil(catalogs[code].articles.length/12);

function boot(route:WebsiteRoute):WebsiteBoot {
  const data=catalogs[route.language],article=route.kind==='article'?data.articles.find(item=>item.id===route.articleId):undefined;
  return {schema:'anacan-website-boot-v1',route,copy:copies[route.language],details:details[route.language],articles:data.articles,article,generatedAt:data.generatedAt,basePath:''};
}
/** Tool pages exactly as the sitemaps publish them, resolved back to routes. */
function toolRoutes(code:WebsiteLanguageCode):WebsiteRoute[] {
  return toolSitemapEntries().filter(entry=>entry.language===code).map(entry=>{
    const resolved=resolveWebsiteRoute(decodeURIComponent(entry.path),catalogs[code].articles);
    expect(resolved.redirect,entry.path).toBeUndefined();expect(resolved.route.kind,entry.path).not.toBe('notFound');
    return resolved.route;
  });
}
/** Every indexable non-article route, as the SSR server and prerender publish them. */
function staticRoutes(code:WebsiteLanguageCode):WebsiteRoute[] {
  const routes:WebsiteRoute[]=[{language:code,kind:'home'},...(Object.keys(PAGE_SLUGS[code]) as StaticPage[]).map(kind=>({language:code,kind,page:1}))];
  for(let page=2;page<=pageCount(code);page++)routes.push({language:code,kind:'journal',page});
  if(code==='az')routes.push(...SHOP_PAGES.map(kind=>({language:code,kind})));
  if(isNewsLanguage(code))routes.push({language:code,kind:'news'},...newsIn(code).map(item=>({language:code,kind:'newsArticle' as const,slug:item.slug})));
  routes.push(...toolRoutes(code));
  return routes;
}
const newsItemId=(route:WebsiteRoute)=>isNewsLanguage(route.language)?findNews(route.slug,route.language)?.id:undefined;
const articleRoutes=(code:WebsiteLanguageCode):WebsiteRoute[]=>catalogs[code].articles.map(article=>({language:code,kind:'article',articleId:article.id,slug:article.slug}));
const label=(route:WebsiteRoute)=>`${route.language} ${route.kind}${route.page&&route.page>1?' p'+route.page:''}${route.slug?' '+route.slug:''}`;
/** Resolve a published absolute URL back to a route the same way the server does. */
function resolveUrl(url:string) {
  expect(url.startsWith(WEBSITE_ORIGIN+'/')).toBe(true);
  const path=new URL(url).pathname,language=path.split('/')[1] as WebsiteLanguageCode;
  const resolved=resolveWebsiteRoute(path,catalogs[language]?.articles||routeTable);
  return resolved;
}

describe('static page metadata lengths',()=>{
  it(`keeps every static page title <= ${TITLE_MAX} and description ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters in all languages`,()=>{
    const failures:string[]=[];
    for(const code of languages)for(const route of staticRoutes(code)){
      const meta=websiteMeta(boot(route));
      if(length(meta.title)>TITLE_MAX)failures.push(`${label(route)} title ${length(meta.title)}: ${meta.title}`);
      const size=length(meta.description);
      if(size<DESCRIPTION_MIN||size>DESCRIPTION_MAX)failures.push(`${label(route)} description ${size}: ${meta.description}`);
    }
    expect(failures).toEqual([]);
  });
  it('gives journal page 2+ its own title and description',()=>{
    for(const code of languages){
      const seen=new Set<string>();
      for(let page=1;page<=pageCount(code);page++){
        const meta=websiteMeta(boot({language:code,kind:'journal',page}));
        expect(seen.has(meta.title)||seen.has(meta.description)).toBe(false);seen.add(meta.title);seen.add(meta.description);
        if(page>1)expect(meta.title).toContain(String(page));
      }
    }
  });
});

describe('article metadata audit (report only)',()=>{
  it('measures CMS article titles and descriptions without failing the build',()=>{
    const rows:string[]=[],summary:string[]=[];let total=0,flagged=0;
    for(const code of languages){
      let longTitles=0,shortDescriptions=0,longDescriptions=0;const local:string[]=[];
      for(const route of articleRoutes(code)){
        const meta=websiteMeta(boot(route)),title=length(meta.title),description=length(meta.description);total++;
        const problems=[title>TITLE_MAX&&`title ${title}`,description<DESCRIPTION_MIN&&`description ${description} (short)`,description>DESCRIPTION_MAX&&`description ${description} (long)`].filter(Boolean);
        if(title>TITLE_MAX)longTitles++;if(description<DESCRIPTION_MIN)shortDescriptions++;if(description>DESCRIPTION_MAX)longDescriptions++;
        if(problems.length){flagged++;local.push(`| ${route.slug} | ${problems.join(', ')} | ${meta.title.replace(/\|/g,'\\|')} |`);}
      }
      summary.push(`| ${code} | ${catalogs[code].articles.length} | ${longTitles} | ${shortDescriptions} | ${longDescriptions} | ${local.length} |`);
      if(local.length)rows.push(`\n## ${code}\n\n| Slug | Problem | Rendered title |\n|---|---|---|\n${local.join('\n')}`);
    }
    expect(total).toBeGreaterThan(0);
    if(process.env.SEO_AUDIT_REPORT==='1'){
      mkdirSync(join(root,'docs/seo'),{recursive:true});
      writeFileSync(join(root,'docs/seo/article-meta-audit.md'),`# Article meta audit\n\nGenerated by \`SEO_AUDIT_REPORT=1 npx vitest run src/website/seo-audit.test.ts\` from \`scripts/website/catalog/*.json\`
(catalog generatedAt ${catalogs.az.generatedAt}). Rendered title = \`seoTitle\` plus \` | Anacan\` when the brand is missing
(title limit ${TITLE_MAX}); description = \`seoDescription\` (range ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}). Width counts East Asian wide characters (Han, Kana, Hangul) as two.
Fix these in the CMS (\`editorial_metadata.locales.<lang>.seoTitle/seoDescription\`), not in code.

${flagged} of ${total} article language versions are out of range.

| Language | Articles | Title > ${TITLE_MAX} | Description < ${DESCRIPTION_MIN} | Description > ${DESCRIPTION_MAX} | Flagged |
|---|---|---|---|---|---|
${summary.join('\n')}
${rows.join('\n')}
`);
    }
  });
});

describe('canonical and hreflang',()=>{
  const all=()=>languages.flatMap(code=>[...staticRoutes(code),...articleRoutes(code)]);
  it('uses a self canonical: absolute https://anacan.az URL with a trailing slash',{timeout:60000},()=>{
    for(const route of all()){
      const meta=websiteMeta(boot(route));
      expect(meta.canonical,label(route)).toBe(WEBSITE_ORIGIN+routePath(route));
      expect(meta.canonical).toMatch(/^https:\/\/anacan\.az\/.*\/$/);
      const resolved=resolveUrl(meta.canonical);
      expect(resolved.redirect,label(route)).toBeUndefined();
      expect(resolved.route).toMatchObject({kind:route.kind,language:route.language});
    }
  });
  it('lists reciprocal alternates that resolve to the same page and an x-default',{timeout:180000},()=>{
    const metas=all().map(route=>({route,meta:websiteMeta(boot(route))}));
    const clusters=new Map(metas.map(({meta})=>[meta.canonical,meta.alternates.map(item=>item.url).sort().join(' ')]));
    for(const {route,meta} of metas){
      const self=meta.canonical;
      const xDefault=meta.alternates.filter(item=>(item.code as string)==='x-default');
      expect(xDefault,label(route)).toHaveLength(1);
      expect(meta.alternates.some(item=>item.code===route.language&&item.url===self),label(route)).toBe(true);
      expect(new Set(meta.alternates.map(item=>item.code)).size).toBe(meta.alternates.length);
      for(const alternate of meta.alternates){
        const resolved=resolveUrl(alternate.url),target=resolved.route;
        expect(resolved.redirect,`${label(route)} -> ${alternate.url}`).toBeUndefined();
        expect(target.kind,`${label(route)} -> ${alternate.url}`).toBe(route.kind);
        if(route.kind==='article')expect(target.articleId).toBe(route.articleId);
        if(route.kind==='journal'){expect(target.page||1).toBe(route.page||1);expect(target.page||1).toBeLessThanOrEqual(pageCount(target.language));}
        if(['namesGender','namesLetter','nameDetail'].includes(route.kind))expect(target.slug).toBe(route.slug);
        // News slugs are localized: the alternate must be the same item (same Azerbaijani id).
        if(route.kind==='newsArticle')expect(newsItemId(target)).toBe(newsItemId(route));
        if(route.kind==='article')expect(catalogs[target.language].articles.some(item=>item.id===route.articleId)).toBe(true);
        if((alternate.code as string)==='x-default')continue;
        expect(target.language).toBe(alternate.code);
        // The alternate is itself a published page listing exactly the same alternates (reciprocal cluster).
        expect(clusters.get(alternate.url),`${label(route)} and ${alternate.code}`).toBe(clusters.get(self));
      }
    }
  });
});

describe('tool pages',()=>{
  it('covers names (az, ka) and the dekret calculator; name details and letters stay single-language',()=>{
    const kinds=new Set(languages.flatMap(code=>toolRoutes(code).map(route=>`${route.language} ${route.kind}`)));
    for(const item of ['az names','ka names','az namesGender','ka namesGender','az nameDetail','ka nameDetail','az maternityBenefit'])expect(kinds.has(item),item).toBe(true);
    for(const code of ['az','ka'] as WebsiteLanguageCode[])for(const route of toolRoutes(code).filter(item=>item.kind==='nameDetail'||item.kind==='namesLetter')){
      const meta=websiteMeta(boot(route));
      expect(meta.alternates.map(item=>item.code).sort(),label(route)).toEqual([code,'x-default'].sort());
      expect(meta.alternates.every(item=>item.url===meta.canonical),label(route)).toBe(true);
    }
  });
});

describe('structured data',()=>{
  it('describes the organization with real profiles and founders',()=>{
    const graph=websiteSchema(boot({language:'az',kind:'home'}))['@graph'] as Array<Record<string,unknown>>;
    const organization=graph.find(item=>item['@type']==='Organization')!;
    expect(organization).toMatchObject({foundingDate:'2026-03-01',address:{'@type':'PostalAddress',addressCountry:'AZ'}});
    expect((organization.founder as Array<{name:string}>).map(item=>item.name)).toEqual(['Türkan Sultanlı','Camil Sultanlı']);
    expect(organization.sameAs).toEqual(expect.arrayContaining(['https://apps.apple.com/us/app/anacan/id6758301924','https://play.google.com/store/apps/details?id=com.atlasoon.anacan']));
  });
  it('marks articles as BlogPosting with language, modified date, sized image, keywords and the website',()=>{
    for(const code of languages){
      const route=articleRoutes(code)[0],graph=websiteSchema(boot(route))['@graph'] as Array<Record<string,unknown>>;
      const post=graph.find(item=>item['@type']==='BlogPosting')!;
      expect(post).toMatchObject({inLanguage:code,isPartOf:{'@id':WEBSITE_ORIGIN+'/#website'},image:{width:expect.any(Number),height:expect.any(Number)}});
      expect(post.dateModified).toBeTruthy();expect(post.datePublished).toBeTruthy();
      expect(post).not.toHaveProperty('reviewedBy');
    }
  });
});

describe('news (az, en)',()=>{
  const graphOf=(route:WebsiteRoute)=>websiteSchema(boot(route))['@graph'] as Array<Record<string,unknown>>;
  it('marks English news as NewsArticle in English with English breadcrumbs and the cover as og:image',()=>{
    for(const item of newsIn('en')){
      const route:WebsiteRoute={language:'en',kind:'newsArticle',slug:item.slug},meta=websiteMeta(boot(route)),graph=graphOf(route);
      expect(graph.find(node=>node['@type']==='NewsArticle')).toMatchObject({inLanguage:'en',headline:item.title,datePublished:item.date});
      const crumbs=(graph.find(node=>node['@type']==='BreadcrumbList')!.itemListElement as Array<{name:string;item:string}>);
      expect(crumbs.slice(0,2).map(crumb=>crumb.name)).toEqual(['Home','News']);
      expect(crumbs[1].item).toBe(WEBSITE_ORIGIN+'/en/news/');
      expect(meta.image).toBe(WEBSITE_ORIGIN+item.cover.src);
      expect(meta.alternates.map(alternate=>alternate.code).sort()).toEqual(['az','en','x-default']);
      expect(meta.alternates.find(alternate=>(alternate.code as string)==='x-default')!.url).toBe(WEBSITE_ORIGIN+`/az/xeberler/${item.id}/`);
    }
  });
  it('lists only English items on /en/news/ (CollectionPage + ItemList) and keeps the books item az-only',()=>{
    const graph=graphOf({language:'en',kind:'news'});
    expect(graph.find(node=>node['@id']===WEBSITE_ORIGIN+'/en/news/#webpage')).toMatchObject({'@type':'CollectionPage',inLanguage:'en'});
    const list=graph.find(node=>node['@type']==='ItemList')!.itemListElement as Array<{url:string}>;
    expect(list.map(entry=>entry.url)).toEqual(newsIn('en').map(item=>WEBSITE_ORIGIN+`/en/news/${item.slug}/`));
    const books=websiteMeta(boot({language:'az',kind:'newsArticle',slug:'usaqlar-ucun-pdf-cap-kitablari-70-kitab-evde-cap'}));
    expect(books.alternates.map(alternate=>alternate.code).sort()).toEqual(['az','x-default']);
  });
  it('publishes news sitemap rows with matching alternates',async()=>{
    const {newsSitemapEntries}=await import('./routes');
    const rows=newsSitemapEntries();
    expect(rows.filter(row=>row.language==='en')).toHaveLength(newsIn('en').length+1);
    for(const row of rows){
      const meta=websiteMeta(boot(resolveWebsiteRoute(row.path).route));
      expect(row.alternates.map(link=>WEBSITE_ORIGIN+link.path).sort()).toEqual(meta.alternates.map(link=>link.url).sort());
    }
  });
});

describe('robots and sitemaps',()=>{
  it('allows search crawlers, keeps public pages crawlable and points to the sitemap index',async()=>{
    const {websiteRobots,sitemapIndex}=await import('../../scripts/website/llm-policy.mjs');
    const robots=websiteRobots() as string;
    expect(robots).toMatch(/^User-agent: \*$/m);expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^User-agent: (?:Googlebot|Bingbot|Yandex)/mi);
    expect(robots).toContain('Sitemap: https://anacan.az/sitemap.xml');
    const blocked=[...robots.matchAll(/^Disallow: (.+)$/gm)].map(match=>match[1]);
    for(const code of languages)for(const route of [...staticRoutes(code),...articleRoutes(code).slice(0,1)])expect(blocked.some(prefix=>routePath(route).startsWith(prefix)),label(route)).toBe(false);
    for(const asset of ['/blog-covers/a.webp','/website/images/a.webp','/website/og-cover.jpg','/assets/a.js','/website/fonts/a.woff2'])expect(blocked.some(prefix=>asset.startsWith(prefix))).toBe(false);
    const index=sitemapIndex(languages) as string;
    for(const code of [...languages,'pages','blog'])expect(index).toContain(`<loc>https://anacan.az/sitemap-${code}.xml</loc>`);
  });
  it('adds image:image entries with the image namespace to article sitemap entries',async()=>{
    const {sitemapEntries,coverImages}=await import('../../scripts/website/llm-policy.mjs');
    const article=catalogs.en.articles[0],url=WEBSITE_ORIGIN+routePath(articleRoutes('en')[0]);
    const xml=sitemapEntries([{url,updatedAt:article.updatedAt,alternates:[{code:'en',url}],images:coverImages(article)}]) as string;
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain(`<image:image><image:loc>${WEBSITE_ORIGIN}${article.cover}</image:loc><image:title>`);
    expect(coverImages({cover:'https://gcp.anacan.az/storage/v1/object/public/images/a.webp',title:'A'})).toEqual([{url:'https://gcp.anacan.az/storage/v1/object/public/images/a.webp',title:'A'}]);
    expect(coverImages({cover:null,title:'A'})).toEqual([]);
  });
});
