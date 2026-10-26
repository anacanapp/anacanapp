import { useState } from 'react';
import { ArrowUpRight, ArrowRight, Menu, X, Globe2, ChevronDown, Smartphone, Heart, CalendarDays, BookOpen, Leaf } from 'lucide-react';
import { APP_LANGUAGES } from '../lib/app-languages';
import { alternateRoute, APP_STORE_URL, GOOGLE_PLAY_URL } from './routes';
import type { WebsiteCopyKey, WebsiteArticle } from './model';
import { useWebsite } from './context';

export function Arrow({ diagonal = false }: { diagonal?:boolean }) { return diagonal ? <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6}/> : <ArrowRight aria-hidden="true" size={18} strokeWidth={1.6}/>; }
export function Brand() {
  const { href } = useWebsite();
  return <a className="site-brand" href={href()} aria-label="Anacan"><img src="/brand-mark.png" width="36" height="36" alt=""/><span>anacan</span><i aria-hidden="true"/></a>;
}
export function WebsiteHeader() {
  const { route, article, basePath, href, t } = useWebsite();
  const [open,setOpen] = useState(false);
  return <>
    <a className="site-skip" href="#main">{t('skip')}</a>
    <header className="site-nav-wrap">
      <div className="site-nav">
        <Brand/>
        <nav className="site-nav-links" aria-label={t('home')}>
          <details className="site-nav-stages"><summary>{t('features')}<ChevronDown size={12}/></summary><div>{(['cycle','pregnancy','motherhood','partner'] as const).map(kind=><a href={href(kind)} key={kind}>{t(`${kind}Label`)}<Arrow diagonal/></a>)}<a href={href('features')}>{t('all')}<Arrow diagonal/></a></div></details>
          {(['tools','journal'] as const).map(kind => <a key={kind} href={href(kind)} aria-current={route.kind===kind?'page':undefined}>{t(kind)}</a>)}
        </nav>
        <div className="site-nav-actions">
          <label className="site-language"><Globe2 aria-hidden="true" size={16} strokeWidth={1.5}/><span className="site-sr">{t('language')}</span>
            <select value={route.language} aria-label={t('language')} onChange={event => {
              const code = event.target.value as typeof route.language;
              const path = alternateRoute(route,code,article);
              if (path) window.location.assign(basePath+path+window.location.search);
            }}>{APP_LANGUAGES.filter(item=>route.kind!=='article'||article?.slugs[item.code]).map(item=><option key={item.code} value={item.code} lang={item.code}>{item.native_name}</option>)}</select><ChevronDown aria-hidden="true" size={12}/>
          </label>
          <a className="site-nav-download" href={href('download')}>{t('download')}<Arrow diagonal/></a>
          <button className="site-menu-button" aria-label={t(open?'closeMenu':'menu')} aria-expanded={open} aria-controls="site-mobile-menu" onClick={()=>setOpen(value=>!value)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
        </div>
      </div>
      {open && <nav className="site-mobile-menu" id="site-mobile-menu" aria-label={t('menu')}>
        {(['cycle','pregnancy','motherhood','partner'] as const).map(kind=><a key={kind} href={href(kind)}>{t(`${kind}Label`)}<Arrow/></a>)}
        {(['features','tools','journal','faq','contact','download'] as const).map(kind=><a key={kind} href={href(kind)} aria-current={route.kind===kind?'page':undefined}>{t(kind)}<Arrow/></a>)}
      </nav>}
    </header>
  </>;
}
export function WebsiteFooter() {
  const {href,t,generatedAt} = useWebsite();
  return <footer className="site-footer">
    <div className="site-footer-top"><div><Brand/><p>{t('footerDescription')}</p></div>
      <nav aria-label={t('home')}><a href={href('journal')}>{t('journal')}</a><a href={href('tools')}>{t('tools')}</a><a href={href('faq')}>{t('faq')}</a><a href={href('contact')}>{t('contact')}</a></nav>
      <div className="site-footer-contact"><a href="mailto:info@anacan.az">info@anacan.az<Arrow diagonal/></a><span>{t('madeIn')}</span><div><a href="https://instagram.com/anacanapp" target="_blank" rel="noopener noreferrer">Instagram</a><a href="https://facebook.com/anacanapp" target="_blank" rel="noopener noreferrer">Facebook</a></div></div>
    </div>
    <div className="site-footer-bottom"><span>© {new Date(generatedAt).getUTCFullYear()} Anacan. {t('rights')}</span><nav aria-label={t('privacy')}><a href={href('privacy')}>{t('privacy')}</a><a href={href('terms')}>{t('terms')}</a></nav></div>
  </footer>;
}
export function Eyebrow({children,mint=false}: {children:React.ReactNode;mint?:boolean}) { return <p className={`site-eyebrow${mint?' site-eyebrow-mint':''}`}>{children}</p>; }
export function SectionHeading({eyebrow,title,description,action}: {eyebrow?:WebsiteCopyKey;title:WebsiteCopyKey;description?:WebsiteCopyKey;action?:React.ReactNode}) {
  const {t}=useWebsite();
  return <div className="site-section-heading"><div>{eyebrow&&<Eyebrow>{t(eyebrow)}</Eyebrow>}<h2>{t(title)}</h2>{description&&<p>{t(description)}</p>}</div>{action}</div>;
}
export function Intro({title,description,eyebrow}: {title:WebsiteCopyKey;description?:WebsiteCopyKey;eyebrow?:WebsiteCopyKey}) {
  const {t}=useWebsite();
  return <div className="site-page-intro">{eyebrow&&<Eyebrow>{t(eyebrow)}</Eyebrow>}<h1>{t(title)}</h1>{description&&<p>{t(description)}</p>}</div>;
}
export function FaqList({keys=[1,2,3,4,5,6,7,8],prefix='faq'}: {keys?:number[];prefix?:'faq'|'ovulationFaq'|'dueDateFaq'|'symptomsFaq'}) {
  const {t}=useWebsite();
  return <div className="site-faq-list">{keys.map(number=><details key={number}><summary>{t(`${prefix}${number}Question` as WebsiteCopyKey)}<span aria-hidden="true">+</span></summary><p>{t(`${prefix}${number}Answer` as WebsiteCopyKey)}</p></details>)}</div>;
}
export function StoreLinks() {
  const {t}=useWebsite();
  return <div className="site-store-links"><a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"><Smartphone size={23} strokeWidth={1.5}/><span><small>{t('appStore')}</small><strong>App Store</strong></span><Arrow diagonal/></a><a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer"><Smartphone size={23} strokeWidth={1.5}/><span><small>{t('googlePlay')}</small><strong>Google Play</strong></span><Arrow diagonal/></a></div>;
}
export function DownloadCard() {
  const {href,t}=useWebsite();
  return <section className="site-download-card"><div className="site-download-mark"><img src="/brand-mark.png" width="72" height="72" alt=""/></div><div><Eyebrow mint>{t('downloadEyebrow')}</Eyebrow><h2>{t('downloadTitle')}</h2><p>{t('downloadDescription')}</p></div><a href={href('download')} className="site-outline-button">{t('download')}<Arrow diagonal/></a></section>;
}
export function ArticleCard({article,featured=false}: {article:WebsiteArticle;featured?:boolean}) {
  const {href,t,route}=useWebsite();
  return <article className={`site-article-card${featured?' site-article-card-featured':''}`}><a href={href('article',article.slug)}>
    {article.cover?<img className="site-article-card-image" src={article.cover} alt={article.coverAlt} width="1200" height="630" loading="lazy" decoding="async"/>:<div className="site-article-card-placeholder" aria-hidden="true"><BookOpen size={34} strokeWidth={1}/></div>}
    <div className="site-article-card-copy"><div className="site-card-meta"><span>{t(categoryKey(article.category))}</span><span>{t('readMinutes',{count:new Intl.NumberFormat(route.language).format(article.minutes)})}</span></div><h3>{article.title}</h3><p>{article.excerpt}</p><span className="site-text-link">{t('readMore')}<Arrow diagonal/></span></div>
  </a></article>;
}
export function categoryKey(slug:string):WebsiteCopyKey {
  return ({'korpe-baximi':'categoryBaby','hamiləlik':'categoryPregnancy','menstrual-sağlamlıq':'categoryCycle','qidalanma':'categoryNutrition',
    'saglamliq':'categoryHealth','psixologiya':'categoryPsychology','motivasiya':'categoryMotivation','məşqlər':'categoryExercise','digər':'categoryOther'} as Record<string,WebsiteCopyKey>)[slug]||'categoryOther';
}
export function ToolCards({compact=false}:{compact?:boolean}) {
  const {href,t}=useWebsite();
  return <div className={`site-tool-grid${compact?' site-tool-grid-compact':''}`}>{([
    ['ovulation',CalendarDays,'mint'],['dueDate',Heart,'peach'],['symptoms',Leaf,'sky'],['simulator',BookOpen,'white'],
  ] as const).slice(0,compact?3:4).map(([kind,Icon,color])=><a className="site-tool-card" href={href(kind)} key={kind}><span className={`site-icon-wash site-wash-${color}`}><Icon size={23} strokeWidth={1.5}/></span><small>{t('freeTool')}</small><h3>{t(kind)}</h3><p>{t(`${kind}Description`)}</p><span className="site-text-link">{t(kind==='ovulation'||kind==='dueDate'?'calculate':'explore')}<Arrow/></span></a>)}</div>;
}
export function Breadcrumb({label}: {label:string}) {
  const {href,t}=useWebsite();
  return <nav className="site-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span aria-hidden="true">/</span><span>{label}</span></nav>;
}
export function LanguageLinks() {
  const {route,article,basePath,t}=useWebsite();
  return <nav className="site-language-links" aria-label={t('language')}>{APP_LANGUAGES.map(item=>{
    const path=alternateRoute(route,item.code,article);
    return path&&<a key={item.code} href={basePath+path} lang={item.code} hrefLang={item.code} aria-current={item.code===route.language?'page':undefined}>{item.native_name}</a>;
  })}</nav>;
}
