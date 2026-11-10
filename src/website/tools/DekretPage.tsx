/** /az/dekret-pulu-kalkulyatoru/: Azerbaijani maternity benefit calculator (AZ only, texts inline). */
import { useRef, useState } from 'react';
import { Banknote } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { siteDate } from '../dates';
import { AppToolCard } from './AppOpen';
import { ToolBreadcrumb } from './NamesPages';
import { BIRTH_TYPES, DekretInputError, estimateDekret, formatAzn, leaveDays, payShare, type BirthType, type DekretEstimate } from './dekret';
import { AGRICULTURE_DAYS, BIRTH_LABELS, DEKRET_ARTICLES, DEKRET_COPY, DEKRET_SOURCES, answerText, dekretFaq } from './dekret-copy';
import { maternityData } from './tool-data';
import './tools.css';

const SAMPLE_SALARY = 1000;
export default function DekretPage() {
  const { href } = useWebsite();
  const data = maternityData();
  const [salary, setSalary] = useState(''), [type, setType] = useState<BirthType>('normal'), [dueDate, setDueDate] = useState('');
  const [result, setResult] = useState<DekretEstimate | null>(null), [error, setError] = useState<'salary' | 'date' | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  if (!data) return null;
  const { rule, countryCount } = data;
  const percentage = Math.round(payShare(rule) * 100), tenure = rule.tenureRequirementMonths ?? 6;
  const sample = estimateDekret(rule, { salary: SAMPLE_SALARY, type: 'normal' });
  const date = (value?: string) => value ? siteDate(value + 'T12:00:00Z', 'az') : '';
  const calculate = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setResult(null);
    try {
      setResult(estimateDekret(rule, { salary: Number(salary.replace(',', '.')), type, dueDate: dueDate || undefined }));
      setTimeout(() => resultRef.current?.focus({ preventScroll: true }), 30);
    } catch (problem) { setError(problem instanceof DekretInputError ? problem.code : 'salary'); }
  };
  const faq = dekretFaq(rule);
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Pulsuz kalkulyator</Eyebrow><h1>{DEKRET_COPY.h1}</h1><p>{DEKRET_COPY.intro}</p></div>
    <aside className="tl-answer" aria-label="Qısa cavab"><strong>Qısa cavab</strong><p>{answerText(rule)}</p></aside>
    <div className="site-calculator-layout tl-dekret-layout">
      <form className="site-calculator-form" onSubmit={calculate} noValidate>
        <span className="site-icon-wash site-wash-mint"><Banknote size={24} strokeWidth={1.5}/></span>
        <label htmlFor="dekret-salary">Orta aylıq əmək haqqı <span>(AZN)</span></label>
        <input id="dekret-salary" name="salary" type="number" inputMode="decimal" min={1} step="0.01" required placeholder="Məsələn: 1000" value={salary}
          aria-invalid={error === 'salary'} aria-describedby={error === 'salary' ? 'dekret-error' : 'dekret-salary-help'} onChange={event => setSalary(event.target.value)}/>
        <p className="site-input-help" id="dekret-salary-help">Son 12 ayın (4 rübün) orta aylıq qazancı.</p>
        <fieldset className="tl-choices"><legend>Doğuş növü</legend>
          {BIRTH_TYPES.map(item => { const days = leaveDays(rule, item); return <label key={item} className="tl-choice">
            <input type="radio" name="birthType" value={item} checked={type === item} onChange={() => setType(item)}/>
            <span>{BIRTH_LABELS[item]}<small>{days.total} gün ({days.before} + {days.after})</small></span></label>; })}
        </fieldset>
        <label htmlFor="dekret-due">Təxmini doğuş tarixi <span>(istəyə bağlı)</span></label>
        <input id="dekret-due" name="dueDate" type="date" value={dueDate} aria-invalid={error === 'date'} onChange={event => setDueDate(event.target.value)}/>
        {error && <p id="dekret-error" className="site-form-error" role="alert">{error === 'salary' ? 'Orta aylıq əmək haqqını AZN ilə daxil edin.' : 'Tarixi düzgün daxil edin.'}</p>}
        <button className="site-rainbow-button" type="submit">Dekret pulunu hesabla<Arrow/></button>
        <p className="site-input-help">Məlumatlar yalnız brauzerinizdə hesablanır və heç yerə göndərilmir.</p>
      </form>
      <div className="site-calculator-side">
        {result ? <section className="site-results" ref={resultRef} tabIndex={-1} aria-live="polite" data-calculator-result>
          <Eyebrow mint>Nəticə</Eyebrow>
          <h2>{formatAzn(result.benefit)} AZN</h2><p>Təxmini ümumi dekret pulu, {result.total} gün</p>
          <dl className="site-result-details">
            <div><dt>Məzuniyyət</dt><dd>{result.total} gün: doğuşdan əvvəl {result.before}, doğuşdan sonra {result.after}</dd></div>
            <div><dt>Gündəlik məbləğ</dt><dd>{formatAzn(result.daily)} AZN ({result.capped ? `yuxarı hədd: ${formatAzn(result.monthlyCap ?? 0)} × 12 / 365` : `${formatAzn(result.salary)} × 12 / 365 × ${result.percentage}%`})</dd></div>
            {result.start && <div><dt>Məzuniyyətin başlanğıcı</dt><dd><time dateTime={result.start}>{date(result.start)}</time></dd></div>}
            {result.end && <div><dt>Məzuniyyətin sonu</dt><dd><time dateTime={result.end}>{date(result.end)}</time></dd></div>}
            {result.returnDate && <div><dt>İşə qayıdış</dt><dd><time dateTime={result.returnDate}>{date(result.returnDate)}</time></dd></div>}
          </dl>
          <p className="site-calculator-note">{result.start ? 'Tarixlər təxmini doğuş tarixinə görə hesablanıb; faktiki doğuş tarixi fərqli olduqda dəyişə bilər. ' : ''}{result.capped ? `Maaşınız yuxarı həddi keçdiyi üçün müavinət ayda ${formatAzn(result.monthlyCap ?? 0)} AZN həddinə görə hesablanıb. ` : ''}Aylıq müavinət minimum aylıq əmək pensiyasının (320 AZN) 25 mislindən, yəni 8 000 AZN-dən çox ola bilməz.</p>
          <div className="site-result-actions"><button className="site-ghost-button" type="button" onClick={() => { setResult(null); document.getElementById('dekret-salary')?.focus(); }}>Yenidən hesabla</button></div>
        </section> : <div className="site-calculator-explainer"><Eyebrow mint>Nümunə</Eyebrow><h2>{formatAzn(SAMPLE_SALARY)} AZN maaşla</h2>
          <p>Normal doğuşda {sample.total} gün üçün gündəlik {formatAzn(sample.daily)} AZN, cəmi təxminən <strong>{formatAzn(sample.benefit)} AZN</strong>.</p></div>}
      </div>
    </div>
    <section className="site-section tl-prose"><h2>Əsas rəqəmlər</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th scope="col">Hal</th><th scope="col">Doğuşdan əvvəl</th><th scope="col">Doğuşdan sonra</th><th scope="col">Cəmi</th></tr></thead><tbody>
        {BIRTH_TYPES.map(item => { const days = leaveDays(rule, item); return <tr key={item}><th scope="row">{BIRTH_LABELS[item]}</th><td>{days.before} gün</td><td>{days.after} gün</td><td>{days.total} gün</td></tr>; })}
        {AGRICULTURE_DAYS.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.before} gün</td><td>{item.after} gün</td><td>{item.before + item.after} gün</td></tr>)}
      </tbody></table></div>
      <ul className="tl-facts-list"><li>Ödəniş: orta günlük qazancın {percentage}%-i, hər təqvim günü üçün.</li><li>Staj: ən azı {tenure} ay sosial sığorta stajı.</li><li>Yuxarı hədd: ayda 8 000 AZN (minimum aylıq əmək pensiyası 320 AZN × 25).</li></ul>
    </section>
    <section className="site-section tl-prose"><h2>Dekret pulu necə hesablanır</h2>
      <p>Hamiləliyə və doğuşa görə müavinətin ümumi məbləği orta günlük qazancın məzuniyyətin təqvim günlərinin sayına vurulması ilə tapılır. Orta günlük qazanc məzuniyyətin başladığı aydan əvvəlki dörd ardıcıl rübdəki (12 ay) ümumi qazancın həmin dövrün nəzərə alınan təqvim günlərinə bölünməsi ilə hesablanır. Əvvəlki əmək qabiliyyətsizliyi, analıq məzuniyyəti və qismən ödənişli sosial məzuniyyət günləri bu günlərdən çıxılır.</p>
      <p className="site-formula">Gündəlik məbləğ = orta aylıq əmək haqqı × 12 / 365<br/>Dekret pulu = gündəlik məbləğ × məzuniyyət günləri</p>
      <p>Nümunə: {formatAzn(SAMPLE_SALARY)} AZN orta aylıq əmək haqqı ilə gündəlik məbləğ {formatAzn(sample.daily)} AZN, normal doğuşda {sample.total} gün üçün cəmi {formatAzn(sample.benefit)} AZN olur.</p>
      <p>Sosial.gov.az-a görə yeni qaydalar 1 may 2026-cı ildən tətbiq olunur; bu tarixdən əvvəl başlamış hallara həmin vaxt qüvvədə olan qaydalar şamil edilir.</p>
      <h3>Hüquqi əsas</h3>
      <p>Azərbaycan Respublikasının Əmək Məcəlləsinin 125-ci maddəsi hamiləliyə və doğuşa görə məzuniyyətin müddətini, 126-cı maddəsi övladlığa götürən qadınların hüququnu müəyyən edir. Müavinət məcburi dövlət sosial sığortası üzrə ödənilir.</p>
      <ul className="tl-sources">{DEKRET_SOURCES.map(item => <li key={item.href}><a href={item.href} target="_blank" rel="noopener noreferrer">{item.label}<Arrow diagonal/></a></li>)}</ul>
    </section>
    <section className="site-section tl-prose"><h2>Kimlərə düşür</h2>
      <ul><li>Məcburi dövlət sosial sığortası ilə sığortalanmış işləyən qadınlara.</li><li>Ən azı {tenure} ay sosial sığorta stajı olanlara.</li>
        <li>İki aylığadək yaşında uşağı övladlığa götürən qadınlara doğuşdan sonrakı {rule.normalDaysAfter} günlük məzuniyyət hüququ verilir (126-cı maddə).</li>
        <li>Kənd təsərrüfatı istehsalında çalışan qadınlar üçün müddətlər daha uzundur (125-ci maddənin 2-ci hissəsi).</li></ul>
    </section>
    <section className="site-section tl-prose"><h2>Necə təyin olunur</h2>
      <ol><li>Tibb müəssisəsi elektron xəstəlik vərəqəsi verir.</li><li>İşəgötürən məzuniyyət əmrini Mərkəzləşdirilmiş Elektron İnformasiya Sisteminin «Əmək və Məşğulluq» altsisteminə daxil edir.</li>
        <li>Müavinət məzuniyyətin təqvim günləri üçün avtomatik təyin olunur.</li><li>Avtomatik təyinat mümkün olmadıqda müraciət müavinət qaydalarının 1 nömrəli əlavəsindəki forma ilə edilir.</li></ol>
    </section>
    <section className="site-section tl-prose tl-read-more"><h2>Ətraflı oxuyun</h2>
      <ul><li><a className="site-text-link" href={href('article', DEKRET_ARTICLES.dekret.slug)}>{DEKRET_ARTICLES.dekret.label}<Arrow diagonal/></a></li>
        <li><a className="site-text-link" href={href('article', DEKRET_ARTICLES.birth.slug)}>{DEKRET_ARTICLES.birth.label}<Arrow diagonal/></a></li></ul>
    </section>
    <AppToolCard tool="maternity-calculator" src="web-dekret" title={DEKRET_COPY.appTitle} text={DEKRET_COPY.appText(countryCount)} features={DEKRET_COPY.appFeatures(countryCount)}/>
    <section className="site-section site-faq-section"><h2>Tez-tez verilən suallar</h2><div className="site-faq-list">{faq.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <p className="tl-note tl-disclaimer">{DEKRET_COPY.disclaimer}</p>
  </>;
}
