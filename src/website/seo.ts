import { APP_LANGUAGES, type AppLanguageCode } from '../lib/app-languages';
import type { WebsiteBoot, WebsiteCopyKey } from './model';
import { alternateRoute, APP_STORE_URL, GOOGLE_PLAY_URL, routePath, sitePath, WEBSITE_ORIGIN,DETAIL_PAGES,type DetailPage } from './routes';

const ORGANIZATION_ID=WEBSITE_ORIGIN+'/#organization';
const WEBSITE_ID=WEBSITE_ORIGIN+'/#website';
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
  const title=kind==='article'?boot.article?.seoTitle||copy.notFound:detail?copy[`${kind}Title` as WebsiteCopyKey]:copy[labels[0]];
  const description=kind==='article'?boot.article?.seoDescription||copy.notFoundDescription:detail?copy[`${kind}Description` as WebsiteCopyKey]:copy[labels[1]];
  const suffix=boot.route.kind==='journal'&&(boot.route.page||1)>1?` — ${boot.copy.page.replace('{count}',String(boot.route.page))}`:'';
  const canonical=WEBSITE_ORIGIN+routePath(boot.route);
  const image=new URL(boot.article?.cover||'/website/og-cover.jpg',WEBSITE_ORIGIN).href;
  const available=boot.route.kind==='article'?APP_LANGUAGES.filter(item=>boot.article?.slugs[item.code]):APP_LANGUAGES;
  const alternates=available.map(({code,locale})=>({code,locale,url:WEBSITE_ORIGIN+alternateRoute(boot.route,code,boot.article)}));
  alternates.push({code:'x-default' as AppLanguageCode,locale:'az-AZ',url:WEBSITE_ORIGIN+(alternateRoute(boot.route,'az',boot.article)||sitePath('az'))});
  return {title:(title+suffix).includes('Anacan')?title+suffix:title+suffix+' | Anacan',description,canonical,image,
    imageAlt:boot.article?.coverAlt||'Anacan',locale:APP_LANGUAGES.find(item=>item.code===boot.route.language)!.locale.replace('-','_'),alternates};
}
function faqs(boot:WebsiteBoot) {
  const {kind}=boot.route;
  if(kind==='article')return boot.article?.faq||[];
  const prefix=kind==='ovulation'?'ovulationFaq':kind==='dueDate'?'dueDateFaq':kind==='symptoms'?'symptomsFaq':'faq';
  const numbers=kind==='home'?[1,2,3,4,5]:kind==='faq'?[1,2,3,4,5,6,7,8]:kind==='ovulation'?[1,2,3,4]:kind==='dueDate'||kind==='symptoms'?[1,2]:kind==='tools'?[5,4]:[];
  return numbers.map(number=>({question:boot.copy[`${prefix}${number}Question` as WebsiteCopyKey],answer:boot.copy[`${prefix}${number}Answer` as WebsiteCopyKey]}));
}
export function websiteSchema(boot:WebsiteBoot) {
  const meta=websiteMeta(boot),language=boot.route.language,graph:Record<string,unknown>[]=[];
  graph.push({'@type':'Organization','@id':ORGANIZATION_ID,name:'Anacan',url:WEBSITE_ORIGIN,logo:{'@type':'ImageObject',url:WEBSITE_ORIGIN+'/brand-mark.png'},
    email:'info@anacan.az',sameAs:['https://instagram.com/anacanapp','https://facebook.com/anacanapp','https://youtube.com/@anacanapp']});
  graph.push({'@type':'WebSite','@id':WEBSITE_ID,name:'Anacan',url:WEBSITE_ORIGIN,publisher:{'@id':ORGANIZATION_ID},inLanguage:APP_LANGUAGES.map(item=>item.code)});
  graph.push({'@type':boot.route.kind==='journal'?'CollectionPage':boot.route.kind==='contact'?'ContactPage':'WebPage','@id':meta.canonical+'#webpage',url:meta.canonical,
    name:meta.title,description:meta.description,inLanguage:language,isPartOf:{'@id':WEBSITE_ID},publisher:{'@id':ORGANIZATION_ID},isAccessibleForFree:true});
  if(boot.route.kind!=='home'&&boot.route.kind!=='notFound'){
    const items=[{'@type':'ListItem',position:1,name:boot.copy.home,item:WEBSITE_ORIGIN+sitePath(language)}];
    if(boot.route.kind==='article')items.push({'@type':'ListItem',position:2,name:boot.copy.journal,item:WEBSITE_ORIGIN+sitePath(language,'journal')});
    items.push({'@type':'ListItem',position:items.length+1,name:boot.article?.title||meta.title,item:meta.canonical});
    graph.push({'@type':'BreadcrumbList','@id':meta.canonical+'#breadcrumb',itemListElement:items});
  }
  if(boot.route.kind==='article'&&boot.article){
    const article=boot.article;
    graph.push({'@type':'BlogPosting','@id':meta.canonical+'#article',headline:article.title,description:meta.description,inLanguage:language,
      mainEntityOfPage:{'@id':meta.canonical+'#webpage'},datePublished:article.publishedAt,dateModified:article.updatedAt,
      author:article.author==='Anacan'?{'@id':ORGANIZATION_ID}:{'@type':'Person',name:article.author},publisher:{'@id':ORGANIZATION_ID},
      image:{'@type':'ImageObject',url:meta.image,width:1200,height:630},keywords:article.tags.join(', '),citation:article.references.map(reference=>reference.url),
      articleSection:article.category,isAccessibleForFree:true});
  }
  if(boot.route.kind==='journal'){
    const start=((boot.route.page||1)-1)*12;
    graph.push({'@type':'ItemList','@id':meta.canonical+'#articles',itemListElement:boot.articles.slice(start,start+12).map((article,index)=>({'@type':'ListItem',position:start+index+1,name:article.title,url:WEBSITE_ORIGIN+sitePath(language,'article',article.slug)}))});
  }
  const questions=faqs(boot);
  if(questions.length)graph.push({'@type':'FAQPage','@id':meta.canonical+'#faq',inLanguage:language,mainEntity:questions.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))});
  if(['ovulation','dueDate'].includes(boot.route.kind))graph.push({'@type':'WebApplication','@id':meta.canonical+'#calculator',name:boot.copy[boot.route.kind==='ovulation'?'ovulation':'dueDate'],
    url:meta.canonical,applicationCategory:'HealthApplication',operatingSystem:'Any',inLanguage:language,isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}});
  if(['home','features','download'].includes(boot.route.kind))graph.push({'@type':'MobileApplication','@id':WEBSITE_ORIGIN+'/#app',name:'Anacan',
    applicationCategory:'HealthApplication',operatingSystem:'iOS, Android',url:WEBSITE_ORIGIN+sitePath(language,'download'),downloadUrl:[APP_STORE_URL,GOOGLE_PLAY_URL],
    inLanguage:APP_LANGUAGES.map(item=>item.code),publisher:{'@id':ORGANIZATION_ID}});
  return {'@context':'https://schema.org','@graph':graph};
}
export function updateWebsiteHead(boot:WebsiteBoot) {
  const meta=websiteMeta(boot);
  document.title=meta.title;document.documentElement.lang=boot.route.language;document.documentElement.dir=boot.route.language==='ar'?'rtl':'ltr';
  const setMeta=(key:string,value:string,property=false)=>{
    const attr=property?'property':'name',node=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)||document.createElement('meta');
    node.setAttribute(attr,key);node.content=value;if(!node.parentNode)document.head.append(node);
  };
  setMeta('description',meta.description);setMeta('robots',boot.route.kind==='notFound'?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1');
  setMeta('theme-color','#ffe7e1');
  for(const[key,value]of Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.canonical,'og:type':boot.article?'article':'website','og:image':meta.image,'og:image:alt':meta.imageAlt,'og:site_name':'Anacan','og:locale':meta.locale,'og:image:width':'1200','og:image:height':'630'}))setMeta(key,value,true);
  for(const[key,value]of Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt}))setMeta(key,value);
  document.head.querySelectorAll('link[rel="canonical"],link[hreflang],meta[property="article:published_time"],meta[property="article:modified_time"]').forEach(node=>node.remove());
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=meta.canonical;document.head.append(canonical);
  if(boot.route.kind!=='notFound')for(const item of meta.alternates){const link=document.createElement('link');link.rel='alternate';link.hreflang=item.code;link.href=item.url;document.head.append(link);}
  if(boot.article){setMeta('article:published_time',boot.article.publishedAt,true);setMeta('article:modified_time',boot.article.updatedAt,true);}
  document.head.querySelector('script[data-website-schema]')?.remove();
  if(boot.route.kind!=='notFound'){const script=document.createElement('script');script.type='application/ld+json';script.dataset.websiteSchema='';script.textContent=JSON.stringify(websiteSchema(boot));document.head.append(script);}
}
