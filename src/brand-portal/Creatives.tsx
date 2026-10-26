import { useMemo, useState } from 'react';
import { Info, Moon, Pencil, Plus, Send, Save, TextCursorInput } from 'lucide-react';
import { brandError, BRAND_PLACEMENTS, safeAdUrl, type AdBrand } from '@/lib/brand-ads';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { AUDIENCE_TIERS, LIFE_STAGES, NATIVE_TEMPLATES, daysToMonths, monthsToDays, parseWeekList, targetingErrors, type AudienceTier } from '@/lib/ads/brandTargeting';
import NativeAdCard from '@/components/banners/NativeAdCard';
import { usePortalDrafts, usePortalLeadForms, usePortalMutation, type CreativeDraft, type CreativePayload } from './queries';
import { BrandPanel, type BrandTranslate } from './Portal';

export const emptyCreative = (): CreativePayload => ({
  placement: 'home_top', banner_type: 'native', native_template: 'spotlight', creative_options: {}, image_url: null,
  background_color: '#F48155', text_color: '#FFFFFF', link_type: 'external', link_url: '', lead_form_id: null, copy: {},
  audience_tiers: ['free'], target_life_stages: [], target_languages: [], target_countries: [],
  target_pregnancy_week_min: null, target_pregnancy_week_max: null, target_pregnancy_weeks: [],
  target_child_age_min_days: null, target_child_age_max_days: null, start_date: null, end_date: null,
});
export type CreativeIssue = ReturnType<typeof targetingErrors>[number] | 'copy' | 'link' | 'image';
export function creativeIssues(payload: CreativePayload, weekListInvalid = false): CreativeIssue[] {
  const issues: CreativeIssue[] = [...targetingErrors(payload)];
  if (weekListInvalid && !issues.includes('week_list')) issues.push('week_list');
  if (!Object.values(payload.copy).some(copy => copy.title?.trim())) issues.push('copy');
  if (payload.link_type === 'lead_form' ? !payload.lead_form_id : !/^https:\/\/[^\s@/]+(\/\S*)?$/.test(payload.link_url || '')) issues.push('link');
  if (payload.image_url && !safeAdUrl(payload.image_url)?.startsWith('https:')) issues.push('image');
  if (payload.banner_type === 'image' && !payload.image_url) issues.push('image');
  return issues;
}
const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);

function PreviewFrame({ payload, language, t }: { payload: CreativePayload; language: string; t: BrandTranslate }) {
  const [dark, setDark] = useState(false), [rtl, setRtl] = useState(language === 'ar');
  const copy = payload.copy[language] || payload.copy.en || payload.copy.az || Object.values(payload.copy)[0] || {};
  return <div className="brand-creative-preview">
    <div className="brand-actions"><button type="button" className="brand-button" aria-pressed={dark} onClick={() => setDark(value => !value)}><Moon size={14} />{t('preview_dark')}</button>
      <button type="button" className="brand-button" aria-pressed={rtl} onClick={() => setRtl(value => !value)}><TextCursorInput size={14} />{t('preview_rtl')}</button></div>
    <div className={`brand-device ${dark ? 'brand-device-dark' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
      {payload.banner_type === 'image' ? (safeAdUrl(payload.image_url) ? <img className="brand-device-image" src={safeAdUrl(payload.image_url)!} alt="" /> : <p className="brand-hint">{t('image_url')}</p>)
        : <NativeAdCard preview ad={{ ...payload, title: copy.title || t('title_field'), description: copy.description, button_text: copy.button_text }}
          sponsorLabel={t('sponsored_by')} codeLabel={t('offer_code')} />}
    </div>
    <p className="brand-hint">{t('preview_hint')}</p>
  </div>;
}

function Editor({ brand, draft, t, language, close }: { brand: AdBrand; draft: CreativeDraft | null; t: BrandTranslate; language: string; close: () => void }) {
  const [payload, setPayload] = useState<CreativePayload>(() => ({ ...emptyCreative(), ...(draft?.payload ?? {}) }));
  const [copyLanguage, setCopyLanguage] = useState(() => APP_LANGUAGES.some(item => item.code === language) ? language : 'az');
  const [weekList, setWeekList] = useState((draft?.payload.target_pregnancy_weeks ?? []).join(', ')), [unit, setUnit] = useState<'days' | 'months'>('months');
  const [error, setError] = useState(''), [showIssues, setShowIssues] = useState(false);
  const save = usePortalMutation('brand_creative_draft_save_v1'), forms = usePortalLeadForms(brand.id);
  const parsedWeeks = useMemo(() => parseWeekList(weekList), [weekList]);
  const next = { ...payload, target_pregnancy_weeks: parsedWeeks.weeks };
  const issues = creativeIssues(next, parsedWeeks.invalid);
  const set = (patch: Partial<CreativePayload>) => setPayload(old => ({ ...old, ...patch }));
  const setCopy = (field: 'title' | 'description' | 'button_text', value: string) =>
    setPayload(old => ({ ...old, copy: { ...old.copy, [copyLanguage]: { ...old.copy[copyLanguage], [field]: value } } }));
  const toggle = <T extends string>(list: T[] | null | undefined, value: T) => (list ?? []).includes(value) ? (list ?? []).filter(item => item !== value) : [...(list ?? []), value];
  const childValue = (days: number | null | undefined) => days == null ? '' : String(unit === 'months' ? daysToMonths(days) : days);
  const setChild = (field: 'target_child_age_min_days' | 'target_child_age_max_days', value: string) => {
    const parsed = numberOrNull(value); set({ [field]: parsed === null ? null : unit === 'months' ? monthsToDays(parsed) : Math.round(parsed) });
  };
  const submit = async (review: boolean) => {
    setShowIssues(true); if (issues.length) return;
    setError('');
    const copy = Object.fromEntries(Object.entries(next.copy).filter(([, value]) => value.title?.trim()));
    try {
      await save.mutateAsync({ p_brand: brand.id, p_draft: draft && draft.status !== 'approved' ? draft.id : null, p_banner: draft?.banner_id ?? null, p_submit: review,
        p_payload: { ...next, copy, link_url: next.link_type === 'external' ? next.link_url : null, lead_form_id: next.link_type === 'lead_form' ? next.lead_form_id : null } });
      close();
    } catch (failure) { setError(brandError(failure, language)); }
  };
  const copy = payload.copy[copyLanguage] ?? {}, filled = Object.entries(payload.copy).filter(([, value]) => value.title?.trim()).map(([code]) => code);
  const forms_ = (forms.data ?? []).filter(form => form.status !== 'archived');
  return <div className="brand-editor" data-testid="brand-creative-editor">
    <div className="brand-editor-form">
      <BrandPanel title={t('creative')}><div className="brand-form">
        <label>{t('placement')}<select className="brand-select" value={payload.placement} onChange={event => set({ placement: event.target.value })}>
          {BRAND_PLACEMENTS.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <div className="brand-periods" role="group" aria-label={t('creative')}>{(['native', 'image'] as const).map(kind => <button type="button" key={kind} aria-pressed={payload.banner_type === kind} onClick={() => set({ banner_type: kind })}>{t(kind)}</button>)}</div>
        {payload.banner_type === 'native' && <fieldset className="brand-template-grid"><legend className="brand-form-label">{t('template')}</legend>
          {NATIVE_TEMPLATES.map(template => <button type="button" key={template} className="brand-template" aria-pressed={payload.native_template === template} onClick={() => set({ native_template: template })}>
            <strong>{t(`tpl_${template}` as any)}</strong><small>{t(`tpl_${template}_hint` as any)}</small></button>)}</fieldset>}
        <label>{t('image_url')}<input className="brand-input" type="url" placeholder="https://" value={payload.image_url ?? ''} onChange={event => set({ image_url: event.target.value || null })} /></label>
        {payload.banner_type === 'native' && <div className="brand-inline-form">
          <label>{t('accent_color')}<input className="brand-color" type="color" value={payload.background_color} onChange={event => set({ background_color: event.target.value.toUpperCase() })} /></label>
          <label>{t('text_color')}<input className="brand-color" type="color" value={payload.text_color} onChange={event => set({ text_color: event.target.value.toUpperCase() })} /></label></div>}
        {payload.native_template === 'offer' && payload.banner_type === 'native' && <label>{t('offer_code')}<input className="brand-input" maxLength={24} value={payload.creative_options.offer_code ?? ''} onChange={event => set({ creative_options: { ...payload.creative_options, offer_code: event.target.value } })} /></label>}
        {payload.native_template === 'expert' && payload.banner_type === 'native' && <div className="brand-inline-form">
          <label>{t('expert_name')}<input className="brand-input" maxLength={60} value={payload.creative_options.expert_name ?? ''} onChange={event => set({ creative_options: { ...payload.creative_options, expert_name: event.target.value } })} /></label>
          <label>{t('expert_role')}<input className="brand-input" maxLength={60} value={payload.creative_options.expert_role ?? ''} onChange={event => set({ creative_options: { ...payload.creative_options, expert_role: event.target.value } })} /></label></div>}
      </div></BrandPanel>

      <BrandPanel title={t('copy_title')} hint={filled.length ? `${t('languages_filled')}: ${filled.map(code => code.toUpperCase()).join(', ')}` : t('copy_hint')}><div className="brand-form">
        <label>{t('copy_language')}<select className="brand-select" value={copyLanguage} onChange={event => setCopyLanguage(event.target.value)}>
          {APP_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native_name}{filled.includes(item.code) ? ' ✓' : ''}</option>)}</select></label>
        <div className="brand-form" dir={copyLanguage === 'ar' ? 'rtl' : 'ltr'} lang={copyLanguage}>
          <label>{t('title_field')}<input className="brand-input" maxLength={80} value={copy.title ?? ''} onChange={event => setCopy('title', event.target.value)} /></label>
          <label>{t('description_field')}<textarea className="brand-input" rows={3} maxLength={240} value={copy.description ?? ''} onChange={event => setCopy('description', event.target.value)} /></label>
          <label>{t('button_field')}<input className="brand-input" maxLength={80} value={copy.button_text ?? ''} onChange={event => setCopy('button_text', event.target.value)} /></label>
        </div></div></BrandPanel>

      <BrandPanel title={t('destination')}><div className="brand-form">
        <div className="brand-periods" role="group" aria-label={t('destination')}>{(['external', 'lead_form'] as const).map(kind => <button type="button" key={kind} aria-pressed={payload.link_type === kind} onClick={() => set({ link_type: kind })}>{t(kind === 'external' ? 'link_external' : 'link_lead_form')}</button>)}</div>
        {payload.link_type === 'external' ? <label>{t('link_external')}<input className="brand-input" type="url" placeholder="https://" value={payload.link_url ?? ''} onChange={event => set({ link_url: event.target.value })} /></label>
          : <label>{t('lead_form_select')}<select className="brand-select" value={payload.lead_form_id ?? ''} onChange={event => set({ lead_form_id: event.target.value || null })}>
            <option value="">{t('lead_form_select')}</option>{forms_.map(form => <option key={form.id} value={form.id}>{form.name} · {t(form.live ? 'live' : form.status as any)}</option>)}</select>
            {!forms_.length && <small>{t('no_forms')}</small>}</label>}
      </div></BrandPanel>

      <BrandPanel title={t('targeting')} hint={t('or_child_hint')}><div className="brand-form">
        <fieldset className="brand-checks"><legend className="brand-form-label">{t('tiers')}</legend>
          {AUDIENCE_TIERS.map(tier => <label key={tier} className="brand-toggle"><input type="checkbox" checked={!!payload.audience_tiers?.includes(tier)}
            onChange={() => set({ audience_tiers: toggle<AudienceTier>(payload.audience_tiers, tier) })} />{t(`tier_${tier}` as any)}</label>)}
          {payload.audience_tiers?.includes('premium') && <p className="brand-hint">{t('premium_notice')}</p>}</fieldset>
        <fieldset className="brand-checks"><legend className="brand-form-label">{t('life_stages')} <small>({t('empty_all')})</small></legend>
          {LIFE_STAGES.map(stage => <label key={stage} className="brand-toggle"><input type="checkbox" checked={!!payload.target_life_stages?.includes(stage)}
            onChange={() => set({ target_life_stages: toggle(payload.target_life_stages, stage) })} />{t(`stage_${stage}` as any)}</label>)}</fieldset>
        <div className="brand-inline-form">
          <label>{t('week_min')}<input className="brand-input" type="number" min={1} max={42} value={payload.target_pregnancy_week_min ?? ''} onChange={event => set({ target_pregnancy_week_min: numberOrNull(event.target.value) })} /></label>
          <label>{t('week_max')}<input className="brand-input" type="number" min={1} max={42} value={payload.target_pregnancy_week_max ?? ''} onChange={event => set({ target_pregnancy_week_max: numberOrNull(event.target.value) })} /></label></div>
        <label>{t('week_list')} <small>{t('week_list_hint')}</small><input className="brand-input" value={weekList} onChange={event => setWeekList(event.target.value)} /></label>
        <div className="brand-inline-form">
          <label>{t('child_age_min')}<input className="brand-input" type="number" min={0} step="any" value={childValue(payload.target_child_age_min_days)} onChange={event => setChild('target_child_age_min_days', event.target.value)} /></label>
          <label>{t('child_age_max')}<input className="brand-input" type="number" min={0} step="any" value={childValue(payload.target_child_age_max_days)} onChange={event => setChild('target_child_age_max_days', event.target.value)} /></label>
          <label>{t('unit')}<select className="brand-select" value={unit} onChange={event => setUnit(event.target.value as 'days' | 'months')}><option value="months">{t('unit_months')}</option><option value="days">{t('unit_days')}</option></select></label></div>
        <details className="brand-existing-account"><summary>{t('target_languages')} · {payload.target_languages?.length ? payload.target_languages.map(code => code.toUpperCase()).join(', ') : t('all_languages')}</summary>
          <div className="brand-checks brand-checks-wrap">{APP_LANGUAGES.map(item => <label key={item.code} className="brand-toggle"><input type="checkbox" checked={!!payload.target_languages?.includes(item.code)}
            onChange={() => set({ target_languages: toggle(payload.target_languages, item.code) })} />{item.native_name}</label>)}</div></details>
        <label>{t('target_countries')} <small>{t('countries_hint')}</small><input className="brand-input" value={(payload.target_countries ?? []).join(', ')}
          onChange={event => set({ target_countries: event.target.value.split(/[\s,;]+/).map(code => code.toUpperCase()).filter(code => /^[A-Z]{2}$/.test(code)) })} /></label>
        <div className="brand-inline-form">
          <label>{t('start')}<input className="brand-input" type="date" value={payload.start_date?.slice(0, 10) ?? ''} onChange={event => set({ start_date: event.target.value || null })} /></label>
          <label>{t('end')}<input className="brand-input" type="date" value={payload.end_date?.slice(0, 10) ?? ''} onChange={event => set({ end_date: event.target.value || null })} /></label></div>
      </div></BrandPanel>
      {showIssues && issues.length > 0 && <div className="brand-form-error" role="alert">{issues.map(issue => <div key={issue}>{t(`err_${issue}` as any)}</div>)}</div>}
      {error && <div className="brand-form-error" role="alert">{error}</div>}
      <div className="brand-notice"><Info size={16} /><div>{t('approval_notice')}</div></div>
      <div className="brand-actions"><button type="button" className="brand-button" onClick={close}>{t('cancel')}</button>
        <button type="button" className="brand-button" disabled={save.isPending} onClick={() => { void submit(false); }}><Save size={15} />{t('save_draft')}</button>
        <button type="button" className="brand-button primary" disabled={save.isPending} onClick={() => { void submit(true); }}><Send size={15} />{t('submit_review')}</button></div>
    </div>
    <aside className="brand-editor-preview"><BrandPanel title={t('preview')}><PreviewFrame payload={next} language={copyLanguage} t={t} /></BrandPanel></aside>
  </div>;
}

export default function BrandCreativesView({ brand, t, language }: { brand: AdBrand; t: BrandTranslate; language: string }) {
  const drafts = usePortalDrafts(brand.id), [editing, setEditing] = useState<CreativeDraft | null | 'new'>(null);
  if (editing) return <><div className="brand-heading"><div><div className="brand-eyebrow">{t('creatives')}</div><h1>{editing === 'new' ? t('new_creative') : t('edit')}</h1></div></div>
    <Editor brand={brand} draft={editing === 'new' ? null : editing} t={t} language={language} close={() => setEditing(null)} /></>;
  return <><div className="brand-heading"><div><div className="brand-eyebrow">{t('product')}</div><h1>{t('creatives')}</h1><p>{t('creatives_hint')}</p></div>
    <div className="brand-actions"><button className="brand-button primary" onClick={() => setEditing('new')}><Plus size={15} />{t('new_creative')}</button></div></div>
    {drafts.isError ? <div className="brand-empty" role="alert"><strong>{brandError(drafts.error, language)}</strong></div>
      : !drafts.data ? <div className="brand-skeleton" /> : !drafts.data.length ? <div className="brand-empty"><strong>{t('no_drafts')}</strong><p>{t('creatives_hint')}</p></div>
      : <div className="brand-table-wrap"><table className="brand-table"><thead><tr><th>{t('creative')}</th><th>{t('placement')}</th><th>{t('template')}</th><th>{t('status')}</th><th /></tr></thead>
        <tbody>{drafts.data.map(draft => { const copy = draft.payload.copy?.[language] || Object.values(draft.payload.copy ?? {})[0];
          return <tr key={draft.id}><td><strong>{copy?.title || '—'}</strong>{draft.review_note && <small className="brand-review-note">{t('review_note')}: {draft.review_note}</small>}</td>
            <td>{t(draft.payload.placement as any)}</td><td>{draft.payload.banner_type === 'image' ? t('image') : t(`tpl_${draft.payload.native_template}` as any)}</td>
            <td><span className="brand-status" data-status={draft.status === 'approved' ? 'active' : draft.status === 'pending' ? 'scheduled' : 'archived'}>{t(draft.status as any)}</span></td>
            <td className="numeric"><button className="brand-button" onClick={() => setEditing(draft)}><Pencil size={14} />{t('edit')}</button></td></tr>; })}</tbody></table></div>}
  </>;
}
