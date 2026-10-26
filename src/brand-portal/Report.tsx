import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ArrowDownToLine, BarChart3, ChevronLeft, ChevronRight, ExternalLink, Eye, Info, Megaphone, MousePointerClick, RefreshCw, X } from 'lucide-react';
import { adTitle, brandDateRange, brandError, brandNumber, brandReportArgs, brandReportCsv, BRAND_PLACEMENTS, safeAdUrl, type AdBrand, type BrandAd, type BrandFilters, type BrandReport } from '@/lib/brand-ads';
import { useBrandAuth } from './Auth';
import { usePortalReport } from './queries';
import { appLanguageLocale } from '@/lib/app-languages';
import { BrandPanel, type BrandTranslate } from './Portal';

function Trend({ report, t, language }: { report: BrandReport; t: BrandTranslate; language: string }) {
  const max = Math.max(1, ...report.daily.flatMap(row => [row.impressions, row.clicks]));
  const points = (field: 'impressions' | 'clicks') => report.daily.map((row, index) => `${20 + index * 720 / Math.max(1, report.daily.length - 1)},${220 - row[field] / max * 190}`).join(' ');
  return <div className="brand-trend"><svg role="img" aria-label={`${t('impressions')} / ${t('clicks')}`} viewBox="0 0 760 260" preserveAspectRatio="none">
    {[30, 125, 220].map(y => <line key={y} x1="20" x2="740" y1={y} y2={y} stroke="#e8edf2" />)}
    <polyline fill="none" stroke="#36577b" strokeWidth="3" points={points('impressions')} /><polyline fill="none" stroke="#dc6946" strokeWidth="3" points={points('clicks')} />
    <text x="20" y="250" fill="#617083" fontSize="11">{report.from}</text><text x="740" y="250" textAnchor="end" fill="#617083" fontSize="11">{report.to}</text>
  </svg><div className="brand-legend"><span><i style={{ background: '#36577b' }} />{t('impressions')}: {brandNumber(report.metrics.impressions, language)}</span>
    <span><i style={{ background: '#dc6946' }} />{t('clicks')}: {brandNumber(report.metrics.clicks, language)}</span></div></div>;
}
function AdPreview({ ad, t, language, close }: { ad: BrandAd; t: BrandTranslate; language: string; close: () => void }) {
  const image = safeAdUrl(ad.snapshot.image_url), destination = ad.snapshot.link_type === 'external' ? safeAdUrl(ad.snapshot.link_url) : null;
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal><Dialog.Overlay className="brand-dialog-backdrop" /><Dialog.Content className="brand-dialog">
    <header><Dialog.Title asChild><h2>{t('preview')}</h2></Dialog.Title><Dialog.Close className="brand-button" aria-label={t('close')}><X size={18} /></Dialog.Close></header>
    <div className="brand-preview">{image && <img src={image} alt={adTitle(ad.snapshot, language)} />}<div className="brand-preview-native"><strong>{adTitle(ad.snapshot, language)}</strong><p>{String(ad.snapshot[`description_${language}`] || ad.snapshot.description || '')}</p></div></div>
    <Dialog.Description className="brand-hint">{t('preview_hint')}</Dialog.Description><dl className="brand-details-grid"><div><dt>{t('placement')}</dt><dd>{t(ad.snapshot.placement)}</dd></div><div><dt>{t('status')}</dt><dd>{t(ad.status as any)}</dd></div>
      <div><dt>{t('start')}</dt><dd>{ad.snapshot.start_date || t('always')}</dd></div><div><dt>{t('end')}</dt><dd>{ad.snapshot.end_date || t('no_end')}</dd></div></dl>
    {destination ? <a className="brand-button" href={destination} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />{t('open_destination')}</a>
      : <p className="brand-hint">{ad.snapshot.link_url ? t('internal_destination') : t('no_destination')}</p>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export default function BrandReportView({ brand, view, t, language }: { brand: AdBrand; view: string; t: BrandTranslate; language: string }) {
  const { client } = useBrandAuth();
  const [filters, setFilters] = useState<BrandFilters>(() => ({ ...brandDateRange(30, brand.report_timezone), placement: 'all', search: '', status: 'all', sort: 'impressions', page: 0 }));
  const [dates, setDates] = useState({ from: filters.from, to: filters.to }), [period, setPeriod] = useState(30);
  const [preview, setPreview] = useState<BrandAd | null>(null), [exporting, setExporting] = useState(false), [error, setError] = useState('');
  const result = usePortalReport(brand, filters), report = result.data;
  const update = (patch: Partial<BrandFilters>) => setFilters(old => ({ ...old, ...patch, page: patch.page ?? 0 }));
  const selectPeriod = (days: number) => { const range = brandDateRange(days, brand.report_timezone); setPeriod(days); setDates(range); update(range); };
  const exportReport = async (kind: 'ads' | 'placements' | 'daily') => {
    setExporting(true); setError('');
    try {
      const { data, error: failed } = await client.rpc('brand_ad_report_v1', brandReportArgs(brand.id, filters, true));
      if (failed) throw failed;
      if (data?.brand?.id !== brand.id || data.protocol !== 'anacan-brand-ads-v1' || data.export_truncated) throw new Error('BRAND_EXPORT_UNAVAILABLE');
      const url = URL.createObjectURL(new Blob([brandReportCsv(data, kind, language)], { type: 'text/csv;charset=utf-8;' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Anacan-${kind}-${filters.from}-${filters.to}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(brandError(failure, language)); } finally { setExporting(false); }
  };
  const title = ['ads', 'placements', 'reports'].includes(view) ? t(view as any) : t('overview');
  return <><div className="brand-heading"><div><div className="brand-eyebrow">{t('product')}</div><h1>{title}</h1><p>{t('subtitle')}</p></div>
    <div className="brand-actions"><button className="brand-button" onClick={() => { void result.refetch(); }} disabled={result.isFetching}><RefreshCw size={15} />{t('refresh')}</button>
      <button className="brand-button primary" disabled={exporting || !report || result.isError} onClick={() => { void exportReport('ads'); }}><ArrowDownToLine size={15} />{t('export')}</button></div></div>
    <section className="brand-filters" aria-label={t('date_range')}><div className="brand-periods">{[7, 30, 90].map(days => <button key={days} aria-pressed={period === days} onClick={() => selectPeriod(days)}>{t(`last_${days}` as any)}</button>)}</div>
      <label>{t('from')}<input className="brand-input" type="date" value={dates.from} max={dates.to} onChange={event => { setPeriod(0); setDates(old => ({ ...old, from: event.target.value })); }} /></label>
      <label>{t('to')}<input className="brand-input" type="date" value={dates.to} max={brandDateRange(1, brand.report_timezone).to} onChange={event => { setPeriod(0); setDates(old => ({ ...old, to: event.target.value })); }} /></label>
      <button className="brand-button" onClick={() => {
        const duration = Date.parse(dates.to) - Date.parse(dates.from);
        if (!Number.isFinite(duration) || duration < 0 || duration > 365 * 86400000) { setError(t('invalid_dates')); return; }
        setError(''); update(dates);
      }}>{t('apply')}</button><label>{t('placement')}<select className="brand-select" value={filters.placement} onChange={event => update({ placement: event.target.value })}>
        <option value="all">{t('all_placements')}</option>{BRAND_PLACEMENTS.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label></section>
    {error && <div className="brand-notice" role="alert">{error}</div>}
    {result.isError ? <div className="brand-empty" role="alert"><Info size={30} /><strong>{brandError(result.error, language)}</strong><button className="brand-button" onClick={() => { void result.refetch(); }}>{t('refresh')}</button></div>
      : result.isLoading || !report ? <div className="brand-kpis" aria-label={t('loading')}>{[1, 2, 3, 4].map(id => <div key={id} className="brand-skeleton" />)}</div> : <>
        {(report.partial_coverage || !report.available) && <div className="brand-notice"><Info size={16} /><div><strong>{t('unavailable_history')}</strong><br />{t('coverage_body')}</div></div>}
        <div className="brand-kpis">{[
          { label: 'impressions', value: report.metrics.impressions, previous: report.metrics.previous_impressions, Icon: Eye },
          { label: 'clicks', value: report.metrics.clicks, previous: report.metrics.previous_clicks, Icon: MousePointerClick },
          { label: 'ctr', value: report.metrics.ctr, previous: null, Icon: Activity },
          { label: 'active_ads', value: report.metrics.active_ads, previous: null, Icon: Megaphone },
        ].map(item => <div className="brand-kpi" key={item.label}><div className="brand-kpi-head">{t(item.label as any)}<item.Icon size={17} /></div>
          <strong className="brand-kpi-value">{brandNumber(item.value, language, item.label === 'ctr')}</strong><div className="brand-kpi-note">{report.comparison_available && item.previous !== null && item.previous > 0
            ? <><span className={`brand-delta ${Number(item.value) < item.previous ? 'negative' : ''}`}>{Number(item.value) >= item.previous ? '+' : ''}{((Number(item.value) - item.previous) / item.previous * 100).toFixed(1)}%</span>{t('previous_period')}</>
            : item.label === 'active_ads' ? `${t('total_ads')}: ${brandNumber(report.metrics.total_ads, language)}` : t('verified_metrics')}</div></div>)}</div>
        {view === 'reports' ? <div className="brand-report-grid">{(['ads', 'placements', 'daily'] as const).map(kind => <BrandPanel key={kind} title={t(`export_${kind}` as any)}>
          <div className="brand-report-card"><BarChart3 size={24} /><p>{t('export_hint')}</p><button className="brand-button" disabled={exporting} onClick={() => { void exportReport(kind); }}>{t('report_ready')}</button></div></BrandPanel>)}</div> : <>
          {view !== 'ads' && view !== 'placements' && <div className="brand-two-columns"><BrandPanel title={t('trend')} hint={t('trend_hint')}><Trend report={report} t={t} language={language} /></BrandPanel>
            <BrandPanel title={t('platforms')}>{report.platforms.length ? report.platforms.map(row => <div key={row.platform}><div className="brand-platform-row"><span>{t(row.platform as any)}</span><strong>{brandNumber(row.impressions, language)}</strong></div>
              <div className="brand-track"><span style={{ width: `${report.metrics.impressions ? row.impressions / report.metrics.impressions * 100 : 0}%` }} /></div></div>) : <div className="brand-empty"><BarChart3 size={30} /><p>{t('empty_body')}</p></div>}</BrandPanel></div>}
          {view === 'placements' ? <BrandPanel title={t('placement')} hint={t('placement_hint')}><div className="brand-table-wrap"><table className="brand-table"><thead><tr><th>{t('placement')}</th><th className="numeric">{t('impressions')}</th><th className="numeric">{t('clicks')}</th><th className="numeric">CTR</th></tr></thead>
            <tbody>{report.placements.map(row => <tr key={row.placement}><td>{t(row.placement)}</td><td className="numeric">{brandNumber(row.impressions, language)}</td><td className="numeric">{brandNumber(row.clicks, language)}</td><td className="numeric">{brandNumber(row.ctr, language, true)}</td></tr>)}</tbody></table></div>
            {!report.placements.length && <div className="brand-empty"><p>{t('empty_body')}</p></div>}</BrandPanel>
            : <BrandPanel title={t('ads')} action={<div className="brand-actions"><input className="brand-input" aria-label={t('ad_search')} placeholder={t('search_hint')} value={filters.search} onChange={event => update({ search: event.target.value })} />
              <select className="brand-select" aria-label={t('status')} value={filters.status} onChange={event => update({ status: event.target.value })}>{['all', 'active', 'paused', 'scheduled', 'ended', 'archived', 'not_connected'].map(value => <option key={value} value={value}>{t(value === 'all' ? 'all_statuses' : value as any)}</option>)}</select></div>}>
              {report.ads.length ? <div className="brand-table-wrap"><table className="brand-table"><thead><tr><th>{t('creative')}</th><th>{t('placement')}</th><th>{t('status')}</th>{['impressions', 'clicks', 'ctr'].map(value => <th key={value} className="numeric"><button onClick={() => update({ sort: value })}>{value === 'ctr' ? 'CTR' : t(value as any)}</button></th>)}</tr></thead>
                <tbody>{report.ads.map(ad => <tr key={ad.id}><td><button className="brand-ad-cell" onClick={() => setPreview(ad)} aria-label={`${t('details')}: ${adTitle(ad.snapshot, language)}`}>{safeAdUrl(ad.snapshot.image_url) ? <img className="brand-thumb" src={safeAdUrl(ad.snapshot.image_url)!} alt="" /> : <span className="brand-thumb"><Megaphone size={18} /></span>}
                  <span><strong>{adTitle(ad.snapshot, language)}</strong><small>{t(ad.snapshot.banner_type === 'image' ? 'image' : 'native')}</small></span></button></td><td>{t(ad.snapshot.placement)}</td><td><span className="brand-status" data-status={ad.status}>{t(ad.status as any)}</span></td>
                  <td className="numeric">{brandNumber(ad.impressions, language)}</td><td className="numeric">{brandNumber(ad.clicks, language)}</td><td className="numeric">{brandNumber(ad.ctr, language, true)}</td></tr>)}</tbody></table></div>
                : <div className="brand-empty"><Megaphone size={30} /><strong>{report.metrics.total_ads ? t('no_matches') : t('no_ads_title')}</strong><p>{report.metrics.total_ads ? t('empty_body') : t('no_ads_body')}</p></div>}
              <div className="brand-pagination"><span>{brandNumber(report.ads_total, language)} · {t('total_ads')}</span><div className="brand-actions"><button className="brand-button" disabled={!filters.page} onClick={() => update({ page: filters.page - 1 })}><ChevronLeft size={15} />{t('previous')}</button>
                <button className="brand-button" disabled={(filters.page + 1) * 25 >= report.ads_total} onClick={() => update({ page: filters.page + 1 })}>{t('next')}<ChevronRight size={15} /></button></div></div>
            </BrandPanel>}
        </>}
        <BrandPanel title={t('legacy')}><div className="brand-legacy"><p className="brand-hint">{t('legacy_body')}</p><div className="brand-legacy-values"><span><strong>{brandNumber(report.legacy.views, language)}</strong><small>{t('legacy_views')}</small></span><span><strong>{brandNumber(report.legacy.clicks, language)}</strong><small>{t('legacy_clicks')}</small></span></div></div></BrandPanel>
        <div className="brand-notice"><Info size={17} /><div><strong>{t('methodology')}</strong><br />{t('methodology_body')} {t('ctr_body')}<br />{t('timezone')}: {report.timezone} · {t('updated')}: {new Date(report.refreshed_at).toLocaleString(appLanguageLocale(language), { timeZone: report.timezone })}</div></div>
      </>}
    {preview && <AdPreview ad={preview} t={t} language={language} close={() => setPreview(null)} />}
  </>;
}
