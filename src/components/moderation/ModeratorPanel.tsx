import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, FileText, Globe, History, LayoutDashboard, Loader2, MessageSquare, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useModeratorAccess, useModeratorMutation, useModeratorQuery } from '@/hooks/useModerator';
import { moderatorText, type ModeratorTextKey } from '@/lib/moderator-i18n';
import { moderatorError, moderatorReason, MODERATOR_REASONS, type ModeratorAction, type ModeratorContent, type ModeratorKind, type ModeratorPage, type ModeratorTarget } from '@/lib/moderator';
import { APP_LANGUAGES, appLanguageLocale } from '@/lib/app-languages';
import { isRtlLang } from '@/lib/rtl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ModeratorActionMenu from './ModeratorActionMenu';
import ModeratorActionDialog from './ModeratorActionDialog';
import AdModerationWorkspace from './AdModerationWorkspace';
import ModeratorMedia from './ModeratorMedia';
import '@/styles/moderator.css';

const sections = [
  { id: 'overview', Icon: LayoutDashboard }, { id: 'tasks', Icon: ClipboardList }, { id: 'ads', Icon: ShieldCheck }, { id: 'content', Icon: FileText },
  { id: 'users', Icon: Users }, { id: 'restrictions', Icon: ShieldAlert }, { id: 'warnings', Icon: MessageSquare }, { id: 'appeals', Icon: MessageSquare },
  { id: 'network', Icon: Globe }, { id: 'audit', Icon: History },
] as const;
type Section = typeof sections[number]['id'];
const selectClass = 'min-h-11 w-full rounded-xl border bg-background px-3 text-sm';

function UserDetail({ userId }: { userId: string }) {
  const language = useUserStore(state => state.language), t = (key: ModeratorTextKey) => moderatorText(key, language);
  const { user } = useAuth(), backend = getBackendConfig().url;
  const restrictions = useModeratorQuery('restrictions', { user_id: userId }), warnings = useModeratorQuery('warnings', { user_id: userId }), history = useModeratorQuery('audit', { user_id: userId });
  const network = useQuery({ queryKey: ['moderator-network-user', backend, user?.id, userId], meta: { persist: false },
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('moderator_user_network_v1', { p_user: userId }).abortSignal(signal); if (error) throw error; return data as { mode: string; items: any[] }; } });
  const [target, setTarget] = useState<ModeratorTarget | null>(null), [action, setAction] = useState<ModeratorAction | null>(null);
  const [ipReason, setIpReason] = useState('spam'), [ipDuration, setIpDuration] = useState('86400'), [ipNote, setIpNote] = useState('');
  const mutation = useModeratorMutation(() => void network.refetch());
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">{(['warn', 'restrict'] as const).map(value => <Button key={value} variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={() => { setTarget({ kind: 'user', id: userId, userId }); setAction(value); }}>{t(value)}</Button>)}</div>
    <section><h3 className="font-semibold mb-2">{t('user_restrictions')}</h3>{restrictions.data?.items.map(row => <div key={row.id} className="moderator-card flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">{t(`scope_${row.scope}` as ModeratorTextKey)}</p><p className="text-sm text-muted-foreground">{moderatorReason(row.reason, language)}</p><Badge variant="outline">{t(row.state)}</Badge></div>
      {row.state === 'active' && <Button variant="outline" className="min-h-11" onClick={() => { setTarget({ kind: 'user', id: userId, userId, restrictionId: row.id, legacy: row.legacy }); setAction('unrestrict'); }}>{t('unrestrict')}</Button>}
    </div>)}{!restrictions.data?.items.length && <p className="text-sm text-muted-foreground">{t('empty')}</p>}</section>
    <section><h3 className="font-semibold mb-2">{t('user_warnings')}</h3>{warnings.data?.items.map(row => <div className="moderator-card text-sm space-y-2" key={row.id}><p>{moderatorReason(row.reason, language)}</p><p className="whitespace-pre-wrap break-words">{row.public_detail}</p><Badge variant="outline">{t(row.acknowledged_at ? 'warning_acknowledged' : 'warning_pending')}</Badge></div>)}</section>
    <section className="moderator-card space-y-3"><h3 className="font-semibold">{t('ip_title')}</h3><p className="text-sm text-muted-foreground leading-relaxed">{t('ip_description')}</p>
      {network.data?.mode !== 'enforce' && <p className="text-sm text-amber-700 dark:text-amber-300">{t('ip_unavailable')}</p>}
      {!network.data?.items.length ? <p className="text-sm text-muted-foreground">{t('ip_no_observation')}</p> : <>
        <p className="text-xs text-muted-foreground">{t('ip_scope_hint')}</p>
        <label className="block"><span className="text-xs">{t('reason')}</span><select value={ipReason} onChange={event => setIpReason(event.target.value)} className={selectClass}>{MODERATOR_REASONS.map(value => <option key={value} value={value}>{moderatorReason(value, language)}</option>)}</select></label>
        <label className="block"><span className="text-xs">{t('duration')}</span><select value={ipDuration} onChange={event => setIpDuration(event.target.value)} className={selectClass}>{[['900', '15m'], ['3600', '1h'], ['86400', '1d'], ['604800', '7d']].map(([value, label]) => <option key={value} value={value}>{t(`duration_${label}` as ModeratorTextKey)}</option>)}</select></label>
        <Textarea aria-label={t('note')} value={ipNote} onChange={event => setIpNote(event.target.value)} maxLength={2000} rows={2} />
        {network.data.items.map(row => <div className="rounded-xl bg-muted/50 p-3 space-y-2" key={row.id}><code className="text-sm break-all">{row.address}</code><p className="text-xs text-muted-foreground">{t('ip_observed')}: {new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.last_seen_at))}</p>
          <Button variant="destructive" className="h-auto min-h-11 whitespace-normal" disabled={mutation.isPending || network.data.mode !== 'enforce'} onClick={() => mutation.mutate({ rpc: 'moderator_ip_action_v1', args: { p_action: 'ip_block', p_observation: row.id, p_rule: null, p_seconds: Number(ipDuration), p_reason: ipReason, p_note: ipNote, p_request: crypto.randomUUID() } })}>{t('ip_block')}</Button></div>)}
      </>}
    </section>
    <section><h3 className="font-semibold mb-2">{t('user_history')}</h3>{history.data?.items.map(row => <div key={row.id} className="border-s-2 ps-3 py-2 text-sm"><p className="font-medium">{t(`action_${row.action}` as ModeratorTextKey)}</p><p>{moderatorReason(row.reason, language)}</p><p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{row.note}</p></div>)}</section>
    <ModeratorActionDialog target={target} action={action} onClose={() => { setTarget(null); setAction(null); }} />
  </div>;
}

export default function ModeratorPanel({ onBack }: { onBack: () => void }) {
  const language = useUserStore(state => state.language), t = (key: ModeratorTextKey) => moderatorText(key, language);
  const { user, isModerator, isAdmin } = useAuth(), access = useModeratorAccess(), backend = getBackendConfig().url;
  const [section, setSection] = useState<Section>('overview'), [search, setSearch] = useState(''), [filterState, setFilterState] = useState('all'), [page, setPage] = useState(0), [mine, setMine] = useState(false);
  const [contentKind, setContentKind] = useState<'post' | 'comment' | 'story'>('post'), [contentLanguage, setContentLanguage] = useState('all'), [contentState, setContentState] = useState('active');
  const [userId, setUserId] = useState<string | null>(null), [dialogTarget, setDialogTarget] = useState<ModeratorTarget | null>(null), [dialogAction, setDialogAction] = useState<ModeratorAction | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null), [task, setTask] = useState<any>(null), [taskNote, setTaskNote] = useState(''), [appealReply, setAppealReply] = useState('');
  const summary = useModeratorQuery('overview', {}, 0, section === 'overview');
  const rows = useModeratorQuery(section === 'ads' || section === 'content' || section === 'network' || section === 'overview' ? 'tasks' : section,
    { search, state: filterState, ...(section === 'tasks' ? { mine } : {}) }, page, !['overview', 'content', 'ads', 'network'].includes(section));
  const content = useQuery({ queryKey: ['moderator-content-list', backend, user?.id, contentKind, contentLanguage, contentState, search, page], enabled: section === 'content' && access.data?.allowed === true, meta: { persist: false },
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('moderator_content_query_v1', { p_kind: contentKind, p_language: contentKind === 'post' && contentLanguage !== 'all' ? contentLanguage : null, p_search: search, p_user: null, p_removed: contentState === 'all' ? null : contentState === 'removed', p_limit: 25, p_offset: page * 25 }).abortSignal(signal); if (error) throw error; return data as ModeratorPage<ModeratorContent>; } });
  const network = useQuery({ queryKey: ['moderator-ip-rules', backend, user?.id, page], enabled: section === 'network' && access.data?.allowed === true, meta: { persist: false },
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('moderator_ip_rules_v1', { p_limit: 25, p_offset: page * 25 }).abortSignal(signal); if (error) throw error; return data as ModeratorPage & { mode: string }; } });
  const audit = useQuery({ queryKey: ['moderator-audit-detail', backend, user?.id, auditId], enabled: !!auditId && access.data?.allowed === true, meta: { persist: false },
    queryFn: async () => { const { data, error } = await (supabase as any).rpc('moderator_action_detail_v1', { p_id: auditId }); if (error) throw error; return data; } });
  const mutation = useModeratorMutation(() => { setTask(null); setAppealReply(''); });
  const navigate = (next: Section) => { setSection(next); setSearch(''); setFilterState('all'); setPage(0); };
  const formatDate = (date?: string | null) => date ? new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date)) : t('duration_permanent');
  const stateOptions: string[] = section === 'tasks' ? ['open', 'assigned', 'resolved', 'escalated'] : section === 'restrictions' ? ['active', 'expired', 'revoked'] : section === 'warnings' ? ['pending', 'acknowledged'] : section === 'appeals' ? ['open', 'answered'] : [];
  const stateLabel = (value: string) => t(({ open: 'unassigned', pending: 'warning_pending', acknowledged: 'warning_acknowledged', answered: 'resolved' } as Record<string, ModeratorTextKey>)[value] || value as ModeratorTextKey);
  const actionForTask = (row: any, action: string) => mutation.mutate({ rpc: 'moderator_task_action_v1', args: { p_id: row.task_id || row.id, p_revision: row.task_revision || row.revision, p_action: action, p_note: taskNote, p_reply: appealReply, p_request: crypto.randomUUID() } });
  const current = section === 'content' ? content : section === 'network' ? network : rows;
  const stats = summary.data as unknown as Record<string, number> | undefined;
  if (!user || !isModerator && !isAdmin) return <div className="a-scope min-h-screen grid place-content-center p-6 gap-4 text-center"><ShieldCheck className="mx-auto" /><p>{t('moderator_required')}</p><Button onClick={onBack}>{t('back_app')}</Button></div>;
  if (access.isPending) return <div className="a-scope min-h-screen grid place-content-center gap-3" role="status"><Loader2 className="animate-spin mx-auto" />{t('loading')}</div>;
  if (access.isError || !access.data?.allowed) return <div className="a-scope min-h-screen grid place-content-center p-6 gap-4 text-center"><p role="alert">{access.isError ? moderatorError(access.error, language) : t('moderator_required')}</p><Button onClick={() => void access.refetch()}>{t('refresh')}</Button><Button variant="outline" onClick={onBack}>{t('back_app')}</Button></div>;
  return <div className="a-scope moderator-shell" dir={isRtlLang(language) ? 'rtl' : 'ltr'} data-ad-block="true" data-testid="moderator-panel">
    <header className="moderator-header"><Button variant="ghost" size="icon" aria-label={t('back_app')} onClick={onBack}><ArrowLeft className="rtl:rotate-180" /></Button><div className="min-w-0 flex-1"><h1>{t('title')}</h1><p>{t('description')}</p></div><ShieldCheck className="text-primary shrink-0" size={27} /></header>
    <div className="moderator-layout"><nav className="moderator-nav" aria-label={t('title')}>{sections.map(({ id, Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={section === id ? 'page' : undefined} className={section === id ? 'is-active' : ''}><Icon size={17} /><span>{t(id)}</span></button>)}</nav>
      <main className="moderator-main" data-testid="moderator-main"><div className="moderator-inner">
        {section === 'ads' ? <AdModerationWorkspace moderator /> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><h2 className="text-xl font-bold">{t(section)}</h2><Button variant="outline" className="min-h-11" onClick={() => { void access.refetch(); void summary.refetch(); void current.refetch(); }}><RefreshCw size={16} />{t('refresh')}</Button></div>
          {section === 'overview' ? <><div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{(['tasks', 'assigned', 'restrictions', 'warnings', 'appeals'] as const).map(key => <button className="moderator-card text-start" key={key} onClick={() => { navigate(key === 'assigned' ? 'tasks' : key); setMine(key === 'assigned'); }}><span className="block text-3xl font-bold text-primary">{stats?.[key] ?? '—'}</span><span className="text-sm text-muted-foreground">{t(key === 'assigned' ? 'my_tasks' : key)}</span></button>)}</div><div className="moderator-card mt-5 text-sm leading-relaxed"><ShieldCheck className="text-primary mb-2" />{t('description')}</div></> : <>
            {section !== 'network' && <div className="flex flex-wrap gap-3 mb-4"><div className="relative flex-1 min-w-[160px]"><Search size={16} className="absolute start-3 top-3.5 text-muted-foreground" /><Input aria-label={t('search')} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="min-h-11 ps-9" maxLength={200} /></div>
              {!!stateOptions.length && <select className="min-h-11 border rounded-xl bg-background px-3 text-sm max-w-full" aria-label={t('status')} value={filterState} onChange={event => { setFilterState(event.target.value); setPage(0); }}><option value="all">{t('all')}</option>{stateOptions.map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select>}
              {section === 'tasks' && <Button variant={mine ? 'default' : 'outline'} className="min-h-11 h-auto whitespace-normal" onClick={() => { setMine(value => !value); setPage(0); }}>{t('my_tasks')}</Button>}
            </div>}
            {section === 'content' && <div className="grid sm:grid-cols-3 gap-3 mb-4"><select className={selectClass} aria-label={t('content')} value={contentKind} onChange={event => { setContentKind(event.target.value as typeof contentKind); setPage(0); }}>{(['post', 'comment', 'story'] as const).map(kind => <option key={kind} value={kind}>{t(kind)}</option>)}</select>
              <select className={selectClass} aria-label={t('language')} value={contentLanguage} disabled={contentKind !== 'post'} onChange={event => { setContentLanguage(event.target.value); setPage(0); }}><option value="all">{t('all_languages')}</option>{APP_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.native_name}</option>)}</select>
              <select className={selectClass} aria-label={t('status')} value={contentState} onChange={event => { setContentState(event.target.value); setPage(0); }}><option value="active">{t('active')}</option><option value="removed">{t('removed_marker')}</option><option value="all">{t('all')}</option></select></div>}
            {section === 'network' && <div className="moderator-card mb-4 space-y-2 text-sm"><p>{t('ip_description')}</p><p className="font-semibold">{t(network.data?.mode === 'enforce' ? 'network_active' : 'network_pending')}</p><p className="text-muted-foreground">{t('ip_duration_hint')}</p></div>}
            {current.isPending ? <div className="flex items-center justify-center gap-2 py-12" role="status"><Loader2 className="animate-spin" />{t('loading')}</div> : current.isError ? <p role="alert" className="moderator-card">{moderatorError(current.error, language)}</p> : !current.data?.items?.length ? <p className="moderator-card py-12 text-center text-muted-foreground">{t('empty')}</p> : <div className="space-y-3">
              {current.data.items.map((item: any) => <article className="moderator-card" key={item.id || item.user_id}>
                {section === 'content' ? <><div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="font-semibold text-sm">{item.user_name || t('user')}</p><p className="text-xs text-muted-foreground mt-1">{formatDate(item.created_at)}</p></div><ModeratorActionMenu target={{ kind: contentKind, id: item.id, userId: item.user_id, name: item.user_name, content: item.content || item.text_overlay, version: item.moderation_version || 0, isPinned: !!item.is_pinned, removed: !!item.moderation_removed_at, commentsLocked: !!item.comments_locked }} /></div>
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mt-3 [overflow-wrap:anywhere]" dir="auto">{item.content || item.text_overlay || t('story')}</p>
                  {!!item.moderation_removed_at && <Badge variant="destructive" className="mt-2">{t('removed_marker')}</Badge>}{item.is_pinned && <Badge variant="outline" className="mt-2 ms-2">{t('pin')}</Badge>}
                  <ModeratorMedia content={item} />
                </> : section === 'users' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.name || t('user')}</p><p className="text-xs text-muted-foreground mt-1">{item.language?.toUpperCase()} · {t('user_restrictions')}: {item.active_restrictions}</p></div><Button variant="outline" className="min-h-11" onClick={() => setUserId(item.user_id)}>{t('details')}</Button></div>
                  : section === 'tasks' ? <><div className="flex flex-wrap justify-between gap-2"><Badge variant="outline">{t(item.source_kind === 'advert' ? 'ads' : item.source_kind === 'appeal' ? 'appeals' : 'reports')}</Badge><Badge variant="outline">{stateLabel(item.state)}</Badge></div><p className="text-sm mt-3 whitespace-pre-wrap break-words">{item.summary}</p><p className="text-xs text-muted-foreground mt-2">{item.user_name} · {item.assigned_name || t('unassigned')}</p>
                    <div className="flex flex-wrap gap-2 mt-3"><Button variant="outline" className="min-h-11" onClick={() => { setTask(item); setTaskNote(''); }}>{t('details')}</Button>{item.source_kind === 'advert' && <Button variant="outline" className="min-h-11" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('case', item.source_id); window.history.replaceState(window.history.state, '', url); navigate('ads'); }}>{t('ads')}</Button>}{item.user_id && <Button variant="ghost" className="min-h-11" onClick={() => setUserId(item.user_id)}>{t('user')}</Button>}</div></>
                    : section === 'restrictions' ? <><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-sm">{item.user_name} · {t(`scope_${item.scope}` as ModeratorTextKey)}</p><Badge variant="outline">{stateLabel(item.state)}</Badge></div><p className="text-sm mt-2">{moderatorReason(item.reason, language)}</p><p className="text-sm whitespace-pre-wrap break-words mt-1">{item.public_detail}</p><p className="text-xs text-muted-foreground mt-2">{t('expires')}: {formatDate(item.expires_at)}</p>
                      {item.state === 'active' && <Button variant="outline" className="min-h-11 mt-3" onClick={() => { setDialogTarget({ kind: 'user', id: item.user_id, userId: item.user_id, name: item.user_name, restrictionId: item.id, legacy: item.legacy }); setDialogAction('unrestrict'); }}>{t('unrestrict')}</Button>}</>
                      : section === 'warnings' ? <><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-sm">{item.user_name}</p><Badge variant="outline">{t(item.acknowledged_at ? 'warning_acknowledged' : 'warning_pending')}</Badge></div><p className="text-sm mt-2">{moderatorReason(item.reason, language)}</p><p className="text-sm whitespace-pre-wrap break-words mt-2">{item.public_detail}</p><p className="text-xs text-muted-foreground mt-2">{formatDate(item.created_at)}</p></>
                        : section === 'appeals' ? <><p className="font-semibold text-sm">{item.user_name} · {moderatorReason(item.reason, language)}</p><p className="text-sm leading-relaxed whitespace-pre-wrap break-words mt-3">{item.body}</p>{item.response && <p className="bg-muted rounded-xl p-3 text-sm mt-3">{item.response}</p>}{item.state === 'open' && <Button className="min-h-11 mt-3" onClick={() => { setTask(item); setTaskNote(''); setAppealReply(''); }}>{t('appeal_resolve')}</Button>}</>
                          : section === 'network' ? <><div className="flex flex-wrap justify-between gap-2"><code className="break-all">{item.address}</code><Badge variant="outline">{stateLabel(item.state)}</Badge></div><p className="text-sm mt-2">{moderatorReason(item.reason, language)}</p><p className="text-xs text-muted-foreground mt-2">{t('expires')}: {formatDate(item.expires_at)}</p>{item.state === 'active' && <Button variant="outline" className="min-h-11 h-auto whitespace-normal mt-3" disabled={mutation.isPending} onClick={() => mutation.mutate({ rpc: 'moderator_ip_action_v1', args: { p_action: 'ip_unblock', p_observation: null, p_rule: item.id, p_seconds: null, p_reason: 'other', p_note: '', p_request: crypto.randomUUID() } })}>{t('ip_unblock')}</Button>}</>
                            : <><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-sm">{t(`action_${item.action}` as ModeratorTextKey)}</p><span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span></div><p className="text-sm mt-2">{item.actor_name} → {item.user_name || item.subject_kind}</p><p className="text-sm mt-1">{moderatorReason(item.reason, language)}</p><Button variant="outline" className="min-h-11 mt-3" onClick={() => setAuditId(item.id)}>{t('details')}</Button></>}
              </article>)}
            </div>}
            {!!current.data && <div className="flex justify-between gap-3 mt-4"><Button variant="outline" className="min-h-11" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('previous')}</Button><Button variant="outline" className="min-h-11" disabled={(page + 1) * 25 >= current.data.total} onClick={() => setPage(value => value + 1)}>{t('next')}</Button></div>}
          </>}
        </>}
      </div></main>
    </div>
    <Dialog open={!!userId} onOpenChange={open => { if (!open) setUserId(null); }}><DialogContent className="w-[calc(100%_-_24px)] max-w-2xl max-h-[calc(100dvh_-_24px)] overflow-y-auto" dir={isRtlLang(language) ? 'rtl' : 'ltr'}><DialogHeader className="text-start"><DialogTitle>{t('user_history')}</DialogTitle><DialogDescription className="break-all">{userId}</DialogDescription></DialogHeader>{userId && <UserDetail key={userId} userId={userId} />}</DialogContent></Dialog>
    <Dialog open={!!auditId} onOpenChange={open => { if (!open) setAuditId(null); }}><DialogContent className="w-[calc(100%_-_24px)] max-w-3xl max-h-[calc(100dvh_-_24px)] overflow-y-auto"><DialogHeader><DialogTitle>{t('audit')}</DialogTitle><DialogDescription>{t('note_hint')}</DialogDescription></DialogHeader>{audit.data && <div className="space-y-4 text-sm"><p>{moderatorReason(audit.data.reason, language)}</p><p className="whitespace-pre-wrap break-words">{audit.data.note}</p>{(['before_data', 'after_data'] as const).map(key => <section key={key}><h3 className="font-semibold mb-2">{t(key === 'before_data' ? 'audit_before' : 'audit_after')}</h3><p className="rounded-xl bg-muted p-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{audit.data[key]?.content || audit.data[key]?.text_overlay || JSON.stringify(audit.data[key] || {}, null, 2)}</p></section>)}</div>}</DialogContent></Dialog>
    <Dialog open={!!task} onOpenChange={open => { if (!open) setTask(null); }}><DialogContent className="w-[calc(100%_-_24px)] max-w-xl max-h-[calc(100dvh_-_24px)] overflow-y-auto"><DialogHeader><DialogTitle>{t('tasks')}</DialogTitle><DialogDescription>{task?.summary || task?.body}</DialogDescription></DialogHeader><Textarea aria-label={t('task_note')} value={taskNote} onChange={event => setTaskNote(event.target.value)} maxLength={2000} />
      {task?.task_id && <Textarea aria-label={t('appeal_reply')} value={appealReply} onChange={event => setAppealReply(event.target.value)} maxLength={2000} />}
      <div className="flex flex-wrap gap-2">{task?.task_id ? <Button disabled={mutation.isPending || appealReply.trim().length < 3} onClick={() => actionForTask(task, 'appeal_resolve')}>{t('appeal_resolve')}</Button> : (['claim', 'release', 'resolve', 'escalate'] as const).map(value => <Button key={value} variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={mutation.isPending || task?.state === 'resolved'} onClick={() => actionForTask(task, value)}>{t(({ claim: 'claim_task', release: 'release_task', resolve: 'resolve_task', escalate: 'escalate_task' } as const)[value])}</Button>)}</div></DialogContent></Dialog>
    <ModeratorActionDialog target={dialogTarget} action={dialogAction} onClose={() => { setDialogTarget(null); setDialogAction(null); }} />
  </div>;
}
