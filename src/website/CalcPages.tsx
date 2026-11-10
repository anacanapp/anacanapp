/** Free calculator pages: pregnancy weight gain (IOM 2009), conception date, period calendar and
 * baby growth percentiles (WHO Child Growth Standards). Texts come from the bundled
 * `tools-content/` modules, never from copy JSON keys. */
import { useEffect, useRef, useState } from 'react';
import { Baby, CalendarDays, CalendarHeart, Download, Scale, type LucideIcon } from 'lucide-react';
import { WEBSITE_LANGUAGES, type WebsiteLanguageCode } from '../lib/app-languages';
import { useWebsite } from './context';
import { Arrow, Eyebrow } from './components';
import { CycleCalendar } from './CalculatorPages';
import { addCalendarDays, calendarIso, CalculatorInputError, estimateConception, estimateGrowth, estimatePeriodCalendar, estimatePregnancyWeight, GROWTH_MAX_DAYS,
  makeCalendarFile, parseCalendarDate, todayIso, ToolInputError, whoCurve, type ConceptionEstimate, type CycleEstimate, type GrowthEstimate, type GrowthIndicator,
  type GrowthSex, type PregnancyWeightEstimate } from './calculators';
import { siteDate } from './dates';
import { CALC_PAGES, type CalcPage } from './routes';
import { calcContent, type CalcContent } from './calc-content';
import { AppToolCard, type AppToolId } from './tools/AppOpen';
import './tools/tools.css';
import './calc-pages.css';

export const CALC_ICONS: Record<CalcPage, LucideIcon> = { pregnancyWeight: Scale, conception: CalendarHeart, periodCalendar: CalendarDays, babyGrowth: Baby };
/** Matching Anacan app tool (opened by the shared "open in app" card) per calculator. */
const CALC_APP: Record<CalcPage, AppToolId> = { pregnancyWeight: 'weight', conception: 'calendar', periodCalendar: 'calendar', babyGrowth: 'baby-growth' };
const APP_SRC: Record<CalcPage, string> = { pregnancyWeight: 'web-pregnancy-weight', conception: 'web-conception', periodCalendar: 'web-period-calendar', babyGrowth: 'web-baby-growth' };
/** Official sources per tool (language-independent proper names). */
export const CALC_SOURCES: Record<CalcPage, Array<[string, string]>> = {
  pregnancyWeight: [
    ['Institute of Medicine (2009): Weight Gain During Pregnancy, Reexamining the Guidelines', 'https://nap.nationalacademies.org/catalog/12584/weight-gain-during-pregnancy-reexamining-the-guidelines'],
    ['ACOG Committee Opinion 548: Weight Gain During Pregnancy', 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2013/01/weight-gain-during-pregnancy'],
    ['WHO: Body mass index (BMI)', 'https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index'],
  ],
  conception: [
    ['ACOG Committee Opinion 700: Methods for Estimating the Due Date', 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date'],
    ['ACOG: Fertility Awareness-Based Methods of Family Planning', 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning'],
    ['Wilcox AJ et al. (1995), NEJM: Timing of sexual intercourse in relation to ovulation', 'https://www.nejm.org/doi/full/10.1056/NEJM199512073332301'],
    ['NHS: Due date calculator', 'https://www.nhs.uk/pregnancy/finding-out/due-date-calculator/'],
  ],
  periodCalendar: [
    ['NHS: Periods', 'https://www.nhs.uk/conditions/periods/'],
    ['ACOG: Fertility Awareness-Based Methods of Family Planning', 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning'],
    ['Office on Women\'s Health: Your menstrual cycle', 'https://www.womenshealth.gov/menstrual-cycle/your-menstrual-cycle'],
    ['NHS: Irregular periods', 'https://www.nhs.uk/conditions/irregular-periods/'],
  ],
  babyGrowth: [
    ['WHO Child Growth Standards', 'https://www.who.int/tools/child-growth-standards/standards'],
    ['WHO: Weight-for-age', 'https://www.who.int/tools/child-growth-standards/standards/weight-for-age'],
    ['WHO: Length/height-for-age', 'https://www.who.int/tools/child-growth-standards/standards/length-height-for-age'],
    ['WHO: Head circumference-for-age', 'https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age'],
    ['WHO anthro (official LMS tables and z-score method)', 'https://github.com/WorldHealthOrganization/anthro'],
  ],
};

function useTools() {
  const site = useWebsite(), language = site.route.language;
  const locale = WEBSITE_LANGUAGES.find(item => item.code === language)!.locale;
  const number = (value: number, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  return { ...site, content: calcContent(language), number, date: (value: string) => siteDate(value, language), range: (low: string, high: string) => `${low} – ${high}` };
}
type ErrorCode = keyof CalcContent['ui']['errors'];
const errorCode = (error: unknown): ErrorCode => error instanceof ToolInputError || error instanceof CalculatorInputError ? error.code : 'dateError';
function focusResult(ref: React.RefObject<HTMLElement | null>) {
  setTimeout(() => { ref.current?.focus({ preventScroll: true }); ref.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); }, 30);
}
function downloadCalendar(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'anacan-calendar.ics'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const numeric = (value: string) => value.trim() === '' ? NaN : Number(value.replace(',', '.'));

/** Hub cards for the calculators page. */
export function CalcHubCards() {
  const { href, content, t } = useTools();
  return <div className="site-tool-grid site-tool-grid-new">{CALC_PAGES.map(kind => { const Icon = CALC_ICONS[kind]; return <a className="site-tool-card" href={href(kind)} key={kind}>
    <span className="site-icon-wash site-wash-peach"><Icon size={23} strokeWidth={1.5}/></span><small>{content.ui.freeTool}</small><h3>{content[kind].name}</h3><p>{content[kind].card}</p>
    <span className="site-text-link">{t('calculate')}<Arrow/></span></a>; })}</div>;
}

function CalcShell({ kind, form, result }: { kind: CalcPage; form: React.ReactNode; result: React.ReactNode }) {
  const { content, href, t } = useTools(), page = content[kind], ui = content.ui;
  const Icon = CALC_ICONS[kind];
  return <>
    <nav className="site-breadcrumb site-tool-breadcrumb" aria-label={t('home')}><a href={href()}>{t('home')}</a><span aria-hidden="true">/</span><a href={href('tools')}>{t('tools')}</a><span aria-hidden="true">/</span><span>{page.name}</span></nav>
    <div className="site-page-intro"><Eyebrow>{ui.freeTool}</Eyebrow><h1>{page.h1}</h1><p>{page.intro}</p></div>
    <div className="site-calculator-layout">{form}<div className="site-calculator-side">{result || <div className="site-calculator-explainer"><Eyebrow mint>{ui.freeTool}</Eyebrow><h2>{page.name}</h2><p>{page.card}</p><div className="site-paper-calendar" aria-hidden="true"><Icon size={100} strokeWidth={0.65}/></div></div>}</div></div>
    <p className="site-tool-disclaimer" role="note">{ui.disclaimer}</p>
    <section className="site-section site-guide site-tool-guide">
      <div><h2>{ui.keyFacts}</h2><div className="site-tool-table"><table><tbody>{page.facts.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></div></div>
      <div><h2>{ui.howCalculated}</h2>{page.method.map(text => <p key={text}>{text}</p>)}<p className="site-formula">{page.formula}</p></div>
    </section>
    <section className="site-urgent-card site-tool-doctor"><h2>{ui.whenDoctor}</h2><ul>{page.doctor.map(text => <li key={text}>{text}</li>)}</ul></section>
    <section className="site-section site-faq-section"><h2>{ui.faq}</h2><div className="site-faq-list">{page.faq.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
    <div className="site-references"><h2>{ui.sources}</h2><ul>{CALC_SOURCES[kind].map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{label}<Arrow diagonal/></a></li>)}</ul></div>
    <AppToolCard tool={CALC_APP[kind]} src={APP_SRC[kind]} title={page.appTitle} text={page.app} features={page.appFeatures} labels={ui.appOpen}/>
    <section className="site-section site-tool-related"><h2>{ui.related}</h2><div>{CALC_PAGES.filter(item => item !== kind).map(item => <a key={item} className="site-outline-button" href={href(item)}>{content[item].name}<Arrow/></a>)}
      <a className="site-outline-button" href={href('ovulation')}>{t('ovulation')}<Arrow/></a><a className="site-outline-button" href={href('dueDate')}>{t('dueDate')}<Arrow/></a><a className="site-ghost-button" href={href('tools')}>{ui.calculators}<Arrow/></a></div></section>
  </>;
}
function ErrorLine({ code, ui }: { code: ErrorCode | null; ui: CalcContent['ui'] }) {
  return code ? <p id="calculator-error" className="site-form-error" role="alert">{ui.errors[code]}</p> : null;
}
function Field({ id, label, unit, children }: { id: string; label: string; unit?: string; children: React.ReactNode }) {
  return <><label htmlFor={id}>{label}{unit && <> <span>({unit})</span></>}</label>{children}</>;
}

export function PregnancyWeightPage() {
  const { content, number, range } = useTools(), ui = content.ui, labels = content.pregnancyWeight.labels;
  const [values, setValues] = useState({ pre: '', height: '', current: '', week: '' }), [twins, setTwins] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null), [result, setResult] = useState<PregnancyWeightEstimate | null>(null), ref = useRef<HTMLElement>(null);
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues(value => ({ ...value, [key]: event.target.value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setResult(null);
    try { setResult(estimatePregnancyWeight({ preWeightKg: numeric(values.pre), heightCm: numeric(values.height), currentWeightKg: numeric(values.current), week: numeric(values.week), twins })); focusResult(ref); }
    catch (caught) { setError(errorCode(caught)); }
  };
  const kg = (value: number) => `${number(value)} ${ui.kg}`;
  const form = <form className="site-calculator-form" onSubmit={submit} noValidate>
    <span className="site-icon-wash site-wash-peach"><Scale size={24} strokeWidth={1.5}/></span>
    <Field id="pre-weight" label={labels.preWeight} unit={ui.kg}><input id="pre-weight" inputMode="decimal" type="number" min={30} max={250} step="0.1" required value={values.pre} onChange={set('pre')}/></Field>
    <Field id="height" label={labels.height} unit={ui.cm}><input id="height" inputMode="decimal" type="number" min={120} max={220} step="0.1" required value={values.height} onChange={set('height')}/></Field>
    <Field id="current-weight" label={labels.currentWeight} unit={ui.kg}><input id="current-weight" inputMode="decimal" type="number" min={30} max={300} step="0.1" required value={values.current} onChange={set('current')}/></Field>
    <Field id="pregnancy-week" label={labels.week}><input id="pregnancy-week" inputMode="numeric" type="number" min={1} max={42} step={1} required value={values.week} onChange={set('week')}/></Field>
    <fieldset className="site-tool-choice"><legend>{labels.pregnancyType}</legend>
      <label><input type="radio" name="pregnancy-type" checked={!twins} onChange={() => setTwins(false)}/>{labels.singleton}</label>
      <label><input type="radio" name="pregnancy-type" checked={twins} onChange={() => setTwins(true)}/>{labels.twins}</label></fieldset>
    <ErrorLine code={error} ui={ui}/>
    <button className="site-rainbow-button" type="submit">{ui.calculate}<Arrow/></button><p className="site-input-help">{ui.privacy}</p>
  </form>;
  const output = result && <section className="site-results" ref={ref} tabIndex={-1} aria-live="polite" data-calculator-result>
    <Eyebrow mint>{ui.result}</Eyebrow><h2>{result.gain > 0 ? '+' : ''}{kg(result.gain)}</h2><p>{labels.yourGain}</p>
    <dl className="site-result-details">
      <div><dt>{labels.bmi}</dt><dd>{number(result.bmi)} · {labels.categories[result.category]}</dd></div>
      <div><dt>{labels.totalGain}</dt><dd>{result.totalRange ? `${range(number(result.totalRange[0]), number(result.totalRange[1]))} ${ui.kg}` : labels.noTwinRange}</dd></div>
      {result.weeklyRate && <div><dt>{labels.weeklyRate}</dt><dd>{range(number(result.weeklyRate[0], 2), number(result.weeklyRate[1], 2))} {ui.kg} {labels.perWeek}</dd></div>}
      {result.weekRange && <div><dt>{labels.weekRange}</dt><dd data-week-range>{range(number(result.weekRange[0]), number(result.weekRange[1]))} {ui.kg}</dd></div>}
    </dl>
    {result.position ? <p className={`site-tool-position site-tool-position-${result.position}`} data-position={result.position}>{labels[result.position]}</p> : <p className="site-tool-position">{labels.twinsNote}</p>}
    <div className="site-result-actions"><button className="site-ghost-button" type="button" onClick={() => { setResult(null); document.getElementById('pre-weight')?.focus(); }}>{ui.reset}</button></div>
  </section>;
  return <CalcShell kind="pregnancyWeight" form={form} result={output}/>;
}

export function ConceptionPage() {
  const { content, date } = useTools(), ui = content.ui, labels = content.conception.labels;
  const [from, setFrom] = useState<'lmp' | 'due'>('lmp'), [value, setValue] = useState(''), [cycle, setCycle] = useState('28');
  const [error, setError] = useState<ErrorCode | null>(null), [result, setResult] = useState<ConceptionEstimate | null>(null), ref = useRef<HTMLElement>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setResult(null);
    try { setResult(estimateConception({ from, date: value, cycleLength: from === 'lmp' ? numeric(cycle) : 28 })); focusResult(ref); }
    catch (caught) { setError(errorCode(caught)); }
  };
  const span = (start: string, end: string) => <><time dateTime={start}>{date(start)}</time> – <time dateTime={end}>{date(end)}</time></>;
  const form = <form className="site-calculator-form" onSubmit={submit} noValidate>
    <span className="site-icon-wash site-wash-peach"><CalendarHeart size={24} strokeWidth={1.5}/></span>
    <fieldset className="site-tool-choice"><legend>{labels.method}</legend>
      <label><input type="radio" name="conception-from" checked={from === 'lmp'} onChange={() => { setFrom('lmp'); setResult(null); }}/>{labels.fromLmp}</label>
      <label><input type="radio" name="conception-from" checked={from === 'due'} onChange={() => { setFrom('due'); setResult(null); }}/>{labels.fromDue}</label></fieldset>
    <Field id="conception-date" label={from === 'lmp' ? labels.lmp : labels.dueDate}><input id="conception-date" type="date" required max={from === 'lmp' ? todayIso() : undefined} value={value} onChange={event => setValue(event.target.value)}/></Field>
    {from === 'lmp' && <Field id="conception-cycle" label={labels.cycleLength} unit={ui.days}><input id="conception-cycle" type="number" inputMode="numeric" min={21} max={45} step={1} value={cycle} onChange={event => setCycle(event.target.value)}/></Field>}
    <ErrorLine code={error} ui={ui}/>
    <button className="site-rainbow-button" type="submit">{ui.calculate}<Arrow/></button><p className="site-input-help">{ui.privacy}</p>
  </form>;
  const output = result && <section className="site-results" ref={ref} tabIndex={-1} aria-live="polite" data-calculator-result>
    <Eyebrow mint>{ui.result}</Eyebrow><h2><time dateTime={result.conception}>{date(result.conception)}</time></h2><p>{labels.conception}</p>
    <dl className="site-result-details">
      <div><dt>{labels.likelyWindow}</dt><dd>{span(result.windowStart, result.windowEnd)}</dd></div>
      <div><dt>{labels.fertileWindow}</dt><dd>{span(result.fertileStart, result.fertileEnd)}</dd></div>
      {from === 'lmp' ? <div><dt>{labels.estimatedDue}</dt><dd><time dateTime={result.dueDate}>{date(result.dueDate)}</time></dd></div>
        : <div><dt>{labels.estimatedLmp}</dt><dd><time dateTime={result.lastPeriod}>{date(result.lastPeriod)}</time></dd></div>}
    </dl>
    <div className="site-result-actions"><button className="site-ghost-button" type="button" onClick={() => { setResult(null); document.getElementById('conception-date')?.focus(); }}>{ui.reset}</button></div>
  </section>;
  return <CalcShell kind="conception" form={form} result={output}/>;
}

export function PeriodCalendarPage() {
  const { content, date } = useTools(), ui = content.ui, labels = content.periodCalendar.labels;
  const [lastPeriod, setLastPeriod] = useState(''), [cycle, setCycle] = useState('28'), [period, setPeriod] = useState('5');
  const [error, setError] = useState<ErrorCode | null>(null), [cycles, setCycles] = useState<CycleEstimate[] | null>(null), ref = useRef<HTMLElement>(null);
  const periodLength = numeric(period);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setCycles(null);
    // Seven cycles so that the calendar also marks the sixth upcoming period itself.
    try { setCycles(estimatePeriodCalendar({ lastPeriod, cycleLength: numeric(cycle), periodLength, lutealLength: 14 }, 7)); focusResult(ref); }
    catch (caught) { setError(errorCode(caught)); }
  };
  const periodEnd = (start: string) => calendarIso(addCalendarDays(parseCalendarDate(start)!, periodLength - 1));
  const exportDates = () => { if (!cycles) return; downloadCalendar(makeCalendarFile(cycles.slice(0, 6).flatMap(item => [
    { date: item.fertileStart, endDate: item.fertileEnd, title: labels.fertile, description: ui.disclaimer, id: 'fertile' },
    { date: item.ovulation, title: labels.ovulation, description: ui.disclaimer, id: 'ovulation' },
    { date: item.nextPeriod, endDate: periodEnd(item.nextPeriod), title: labels.period, description: ui.disclaimer, id: 'period' },
  ]))); };
  const form = <form className="site-calculator-form" onSubmit={submit} noValidate>
    <span className="site-icon-wash site-wash-peach"><CalendarDays size={24} strokeWidth={1.5}/></span>
    <Field id="period-last" label={labels.lmp}><input id="period-last" type="date" required max={todayIso()} value={lastPeriod} onChange={event => setLastPeriod(event.target.value)}/></Field>
    <Field id="period-cycle" label={labels.cycleLength} unit={ui.days}><input id="period-cycle" type="number" inputMode="numeric" min={21} max={45} step={1} value={cycle} onChange={event => setCycle(event.target.value)}/></Field>
    <Field id="period-length" label={labels.periodLength} unit={ui.days}><input id="period-length" type="number" inputMode="numeric" min={1} max={10} step={1} value={period} onChange={event => setPeriod(event.target.value)}/></Field>
    <ErrorLine code={error} ui={ui}/>
    <button className="site-rainbow-button" type="submit">{ui.calculate}<Arrow/></button><p className="site-input-help">{ui.privacy}</p>
  </form>;
  const output = cycles && <section className="site-results" ref={ref} tabIndex={-1} aria-live="polite" data-calculator-result>
    <Eyebrow mint>{ui.result}</Eyebrow><h2><time dateTime={cycles[0].nextPeriod}>{date(cycles[0].nextPeriod)}</time></h2><p>{labels.nextPeriods}</p>
    {/* Each row reads in time order: the cycle's fertile window and ovulation, then the period that ends the cycle. */}
    <div className="site-tool-table"><table className="site-tool-cycles"><thead><tr><th scope="col">{labels.cycleNumber}</th><th scope="col">{labels.fertile}</th><th scope="col">{labels.ovulation}</th><th scope="col">{labels.period}</th></tr></thead>
      <tbody>{cycles.slice(0, 6).map((item, index) => <tr key={item.nextPeriod}><td>{index + 1}</td>
        <td><time dateTime={item.fertileStart}>{date(item.fertileStart)}</time> – <time dateTime={item.fertileEnd}>{date(item.fertileEnd)}</time></td><td><time dateTime={item.ovulation}>{date(item.ovulation)}</time></td>
        <td><time dateTime={item.nextPeriod}>{date(item.nextPeriod)}</time> – <time dateTime={periodEnd(item.nextPeriod)}>{date(periodEnd(item.nextPeriod))}</time></td></tr>)}</tbody></table></div>
    <CycleCalendar key={cycles[0].periodStart} estimate={cycles[0]} more={cycles.slice(1)}/>
    <div className="site-result-actions"><button className="site-outline-button" type="button" onClick={exportDates}><Download size={17}/>{ui.exportCalendar}</button><button className="site-ghost-button" type="button" onClick={() => { setCycles(null); document.getElementById('period-last')?.focus(); }}>{ui.reset}</button></div>
  </section>;
  return <CalcShell kind="periodCalendar" form={form} result={output}/>;
}

const CURVES: Array<[number, string]> = [[-1.881, '3'], [-1.036, '15'], [0, '50'], [1.036, '85'], [1.881, '97']];
export function GrowthChart({ indicator, sex, ageDays, value, label, monthsLabel, unit, language }: { indicator: GrowthIndicator; sex: GrowthSex; ageDays: number; value: number; label: string; monthsLabel: string; unit: string; language: WebsiteLanguageCode }) {
  const maxDays = ageDays <= 730 ? 730 : GROWTH_MAX_DAYS, maxMonths = maxDays === 730 ? 24 : 36;
  const curves = CURVES.map(([z, name]) => ({ name, points: whoCurve(indicator, sex, z, maxDays) }));
  const values = curves.flatMap(curve => curve.points.map(point => point[1])).concat(value);
  const step = indicator === 'weight' ? 2 : 5, low = Math.floor(Math.min(...values) / step) * step, high = Math.ceil(Math.max(...values) / step) * step;
  const width = 640, height = 360, left = 44, right = 34, top = 14, bottom = 40;
  const x = (day: number) => left + day / maxDays * (width - left - right), y = (amount: number) => top + (high - amount) / (high - low) * (height - top - bottom);
  const format = new Intl.NumberFormat(WEBSITE_LANGUAGES.find(item => item.code === language)!.locale);
  const yTicks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step);
  const xTicks = Array.from({ length: maxMonths / 3 + 1 }, (_, index) => index * 3);
  return <figure className="site-tool-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} direction="ltr">
    {yTicks.map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="site-tool-chart-grid"/><text x={left - 6} y={y(tick) + 4} textAnchor="end">{format.format(tick)}</text></g>)}
    {xTicks.map(tick => <text key={tick} x={x(tick * 30.4375)} y={height - bottom + 16} textAnchor="middle">{format.format(tick)}</text>)}
    <text x={(left + width - right) / 2} y={height - 6} textAnchor="middle" className="site-tool-chart-axis">{monthsLabel}</text>
    <text x={8} y={top + 4} className="site-tool-chart-axis">{unit}</text>
    {curves.map(curve => <g key={curve.name} className={`site-tool-curve site-tool-curve-p${curve.name}`}><polyline fill="none" points={curve.points.map(([day, amount]) => `${x(day).toFixed(1)},${y(amount).toFixed(1)}`).join(' ')}/>
      <text x={width - right + 4} y={y(curve.points[curve.points.length - 1][1]) + 4}>{curve.name}</text></g>)}
    <circle cx={x(ageDays)} cy={y(value)} r={6} className="site-tool-chart-point"/>
  </svg><figcaption>{label}</figcaption></figure>;
}

export function BabyGrowthPage() {
  const { content, number, route } = useTools(), ui = content.ui, labels = content.babyGrowth.labels;
  const [sex, setSex] = useState<GrowthSex>('female'), [indicator, setIndicator] = useState<GrowthIndicator>('weight');
  const [birthDate, setBirthDate] = useState(''), [measureDate, setMeasureDate] = useState(''), [value, setValue] = useState('');
  const [error, setError] = useState<ErrorCode | null>(null), [result, setResult] = useState<(GrowthEstimate & { indicator: GrowthIndicator; sex: GrowthSex; value: number }) | null>(null), ref = useRef<HTMLElement>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setResult(null);
    try { const amount = numeric(value); setResult({ ...estimateGrowth({ indicator, sex, birthDate, measureDate, value: amount }), indicator, sex, value: amount }); focusResult(ref); }
    catch (caught) { setError(errorCode(caught)); }
  };
  const unit = indicator === 'weight' ? ui.kg : ui.cm;
  // The measurement date defaults to today in the browser (after hydration, so SSR and client agree).
  useEffect(() => { setMeasureDate(value => value || todayIso()); }, []);
  const percentile = (value: number) => value < 0.1 ? '< ' + number(0.1) : value > 99.9 ? '> ' + number(99.9) : number(value);
  const form = <form className="site-calculator-form" onSubmit={submit} noValidate>
    <span className="site-icon-wash site-wash-peach"><Baby size={24} strokeWidth={1.5}/></span>
    <fieldset className="site-tool-choice"><legend>{labels.sex}</legend>
      <label><input type="radio" name="growth-sex" checked={sex === 'female'} onChange={() => setSex('female')}/>{labels.girl}</label>
      <label><input type="radio" name="growth-sex" checked={sex === 'male'} onChange={() => setSex('male')}/>{labels.boy}</label></fieldset>
    <fieldset className="site-tool-choice"><legend>{labels.indicator}</legend>
      {(['weight', 'length', 'head'] as const).map(item => <label key={item}><input type="radio" name="growth-indicator" checked={indicator === item} onChange={() => setIndicator(item)}/>{labels[item]}</label>)}</fieldset>
    <Field id="growth-birth" label={labels.birthDate}><input id="growth-birth" type="date" required max={todayIso()} value={birthDate} onChange={event => setBirthDate(event.target.value)}/></Field>
    <Field id="growth-date" label={labels.measureDate}><input id="growth-date" type="date" required max={todayIso()} value={measureDate} onChange={event => setMeasureDate(event.target.value)}/></Field>
    <Field id="growth-value" label={labels.value} unit={unit}><input id="growth-value" type="number" inputMode="decimal" step="0.01" required value={value} onChange={event => setValue(event.target.value)}/></Field>
    <p className="site-input-help">{labels.heightNote}</p>
    <ErrorLine code={error} ui={ui}/>
    <button className="site-rainbow-button" type="submit">{ui.calculate}<Arrow/></button><p className="site-input-help">{ui.privacy}</p>
  </form>;
  const output = result && <section className="site-results" ref={ref} tabIndex={-1} aria-live="polite" data-calculator-result>
    <Eyebrow mint>{ui.result}</Eyebrow><h2 data-percentile>{labels.percentile}: {percentile(result.percentile)}</h2>
    <p>{result.percentile < 3 ? labels.bandLow : result.percentile > 97 ? labels.bandHigh : labels.bandTypical}</p>
    <dl className="site-result-details">
      <div><dt>{labels.zscore}</dt><dd data-zscore>{number(result.z, 2)}</dd></div>
      <div><dt>{labels.age}</dt><dd>{labels.ageValue.replace('{months}', number(result.ageMonths, 0)).replace('{days}', number(result.ageRestDays, 0))}</dd></div>
      <div><dt>{labels.median}</dt><dd>{number(result.median, 1)} {result.indicator === 'weight' ? ui.kg : ui.cm}</dd></div>
    </dl>
    <GrowthChart indicator={result.indicator} sex={result.sex} ageDays={result.ageDays} value={result.value} label={`${labels.chart}: ${labels[result.indicator]}, ${result.sex === 'male' ? labels.boy : labels.girl}`} monthsLabel={labels.months} unit={result.indicator === 'weight' ? ui.kg : ui.cm} language={route.language}/>
    <div className="site-result-actions"><button className="site-ghost-button" type="button" onClick={() => { setResult(null); document.getElementById('growth-value')?.focus(); }}>{ui.reset}</button></div>
  </section>;
  return <CalcShell kind="babyGrowth" form={form} result={output}/>;
}

export default function CalcPageView({ kind }: { kind: CalcPage }) {
  return kind === 'pregnancyWeight' ? <PregnancyWeightPage/> : kind === 'conception' ? <ConceptionPage/> : kind === 'periodCalendar' ? <PeriodCalendarPage/> : <BabyGrowthPage/>;
}
