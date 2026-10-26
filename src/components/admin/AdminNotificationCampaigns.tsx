import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, RefreshCw, Send, Square, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { supabase } from '@/integrations/supabase/client';
import { ACCESS_LABELS, MODULE_LABELS, adminErrorText, adminRpc, countryFlag } from '@/lib/admin-insights';
import { toast } from 'sonner';
import countriesData from '../../../countries.json';
import { APP_LANGUAGES, localizedCountryName } from '@/lib/app-languages';
import { getLocaleTag } from '@/lib/i18n';
import { getPersistedLanguage, tr } from '@/lib/tr';

interface Segment { languages: string[]; modules: string[]; countries: string[]; platforms: string[]; access: string; joinedFrom: string | null; joinedTo: string | null }
interface Preview { schema: string; fingerprint: string; users: number; eligibleUsers: number; devices: number; optedOut: number; quietHours: number; noDevice: number; quietTimezone: string }
interface Campaign { id: string; title: string; body: string; segment: Segment; createdAt: string; total: number; pending: number; claimed: number; sent: number; failed: number; skipped: number; unknown: number; cancelled: boolean }
const emptySegment = (): Segment => ({ languages: [], modules: [], countries: [], platforms: [], access: 'all', joinedFrom: null, joinedTo: null });
const number = (value: number) => Number(value || 0).toLocaleString(getLocaleTag());
const countryOptions = (countriesData as Array<{ isoAlpha2: string; name: string }>).map(item => ({ value: item.isoAlpha2, label: `${countryFlag(item.isoAlpha2)} ${localizedCountryName(item.isoAlpha2, getPersistedLanguage(), item.name)}` }));
const languages = APP_LANGUAGES.map(language => ({ value: language.code, label: language.native_name }));
function MultiFilter({ label, options, values, onChange, disabled, searchable = false }: { label: string; options: Array<{ value: string; label: string }>; values: string[]; onChange: (value: string[]) => void; disabled?: boolean; searchable?: boolean }) {
  const [search, setSearch] = useState('');
  const shown = options.filter(item => !search || `${item.value} ${item.label}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <fieldset disabled={disabled} className="min-w-0"><legend className="text-sm font-semibold flex items-center gap-2">{label}<span className="admin-status-chip">{values.length ? `${values.length} seçim` : 'Hamısı'}</span></legend>
    {searchable && <Input aria-label={`${label} axtarışı`} value={search} placeholder="Ölkə axtar…" onChange={event => setSearch(event.target.value)} className="mt-3 h-9 text-xs" />}
    <div className="admin-segment-options"><button type="button" className="admin-filter-chip" aria-pressed={!values.length} onClick={() => onChange([])}>Hamısı</button>
      {shown.map(item => <button type="button" key={item.value} className="admin-filter-chip" aria-pressed={values.includes(item.value)} onClick={() => onChange(values.includes(item.value) ? values.filter(value => value !== item.value) : [...values, item.value].sort())}>
        {values.includes(item.value) && <Check size={11} className="inline me-1" />}{item.label}</button>)}</div>
    {searchable && values.length > 0 && <p className="admin-panel-note mt-2">Seçilib: {values.join(', ')}</p>}
  </fieldset>;
}
function Status({ campaign }: { campaign: Campaign }) {
  const processed = campaign.total - campaign.pending - campaign.claimed;
  return <div className="space-y-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{campaign.cancelled ? 'Dayandırılıb' : campaign.pending || campaign.claimed ? 'Göndəriş davam edir' : 'İşlənib'}</strong><span>{number(processed)} / {number(campaign.total)} cihaz</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${campaign.total ? Math.min(100, processed / campaign.total * 100) : 0}%` }} /></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[[tr('admin_campaign_sent', 'FCM qəbul edib'), campaign.sent], [tr('admin_campaign_failed', 'Xəta'), campaign.failed], [tr('admin_campaign_skipped', 'Buraxılıb'), campaign.skipped], [tr('admin_campaign_unknown', 'Nəticəsi qeyri-müəyyən'), campaign.unknown]].map(([name, value]) => <div key={String(name)} className="rounded-lg bg-muted/50 p-3"><strong className="block text-lg tabular-nums">{number(Number(value))}</strong><span className="text-[10px] text-muted-foreground">{name}</span></div>)}</div>
    {!!campaign.unknown && <p className="admin-panel-note">Qeyri-müəyyən nəticələr təkrar bildiriş yaratmamaq üçün avtomatik yenidən göndərilmir.</p>}
  </div>;
}
export default function AdminNotificationCampaigns() {
  const { user, isAdmin } = useAuth(), backend = getBackendConfig(), client = useQueryClient();
  const [segment, setSegment] = useState<Segment>(emptySegment), [title, setTitle] = useState(''), [body, setBody] = useState('');
  const [preview, setPreview] = useState<{ value: Preview; key: string } | null>(null), [previewing, setPreviewing] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null), [sending, setSending] = useState(false), [error, setError] = useState('');
  const running = useRef(false), mounted = useRef(true), campaignId = useRef<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const key = JSON.stringify(segment);
  const history = useQuery({ queryKey: ['admin-campaigns', backend.url, user?.id], queryFn: () => adminRpc<Campaign[]>('admin_notification_list_v1', { p_limit: 30 }), enabled: !!user && isAdmin, retry: false, refetchInterval: sending ? 5000 : 30000 });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; running.current = false; }; }, []);
  const reload = () => client.invalidateQueries({ queryKey: ['admin-campaigns'] });
  const checkAudience = async () => {
    setPreviewing(true); setError(''); const requested = key;
    try {
      const value = await adminRpc<Preview>('admin_notification_preview_v1', { p_segment: segment });
      if (value?.schema !== 'anacan-admin-audience-v1' || !/^[a-f0-9]{64}$/.test(value.fingerprint)) throw new Error('admin_invalid_response');
      setPreview({ value, key: requested });
    } catch (failure) { setError(adminErrorText(failure)); } finally { setPreviewing(false); }
  };
  const dispatch = async (existing?: Campaign) => {
    if (running.current || (!existing && (!preview || preview.key !== key || !preview.value.devices || !title.trim() || !body.trim()))) return;
    running.current = true; setSending(true); setError('');
    try {
      let current = existing;
      if (!current) {
        campaignId.current ??= crypto.randomUUID();
        current = await adminRpc<Campaign>('admin_notification_create_v1', { p_id: campaignId.current, p_title: title.trim(), p_body: body.trim(), p_segment: segment, p_fingerprint: preview!.value.fingerprint });
      }
      campaignId.current = current.id; setCampaign(current); await reload();
      while (running.current && mounted.current && (current.pending > 0 || current.claimed > 0) && !current.cancelled) {
        const { data, error: sendError } = await supabase.functions.invoke('admin-notification-dispatch', { body: { contract: 'anacan-admin-campaign-v1', notificationId: current.id } });
        if (sendError || !data?.ok || data.campaign?.id !== current.id) throw new Error('admin_campaign_send_unavailable');
        current = data.campaign as Campaign;
        if (mounted.current) setCampaign(current);
        await reload();
        // A previous worker may be finishing. Do not spin or resend its claims.
        if (!current.pending) break;
      }
      if (mounted.current && !current.pending && !current.claimed) toast.success('Kampaniya işlənib. Nəticələr aşağıda göstərilir.');
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error && failure.message === 'admin_campaign_send_unavailable'
        ? tr('admin_campaign_send_unavailable', 'Göndəriş xidməti cavab vermədi. Kampaniya saxlanıb; tarixçədən statusunu yoxlayıb davam edin.') : adminErrorText(failure));
      await reload();
    } finally { running.current = false; if (mounted.current) setSending(false); }
  };
  const cancel = async (value: Campaign) => {
    running.current = false;
    try { const next = await adminRpc<Campaign>('admin_notification_cancel_v1', { p_id: value.id }); setCampaign(next); await reload(); }
    catch (failure) { setError(adminErrorText(failure)); }
  };
  const fresh = () => { if (sending) return; campaignId.current = null; setCampaign(null); setPreview(null); setTitle(''); setBody(''); setError(''); };
  const setField = (name: keyof Segment, value: Segment[keyof Segment]) => { setSegment(previous => ({ ...previous, [name]: value })); setError(''); };
  return <div className="admin-page" data-testid="admin-notification-campaigns">
    <div className="admin-page-heading"><div><h1>Bildiriş kampaniyaları</h1><p>Bir və ya bir neçə dil, modul və ölkə seçin. Hər qrupun daxilində istənilən seçim, qruplar arasında isə bütün şərtlər birlikdə tətbiq edilir.</p></div><Button variant="outline" onClick={fresh} disabled={sending}>Yeni kampaniya</Button></div>
    <section className="admin-panel space-y-6"><div className="admin-segment-grid">
      <MultiFilter label="Dillər" options={languages} values={segment.languages} onChange={value => setField('languages', value)} disabled={sending || !!campaign} />
      <MultiFilter label="Modullar" options={Object.entries(MODULE_LABELS).filter(([id]) => id !== 'unknown').map(([value, label]) => ({ value, label }))} values={segment.modules} onChange={value => setField('modules', value)} disabled={sending || !!campaign} />
      <MultiFilter label="Ölkələr" searchable options={countryOptions} values={segment.countries} onChange={value => setField('countries', value)} disabled={sending || !!campaign} />
    </div><div className="admin-filters border-t pt-4"><label>Premium seqmenti<select className="h-10 rounded-lg border bg-background px-3" aria-label="Bildiriş Premium seqmenti" value={segment.access} disabled={sending || !!campaign} onChange={event => setField('access', event.target.value)}>{Object.entries(ACCESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Qeydiyyat · başlanğıc<Input aria-label="Auditoriya qeydiyyat başlanğıcı" type="date" value={segment.joinedFrom || ''} disabled={sending || !!campaign} onChange={event => setField('joinedFrom', event.target.value || null)} /></label>
      <label>Qeydiyyat · son gün<Input aria-label="Auditoriya qeydiyyat sonu" type="date" value={segment.joinedTo || ''} disabled={sending || !!campaign} onChange={event => setField('joinedTo', event.target.value || null)} /></label>
      <MultiFilter label="Platforma" options={[{ value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }]} values={segment.platforms} onChange={value => setField('platforms', value)} disabled={sending || !!campaign} />
    </div><div className="rounded-xl bg-muted/50 p-3 text-xs leading-6"><strong>Seçilmiş auditoriya: </strong>
      {segment.languages.length ? segment.languages.join(', ').toUpperCase() : 'Bütün dillər'} ∩ {segment.modules.length ? segment.modules.map(module => MODULE_LABELS[module]).join(', ') : 'Bütün modullar'} ∩ {segment.countries.length ? segment.countries.join(', ') : 'Bütün ölkələr'} · {ACCESS_LABELS[segment.access]}
    </div><Button variant="outline" onClick={() => void checkAudience()} disabled={previewing || sending || !!campaign}>{previewing ? <Loader2 size={16} className="me-2 animate-spin" /> : <Users size={16} className="me-2" />}Auditoriyanı yoxla</Button>
      {preview?.key === key && <div data-testid="admin-audience-preview"><div className="admin-kpis">{[[tr('admin_audience_users', 'Uyğun istifadəçi'), preview.value.users], [tr('admin_audience_eligible', 'Göndərişə uyğun istifadəçi'), preview.value.eligibleUsers], [tr('admin_audience_devices', 'Cihaz'), preview.value.devices], [tr('admin_audience_opted_out', 'Bildirişi bağlayan'), preview.value.optedOut], [tr('admin_audience_quiet', 'Səssiz saat'), preview.value.quietHours], [tr('admin_audience_no_device', 'Uyğun cihazı olmayan'), preview.value.noDevice]].map(([label, count]) => <div className="admin-kpi" key={String(label)}><span className="metric-label">{label}</span><strong>{number(Number(count))}</strong></div>)}</div><p className="admin-panel-note mt-3">Bildiriş və gündəlik push seçimini bağlayanlar, səssiz saatda olanlar və cihazı olmayanlar göndərişdən çıxarılır. Səssiz saat zonası: {preview.value.quietTimezone}.</p></div>}
    </section>
    <div className="admin-two-columns"><section className="admin-panel space-y-4"><h2>Bildirişin məzmunu</h2><label className="block text-xs font-semibold">Başlıq<Input aria-label="Kampaniya başlığı" value={title} maxLength={120} disabled={sending || !!campaign} onChange={event => setTitle(event.target.value)} className="mt-2" /><span className="admin-panel-note">{title.length}/120</span></label>
      <label className="block text-xs font-semibold">Mətn<Textarea aria-label="Kampaniya mətni" value={body} maxLength={2000} rows={4} disabled={sending || !!campaign} onChange={event => setBody(event.target.value)} className="mt-2" /><span className="admin-panel-note">{body.length}/2000</span></label>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="flex flex-wrap gap-2"><Button onClick={() => void dispatch()} disabled={sending || !!campaign || !preview || preview.key !== key || !preview.value.devices || !title.trim() || !body.trim()}>
        {sending ? <Loader2 size={16} className="animate-spin me-2" /> : <Send size={16} className="me-2" />}Seçilmiş auditoriyaya göndər</Button>
        {campaign && !campaign.cancelled && !!campaign.pending && <Button variant="outline" onClick={() => void cancel(campaign)}><Square size={14} className="me-2" />Qalanları dayandır</Button>}</div>
      <p className="admin-panel-note">Auditoriya yaradılarkən sabitlənir, göndərişdən əvvəl icazə və cihaz sahibi yenidən yoxlanır. Eyni cihaz bu kampaniyada təkrar göndəriş almır.</p>
    </section><section className="admin-panel"><h2 className="mb-4">Önbaxış və nəticə</h2><div className="rounded-2xl border bg-muted/40 p-4 mb-5"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Anacan · Bildiriş</span><strong className="block mt-2 text-sm break-words">{campaign?.title || title || 'Bildiriş başlığı'}</strong><p className="text-xs mt-2 whitespace-pre-wrap break-words leading-6">{campaign?.body || body || 'Bildirişin mətni burada görünəcək.'}</p></div>
      {campaign ? <Status campaign={campaign} /> : <p className="admin-panel-note">Göndəriş başladıqdan sonra hər partiyanın nəticəsi burada görünür. FCM qəbulu telefonda oxunma təsdiqi deyil.</p>}
    </section></div>
    <section className="admin-panel"><div className="flex justify-between gap-3 mb-4"><h2>Kampaniya tarixçəsi</h2><Button size="sm" variant="ghost" disabled={history.isFetching} onClick={() => void history.refetch()} aria-label="Kampaniya tarixçəsini yenilə"><RefreshCw size={15} className={history.isFetching ? 'animate-spin' : ''} /></Button></div>
      {history.isError ? <div className="admin-error">{adminErrorText(history.error)}</div> : history.isLoading ? <p className="admin-empty">Tarixçə yüklənir…</p> : !history.data?.length ? <p className="admin-empty">Hələ seqmentli kampaniya yoxdur.</p> : <div className="space-y-3">{history.data.map(item => <article key={item.id} className="rounded-xl border p-4">
        <button className="flex items-start justify-between gap-3 w-full text-start" onClick={() => setExpanded(expanded === item.id ? null : item.id)} aria-expanded={expanded === item.id}><div className="min-w-0"><strong className="text-sm break-words">{item.title}</strong><p className="admin-panel-note">{new Date(item.createdAt).toLocaleString(getLocaleTag())} · {number(item.total)} cihaz · {number(item.sent)} FCM qəbulu</p></div><ChevronDown size={17} className={`shrink-0 ${expanded === item.id ? 'rotate-180' : ''}`} /></button>
        {expanded === item.id && <div className="mt-4 space-y-4"><p className="text-xs whitespace-pre-wrap break-words">{item.body}</p><Status campaign={item} />{!item.cancelled && !!(item.pending || item.claimed) && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={sending} onClick={() => void dispatch(item)}>Statusu yoxla / davam et</Button><Button variant="outline" size="sm" disabled={sending} onClick={() => void cancel(item)}>Qalanları dayandır</Button></div>}</div>}
      </article>)}</div>}
    </section>
  </div>;
}
