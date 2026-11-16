/** SEO content pages (az, ru): short answer on the website, full guide in the app (texts in content-<lang>.ts). */
import { useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { ToolBreadcrumb } from '../tools/NamesPages';
import { seoHubContent } from './registry';
import { seoHubSitePath, type SeoHubPage } from './routes';
import type { HubFaq, HubSource, Verdict } from './content-az';
import type { FeverAge } from './fever-logic';
import type { SeoHubContent } from './registry';
import { AppGate, AppInline, AppPill, AppSticky } from './AppConvert';
import '../tools/tools.css';
import './seo-hubs.css';

function useHub(): SeoHubContent { const { route } = useWebsite(); return seoHubContent(route.language)!; }
const Disclaimer = () => <p className="tl-note tl-disclaimer">{useHub().UI.disclaimer}</p>;
function Sources({ items }: { items: HubSource[] }) {
  const unique = items.filter((item, index) => items.findIndex(other => other.url === item.url) === index);
  return <section className="site-section tl-prose"><h2>{useHub().UI.sources}</h2><ul className="tl-sources">{unique.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<Arrow diagonal/></a></li>)}</ul></section>;
}
function Faq({ items }: { items: HubFaq[] }) {
  if (!items.length) return null;
  return <section className="site-section site-faq-section"><h2>{useHub().UI.faq}</h2><div className="site-faq-list">{items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>;
}
function Answer({ text }: { text: string }) { const label = useHub().UI.shortAnswer; return <aside className="tl-answer" aria-label={label}><strong>{label}</strong><p>{text}</p></aside>; }
const VerdictChip = ({ verdict, label }: { verdict: Verdict; label: string }) => <span className={`sh-verdict sh-v-${verdict}`}>{label}</span>;
function useHubPath() { const { basePath, route } = useWebsite(); return (kind: SeoHubPage, slug?: string) => basePath + seoHubSitePath(kind, slug, route.language); }

/* ---------- fever ---------- */
function FeverPage() {
  const c = useHub(), f = c.FEVER, u = c.UI.fever;
  const [age, setAge] = useState<FeverAge>(1), [temp, setTemp] = useState(38.4), [days, setDays] = useState(1);
  const [flags, setFlags] = useState<Record<string, boolean>>({}), [dry, setDry] = useState(false);
  const advice = c.feverAdvice({ age, temp, days, redFlag: Object.values(flags).some(Boolean), dehydrated: dry });
  const tone = advice.level === 'emergency' ? 'bad' : advice.level === 'doctor' || advice.level === 'low' ? 'warn' : 'ok';
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{f.heading}</h1><p>{f.intro}</p></div>
    <AppPill tool="first-aid" area="fever" text={u.pill}/>
    <Answer text={f.answer}/>
    <div className="sh-fever">
      <form className="sh-form" onSubmit={event => event.preventDefault()}>
        <label htmlFor="sh-age">{u.age}</label>
        <select id="sh-age" value={age} onChange={event => setAge(Number(event.target.value) as FeverAge)}>{c.FEVER_AGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <label htmlFor="sh-temp">{u.temp}</label>
        <span className="sh-temp"><input id="sh-temp" type="range" min={35.5} max={41.5} step={0.1} value={temp} onChange={event => setTemp(Number(event.target.value))}/><output htmlFor="sh-temp">{temp.toFixed(1).replace('.', ',')} °C</output></span>
        <label htmlFor="sh-days">{u.days}</label>
        <select id="sh-days" value={days} onChange={event => setDays(Number(event.target.value))}>{[1, 3, 5].map((value, index) => <option key={value} value={value}>{u.dayOptions[index]}</option>)}</select>
        <fieldset><legend>{u.flags}</legend>
          {c.FEVER_RED_FLAGS.map(flag => <label key={flag.id}><input type="checkbox" checked={!!flags[flag.id]} onChange={event => setFlags({ ...flags, [flag.id]: event.target.checked })}/>{flag.label}</label>)}
          <label><input type="checkbox" checked={dry} onChange={event => setDry(event.target.checked)}/>{u.dry}</label>
        </fieldset>
      </form>
      <div className={`sh-result sh-r-${tone}`} aria-live="polite">
        <Eyebrow>{u.result}</Eyebrow>
        <strong>{advice.title}</strong>
        <p>{advice.text}</p>
        {advice.level === 'emergency' ? <p>{u.emergency} <a href="tel:103">103</a></p> : <p>{u.log}</p>}
      </div>
    </div>
    <AppInline tool="first-aid" area="fever" text={u.inline}/>
    <section className="site-section tl-prose"><h2>{u.homeTitle}</h2><ul className="pw-checklist">{f.homeCare.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <section className="site-section tl-prose"><h2>{u.measureTitle}</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>{u.measureAge}</th><th>{u.measureHow}</th></tr></thead><tbody>{f.measure.map(row => <tr key={row.age}><th scope="row">{row.age}</th><td>{row.how}</td></tr>)}</tbody></table></div></section>
    <AppGate tool="first-aid" area="fever" title={u.gateTitle} text={u.gateText} locked={f.locked}/>
    <Faq items={f.faq}/>
    <Sources items={f.sources}/>
    <Disclaimer/>
    <AppSticky tool="first-aid" area="fever" text={u.sticky}/>
  </>;
}

/* ---------- solid foods ---------- */
function SolidHubPage() {
  const hubPath = useHubPath(), c = useHub(), h = c.SOLID_HUB, u = c.UI.solid;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{h.heading}</h1><p>{h.intro}</p></div>
    <AppPill tool="solid-food-guide" area="solid" text={u.pill}/>
    <Answer text={h.answer}/>
    <section className="site-section tl-prose"><h2>{u.tableTitle}</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>{u.colAge}</th><th>{u.colTexture}</th><th>{u.colMeals}</th></tr></thead>
        <tbody>{c.SOLID_MONTHS.map(m => <tr key={m.month}><th scope="row"><a className="site-text-link" href={hubPath('solidFoodMonth', String(m.month))}>{u.month(m.month)}</a></th><td>{m.texture}</td><td>{m.meals}</td></tr>)}</tbody></table></div></section>
    <AppInline tool="solid-food-guide" area="solid" text={u.inline}/>
    <section className="site-section tl-prose"><h2>{u.readyTitle}</h2><ul className="pw-checklist">{h.ready.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <section className="site-section"><h2 className="sh-h2">{u.pick}</h2><ul className="sh-month-grid">{c.SOLID_MONTHS.map(m => <li key={m.month}><a href={hubPath('solidFoodMonth', String(m.month))}><strong>{u.month(m.month)}</strong><span>{m.meals}</span></a></li>)}</ul></section>
    <AppGate tool="solid-food-guide" area="solid" premium title={u.gateTitle} text={u.gateText} locked={h.locked}/>
    <Sources items={h.sources}/>
    <Disclaimer/>
    <AppSticky tool="solid-food-guide" area="solid" text={u.sticky}/>
  </>;
}
function SolidMonthPage() {
  const { route } = useWebsite(), hubPath = useHubPath(), c = useHub(), u = c.UI.solid;
  const m = c.solidMonth(Number(route.slug));
  if (!m) return null;
  const prev = c.solidMonth(m.month - 1), next = c.solidMonth(m.month + 1), area = `solid_${m.month}`;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.monthEyebrow(m.month)}</Eyebrow><h1>{m.title}</h1></div>
    <AppPill tool="solid-food-guide" area={area} text={u.monthPill(m.month)}/>
    <Answer text={m.quick}/>
    <section className="tl-prose"><div className="tl-table-wrap"><table className="tl-table pw-table"><tbody>
      <tr><th scope="row">{u.texture}</th><td>{m.texture}</td></tr><tr><th scope="row">{u.meals}</th><td>{m.meals}</td></tr><tr><th scope="row">{u.base}</th><td>{m.month < 12 ? u.baseMilk : u.baseFamily}</td></tr>
    </tbody></table></div></section>
    <section className="site-section tl-prose"><h2>{u.foodsTitle}</h2><ul className="sh-chips">{m.foods.map(food => <li key={food}>{food}</li>)}</ul></section>
    <section className="site-section tl-prose"><h2>{u.watchTitle}</h2><ul>{m.watch.map(text => <li key={text}>{text}</li>)}</ul></section>
    <AppGate tool="solid-food-guide" area={area} premium title={u.monthGateTitle(m.month)} text={u.monthGateText} locked={c.SOLID_HUB.locked}/>
    <Faq items={m.faq}/>
    <nav className="pw-pager" aria-label={u.months}>
      {prev ? <a href={hubPath('solidFoodMonth', String(prev.month))} rel="prev"><ChevronLeft aria-hidden="true" size={18}/><span><small>{c.UI.prev}</small>{u.month(prev.month)}</span></a> : <span/>}
      <a className="pw-pager-hub" href={hubPath('solidFoods')}>{u.allMonths}</a>
      {next ? <a href={hubPath('solidFoodMonth', String(next.month))} rel="next"><span><small>{c.UI.next}</small>{u.month(next.month)}</span><ChevronRight aria-hidden="true" size={18}/></a> : <span/>}
    </nav>
    <Sources items={c.SOLID_HUB.sources}/>
    <Disclaimer/>
    <AppSticky tool="solid-food-guide" area={area} text={u.monthSticky(m.month)}/>
  </>;
}

/* ---------- pregnancy can / can't ---------- */
function SafeHubPage() {
  const hubPath = useHubPath(), c = useHub(), u = c.UI.safe;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{c.SAFE_HUB.heading}</h1><p>{c.SAFE_HUB.intro}</p></div>
    <AppPill tool="safety" area="safe" text={u.pill}/>
    <ul className="sh-q-grid">{c.SAFE_ITEMS.map(item => <li key={item.slug}><a href={hubPath('pregnancySafeItem', item.slug)}><strong>{item.question}</strong><VerdictChip verdict={item.verdict} label={c.VERDICT_LABEL[item.verdict]}/></a></li>)}</ul>
    <AppGate tool="safety" area="safe" title={u.gateTitle} text={u.gateText} locked={u.locked}/>
    <Sources items={c.SAFE_ITEMS.flatMap(item => item.sources)}/>
    <Disclaimer/>
    <AppSticky tool="safety" area="safe" text={u.sticky}/>
  </>;
}
function SafeItemPage() {
  const { route, href } = useWebsite(), hubPath = useHubPath(), c = useHub(), u = c.UI.safe;
  const item = c.safeItem(route.slug);
  if (!item) return null;
  const others = c.SAFE_ITEMS.filter(other => other.slug !== item.slug).slice(0, 6), area = `safe_${item.slug.replace(/-/g, '_')}`;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.itemEyebrow}</Eyebrow><h1>{item.question}</h1></div>
    <div className="sh-answer"><VerdictChip verdict={item.verdict} label={c.VERDICT_LABEL[item.verdict]}/><p>{item.answer}</p></div>
    <section className="tl-prose"><h2>{c.UI.why}</h2><p>{item.explain[0]}</p></section>
    <AppInline tool="safety" area={area} text={u.inline}/>
    <section className="tl-prose">{item.explain.slice(1).map(text => <p key={text}>{text}</p>)}</section>
    <section className="site-section tl-prose"><h2>{c.UI.tips}</h2><ul className="pw-checklist">{item.tips.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    {c.SAFE_ARTICLES[item.slug] && <section className="site-section tl-prose"><h2>{c.UI.readMore}</h2><p><a className="site-text-link" href={href('article', c.SAFE_ARTICLES[item.slug].slug)}>{c.SAFE_ARTICLES[item.slug].title}<Arrow/></a></p></section>}
    <AppGate tool="safety" area={area} title={u.itemGateTitle} text={u.itemGateText} locked={u.locked}/>
    <section className="site-section"><h2 className="sh-h2">{u.others}</h2><ul className="sh-q-grid">{others.map(other => <li key={other.slug}><a href={hubPath('pregnancySafeItem', other.slug)}><strong>{other.question}</strong><VerdictChip verdict={other.verdict} label={c.VERDICT_LABEL[other.verdict]}/></a></li>)}</ul>
      <a className="site-text-link" href={hubPath('pregnancySafe')}>{u.all}<Arrow/></a></section>
    <Sources items={item.sources}/>
    <Disclaimer/>
    <AppSticky tool="safety" area={area} text={u.sticky}/>
  </>;
}

/* ---------- breast milk storage ---------- */
function MilkPage() {
  const c = useHub(), m = c.MILK, u = c.UI.milk;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{m.heading}</h1></div>
    <AppPill tool="baby-tracker" area="milk" text={u.pill}/>
    <Answer text={m.answer}/>
    <section className="tl-prose sh-milk"><h2>{u.tableTitle}</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>{u.colPlace}</th><th>{u.colFresh}</th><th>{u.colThawed}</th></tr></thead>
        <tbody>{m.rows.map(row => <tr key={row.place}><th scope="row">{row.place}</th><td><strong>{row.fresh}</strong></td><td>{row.thawed}</td></tr>)}</tbody></table></div>
      <button type="button" className="site-outline-button sh-print" onClick={() => window.print()}><Printer aria-hidden="true" size={16}/>{u.print}</button>
    </section>
    <AppInline tool="baby-tracker" area="milk" text={u.inline}/>
    <section className="site-section tl-prose"><h2>{u.rulesTitle}</h2><ul className="pw-checklist">{m.rules.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <AppGate tool="baby-tracker" area="milk" title={u.gateTitle} text={u.gateText} locked={m.locked}/>
    <Faq items={m.faq}/>
    <Sources items={m.sources}/>
    <Disclaimer/>
    <AppSticky tool="baby-tracker" area="milk" text={u.sticky}/>
  </>;
}

/* ---------- periods ---------- */
function PeriodPage() {
  const { href } = useWebsite(), c = useHub(), p = c.PERIOD, u = c.UI.period;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>{u.eyebrow}</Eyebrow><h1>{p.heading}</h1></div>
    <AppPill tool="calendar" area="period" text={u.pill}/>
    <Answer text={p.answer}/>
    <section className="tl-prose"><h2>{u.namesTitle}</h2><p>{p.names}</p></section>
    <nav className="tl-links" aria-label={u.topics}>{p.sections.map(section => <a key={section.id} className="site-outline-button" href={`#${section.id}`}>{section.title}</a>)}</nav>
    {p.sections.map((section, index) => <div key={section.id}>
      <section className="site-section tl-prose" id={section.id}><h2>{section.title}</h2><p>{section.text}</p></section>
      {index === 1 && <AppInline tool="calendar" area="period" text={u.inline}/>}
    </div>)}
    <section className="site-section tl-prose pw-warning"><h2><AlertTriangle aria-hidden="true" size={22} strokeWidth={1.8}/>{c.UI.whenDoctor}</h2><ul>{p.doctor.map(text => <li key={text}>{text}</li>)}</ul></section>
    <aside className="tl-article-tool pw-due"><span className="site-icon-wash site-wash-mint"><CalendarDays size={22} strokeWidth={1.5}/></span>
      <div><strong>{u.calcTitle}</strong><p>{u.calcText}</p></div>
      <a className="site-outline-button" href={href('periodCalendar')}>{u.calcButton}<Arrow/></a></aside>
    <AppGate tool="calendar" area="period" title={u.gateTitle} text={u.gateText} locked={p.locked}/>
    <section className="site-section tl-prose"><h2>{c.UI.readMore}</h2><ul>{p.articles.map(article => <li key={article.slug}><a className="site-text-link" href={href('article', article.slug)}>{article.title}</a></li>)}</ul></section>
    <Faq items={p.faq}/>
    <Sources items={p.sources}/>
    <Disclaimer/>
    <AppSticky tool="calendar" area="period" text={u.sticky}/>
  </>;
}

export default function SeoHubPageView({ kind }: { kind: SeoHubPage }) {
  const { route } = useWebsite();
  if (!seoHubContent(route.language)) return null;
  return kind === 'feverGuide' ? <FeverPage/> : kind === 'solidFoods' ? <SolidHubPage/> : kind === 'solidFoodMonth' ? <SolidMonthPage/>
    : kind === 'pregnancySafe' ? <SafeHubPage/> : kind === 'pregnancySafeItem' ? <SafeItemPage/> : kind === 'milkStorage' ? <MilkPage/> : <PeriodPage/>;
}
