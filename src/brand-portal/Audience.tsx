import { useState } from 'react';
import { ArrowDownToLine, Info, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { brandCsv, brandDateRange, brandError, brandNumber, BRAND_PLACEMENTS, type AdBrand } from '@/lib/brand-ads';
import { APP_LANGUAGES, appLanguageLocale } from '@/lib/app-languages';
import { AUDIENCE_DIMENSIONS, suppressAudience, type AudienceDimension } from '@/lib/ads/brandTargeting';
import { usePortalAudience } from './queries';
import { BrandPanel, type BrandTranslate } from './Portal';

export function bucketLabel(dimension: AudienceDimension, bucket: string, t: BrandTranslate, language: string): string {
  if (bucket === 'other') return t('other_groups');
  if (bucket === 'unknown') return t('unknown');
  switch (dimension) {
    case 'placement': case 'platform': return t(bucket as any);
    case 'language': return APP_LANGUAGES.find(item => item.code === bucket)?.native_name || bucket.toUpperCase();
    case 'country': try { return new Intl.DisplayNames([appLanguageLocale(language)], { type: 'region' }).of(bucket) || bucket; } catch { return bucket; }
    case 'tier': return t(bucket === 'premium' ? 'tier_premium' : 'tier_free');
    case 'stage': return ['flow', 'bump', 'mommy', 'partner'].includes(bucket) ? t(`stage_${bucket}` as any) : bucket;
    case 'trimester': return t('trimester_n', { n: bucket });
    case 'week_bucket': return t('weeks_range', { range: bucket.replace('-', '–') });
    case 'child_age_bucket': return bucket.endsWith('+') ? t('months_plus', { n: bucket.replace('m+', '') }) : t('months_range', { range: bucket.replace('m', '').replace('-', '–') });
  }
}

export default function BrandAudienceView({ brand, t, language }: { brand: AdBrand; t: BrandTranslate; language: string }) {
  const [period, setPeriod] = useState(30), [placement, setPlacement] = useState('all');
  const range = brandDateRange(period, brand.report_timezone);
  const result = usePortalAudience(brand.id, { ...range, placement }), report = result.data;
  const exportAudience = () => {
    if (!report?.available) return;
    const rows = AUDIENCE_DIMENSIONS.flatMap(dimension => suppressAudience(report.dimensions[dimension] ?? [], report.k)
      .map(row => [t(`dim_${dimension}` as any), bucketLabel(dimension, row.bucket, t, language), row.reach, row.impressions, row.clicks]));
    const csv = brandCsv([[t('brand'), t('from'), t('to'), t('dimension'), t('group'), t('reach'), t('impressions'), t('clicks')],
      ...rows.map(row => [brand.name, report.from, report.to, ...row])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Anacan-audience-${report.from}-${report.to}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <div className="brand-heading"><div><div className="brand-eyebrow">{t('product')}</div><h1>{t('audience')}</h1><p>{t('audience_hint')}</p></div>
      <div className="brand-actions"><button className="brand-button" onClick={() => { void result.refetch(); }} disabled={result.isFetching}><RefreshCw size={15} />{t('refresh')}</button>
        <button className="brand-button primary" onClick={exportAudience} disabled={!report?.available}><ArrowDownToLine size={15} />{t('export_audience')}</button></div></div>
    <section className="brand-filters" aria-label={t('date_range')}><div className="brand-periods">{[7, 30, 90].map(days => <button key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{t(`last_${days}` as any)}</button>)}</div>
      <label>{t('placement')}<select className="brand-select" value={placement} onChange={event => setPlacement(event.target.value)}>
        <option value="all">{t('all_placements')}</option>{BRAND_PLACEMENTS.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label></section>
    <div className="brand-notice"><ShieldCheck size={17} /><div><strong>{t('privacy_title')}</strong><br />{t('k_notice', { k: report?.k ?? 20 })}</div></div>
    {result.isError ? <div className="brand-empty" role="alert"><Info size={30} /><strong>{brandError(result.error, language)}</strong></div>
      : !report ? <div className="brand-kpis" aria-label={t('loading')}>{[1, 2, 3, 4].map(id => <div key={id} className="brand-skeleton" />)}</div>
      : !report.available ? <div className="brand-empty"><Users size={30} /><strong>{t('not_enough_title')}</strong><p>{t('not_enough_body', { k: report.k })}</p></div>
      : <>
        <div className="brand-kpis brand-kpis-compact"><div className="brand-kpi"><div className="brand-kpi-head">{t('reach')}<Users size={17} /></div>
          <strong className="brand-kpi-value">{brandNumber(report.reach, language)}</strong><div className="brand-kpi-note">{t('reach_hint')}</div></div></div>
        <div className="brand-audience-grid">{AUDIENCE_DIMENSIONS.map(dimension => {
          const rows = suppressAudience(report.dimensions[dimension] ?? [], report.k), total = rows.reduce((sum, row) => sum + row.impressions, 0);
          return <BrandPanel key={dimension} title={t(`dim_${dimension}` as any)}>{rows.length ? <ul className="brand-bars">{rows.map(row => <li key={row.bucket} data-other={row.other || undefined}>
            <div className="brand-platform-row"><span>{bucketLabel(dimension, row.bucket, t, language)}</span>
              <strong>{brandNumber(total ? row.impressions / total * 100 : 0, language, true)}</strong></div>
            <div className="brand-track"><span style={{ width: `${total ? row.impressions / total * 100 : 0}%` }} /></div>
            <small>{t('reach')}: {brandNumber(row.reach, language)} · {t('impressions')}: {brandNumber(row.impressions, language)} · CTR: {brandNumber(row.impressions ? Number((100 * row.clicks / row.impressions).toFixed(2)) : null, language, true)}</small>
          </li>)}</ul> : <p className="brand-hint">{t('suppressed_dimension', { k: report.k })}</p>}</BrandPanel>;
        })}</div>
        <div className="brand-notice"><Info size={17} /><div>{t('audience_method')}<br />{t('timezone')}: {report.timezone} · {t('updated')}: {new Date(report.refreshed_at).toLocaleString(appLanguageLocale(language), { timeZone: report.timezone })}</div></div>
      </>}
  </>;
}
