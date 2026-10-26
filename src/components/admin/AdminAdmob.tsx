import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, ArrowUpRight, CheckCircle2, ChevronDown, Code2, Download, Eye, FlaskConical, History, Loader2, Megaphone, PauseCircle, Play, RefreshCw, Save, Settings2, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAdmobAdmin, useSourceAdmobControl } from '@/hooks/useAdmobAdmin';
import { useAdExperience } from '@/components/ads/AdExperienceProvider';
import { AdmobSimulator } from '@/components/ads/AdmobSimulator';
import { ADMOB_CONTROL_URL, ADMOB_ERROR_LABELS, disableAdmob, type AdmobMutationResult } from '@/lib/ads/api';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { tr, formatTr, getPersistedLanguage } from '@/lib/tr';
import { getLocaleTag } from '@/lib/i18n';
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import { localizedAdPlacements, adMetricLabels } from '@/lib/ads/labels';
import type { ZodIssue } from 'zod';
import { AD_PLACEMENTS, adsConfigurationSchema, appAdsTxt, isAdUnitId, isAppId, isTestId, placementDefinition, TEST_APP_IDS,
  type AdFormat, type AdMode, type AdPlacementConfig, type AdPlacementId, type AdsConfiguration, type AdsSettings } from '@/lib/ads/config';

const formatLabels: Record<AdFormat, string> = { banner: tr('ads_format_banner', 'Adaptiv banner'), interstitial: tr('ads_format_interstitial', 'Tam ekran'), rewarded: tr('ads_format_rewarded', 'Mükafatlı video'), native_story: tr('ads_format_story', 'Story native / video') };
const modeLabels: Record<AdMode, string> = { demo: tr('ads_mode_demo', 'Demo · veb önizləmə'), test: tr('ads_mode_test', 'Test · Google sınaq reklamı'), live: tr('ads_mode_live', 'Canlı · AdMob') };
const formatStyles: Record<AdFormat, string> = { banner: 'bg-orange-50 text-orange-700 border-orange-200', interstitial: 'bg-violet-50 text-violet-700 border-violet-200', rewarded: 'bg-emerald-50 text-emerald-700 border-emerald-200', native_story: 'bg-blue-50 text-blue-700 border-blue-200' };
const errorText = (error: unknown) => error instanceof Error && ADMOB_ERROR_LABELS[error.message]
  ? tr(`ads_error_${error.message}`, ADMOB_ERROR_LABELS[error.message]) : tr('ads_operation_failed', 'Ayar saxlanmadı. Sahələri yoxlayıb yenidən cəhd edin.');
function issueText(issue: ZodIssue): string {
  if (!(NEW_LANGUAGE_CODES as readonly string[]).includes(getPersistedLanguage())) return issue.message;
  if (issue.code === 'too_small') return formatTr('ads_value_minimum', 'Minimum: {value}', { value: issue.minimum });
  if (issue.code === 'too_big') return formatTr('ads_value_maximum', 'Maksimum: {value}', { value: issue.maximum });
  if (issue.message.includes('Başlanğıc vaxtı')) return tr('ads_start_before_end', 'Başlanğıc vaxtı bitmə vaxtından əvvəl olmalıdır.');
  if (issue.message.includes('App ID')) return tr('ads_match_app_publisher', 'Canlı App ID və Publisher ID uyğun olmalıdır.');
  if (issue.message.includes('reklam ID-si')) return tr('ads_live_unit_required', 'Canlı reklam ID-si tələb olunur.');
  if (issue.message.includes('Publisher')) return tr('ads_publisher_required', 'Öz Publisher ID-nizi daxil edin.');
  return tr('ads_invalid_value', 'Sahənin dəyərini və göstərilən hədləri yoxlayın.');
}
function download(name: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NumberField({ id, label, value, min, max, onChange, note }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void; note?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs">{label}</Label><Input id={id} type="number" inputMode="numeric" min={min} max={max} value={value}
    onChange={event => onChange(Number(event.target.value))} /><p className="text-[10px] text-muted-foreground">{note || `${min}–${max}`}</p></div>;
}
function TextField({ id, label, value, onChange, placeholder, note }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; note?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs">{label}</Label><Input id={id} value={value} onChange={event => onChange(event.target.value.trim())} placeholder={placeholder} autoComplete="off" spellCheck={false} className="font-mono text-xs" />{note && <p className="text-[10px] text-muted-foreground">{note}</p>}</div>;
}
function announceUpdate(result: AdmobMutationResult, action: string) {
  if (!result.continuity.ready) toast.warning(`${action} Azure-da təsdiqləndi. Source nüsxəsi hələ təsdiqlənməyib; əvvəlki reklam ayarları orada işləyə bilər.`);
  else if (result.continuity.emergencyDisabled) toast.warning(`${action} Source nüsxəsi yeniləndi, amma Source fövqəladə dayandırması aktiv qalır.`);
  else toast.success(`${action} Source nüsxəsi təsdiqləndi. Cihazlar növbəti yenilənmədə alacaq.`);
}
const localDateInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AdminAdmob() {
  return getBackendConfig().azure ? <AzureAdmobControl /> : <SourceAdmobControl />;
}

function SourceAdmobControl() {
  const source = useSourceAdmobControl(), snapshot = source.data;
  const emergency = async (disabled: boolean) => {
    try {
      await source.emergency.mutateAsync(disabled);
      toast.success(disabled ? 'Source-da yeni reklam sorğuları fövqəladə dayandırıldı. Cihazlar növbəti yenilənmədə alacaq.'
        : 'Fövqəladə dayandırma ləğv edildi. Source-da saxlanmış reklam ayarları tətbiq olunur.');
    } catch (error) { toast.error(errorText(error)); }
  };
  return <Card data-testid="source-admob-control"><CardContent className="space-y-5 pt-6">
    <div className="flex items-start gap-3"><Megaphone className="shrink-0 text-primary" size={28} /><div>
      <h2 className="text-xl font-semibold">Source reklam ehtiyatı</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Bu tətbiq reklam ayarlarını Source-dan oxuyur. Azure əlçatmaz olanda son təsdiqlənmiş ayarlar işləməyə davam edir.</p>
    </div></div>
    {source.isLoading && <p className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Reklam ehtiyatı yoxlanır…</p>}
    {source.isError && <p role="alert" className="text-sm text-amber-700">{errorText(source.error)}</p>}
    {snapshot && <div className="space-y-3 rounded-xl border p-4" data-testid="source-admob-status">
      <div className="flex flex-wrap gap-2"><Badge variant="outline">Source · V{snapshot.upstreamRevision}</Badge>
        <Badge variant="secondary">Nüsxə #{snapshot.sourceGeneration}</Badge>
        <Badge variant="outline">{snapshot.configuration.settings.enabled ? 'Reklam açarı aktivdir' : 'Reklam açarı bağlıdır'}</Badge></div>
      <p className="text-xs text-muted-foreground">Azure ilə son təsdiq: {new Date(snapshot.syncedAt).toLocaleString(getLocaleTag())}. Source əlçatandırsa bu tarixin köhnəlməsi reklamları dayandırmır.</p>
      <p className="text-sm" role="status">{snapshot.emergencyDisabled ? 'Source fövqəladə dayandırması aktivdir.' : 'Source fövqəladə dayandırması aktiv deyil.'}</p>
      <p className="text-xs text-muted-foreground">Bu açar yalnız Source-da dayandırır və Azure-dan gələn yenilənmə onu ləğv etmir. Premium və reklam razılığı qaydaları həmişə tətbiq olunur.</p>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void source.refetch()} disabled={source.isFetching || source.emergency.isPending}><RefreshCw size={15} className="me-2" />Nüsxəni yoxla</Button>
      <Button variant={snapshot?.emergencyDisabled ? 'outline' : 'destructive'} disabled={!snapshot || source.isError || source.emergency.isPending}
        onClick={() => void emergency(!snapshot?.emergencyDisabled)}>{source.emergency.isPending ? <Loader2 size={15} className="me-2 animate-spin" /> : <PauseCircle size={15} className="me-2" />}
        {snapshot?.emergencyDisabled ? 'Fövqəladə dayandırmanı ləğv et' : 'Source reklamlarını dayandır'}</Button>
    </div>
    <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Placement, limit və reklam ID-ləri Azure idarəetmə mərkəzində dəyişdirilir; nüsxənin təsdiqini həmin panel göstərir.</p>
      <a href={ADMOB_CONTROL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowUpRight size={16} />Reklam idarəetməsini aç</a></div>
  </CardContent></Card>;
}

function AzureAdmobControl() {
  const admin = useAdmobAdmin(), ads = useAdExperience(), client = useQueryClient();
  const [draft, setDraft] = useState<AdsConfiguration | null>(null), [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('placements'), [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<AdPlacementId | null>(null), [selected, setSelected] = useState<AdPlacementId>('home_banner');
  const [metricMode, setMetricMode] = useState('all'), [stopping, setStopping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (admin.data && !dirty) setDraft(structuredClone(admin.data.configuration)); }, [admin.data, dirty]);
  const validation = useMemo(() => draft ? adsConfigurationSchema.safeParse(draft) : null, [draft]);
  const updateSetting = <K extends keyof AdsSettings>(name: K, value: AdsSettings[K]) => {
    setDraft(current => current ? { ...current, settings: { ...current.settings, [name]: value } } : current); setDirty(true);
  };
  const updatePlacement = (id: AdPlacementId, values: Partial<AdPlacementConfig>) => {
    setDraft(current => current ? { ...current, placements: current.placements.map(item => item.id === id ? { ...item, ...values } : item) } : current); setDirty(true);
  };
  const save = async () => {
    if (!draft || !validation?.success) { toast.error('Qeyd olunan sahələri tamamlayın.'); return; }
    try { const result = await admin.save.mutateAsync(draft); setDraft(result.configuration); setDirty(false); announceUpdate(result, formatTr('ads_saved_version', 'V{revision} yadda saxlanıldı.', { revision: result.configuration.revision })); }
    catch (error) { toast.error(errorText(error)); }
  };
  const stopAll = async () => {
    setStopping(true);
    try {
      const result = await disableAdmob(), value = result.configuration;
      if (dirty) { setDraft(current => current ? { ...current, settings: { ...current.settings, enabled: false } } : value);
        toast.info('Draft qorunub; saxlamadan əvvəl son versiya ilə uyğunlaşdırın.'); }
      else { setDraft(value); setDirty(false); }
      announceUpdate(result, tr('ads_azure_disabled', 'Azure reklam açarı söndürüldü.'));
      await Promise.all([client.invalidateQueries({ queryKey: ['admin-admob'] }), client.invalidateQueries({ queryKey: ['admob-configuration'] }),
        client.invalidateQueries({ queryKey: ['admin-admob-mirror'] })]);
    } catch (error) { toast.error(errorText(error)); } finally { setStopping(false); }
  };
  const startSitePreview = async (id: AdPlacementId) => {
    try {
      await ads.startPreview({ premium: false, platform: 'ios', fast: true });
      const surface = placementDefinition(id).surface;
      const screen = ['article'].includes(surface) ? 'blog' : surface === 'recipe_detail' ? 'recipes' : surface;
      window.open(`/?ad_preview=1&ad_screen=${encodeURIComponent(screen)}`, '_blank', 'noopener,noreferrer');
    } catch (error) { toast.error(errorText(error)); }
  };
  if (admin.isLoading || !draft && !admin.isError) return <div className="flex items-center justify-center gap-3 py-20"><Loader2 className="animate-spin" />Reklam idarəetməsi yüklənir…</div>;
  if (admin.isError || !draft) return <Card><CardContent className="space-y-4 py-10 text-center"><AlertCircle className="mx-auto text-amber-500" /><h2 className="font-semibold">Reklam konfiqurasiyası açılmadı</h2><p className="text-sm text-muted-foreground">{errorText(admin.error)}</p><Button onClick={() => admin.refetch()} variant="outline">Yenidən yoxla</Button></CardContent></Card>;
  const active = draft.placements.filter(item => item.enabled);
  const placements = localizedAdPlacements(), metricLabels = adMetricLabels();
  const shownPlacements = placements.filter(item => (filter === 'all' || item.format === filter) && `${item.id} ${item.title}`.toLocaleLowerCase(getLocaleTag()).includes(search.toLocaleLowerCase(getLocaleTag())));
  const metrics = (admin.data?.metrics ?? []).filter(row => metricMode === 'all' || row.mode === metricMode);
  const metricTotal = (event: string) => metrics.filter(row => row.event === event).reduce((sum, row) => sum + Number(row.count), 0);
  const busy = admin.save.isPending || admin.restore.isPending || admin.sync.isPending || stopping;
  const savedConfig = admin.data?.configuration ?? draft;
  const continuity = admin.data?.continuity;
  return <div className="space-y-6" data-testid="admin-admob">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2"><span className="rounded-lg bg-orange-100 p-2 text-orange-700"><Megaphone size={19} /></span><Badge variant="outline">AdMob · V{draft.revision}</Badge>{dirty && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Saxlanmamış dəyişiklik</Badge>}</div>
        <h2 className="text-2xl font-bold tracking-tight">Reklam idarəetmə mərkəzi</h2><p className="mt-1 text-sm text-muted-foreground">Yerləşmələr, göstərilmə qaydaları, demo və native hazırlıq bir yerdə.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setDirty(false); void admin.refetch(); }}><RefreshCw size={14} className="me-2" />Yenilə</Button>
        <Button variant="outline" size="sm" onClick={() => { setTab('demo'); }}><Eye size={14} className="me-2" />Demo</Button>
        <Button size="sm" onClick={save} disabled={busy || !dirty || !validation?.success} data-testid="admob-save">{admin.save.isPending ? <Loader2 className="me-2 animate-spin" size={14} /> : <Save className="me-2" size={14} />}Yadda saxla</Button></div>
    </div>

    <div className="space-y-3 rounded-xl border p-4" data-testid="admob-mirror-status">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">Source reklam ehtiyatı</strong><Badge variant="outline" role="status">
          {admin.mirrorLoading ? 'Yoxlanır…' : continuity?.ready ? `Təsdiqləndi · V${continuity.upstreamRevision}` : continuity?.available ? `Yenilənir · V${continuity.upstreamRevision}` : 'Təsdiq gözlənilir'}</Badge>
        {continuity?.emergencyDisabled && <Badge variant="destructive">Source fövqəladə dayandırması aktivdir</Badge>}
      </div><Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        try { const snapshot = await admin.sync.mutateAsync(savedConfig.revision);
          if (snapshot.emergencyDisabled) toast.warning('Nüsxə təsdiqləndi. Source fövqəladə dayandırması aktiv qalır.');
          else toast.success(`Source nüsxəsi V${snapshot.upstreamRevision} təsdiqləndi.`);
        } catch (error) { toast.warning(errorText(error)); }
      }}><RefreshCw size={14} className={`me-2 ${admin.sync.isPending ? 'animate-spin' : ''}`} />Source sinxronunu yoxla</Button></div>
      <p className="text-xs text-muted-foreground">Azure dayansa, Source son təsdiqlənmiş nüsxəni təqdim edir. Nüsxə təsdiqlənənədək dəyişikliklər Source cihazlarına çatmış sayılmır.</p>
      {continuity?.syncedAt && <p className="text-[11px] text-muted-foreground">Son təsdiq: {new Date(continuity.syncedAt).toLocaleString(getLocaleTag())}</p>}
    </div>

    <div className="rounded-2xl border bg-gradient-to-r from-orange-50/70 to-violet-50/70 p-4 dark:from-orange-950/20 dark:to-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Switch id="ads-master-enabled" checked={draft.settings.enabled} onCheckedChange={value => updateSetting('enabled', value)} /><div><Label htmlFor="ads-master-enabled" className="font-semibold">Ümumi reklam açarı</Label><p className="mt-0.5 text-xs text-muted-foreground">Ayarlar təxminən 30 saniyədə yenilənir. Premium və ailə Premium-u reklamsızdır.</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="bg-background">{modeLabels[draft.settings.mode]}</Badge><Button variant="outline" size="sm" onClick={stopAll} disabled={busy || !savedConfig.settings.enabled} className="text-red-600"><PauseCircle size={14} className="me-2" />Hamısını dərhal dayandır</Button></div>
      </div>
      {draft.settings.mode === 'demo' && <p className="mt-3 text-xs text-violet-700 dark:text-violet-300">Demo yalnız administratorun önizləmə sessiyasında görünür. Normal istifadəçilərə nümunə reklam göndərilmir.</p>}
    </div>
    {validation && !validation.success && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="alert"><p className="mb-2 font-semibold">Saxlamadan əvvəl tamamlanacaq sahələr</p><ul className="list-inside list-disc space-y-1">{validation.error.issues.slice(0, 8).map((issue, index) => <li key={index}>{issueText(issue)} <span className="opacity-60">({issue.path.join('.')})</span></li>)}</ul>{validation.error.issues.length > 8 && <p className="mt-2">…və daha {validation.error.issues.length - 8} sahə.</p>}</div>}
    {dirty && savedConfig.revision !== draft.revision && <div className="rounded-xl border border-amber-200 p-4 text-xs">Serverdə V{savedConfig.revision} mövcuddur; draft V{draft.revision}-ə əsaslanır. Draftı JSON kimi ixrac edib son versiyanı yükləyə bilərsiniz.</div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[[tr('ads_active_placements', 'Aktiv placement'), `${active.length} / ${AD_PLACEMENTS.length}`, Megaphone], [formatLabels.banner, active.filter(item => placementDefinition(item.id).format === 'banner').length, Smartphone],
        [formatLabels.interstitial, active.filter(item => placementDefinition(item.id).format === 'interstitial').length, Play], [tr('ads_adfree_reward', 'Reklamsız mükafat'), formatTr('ads_pause_minutes', '{minutes} dəq.', { minutes: draft.settings.reward_pause_minutes }), ShieldCheck]].map(([label, count, Icon]) => {
          const Symbol = Icon as typeof Megaphone;
          return <Card key={String(label)}><CardContent className="flex items-center gap-3 pt-5"><Symbol className="text-primary" size={20} /><div><p className="text-xl font-bold">{String(count)}</p><p className="text-[11px] text-muted-foreground">{String(label)}</p></div></CardContent></Card>;
        })}
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto flex-wrap justify-start gap-1"><TabsTrigger value="placements"><Megaphone size={14} className="me-1.5" />Placement-lər</TabsTrigger><TabsTrigger value="settings"><Settings2 size={14} className="me-1.5" />Ümumi qaydalar</TabsTrigger><TabsTrigger value="demo"><FlaskConical size={14} className="me-1.5" />Demo laboratoriya</TabsTrigger><TabsTrigger value="metrics"><Activity size={14} className="me-1.5" />Telemetriya</TabsTrigger><TabsTrigger value="setup"><Code2 size={14} className="me-1.5" />Native hazırlıq</TabsTrigger><TabsTrigger value="history"><History size={14} className="me-1.5" />Tarixçə</TabsTrigger></TabsList>
      <TabsContent value="placements" className="space-y-4 pt-2">
        <div className="flex flex-wrap gap-3"><Input aria-label="Placement axtar" value={search} onChange={e => setSearch(e.target.value)} placeholder="Placement adı və ya ID…" className="max-w-sm" /><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Bütün formatlar</SelectItem><SelectItem value="banner">Banner</SelectItem><SelectItem value="interstitial">Tam ekran</SelectItem><SelectItem value="rewarded">Mükafatlı</SelectItem><SelectItem value="native_story">Story</SelectItem></SelectContent></Select></div>
        {shownPlacements.map(definition => {
          const item = draft.placements.find(value => value.id === definition.id)!;
          return <Card key={item.id} className={!item.enabled ? 'opacity-70' : ''} data-testid={`placement-card-${item.id}`}><CardContent className="space-y-4 pt-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className={formatStyles[definition.format]}>{formatLabels[definition.format]}</Badge><code className="break-all text-[10px] text-muted-foreground">{item.id}</code></div><h3 className="font-semibold">{definition.title}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{definition.description}</p></div>
              <Switch checked={item.enabled} onCheckedChange={enabled => updatePlacement(item.id, { enabled })} aria-label={`${definition.title} aktiv`} /></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]"><Badge variant="secondary">{item.platforms.join(' + ')}</Badge><Badge variant="secondary">Sessiya: {item.session_cap}</Badge><Badge variant="secondary">Gün: {item.daily_cap}</Badge><Badge variant="secondary">Fasilə: {item.cooldown_seconds} san.</Badge><Badge variant="secondary">Min. baxış: {item.min_screen_seconds} san.</Badge>{item.start_at || item.end_at ? <Badge variant="outline">Vaxt cədvəli var</Badge> : null}</div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setExpanded(expanded === item.id ? null : item.id)}><Settings2 size={13} className="me-1.5" />Parametrlər<ChevronDown size={13} className="ms-1" /></Button><Button variant="ghost" size="sm" onClick={() => { setSelected(item.id); setTab('demo'); }}><Eye size={13} className="me-1.5" />Demoda bax</Button><Button variant="ghost" size="sm" onClick={() => startSitePreview(item.id)}><ArrowUpRight size={13} className="me-1.5" />Saytda aç</Button></div>
            {expanded === item.id && <div className="space-y-5 border-t pt-4">
              <p className="rounded-lg bg-muted/60 p-3 text-xs"><strong>Tetiklənmə: </strong>{definition.trigger}</p>
              {definition.format === 'banner' && <div className="max-w-sm space-y-1.5"><Label>Reklamın mövqeyi</Label><Select value={item.position} onValueChange={position => updatePlacement(item.id, { position: position as AdPlacementConfig['position'] })}><SelectTrigger aria-label={`${item.id} mövqe`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Yuxarı · sabit zolaq</SelectItem><SelectItem value="middle">Orta · məzmunun içində</SelectItem><SelectItem value="bottom">Aşağı · naviqasiyanın üstü</SelectItem></SelectContent></Select><p className="text-[10px] text-muted-foreground">Orta yerləşmə ayrılmış məzmun sahəsini izləyir; ekranın üstünə örtük kimi qoyulmur.</p></div>}
              {['community_story_break','games_break_interstitial'].includes(item.id) && <div className="grid gap-4 md:grid-cols-2"><NumberField id={`${item.id}-every`} label={item.id === 'community_story_break' ? 'Hər neçə story-dən sonra?' : 'Hər neçə bitmiş oyundan sonra?'} value={item.every_n} min={1} max={50} onChange={every_n => updatePlacement(item.id, { every_n })} note="Geri baxış/təkrar callback sayılmır. Reklam hazır deyilsə axın davam edir." />{item.id === 'community_story_break' && <div className="space-y-1.5"><Label>Story reklam görünüşü</Label><Select value={item.story_format} onValueChange={story_format => updatePlacement(item.id, { story_format: story_format as 'native' | 'video' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="native">Native story · şəkil / media</SelectItem><SelectItem value="video">Video story</SelectItem></SelectContent></Select><p className="text-[10px] text-muted-foreground">Ad unit Native formatında yaradılır. Video seçiləndə videosuz cavab göstərilmir.</p></div>}</div>}
              {item.id === 'game_revive_rewarded' && <div className="grid grid-cols-2 gap-4"><NumberField id="revive-lives" label="Sağlam Səbət · bərpa olunan can" value={item.revive_lives} min={1} max={5} onChange={revive_lives => updatePlacement(item.id, { revive_lives })} /><NumberField id="revive-seconds" label="Vaxt bitibsə əlavə saniyə" value={item.revive_seconds} min={5} max={60} onChange={revive_seconds => updatePlacement(item.id, { revive_seconds })} /><NumberField id="revive-moves" label="Birləşdir · əlavə gediş" value={item.revive_moves} min={1} max={20} onChange={revive_moves => updatePlacement(item.id, { revive_moves })} /><NumberField id="revive-max" label="Bir raundda bərpa limiti" value={item.max_revives} min={1} max={3} onChange={max_revives => updatePlacement(item.id, { max_revives })} /></div>}
              {definition.format !== 'banner' && <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"><Label htmlFor={`${item.id}-global-cooldown`} className="text-xs">Ümumi tam ekran fasiləsini də tətbiq et</Label><Switch id={`${item.id}-global-cooldown`} checked={item.respect_global_cooldown} onCheckedChange={respect_global_cooldown => updatePlacement(item.id, { respect_global_cooldown })} /></div>}
              <div className="flex gap-6">{(['ios', 'android'] as const).map(platform => <div className="flex items-center gap-2" key={platform}><Switch id={`${item.id}-${platform}`} checked={item.platforms.includes(platform)} disabled={item.platforms.length === 1 && item.platforms.includes(platform)} onCheckedChange={checked => updatePlacement(item.id, { platforms: checked ? [...item.platforms, platform] : item.platforms.filter(value => value !== platform) })} /><Label htmlFor={`${item.id}-${platform}`}>{platform === 'ios' ? 'iOS' : 'Android'}</Label></div>)}</div>
              <div className="grid gap-4 md:grid-cols-2"><TextField id={`${item.id}-ios-unit`} label="iOS · canlı Ad unit ID" value={item.ios_ad_unit_id} placeholder="ca-app-pub-…/…" onChange={ios_ad_unit_id => updatePlacement(item.id, { ios_ad_unit_id })} note={`AdMob-da tövsiyə edilən ad: anacan_ios_${item.id}`} /><TextField id={`${item.id}-android-unit`} label="Android · canlı Ad unit ID" value={item.android_ad_unit_id} placeholder="ca-app-pub-…/…" onChange={android_ad_unit_id => updatePlacement(item.id, { android_ad_unit_id })} note={`AdMob-da tövsiyə edilən ad: anacan_android_${item.id}`} /></div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><NumberField id={`${item.id}-cooldown`} label="Yenidən göstərmə fasiləsi (san.)" value={item.cooldown_seconds} min={0} max={86400} onChange={cooldown_seconds => updatePlacement(item.id, { cooldown_seconds })} /><NumberField id={`${item.id}-session`} label="Sessiyada açılış limiti" value={item.session_cap} min={1} max={100} onChange={session_cap => updatePlacement(item.id, { session_cap })} /><NumberField id={`${item.id}-day`} label="UTC günü üzrə açılış limiti" value={item.daily_cap} min={1} max={500} onChange={daily_cap => updatePlacement(item.id, { daily_cap })} /><NumberField id={`${item.id}-screen`} label="Ekranda minimum vaxt (san.)" value={item.min_screen_seconds} min={0} max={3600} onChange={min_screen_seconds => updatePlacement(item.id, { min_screen_seconds })} /></div>
              <div className="grid gap-4 md:grid-cols-2">{(['start_at', 'end_at'] as const).map(field => <div className="space-y-1.5" key={field}><Label htmlFor={`${item.id}-${field}`}>{field === 'start_at' ? 'Başlanğıc · istəyə bağlı' : 'Bitmə · istəyə bağlı'}</Label><Input id={`${item.id}-${field}`} type="datetime-local" value={localDateInput(item[field])} onChange={event => { const value = event.target.value ? new Date(event.target.value).toISOString() : null; updatePlacement(item.id, { [field]: value }); }} /><p className="text-[10px] text-muted-foreground">Brauzerinizin vaxt zonası; serverdə UTC saxlanır.</p></div>)}</div>
              {definition.format === 'banner' && <p className="text-[11px] text-muted-foreground">Limit tətbiqin banneri açmasına aiddir. SDK-nın reklam yeniləmə tezliyi AdMob konsolunda idarə olunur.</p>}
            </div>}
          </CardContent></Card>;
        })}
      </TabsContent>
      <TabsContent value="settings" className="space-y-4 pt-2">
        <Card><CardContent className="space-y-5 pt-5"><h3 className="font-semibold">Rejim və AdMob hesabı</h3><div className="max-w-md space-y-2"><Label>İş rejimi</Label><Select value={draft.settings.mode} onValueChange={mode => updateSetting('mode', mode as AdMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(modeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Demo vebdə nümunə göstərir. Test native SDK-da Google sınaq ID-lərini seçir. Canlı rejim öz ID-ləriniz və uyğun yeni build tələb edir.</p></div>
          <div className="grid gap-4 md:grid-cols-2"><TextField id="admob-ios-app" label="iOS App ID" value={draft.settings.ios_app_id} onChange={value => updateSetting('ios_app_id', value)} placeholder="ca-app-pub-…~…" note="App ID-də ~, reklam bölməsi ID-sində / işarəsi olur." /><TextField id="admob-android-app" label="Android App ID" value={draft.settings.android_app_id} onChange={value => updateSetting('android_app_id', value)} placeholder="ca-app-pub-…~…" /><TextField id="admob-publisher" label="Publisher ID" value={draft.settings.publisher_id} onChange={value => updateSetting('publisher_id', value)} placeholder="pub-1234567890123456" /><TextField id="admob-min-version" label="Minimum native versiya" value={draft.settings.min_native_version} onChange={value => updateSetting('min_native_version', value)} placeholder="31.0" note="SDK-sız köhnə build-lər avtomatik olaraq reklam göstərmir." /></div>
        </CardContent></Card>
        <Card><CardContent className="space-y-5 pt-5"><h3 className="font-semibold">Ümumi tezlik və istifadəçi təcrübəsi</h3><div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <NumberField id="ads-startup-delay" label="Başlanğıcda reklamsız vaxt (san.)" value={draft.settings.startup_delay_seconds} min={0} max={3600} onChange={value => updateSetting('startup_delay_seconds', value)} />
          <NumberField id="ads-global-cooldown" label="Tam ekranlar arası fasilə (san.)" value={draft.settings.fullscreen_cooldown_seconds} min={120} max={86400} onChange={value => updateSetting('fullscreen_cooldown_seconds', value)} />
          <NumberField id="ads-fullscreen-session" label="Ümumi tam ekran · sessiya limiti" value={draft.settings.fullscreen_session_cap} min={1} max={20} onChange={value => updateSetting('fullscreen_session_cap', value)} />
          <NumberField id="ads-fullscreen-day" label="Ümumi tam ekran · günlük limit" value={draft.settings.fullscreen_daily_cap} min={1} max={50} onChange={value => updateSetting('fullscreen_daily_cap', value)} />
          <NumberField id="ads-banner-change" label="Banner dəyişmə fasiləsi (san.)" value={draft.settings.banner_change_interval_seconds} min={30} max={3600} onChange={value => updateSetting('banner_change_interval_seconds', value)} />
          <NumberField id="ads-reward-minutes" label="Mükafat · reklamsız dəqiqələr" value={draft.settings.reward_pause_minutes} min={5} max={120} onChange={value => updateSetting('reward_pause_minutes', value)} />
        </div><div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><Label htmlFor="ads-npa">Yalnız fərdiləşdirilməmiş reklamlar (NPA)</Label><p className="mt-1 text-xs text-muted-foreground">UMP razılığı hər iki halda yoxlanır. Tibbi profil, dövr, hamiləlik, körpə və mesaj məlumatları reklam sorğusuna əlavə edilmir.</p></div><Switch id="ads-npa" checked={draft.settings.non_personalized_only} onCheckedChange={value => updateSetting('non_personalized_only', value)} /></div>
          <div className="grid gap-3 md:grid-cols-2">{[tr('ads_rule_premium', 'Premium və ailə Premium-u reklamdan azaddır.'), tr('ads_rule_screens', 'Giriş, onboarding, tibbi alət, hesabat və ödəniş ekranları placement xəritəsindən kənardır.'), tr('ads_rule_banner', 'Klaviatura, modal, tətbiq kilidi və aktiv taymer banneri bağlayır.'), tr('ads_rule_navigation', 'Tam ekran reklamı hazır deyilsə naviqasiya gecikdirilmir.'), tr('ads_rule_reward', 'Rewarded yalnız istifadəçinin düyməsi ilə açılır; bağlama mükafat vermir.'), tr('ads_rule_configuration', 'Konfiqurasiya əlçatan olmayanda yeni reklam göstərilmir.')].map(text => <p key={text} className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />{text}</p>)}</div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="demo" className="space-y-4 pt-2"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><h3 className="font-semibold">İki üsulla baxış</h3><p className="mt-1 text-xs text-muted-foreground">Laboratoriya draftı sınayır. Sayt önizləməsi yadda saxlanmış ayarlarla real ekranlarda işləyir.</p></div><Button variant="outline" onClick={() => startSitePreview(selected)}><ArrowUpRight size={15} className="me-2" />Saytda demo aç</Button></div><AdmobSimulator configuration={draft} selected={selected} onSelect={setSelected} /></TabsContent>
      <TabsContent value="metrics" className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Son 30 gün · tətbiq telemetriyası</h3><p className="mt-1 text-xs text-muted-foreground">Client/SDK hadisələridir; hesablaşma və gəlir göstəricisi deyil. Azure kəsiləndə bu saylar natamam qala bilər; Google AdMob gəlir hesabatı ayrıca işləyir.</p></div><Select value={metricMode} onValueChange={setMetricMode}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Bütün rejimlər</SelectItem><SelectItem value="demo">Yalnız demo</SelectItem><SelectItem value="test">Yalnız test</SelectItem><SelectItem value="live">Yalnız canlı</SelectItem></SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(['requested','impression','reward_earned','failed'] as const).map(event => <Card key={event}><CardContent className="pt-4"><p className="text-2xl font-bold">{metricTotal(event).toLocaleString(getLocaleTag())}</p><p className="text-xs text-muted-foreground">{metricLabels[event]}</p></CardContent></Card>)}</div>
        <Card><CardContent className="overflow-x-auto pt-4"><table className="w-full min-w-[600px] text-xs"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-3">Placement</th>{Object.values(metricLabels).map(label => <th key={label} className="px-2 py-3 text-right">{label}</th>)}</tr></thead><tbody>{placements.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3"><span className="font-medium">{item.title}</span><code className="mt-1 block text-[9px] text-muted-foreground">{item.id}</code></td>{['requested','loaded','impression','skipped','reward_earned','failed'].map(event => <td key={event} className="px-2 text-right tabular-nums">{metrics.filter(row => row.placement_id === item.id && row.event === event).reduce((sum, row) => sum + Number(row.count), 0)}</td>)}</tr>)}</tbody></table></CardContent></Card>
        <a href="https://apps.admob.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary">Gəlir və AdMob hesabatlarını aç<ArrowUpRight size={14} /></a>
      </TabsContent>
      <TabsContent value="setup" className="space-y-4 pt-2">
        <Card><CardContent className="space-y-5 pt-5"><h3 className="font-semibold">Native build hazırlığı</h3><p className="text-sm text-muted-foreground">AdMob SDK/plugin 8.1.0 inteqrasiyası yeni iOS və Android build-ləri ilə çatdırılır. App ID native fayla daxil edilir; sonrakı placement ID-ləri və limitləri bu panel idarə edir.</p>
          <div className="grid gap-4 md:grid-cols-2">{(['ios','android'] as const).map(platform => {
            const entries = active.filter(item => item.platforms.includes(platform));
            const complete = entries.filter(item => isAdUnitId(item[`${platform}_ad_unit_id`]) && !isTestId(item[`${platform}_ad_unit_id`]));
            const appReady = isAppId(draft.settings[`${platform}_app_id`]) && !isTestId(draft.settings[`${platform}_app_id`]);
            return <div className="rounded-xl border p-4" key={platform}><h4 className="font-semibold">{platform === 'ios' ? 'iOS / App Store' : 'Android / Google Play'}</h4><p className="mt-3 flex items-center gap-2 text-xs">{appReady ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-amber-500" />}Canlı App ID: {appReady ? 'hazır' : 'əlavə edilməlidir'}</p><p className="mt-2 text-xs">Aktiv placement ID-ləri: <strong>{complete.length} / {entries.length}</strong></p><p className="mt-3 text-[10px] text-muted-foreground">{platform === 'ios' ? 'Info.plist → GADApplicationIdentifier' : 'AndroidManifest → com.google.android.gms.ads.APPLICATION_ID'}</p></div>;
          })}</div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download('admob-native-config.json', JSON.stringify({ schema: 'anacan-admob-native-v1', configurationRevision: savedConfig.revision,
            mode: savedConfig.settings.mode === 'live' ? 'live' : 'test', iosAppId: savedConfig.settings.ios_app_id || TEST_APP_IDS.ios,
            androidAppId: savedConfig.settings.android_app_id || TEST_APP_IDS.android }, null, 2))}><Download size={15} className="me-2" />Native build konfiqurasiyası</Button><a href="https://apps.admob.com/" target="_blank" rel="noreferrer"><Button variant="outline"><ArrowUpRight size={15} className="me-2" />AdMob konsolu</Button></a></div>
          <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-muted-foreground"><li>AdMob-da mövcud tətbiq üçün iOS və Android app qeydlərini yaradın, App ID-ləri bu panelə daxil edin.</li><li>Aktiv slotların hər platforması üçün uyğun Banner / Interstitial / Rewarded reklam bölməsi yaradın.</li><li>Privacy &amp; messaging bölməsində UMP mesajını konfiqurasiya edin; cihazda razılıq və məxfilik seçimi sınağını edin.</li><li>Yadda saxlanmış native konfiqurasiya ilə yeni build hazırlayın. App ID dəyişərsə yeni native build tələb olunur.</li><li>Google test reklamları ilə yük, no-fill, bağlanma, Premium, taymer və naviqasiya yoxlamalarını tamamlayın.</li><li>Yeni versiyalar mağazalarda əlçatan olduqda paneli uyğun canlı ID-lərlə Live rejiminə keçirin.</li></ol>
        </CardContent></Card>
        <Card><CardContent className="space-y-4 pt-5"><h3 className="font-semibold">app-ads.txt</h3><p className="text-xs text-muted-foreground">Bu sətir Publisher ID-dən yaranır. Mağazada göstərilən developer website domeninin kökündə yayımlanmalıdır. api.anacan.az/app-ads.txt yadda saxlanmış ID-ni təqdim edir.</p><pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs">{appAdsTxt(draft)}</pre><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => download('app-ads.txt', appAdsTxt(draft), 'text/plain')}><Download size={13} className="me-2" />Faylı endir</Button><a href="/app-ads.txt" target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">Serverdə aç<ArrowUpRight size={13} className="ms-1" /></Button></a></div></CardContent></Card>
        <Card><CardContent className="space-y-4 pt-5"><h3 className="font-semibold">Konfiqurasiyanı ixrac / idxal et</h3><p className="text-xs text-muted-foreground">İdxal əvvəlcə drafta yüklənir. Tətbiq etmək üçün Yadda saxla düyməsini istifadə edin.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => download(`anacan-admob-v${draft.revision}.json`, JSON.stringify(draft, null, 2))}><Download size={14} className="me-2" />Draftı JSON endir</Button><Button variant="outline" onClick={() => fileInput.current?.click()}><Upload size={14} className="me-2" />JSON idxal et</Button></div>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="AdMob JSON konfiqurasiyası" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
            try { if (file.size > 65536) throw new Error(); const value = adsConfigurationSchema.parse(JSON.parse(await file.text())); setDraft({ ...value, revision: savedConfig.revision }); setDirty(true); toast.success('JSON drafta yükləndi.'); }
            catch { toast.error('Fayl uyğun AdMob konfiqurasiyası deyil.'); }
          }} />
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="history" className="space-y-4 pt-2"><div><h3 className="font-semibold">Versiyalı dəyişiklik tarixçəsi</h3><p className="mt-1 text-xs text-muted-foreground">Bərpa əvvəlki ayarları yeni versiya kimi saxlayır. Paralel redaktə avtomatik əzilmədən dayandırılır.</p></div>
        {!admin.data?.history.length ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Hələ operator dəyişikliyi yoxdur. İlk yadda saxlamadan sonra tarixçə yaranacaq.</CardContent></Card> :
          <Card><CardContent className="divide-y pt-2">{admin.data.history.map(item => <div key={item.revision} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">V{item.revision}</strong><span className="ms-3 text-xs text-muted-foreground">{new Date(item.changed_at).toLocaleString(getLocaleTag())}</span><p className="mt-1 text-[10px] text-muted-foreground">Operator: {item.actor ? `${item.actor.slice(0, 8)}…` : 'Sistem / əvvəlki hesab'}</p></div><Button variant="outline" size="sm" disabled={busy || dirty || item.revision === savedConfig.revision} onClick={async () => {
            try { const result = await admin.restore.mutateAsync({ revision: item.revision, expected: savedConfig.revision }); setDraft(result.configuration); setDirty(false); announceUpdate(result, formatTr('ads_restored_version', 'V{previous} ayarları V{revision} kimi bərpa edildi.', { previous: item.revision, revision: result.configuration.revision })); } catch (error) { toast.error(errorText(error)); }
          }}>Bu versiyanı bərpa et</Button></div>)}</CardContent></Card>}
      </TabsContent>
    </Tabs>
  </div>;
}
