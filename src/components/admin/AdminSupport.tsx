import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock, Loader2, LifeBuoy, Send, XCircle } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import type { AdminSupportTicket } from '@/hooks/useSupportTicketsAdmin';
import { useSupportTicketReplies } from '@/hooks/useSupportTicketReplies';
import { useSupportCategories } from '@/hooks/useDynamicTools';
import { useToast } from '@/hooks/use-toast';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';
import { Avatar, Btn, DataTable, EmptyState, FilterChips, KpiRow, Page, PageHeader, SearchInput, Section, SideDrawer, SkeletonRows, StatTile, StatusPill, Toolbar, fmtDateTime, fmtNumber, fmtRelative, toneFor, type Column } from './kit';
import { ADMIN_QUERY, ilikeTerm, unwrap } from './data/rpc';

type Status = AdminSupportTicket['status'];
type Priority = AdminSupportTicket['priority'];
const STATUS_LABEL: Record<Status, string> = { open: tr('adminsupport_aciq_306cc4', 'Açıq'), in_progress: tr('adminsupport_islenir_65a15d', 'İşlənir'), resolved: tr('adminsupport_hell_edildi_beceb9', 'Həll edildi'), closed: tr('adminsupport_bagli_713069', 'Bağlı') };
const PRIORITY_LABEL: Record<Priority, string> = { low: tr('adminsupport_asagi_1c27f1', 'Aşağı'), normal: 'Normal', high: tr('adminsupport_yuksek_492584', 'Yüksək'), urgent: tr('adminsupport_tecili_ab784b', 'Təcili') };
const PAGE = 30;

/** Page of tickets + names for the ≤30 users on the page (was: every ticket and every author profile). */
async function fetchTickets(status: string, search: string, page: number) {
  let query = supabase.from('support_tickets').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  if (search.trim()) query = query.or(`subject.ilike.${ilikeTerm(search)},message.ilike.${ilikeTerm(search)}`);
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  const tickets = data as unknown as AdminSupportTicket[];
  const ids = [...new Set(tickets.map(ticket => ticket.user_id))];
  const profiles = new Map<string, { name: string | null; email: string | null }>();
  if (ids.length) {
    const { data: rows } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
    rows?.forEach(row => profiles.set(row.user_id, row));
  }
  return { rows: tickets.map(ticket => ({ ...ticket, user_name: profiles.get(ticket.user_id)?.name || tr('usesupportticketsadmin_i_stifadeci_b6bdd6', 'İstifadəçi'), user_email: profiles.get(ticket.user_id)?.email || '' })), total: count };
}
async function fetchCounts() {
  const entries = await Promise.all(['all', 'open', 'in_progress', 'resolved', 'closed'].map(async status => {
    let query = supabase.from('support_tickets').select('id', { count: 'exact', head: true });
    if (status !== 'all') query = query.eq('status', status);
    return [status, (await query).count ?? 0] as const;
  }));
  return Object.fromEntries(entries) as Record<string, number>;
}
/** Same writes as useSupportTicketsAdmin (status / priority on support_tickets). */
async function updateTicket(id: string, patch: { status?: Status; priority?: Priority }) {
  const { error } = await supabase.from('support_tickets').update(patch).eq('id', id);
  return { error };
}

const AdminSupport = () => {
  const localize = useAdminLocalize();
  const { data: supportCategories = [] } = useSupportCategories();
  const client = useQueryClient();
  const [status, setStatus] = useState('all'), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const list = useQuery({ queryKey: ['admin-support-page', status, search, page], queryFn: () => fetchTickets(status, search, page), placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 15_000 });
  const counts = useQuery({ queryKey: ['admin-support-counts'], queryFn: fetchCounts, ...ADMIN_QUERY, staleTime: 15_000 });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['admin-support-page'] }), client.invalidateQueries({ queryKey: ['admin-support-counts'] })]);

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    supportCategories.forEach(category => { labels[category.category_key] = localize(category, 'name'); });
    labels.general ??= tr('adminsupport_umumi_1b5521', 'Ümumi'); labels.technical ??= 'Texniki'; labels.billing ??= tr('adminsupport_odenis_a4610e', 'Ödəniş');
    labels.feature ??= tr('adminsupport_xususiyyet_73f16d', 'Xüsusiyyət'); labels.other ??= tr('adminsupport_diger_293b3a', 'Digər');
    return labels;
  }, [supportCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo<Column<AdminSupportTicket>[]>(() => [
    { key: 'subject', header: 'Mövzu', mobile: 'title', cell: ticket => <span><span className="ak-cell-main">{ticket.subject}</span><span className="ak-cell-sub line-clamp-1">{ticket.message}</span></span> },
    { key: 'user', header: 'İstifadəçi', mobile: 'subtitle', cell: ticket => <span className="ak-cell-user"><Avatar name={ticket.user_name} size={26} /><span className="min-w-0"><span className="ak-cell-main">{ticket.user_name}</span><span className="ak-cell-sub">{ticket.user_email}</span></span></span> },
    { key: 'category', header: 'Kateqoriya', cell: ticket => <span className="ak-cell-sub">{categoryLabels[ticket.category] || ticket.category}</span> },
    { key: 'priority', header: 'Prioritet', cell: ticket => <StatusPill tone={toneFor(ticket.priority)} dot={false}>{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</StatusPill> },
    { key: 'status', header: 'Status', cell: ticket => <StatusPill tone={toneFor(ticket.status)}>{STATUS_LABEL[ticket.status] ?? ticket.status}</StatusPill> },
    { key: 'created', header: 'Tarix', align: 'end', cell: ticket => <span className="ak-num" title={fmtDateTime(ticket.created_at)}>{fmtRelative(ticket.created_at)}</span> },
  ], [categoryLabels]);

  return (
    <Page testId="admin-support">
      <PageHeader title="Dəstək müraciətləri" subtitle="İstifadəçi müraciətlərinə cavab verin, status və prioriteti idarə edin" />
      <KpiRow columns={4}>
        <StatTile label={tr('adminsupport_umumi_1b5521', 'Ümumi')} icon={<LifeBuoy size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.all)} />
        <StatTile label={STATUS_LABEL.open} tone={counts.data?.open ? 'warning' : 'default'} icon={<AlertCircle size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.open)} onClick={() => { setStatus('open'); setPage(0); }} />
        <StatTile label={STATUS_LABEL.in_progress} icon={<Clock size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.in_progress)} onClick={() => { setStatus('in_progress'); setPage(0); }} />
        <StatTile label={STATUS_LABEL.resolved} tone="success" icon={<CheckCircle size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.resolved)} onClick={() => { setStatus('resolved'); setPage(0); }} />
      </KpiRow>
      <Section flush>
        <div className="px-4 pb-3 grid gap-2.5">
          <Toolbar><SearchInput value={search} onChange={value => { setSearch(value); setPage(0); }} placeholder="Mövzu və ya mətn üzrə axtar…" /></Toolbar>
          <FilterChips label="Status" value={status} onChange={value => { setStatus(value); setPage(0); }}
            options={[{ value: 'all', label: tr('adminsupport_hamisi_c73c4d', 'Hamısı'), count: counts.data?.all }, ...(['open', 'in_progress', 'resolved', 'closed'] as Status[]).map(value => ({ value, label: STATUS_LABEL[value], count: counts.data?.[value] }))]} />
        </div>
        <DataTable testId="admin-support-table" rowTestId="admin-ticket-row" columns={columns} rows={list.data?.rows} rowKey={ticket => ticket.id} loading={list.isLoading}
          fetching={list.isFetching && !list.isLoading} error={list.isError ? list.error : null} onRetry={() => void list.refetch()}
          page={page} total={list.data?.total ?? 0} pageSize={PAGE} onPageChange={setPage} onRowClick={ticket => setSelected(ticket)}
          empty={<EmptyState icon={<LifeBuoy size={20} />} title={tr('adminsupport_muraciet_tapilmadi_b93f2d', 'Müraciət tapılmadı')} />} />
      </Section>
      {selected && <TicketDrawer ticket={selected} category={categoryLabels[selected.category] || selected.category} onChange={setSelected} onClose={() => { setSelected(null); void refresh(); }} onRefresh={refresh} />}
    </Page>
  );
};

function TicketDrawer({ ticket, category, onChange, onClose, onRefresh }: { ticket: AdminSupportTicket; category: string; onChange: (ticket: AdminSupportTicket) => void; onClose: () => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const { replies, loading, addReply } = useSupportTicketReplies(ticket.id);
  const [message, setMessage] = useState(''), [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [replies]);
  const fail = () => toast({ title: tr('adminsupport_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });

  const setStatus = async (status: Status, success?: string) => {
    const result = await updateTicket(ticket.id, { status });
    if (result.error) { fail(); return false; }
    onChange({ ...ticket, status }); onRefresh();
    if (success) toast({ title: success });
    return true;
  };
  const setPriority = async (priority: Priority) => {
    const result = await updateTicket(ticket.id, { priority });
    if (result.error) { fail(); return; }
    onChange({ ...ticket, priority }); onRefresh();
  };
  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    const result = await addReply(message.trim(), true); // true = is_admin
    setSending(false);
    if (result.error) { fail(); return; }
    setMessage('');
    // Also update status to in_progress if it was open
    if (ticket.status === 'open') await setStatus('in_progress');
    toast({ title: tr('adminsupport_cavab_gonderildi_4746f8', 'Cavab göndərildi!') });
  };

  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} size="lg" testId="admin-ticket-drawer" dirty={!!message.trim()}
      title={ticket.subject} description={`${ticket.user_name}${ticket.user_email ? ` · ${ticket.user_email}` : ''} · ${category}`}
      footer={ticket.status !== 'closed' ? (
        <div className="flex w-full items-end gap-2">
          <textarea className="ak-textarea" style={{ minHeight: 44, maxHeight: 140 }} rows={1} value={message} onChange={event => setMessage(event.target.value)}
            placeholder={tr('adminsupport_cavabinizi_yazin_2cda33', 'Cavabınızı yazın...')} aria-label="Cavab"
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
          <Btn variant="primary" aria-label="Göndər" onClick={() => void send()} disabled={sending || !message.trim()} style={{ height: 44 }}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</Btn>
        </div>
      ) : <p className="ak-hint w-full text-center">{tr('adminsupport_bu_muraciet_baglanib_ca3d3c', 'Bu müraciət bağlanıb.')}</p>}>
      <div className="flex flex-wrap items-center gap-2">
        <select className="ak-select" aria-label="Status" value={ticket.status} onChange={event => void setStatus(event.target.value as Status)}>
          {(Object.keys(STATUS_LABEL) as Status[]).map(value => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
        </select>
        <select className="ak-select" aria-label="Prioritet" value={ticket.priority} onChange={event => void setPriority(event.target.value as Priority)}>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map(value => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}
        </select>
        {ticket.status !== 'resolved' && ticket.status !== 'closed' && <Btn size="sm" onClick={() => void setStatus('resolved', tr('adminsupport_muraciet_hell_edildi_367c6a', 'Müraciət həll edildi'))}><CheckCircle size={13} />{tr('adminsupport_hell_et_aae47e', 'Həll et')}</Btn>}
        {ticket.status !== 'closed' && <Btn size="sm" onClick={() => void setStatus('closed', tr('adminsupport_muraciet_baglandi_878702', 'Müraciət bağlandı'))}><XCircle size={13} />{tr('adminsupport_bagla_84bdc9', 'Bağla')}</Btn>}
      </div>
      <div className="ak-chat" aria-live="polite">
        <div className="ak-bubble is-user">{ticket.message}<small>{fmtDateTime(ticket.created_at)}</small></div>
        {ticket.admin_response && <div className="ak-bubble is-admin">{ticket.admin_response}{ticket.responded_at && <small>{fmtDateTime(ticket.responded_at)}</small>}</div>}
        {loading ? <SkeletonRows rows={2} columns={2} /> : replies.map(reply => (
          <div key={reply.id} className={`ak-bubble ${reply.is_admin ? 'is-admin' : 'is-user'}`}>{reply.message}<small>{fmtDateTime(reply.created_at)}</small></div>
        ))}
        <div ref={end} />
      </div>
    </SideDrawer>
  );
}

export default AdminSupport;
