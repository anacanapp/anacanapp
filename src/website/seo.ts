import { WEBSITE_LANGUAGES, type WebsiteLanguageCode } from '../lib/app-languages';
import type { WebsiteArticle, WebsiteBoot, WebsiteCopyKey } from './model';
import COVER_SIZES from './cover-sizes.json';
const coverSize=(cover?:string|null)=>cover?(COVER_SIZES as unknown as Record<string,[number,number]|undefined>)[cover]:undefined;
import { alternateRoute, APP_STORE_URL, GOOGLE_PLAY_URL, routePath, sitePath, WEBSITE_ORIGIN,DETAIL_PAGES,type DetailPage,isShopPage,isAzOnlyPage,isCalcPage,isNewsPage } from './routes';
import { findNews, isNewsLanguage, NEWS_LABELS, newsIn } from './news';

/** Azerbaijani-only shop pages (Kitablar, Tortlar): their own copy, no other-language alternates. */
const SHOP_META={
  books:['PDF çap kitabları uşaqlar üçün','6 aydan 6 yaşa qədər 70 çap kitabı: boyama, say, hərflər, məntiq. PDF e-poçtla gəlir, evdə A4 çap edin. 1 kitab 4 ₼, 10 kitabdan 2 ₼.'],
  cakes:['Uşaq və ana tortları, bento tortlar','Aylıq bento tortlar, 1 yaş paketi, hamiləlik və ailə tortları. Bakıda çatdırılma və ya götürmə, sifariş 48 saat əvvəldən.'],
} as const;
/** News (az, en): the list uses NEWS_LABELS, detail pages use the item title and lead. */
const newsMeta=(language:WebsiteLanguageCode)=>isNewsLanguage(language)?[NEWS_LABELS[language].metaTitle,NEWS_LABELS[language].metaDescription] as const:undefined;
const newsItem=(boot:WebsiteBoot)=>boot.route.kind==='newsArticle'&&isNewsLanguage(boot.route.language)?findNews(boot.route.slug,boot.route.language):undefined;
import { discoveryLinks, markdownPath } from './discovery';
import { isToolPage, toolAlternateLanguages, toolMeta, toolRobots, toolXDefaultPath } from './tools/tool-routes';
import { toolSchemaNodes } from './tools/tool-schema';
import { calcContent } from './calc-content';

/** Search snippet limits (docs/seo/TECHNICAL_SEO.md), measured as display width: East Asian wide
 * characters (Han, Kana, Hangul) count as two, everything else as one. */
export const SEO_TITLE_MAX=60,SEO_DESCRIPTION_MIN=70,SEO_DESCRIPTION_MAX=160;
const WIDE=/[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;
export const seoTextWidth=(value:string)=>[...value].reduce((sum,character)=>sum+(WIDE.test(character)?2:1),0);
/** Brand suffix only when it still fits; search engines show the site name separately anyway. */
const brandTitle=(value:string)=>value.includes('Anacan')||seoTextWidth(value+' | Anacan')>SEO_TITLE_MAX?value:value+' | Anacan';
/** Fit a long lead into a snippet: whole sentences first, otherwise cut at a word with an ellipsis. */
function fitDescription(value:string,max=SEO_DESCRIPTION_MAX) {
  if(seoTextWidth(value)<=max)return value;
  let result='';
  for(const sentence of value.match(/[^.!?。！？]+[.!?。！？]+(\s|$)/g)||[]){if(seoTextWidth(result+sentence)>max)break;result+=sentence;}
  result=result.trim();
  if(seoTextWidth(result)>=SEO_DESCRIPTION_MIN)return result;
  const words=value.split(/\s+/);result='';
  for(const word of words){if(seoTextWidth(result+' '+word+'…')>max)break;result=result?result+' '+word:word;}
  return result.replace(/[,;:]$/,'')+'…';
}
/** News headlines are written for the page; the search title keeps the part before a colon when too long. */
const fitNewsTitle=(value:string)=>seoTextWidth(value)>SEO_TITLE_MAX&&value.includes(':')?value.slice(0,value.indexOf(':')).trim():value;
const FOUNDERS=['Türkan Sultanlı','Camil Sultanlı'];
/** Cover pixel size from src/website/cover-sizes.json (scripts/website/cover-sizes.mjs); unknown covers get no size. */
function articleImage(article:WebsiteArticle,url:string) {
  const size=article.cover?coverSize(article.cover):undefined;
  return {'@type':'ImageObject',url,...(size?{width:size[0],height:size[1]}:{}),...(article.coverAlt?{caption:article.coverAlt}:{})};
}
/** Word count from the rendered body (server pages only); skipped for scripts written without spaces. */
function wordCount(article:WebsiteArticle,language:string) {
  if(!article.content||['zh','ja'].includes(language))return {};
  const words=article.content.replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').split(/\s+/).filter(word=>/[\p{L}\p{N}]/u.test(word)).length;
  return words?{wordCount:words}:{};
}
const ORGANIZATION_ID=WEBSITE_ORIGIN+'/#organization';
const WEBSITE_ID=WEBSITE_ORIGIN+'/#website';
const APP_ID=WEBSITE_ORIGIN+'/#app';
export function websiteMeta(boot:WebsiteBoot) {
  const kind=boot.route.kind;
  const keys:Partial<Record<typeof kind,[WebsiteCopyKey,WebsiteCopyKey]>>={
    home:['homeTitle','homeDescription'],journal:['journalTitle','journalDescription'],tools:['toolsTitle','toolsDescription'],
    ovulation:['ovulationTitle','ovulationDescription'],dueDate:['dueDateTitle','dueDateDescription'],symptoms:['symptomsTitle','symptomsDescription'],
    features:['featuresTitle','featuresIntro'],faq:['faq','faqDescription'],contact:['contactTitle','contactDescription'],download:['downloadTitle','downloadDescription'],
    privacy:['privacy','privacyDescription'],terms:['terms','termsDescription'],simulator:['simulatorTitle','simulatorIntro'],notFound:['notFound','notFoundDescription'],
  };
  const labels=keys[kind]||keys.home!,copy={...boot.copy,...boot.details};
  const detail=(DETAIL_PAGES as readonly string[]).includes(kind);
  const news=newsItem(boot);
  const tool=toolMeta(boot.route,{home:boot.copy.home,tools:boot.copy.tools});
  const calc=isCalcPage(kind)?calcContent(boot.route.language)[kind]:undefined;
  const shop=isShopPage(kind)?SHOP_META[kind]:kind==='news'?newsMeta(boot.route.language):news?[fitNewsTitle(news.title),fitDescription(news.lead)] as const:tool?[tool.title,tool.description] as const:calc?[calc.title,calc.description] as const:undefined;
  const title=shop?shop[0]:kind==='article'?boot.article?.seoTitle||copy.notFound:detail?copy[`${kind}Title` as WebsiteCopyKey]:copy[labels[0]];
  const baseDescription=shop?shop[1]:kind==='article'?boot.article?.seoDescription||copy.notFoundDescription:detail?copy[`${kind}Description` as WebsiteCopyKey]:copy[labels[1]];
  // Journal page 2+ is indexable with its own title and description ("… – Səhifə 2").
  const pageLabel=boot.route.kind==='journal'&&(boot.route.page||1)>1?boot.copy.page.replace('{count}',String(boot.route.page)):'';
  const suffix=pageLabel?` – ${pageLabel}`:'';
  const description=pageLabel?`${pageLabel} · ${fitDescription(baseDescription,SEO_DESCRIPTION_MAX-seoTextWidth(pageLabel)-3)}`:baseDescription;
  const canonical=WEBSITE_ORIGIN+routePath(boot.route);
  const image=new URL(boot.article?.cover||(news?news.cover.src:'/website/og-cover.jpg'),WEBSITE_ORIGIN).href;
  const available=boot.route.kind==='article'?WEBSITE_LANGUAGES.filter(item=>boot.article?.slugs[item.code]):isNewsPage(kind)?WEBSITE_LANGUAGES.filter(item=>alternateRoute(boot.route,item.code)):isAzOnlyPage(kind)?WEBSITE_LANGUAGES.filter(item=>item.code==='az'):isToolPage(kind)?WEBSITE_LANGUAGES.filter(item=>toolAlternateLanguages(boot.route).includes(item.code)):WEBSITE_LANGUAGES;
  const alternates=available.map(({code,locale})=>({code,locale,url:WEBSITE_ORIGIN+alternateRoute(boot.route,code,boot.article)}));
  alternates.push({code:'x-default' as WebsiteLanguageCode,locale:'az-AZ',url:WEBSITE_ORIGIN+((isToolPage(kind)?toolXDefaultPath(boot.route):undefined)||alternateRoute(boot.route,'az',boot.article)||sitePath('az'))});
  return {title:brandTitle(title+suffix),description,canonical,image,
    imageAlt:boot.article?.coverAlt||news?.title||'Anacan',
    robots:toolRobots(boot.route)||(kind==='notFound'?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1'),
    /** og:image size; the default cover and news covers are 1200x630, article covers come from cover-sizes.json. */
    imageSize:(boot.article?coverSize(boot.article.cover):[1200,630]) as [number,number]|undefined,
    locale:WEBSITE_LANGUAGES.find(item=>item.code===boot.route.language)!.locale.replace('-','_'),alternates};
}
function faqs(boot:WebsiteBoot) {
  const {kind}=boot.route;
  if(kind==='article')return boot.article?.faq||[];
  if(isToolPage(kind))return toolMeta(boot.route,{home:boot.copy.home,tools:boot.copy.tools})?.faq||[];
  if(isCalcPage(kind))return calcContent(boot.route.language)[kind].faq.map(item=>({question:item.q,answer:item.a}));
  const prefix=kind==='ovulation'?'ovulationFaq':kind==='dueDate'?'dueDateFaq':kind==='symptoms'?'symptomsFaq':'faq';
  const numbers=kind==='home'?[1,2,3,4,5]:kind==='faq'?[1,2,3,4,5,6,7,8]:kind==='ovulation'?[1,2,3,4]:kind==='dueDate'||kind==='symptoms'?[1,2]:kind==='tools'?[5,4]:[];
  return numbers.map(number=>({question:boot.copy[`${prefix}${number}Question` as WebsiteCopyKey],answer:boot.copy[`${prefix}${number}Answer` as WebsiteCopyKey]}));
}
export function websiteSchema(boot:WebsiteBoot) {
  const meta=websiteMeta(boot),language=boot.route.language,graph:Record<string,unknown>[]=[];
  graph.push({'@type':'Organization','@id':ORGANIZATION_ID,name:'Anacan',url:WEBSITE_ORIGIN,logo:{'@type':'ImageObject',url:WEBSITE_ORIGIN+'/website/brand-mark-coral.png',width:512,height:512},legalName:'ANACAN, MMC',
    email:'info@anacan.az',foundingDate:'2026-03-01',founder:FOUNDERS.map(name=>({'@type':'Person',name})),address:{'@type':'PostalAddress',addressCountry:'AZ'},
    // Only profiles the site itself links to (footer) and the two store listings.
    sameAs:['https://instagram.com/anacanapp','https://facebook.com/anacanapp',APP_STORE_URL,GOOGLE_PLAY_URL]});
  graph.push({'@type':'WebSite','@id':WEBSITE_ID,name:'Anacan',url:WEBSITE_ORIGIN,publisher:{'@id':ORGANIZATION_ID},inLanguage:WEBSITE_LANGUAGES.map(item=>item.code)});
  const tool=toolMeta(boot.route,{home:boot.copy.home,tools:boot.copy.tools});
  graph.push({'@type':tool?tool.pageType:boot.route.kind==='journal'||boot.route.kind==='news'?'CollectionPage':boot.route.kind==='contact'?'ContactPage':'WebPage','@id':meta.canonical+'#webpage',url:meta.canonical,
    name:meta.title,description:meta.description,inLanguage:language,isPartOf:{'@id':WEBSITE_ID},publisher:{'@id':ORGANIZATION_ID},isAccessibleForFree:true,
    about:{'@id':APP_ID},encoding:{'@type':'MediaObject',encodingFormat:'text/markdown',contentUrl:WEBSITE_ORIGIN+markdownPath(boot.route),inLanguage:language}});
  if(tool)graph.push(...toolSchemaNodes(boot.route,tool,meta.canonical));
  else if(boot.route.kind!=='home'&&boot.route.kind!=='notFound'){
    const items=[{'@type':'ListItem',position:1,name:boot.copy.home,item:WEBSITE_ORIGIN+sitePath(language)}];
    if(boot.route.kind==='article')items.push({'@type':'ListItem',position:2,name:boot.copy.journal,item:WEBSITE_ORIGIN+sitePath(language,'journal')});
    if(boot.route.kind==='newsArticle'&&isNewsLanguage(language))items.push({'@type':'ListItem',position:2,name:NEWS_LABELS[language].news,item:WEBSITE_ORIGIN+sitePath(language,'news')});
    const calc=isCalcPage(boot.route.kind)?calcContent(language)[boot.route.kind]:undefined;
    if(calc)items.push({'@type':'ListItem',position:2,name:boot.copy.tools,item:WEBSITE_ORIGIN+sitePath(language,'tools')});
    const newsName=boot.route.kind==='news'&&isNewsLanguage(language)?NEWS_LABELS[language].news:newsItem(boot)?.title;
    items.push({'@type':'ListItem',position:items.length+1,name:calc?.name||boot.article?.title||newsName||meta.title,item:meta.canonical});
    graph.push({'@type':'BreadcrumbList','@id':meta.canonical+'#breadcrumb',itemListElement:items});
  }
  if(boot.route.kind==='article'&&boot.article){
    const article=boot.article;
    graph.push({'@type':'BlogPosting','@id':meta.canonical+'#article',headline:article.title,description:meta.description,inLanguage:language,
      mainEntityOfPage:{'@id':meta.canonical+'#webpage'},datePublished:article.publishedAt,dateModified:article.updatedAt,
      author:article.author==='Anacan'?{'@id':ORGANIZATION_ID}:{'@type':'Person',name:article.author},publisher:{'@id':ORGANIZATION_ID},
      image:articleImage(article,meta.image),keywords:article.tags.join(', '),about:article.tags.map(name=>({'@type':'Thing',name})),
      isPartOf:{'@id':WEBSITE_ID},...wordCount(article,language),citation:article.references.map(reference=>reference.url),
      articleSection:boot.copy[(({'korpe-baximi':'categoryBaby','hamiləlik':'categoryPregnancy','menstrual-sağlamlıq':'categoryCycle','qidalanma':'categoryNutrition',
        'saglamliq':'categoryHealth','psixologiya':'categoryPsychology','motivasiya':'categoryMotivation','məşqlər':'categoryExercise'} as Record<string,WebsiteCopyKey>)[article.category]||'categoryOther')],isAccessibleForFree:true,
      encoding:{'@type':'MediaObject',encodingFormat:'text/markdown',contentUrl:WEBSITE_ORIGIN+markdownPath(boot.route),inLanguage:language}});
  }
  const news=newsItem(boot);
  if(news)graph.push({'@type':'NewsArticle','@id':meta.canonical+'#article',headline:news.title,description:news.lead,inLanguage:news.language,
    mainEntityOfPage:{'@id':meta.canonical+'#webpage'},datePublished:news.date,dateModified:news.date,author:{'@id':ORGANIZATION_ID},publisher:{'@id':ORGANIZATION_ID},
    image:{'@type':'ImageObject',url:meta.image,width:1200,height:630},articleSection:news.tag,isAccessibleForFree:true});
  if(boot.route.kind==='news'&&isNewsLanguage(language))graph.push({'@type':'ItemList','@id':meta.canonical+'#news',itemListElement:newsIn(language).map((item,index)=>({'@type':'ListItem',position:index+1,name:item.title,url:WEBSITE_ORIGIN+sitePath(language,'newsArticle',item.slug)}))});
  if(boot.route.kind==='journal'){
    const start=((boot.route.page||1)-1)*12;
    graph.push({'@type':'ItemList','@id':meta.canonical+'#articles',itemListElement:boot.articles.slice(start,start+12).map((article,index)=>({'@type':'ListItem',position:start+index+1,name:article.title,url:WEBSITE_ORIGIN+sitePath(language,'article',article.slug)}))});
  }
  const questions=faqs(boot);
  if(questions.length)graph.push({'@type':'FAQPage','@id':meta.canonical+'#faq',inLanguage:language,mainEntity:questions.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))});
  if(['ovulation','dueDate'].includes(boot.route.kind))graph.push({'@type':'WebApplication','@id':meta.canonical+'#calculator',name:boot.copy[boot.route.kind==='ovulation'?'ovulation':'dueDate'],
    url:meta.canonical,applicationCategory:'HealthApplication',operatingSystem:'Any',inLanguage:language,isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}});
  if(isCalcPage(boot.route.kind))graph.push({'@type':'WebApplication','@id':meta.canonical+'#calculator',name:calcContent(language)[boot.route.kind].name,description:meta.description,
    url:meta.canonical,applicationCategory:'HealthApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript',inLanguage:language,isAccessibleForFree:true,
    offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},publisher:{'@id':ORGANIZATION_ID}});
  graph.push({'@type':'MobileApplication','@id':APP_ID,name:'Anacan',alternateName:'Anacan: Flow, Pregnancy & Baby',description:boot.copy.faq1Answer,
    applicationCategory:'HealthApplication',operatingSystem:['iOS','Android'],url:WEBSITE_ORIGIN+sitePath(language,'features'),downloadUrl:[APP_STORE_URL,GOOGLE_PLAY_URL],
    sameAs:[APP_STORE_URL,GOOGLE_PLAY_URL],
    identifier:[{'@type':'PropertyValue',propertyID:'App Store ID',value:'6758301924'},{'@type':'PropertyValue',propertyID:'Google Play package',value:'com.atlasoon.anacan'}],
    featureList:DETAIL_PAGES.map((kind:DetailPage)=>boot.details?.[`${kind}Description` as keyof NonNullable<WebsiteBoot['details']>]).filter(Boolean),
    inLanguage:WEBSITE_LANGUAGES.map(item=>item.code),publisher:{'@id':ORGANIZATION_ID}});
  return {'@context':'https://schema.org','@graph':graph};
}
export function updateWebsiteHead(boot:WebsiteBoot) {
  const meta=websiteMeta(boot);
  document.title=meta.title;document.documentElement.lang=boot.route.language;document.documentElement.dir=boot.route.language==='ar'?'rtl':'ltr';
  const setMeta=(key:string,value:string,property=false)=>{
    const attr=property?'property':'name',node=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)||document.createElement('meta');
    node.setAttribute(attr,key);node.content=value;if(!node.parentNode)document.head.append(node);
  };
  setMeta('description',meta.description);setMeta('robots',meta.robots);
  setMeta('theme-color','#ffe7e1');
  for(const[key,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.canonical,'og:type':boot.article?'article':'website','og:image':meta.image,'og:image:alt':meta.imageAlt,'og:site_name':'Anacan','og:locale':meta.locale}))setMeta(key,value,true);
  document.head.querySelectorAll('meta[property="og:image:width"],meta[property="og:image:height"]').forEach(node=>node.remove());
  if(meta.imageSize){setMeta('og:image:width',String(meta.imageSize[0]),true);setMeta('og:image:height',String(meta.imageSize[1]),true);}
  for(const[key,value]of Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt}))setMeta(key,value);
  document.head.querySelectorAll('link[rel="canonical"],link[hreflang],meta[property="article:published_time"],meta[property="article:modified_time"]').forEach(node=>node.remove());
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=meta.canonical;document.head.append(canonical);
  if(boot.route.kind!=='notFound')for(const item of meta.alternates){const link=document.createElement('link');link.rel='alternate';link.hreflang=item.code;link.href=item.url;document.head.append(link);}
  if(boot.article){setMeta('article:published_time',boot.article.publishedAt,true);setMeta('article:modified_time',boot.article.updatedAt,true);}
  setMeta('apple-itunes-app','app-id=6758301924');
  document.head.querySelectorAll('link[data-llm-discovery],meta[property="og:locale:alternate"]').forEach(node=>node.remove());
  if(boot.route.kind!=='notFound'){
    for(const item of discoveryLinks(boot.route)){const link=document.createElement('link');link.rel=item.rel;link.type=item.type;link.href=item.href;link.dataset.llmDiscovery='';document.head.append(link);}
    for(const item of meta.alternates.filter(item=>(item.code as string)!=='x-default'&&item.code!==boot.route.language)){const node=document.createElement('meta');node.setAttribute('property','og:locale:alternate');node.content=item.locale.replace('-','_');document.head.append(node);}
  }
  document.head.querySelector('script[data-website-schema]')?.remove();
  if(boot.route.kind!=='notFound'){const script=document.createElement('script');script.type='application/ld+json';script.dataset.websiteSchema='';script.textContent=JSON.stringify(websiteSchema(boot));document.head.append(script);}
}
