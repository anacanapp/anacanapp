import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Check, CheckCircle, Flag, Image, MessageSquare, Trash2, Video, XCircle } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import BlockUserDialog from '@/components/moderation/BlockUserDialog';
import { moderationText } from '@/lib/community-moderation-i18n';
import ModeratorActionDialog from '@/components/moderation/ModeratorActionDialog';
import { moderatorError, type ModeratorTarget } from '@/lib/moderator';
import { useUserStore } from '@/store/userStore';
import { AdminTabs, Avatar, Btn, EmptyState, ErrorState, FilterChips, Page, PageHeader, Pagination, SearchInput, Section, SkeletonRows, StatusPill, Toolbar, fmtDateTime, fmtRelative, useAdminConfirm } from './kit';
import { ADMIN_QUERY, ilikeTerm, unwrap } from './data/rpc';

type Card = { name: string; avatar_url?: string | null };
interface Post { id: string; content: string; user_id: string; created_at: string; is_active: boolean; likes_count: number; comments_count: number; media_urls?: string[] | null; author?: Card }
interface Comment { id: string; content: string; user_id: string; post_id: string; created_at: string; is_active: boolean; author?: Card }
interface BlockedUser { id: string; user_id: string; blocked_by: string; reason: string; block_type: string; is_active: boolean; created_at: string; expires_at: string | null; user?: Card }
interface Report { id: string; post_id: string; reporter_id: string; reason: string; description: string | null; status: string; created_at: string;
  post?: { content: string; user_id: string; media_urls?: string[] | null }; reporter?: Card | null; postAuthor?: Card | null }
type Tab = 'reports' | 'posts' | 'comments' | 'blocks';
const PAGE = 25;
const fallbackCard = (): Card => ({ name: tr('adminmoderation_istifadeci_b6bdd6', 'İstifadəçi'), avatar_url: null });
const isVideo = (url: string) => url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');

/**
 * Each tab loads only its own page (was: all reports + all blocks + 100 posts + 100 comments on open).
 * Profile cards are fetched for the ≤25 rows on screen.
 */
async function fetchReports(status: string, page: number) {
  let query = (supabase as any).from('post_reports').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const { data, count } = unwrap<Report[]>(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  const postIds = [...new Set(data.map(report => report.post_id))];
  const { data: posts } = postIds.length ? await supabase.from('community_posts').select('id, content, user_id, media_urls').in('id', postIds) : { data: [] as Array<{ id: string; content: string; user_id: string; media_urls: string[] | null }> };
  const cards = await getPublicProfileCards([...new Set([...data.map(report => report.reporter_id), ...(posts ?? []).map(post => post.user_id)])] as string[]);
  return { total: count, rows: data.map(report => {
    const post = posts?.find(item => item.id === report.post_id);
    return { ...report, post, reporter: cards[report.reporter_id] || null, postAuthor: post ? cards[post.user_id] || null : null } as Report;
  }) };
}
async function fetchPosts(search: string, page: number) {
  let query = supabase.from('community_posts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (search.trim()) query = query.ilike('content', ilikeTerm(search).replace(/\*/g, '%'));
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  const rows = data as unknown as Post[];
  const cards = await getPublicProfileCards([...new Set(rows.map(post => post.user_id))]);
  return { total: count, rows: rows.map(post => ({ ...post, author: cards[post.user_id] || fallbackCard() })) };
}
async function fetchComments(search: string, page: number) {
  let query = supabase.from('post_comments').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (search.trim()) query = query.ilike('content', ilikeTerm(search).replace(/\*/g, '%'));
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  const rows = data as unknown as Comment[];
  const cards = await getPublicProfileCards([...new Set(rows.map(comment => comment.user_id))]);
  return { total: count, rows: rows.map(comment => ({ ...comment, author: cards[comment.user_id] || fallbackCard() })) };
}
async function fetchBlocks(active: string, page: number) {
  let query = supabase.from('user_blocks').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (active === 'active') query = query.eq('is_active', true);
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  const rows = data as unknown as BlockedUser[];
  const cards = await getPublicProfileCards(rows.map(block => block.user_id));
  return { total: count, rows: rows.map(block => ({ ...block, user: cards[block.user_id] || fallbackCard() })) };
}
const countPending = async () => (await (supabase as any).from('post_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')).count ?? 0;

function Media({ urls, limit }: { urls?: string[] | null; limit?: number }) {
  if (!urls?.length) return null;
  return <div className="ak-media-grid">{urls.slice(0, limit ?? urls.length).map((url, index) => isVideo(url)
    ? <div key={index}><video src={url} /><span className="absolute inset-0 grid place-items-center bg-black/30"><Video size={20} className="text-white" /></span></div>
    : <div key={index}><img src={url} alt="" loading="lazy" /></div>)}</div>;
}

const AdminModeration = ({ onNavigate }: { onNavigate?: (section: string) => void }) => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('reports');
  const [reportStatus, setReportStatus] = useState('pending'), [blockFilter, setBlockFilter] = useState('active'), [search, setSearch] = useState('');
  const [pages, setPages] = useState<Record<Tab, number>>({ reports: 0, posts: 0, comments: 0, blocks: 0 });
  const [blockUserId, setBlockUserId] = useState<string>(''), [showBlockModal, setShowBlockModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ target: ModeratorTarget; reportId?: string } | null>(null);
  const page = pages[tab], setPage = (value: number) => setPages(previous => ({ ...previous, [tab]: value }));

  const pending = useQuery({ queryKey: ['admin-moderation-pending'], queryFn: countPending, ...ADMIN_QUERY, staleTime: 15_000 });
  const reports = useQuery({ queryKey: ['admin-moderation-reports', reportStatus, pages.reports], queryFn: () => fetchReports(reportStatus, pages.reports), enabled: tab === 'reports', placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 15_000 });
  const posts = useQuery({ queryKey: ['admin-moderation-posts', search, pages.posts], queryFn: () => fetchPosts(search, pages.posts), enabled: tab === 'posts', placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 15_000 });
  const comments = useQuery({ queryKey: ['admin-moderation-comments', search, pages.comments], queryFn: () => fetchComments(search, pages.comments), enabled: tab === 'comments', placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 15_000 });
  const blocks = useQuery({ queryKey: ['admin-moderation-blocks', blockFilter, pages.blocks], queryFn: () => fetchBlocks(blockFilter, pages.blocks), enabled: tab === 'blocks', placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 15_000 });
  const refresh = (...keys: string[]) => Promise.all(keys.map(key => client.invalidateQueries({ queryKey: [key] })));
  const refreshAll = () => refresh('admin-moderation-reports', 'admin-moderation-posts', 'admin-moderation-comments', 'admin-moderation-blocks', 'admin-moderation-pending', 'admin-overview-v1');

  const handleReportAction = async (report: Report | { id: string }, action: 'reviewed' | 'dismissed', postId?: string) => {
    if (action === 'reviewed' && postId) {
      const full = report as Report;
      if (full.post) setRemoveTarget({ target: { kind: 'post', id: postId, userId: full.post.user_id, content: full.post.content, name: full.postAuthor?.name }, reportId: report.id });
      return;
    }
    const { error } = await (supabase as any).rpc('moderator_report_decide_v1', { p_report: report.id, p_decision: action, p_request: crypto.randomUUID() });
    if (error) { toast({ title: moderatorError(error, useUserStore.getState().language), variant: 'destructive' }); return; }
    toast({ title: tr('adminmoderation_ugurlu_7fe64c', 'Uğurlu') });
    void refresh('admin-moderation-reports', 'admin-moderation-posts', 'admin-moderation-pending');
  };

  const unblockUser = async (block: BlockedUser) => {
    if (!(await confirm({ title: tr('adminmoderation_bu_istifadecinin_blokunu_acmaq_b0d1f5', 'Bu istifadəçinin blokunu açmaq istəyirsiniz?'), confirmLabel: tr('adminmoderation_bloku_ac_b83fbb', 'Bloku Aç') }))) return;
    const { error } = await (supabase as any).rpc('moderator_user_action_v1', { p_user: block.user_id, p_action: 'unrestrict', p_reason: 'other', p_detail: '',
      p_options: { restriction_id: block.id }, p_request: crypto.randomUUID() });
    if (error) toast({ title: tr('adminmoderation_xeta_3cdbb6', 'Xəta'), description: error.message, variant: 'destructive' });
    else { toast({ title: tr('adminmoderation_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminmoderation_blok_acildi_d339d9', 'Blok açıldı') }); void refresh('admin-moderation-blocks'); }
  };
  const openBlockModal = (userId: string) => { setBlockUserId(userId); setShowBlockModal(true); };

  const current = { reports, posts, comments, blocks }[tab];
  const body = useMemo(() => {
    if (current.isError) return <ErrorState onRetry={() => void current.refetch()} />;
    if (current.isLoading || !current.data) return <SkeletonRows rows={5} columns={3} />;
    if (!current.data.rows.length) return <EmptyState icon={tab === 'reports' ? <Flag size={20} /> : tab === 'blocks' ? <Ban size={20} /> : <MessageSquare size={20} />}
      title={tab === 'reports' ? tr('adminmoderation_hec_bir_sikayet_yoxdur_a67bd4', 'Heç bir şikayət yoxdur') : 'Nəticə yoxdur'} />;
    return null;
  }, [current, tab]);

  return (
    <Page testId="admin-moderation">
      {removeTarget && <ModeratorActionDialog target={removeTarget.target} action="remove" onClose={() => setRemoveTarget(null)} onDone={() => {
        const reportId = removeTarget.reportId;
        if (reportId) void handleReportAction({ id: reportId }, 'reviewed');
        void refreshAll();
      }} />}
      <PageHeader title="Moderasiya" subtitle="Şikayətlər, postlar, şərhlər və bloklar"
        meta={!!pending.data && <StatusPill tone="danger">{pending.data} {tr('adminmoderation_yeni_sikayet_9571c6', 'yeni şikayət')}</StatusPill>}
        actions={onNavigate && <Btn onClick={() => onNavigate('ad-moderation')}><AlertTriangle size={15} />{moderationText('title')}</Btn>} />
      <Section flush>
        <div className="px-4 grid gap-2.5">
          <AdminTabs value={tab} onChange={value => setTab(value as Tab)} items={[
            { value: 'reports', label: tr('adminmoderation_sikayetler_4ad77f', 'Şikayətlər'), icon: <Flag size={14} />, count: pending.data },
            { value: 'posts', label: 'Postlar', icon: <MessageSquare size={14} /> }, { value: 'comments', label: tr('adminmoderation_serhler_30d5d9', 'Şərhlər'), icon: <MessageSquare size={14} /> },
            { value: 'blocks', label: 'Bloklar', icon: <Ban size={14} /> }]} />
          <div className="pb-3">
            {tab === 'reports' && <FilterChips label="Şikayət statusu" value={reportStatus} onChange={value => { setReportStatus(value); setPages(previous => ({ ...previous, reports: 0 })); }}
              options={[{ value: 'pending', label: tr('adminmoderation_gozleyir_9ac18a', 'Gözləyir') }, { value: 'reviewed', label: tr('adminmoderation_yoxlanildi_fc524b', 'Yoxlanıldı') },
                { value: 'dismissed', label: tr('adminmoderation_redd_edildi_c40149', 'Rədd edildi') }, { value: 'all', label: 'Hamısı' }]} />}
            {(tab === 'posts' || tab === 'comments') && <Toolbar><SearchInput value={search} onChange={value => { setSearch(value); setPages(previous => ({ ...previous, posts: 0, comments: 0 })); }} placeholder="Mətndə axtar…" /></Toolbar>}
            {tab === 'blocks' && <FilterChips label="Blok statusu" value={blockFilter} onChange={value => { setBlockFilter(value); setPages(previous => ({ ...previous, blocks: 0 })); }}
              options={[{ value: 'active', label: 'Aktiv' }, { value: 'all', label: 'Hamısı' }]} />}
          </div>
        </div>
        <div className="px-4 pb-4 grid gap-2.5">
          {body}
          {!body && tab === 'reports' && reports.data!.rows.map(report => (
            <article key={report.id} className="ak-card-row grid gap-2.5" data-testid="moderation-report" style={report.status === 'pending' ? { borderColor: 'var(--ad-warning)' } : undefined}>
              <header className="flex flex-wrap items-center gap-2">
                <StatusPill tone={report.status === 'pending' ? 'warning' : report.status === 'reviewed' ? 'success' : 'neutral'}>
                  {report.status === 'pending' ? tr('adminmoderation_gozleyir_9ac18a', 'Gözləyir') : report.status === 'reviewed' ? tr('adminmoderation_yoxlanildi_fc524b', 'Yoxlanıldı') : tr('adminmoderation_redd_edildi_c40149', 'Rədd edildi')}
                </StatusPill>
                <StatusPill tone="neutral" dot={false}>{report.reason}</StatusPill>
                <span className="ak-cell-sub" title={fmtDateTime(report.created_at)}>{fmtRelative(report.created_at)}</span>
                <span className="ak-cell-sub ms-auto">{tr('adminmoderation_sikayet_eden_17501b', 'Şikayət edən:')} <strong className="text-foreground">{report.reporter?.name || tr('adminmoderation_i_stifadeci_b6bdd6', 'İstifadəçi')}</strong></span>
              </header>
              {report.post && (
                <div className="rounded-lg border p-3 bg-muted/40">
                  <div className="ak-cell-user mb-2"><Avatar name={report.postAuthor?.name} src={report.postAuthor?.avatar_url} size={24} /><span className="ak-cell-sub">{tr('adminmoderation_post_muellifi_f1677f', 'Post müəllifi:')} <strong className="text-foreground">{report.postAuthor?.name || tr('adminmoderation_i_stifadeci_b6bdd6', 'İstifadəçi')}</strong></span></div>
                  <p className="text-sm whitespace-pre-wrap">{report.post.content}</p>
                  <Media urls={report.post.media_urls} />
                </div>
              )}
              {report.description && <p className="ak-notice" data-tone="warning">{tr('adminmoderation_elave_qeyd_58e864', 'Əlavə qeyd:')} {report.description}</p>}
              {report.status === 'pending' && (
                <footer className="flex flex-wrap gap-2 justify-end">
                  <Btn size="sm" onClick={() => void handleReportAction(report, 'dismissed')} title={tr('adminmoderation_sikayeti_redd_et_184bc2', 'Şikayəti rədd et')}><XCircle size={14} />Rədd et</Btn>
                  <Btn size="sm" variant="danger" onClick={() => void handleReportAction(report, 'reviewed', report.post_id)} title={tr('adminmoderation_sikayeti_qebul_et_ve_postu_sil_45452a', 'Şikayəti qəbul et və postu sil')}><CheckCircle size={14} />Qəbul et, postu sil</Btn>
                </footer>
              )}
            </article>
          ))}
          {!body && tab === 'posts' && posts.data!.rows.map(post => (
            <article key={post.id} className="ak-card-row flex gap-3">
              <Avatar name={post.author?.name} src={post.author?.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><strong className="text-sm">{post.author?.name || tr('adminmoderation_i_stifadeci_b6bdd6', 'İstifadəçi')}</strong><span className="ak-cell-sub">{fmtRelative(post.created_at)}</span></div>
                <p className="text-sm whitespace-pre-wrap mt-1">{post.content}</p>
                <Media urls={post.media_urls} limit={4} />
                <div className="flex gap-3 mt-2 ak-cell-sub"><span>❤️ {post.likes_count || 0}</span><span>💬 {post.comments_count || 0}</span>{!!post.media_urls?.length && <span className="inline-flex items-center gap-1"><Image size={12} />{post.media_urls.length}</span>}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="ak-icon-btn" aria-label="Blokla" onClick={() => openBlockModal(post.user_id)}><Ban size={15} className="text-amber-500" /></button>
                <button type="button" className="ak-icon-btn" aria-label="Postu sil" onClick={() => setRemoveTarget({ target: { kind: 'post', id: post.id, userId: post.user_id, content: post.content, name: post.author?.name } })}><Trash2 size={15} className="text-red-500" /></button>
              </div>
            </article>
          ))}
          {!body && tab === 'comments' && comments.data!.rows.map(comment => (
            <article key={comment.id} className="ak-card-row flex gap-3">
              <Avatar name={comment.author?.name} src={comment.author?.avatar_url} />
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><strong className="text-sm">{comment.author?.name || tr('adminmoderation_i_stifadeci_b6bdd6', 'İstifadəçi')}</strong><span className="ak-cell-sub">{fmtRelative(comment.created_at)}</span></div>
                <p className="text-sm mt-1">{comment.content}</p></div>
              <div className="flex flex-col gap-1">
                <button type="button" className="ak-icon-btn" aria-label="Blokla" onClick={() => openBlockModal(comment.user_id)}><Ban size={15} className="text-amber-500" /></button>
                <button type="button" className="ak-icon-btn" aria-label="Şərhi sil" onClick={() => setRemoveTarget({ target: { kind: 'comment', id: comment.id, userId: comment.user_id, content: comment.content, name: comment.author?.name } })}><Trash2 size={15} className="text-red-500" /></button>
              </div>
            </article>
          ))}
          {!body && tab === 'blocks' && blocks.data!.rows.map(block => (
            <article key={block.id} className="ak-card-row flex items-center gap-3">
              <Avatar name={block.user?.name} src={block.user?.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><strong className="text-sm">{block.user?.name || tr('adminmoderation_i_stifadeci_b6bdd6', 'İstifadəçi')}</strong>
                  <StatusPill tone={block.is_active ? 'danger' : 'neutral'}>{block.is_active ? 'Aktiv' : tr('adminmoderation_acilib_1f71a5', 'Açılıb')}</StatusPill><StatusPill tone="neutral" dot={false}>{block.block_type}</StatusPill></div>
                <p className="ak-cell-sub">{tr('adminmoderation_sebeb_e614c3', 'Səbəb:')} {block.reason} · {block.expires_at ? `${tr('adminmoderation_bitme', 'Bitmə:')} ${fmtDateTime(block.expires_at)}` : tr('adminmoderation_daimi', 'Daimi')} · <span className="ak-mono">{block.user_id.substring(0, 8)}…</span></p>
              </div>
              {block.is_active && <Btn size="sm" onClick={() => void unblockUser(block)}><Check size={14} />{tr('adminmoderation_bloku_ac_b83fbb', 'Bloku Aç')}</Btn>}
            </article>
          ))}
        </div>
        {!!current.data?.total && <Pagination page={page} pages={Math.max(1, Math.ceil(current.data.total / PAGE))} total={current.data.total} pageSize={PAGE} onPageChange={setPage} disabled={current.isFetching} />}
      </Section>
      {/* Block User Modal — paylaşılan dialog (müddət + səbəb + növ) */}
      <BlockUserDialog open={showBlockModal} onOpenChange={setShowBlockModal} userId={blockUserId || null} onDone={() => void refresh('admin-moderation-blocks')} />
    </Page>
  );
};

export default AdminModeration;
