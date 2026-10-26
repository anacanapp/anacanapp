import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Copy, Image, Loader2, Mail, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/hooks/use-toast';
import { APP_LANGUAGES, appLanguageLocale } from '@/lib/app-languages';
import { AD_REASONS, moderationError, moderationReason, type AdReviewDetail, type AdReviewQueue, type AdReviewState } from '@/lib/community-moderation';
import { moderationText, type ModerationCopyKey } from '@/lib/community-moderation-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isRtlLang } from '@/lib/rtl';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const states: AdReviewState[] = ['review', 'checking', 'approved', 'rejected', 'superseded', 'withdrawn'];
const selectClass = 'min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm';
function initialCase() { const value = new URL(window.location.href).searchParams.get('case'); return value && UUID.test(value) ? value : null; }
function mediaUrl(value: string) {
  try {
    const url = new URL(value), origins = [new URL(getBackendConfig().url).origin, 'https://tntbjulojatnrqmylorp.supabase.co'];
    return url.protocol === 'https:' && !url.username && !url.password && origins.includes(url.origin)
      && /^\/storage\/v1\/object\/(public|sign)\/community-media\//.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
function stateBadge(state: AdReviewState, language: string) {
  return <Badge variant={state === 'rejected' ? 'destructive' : state === 'approved' ? 'secondary' : 'outline'} className="max-w-full whitespace-normal leading-relaxed">
    {moderationText(`status_${state}`, language)}</Badge>;
}

function CaseEditor({ detail, onRefresh, moderator = false }: { detail: AdReviewDetail; onRefresh: () => void; moderator?: boolean }) {
  const language = useUserStore(state => state.language), t = (key: ModerationCopyKey) => moderationText(key, language);
  const { user } = useAuth(), client = useQueryClient(), { toast } = useToast(), backend = getBackendConfig().url;
  const cachePrefix = moderator ? 'moderator-ad' : 'community-ad';
  const [reason, setReason] = useState(detail.decision_reason || detail.assessment?.reasons?.find(value => AD_REASONS.includes(value as typeof AD_REASONS[number])) || 'uncertain');
  const [note, setNote] = useState(detail.moderator_note || '');
  const request = useRef<{ key: string; id: string } | null>(null);
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const decide = useMutation({
    mutationFn: async (action: 'approve' | 'reject' | 'retry') => {
      const selectedReason = action === 'approve' ? 'not_advertising' : reason;
      const values = { p_id: detail.id, p_revision: detail.revision, p_updated_at: detail.updated_at, p_action: action, p_reason: selectedReason, p_note: note.trim() };
      const key = JSON.stringify(values);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      const { data, error } = await (supabase as any).rpc(moderator ? 'moderator_ad_decide_v1' : 'admin_community_ad_decide_v1', { ...values, p_request: request.current.id });
      if (error) throw error;
      return data as AdReviewDetail;
    },
    onSuccess: data => {
      client.setQueryData([`${cachePrefix}-case`, backend, user?.id, detail.id], data);
      void client.invalidateQueries({ queryKey: [`${cachePrefix}-queue`, backend, user?.id] });
      void client.invalidateQueries({ queryKey: ['moderator-data'] });
      void client.invalidateQueries({ queryKey: ['community-ad-mine'] });
      toast({ title: t('action_saved') });
    },
    onError: error => toast({ title: moderationError(error, language), variant: 'destructive' }),
  });
  const retryDelivery = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).rpc(moderator ? 'moderator_retry_ad_delivery_v1' : 'admin_retry_community_ad_delivery_v1', { p_id: id }); if (error) throw error; },
    onSuccess: onRefresh,
    onError: () => toast({ title: t('action_failed'), variant: 'destructive' }),
  });
  const canDecide = detail.current && !['superseded', 'withdrawn'].includes(detail.state);
  return <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]" data-testid="ad-moderation-case" data-case-state={detail.state}>
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-2">{stateBadge(detail.state, language)}
        <Badge variant="outline">{APP_LANGUAGES.find(item => item.code === detail.language)?.native_name || '—'}</Badge>
        {detail.payload.is_anonymous && <Badge variant="outline">{t('anonymous')}</Badge>}</div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted-foreground">{t('author')}</dt><dd className="font-medium break-words">{detail.author_name || '—'}</dd></div>
        <div><dt className="text-muted-foreground">{t('version')}</dt><dd>{detail.revision}</dd></div>
        <div><dt className="text-muted-foreground">{t('created')}</dt><dd>{formatDate(detail.created_at)}</dd></div>
        <div><dt className="text-muted-foreground">{t('reviewed')}</dt><dd>{formatDate(detail.reviewed_at)}</dd></div>
      </dl>
      <section><h3 className="font-semibold mb-2">{t('content')}</h3><p className="rounded-xl border bg-muted/30 p-4 whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]" dir="auto">{detail.payload.content}</p></section>
      <section><h3 className="font-semibold mb-2">{t('media')}</h3>
        {!detail.payload.media_urls?.length ? <p className="text-sm text-muted-foreground">{t('no_media')}</p> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {detail.payload.media_urls.map((value, index) => { const url = mediaUrl(value); return <div key={`${index}:${value}`} className="min-w-0 rounded-xl border overflow-hidden bg-muted/30">
            {!url ? <p className="p-4 text-sm">{t('media_unavailable')}</p> : /\.(mp4|mov|webm)(?:\?|$)/i.test(url)
              ? <video controls preload="metadata" src={url} className="w-full max-h-80" aria-label={`${t('media')} ${index + 1}`} />
              : <img src={url} alt={`${t('media')} ${index + 1}`} className="w-full max-h-80 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
          </div>; })}
        </div>}
        {detail.assessment?.mediaComplete === false && <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">{t('media_unavailable')}</p>}
      </section>
      <section className="rounded-2xl border p-4 space-y-3"><h3 className="font-semibold">{t('signals')}</h3>
        <div className="flex items-baseline justify-between gap-3"><span className="text-sm">{t('risk')}</span><strong className="text-xl tabular-nums">{detail.assessment?.score == null ? '—' : `${detail.assessment.score}/100`}</strong></div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('risk_note')}</p>
        <div className="flex flex-wrap gap-2">{detail.assessment?.reasons.map(value => <Badge key={value} variant="outline" className="whitespace-normal">{moderationReason(value, language)}</Badge>)}</div>
        {!!detail.assessment?.evidence?.length && <div><h4 className="text-sm font-medium mb-2">{t('evidence')}</h4>{detail.assessment.evidence.map((value, index) => <blockquote key={index} className="border-s-2 border-primary ps-3 text-sm my-2 break-words" dir="auto">{value}</blockquote>)}</div>}
        {!!detail.assessment?.visualEvidence?.length && <div><h4 className="text-sm font-medium mb-2">{t('visual_evidence')}</h4>{detail.assessment.visualEvidence.map((value, index) => <p key={index} className="rounded-lg bg-muted/50 p-2 text-sm my-2 break-words" dir="auto">{value}</p>)}</div>}
        <p className="text-xs text-muted-foreground break-words">{t('engine')}: {detail.assessment?.policyVersion || '—'} {detail.assessment?.model || ''}</p>
        <p className="text-xs text-muted-foreground">{t('attempts')}: {detail.attempts}</p>
        {detail.last_error && <p className="text-xs break-words text-amber-700 dark:text-amber-300">{t('reason_check_unavailable')} · {detail.last_error}</p>}
      </section>
    </div>
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border p-4 space-y-4"><h3 className="font-semibold">{t('decision')}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('full_context')}</p>
        {!canDecide ? <p className="text-sm">{t('post_changed')}</p> : <>
          <label className="block space-y-2"><span className="text-sm font-medium">{t('reason')}</span><select value={reason} onChange={event => setReason(event.target.value)} className={selectClass} disabled={decide.isPending}>
            {AD_REASONS.map(value => <option key={value} value={value}>{moderationReason(value, language)}</option>)}</select></label>
          <label className="block space-y-2"><span className="text-sm font-medium">{t('note')}</span><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} className="min-h-24" disabled={decide.isPending} />
            <span className="block text-xs text-muted-foreground">{t('note_hint')}</span></label>
          <div className="flex flex-col gap-2">
            <Button className="min-h-11 h-auto whitespace-normal py-3" disabled={decide.isPending || detail.state === 'approved'} onClick={() => decide.mutate('approve')}><CheckCircle2 size={17} className="shrink-0" />{t('approve')}</Button>
            <Button variant="destructive" className="min-h-11 h-auto whitespace-normal py-3" disabled={decide.isPending || detail.state === 'rejected' || reason === 'not_advertising'} onClick={() => decide.mutate('reject')}><XCircle size={17} className="shrink-0" />{t('reject')}</Button>
            <Button variant="outline" className="min-h-11 h-auto whitespace-normal py-3" disabled={decide.isPending} onClick={() => decide.mutate('retry')}><RefreshCw size={17} className="shrink-0" />{t('retry')}</Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('publication_note')}</p><p className="text-xs text-muted-foreground">{t('retry_note')}</p>
        </>}
        {decide.isError && <Button variant="outline" className="min-h-11" onClick={onRefresh}><RefreshCw size={16} />{t('refresh')}</Button>}
      </section>
      <section className="rounded-2xl border p-4 space-y-3"><h3 className="font-semibold">{t('notifications')}</h3><p className="text-xs text-muted-foreground leading-relaxed">{t('inbox_note')}</p>
        {detail.deliveries.map(item => <div className="rounded-xl bg-muted/40 p-3 space-y-2 text-sm" key={item.id}>
          <div className="flex items-start justify-between gap-2"><span>{t(item.channel)}</span><Badge variant="outline" className="whitespace-normal text-end">{t(`delivery_${item.state}`)}</Badge></div>
          <p className="text-xs text-muted-foreground">{t('attempts')}: {item.attempts}</p>
          {item.error_code && <p className="text-xs text-muted-foreground break-words">{item.error_code}</p>}
          {item.state === 'unknown' && <p className="text-xs leading-relaxed">{t('unknown_delivery_note')}</p>}
          {item.state === 'failed' && <Button variant="outline" size="sm" className="min-h-11 h-auto whitespace-normal" disabled={retryDelivery.isPending} onClick={() => retryDelivery.mutate(item.id)}>{t('retry_delivery')}</Button>}
        </div>)}
      </section>
      <section><h3 className="font-semibold mb-3">{t('history')}</h3><ol className="space-y-3">
        {detail.events.map(event => <li key={event.id} className="border-s-2 ps-3 text-sm space-y-1">
          <p className="font-medium">{t(`event_${event.event}` as ModerationCopyKey)}</p><time className="text-xs text-muted-foreground">{formatDate(event.created_at)}</time>
          {!event.actor_id && <p className="text-xs text-muted-foreground">{t('automatic')}</p>}
          {event.detail.reason && <p className="text-xs">{moderationReason(event.detail.reason, language)}</p>}
          {event.detail.note && <p className="text-xs whitespace-pre-wrap break-words">{event.detail.note}</p>}
        </li>)}
      </ol></section>
    </div>
  </div>;
}

export default function AdModerationWorkspace({ moderator = false }: { moderator?: boolean }) {
  const { user, isAdmin, isModerator } = useAuth(), language = useUserStore(state => state.language), { toast } = useToast();
  const allowed = moderator ? isAdmin || isModerator : isAdmin, cachePrefix = moderator ? 'moderator-ad' : 'community-ad';
  const backend = getBackendConfig().url, t = (key: ModerationCopyKey) => moderationText(key, language);
  const [status, setStatus] = useState('review'), [filterLanguage, setFilterLanguage] = useState('all'), [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all'), [page, setPage] = useState(0), [selected, setSelected] = useState<string | null>(initialCase);
  const since = useMemo(() => period === 'all' ? null : new Date(Date.now() - (period === 'week' ? 7 : 30) * 86400000).toISOString(), [period]);
  const query = useQuery({
    queryKey: [`${cachePrefix}-queue`, backend, user?.id, status, filterLanguage, search, since, page], enabled: !!user && allowed,
    meta: { persist: false },
    refetchInterval: 20000,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc(moderator ? 'moderator_ad_queue_v1' : 'admin_community_ad_queue_v1', { p_state: status, p_language: filterLanguage === 'all' ? null : filterLanguage,
        p_search: search.trim(), p_since: since, p_limit: 25, p_offset: page * 25 }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data?.items) || typeof data.total !== 'number') throw new Error('MODERATION_INVALID_RESPONSE');
      return data as AdReviewQueue;
    },
  });
  const detail = useQuery({
    queryKey: [`${cachePrefix}-case`, backend, user?.id, selected], enabled: !!user && allowed && !!selected,
    meta: { persist: false },
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc(moderator ? 'moderator_ad_case_v1' : 'community_ad_case_v1', { p_id: selected }).abortSignal(signal); if (error) throw error; return data as AdReviewDetail | null; },
  });
  const choose = (id: string | null) => {
    setSelected(id); const url = new URL(window.location.href);
    if (id) url.searchParams.set('case', id); else url.searchParams.delete('case');
    window.history.replaceState(window.history.state, '', url);
  };
  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(0); };
  const recentWorker = !!query.data?.worker && Date.now() - Date.parse(query.data.worker.last_seen_at) < 5 * 60000;
  const stats = [{ key: 'review', label: 'pending_count', Icon: ShieldCheck }, { key: 'checking', label: 'checking_count', Icon: Clock3 },
    { key: 'approved', label: 'approved_count', Icon: CheckCircle2 }, { key: 'rejected', label: 'rejected_count', Icon: XCircle }] as const;
  return <div className="space-y-6 min-w-0" dir={isRtlLang(language) ? 'rtl' : 'ltr'} data-testid="ad-moderation-page">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl min-w-0"><h1 className="text-2xl font-bold flex items-center gap-3"><ShieldCheck className="text-primary shrink-0" />{t('title')}</h1>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t('description')}</p></div>
      <Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />{t('refresh')}</Button></header>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{stats.map(({ key, label, Icon }) => <button key={key} onClick={() => { setStatus(key); setPage(0); }}
      className={`min-w-0 rounded-2xl border p-4 text-start transition-colors ${status === key ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'}`}>
      <Icon size={19} className="text-primary mb-2" /><strong className="block text-2xl tabular-nums">{query.data ? new Intl.NumberFormat(appLanguageLocale(language)).format(query.data.stats[key]) : '—'}</strong>
      <span className="text-xs leading-relaxed block mt-1 text-muted-foreground">{t(label)}</span></button>)}</div>
    <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm"><p className="flex items-start gap-2"><Mail size={17} className="shrink-0 text-primary mt-0.5" />{t('email_destination')}</p>
      <p className={`flex items-start gap-2 ${recentWorker ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300'}`}>
        <AlertCircle size={17} className="shrink-0 mt-0.5" />{t(recentWorker ? 'worker_ready' : 'worker_stale')}</p>
      {query.data?.worker && <p className="text-xs text-muted-foreground">{t('last_worker')}: {new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(query.data.worker.last_seen_at))}</p>}
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t('filter_status')}</span><select className={selectClass} value={status} onChange={event => filter(setStatus)(event.target.value)}><option value="all">{t('all')}</option>{states.map(value => <option key={value} value={value}>{t(`status_${value}`)}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t('language')}</span><select className={selectClass} value={filterLanguage} onChange={event => filter(setFilterLanguage)(event.target.value)}><option value="all">{t('all_languages')}</option>{APP_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native_name}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t('filter_period')}</span><select className={selectClass} value={period} onChange={event => filter(setPeriod)(event.target.value)}><option value="all">{t('all_time')}</option><option value="week">{t('last_week')}</option><option value="month">{t('last_month')}</option></select></label>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t('search')}</span><div className="relative"><Search className="absolute start-3 top-3.5 text-muted-foreground" size={16} /><Input value={search} onChange={event => filter(setSearch)(event.target.value)} maxLength={200} className="min-h-11 ps-9 rounded-xl" /></div></label>
    </div>
    {query.isError ? <div className="rounded-2xl border p-6" role="alert">{moderationError(query.error, language)}</div>
      : query.isPending ? <div className="flex justify-center gap-2 py-12" role="status"><Loader2 className="animate-spin" />{t('loading')}</div>
      : !query.data?.items.length ? <div className="rounded-2xl border bg-card text-center py-12 px-5"><ShieldCheck className="mx-auto mb-3 text-muted-foreground" size={36} /><p>{t('empty')}</p></div>
      : <div className="space-y-3">{query.data.items.map(item => <button type="button" key={item.id} onClick={() => choose(item.id)} className="w-full min-w-0 rounded-2xl border bg-card p-4 sm:p-5 text-start hover:border-primary/50 focus-visible:outline-primary" data-testid="ad-moderation-item">
        <div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap items-center gap-2">{stateBadge(item.state, language)}<Badge variant="outline">{item.language?.toUpperCase() || '—'}</Badge>{item.is_anonymous && <Badge variant="outline">{t('anonymous')}</Badge>}</div>
          <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.created_at))}</span></div>
        <p className="text-sm font-semibold mt-3">{item.author_name || '—'}</p><p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap break-words line-clamp-4 [overflow-wrap:anywhere]" dir="auto">{item.preview}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-3"><span>{t('case_id')}: {item.id.slice(0, 8)}</span>{item.media_count > 0 && <span className="inline-flex items-center gap-1"><Image size={14} />{item.media_count}</span>}
          {item.score != null && <span>{t('risk')}: {item.score}/100</span>}</div>
        {!!item.reasons?.length && <p className="text-xs text-primary mt-2 leading-relaxed">{item.reasons.map(reason => moderationReason(reason, language)).join(' · ')}</p>}
      </button>)}</div>}
    {query.data && <footer className="flex flex-wrap justify-between items-center gap-3 text-sm"><span>{t('total')}: {query.data.total}</span><div className="flex gap-2"><Button variant="outline" className="min-h-11" disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)}>{t('previous')}</Button>
      <Button variant="outline" className="min-h-11" disabled={(page + 1) * 25 >= query.data.total || query.isFetching} onClick={() => setPage(value => value + 1)}>{t('next')}</Button></div></footer>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) choose(null); }}><DialogContent className="max-w-6xl w-[calc(100%-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto p-4 sm:p-6" dir={isRtlLang(language) ? 'rtl' : 'ltr'}>
      <DialogHeader className="text-start pe-7"><DialogTitle>{t('details')}</DialogTitle><DialogDescription className="flex flex-wrap items-center gap-2 break-all">{selected}
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={t('copy_case')} onClick={() => { if (selected) void navigator.clipboard.writeText(selected).then(() => toast({ title: t('copied') })).catch(() => {}); }}><Copy size={15} /></Button></DialogDescription></DialogHeader>
      {detail.isPending ? <div role="status" className="flex items-center gap-2 py-8"><Loader2 className="animate-spin" />{t('loading')}</div> : detail.isError ? <div role="alert" className="space-y-3"><p>{t('load_failed')}</p><Button onClick={() => void detail.refetch()}>{t('refresh')}</Button></div>
        : detail.data ? <CaseEditor key={`${detail.data.id}:${detail.data.updated_at}`} detail={detail.data} moderator={moderator} onRefresh={() => void detail.refetch()} /> : <p>{t('empty')}</p>}
    </DialogContent></Dialog>
  </div>;
}
