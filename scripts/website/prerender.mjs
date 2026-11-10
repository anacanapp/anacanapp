import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {websiteRobots,sitemapIndex,SITEMAP_NAMESPACES,sitemapImages,coverImages} from './llm-policy.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const safeJson=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,character=>`\\u${character.charCodeAt(0).toString(16).padStart(4,'0')}`);
export function redirectsFor({routes,articles,prefix=''}) {
  const result=new Map();
  const add=(from,to)=>{if(from!==to)result.set(prefix+from,prefix+to);};
  const legacyPages={blog:'journal',contact:'contact',faq:'faq',privacy:'privacy',terms:'terms',app:'download',
    'ovulyasiya-kalkulyatoru':'ovulation','hamilelik-elamtleri':'symptoms','hamilelik-elametleri':'symptoms','ata-simulyatoru':'simulator'};
  const languages=Object.keys(routes.PAGE_SLUGS);
  add('/',routes.sitePath('az'));
  for(const code of languages){
    add('/'+code,routes.sitePath(code));
    for(const[kind,slug]of Object.entries(routes.PAGE_SLUGS[code])){
      const path=routes.sitePath(code,kind);add(path.slice(0,-1),path);add(decodeURIComponent(path.slice(0,-1)),path);
    }
    for(const[old,kind]of Object.entries(legacyPages)){
      const path=routes.sitePath(code,kind);
      for(const ending of ['','/']){add(`/${code}/${old}${ending}`,path);if(code==='az')add(`/${old}${ending}`,path);}
    }
    for(const ending of ['','/'])add(`/blog/${code}${ending}`,routes.sitePath(code,'journal'));
    for(const article of articles){
      if(!article.slugs[code])continue;
      const target=routes.sitePath(code,'article',article.slugs[code]);
      add(target.slice(0,-1),target);add(decodeURIComponent(target.slice(0,-1)),target);
      for(const slug of [article.legacySlug,article.slugs[code]])for(const ending of ['','/']){
        const segment=encodeURIComponent(slug);
        add(`/${code}/blog/${segment}${ending}`,target);add(`/blog/${code}/${segment}${ending}`,target);
        add(decodeURIComponent(`/${code}/blog/${segment}${ending}`),target);add(decodeURIComponent(`/blog/${code}/${segment}${ending}`),target);
        if(code==='az'){add(`/blog/${segment}${ending}`,target);add(decodeURIComponent(`/blog/${segment}${ending}`),target);}
      }
    }
  }
  return Object.fromEntries(result);
}
function xmlSitemap(entries,origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${SITEMAP_NAMESPACES}>\n${entries.map(entry=>`<url><loc>${escape(origin+entry.path)}</loc><lastmod>${entry.updated.slice(0,10)}</lastmod>${entry.alternates.map(item=>`<xhtml:link rel="alternate" hreflang="${item.code}" href="${escape(item.url)}"/>`).join('')}${sitemapImages(entry.images)}</url>`).join('\n')}\n</urlset>\n`;
}
/** Body font (Switzer 400) preloaded so it arrives with the stylesheet: its late swap moved the /en/ hero
 * (mobile CLS 0.11 -> 0.001). Only this one face: preloading all four (82 KB) delayed LCP by ~400 ms on slow 4G. */
export const FONT_PRELOADS=['/website/fonts/switzer-400.woff2'];
export function renderWebsiteHtml({shell,body,boot,meta,schema,preload=[],discovery=[]}) {
  const head=[];
  const setMeta=(key,value,property=false)=>head.push(`<meta ${property?'property':'name'}="${key}" content="${escape(value)}">`);
  setMeta('description',meta.description);setMeta('robots',boot.route.kind==='notFound'?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1');
  for(const[key,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.canonical,'og:type':boot.article?'article':'website','og:image':meta.image,'og:image:alt':meta.imageAlt,'og:site_name':'Anacan','og:locale':meta.locale,...(meta.imageSize?{'og:image:width':String(meta.imageSize[0]),'og:image:height':String(meta.imageSize[1])}:{})}))setMeta(key,value,true);
  for(const[key,value]of Object.entries({'twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt,'twitter:card':'summary_large_image'}))setMeta(key,value);
  if(boot.article){setMeta('article:published_time',boot.article.publishedAt,true);setMeta('article:modified_time',boot.article.updatedAt,true);}
  head.push(`<link rel="canonical" href="${escape(meta.canonical)}">`);
  if(boot.route.kind!=='notFound')for(const item of meta.alternates)head.push(`<link rel="alternate" hreflang="${item.code}" href="${escape(item.url)}">`);
  setMeta('apple-itunes-app','app-id=6758301924');
  for(const item of meta.alternates.filter(item=>item.code!=='x-default'&&item.code!==boot.route.language))setMeta('og:locale:alternate',item.locale.replace('-','_'),true);
  for(const item of discovery)head.push(`<link rel="${item.rel}" type="${item.type}" href="${escape(item.href)}" data-llm-discovery>`);
  for(const href of FONT_PRELOADS)head.push(`<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`);
  for(const href of preload)head.push(`<link rel="preload" as="image" href="${escape(href)}" fetchpriority="high">`);
  if(boot.route.kind!=='notFound')head.push(`<script type="application/ld+json" data-website-schema>${safeJson(schema)}</script>`);
  return shell.replace(/<html[^>]*>/,`<html lang="${boot.route.language}" dir="${boot.route.language==='ar'?'rtl':'ltr'}" class="anacan-public-website">`)
    .replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escape(meta.title)}</title>`)
    .replace('</head>',()=>head.join('\n')+'\n</head>')
    .replace(/<div id="root"><\/div>/,()=>`<div id="root">${body}</div>`)
    .replace('</body>',()=>`<script id="anacan-website-boot" type="application/json">${safeJson(boot)}</script>\n</body>`);
}
/** One canonical HTML document per real locale/slug. Google-derived JSON is a
 * public, read-only projection, not an independent database or auth realm. */
export function websitePrerenderPlugin({standalone=false,root,catalogDir=join(root,'scripts/website/catalog'),server}) {
  return {name:'anacan-website-prerender',apply:'build',enforce:'post',
    async generateBundle(_options,bundle){
      const mainKey=bundle['src/website/index.html']?'src/website/index.html':'index.html';
      const shell=bundle[mainKey]?.source;if(typeof shell!=='string')throw new Error('WEBSITE_SHELL_REQUIRED');
      const [{default:Website},routes,seo,{renderArticleContent},llm,discovery]=await Promise.all([server.ssrLoadModule('/src/website/Website.tsx'),server.ssrLoadModule('/src/website/routes.ts'),server.ssrLoadModule('/src/website/seo.ts'),server.ssrLoadModule('/src/website/article-content.ts'),server.ssrLoadModule('/src/website/llm-content.ts'),server.ssrLoadModule('/src/website/discovery.ts')]);
      const prefix=standalone?'':'/site',languages=Object.keys(routes.PAGE_SLUGS),staticEntries=[],articleEntries=[];
      let articleRoutes,postCount=0,pages=0,notFoundHtml='';
      const fullContent=[],manifestCatalogs=[],copies={},detailCopies={};
      for(const language of languages){
        const catalog=JSON.parse(await readFile(join(catalogDir,language+'.json'),'utf8'));
        const copy=JSON.parse(await readFile(join(root,'src/website/copy',language+'.json'),'utf8'));
        const details=JSON.parse(await readFile(join(root,'src/website/details',language+'.json'),'utf8'));
        copies[language]=copy;detailCopies[language]=details;
        catalog.articles=catalog.articles.map(article=>article.contentFormat==='anacan-article-html-v1'?article:{...article,...renderArticleContent(article.content||'',{footnotesLabel:copy.references})});
        if(catalog.schema!=='anacan-website-catalog-v1'||catalog.language!==language||catalog.articles.length<75||Object.keys(copy).length!==308)throw new Error('WEBSITE_CATALOG_OR_COPY_INCOMPLETE');
        if(!catalog.legal?.privacy?.content||!catalog.legal?.terms?.content)throw new Error('WEBSITE_LEGAL_REQUIRED');
        articleRoutes ||= catalog.articles;
        postCount=catalog.articles.length;
        const cards=catalog.articles.map(article=>({id:article.id,legacySlug:article.legacySlug,slugs:article.slugs,language,slug:article.slug,title:article.title,excerpt:article.excerpt,
          cover:article.cover,coverAlt:article.coverAlt,author:article.author,minutes:article.minutes,category:article.category,stages:article.stages,tags:article.tags,
          modules:article.modules,relatedIds:article.relatedIds,faq:[],references:[],headings:[],seoTitle:article.seoTitle,seoDescription:article.seoDescription,publishedAt:article.publishedAt,updatedAt:article.updatedAt}));
        const data={...catalog,articles:cards};
        manifestCatalogs.push(data);
        const localeDocuments=new Map(),localeEntries=[];
        this.emitFile({type:'asset',fileName:`website/data/${language}.json`,source:safeJson(data)});
        for(const article of catalog.articles)this.emitFile({type:'asset',fileName:`website/data/${language}/${article.slug}.json`,source:safeJson(article)});
        const pageRoutes=[{language,kind:'home'},...Object.keys(routes.PAGE_SLUGS[language]).map(kind=>({language,kind})),
          ...Array.from({length:Math.ceil(postCount/12)-1},(_,index)=>({language,kind:'journal',page:index+2})),
          ...catalog.articles.map(article=>({language,kind:'article',articleId:article.id,slug:article.slug})),{language,kind:'notFound'}];
        for(const route of pageRoutes){
          const article=route.kind==='article'?catalog.articles.find(item=>item.id===route.articleId):undefined;
          const visibleCards=route.kind==='journal'?cards:route.kind==='home'?cards.slice(0,3):(routes.DETAIL_PAGES||[]).includes(route.kind)?cards:article?[...cards].filter(item=>item.id!==article.id).sort((a,b)=>Number(article.relatedIds.includes(b.id))-Number(article.relatedIds.includes(a.id))||Number(b.category===article.category)-Number(a.category===article.category)).slice(0,3):[];
          const boot={schema:'anacan-website-boot-v1',route,copy,details,articles:visibleCards,article,basePath:prefix,generatedAt:catalog.generatedAt,
            legalContent:catalog.legal[route.kind]?.content,legalUpdated:catalog.legal[route.kind]?.updatedAt};
          const meta=seo.websiteMeta(boot),schema=seo.websiteSchema(boot),body=renderToString(createElement(Website,{boot}));
          const path=routes.routePath(route),html=renderWebsiteHtml({shell,body,boot,meta,schema,discovery:discovery.discoveryLinks(route),preload:route.kind==='home'?['/website/characters/tumurcuq-welcome.webp']:article?.cover?[article.cover]:[]});
          this.emitFile({type:'asset',fileName:decodeURIComponent(prefix+path).slice(1)+'index.html',source:html});pages++;
          if(route.kind==='notFound'&&language==='az')notFoundHtml=html;
          if(route.kind!=='notFound'){
            const markdown=route.kind==='journal'?llm.renderLlmJournal(data,copy,route.page):llm.renderLlmDocument(boot);
            this.emitFile({type:'asset',fileName:decodeURIComponent(prefix+discovery.markdownPath(route)).slice(1),source:markdown});
            if(route.kind!=='journal'||(route.page||1)===1)localeDocuments.set(article?'article:'+article.id:route.kind,markdown);
            const entry={path,updated:article?.updatedAt||catalog.generatedAt,alternates:meta.alternates,images:article?coverImages(article,routes.WEBSITE_ORIGIN):[]};
            localeEntries.push(entry);
            (article?articleEntries:staticEntries).push(entry);
          }
        }
        if(standalone){
          const localeFull=[llm.renderLlmFullHeader(language),...llm.LLM_PAGE_KINDS.map(kind=>'\n\n---\n\n'+localeDocuments.get(kind)),...catalog.articles.map(article=>'\n\n---\n\n'+localeDocuments.get('article:'+article.id))].join('');
          this.emitFile({type:'asset',fileName:`${language}/llms.txt`,source:llm.renderLlmIndex(data,copy,details)});
          this.emitFile({type:'asset',fileName:`${language}/llms-full.txt`,source:localeFull});
          this.emitFile({type:'asset',fileName:`sitemap-${language}.xml`,source:xmlSitemap(localeEntries,routes.WEBSITE_ORIGIN)});
          fullContent.push(localeFull);
        }
      }
      delete bundle[mainKey];
      const redirects=redirectsFor({routes,articles:articleRoutes,prefix});
      this.emitFile({type:'asset',fileName:standalone?'website-redirects.json':'site/website-redirects.json',source:safeJson({schema:'anacan-website-redirects-v1',redirects})});
      if(standalone){
        this.emitFile({type:'asset',fileName:'sitemap-pages.xml',source:xmlSitemap(staticEntries,routes.WEBSITE_ORIGIN)});
        this.emitFile({type:'asset',fileName:'sitemap-blog.xml',source:xmlSitemap(articleEntries,routes.WEBSITE_ORIGIN)});
        this.emitFile({type:'asset',fileName:'sitemap.xml',source:sitemapIndex(languages,routes.WEBSITE_ORIGIN)});
        this.emitFile({type:'asset',fileName:'robots.txt',source:websiteRobots(routes.WEBSITE_ORIGIN)});
        this.emitFile({type:'asset',fileName:'llms.txt',source:llm.renderLlmHub()});
        this.emitFile({type:'asset',fileName:'llms-full.txt',source:llm.renderLlmFullHeader()+fullContent.join('\n\n---\n\n')});
        this.emitFile({type:'asset',fileName:'llms-manifest.json',source:safeJson(llm.renderLlmManifest(manifestCatalogs,copies,detailCopies))});
        this.emitFile({type:'asset',fileName:'404.html',source:notFoundHtml});
      }
      this.emitFile({type:'asset',fileName:standalone?'website-release.json':'site/website-release.json',source:safeJson({schema:'anacan-website-release-v1',languages:languages.length,articles:postCount,pages,canonicalOrigin:routes.WEBSITE_ORIGIN,googleProject:'ninth-park-492111-m4',googleApiOrigin:'https://gcp.anacan.az',redirects:Object.keys(redirects).length,staticUrls:staticEntries.length,articleUrls:articleEntries.length})});
    },
  };
}
