import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { prepareBlogContent } from '../../src/lib/blog-content.mjs';
import copy from '../i18n/blog-editorial-copy.json' with { type: 'json' };

export const CANONICAL = 'https://app.anacan.az';
export const languages = Object.keys(copy);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const safeJson = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4,'0')}`);
export const pathFor = (language, slug) => `/blog${language === 'az' ? '' : `/${language}`}${slug ? `/${encodeURIComponent(slug)}` : ''}/`;
const t = (language, key) => escape(copy[language][key]);
const readableDate = value => new Date(value).toISOString().slice(0,10);
const coverPath = article => new URL(article.cover_image_url, CANONICAL).pathname;
export function schemaFor(language, article) {
  const url = CANONICAL + pathFor(language, article.slug);
  return { '@context': 'https://schema.org', '@graph': [
    { '@type':'BlogPosting', '@id':url+'#article', headline:article.title, description:article.seoDescription, inLanguage:language,
      mainEntityOfPage:{'@type':'WebPage','@id':url}, datePublished:article.created_at, dateModified:article.updated_at,
      author:{'@type':'Organization',name:article.author_name}, publisher:{'@type':'Organization',name:'Anacan',url:CANONICAL,
        logo:{'@type':'ImageObject',url:CANONICAL+'/brand-mark.png'}},
      image:{'@type':'ImageObject',url:article.cover_image_url,width:1200,height:630}, keywords:article.tags.join(', '),
      citation:article.references.map(reference => reference.url), isAccessibleForFree:true },
    { '@type':'BreadcrumbList', itemListElement:[{'@type':'ListItem',position:1,name:copy[language].blog,item:CANONICAL+pathFor(language)},
      {'@type':'ListItem',position:2,name:article.title,item:url}] },
    ...(article.faq.length ? [{ '@type':'FAQPage', '@id':url+'#faq', inLanguage:language,
      mainEntity:article.faq.map(item => ({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}})) }] : []),
  ] };
}
function card(language, article) {
  return `<article class="public-blog-card"><a href="${pathFor(language,article.slug)}"><img src="${escape(coverPath(article))}" alt="${escape(article.coverAlt)}" width="1200" height="630" loading="lazy"><div><h2>${escape(article.title)}</h2><p>${escape(article.excerpt)}</p><span>${t(language,'readMinutes').replace('{count}',article.reading_time)}</span></div></a></article>`;
}
export function bodyFor(language, articles, article) {
  if (article) {
    const dom = new JSDOM(''), purify = createDOMPurify(dom.window);
    article = { ...article, ...prepareBlogContent(article.content, { document:dom.window.document,sanitize:(html,options)=>purify.sanitize(html,options) }) };
    dom.window.close();
  }
  const contentDom = article ? new JSDOM(article.content) : null;
  const route = pathFor(language), headings = contentDom ? [...contentDom.window.document.querySelectorAll('h2[id]')].map(node => ({id:node.id,title:node.textContent})) : [];
  contentDom?.window.close();
  const available = article?.languages || languages;
  const links = available.map(code => `<a href="${pathFor(code,article?.slug)}" hreflang="${code}" lang="${code}">${escape(code.toUpperCase())}</a>`).join(' ');
  const header = `<header class="public-blog-header"><a href="${route}" class="public-blog-brand"><img src="/brand-mark.png" alt="" width="44" height="44">Anacan</a><nav aria-label="${t(language,'blog')}"><a href="${route}">${t(language,'blog')}</a><a href="/">${t(language,'openApp')}</a></nav></header>`;
  let content;
  if (article) {
    const related = articles.filter(item => article.relatedSlugs.includes(item.slug)).slice(0,4);
    content = `<nav class="public-blog-breadcrumb" aria-label="${t(language,'back')}"><a href="${route}">${t(language,'back')}</a> / ${escape(article.title)}</nav>
<article data-public-blog-article="${escape(article.slug)}"><header class="public-blog-article-header"><p class="public-blog-eyebrow">${article.lifeStages.map(stage=>t(language,stage)).join(' · ')}</p><h1>${escape(article.title)}</h1><p class="public-blog-summary">${escape(article.excerpt)}</p><div class="public-blog-meta"><span>${t(language,'author')}</span><span>${t(language,'readMinutes').replace('{count}',article.reading_time)}</span><span>${t(language,'updated')}: <time datetime="${escape(article.updated_at)}">${readableDate(article.updated_at)}</time></span></div></header>
<img class="public-blog-cover" src="${escape(coverPath(article))}" width="1200" height="630" alt="${escape(article.coverAlt)}" fetchpriority="high">
<div class="public-blog-reader"><aside><nav class="public-blog-toc" aria-label="${t(language,'toc')}"><h2>${t(language,'toc')}</h2><ol>${headings.map(heading=>`<li><a href="#${escape(heading.id)}">${escape(heading.title)}</a></li>`).join('')}</ol></nav></aside><div><div class="blog-prose public-blog-prose">${article.content}</div>
<section class="public-blog-section" id="faq" data-public-blog-faq><h2>${t(language,'faq')}</h2>${article.faq.map(item=>`<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`).join('')}</section>
<section class="public-blog-section" data-public-blog-modules><h2>${t(language,'modules')}</h2><div class="public-blog-tags">${article.modules.map(module=>`<a class="public-blog-button" href="/?blog_module=${module}&amp;blog_language=${language}">${t(language,module)}</a>`).join('')}</div></section>
<section class="public-blog-section" data-public-blog-references><h2>${t(language,'references')}</h2><ul>${article.references.map(reference=>`<li><a href="${escape(reference.url)}" target="_blank" rel="noopener noreferrer">${escape(reference.title)}</a></li>`).join('')}</ul></section>
<div class="public-blog-tags">${article.tags.map(tag=>`<a href="${route}?q=${encodeURIComponent(tag)}">${escape(tag)}</a>`).join('')}</div></div></div></article>
<section class="public-blog-related"><h2>${t(language,'related')}</h2><div class="public-blog-grid">${related.map(item=>card(language,item)).join('')}</div></section>`;
  } else content = `<section class="public-blog-intro"><p class="public-blog-eyebrow">Anacan</p><h1>${t(language,'blog')}</h1><p>${t(language,'introduction')}</p></section><div class="public-blog-grid">${articles.map(article=>card(language,article)).join('')}</div>`;
  return `<div class="public-blog" lang="${language}" dir="${language==='ar'?'rtl':'ltr'}">${header}<main id="blog-main" class="public-blog-main">${content}<nav class="public-blog-section public-blog-tags" aria-label="${t(language,'language')}">${links}</nav></main><footer class="public-blog-footer"><strong>Anacan</strong><a href="${route}">${t(language,'articles')}</a><a href="/">${t(language,'openApp')}</a></footer></div>`;
}
export function renderPage({ shell, language, articles, article, css }) {
  const dom = new JSDOM(shell), document = dom.window.document;
  const title = article?.seoTitle || copy[language].seoTitle, description = article?.seoDescription || copy[language].seoDescription;
  const url = CANONICAL + pathFor(language,article?.slug), image = article?.cover_image_url || CANONICAL+'/brand-mark.png';
  document.documentElement.lang = language; document.documentElement.dir = language==='ar'?'rtl':'ltr'; document.title=title+' | Anacan';
  document.documentElement.classList.add('anacan-public-blog');
  document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1.0, viewport-fit=cover');
  const setMeta=(key,value,property=false)=>{const attribute=property?'property':'name',node=document.querySelector(`meta[${attribute}="${key}"]`)||document.createElement('meta');node.setAttribute(attribute,key);node.setAttribute('content',value);if(!node.parentNode)document.head.append(node);};
  setMeta('description',description); setMeta('robots','index,follow,max-image-preview:large');
  for(const [key,value]of Object.entries({'og:title':title,'og:description':description,'og:url':url,'og:type':article?'article':'website','og:image':image,'og:image:alt':article?.coverAlt||'Anacan','og:site_name':'Anacan','og:locale':language==='en'?'en_US':language==='zh'?'zh_CN':language}))setMeta(key,value,true);
  setMeta('twitter:title',title);setMeta('twitter:description',description);setMeta('twitter:image',image);setMeta('twitter:card','summary_large_image');
  if(article){setMeta('article:published_time',article.created_at,true);setMeta('article:modified_time',article.updated_at,true);}
  document.querySelectorAll('link[rel="canonical"],link[hreflang]').forEach(node=>node.remove());
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=url;document.head.append(canonical);
  for(const code of [...(article?.languages||languages),'x-default']){const node=document.createElement('link');node.rel='alternate';node.hreflang=code;node.href=CANONICAL+pathFor(code==='x-default'?'az':code,article?.slug);document.head.append(node);}
  const style=document.createElement('style');style.textContent=css;document.head.append(style);
  const root=document.getElementById('root');root.removeAttribute('style');root.innerHTML=bodyFor(language,articles,article);
  const boot=document.createElement('script');boot.id='anacan-blog-boot';boot.type='application/json';boot.textContent=safeJson({language,slug:article?.slug,article,articles:article?undefined:articles});document.body.append(boot);
  const schema=document.createElement('script');schema.type='application/ld+json';schema.dataset.blogSchema='';schema.textContent=safeJson(article?schemaFor(language,article):{
    '@context':'https://schema.org','@type':'CollectionPage',name:title,description,inLanguage:language,url,
    mainEntity:{'@type':'ItemList',itemListElement:articles.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.title,url:CANONICAL+pathFor(language,item.slug)}))}});document.head.append(schema);
  const html = dom.serialize(); dom.window.close(); return html;
}
export function blogPrerenderPlugin({ directory=fileURLToPath(new URL('./catalog/',import.meta.url)) }={}) {
  let native=false,root;
  return {name:'anacan-blog-prerender',apply:'build',enforce:'post',
    configResolved(config){native=config.env.VITE_NATIVE_BUILD==='true'||process.env.VITE_NATIVE_BUILD==='true';root=config.root;},
    async generateBundle(_options,bundle){
      if(native)return;
      let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')throw new Error('BLOG_PRERENDER_CATALOG_REQUIRED');throw error;}
      const shell=bundle['index.html']?.source;if(typeof shell!=='string')throw new Error('BLOG_PRERENDER_SHELL_REQUIRED');
      const css=(await readFile(join(root,'src/styles/public-blog.css'),'utf8'))+'\n'+await readFile(join(root,'src/styles/blog-content.css'),'utf8');
      const urls=[];
      for(const language of languages){
        if(!files.includes(`${language}.json`))throw new Error('BLOG_PRERENDER_LANGUAGE_MISSING');
        const catalog=JSON.parse(await readFile(join(directory,`${language}.json`),'utf8'));
        if(catalog.schema!=='anacan-public-blog-catalog-v1'||catalog.language!==language||catalog.articles.length!==18)throw new Error('BLOG_PRERENDER_CATALOG_INVALID');
        for(const article of [undefined,...catalog.articles]){
          const path=pathFor(language,article?.slug),html=renderPage({shell,language,articles:catalog.articles,article,css});
          this.emitFile({type:'asset',fileName:path.slice(1).replace(/\/$/,'')+'/index.html',source:html});
          urls.push({url:CANONICAL+path,language,slug:article?.slug,updated:article?.updated_at||catalog.generatedAt});
        }
      }
      const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map(item=>`<url><loc>${escape(item.url)}</loc><lastmod>${readableDate(item.updated)}</lastmod>${[...languages,'x-default'].map(code=>`<xhtml:link rel="alternate" hreflang="${code}" href="${escape(CANONICAL+pathFor(code==='x-default'?'az':code,item.slug))}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`;
      this.emitFile({type:'asset',fileName:'sitemap-blog.xml',source:sitemap});
      this.emitFile({type:'asset',fileName:'sitemap.xml',source:`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${CANONICAL}/sitemap-blog.xml</loc></sitemap></sitemapindex>\n`});
      const existing=bundle['robots.txt'];const robots=(existing?.source?.toString()||'User-agent: *\nAllow: /\n').replace(/^Sitemap:.*$/gm,'').trim()+`\nSitemap: ${CANONICAL}/sitemap.xml\n`;
      if(existing)existing.source=robots;else this.emitFile({type:'asset',fileName:'robots.txt',source:robots});
      this.emitFile({type:'asset',fileName:'blog-release.json',source:JSON.stringify({schema:'anacan-blog-release-v1',articles:18,languages:languages.length,pages:urls.length,canonicalOrigin:CANONICAL})+'\n'});
    }};
}
