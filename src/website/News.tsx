/** News in Azerbaijani and English ("Xəbərlər" / "News": home section, list and detail pages) and the partner
 * logo strip shown on the home page of every language. Texts are inline (no copy keys), data lives in news.ts. */
import { useEffect, useRef, useState } from 'react';
import type { WebsiteLanguageCode } from '../lib/app-languages';
import { useWebsite } from './context';
import { Arrow, DownloadCard, Eyebrow } from './components';
import { siteDate } from './dates';
import { PARTNER_IDS, PARTNERS, findNews, isNewsLanguage, newsIn, NEWS_LABELS, type LocalNews, type NewsBlock, type NewsLanguage, type PartnerId } from './news';
import { HIGH_PRIORITY } from './images';
import './news.css';

const newsDate = (value: string, language: NewsLanguage) => language === 'az' ? siteDate(value, 'az').toLocaleLowerCase('az') : siteDate(value, language);
/** News language of the current page (only az and en pages render news). */
function useNewsLanguage(): NewsLanguage {
  const { route } = useWebsite();
  return isNewsLanguage(route.language) ? route.language : 'az';
}

/** Partner logo (file path per partner in news.ts); a text wordmark replaces a missing or broken file.
 * Square `icon` marks are followed by the name. SSR always outputs the <img>; an error that happened
 * before hydration is caught by decode(). */
export function PartnerLogo({ id, className = '' }: { id: PartnerId; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const node = image.current;
    if (node?.complete) node.decode().catch(() => setFailed(true));
  }, []);
  const { name, src, shape } = PARTNERS[id];
  if (failed) return <span className={`nw-wordmark ${className}`}>{name}</span>;
  if (shape === 'icon') return <span className={`nw-mark ${className}`}>
    <img ref={image} className="nw-logo nw-logo-icon" src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /><span className="nw-wordmark">{name}</span>
  </span>;
  return <img ref={image} className={`nw-logo nw-logo-wide ${className}`} src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function NewsMeta({ item }: { item: LocalNews }) {
  return <div className="nw-meta">
    {item.partner ? <span className="nw-meta-logo"><PartnerLogo id={item.partner} /></span> : <span className="nw-chip">{item.tag}</span>}
    <time dateTime={item.date}>{newsDate(item.date, item.language)}</time>
  </div>;
}

function NewsCard({ item }: { item: LocalNews }) {
  const { href } = useWebsite();
  return <article className="nw-card"><a href={href('newsArticle', item.slug)}>
    <img className="nw-cover" src={item.cover.src} alt="" width="1200" height="630" loading="lazy" decoding="async" />
    <div className="nw-card-body"><NewsMeta item={item} />
    <h3>{item.title}</h3>
    <p>{item.lead}</p>
    <span className="site-text-link">{NEWS_LABELS[item.language].read}<Arrow diagonal /></span></div>
  </a></article>;
}

/** Home page (az, en): the three newest items in that language. */
export function HomeNews() {
  const { href } = useWebsite();
  const language = useNewsLanguage(), labels = NEWS_LABELS[language];
  return <section className="site-section nw-home" id="news" aria-labelledby="news-heading">
    <div className="site-section-heading"><div><Eyebrow>{labels.eyebrow}</Eyebrow><h2 id="news-heading">{labels.news}</h2><p>{labels.homeIntro}</p></div>
      <a className="site-text-link" href={href('news')}>{labels.all}<Arrow diagonal /></a></div>
    <div className="nw-grid nw-grid-3">{newsIn(language).slice(0, 3).map((item) => <NewsCard item={item} key={item.id} />)}</div>
  </section>;
}

export function NewsListPage() {
  const { href, t } = useWebsite();
  const language = useNewsLanguage(), labels = NEWS_LABELS[language];
  return <>
    <nav className="site-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span aria-hidden="true">/</span><span>{labels.news}</span></nav>
    <div className="site-page-intro nw-intro"><Eyebrow>{labels.eyebrow}</Eyebrow><h1>{labels.news}</h1><p>{labels.listIntro}</p></div>
    <div className="nw-grid nw-grid-3">{newsIn(language).map((item) => <NewsCard item={item} key={item.id} />)}</div>
    <DownloadCard />
  </>;
}

function Block({ block }: { block: NewsBlock }) {
  if (block.type === 'h2') return <h2>{block.text}</h2>;
  if (block.type === 'list') return <ul>{block.items.map((text) => <li key={text}>{text}</li>)}</ul>;
  if (block.type === 'quote') return <blockquote><p>{block.text}</p></blockquote>;
  return <p>{block.text}</p>;
}

export function NewsArticlePage() {
  const { href, t, route } = useWebsite();
  const language = useNewsLanguage(), labels = NEWS_LABELS[language];
  const item = findNews(route.slug, language);
  if (!item) return null;
  const others = newsIn(language).filter((other) => other.id !== item.id).slice(0, 2);
  return <>
    <nav className="site-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span aria-hidden="true">/</span><a href={href('news')}>{labels.news}</a><span aria-hidden="true">/</span><span>{item.title}</span></nav>
    <article className="nw-article" data-news={item.id}>
      <header className="nw-article-header">
        <img className="nw-cover nw-article-cover" src={item.cover.src} alt={item.title} width="1200" height="630" {...HIGH_PRIORITY} />
        <div className="nw-article-meta"><span className="nw-chip">{item.tag}</span><time dateTime={item.date}>{newsDate(item.date, language)}</time><span>{labels.minutes(item.readMinutes)}</span></div>
        <h1>{item.title}</h1>
        <p className="nw-article-lead">{item.lead}</p>
      </header>
      <div className="site-prose nw-prose">{item.body.map((block, index) => <Block block={block} key={index} />)}</div>
      {(item.link || item.source) && <p className="nw-article-link">
        {item.link && <a className="site-primary-button" href={href(item.link.kind)}>{item.link.label}<Arrow diagonal /></a>}
        {item.source && <a className="site-outline-button" href={item.source.href} target="_blank" rel="noopener noreferrer">{item.source.label}<Arrow diagonal /></a>}
      </p>}
    </article>
    {!!others.length && <section className="site-section nw-others" aria-labelledby="news-others">
      <div className="site-section-heading"><div><h2 id="news-others">{labels.others}</h2></div><a className="site-text-link" href={href('news')}>{labels.all}<Arrow diagonal /></a></div>
      <div className="nw-grid nw-grid-2">{others.map((other) => <NewsCard item={other} key={other.id} />)}</div>
    </section>}
    <DownloadCard />
  </>;
}

const PARTNER_HEADING: Record<WebsiteLanguageCode, string> = {
  az: 'Ekosistem və tərəfdaşlar', en: 'Ecosystem and partners', tr: 'Ekosistem ve iş ortakları', ru: 'Экосистема и партнёры',
  de: 'Ökosystem und Partner', ar: 'المنظومة والشركاء', ka: 'ეკოსისტემა და პარტნიორები', kk: 'Экожүйе және серіктестер',
  uz: 'Ekotizim va hamkorlar', zh: '生态与合作伙伴', id: 'Ekosistem dan mitra', fr: 'Écosystème et partenaires',
  es: 'Ecosistema y socios', pt: 'Ecossistema e parceiros', vi: 'Hệ sinh thái và đối tác', hi: 'इकोसिस्टम और साझेदार',
  ja: 'エコシステムとパートナー', ko: '생태계 및 파트너', pl: 'Ekosystem i partnerzy', nl: 'Ecosysteem en partners', sv: 'Ekosystem och partner',
};

/** Partner logo strip for the home page of every language. */
export function PartnerStrip() {
  const { route } = useWebsite();
  return <section className="site-section nw-partners" aria-labelledby="partners-heading">
    <h2 id="partners-heading" className="nw-partners-title">{PARTNER_HEADING[route.language]}</h2>
    <ul className="nw-partner-grid">{PARTNER_IDS.map((id) => <li key={id}><PartnerLogo id={id} /></li>)}</ul>
  </section>;
}
