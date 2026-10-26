import { useRef, useState } from 'react';
import { CalendarDays, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebsite } from './context';
import { Intro, FaqList, DownloadCard, Arrow, Eyebrow } from './components';
import { addCalendarDays, calendarIso, CalculatorInputError, estimateCycle, estimatePregnancy, makeCalendarFile, parseCalendarDate, todayIso, type CycleEstimate, type PregnancyEstimate } from './calculators';
import type { WebsiteCopyKey } from './model';
import { APP_LANGUAGES } from '../lib/app-languages';
import {siteDate,siteMonth,siteWeekdays} from './dates';

function downloadCalendar(text:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='anacan-calendar.ics';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function ReferenceLinks() {
  const {t}=useWebsite();
  return <div className="site-references"><h2>{t('sourcesNote')}</h2><ul>
    <li><a href="https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning" target="_blank" rel="noopener noreferrer">ACOG — Fertility awareness<Arrow diagonal/></a></li>
    <li><a href="https://www.nhs.uk/pregnancy/trying-for-a-baby/doing-a-pregnancy-test/" target="_blank" rel="noopener noreferrer">NHS — Pregnancy testing<Arrow diagonal/></a></li>
    <li><a href="https://www.nhs.uk/pregnancy/finding-out/due-date-calculator/" target="_blank" rel="noopener noreferrer">NHS — Due date calculator<Arrow diagonal/></a></li>
  </ul></div>;
}
export function CycleCalendar({estimate}:{estimate:CycleEstimate}) {
  const {t,route}=useWebsite();
  const initial=parseCalendarDate(estimate.periodStart)!;
  const [month,setMonth]=useState(()=>new Date(Date.UTC(initial.getUTCFullYear(),initial.getUTCMonth(),1,12)));
  const locale=APP_LANGUAGES.find(item=>item.code===route.language)!.locale;
  const first=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1,12)),offset=(first.getUTCDay()+6)%7;
  const days=Array.from({length:42},(_,index)=>addCalendarDays(first,index-offset));
  const labels=siteWeekdays(route.language);
  const shift=(amount:number)=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+amount,1,12)));
  return <div className="site-cycle-calendar" aria-label={t('calendarLabel')}><div className="site-calendar-heading"><button type="button" onClick={()=>shift(-1)} aria-label={t('previous')}><ChevronLeft size={18}/></button><strong>{siteMonth(month,route.language)}</strong><button type="button" onClick={()=>shift(1)} aria-label={t('next')}><ChevronRight size={18}/></button></div>
    <table><thead><tr>{labels.map((label,index)=><th scope="col" key={index}>{label}</th>)}</tr></thead><tbody>{Array.from({length:6},(_,row)=><tr key={row}>{days.slice(row*7,row*7+7).map(date=>{
      const iso=calendarIso(date),ovulation=iso===estimate.ovulation,period=iso>=estimate.periodStart&&iso<=estimate.periodEnd,fertile=iso>=estimate.fertileStart&&iso<=estimate.additionalDay;
      return <td key={iso} className={`${date.getUTCMonth()!==month.getUTCMonth()?'site-calendar-other ':''}${ovulation?'site-calendar-ovulation':period?'site-calendar-period':fertile?'site-calendar-fertile':''}`}><time dateTime={iso} title={ovulation?t('calendarLegendOvulation'):period?t('calendarLegendPeriod'):fertile?t('calendarLegendFertile'):undefined}>{new Intl.NumberFormat(locale).format(date.getUTCDate())}</time></td>;
    })}</tr>)}</tbody></table><div className="site-calendar-legend"><span><i className="site-calendar-period"/>{t('calendarLegendPeriod')}</span><span><i className="site-calendar-fertile"/>{t('calendarLegendFertile')}</span><span><i className="site-calendar-ovulation"/>{t('calendarLegendOvulation')}</span></div></div>;
}
export default function CalculatorPage({kind}:{kind:'ovulation'|'dueDate'}) {
  const {t,route}=useWebsite();
  const [lastPeriod,setLastPeriod]=useState(''),[cycle,setCycle]=useState(28),[period,setPeriod]=useState(5),[luteal,setLuteal]=useState(14);
  const [error,setError]=useState<WebsiteCopyKey|null>(null),[cycleResult,setCycleResult]=useState<CycleEstimate|null>(null),[pregnancyResult,setPregnancyResult]=useState<PregnancyEstimate|null>(null);
  const resultRef=useRef<HTMLElement>(null);
  const locale=APP_LANGUAGES.find(item=>item.code===route.language)!.locale;
  const date=(value:string)=>siteDate(value,route.language);
  const calculate=(event:React.FormEvent)=>{
    event.preventDefault();setError(null);setCycleResult(null);setPregnancyResult(null);
    try{
      if(kind==='ovulation')setCycleResult(estimateCycle({lastPeriod,cycleLength:cycle,periodLength:period,lutealLength:luteal}));
      else setPregnancyResult(estimatePregnancy(lastPeriod,cycle));
      setTimeout(()=>{resultRef.current?.focus({preventScroll:true});resultRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});},30);
    }catch(error){setError(error instanceof CalculatorInputError?error.code:'dateError');}
  };
  const clear=()=>{setCycleResult(null);setPregnancyResult(null);setError(null);document.getElementById('last-period')?.focus();};
  const exportDates=()=>{
    const events=cycleResult?[{date:cycleResult.ovulation,title:t('ovulationDay'),description:t('resultNote'),id:'ovulation'},
      {date:cycleResult.fertileStart,endDate:cycleResult.fertileEnd,title:t('fertileWindow'),description:t('resultNote'),id:'fertile'},
      {date:cycleResult.nextPeriod,title:t('nextPeriod'),description:t('resultNote'),id:'period'}]
      :pregnancyResult?[{date:pregnancyResult.dueDate,title:t('estimatedDueDate'),description:t('dueDateNote'),id:'due-date'}]:[];
    if(events.length)downloadCalendar(makeCalendarFile(events));
  };
  return <><Intro title={kind==='ovulation'?'ovulation':'dueDate'} description={kind==='ovulation'?'ovulationIntro':'dueDateIntro'} eyebrow="freeTool"/>
    <div className="site-calculator-layout"><form className="site-calculator-form" onSubmit={calculate} noValidate>
      <span className="site-icon-wash site-wash-mint"><CalendarDays size={24} strokeWidth={1.5}/></span>
      <label htmlFor="last-period">{t('lastPeriod')}</label><input id="last-period" name="lastPeriod" type="date" required max={todayIso()} value={lastPeriod} aria-describedby={error==='dateError'||error==='dueDateError'?'calculator-error':undefined} aria-invalid={error==='dateError'||error==='dueDateError'} onChange={event=>setLastPeriod(event.target.value)}/>
      <label htmlFor="cycle-length">{t('cycleLength')} <span>({t('daysUnit')})</span></label><input id="cycle-length" name="cycleLength" type="number" required min={21} max={45} step={1} inputMode="numeric" value={Number.isNaN(cycle)?'':cycle} aria-describedby="cycle-help" onChange={event=>setCycle(event.target.value===''?NaN:Number(event.target.value))}/><p className="site-input-help" id="cycle-help">{t('cycleHelp')}</p>
      {kind==='ovulation'&&<details className="site-advanced"><summary>{t('advanced')}</summary>
        <label htmlFor="period-length">{t('periodLength')} <span>({t('daysUnit')})</span></label><input id="period-length" type="number" min={1} max={10} step={1} inputMode="numeric" value={Number.isNaN(period)?'':period} aria-describedby="period-help" onChange={event=>setPeriod(event.target.value===''?NaN:Number(event.target.value))}/><p className="site-input-help" id="period-help">{t('periodHelp')}</p>
        <label htmlFor="luteal-length">{t('lutealLength')} <span>({t('daysUnit')})</span></label><input id="luteal-length" type="number" min={10} max={16} step={1} inputMode="numeric" value={Number.isNaN(luteal)?'':luteal} aria-describedby="luteal-help" onChange={event=>setLuteal(event.target.value===''?NaN:Number(event.target.value))}/><p className="site-input-help" id="luteal-help">{t('lutealHelp')}</p>
      </details>}
      {error&&<p id="calculator-error" className="site-form-error" role="alert">{t(error)}</p>}
      <button className="site-rainbow-button" type="submit">{t(kind==='ovulation'?'calculateOvulation':'calculateDueDate')}<Arrow/></button><p className="site-input-help">{t('privacyCalculatorNote')}</p>
    </form>
    <div className="site-calculator-side">
      {cycleResult||pregnancyResult?<section className="site-results" ref={resultRef} tabIndex={-1} aria-live="polite" data-calculator-result>
        <Eyebrow mint>{t('resultTitle')}</Eyebrow>
        {cycleResult?<><h2>{date(cycleResult.ovulation)}</h2><p>{t('ovulationDay')}</p><dl className="site-result-details"><div><dt>{t('fertileWindow')}</dt><dd><time dateTime={cycleResult.fertileStart}>{date(cycleResult.fertileStart)}</time> — <time dateTime={cycleResult.fertileEnd}>{date(cycleResult.fertileEnd)}</time></dd></div><div><dt>{t('nextPeriod')}</dt><dd><time dateTime={cycleResult.nextPeriod}>{date(cycleResult.nextPeriod)}</time></dd></div><div><dt>{t('testDate')}</dt><dd><time dateTime={cycleResult.testDate}>{date(cycleResult.testDate)}</time></dd></div></dl><CycleCalendar key={cycleResult.ovulation} estimate={cycleResult}/></>
        :pregnancyResult&&<><h2><time dateTime={pregnancyResult.dueDate}>{date(pregnancyResult.dueDate)}</time></h2><p>{t('estimatedDueDate')}</p><dl className="site-result-details"><div><dt>{t('pregnancyWeek')}</dt><dd>{t('weekDays',{weeks:pregnancyResult.weeks,days:pregnancyResult.days})}</dd></div><div><dt>{t('trimester',{count:pregnancyResult.trimester})}</dt><dd>{pregnancyResult.remainingDays>=0?t('daysRemaining',{count:pregnancyResult.remainingDays}):t('dueDatePassed')}</dd></div></dl></>}
        <p className="site-calculator-note">{t(kind==='ovulation'?'resultNote':'dueDateNote')}</p><div className="site-result-actions"><button className="site-outline-button" type="button" onClick={exportDates}><Download size={17}/>{t('exportCalendar')}</button><button className="site-ghost-button" type="button" onClick={clear}>{t('reset')}</button></div>
      </section>:<div className="site-calculator-explainer"><Eyebrow mint>{t('toolsEyebrow')}</Eyebrow><h2>{t('toolsTitle')}</h2><p>{t(kind==='ovulation'?'resultNote':'dueDateNote')}</p><div className="site-paper-calendar" aria-hidden="true"><CalendarDays size={100} strokeWidth={0.65}/></div></div>}
    </div></div>
    <section className="site-section site-guide">{(kind==='ovulation'?['ovulationGuide','fertileGuide','irregularGuide']:['dueDateGuide']).map(prefix=><div key={prefix}><h2>{t((prefix+'Title') as WebsiteCopyKey)}</h2><p>{t((prefix+'Text') as WebsiteCopyKey)}</p>{prefix==='fertileGuide'&&<p className="site-formula">{t('formula')}</p>}</div>)}</section>
    <section className="site-section site-faq-section"><h2>{t('faq')}</h2><FaqList prefix={kind==='ovulation'?'ovulationFaq':'dueDateFaq'} keys={kind==='ovulation'?[1,2,3,4]:[1,2]}/></section><ReferenceLinks/><DownloadCard/>
  </>;
}
