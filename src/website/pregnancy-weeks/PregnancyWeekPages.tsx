/** /az/hamilelik/heftelik/ (hub) and /az/hamilelik/<n>-ci-hefte/ (week): Azerbaijani only, texts in az.ts. */
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { AppToolCard } from '../tools/AppOpen';
import { ToolBreadcrumb } from '../tools/NamesPages';
import { pregnancyWeekContent } from './registry';
import {
  PREGNANCY_TRIMESTERS, PREGNANCY_WEEK_LAST, PREGNANCY_WEEKS_HUB, azOrdinal, pregnancyWeekFacts, pregnancyWeekFromSlug, pregnancyWeekHeading,
  pregnancyWeekLabel, pregnancyWeekNextTest, pregnancyWeekPath, pregnancyWeekQuick, pregnancyWeekSharedTodo, pregnancyWeekSharedWarnings,
  pregnancyWeekSizeShort, pregnancyWeekSources, pregnancyWeekTests, pregnancyWeeksHubPath, pregnancyWeeksPublished, pregnancyTrimester,
} from './weeks';
import '../tools/tools.css';
import './pregnancy-weeks.css';

const APP_FEATURES = ['Həftə və gün sayğacı, körpənin ölçüsü', 'Təpik sayğacı və sancı taymeri', 'Həkim görüşləri, analizlər və doğum çantası siyahısı'];
function WeeksAppCard({ week }: { week?: number }) {
  return <AppToolCard tool="pregnancy" src={week ? `web-week-${week}` : 'web-weeks'} title="Hər həftəni Anacan-da izlə"
    text="Son menstruasiya tarixini daxil edin: Anacan hamiləliyin həftəsini, körpənin ölçüsünü və bu həftəyə aid məsləhətləri hər gün göstərir." features={APP_FEATURES}/>;
}
function DueDateLink() {
  const { href } = useWebsite();
  return <aside className="tl-article-tool pw-due"><span className="site-icon-wash site-wash-mint"><CalendarDays size={22} strokeWidth={1.5}/></span>
    <div><strong>Neçənci həftədəsiniz?</strong><p>Son menstruasiya tarixinə görə hamiləlik həftəsini və təxmini doğuş tarixini hesablayın.</p></div>
    <a className="site-outline-button" href={href('dueDate')}>Doğuş tarixi kalkulyatoru<Arrow/></a></aside>;
}
const Disclaimer = () => <p className="tl-note tl-disclaimer">Bu səhifə ümumi maarifləndirmə məqsədi daşıyır və həkim müayinəsini və ya məsləhətini əvəz etmir. Hər hamiləlik fərqlidir; sizə aid suallar üçün həkiminizə müraciət edin.</p>;

export function PregnancyWeeksHubPage() {
  const { basePath } = useWebsite();
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Hamiləlik</Eyebrow><h1>{PREGNANCY_WEEKS_HUB.heading}</h1><p>{PREGNANCY_WEEKS_HUB.intro}</p></div>
    <nav className="tl-links pw-jump" aria-label="Trimestrlər">{PREGNANCY_TRIMESTERS.map(item => <a key={item.trimester} className="site-outline-button" href={`#trimestr-${item.trimester}`}>{item.title}</a>)}</nav>
    {PREGNANCY_TRIMESTERS.map(item => <section className="site-section pw-trimester" id={`trimestr-${item.trimester}`} key={item.trimester} aria-labelledby={`pw-t${item.trimester}`}>
      <h2 id={`pw-t${item.trimester}`}>{item.title} <small>{item.range}</small></h2>
      <ol className="pw-week-grid">{item.weeks.map(week => <li key={week}><a href={basePath + pregnancyWeekPath(week)}>
        <strong>{pregnancyWeekLabel(week)}</strong><span>{pregnancyWeekSizeShort(week)}</span></a></li>)}</ol>
    </section>)}
    <DueDateLink/>
    <WeeksAppCard/>
    <Disclaimer/>
  </>;
}

export function PregnancyWeekPage() {
  const { route, basePath } = useWebsite();
  const week = pregnancyWeekFromSlug(route.slug), content = week ? pregnancyWeekContent(week) : undefined;
  if (!week || !content) return null;
  const tests = pregnancyWeekTests(week), sources = pregnancyWeekSources(week, content.sources);
  const todo = [...content.todo, ...pregnancyWeekSharedTodo(week)], warning = [...content.warning, ...pregnancyWeekSharedWarnings(week)];
  const link = (target: number) => basePath + pregnancyWeekPath(target);
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{azOrdinal(pregnancyTrimester(week))} trimestr · {pregnancyWeekLabel(week)}</Eyebrow><h1>{pregnancyWeekHeading(week)}</h1></div>
    <aside className="tl-answer" aria-label="Qısa cavab"><strong>Qısa cavab</strong><p>{pregnancyWeekQuick(content)}</p></aside>
    <section className="tl-prose pw-facts" aria-labelledby="pw-facts"><h2 id="pw-facts">Əsas göstəricilər</h2>
      <div className="tl-table-wrap"><table className="tl-table pw-table"><tbody>{pregnancyWeekFacts(week).map(fact => <tr key={fact.label}><th scope="row">{fact.label}</th><td>{fact.value}</td></tr>)}</tbody></table></div>
      <p className="tl-note">Ölçülər Anacan tətbiqindəki həftəlik cədvələ əsaslanır və orta göstəricidir; ultrasəsdə ölçülən rəqəmlər fərqli ola bilər.</p>
    </section>
    <section className="site-section tl-prose"><h2>Körpənin inkişafı</h2>{content.baby.map(text => <p key={text}>{text}</p>)}</section>
    <section className="site-section tl-prose"><h2>Sizin bədəninizdə nələr dəyişir</h2>{content.body.map(text => <p key={text}>{text}</p>)}</section>
    <section className="site-section tl-prose"><h2>Bu həftənin əlamətləri</h2><ul>{content.symptoms.map(text => <li key={text}>{text}</li>)}</ul></section>
    <section className="site-section tl-prose"><h2>Müayinələr və testlər</h2>{tests.length ? <ul>{tests.map(text => <li key={text}>{text}</li>)}</ul> : <p>{pregnancyWeekNextTest(week)}</p>}</section>
    <section className="site-section tl-prose"><h2>Bu həftə nə etməli</h2><ul className="pw-checklist">{todo.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <section className="site-section tl-prose pw-warning" aria-labelledby="pw-warning"><h2 id="pw-warning"><AlertTriangle aria-hidden="true" size={22} strokeWidth={1.8}/>Nə vaxt həkimə müraciət etməli</h2>
      <p>Aşağıdakılardan hər hansı biri olarsa, gözləmədən həkiminizə və ya doğum evinə müraciət edin; vəziyyət ağırdırsa, 103 təcili tibbi yardım nömrəsinə zəng edin.</p>
      <ul>{warning.map(text => <li key={text}>{text}</li>)}</ul></section>
    <DueDateLink/>
    <WeeksAppCard week={week}/>
    <section className="site-section site-faq-section"><h2>Tez-tez verilən suallar</h2><div className="site-faq-list">{content.faq.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section className="site-section tl-prose"><h2>Mənbələr</h2><ul className="tl-sources">{sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<Arrow diagonal/></a></li>)}</ul></section>
    <nav className="pw-pager" aria-label="Həftələr">
      {week > 1 ? <a href={link(week - 1)} rel="prev"><ChevronLeft aria-hidden="true" size={18}/><span><small>Əvvəlki</small>{pregnancyWeekLabel(week - 1)}</span></a> : <span/>}
      <a className="pw-pager-hub" href={basePath + pregnancyWeeksHubPath()}>Bütün həftələr</a>
      {week < PREGNANCY_WEEK_LAST ? <a href={link(week + 1)} rel="next"><span><small>Növbəti</small>{pregnancyWeekLabel(week + 1)}</span><ChevronRight aria-hidden="true" size={18}/></a> : <span/>}
    </nav>
    <Disclaimer/>
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
