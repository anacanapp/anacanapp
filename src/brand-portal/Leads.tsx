import { useState } from 'react';
import { ArrowDownToLine, ChevronLeft, ChevronRight, Inbox, Lock, Pencil, Plus, Save, Send } from 'lucide-react';
import { brandCsv, brandError, brandNumber, type AdBrand } from '@/lib/brand-ads';
import { APP_LANGUAGES, appLanguageLocale } from '@/lib/app-languages';
import { LEAD_FIELD_KEYS, type LeadFieldKey } from '@/lib/ads/leadForm';
import { useBrandAuth } from './Auth';
import { usePortalLeadForms, usePortalLeads, usePortalMutation, type LeadFormRecord, type LeadsPage } from './queries';
import { BrandPanel, type BrandTranslate } from './Portal';

const COPY_FIELDS = ['title', 'intro', 'consent', 'success'] as const;
export interface LeadFormDraft { name: string; fields: { key: LeadFieldKey; required: boolean }[]; copy: Record<string, Record<string, string>>; privacy_url: string; retention_days: number }
export type LeadFormIssue = 'name' | 'contact' | 'copy' | 'questions' | 'privacy';
export function leadFormIssues(form: LeadFormDraft): LeadFormIssue[] {
  const issues: LeadFormIssue[] = [];
  if (!form.name.trim()) issues.push('name');
  if (!form.fields.some(field => field.key === 'phone' || field.key === 'email')) issues.push('contact');
  const languages = Object.entries(form.copy).filter(([, copy]) => copy.title?.trim() && copy.consent?.trim());
  if (!languages.length) issues.push('copy');
  if (form.fields.some(field => field.key.startsWith('question_') && !languages.every(([, copy]) => copy[field.key]?.trim()))) issues.push('questions');
  if (form.privacy_url && !/^https:\/\/[^\s@/]+(\/\S*)?$/.test(form.privacy_url)) issues.push('privacy');
  return issues;
}
const fieldLabel = (key: string, t: BrandTranslate) => key.startsWith('question_') ? t('field_question', { n: key.slice(-1) }) : t(`field_${key}` as any);

function FormEditor({ brand, form, t, language, close }: { brand: AdBrand; form: LeadFormRecord | null; t: BrandTranslate; language: string; close: () => void }) {
  const [draft, setDraft] = useState<LeadFormDraft>(() => ({ name: form?.name ?? '', fields: (form?.fields as LeadFormDraft['fields']) ?? [{ key: 'name', required: true }, { key: 'phone', required: true }],
    copy: form?.copy ?? {}, privacy_url: form?.privacy_url ?? '', retention_days: form?.retention_days ?? 90 }));
  const [copyLanguage, setCopyLanguage] = useState(language), [showIssues, setShowIssues] = useState(false), [error, setError] = useState('');
  const save = usePortalMutation('brand_lead_form_save_v1'), issues = leadFormIssues(draft);
  const copy = draft.copy[copyLanguage] ?? {};
  const setCopy = (field: string, value: string) => setDraft(old => ({ ...old, copy: { ...old.copy, [copyLanguage]: { ...old.copy[copyLanguage], [field]: value } } }));
  const field = (key: LeadFieldKey) => draft.fields.find(item => item.key === key);
  const setField = (key: LeadFieldKey, enabled: boolean, required = field(key)?.required ?? false) => setDraft(old => ({ ...old,
    fields: LEAD_FIELD_KEYS.filter(item => item === key ? enabled : old.fields.some(existing => existing.key === item))
      .map(item => item === key ? { key, required } : old.fields.find(existing => existing.key === item)!) }));
  const submit = async (review: boolean) => {
    setShowIssues(true); if (issues.length) return; setError('');
    const copy = Object.fromEntries(Object.entries(draft.copy).filter(([, value]) => value.title?.trim() && value.consent?.trim()));
    try { await save.mutateAsync({ p_brand: brand.id, p_form: form?.id ?? null, p_submit: review, p_payload: { ...draft, copy } }); close(); }
    catch (failure) { setError(brandError(failure, language)); }
  };
  const questions = draft.fields.filter(item => item.key.startsWith('question_'));
  return <BrandPanel title={form ? t('edit') : t('new_form')} hint={t('approval_notice')}><div className="brand-form" data-testid="brand-lead-form-editor">
    <label>{t('form_name')}<input className="brand-input" maxLength={100} value={draft.name} onChange={event => setDraft(old => ({ ...old, name: event.target.value }))} /></label>
    <fieldset className="brand-checks"><legend className="brand-form-label">{t('fields')}</legend>
      {LEAD_FIELD_KEYS.map(key => <div key={key} className="brand-field-row"><label className="brand-toggle"><input type="checkbox" checked={!!field(key)} onChange={event => setField(key, event.target.checked)} />{fieldLabel(key, t)}</label>
        {field(key) && <label className="brand-toggle"><input type="checkbox" checked={field(key)!.required} onChange={event => setField(key, true, event.target.checked)} />{t('required')}</label>}</div>)}</fieldset>
    <label>{t('copy_language')}<select className="brand-select" value={copyLanguage} onChange={event => setCopyLanguage(event.target.value)}>
      {APP_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native_name}{draft.copy[item.code]?.title && draft.copy[item.code]?.consent ? ' ✓' : ''}</option>)}</select></label>
    <div className="brand-form" dir={copyLanguage === 'ar' ? 'rtl' : 'ltr'} lang={copyLanguage}>
      {COPY_FIELDS.map(key => <label key={key}>{t(`${key}_field` as any)}{key === 'consent' || key === 'intro'
        ? <textarea className="brand-input" rows={key === 'consent' ? 4 : 2} maxLength={key === 'consent' ? 2000 : 300} value={copy[key] ?? ''} onChange={event => setCopy(key, event.target.value)} />
        : <input className="brand-input" maxLength={300} value={copy[key] ?? ''} onChange={event => setCopy(key, event.target.value)} />}</label>)}
      {questions.map(item => <label key={item.key}>{fieldLabel(item.key, t)}<input className="brand-input" maxLength={300} value={copy[item.key] ?? ''} onChange={event => setCopy(item.key, event.target.value)} /></label>)}
    </div>
    <label>{t('privacy_url')}<input className="brand-input" type="url" placeholder="https://" value={draft.privacy_url} onChange={event => setDraft(old => ({ ...old, privacy_url: event.target.value }))} /></label>
    <label>{t('retention')}<select className="brand-select" value={draft.retention_days} onChange={event => setDraft(old => ({ ...old, retention_days: Number(event.target.value) }))}>
      {[30, 60, 90].map(days => <option key={days} value={days}>{t('days_n', { n: days })}</option>)}</select></label>
    {showIssues && issues.length > 0 && <div className="brand-form-error" role="alert">{issues.map(issue => <div key={issue}>{t(`err_form_${issue}` as any)}</div>)}</div>}
    {error && <div className="brand-form-error" role="alert">{error}</div>}
    <div className="brand-actions"><button type="button" className="brand-button" onClick={close}>{t('cancel')}</button>
      <button type="button" className="brand-button" disabled={save.isPending} onClick={() => { void submit(false); }}><Save size={15} />{t('save_draft')}</button>
      <button type="button" className="brand-button primary" disabled={save.isPending} onClick={() => { void submit(true); }}><Send size={15} />{t('submit_review')}</button></div>
  </div></BrandPanel>;
}

export function leadsCsv(page: LeadsPage, brand: AdBrand, t: BrandTranslate) {
  const keys = LEAD_FIELD_KEYS.filter(key => page.leads.some(lead => lead.answers[key]));
  return brandCsv([[t('brand'), t('lead_date'), t('form_name'), ...keys.map(key => fieldLabel(key, t)), t('copy_language'), t('consent_field')],
    ...page.leads.map(lead => [brand.name, lead.created_at, lead.form_name, ...keys.map(key => lead.answers[key] ?? ''), lead.language, lead.consent_text])]);
}

export default function BrandLeadsView({ brand, t, language }: { brand: AdBrand; t: BrandTranslate; language: string }) {
  const { client, access } = useBrandAuth();
  const forms = usePortalLeadForms(brand.id), [editing, setEditing] = useState<LeadFormRecord | null | 'new'>(null);
  const [formFilter, setFormFilter] = useState<string | null>(null), [page, setPage] = useState(0), [error, setError] = useState('');
  const isMember = !access?.admin || access.brands.some(item => item.id === brand.id && !item.admin_preview);
  const leads = usePortalLeads(brand.id, formFilter, page, isMember);
  const exportLeads = async () => {
    setError('');
    try {
      const { data, error: failed } = await client.rpc('brand_leads_v1', { p_brand: brand.id, p_form: formFilter, p_limit: 5000, p_offset: 0, p_export: true });
      if (failed) throw failed;
      if (data?.protocol !== 'anacan-brand-leads-v1' || data.brand !== brand.id) throw new Error('BRAND_EXPORT_UNAVAILABLE');
      const url = URL.createObjectURL(new Blob([leadsCsv(data, brand, t)], { type: 'text/csv;charset=utf-8;' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Anacan-leads-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(brandError(failure, language)); }
  };
  const keys = LEAD_FIELD_KEYS.filter(key => leads.data?.leads.some(lead => lead.answers[key]));
  return <>
    <div className="brand-heading"><div><div className="brand-eyebrow">{t('product')}</div><h1>{t('leads')}</h1><p>{t('leads_hint')}</p></div>
      <div className="brand-actions"><button className="brand-button" onClick={() => setEditing('new')}><Plus size={15} />{t('new_form')}</button>
        <button className="brand-button primary" disabled={!leads.data?.total} onClick={() => { void exportLeads(); }}><ArrowDownToLine size={15} />{t('export_leads')}</button></div></div>
    <div className="brand-notice"><Lock size={16} /><div>{t('leads_private')}</div></div>
    {error && <div className="brand-form-error" role="alert">{error}</div>}
    {editing ? <FormEditor brand={brand} form={editing === 'new' ? null : editing} t={t} language={language} close={() => setEditing(null)} />
      : <BrandPanel title={t('lead_forms')}>{forms.data?.length ? <div className="brand-table-wrap"><table className="brand-table"><thead><tr><th>{t('form_name')}</th><th>{t('status')}</th><th className="numeric">{t('leads')}</th><th /></tr></thead>
        <tbody>{forms.data.map(form => <tr key={form.id}><td><strong>{form.name}</strong>{form.review_note && <small className="brand-review-note">{t('review_note')}: {form.review_note}</small>}</td>
          <td><span className="brand-status" data-status={form.live ? 'active' : form.status === 'pending' ? 'scheduled' : 'archived'}>{form.live ? t('live') : t(form.status as any)}</span>{form.live && form.status !== 'approved' && <small className="brand-review-note">{t(form.status as any)}</small>}</td>
          <td className="numeric">{brandNumber(form.leads, language)}</td><td className="numeric"><button className="brand-button" onClick={() => setEditing(form)}><Pencil size={14} />{t('edit')}</button></td></tr>)}</tbody></table></div>
        : <div className="brand-empty"><Inbox size={28} /><p>{forms.isError ? brandError(forms.error, language) : t('no_forms')}</p></div>}</BrandPanel>}
    <BrandPanel title={t('leads')} action={<select className="brand-select" aria-label={t('lead_forms')} value={formFilter ?? ''} onChange={event => { setFormFilter(event.target.value || null); setPage(0); }}>
      <option value="">{t('all_forms')}</option>{forms.data?.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}</select>}>
      {!isMember ? <div className="brand-empty"><Lock size={28} /><p>{t('leads_admin_hidden')}</p></div>
        : leads.isError ? <div className="brand-empty" role="alert"><p>{brandError(leads.error, language)}</p></div>
        : !leads.data?.leads.length ? <div className="brand-empty"><Inbox size={28} /><p>{t('no_leads')}</p></div>
        : <><div className="brand-table-wrap"><table className="brand-table"><thead><tr><th>{t('lead_date')}</th><th>{t('form_name')}</th>{keys.map(key => <th key={key}>{fieldLabel(key, t)}</th>)}<th>{t('copy_language')}</th></tr></thead>
          <tbody>{leads.data.leads.map(lead => <tr key={lead.id}><td>{new Date(lead.created_at).toLocaleString(appLanguageLocale(language), { timeZone: brand.report_timezone })}</td><td>{lead.form_name}</td>
            {keys.map(key => <td key={key} dir={key === 'phone' || key === 'email' ? 'ltr' : undefined}>{lead.answers[key] ?? '—'}</td>)}<td>{lead.language.toUpperCase()}</td></tr>)}</tbody></table></div>
          <div className="brand-pagination"><span>{brandNumber(leads.data.total, language)} · {t('leads')}</span><div className="brand-actions">
            <button className="brand-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={15} />{t('previous')}</button>
            <button className="brand-button" disabled={(page + 1) * 50 >= leads.data.total} onClick={() => setPage(page + 1)}>{t('next')}<ChevronRight size={15} /></button></div></div></>}
    </BrandPanel>
  </>;
}
