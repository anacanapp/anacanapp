import { CalendarDays,Heart,NotebookPen,UsersRound,ArrowRight } from 'lucide-react';
import {useWebsite} from './context';
import {Arrow,ArticleCard,DownloadCard,Eyebrow,SectionHeading} from './components';
import {Character,CharacterFamily} from './Characters';
import type {DetailPage} from './routes';
import type {WebsiteCopyKey} from './model';

const companions:Record<DetailPage,'cycle'|'pregnancy'|'motherhood'>={cycle:'cycle',pregnancy:'pregnancy',motherhood:'motherhood',partner:'pregnancy',memories:'motherhood',ai:'pregnancy',community:'motherhood',health:'cycle'};
const pageTools:Record<DetailPage,Array<'ovulation'|'dueDate'|'symptoms'|'simulator'>>={cycle:['ovulation'],pregnancy:['dueDate','symptoms'],motherhood:['simulator'],partner:['simulator'],memories:[],ai:[],community:[],health:['ovulation','dueDate']};
const connected:Record<DetailPage,DetailPage[]>={cycle:['health','ai','community'],pregnancy:['partner','memories','ai'],motherhood:['memories','health','community'],partner:['pregnancy','motherhood','health'],memories:['pregnancy','motherhood','partner'],ai:['cycle','pregnancy','motherhood'],community:['cycle','pregnancy','motherhood'],health:['cycle','pregnancy','motherhood']};
export default function DetailPageView({kind}:{kind:DetailPage}) {
  const {t,href,articles}=useWebsite();
  const stage=kind==='cycle'?'flow':kind==='pregnancy'?'bump':kind==='motherhood'?'mommy':null;
  const related=articles.filter(article=>!stage||article.stages.includes(stage)||article.stages.includes('all')).slice(0,3);
  return <>
    <nav className="site-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span>/</span><span>{t(`${kind}Label`)}</span></nav>
    <section className="site-detail-hero"><div><Eyebrow>{t(`${kind}Label`)}</Eyebrow><h1>{t(`${kind}Title`)}</h1><p>{t(`${kind}Description`)}</p><div className="site-result-actions"><a className="site-primary-button" href={href('download')}>{t('detailAppAction')}<Arrow diagonal/></a><a href="#detail-benefits" className="site-ghost-button">{t('explore')}<Arrow/></a></div></div>
      <div className={`site-detail-character site-detail-${kind}`}>{kind==='partner'||kind==='community'?<CharacterFamily/>:<Character kind={companions[kind]} pose={kind==='memories'?'value':kind==='health'?'data':kind==='ai'?'value':'welcome'} priority/>}<span>{t('detailCompanionNote')}</span></div>
    </section>
    <p className="site-detail-intro">{t(`${kind}Intro`)}</p>
    <section className="site-section" id="detail-benefits"><SectionHeading title="detailBenefitsTitle"/><div className="site-detail-benefits">{[1,2,3,4].map((number)=><article key={number}><span className="site-detail-number">0{number}</span><h2>{t(`${kind}Benefit${number}Title` as WebsiteCopyKey)}</h2><p>{t(`${kind}Benefit${number}Text` as WebsiteCopyKey)}</p></article>)}</div></section>
    <section className="site-section"><SectionHeading title="detailHowTitle"/><ol className="site-detail-steps">{[1,2,3].map(number=><li key={number}><span>{number}</span><h3>{t(`${kind}Step${number}Title` as WebsiteCopyKey)}</h3><p>{t(`${kind}Step${number}Text` as WebsiteCopyKey)}</p></li>)}</ol></section>
    {!!pageTools[kind].length&&<section className="site-section"><SectionHeading title="detailToolsTitle"/><div className="site-detail-tool-links">{pageTools[kind].map(tool=><a key={tool} href={href(tool)}><CalendarDays size={23} strokeWidth={1.5}/><div><h3>{t(tool)}</h3><p>{t(`${tool}Description`)}</p></div><Arrow diagonal/></a>)}</div></section>}
    <section className="site-section"><SectionHeading title="detailMoreTitle"/><div className="site-detail-connected">{connected[kind].map(page=><a key={page} href={href(page)}><strong>{t(`${page}Label`)}</strong><p>{t(`${page}Description`)}</p><span className="site-text-link">{t('explore')}<Arrow diagonal/></span></a>)}</div></section>
    {!!related.length&&<section className="site-section"><SectionHeading title="detailRelatedTitle" action={<a href={href('journal')} className="site-text-link">{t('allArticles')}<Arrow diagonal/></a>}/><div className="site-article-grid">{related.map(article=><ArticleCard key={article.id} article={article}/>)}</div></section>}
    <DownloadCard/>
  </>;
}
