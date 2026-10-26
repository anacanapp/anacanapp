import { MessageCircle, UsersRound, HeartHandshake, NotebookPen, Camera, ShieldCheck, CalendarDays } from 'lucide-react';
import { APP_LANGUAGES } from '../lib/app-languages';
import { useWebsite } from './context';
import { Arrow, ArticleCard, DownloadCard, Eyebrow, FaqList, SectionHeading, ToolCards } from './components';
import { Character,CharacterFamily } from './Characters';
import { Heart } from 'lucide-react';

export function FeatureGrid() {
  const {t,href}=useWebsite();
  return <div className="site-feature-grid">
    <article className="site-feature-card site-feature-photo"><div className="site-feature-character"><Character kind="motherhood" pose="value"/></div><div><Camera size={22} strokeWidth={1.5}/><h3>{t('featureMemoryTitle')}</h3><p>{t('featureMemoryDescription')}</p><a href={href('memories')} className="site-text-link">{t('explore')}<Arrow diagonal/></a></div></article>
    {([
      ['featureAiTitle','featureAiDescription',MessageCircle,'sky','ai'],
      ['featureCommunityTitle','featureCommunityDescription',UsersRound,'mint','community'],
      ['featurePartnerTitle','featurePartnerDescription',HeartHandshake,'peach','partner'],
      ['featureHealthTitle','featureHealthDescription',NotebookPen,'white','health'],
    ] as const).map(([title,description,Icon,tint,link])=><article className={`site-feature-card site-feature-${tint}`} key={title}><span className={`site-icon-wash site-wash-${tint}`}><Icon size={23} strokeWidth={1.5}/></span><h3>{t(title)}</h3><p>{t(description)}</p><a href={href(link)} className="site-text-link">{t('explore')}<Arrow diagonal/></a></article>)}
    <article className="site-feature-card site-feature-privacy"><ShieldCheck size={23} strokeWidth={1.5}/><div><h3>{t('featurePrivacyTitle')}</h3><p>{t('featurePrivacyDescription')}</p></div><a href={href('privacy')} aria-label={t('privacy')}><Arrow diagonal/></a></article>
  </div>;
}
export function StageCards() {
  const {href,t}=useWebsite();
  return <div className="site-stage-grid">{([
    ['flow','cycle','peach'],
    ['bump','pregnancy','peach'],
    ['mommy','motherhood','peach'],
  ] as const).map(([stage,kind,tint])=><a className="site-stage-card" href={href(kind)} key={stage}><div className={`site-stage-image site-stage-character site-stage-${kind}`}><Character kind={kind}/><span className={`site-tag site-wash-${tint}`}>{t(`${kind}Label`)}</span></div><div className="site-stage-copy"><h3>{t(`${stage}Title`)}</h3><p>{t(`${stage}Description`)}</p><span className="site-text-link">{t('explore')}<Arrow diagonal/></span></div></a>)}</div>;
}
export default function Home() {
  const {href,t,articles}=useWebsite();
  return <>
    <section className="site-hero site-hero-anacan">
      <div className="site-hero-copy"><Eyebrow>{t('heroEyebrow')}</Eyebrow><h1>{t('heroPrefix')}<br/><em>{t('heroEmphasis')}</em></h1><p className="site-hero-description">{t('heroDescription')}</p>
        <div className="site-hero-actions"><a className="site-primary-button" href={href('download')}>{t('heroAction')}<Arrow diagonal/></a><a href="#stages" className="site-ghost-button">{t('heroSecondary')}<Arrow/></a></div><p className="site-hero-footnote">{t('heroTrust')}</p>
        <nav className="site-hero-stage-links" aria-label={t('stageTitle')}>{(['cycle','pregnancy','motherhood','partner'] as const).map(kind=><a href={href(kind)} key={kind}>{t(`${kind}Label`)}<Arrow diagonal/></a>)}</nav>
      </div>
      <div className="site-hero-scene"><div className="site-hero-character-wash" aria-hidden="true"/><CharacterFamily/><div className="site-hero-care-note"><span className="site-icon-wash site-wash-peach"><Heart size={21} strokeWidth={1.5}/></span><div><strong>{t('heroNoteTitle')}</strong><p>{t('heroNoteText')}</p></div></div></div>
    </section>
    <div className="site-language-strip"><span>{t('languageCount')}</span><div>{APP_LANGUAGES.slice(0,9).map(language=><span key={language.code} lang={language.code}>{language.native_name}</span>)}<span>+12</span></div></div>
    <section className="site-section" id="stages"><SectionHeading eyebrow="stageEyebrow" title="stageTitle" description="stageDescription"/><StageCards/></section>
    <section className="site-section" id="features"><SectionHeading eyebrow="featureEyebrow" title="featureTitle" description="featureDescription"/><FeatureGrid/></section>
    <section className="site-section" id="tools"><SectionHeading eyebrow="toolsEyebrow" title="toolsTitle" description="toolsDescription"/><ToolCards compact/></section>
    <section className="site-section" id="journal"><SectionHeading eyebrow="journalEyebrow" title="journalTitle" description="journalDescription" action={<a className="site-text-link" href={href('journal')}>{t('allArticles')}<Arrow diagonal/></a>}/><div className="site-article-grid">{articles.slice(0,3).map(article=><ArticleCard article={article} key={article.id}/>)}</div></section>
    <section className="site-section site-faq-section"><SectionHeading title="faq" description="faqDescription"/><FaqList keys={[1,2,3,4,5]}/></section>
    <DownloadCard/>
  </>;
}
