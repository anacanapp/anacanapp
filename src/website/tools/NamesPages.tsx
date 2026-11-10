/** Baby-name pages: hub, girl/boy lists, letter pages and name details (az, ka). SSR renders every list in
 * full so it is crawlable; the search box only filters what is already in the HTML. */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { sitePath } from '../routes';
import { AppToolCard } from './AppOpen';
import { genderNames, letterNames, letterPage, namesCopy, popularNames, similarNames, type NameEntry, type NamesCopy, type NamesIndex, type NamesLanguage } from './names';
import { namesIndex } from './tool-data';
import { toolMeta } from './tool-routes';
import './tools.css';

function useNames() {
  const boot = useWebsite();
  const copy = namesCopy(boot.route.language)!, index = namesIndex(boot.route.language as NamesLanguage)!;
  const path = (kind: 'names' | 'namesGender' | 'namesLetter' | 'nameDetail', slug?: string) => boot.basePath + sitePath(boot.route.language, kind, slug);
  return { ...boot, copy, index, path };
}
export function ToolBreadcrumb() {
  const { route, t, basePath } = useWebsite();
  const meta = toolMeta(route, { home: t('home'), tools: t('tools') });
  if (!meta) return null;
  return <nav className="site-breadcrumb" aria-label={t('home')}>{meta.breadcrumb.map((item, index) => index < meta.breadcrumb.length - 1
    ? <span className="tl-crumb" key={item.path}><a href={basePath + item.path}>{item.name}</a><span aria-hidden="true">/</span></span>
    : <span key={item.path}>{item.name}</span>)}</nav>;
}
function NamesAppCard() {
  const { copy } = useNames();
  return <AppToolCard tool="names" src="web-names" title={copy.appTitle} text={copy.appText} features={copy.appFeatures}/>;
}
function NameItem({ entry }: { entry: NameEntry }) {
  const { copy, path } = useNames();
  return <li><a href={path('nameDetail', entry.slug)}><strong>{entry.name}</strong><span className={`tl-badge tl-badge-${entry.gender}`}>{copy.genderShort[entry.gender]}</span><span className="tl-name-meaning">{entry.meaning}</span></a></li>;
}
function NameChips({ entries }: { entries: NameEntry[] }) {
  const { path } = useNames();
  return <ul className="tl-chips">{entries.map(entry => <li key={entry.slug}><a href={path('nameDetail', entry.slug)}>{entry.name}</a></li>)}</ul>;
}
function LetterIndex({ index, current }: { index: NamesIndex; current?: string }) {
  const { copy, path } = useNames();
  return <nav className="tl-letters" aria-label={copy.byLetter}>{index.letters.filter(letter => letter.page).map(letter =>
    <a key={letter.slug} href={path('namesLetter', letter.slug)} aria-current={letter.slug === current ? 'page' : undefined} title={copy.letterH1(letter.letter)}>{letter.letter}<small>{letter.count}</small></a>)}</nav>;
}
const fold = (language: string, value: string) => (language === 'az' ? value.replace(/İ/g, 'i').replace(/I/g, 'ı') : value).toLocaleLowerCase(language);
/** Alphabetical list grouped by first letter, with a client-side filter. */
function NameDirectory({ entries, heading }: { entries: NameEntry[]; heading: string }) {
  const { copy, route } = useNames();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = fold(route.language, query.trim());
    return needle ? entries.filter(entry => fold(route.language, entry.name).includes(needle) || fold(route.language, entry.meaning).includes(needle)) : entries;
  }, [entries, query, route.language]);
  const groups = useMemo(() => {
    const result: Array<{ letter: string; slug: string; entries: NameEntry[] }> = [];
    for (const entry of shown) {
      const last = result[result.length - 1];
      if (last?.letter === entry.letter) last.entries.push(entry); else result.push({ letter: entry.letter, slug: entry.letterSlug, entries: [entry] });
    }
    return result;
  }, [shown]);
  return <section className="site-section tl-directory" aria-labelledby="tl-directory-heading">
    <h2 id="tl-directory-heading">{heading}</h2>
    <label className="site-search tl-search"><Search aria-hidden="true" size={18}/><span className="site-sr">{copy.searchLabel}</span>
      <input type="search" value={query} placeholder={copy.searchPlaceholder} aria-label={copy.searchLabel} onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck={false}/></label>
    <p className="site-results-count" aria-live="polite">{copy.searchCount(shown.length)}</p>
    {!shown.length && <p className="site-no-results">{copy.noResults}</p>}
    {groups.map(group => <div className="tl-group" key={group.letter} id={`tl-${group.slug}`}><h3>{group.letter}</h3><ul className="tl-name-list">{group.entries.map(entry => <NameItem entry={entry} key={entry.slug}/>)}</ul></div>)}
  </section>;
}
function Intro({ eyebrow, title, text }: { eyebrow?: string; title: string; text: string }) {
  return <div className="site-page-intro tl-intro">{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h1>{title}</h1><p>{text}</p></div>;
}
function GenderLinks({ copy, path }: { copy: NamesCopy; path: ReturnType<typeof useNames>['path'] }) {
  return <div className="tl-links"><a className="site-outline-button" href={path('namesGender', 'girl')}>{copy.girlLabel}<Arrow/></a><a className="site-outline-button" href={path('namesGender', 'boy')}>{copy.boyLabel}<Arrow/></a></div>;
}
function RelatedArticle() {
  const { copy, href } = useNames();
  if (!copy.related) return null;
  return <p className="tl-related"><a className="site-text-link" href={href('article', copy.related.articleSlug)}>{copy.related.label}<Arrow diagonal/></a></p>;
}

export function NamesHubPage() {
  const { copy, index, path } = useNames();
  return <>
    <ToolBreadcrumb/>
    <Intro title={copy.hubH1} text={copy.hubIntro(index.names.length)}/>
    <GenderLinks copy={copy} path={path}/>
    <section className="site-section tl-popular" aria-labelledby="tl-popular-girls"><div className="tl-popular-grid">
      <div><h2 id="tl-popular-girls">{copy.popularGirls}</h2><NameChips entries={popularNames(index, 'girl')}/><a className="site-text-link" href={path('namesGender', 'girl')}>{copy.listLink('girl')}<Arrow/></a></div>
      <div><h2>{copy.popularBoys}</h2><NameChips entries={popularNames(index, 'boy')}/><a className="site-text-link" href={path('namesGender', 'boy')}>{copy.listLink('boy')}<Arrow/></a></div>
    </div></section>
    <section className="site-section tl-letter-section"><h2>{copy.byLetter}</h2><LetterIndex index={index}/></section>
    <NamesAppCard/>
    <NameDirectory entries={index.names} heading={copy.allNames}/>
    <RelatedArticle/>
    <p className="tl-note">{copy.dataNote}</p>
  </>;
}
export function NamesGenderPage() {
  const { copy, index, path, route } = useNames();
  const gender = route.slug === 'boy' ? 'boy' : 'girl', entries = genderNames(index, gender);
  return <>
    <ToolBreadcrumb/>
    <Intro title={gender === 'girl' ? copy.girlH1 : copy.boyH1} text={copy.listDescription(gender, entries.length)}/>
    <section className="site-section tl-popular"><h2>{gender === 'girl' ? copy.popularGirls : copy.popularBoys}</h2><NameChips entries={popularNames(index, gender)}/></section>
    <NamesAppCard/>
    <NameDirectory entries={entries} heading={gender === 'girl' ? copy.girlLabel : copy.boyLabel}/>
    <section className="site-section tl-letter-section"><h2>{copy.byLetter}</h2><LetterIndex index={index}/></section>
    <div className="tl-links"><a className="site-outline-button" href={path('namesGender', gender === 'girl' ? 'boy' : 'girl')}>{gender === 'girl' ? copy.boyLabel : copy.girlLabel}<Arrow/></a><a className="site-outline-button" href={path('names')}>{copy.backToHub}<Arrow/></a></div>
    <RelatedArticle/>
    <p className="tl-note">{copy.dataNote}</p>
  </>;
}
export function NamesLetterPage() {
  const { copy, index, path, route } = useNames();
  const letter = letterPage(index, route.slug)!, entries = letterNames(index, letter);
  return <>
    <ToolBreadcrumb/>
    <Intro title={copy.letterH1(letter.letter)} text={copy.letterDescription(letter.letter, entries.length)}/>
    <section className="site-section tl-directory"><ul className="tl-name-list">{entries.map(entry => <NameItem entry={entry} key={entry.slug}/>)}</ul></section>
    <NamesAppCard/>
    <section className="site-section tl-letter-section"><h2>{copy.byLetter}</h2><LetterIndex index={index} current={letter.slug}/></section>
    <GenderLinks copy={copy} path={path}/>
    <p className="tl-note">{copy.dataNote}</p>
  </>;
}
export function NameDetailPage() {
  const { copy, index, path, route } = useNames();
  const entry = index.bySlug.get(route.slug || '');
  if (!entry) return null;
  const similar = similarNames(index, entry), letter = index.letters.find(item => item.letter === entry.letter);
  const gender = entry.gender === 'boy' ? 'boy' : 'girl';
  return <>
    <ToolBreadcrumb/>
    <article className="tl-name" data-name={entry.slug}>
      <header className="site-page-intro tl-intro"><Eyebrow>{copy.gender[entry.gender]}</Eyebrow><h1>{copy.detailH1(entry.name)}</h1><p className="tl-name-lead">{entry.meaning}</p></header>
      <dl className="tl-facts">
        <div><dt>{copy.meaning}</dt><dd>{entry.meaning}</dd></div>
        {entry.origin && <div><dt>{copy.origin}</dt><dd>{entry.origin}</dd></div>}
        <div><dt>{copy.genderLabel}</dt><dd>{copy.gender[entry.gender]}</dd></div>
        <div><dt>{copy.popularity}</dt><dd>{copy.popularityValue(entry, index.names.length)}</dd></div>
      </dl>
      <div className="tl-links">
        {letter?.page && <a className="site-outline-button" href={path('namesLetter', letter.slug)}>{copy.letterLink(letter.letter)}<Arrow/></a>}
        <a className="site-outline-button" href={path('namesGender', gender)}>{copy.listLink(gender)}<Arrow/></a>
        {entry.gender === 'unisex' && <a className="site-outline-button" href={path('namesGender', 'boy')}>{copy.listLink('boy')}<Arrow/></a>}
      </div>
    </article>
    <NamesAppCard/>
    {!!similar.length && <section className="site-section tl-similar"><h2>{copy.similar}</h2><NameChips entries={similar}/></section>}
    <section className="site-section site-faq-section"><h2>{copy.faqTitle}</h2><div className="site-faq-list">{copy.faq(entry).map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <p className="tl-links"><a className="site-text-link" href={path('names')}>{copy.backToHub}<Arrow/></a></p>
    <RelatedArticle/>
    <p className="tl-note">{copy.dataNote}</p>
  </>;
}
