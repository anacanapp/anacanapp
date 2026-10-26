import { useEffect, useMemo, useState } from 'react';
import { Search, X, Link2 } from 'lucide-react';
import BlogContent from '../components/blog/BlogContent';
import { APP_LANGUAGES } from '../lib/app-languages';
import { useWebsite } from './context';
import { Arrow, ArticleCard, Breadcrumb, categoryKey, DownloadCard, Eyebrow, Intro } from './components';
import type { WebsiteCopyKey } from './model';
import { WEBSITE_ORIGIN, sitePath } from './routes';
import { refreshGoogleArticles } from './api';
import {siteDate} from './dates';
import {renderArticleContent} from './article-content';

export const JOURNAL_PAGE_SIZE=12;
function queryState() {
  if(typeof window==='undefined')return {q:'',category:'',stage:''};
  const params=new URLSearchParams(window.location.search);
  return {q:params.get('q')||'',category:params.get('category')||'',stage:params.get('stage')||''};
}
export default function Journal() {
  const {articles:initialArticles,route,t,href}=useWebsite();
  const [articles,setArticles]=useState(initialArticles);
  const [filters,setFilters]=useState({q:'',category:'',stage:''});
  useEffect(()=>setFilters(queryState()),[]);
  useEffect(()=>{
    const controller=new AbortController();
    void refreshGoogleArticles(route.language,initialArticles,controller.signal).then(setArticles).catch(()=>{});
    return ()=>controller.abort();
  },[route.language,initialArticles]);
  const filtering=!!(filters.q||filters.category||filters.stage);
  const all=useMemo(()=>articles.filter(article=>(!filters.category||article.category===filters.category)
    &&(!filters.stage||article.stages.includes(filters.stage)||article.stages.includes('all'))
    &&`${article.title} ${article.excerpt} ${article.tags.join(' ')}`.toLocaleLowerCase(route.language).includes(filters.q.toLocaleLowerCase(route.language))),[articles,filters,route.language]);
  const [filteredPage,setFilteredPage]=useState(1);
  const page=filtering?filteredPage:route.page||1,count=Math.max(1,Math.ceil(all.length/JOURNAL_PAGE_SIZE));
  const visible=all.slice((page-1)*JOURNAL_PAGE_SIZE,page*JOURNAL_PAGE_SIZE);
  const setFilter=(key:keyof typeof filters,value:string)=>{
    setFilters(prior=>({...prior,[key]:value}));setFilteredPage(1);
    const next={...filters,[key]:value},params=new URLSearchParams();
    for(const[name,item]of Object.entries(next))if(item)params.set(name,item);
    window.history.replaceState(null,'',href('journal')+(params.size?'?'+params.toString():''));
  };
  return <><Intro title="journalTitle" description="journalDescription" eyebrow="journalEyebrow"/>
    <form className="site-search" action={href('journal')} method="get" onSubmit={event=>event.preventDefault()}><Search size={21} strokeWidth={1.5} aria-hidden="true"/><label className="site-sr" htmlFor="journal-search">{t('search')}</label><input type="search" id="journal-search" name="q" value={filters.q} placeholder={t('searchPlaceholder')} onChange={event=>setFilter('q',event.target.value)}/>{filters.q&&<button type="button" onClick={()=>setFilter('q','')} aria-label={t('clearSearch')}><X size={18}/></button>}<button type="submit" className="site-outline-button">{t('searchAction')}<Arrow/></button></form>
    <div className="site-journal-filters"><div className="site-filter-tabs" aria-label={t('category')}><button onClick={()=>setFilter('category','')} aria-pressed={!filters.category}>{t('all')}</button>{[...new Set(articles.map(article=>article.category))].map(category=><button key={category} aria-pressed={filters.category===category} onClick={()=>setFilter('category',category)}>{t(categoryKey(category))}</button>)}</div><label className="site-stage-filter"><span className="site-sr">{t('stageTitle')}</span><select value={filters.stage} onChange={event=>setFilter('stage',event.target.value)} aria-label={t('stageTitle')}><option value="">{t('all')}</option>{(['flow','bump','mommy'] as const).map(stage=><option key={stage} value={stage}>{t(stage)}</option>)}</select></label></div>
    <p className="site-results-count" role="status">{t('results',{count:all.length})}</p>
    {!visible.length&&<p className="site-no-results">{t('noResults')}</p>}<div className="site-article-grid">{visible.map(article=><ArticleCard key={article.id} article={article}/>)}</div>
    {count>1&&<nav className="site-pagination" aria-label={t('pagination')}>{Array.from({length:count},(_,index)=>index+1).map(number=>filtering?<button key={number} aria-current={number===page?'page':undefined} aria-label={t('page',{count:number})} onClick={()=>{setFilteredPage(number);window.scrollTo({top:0});}}>{number}</button>:<a key={number} href={href('journal',undefined,number)} aria-current={number===page?'page':undefined} aria-label={t('page',{count:number})}>{number}</a>)}</nav>}
    <DownloadCard/>
  </>;
}
export function ArticlePage() {
  const {article,articles,route,t,href}=useWebsite();
  const [shareStatus,setShareStatus]=useState('');
  const rendered=useMemo(()=>article?.contentFormat==='anacan-article-html-v1'?{content:article.content||'',headings:article.headings}:renderArticleContent(article?.content||'',{footnotesLabel:t('references')}),[article?.content,article?.contentFormat,article?.headings,route.language]);
  if(!article)return null;
  const locale=APP_LANGUAGES.find(item=>item.code===route.language)!.locale;
  const related=[...articles].filter(item=>item.id!==article.id).sort((a,b)=>Number(article.relatedIds.includes(b.id))-Number(article.relatedIds.includes(a.id))||Number(b.category===article.category)-Number(a.category===article.category)).slice(0,3);
  const share=async()=>{
    const url=WEBSITE_ORIGIN+sitePath(route.language,'article',article.slug);
    try{
      if(navigator.share)await navigator.share({title:article.title,url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);setShareStatus(t('copied'));}
      else{const input=document.createElement('textarea');input.value=url;input.style.cssText='position:fixed;opacity:0';document.body.append(input);input.select();const result=document.execCommand('copy');input.remove();if(!result)throw new Error('COPY_FAILED');setShareStatus(t('copied'));}
    }catch(error){if((error as Error).name!=='AbortError')setShareStatus(t('shareError'));}
  };
  return <><nav className="site-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span aria-hidden="true">/</span><a href={href('journal')}>{t('journal')}</a><span aria-hidden="true">/</span><span>{article.title}</span></nav>
    <article className="site-article" data-website-article={article.id}>
      <header className="site-article-header"><Eyebrow>{t(categoryKey(article.category))}</Eyebrow><h1>{article.title}</h1><p className="site-article-summary">{article.excerpt}</p><div className="site-article-meta"><span>{article.author==='Anacan'?t('author'):article.author}</span><span>{t('readMinutes',{count:article.minutes})}</span><span>{t('updated')} <time dateTime={article.updatedAt}>{siteDate(article.updatedAt,route.language)}</time></span><button type="button" onClick={()=>void share()}><Link2 size={16}/>{t('share')}</button></div><span role="status">{shareStatus}</span></header>
      {article.cover&&<img className="site-article-cover" src={article.cover} width="1200" height="630" alt={article.coverAlt} fetchPriority="high" decoding="async"/>}
      <div className="site-article-reader"><aside><nav className="site-toc" aria-label={t('toc')}><h2>{t('toc')}</h2><ol>{rendered.headings.map(heading=><li key={heading.id}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol></nav></aside><div>
        <BlogContent content={rendered.content} prepared className="site-prose"/>
        {!!article.faq.length&&<section className="site-article-section"><h2>{t('faq')}</h2><div className="site-faq-list">{article.faq.map(faq=><details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div></section>}
        {!!article.modules.length&&<section className="site-article-section"><h2>{t('modules')}</h2><div className="site-article-tags">{article.modules.map(module=><a key={module} className="site-outline-button" href={`https://app.anacan.az/?blog_module=${encodeURIComponent(module)}&blog_language=${route.language}`}>{t(module as WebsiteCopyKey)}<Arrow diagonal/></a>)}</div></section>}
        {!!article.references.length&&<section className="site-article-section site-references"><h2>{t('references')}</h2><ul>{article.references.map(reference=><li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}<Arrow diagonal/></a></li>)}</ul></section>}
        {!!article.tags.length&&<div className="site-article-tags">{[...new Set(article.tags)].map(tag=><a key={tag} href={`${href('journal')}?q=${encodeURIComponent(tag)}`}>{tag}</a>)}</div>}
      </div></div>
    </article><section className="site-section"><h2>{t('related')}</h2><div className="site-article-grid">{related.map(item=><ArticleCard article={item} key={item.id}/>)}</div></section><DownloadCard/>
  </>;
}
