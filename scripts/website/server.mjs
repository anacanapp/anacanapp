import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {renderWebsite,renderArticleContent,resolveWebsiteRoute,routePath,PAGE_SLUGS,sitePath,localizedSlug,WEBSITE_ORIGIN,APP_LANGUAGES} from './renderer.mjs';
import {renderWebsiteHtml} from './prerender.mjs';

const root=process.env.WEBSITE_ROOT||'/app/website',port=Number(process.env.PORT||9200);
const api=process.env.WEBSITE_INTERNAL_API||'http://anacan-rest:3000';
if(!['http://anacan-rest:3000','https://gcp.anacan.az'].includes(api))throw new Error('WEBSITE_API_ORIGIN_REFUSED');
const rest=api==='https://gcp.anacan.az'?api+'/rest/v1':api;
const backend=JSON.parse(await readFile(join(root,'website/backend.json'),'utf8'));
if(backend.project!=='ninth-park-492111-m4'||backend.url!=='https://gcp.anacan.az')throw new Error('WEBSITE_GOOGLE_BACKEND_REQUIRED');
const shell=await readFile(join(root,'az/index.html'),'utf8');
const cleanShell=shell.replace(/<html[^>]*>/,'<html lang="az">').replace(/<meta (?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+|article:[^"]+)"[^>]*>/g,'')
  .replace(/<link rel="(?:canonical|alternate|preload)"[^>]*>/g,'').replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,'')
  .replace(/<script id="anacan-website-boot"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<div id="root">[\s\S]*<\/div>\s*\n/, '<div id="root"></div>\n');
const copies=Object.fromEntries(await Promise.all(APP_LANGUAGES.map(async({code})=>[code,JSON.parse(await readFile(join(root,'copy',code+'.json'),'utf8'))])));
const details=Object.fromEntries(await Promise.all(APP_LANGUAGES.map(async({code})=>[code,JSON.parse(await readFile(join(root,'details',code+'.json'),'utf8'))])));
const fallback=Object.fromEntries(await Promise.all(APP_LANGUAGES.map(async({code})=>[code,JSON.parse(await readFile(join(root,'website/data',code+'.json'),'utf8'))])));
const knownRoutes=JSON.parse(await readFile(join(root,'article-routes.json'),'utf8'));
const legacyMap=JSON.parse(await readFile(join(root,'website-redirects.json'),'utf8')).redirects;
let metadata=[],metadataTime=0,metadataPending;
const articles=new Map();
async function googleGet(query) {
  const response=await fetch(rest+'/blog_posts?'+query,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:backend.publishableKey,Authorization:`Bearer ${backend.publishableKey}`}});
  if(!response.ok)throw new Error('WEBSITE_PUBLIC_GOOGLE_READ_FAILED');
  const data=await response.json();if(!Array.isArray(data))throw new Error('WEBSITE_PUBLIC_GOOGLE_DATA_INVALID');return data;
}
async function publicMetadata() {
  if(Date.now()-metadataTime<60000)return metadata;
  if(metadataPending)return metadataPending;
  metadataPending=(async()=>{
    const fields=['id','slug','title','excerpt','author_name','cover_image_url','reading_time','category','life_stage','tags','is_published','created_at','updated_at','editorial_metadata',
      ...APP_LANGUAGES.filter(item=>item.code!=='az').flatMap(({code})=>[`title_${code}`,`excerpt_${code}`])];
    try{metadata=await googleGet(new URLSearchParams({select:fields.join(','),is_published:'eq.true',order:'created_at.desc,id',limit:'1000'}));metadataTime=Date.now();}
    catch{if(!metadata.length)return null;}
    return metadata;
  })();
  try{return await metadataPending;}finally{metadataPending=undefined;}
}
function project(row,language) {
  const previous=fallback[language].articles.find(item=>item.id===row.id),route=knownRoutes.find(item=>item.id===row.id),meta=row.editorial_metadata,locale=meta?.locales?.[language];
  const title=language==='az'?row.title:row[`title_${language}`],excerpt=(language==='az'?row.excerpt:row[`excerpt_${language}`])||'';
  if(typeof title!=='string'||!title.trim())return null;
  const slugs=meta?.website?.slugs||route?.slugs||Object.fromEntries(APP_LANGUAGES.flatMap(({code})=>{const text=code==='az'?row.title:row[`title_${code}`];return text?[[code,localizedSlug(text)]]:[];}));
  if(!slugs[language])return null;
  let cover=previous?.cover||row.cover_image_url||null;
  if(cover&&!previous?.cover){try{const url=new URL(cover,backend.url);if(url.pathname.startsWith('/blog-covers/'))cover=url.pathname;else if(url.pathname.startsWith('/storage/v1/object/public/')){url.hostname='gcp.anacan.az';cover=url.href;}}catch{cover=null;}}
  return {id:row.id,legacySlug:row.slug,slugs,language,slug:slugs[language],title,excerpt,cover,coverAlt:locale?.coverAlt||title,author:row.author_name||'Anacan',minutes:row.reading_time||5,
    category:row.category||'digər',stages:meta?.lifeStages||[row.life_stage||'all'],tags:locale?.tags||previous?.tags||[],modules:meta?.modules||[],relatedIds:previous?.relatedIds||[],faq:locale?.faq||[],references:locale?.references||[],headings:[],
    seoTitle:locale?.seoTitle||title,seoDescription:locale?.seoDescription||excerpt,publishedAt:row.created_at,updatedAt:row.updated_at};
}
async function catalog(language) {
  const rows=await publicMetadata();
  if(!rows)return fallback[language];
  return {...fallback[language],articles:rows.map(row=>project(row,language)).filter(Boolean)};
}
async function articleFor(summary,language) {
  const key=language+':'+summary.id,cached=articles.get(key);
  if(cached&&cached.updatedAt===summary.updatedAt&&cached.expires>Date.now())return cached.value;
  let value;
  try{
    const field=language==='az'?'content':`content_${language}`;
    const data=await googleGet(new URLSearchParams({select:`id,${field}`,id:`eq.${summary.id}`,is_published:'eq.true',limit:'1'}));
    if(!data.length||typeof data[0][field]!=='string'||!data[0][field].trim())return null;
    const prepared=renderArticleContent(data[0][field],{footnotesLabel:copies[language].references});
    value={...summary,...prepared};
  }catch{try{const previous=JSON.parse(await readFile(join(root,'website/data',language,summary.slug+'.json'),'utf8'));value=previous.contentFormat==='anacan-article-html-v1'?previous:{...previous,...renderArticleContent(previous.content,{footnotesLabel:copies[language].references})};}catch{return null;}}
  articles.set(key,{value,updatedAt:summary.updatedAt,expires:Date.now()+60000});
  if(articles.size>128)articles.delete(articles.keys().next().value);
  return value;
}
const escape=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
async function sitemap(kind) {
  const entries=[];
  for(const {code}of APP_LANGUAGES){const data=await catalog(code);
    if(kind==='articles')for(const article of data.articles)entries.push({path:sitePath(code,'article',article.slug),updated:article.updatedAt,slugs:article.slugs,kind:'article'});
    else{for(const type of ['home',...Object.keys(PAGE_SLUGS[code])])entries.push({path:sitePath(code,type),updated:data.generatedAt,kind:type});
      for(let page=2;page<=Math.ceil(data.articles.length/12);page++)entries.push({path:sitePath(code,'journal',undefined,page),updated:data.generatedAt,kind:'journal',page});}
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(item=>`<url><loc>${escape(WEBSITE_ORIGIN+item.path)}</loc><lastmod>${item.updated.slice(0,10)}</lastmod>${[...APP_LANGUAGES.map(value=>value.code),'x-default'].flatMap(code=>{const lang=code==='x-default'?'az':code,url=item.kind==='article'?item.slugs[lang]&&sitePath(lang,'article',item.slugs[lang]):sitePath(lang,item.kind,undefined,item.page);return url?[`<xhtml:link rel="alternate" hreflang="${code}" href="${escape(WEBSITE_ORIGIN+url)}"/>`]:[];}).join('')}</url>`).join('')}</urlset>`;
}
function reply(response,status,body,type='text/html; charset=utf-8',headers={}) {response.writeHead(status,{'Content-Type':type,'Cache-Control':'public, max-age=0, must-revalidate',...headers});response.end(body);}
createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){reply(response,405,'','text/plain',{Allow:'GET, HEAD'});return;}
  try{
    const url=new URL(request.url,'http://website.internal'),prefix=request.headers['x-anacan-website-prefix']==='/site'?'/site':'';
    if(url.pathname==='/healthz'){reply(response,200,JSON.stringify({status:'ok',service:'anacan-website',backend:'google'}),'application/json');return;}
    if(url.pathname==='/sitemap-blog.xml'||url.pathname==='/sitemap-pages.xml'){reply(response,200,await sitemap(url.pathname.includes('blog')?'articles':'pages'),'application/xml; charset=utf-8');return;}
    if(url.pathname==='/sitemap.xml'){reply(response,200,await readFile(join(root,'sitemap.xml')),'application/xml; charset=utf-8');return;}
    const dataMatch=/^\/website\/data\/([a-z]{2})(?:\/([^/]+))?\.json$/.exec(decodeURIComponent(url.pathname));
    if(dataMatch&&fallback[dataMatch[1]]){const data=await catalog(dataMatch[1]);if(dataMatch[2]){const summary=data.articles.find(item=>item.slug===dataMatch[2]),article=summary&&await articleFor(summary,dataMatch[1]);reply(response,article?200:404,JSON.stringify(article||{}),'application/json');}else reply(response,200,JSON.stringify(data),'application/json');return;}
    const defaultLanguage=APP_LANGUAGES.some(item=>url.pathname.startsWith('/'+item.code+'/'))?url.pathname.split('/')[1]:'az';
    const data=await catalog(defaultLanguage),routes=data.articles;
    const resolved=resolveWebsiteRoute(url.pathname,routes);
    const legacy=legacyMap[url.pathname]||legacyMap[decodeURIComponent(url.pathname)];
    if(resolved.redirect||legacy){reply(response,301,'','text/plain',{Location:prefix+(resolved.redirect||legacy)+url.search});return;}
    const route=resolved.route,activeData=route.language===defaultLanguage?data:await catalog(route.language);
    const summary=activeData.articles.find(item=>item.id===route.articleId),article=route.kind==='article'&&summary?await articleFor(summary,route.language):undefined;
    if(route.kind==='article'&&!article||route.kind==='journal'&&(route.page||1)>Math.ceil(activeData.articles.length/12))route.kind='notFound';
    const related=article?activeData.articles.filter(item=>item.id!==article.id).sort((a,b)=>Number(article.relatedIds.includes(b.id))-Number(article.relatedIds.includes(a.id))||Number(b.category===article.category)-Number(a.category===article.category)).slice(0,3):[];
    const detail=['cycle','pregnancy','motherhood','partner','memories','ai','community','health'].includes(route.kind);
    const boot={schema:'anacan-website-boot-v1',route,copy:copies[route.language],details:details[route.language],articles:route.kind==='journal'||detail?activeData.articles:route.kind==='home'?activeData.articles.slice(0,3):related,article,
      legalContent:activeData.legal[route.kind]?.content,legalUpdated:activeData.legal[route.kind]?.updatedAt,basePath:prefix,generatedAt:activeData.generatedAt};
    const rendered=renderWebsite(boot),html=renderWebsiteHtml({shell:cleanShell,boot,...rendered,preload:article?.cover?[article.cover]:[]});
    reply(response,route.kind==='notFound'?404:200,request.method==='HEAD'?'':html,'text/html; charset=utf-8',route.kind==='notFound'?{'X-Robots-Tag':'noindex'}:{});
  }catch{reply(response,503,'Anacan','text/plain; charset=utf-8',{'Retry-After':'30'});}
}).listen(port,'0.0.0.0',()=>console.log(JSON.stringify({status:'ready',service:'anacan-website',backend:'google'})));
void publicMetadata();
