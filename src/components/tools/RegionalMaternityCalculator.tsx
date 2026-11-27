import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useUserStore } from '@/store/userStore';
import { appLanguageLocale, localizedCountryName } from '@/lib/app-languages';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { maternityText } from '@/lib/maternity-i18n';
import { followupText } from '@/lib/followup-i18n';
import { calculateRegionalMaternity, maternityPolicy, type MaternityCountry, type PortuguesePlan, type RegionalMaternityResult } from '@/lib/maternity-regional';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RegionalMaternityCalculator({ country, countries, onCountryChange, initialDueDate, onBack }: {
  country: MaternityCountry; countries: string[]; onCountryChange: (country: string) => void; initialDueDate?: string; onBack: () => void;
}) {
  const language = useUserStore(state => state.language), rule = maternityPolicy.countries[country];
  const t = (key: string, values: Record<string, string | number> = {}) => maternityText(key, language, values);
  const [dueDate, setDueDate] = useState(initialDueDate || ''), [startDate, setStartDate] = useState('');
  const [babies, setBabies] = useState(1), [existing, setExisting] = useState(0), [sole, setSole] = useState(false);
  const [complicated, setComplicated] = useState(false), [premature, setPremature] = useState(false), [extra, setExtra] = useState(0);
  const [plan, setPlan] = useState<PortuguesePlan>('120'), [ownDays, setOwnDays] = useState('');
  const [flexible, setFlexible] = useState(false), [combined, setCombined] = useState(false), [shortInsurance, setShortInsurance] = useState(false);
  const [earnings, setEarnings] = useState(['','','']), [paidSalary, setPaidSalary] = useState('');
  const [incomeDays, setIncomeDays] = useState(''), [minimumDays, setMinimumDays] = useState('');
  const [result, setResult] = useState<RegionalMaternityResult | null>(null), [error, setError] = useState(false);
  const options = useMemo(() => [...countries].sort((a,b) => a === country ? -1 : b === country ? 1 : localizedCountryName(a, language).localeCompare(localizedCountryName(b, language), appLanguageLocale(language))), [countries, country, language]);
  const reset = () => { setResult(null); setError(false); };
  const numberField = (label: string, value: string | number, change: (value: string) => void, max = 1e10) => <label className="block space-y-1 text-sm font-semibold">
    <span>{label}</span><input className="a-input w-full" type="number" inputMode="decimal" min="0" max={max} step="any" value={value} onChange={event => { change(event.target.value); reset(); }} />
  </label>;
  const toggle = (label: string, value: boolean, change: (value: boolean) => void) => <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={value} onChange={event => { change(event.target.checked); reset(); }} /><span>{label}</span></label>;
  const calculate = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setResult(calculateRegionalMaternity({ country, dueDate, startDate: startDate || undefined, birthCount: babies, existingChildren: existing, soleParent: sole,
        complicated, premature, certifiedExtraMonths: extra, portuguesePlan: plan, ownDays: ownDays ? Number(ownDays) : undefined,
        includeFlexible: flexible, combinedPoland: combined, shortInsuranceJapan: shortInsurance,
        earnings: rule.input === 'three-months' ? earnings.map(Number) : earnings[0] ? [Number(earnings[0])] : [], paidSalaryDaily: Number(paidSalary || 0),
        swedenIncomeDays: incomeDays ? Number(incomeDays) : undefined, swedenMinimumDays: minimumDays ? Number(minimumDays) : undefined })); setError(false);
    } catch { setResult(null); setError(true); }
  };
  const date = (value: Date) => format(value, 'dd MMMM yyyy', { locale: getCurrentDateLocale() });
  return <div className="a-scope pb-24 overflow-x-hidden" data-maternity-country={country} style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
    <div className="a-shell space-y-4">
      <header className="a-topbar"><button className="a-icon-btn" aria-label={t('back')} onClick={onBack}><ArrowLeft size={18} className="rtl:rotate-180" /></button><div className="flex-1 min-w-0"><p className="a-eyebrow">{localizedCountryName(country, language)}</p><h1 className="a-wordmark text-base">{t('title')}</h1></div></header>
      <Select value={country} onValueChange={onCountryChange}><SelectTrigger aria-label={localizedCountryName(country, language)}><SelectValue /></SelectTrigger><SelectContent>{options.map(code => <SelectItem key={code} value={code}>{localizedCountryName(code, language)}</SelectItem>)}</SelectContent></Select>
      <p className="a-list-sub">{t('normal_scope')}</p>
      <form className="a-card space-y-4" onSubmit={calculate}>
        <label className="block space-y-1 text-sm font-semibold"><span>{t('due_date')}</span><input className="a-input a-date-input" type="date" required value={dueDate} onChange={event => { setDueDate(event.target.value); setStartDate(''); reset(); }} /></label>
        {['ID','VN','PT','PL','NL','SE'].includes(country) && <label className="block space-y-1 text-sm font-semibold"><span>{t('start_date')}</span><input className="a-input a-date-input" type="date" value={startDate} onChange={event => { setStartDate(event.target.value); reset(); }} /></label>}
        {numberField(t('babies'), babies, value => { setBabies(Number(value)); setIncomeDays(''); setMinimumDays(''); }, country === 'SE' ? 4 : 5)}
        {['FR','IN'].includes(country) && numberField(t('existing_children'), existing, value => setExisting(Number(value)), 20)}
        {['ES','SE'].includes(country) && toggle(t('sole_parent'), sole, value => { setSole(value); setIncomeDays(''); setMinimumDays(''); })}
        {country === 'CN' && toggle(t('complicated_cn'), complicated, setComplicated)}
        {country === 'KR' && toggle(t('premature_kr'), premature, setPremature)}
        {country === 'ID' && numberField(t('certified_months'), extra, value => setExtra(Number(value)), 3)}
        {country === 'PT' && <><label className="block text-sm font-semibold mb-2">{t('plan')}</label><Select value={plan} onValueChange={value => { setPlan(value as PortuguesePlan); setOwnDays(''); reset(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['120','150','shared150','shared180','shared180-90'] as const).map(value => <SelectItem value={value} key={value}>{t(`pt_${value.replace('-','_')}`)}</SelectItem>)}</SelectContent></Select>{numberField(t('own_days'), ownDays, setOwnDays, 180)}</>}
        {country === 'ES' && toggle(t('include_flexible'), flexible, setFlexible)}
        {country === 'PL' && toggle(t('combined_pl'), combined, setCombined)}
        {country === 'JP' && toggle(t('short_insurance_jp'), shortInsurance, setShortInsurance)}
        {country === 'SE' && <>{numberField(t('income_days'), incomeDays, setIncomeDays, 840)}{numberField(t('minimum_days'), minimumDays, setMinimumDays, 180)}</>}
        {rule.input !== 'agency' && <div className="space-y-3"><p className="text-sm font-semibold">{t(`${country}.inputLabel`)} · {rule.currency}</p>
          {(rule.input === 'three-months' ? [0,1,2] : [0]).map(index => <div key={index}>{numberField(rule.input === 'three-months' ? t('month_n', { number: index + 1 }) : t(`${country}.inputLabel`), earnings[index], value => setEarnings(previous => previous.map((item,n) => n === index ? value : item)))}</div>)}
          {country === 'JP' && numberField(t('paid_salary_jp'), paidSalary, setPaidSalary)}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{t('input_error')}</p>}
        <button type="submit" className="a-btn-solid w-full justify-center">{t('calculate')}</button>
      </form>
      {result && <section className="a-card space-y-3" data-maternity-result>
        <h2 className="a-heading text-lg">{t('your_period')}</h2>
        <p className="text-xl font-bold" data-maternity-days>{result.months ? t('calendar_months', { count: result.months }) : t('calendar_days', { count: result.days })}</p>
        {result.entitlementDays !== result.days && <p className="text-sm">{t('programme_total')}: {t('calendar_days', { count: result.entitlementDays })}</p>}
        <p className="text-sm"><time dateTime={format(result.start, 'yyyy-MM-dd')}>{date(result.start)}</time> – <time dateTime={format(result.end, 'yyyy-MM-dd')}>{date(result.end)}</time></p>
        <p className="a-list-sub">{t('date_example')}</p>
        {result.money !== null && <div><h3 className="font-semibold text-sm">{t('estimate')}</h3><p className="text-xl font-bold mt-1" data-maternity-money>{new Intl.NumberFormat(appLanguageLocale(language), { style: 'currency', currency: result.currency }).format(result.money)}</p><p className="a-list-sub mt-2">{t('estimate_scope')}</p></div>}
        {result.yearUnsupported && <p role="status" className="text-sm">{t('year_unavailable')}</p>}
        {result.agency && <p className="text-sm">{country === 'PT' && babies > 1 ? t('special_scope') : followupText('maternity_personal_calculation', language)}</p>}
      </section>}
      {(['duration','eligibility','payment','exceptions'] as const).map(key => <section className="a-card space-y-2" key={key}>
        <h2 className="a-heading text-base">{followupText(`maternity_${key}`, language)}</h2><p className="text-sm leading-relaxed whitespace-pre-line" data-maternity-rule={key}>{t(`${country}.${key}`)}</p>
      </section>)}
      <section className="a-card space-y-3"><p className="a-list-sub">{followupText('maternity_reviewed', language, { date: maternityPolicy.reviewedAt })}</p>
        {rule.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm break-words underline"><ExternalLink size={15} className="shrink-0 mt-0.5" /><span>{followupText('maternity_source', language)} · {new URL('originalUrl' in source ? source.originalUrl : source.url).hostname}{'archivedAt' in source && <small className="block">web.archive.org · {source.archivedAt}</small>}</span></a>)}
      </section>
    </div>
  </div>;
}
