import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, KeyRound, Plus, ShieldCheck, UserMinus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { brandError } from '@/lib/brand-ads';
import { useBrandAuth } from './Auth';
import { usePortalAdminAction, usePortalWorkspace } from './queries';
import { BrandPanel, type BrandTranslate } from './Portal';
import BrandReviewQueue from './Review';

export default function BrandAdmin({ t, language }: { t: BrandTranslate; language: string }) {
  const { access, client } = useBrandAuth(), queries = useQueryClient();
  const [brandId, setBrandId] = useState<string | null>(access?.brands[0]?.id ?? null);
  const workspace = usePortalWorkspace(brandId), action = usePortalAdminAction();
  const [name, setName] = useState(''), [website, setWebsite] = useState(''), [timezone, setTimezone] = useState('Asia/Baku');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [existingEmail, setExistingEmail] = useState('');
  const [target, setTarget] = useState(''), [banner, setBanner] = useState(''), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(''), [error, setError] = useState('');
  const request = useRef(crypto.randomUUID());
  const brands = workspace.data?.brands ?? access?.brands ?? [], brand = brands.find(item => item.id === brandId);
  useEffect(() => { setEmail(''); setPassword(''); setTarget(''); setExistingEmail(''); setBanner(''); setFeedback(''); setError(''); request.current = crypto.randomUUID(); }, [brandId]);
  const run = async (work: () => Promise<unknown>) => {
    setError(''); setFeedback(''); setBusy(true);
    try { await work(); setFeedback(t('saved')); } catch (failure) { setError(brandError(failure, language)); } finally { setBusy(false); }
  };
  const create = (event: FormEvent) => {
    event.preventDefault(); void run(async () => {
      const id = crypto.randomUUID();
      await action.mutateAsync({ action: 'create_brand', brand: id, payload: { name, website, report_timezone: timezone } });
      setBrandId(id); setName(''); setWebsite('');
    });
  };
  const account = (event: FormEvent) => {
    event.preventDefault(); if (!brandId) return;
    void run(async () => {
      const { data, error: failed } = await client.functions.invoke('brand-portal-accounts', { body: { action: target ? 'reset_password' : 'create',
        brandId, userId: target || undefined, email: email.trim(), password, requestId: request.current } });
      if (failed || data?.brandId !== brandId || !['account_created', 'password_updated'].includes(data.action)) throw new Error('BRAND_ACCOUNT_OPERATION_FAILED');
      setPassword(''); setEmail(''); setTarget(''); request.current = crypto.randomUUID();
      await queries.invalidateQueries({ queryKey: ['brand-portal-admin'] });
    });
  };
  return <><div className="brand-heading"><div><div className="brand-eyebrow">{t('admin_preview')}</div><h1>{t('admin_title')}</h1><p>{t('admin_body')}</p></div><ShieldCheck size={30} /></div>
    {error && <div className="brand-form-error" role="alert">{error}</div>}{feedback && <div className="brand-notice" role="status">{feedback}</div>}
    <BrandReviewQueue t={t} language={language} />
    <div className="brand-two-columns"><BrandPanel title={t('select_brand')}><label className="brand-form-label">{t('select_brand')}<select className="brand-select" value={brandId || ''} onChange={event => setBrandId(event.target.value || null)}>
      <option value="">{t('select_brand')}</option>{brands.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {brand && <div className="brand-admin-brand"><h2>{brand.name}</h2><p className="brand-hint">{brand.report_timezone}</p><label className="brand-toggle"><input type="checkbox" checked={brand.is_active} disabled={busy} onChange={event => { void run(() => action.mutateAsync({ action: 'update_brand', brand: brand.id,
        payload: { name: brand.name, website: brand.website || '', logo_url: brand.logo_url || '', report_timezone: brand.report_timezone, is_active: event.target.checked } })); }} />{t('brand_active')}</label>
        <Link className="brand-button" to={'/' + brand.id}><ExternalLink size={15} />{t('open_portal')}</Link></div>}
    </BrandPanel><BrandPanel title={t('create_brand')}><form className="brand-form" onSubmit={create}>
      <label>{t('brand_name')}<input className="brand-input" value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
      <label>{t('website')}<input className="brand-input" type="url" placeholder="https://" value={website} onChange={event => setWebsite(event.target.value)} /></label>
      <label>{t('timezone')}<select className="brand-select" value={timezone} onChange={event => setTimezone(event.target.value)}>{['Asia/Baku', 'UTC', 'Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo'].map(value => <option key={value}>{value}</option>)}</select></label>
      <button className="brand-button primary" disabled={busy} type="submit"><Plus size={15} />{t('create_brand')}</button>
    </form></BrandPanel></div>
    {brand && <><div className="brand-two-columns"><BrandPanel title={t('members')}><div className="brand-members" data-testid="brand-members">
      {workspace.data?.members.map(member => <div className="brand-member" key={member.user_id}><div><strong>{member.email}</strong><small>{member.is_active ? t('active') : t('paused')}</small></div><div className="brand-actions">
        {member.managed && <button className="brand-button" disabled={busy} onClick={() => { setTarget(member.user_id); setEmail(member.email); setPassword(''); request.current = crypto.randomUUID(); }}><KeyRound size={14} />{t('forgot_password')}</button>}
        {member.is_active && <button className="brand-button" disabled={busy} onClick={() => { void run(() => action.mutateAsync({ action: 'remove_member', brand: brand.id, target: member.user_id, payload: {} })); }}><UserMinus size={14} />{t('remove_member')}</button>}</div></div>)}
    </div><details className="brand-existing-account"><summary>{t('member_email')}</summary><p className="brand-hint">{t('member_hint')}</p><form className="brand-form" onSubmit={event => { event.preventDefault(); void run(async () => { await action.mutateAsync({ action: 'add_member', brand: brand.id, payload: { email: existingEmail } }); setExistingEmail(''); }); }}>
      <label>{t('member_email')}<input className="brand-input" type="email" value={existingEmail} onChange={event => setExistingEmail(event.target.value)} required /></label><button className="brand-button" disabled={busy}>{t('add_member')}</button></form></details></BrandPanel>
      <BrandPanel title={target ? t('forgot_password') : t('add_member')} hint={brand.name}><form className="brand-form" onSubmit={account} data-testid="brand-account-form">
        <label>{t('email')}<input type="email" className="brand-input" autoComplete="off" value={email} readOnly={!!target} onChange={event => { setEmail(event.target.value); request.current = crypto.randomUUID(); }} required /></label>
        <label>{t('password')} <small>12–128</small><input type="password" className="brand-input" autoComplete="new-password" value={password} minLength={12} maxLength={128} onChange={event => setPassword(event.target.value)} required /></label>
        <button className="brand-button primary" type="submit" disabled={busy}><KeyRound size={15} />{target ? t('save') : t('add_member')}</button>
        {target && <button className="brand-button" type="button" onClick={() => { setTarget(''); setPassword(''); setEmail(''); request.current = crypto.randomUUID(); }}>{t('cancel')}</button>}
      </form></BrandPanel></div>
      <BrandPanel title={t('assign_ad')}><form className="brand-form brand-inline-form" onSubmit={event => { event.preventDefault(); void run(async () => { await action.mutateAsync({ action: 'assign_banner', brand: brand.id, target: banner, payload: {} }); setBanner(''); }); }}>
        <label>{t('unassigned')}<select className="brand-select" value={banner} required onChange={event => setBanner(event.target.value)}><option value="">{t('choose_banner')}</option>
          {workspace.data?.banners.filter(item => !item.brand_id).map(item => <option key={item.id} value={item.id}>{item.title} · {t(item.placement as any)}</option>)}</select></label>
        <button className="brand-button primary" disabled={busy || !banner}>{t('assign_ad')}</button></form>
        <p className="brand-hint">{t('ownership_locked')}</p>
      </BrandPanel>
    </>}
    {workspace.isError && <div className="brand-form-error" role="alert">{brandError(workspace.error, language)}</div>}
  </>;
}
