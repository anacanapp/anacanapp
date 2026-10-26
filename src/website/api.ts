import type { AppLanguageCode } from '../lib/app-languages';
import { validWebsiteSlug } from './routes';
import type { WebsiteArticle, WebsiteCatalog } from './model';
import { localizedSlug } from './routes';
import DOMPurify from 'dompurify';

/** The public website reads a Google-produced public projection, without creating
 * a consumer, native or brand session. No credentials or health inputs are sent. */
export async function readWebsiteCatalog(language:AppLanguageCode, signal?:AbortSignal):Promise<WebsiteCatalog> {
  const response=await fetch(`/website/data/${language}.json`,{credentials:'omit',redirect:'error',signal,cache:'no-cache'});
  if(!response.ok)throw new Error('WEBSITE_CATALOG_UNAVAILABLE');
  const data=await response.json();
  if(data.schema!=='anacan-website-catalog-v1'||data.language!==language||!Array.isArray(data.articles))throw new Error('WEBSITE_CATALOG_INVALID');
  return data;
}
export async function readWebsiteArticle(language:AppLanguageCode, slug:string, signal?:AbortSignal):Promise<WebsiteArticle> {
  if(!validWebsiteSlug(slug))throw new Error('WEBSITE_SLUG_INVALID');
  const response=await fetch(`/website/data/${language}/${encodeURIComponent(slug)}.json`,{credentials:'omit',redirect:'error',signal,cache:'no-cache'});
  if(!response.ok)throw new Error('WEBSITE_ARTICLE_UNAVAILABLE');
  const data=await response.json();
  if(data.language!==language||data.slug!==slug||typeof data.content!=='string')throw new Error('WEBSITE_ARTICLE_INVALID');
  return data;
}

interface PublicGoogleConfig { schema:string; project:string; url:string; publishableKey:string }
let googleConfig:Promise<PublicGoogleConfig>|undefined;
async function config() {
  googleConfig ||= fetch('/website/backend.json',{credentials:'omit',redirect:'error',cache:'no-cache'}).then(async response=>{
    const value=await response.json();
    if(!response.ok||value.schema!=='anacan-website-backend-v1'||value.project!=='ninth-park-492111-m4'||value.url!=='https://gcp.anacan.az')throw new Error('WEBSITE_GOOGLE_CONFIGURATION_INVALID');
    return value as PublicGoogleConfig;
  });
  return googleConfig;
}
/** Live Google RLS reads are deliberately separate from the app SDK. The anon
 * key is public; user sessions/cookies are never sent or refreshed here. */
export async function refreshGoogleArticles(language:AppLanguageCode, cached:WebsiteArticle[], signal?:AbortSignal):Promise<WebsiteArticle[]> {
  const backend=await config();
  const url=new URL('/rest/v1/blog_posts',backend.url);
  const fields=['id','slug','title','excerpt','author_name','cover_image_url','reading_time','category','life_stage','tags','is_published','created_at','updated_at','editorial_metadata'];
  if(language!=='az')fields.push(`title_${language}`,`excerpt_${language}`);
  url.searchParams.set('select',fields.join(','));url.searchParams.set('is_published','eq.true');url.searchParams.set('order','created_at.desc,id');url.searchParams.set('limit','1000');
  const response=await fetch(url,{credentials:'omit',redirect:'error',signal,headers:{apikey:backend.publishableKey,Authorization:`Bearer ${backend.publishableKey}`}});
  if(!response.ok)throw new Error('WEBSITE_GOOGLE_READ_UNAVAILABLE');
  const values=await response.json();if(!Array.isArray(values))throw new Error('WEBSITE_GOOGLE_READ_INVALID');
  const result:WebsiteArticle[]=[];
  for(const row of values){
    const title=language==='az'?row.title:row[`title_${language}`];
    if(typeof title!=='string'||!title.trim())continue;
    const previous=cached.find(article=>article.id===row.id),metadata=row.editorial_metadata,locale=metadata?.locales?.[language];
    const slug=metadata?.website?.slugs?.[language]||previous?.slug||localizedSlug(title);
    if(!validWebsiteSlug(slug))continue;
    const headings=previous?.headings||[];
    const excerpt=(language==='az'?row.excerpt:row[`excerpt_${language}`])||'';
    let cover=previous?.cover||row.cover_image_url;
    if(!previous?.cover&&typeof cover==='string'){
      try{const value=new URL(cover,backend.url);if(value.pathname.startsWith('/storage/v1/object/public/'))value.hostname='gcp.anacan.az';if(value.pathname.startsWith('/blog-covers/'))cover=value.pathname;else cover=value.href;}catch{cover=null;}
    }
    result.push({id:row.id,legacySlug:row.slug,slugs:metadata?.website?.slugs||previous?.slugs||{},language,slug,title,excerpt,
      cover,coverAlt:locale?.coverAlt||title,author:row.author_name||'Anacan',minutes:row.reading_time||5,category:row.category||'digər',
      stages:metadata?.lifeStages||[row.life_stage||'all'],tags:locale?.tags||previous?.tags||[],modules:metadata?.modules||[],relatedIds:previous?.relatedIds||[],
      faq:locale?.faq||[],references:locale?.references||[],headings,seoTitle:locale?.seoTitle||title,seoDescription:locale?.seoDescription||excerpt,
      publishedAt:row.created_at,updatedAt:row.updated_at});
  }
  return result;
}
