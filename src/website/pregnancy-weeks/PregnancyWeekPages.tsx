/** Hub and week pages in Azerbaijani (/az/hamilelik/…) and Russian (/ru/беременность/…); strings in locale.ts, texts in az.ts/ru.ts. */
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { AppGate, AppInline, AppPill, AppSticky } from '../seo-hubs/AppConvert';
import { ToolBreadcrumb } from '../tools/NamesPages';
import { pregnancyWeekContent } from './registry';
import { PREGNANCY_WEEKS_HUB, PREGNANCY_WEEK_LAST, pregnancyWeekFromSlug, pregnancyWeekSources, pregnancyWeeksHubPath, pregnancyWeeksPublished } from './weeks';
import { weekLocale } from './locale';
import { localizedWeekHubPath, localizedWeekPath } from './routes';
import '../tools/tools.css';
import './pregnancy-weeks.css';

function useWeekLocale() { const { route } = useWebsite(); return weekLocale(route.language); }
function DueDateLink() {
  const { href } = useWebsite(), u = useWeekLocale().ui;
  return <aside className="tl-article-tool pw-due"><span className="site-icon-wash site-wash-mint"><CalendarDays size={22} strokeWidth={1.5}/></span>
    <div><strong>{u.dueTitle}</strong><p>{u.dueText}</p></div>
    <a className="site-outline-button" href={href('dueDate')}>{u.dueButton}<Arrow/></a></aside>;
}
const Disclaimer = () => <p className="tl-note tl-disclaimer">{useWeekLocale().ui.disclaimer}</p>;

export function PregnancyWeeksHubPage() {
  const { basePath, route } = useWebsite(), l = useWeekLocale(), u = l.ui;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{l.hub.heading}</h1><p>{l.hub.intro}</p></div>
    <AppPill tool="pregnancy" area="weeks" text={u.hubPill}/>
    <nav className="tl-links pw-jump" aria-label={u.trimesters}>{l.trimesters.map(item => <a key={item.trimester} className="site-outline-button" href={`#trimestr-${item.trimester}`}>{item.title}</a>)}</nav>
    {l.trimesters.map(item => <section className="site-section pw-trimester" id={`trimestr-${item.trimester}`} key={item.trimester} aria-labelledby={`pw-t${item.trimester}`}>
      <h2 id={`pw-t${item.trimester}`}>{item.title} <small>{item.range}</small></h2>
      <ol className="pw-week-grid">{item.weeks.map(week => <li key={week}><a href={basePath + localizedWeekPath(week, route.language)}>
        <strong>{l.label(week)}</strong><span>{l.sizeShort(week)}</span></a></li>)}</ol>
    </section>)}
    <DueDateLink/>
    <AppGate tool="pregnancy" area="weeks" title={u.hubGateTitle} text={u.hubGateText} locked={u.locked}/>
    <Disclaimer/>
    <AppSticky tool="pregnancy" area="weeks" text={u.sticky}/>
  </>;
}

export function PregnancyWeekPage() {
  const { route, basePath } = useWebsite(), l = useWeekLocale(), u = l.ui;
  const week = pregnancyWeekFromSlug(route.slug), content = week ? pregnancyWeekContent(week, route.language) : undefined;
  if (!week || !content) return null;
  const sources = pregnancyWeekSources(week, content.sources);
  const warning = [...content.warning, ...l.sharedWarnings(week)];
  const link = (target: number) => basePath + localizedWeekPath(target, route.language);
  const area = `week_${week}`;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{l.eyebrow(week)}</Eyebrow><h1>{l.heading(week)}</h1></div>
    <AppPill tool="pregnancy" area={area} text={u.pill(week)}/>
    <aside className="tl-answer" aria-label={u.shortAnswer}><strong>{u.shortAnswer}</strong><p>{l.quick(content)}</p></aside>
    <section className="tl-prose pw-facts" aria-labelledby="pw-facts"><h2 id="pw-facts">{u.factsTitle}</h2>
      <div className="tl-table-wrap"><table className="tl-table pw-table"><tbody>{l.facts(week).map(fact => <tr key={fact.label}><th scope="row">{fact.label}</th><td>{fact.value}</td></tr>)}</tbody></table></div>
      <p className="tl-note">{u.factsNote}</p>
    </section>
    <section className="site-section tl-prose"><h2>{u.babyTitle}</h2><p>{content.baby[0]}</p></section>
    <AppGate tool="pregnancy" area={area} title={u.gateTitle(week)} text={u.gateText} locked={u.locked}/>
    <section className="site-section tl-prose pw-warning" aria-labelledby="pw-warning"><h2 id="pw-warning"><AlertTriangle aria-hidden="true" size={22} strokeWidth={1.8}/>{u.warningTitle}</h2>
      <p>{u.warningIntro}</p>
      <ul>{warning.map(text => <li key={text}>{text}</li>)}</ul></section>
    <AppInline tool="pregnancy" area={area} text={u.inline(week)}/>
    <DueDateLink/>
    <section className="site-section site-faq-section"><h2>{u.faq}</h2><div className="site-faq-list">{content.faq.slice(0, 2).map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section className="site-section tl-prose"><h2>{u.sources}</h2><ul className="tl-sources">{sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<Arrow diagonal/></a></li>)}</ul></section>
    <nav className="pw-pager" aria-label={u.weeks}>
      {week > 1 ? <a href={link(week - 1)} rel="prev"><ChevronLeft aria-hidden="true" size={18}/><span><small>{u.prev}</small>{l.label(week - 1)}</span></a> : <span/>}
      <a className="pw-pager-hub" href={basePath + localizedWeekHubPath(route.language)}>{u.allWeeks}</a>
      {week < PREGNANCY_WEEK_LAST ? <a href={link(week + 1)} rel="next"><span><small>{u.next}</small>{l.label(week + 1)}</span><ChevronRight aria-hidden="true" size={18}/></a> : <span/>}
    </nav>
    <Disclaimer/>
    <AppSticky tool="pregnancy" area={area} text={u.sticky}/>
  </>;
}

/** Inbound links (pregnancy detail page, calculators page): rendered only once the pages are published. */
export function PregnancyWeeksLink() {
  const { route, basePath } = useWebsite();
  if (route.language !== 'az' || !pregnancyWeeksPublished()) return null;
  return <aside className="tl-article-tool pw-inbound"><span className="site-icon-wash site-wash-peach"><CalendarDays size={22} strokeWidth={1.5}/></span>
    <div><strong>{PREGNANCY_WEEKS_HUB.heading}</strong><p>Hər həftə körpənin ölçüsü, əlamətlər, müayinələr və təhlükə əlamətləri.</p></div>
    <a className="site-outline-button" href={basePath + pregnancyWeeksHubPath()}>Bax<Arrow/></a></aside>;
}
