import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Cake, Crown, Flag, Image, LifeBuoy, Package, PiggyBank, RefreshCw, ShoppingBag, Ticket, UserPlus, Users, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Btn, EmptyState, ErrorState, KpiRow, Page, PageHeader, Section, Skeleton, StatTile, StatusPill, fmtMinor, fmtMoney, fmtNumber, fmtRelative, pctChange, toneFor } from './kit';
import { fetchOverview, type ActivityItem } from './data/overview';
import { ADMIN_QUERY } from './data/rpc';

const ORDER_LABEL: Record<string, string> = { pending: 'Gözləyir', confirmed: 'Təsdiqləndi', processing: 'Hazırlanır', shipped: 'Göndərildi', delivered: 'Çatdırıldı',
  cancelled: 'Ləğv', preparing: 'Hazırlanır', ready: 'Hazırdır', open: 'Açıq', in_progress: 'İşlənir', resolved: 'Həll edildi', closed: 'Bağlı' };
const STAGE_LABEL: Record<string, string> = { flow: 'Menstruasiya', bump: 'Hamiləlik', mommy: 'Analıq', partner: 'Partnyor' };
const FEED: Record<ActivityItem['kind'], { icon: typeof Users; label: string; section: string }> = {
  signup: { icon: UserPlus, label: 'Yeni qeydiyyat', section: 'users' }, order: { icon: Package, label: 'Aptek sifarişi', section: 'orders' },
  support: { icon: LifeBuoy, label: 'Dəstək müraciəti', section: 'support' }, cake: { icon: Cake, label: 'Tort sifarişi', section: 'cakes' },
  book: { icon: ShoppingBag, label: 'Kitab satışı', section: 'books' },
};

export default function AdminDashboard({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { user, isAdmin } = useAuth();
  const query = useQuery({ queryKey: ['admin-overview-v1', user?.id], queryFn: fetchOverview, enabled: !!user && isAdmin, ...ADMIN_QUERY, refetchInterval: 120_000 });
  const data = query.data, loading = query.isLoading || (!data && !query.isError);
  const go = (section: string) => () => onNavigate?.(section);
  const salesToday = data ? [data.orders_today_revenue, data.cakes_paid_today_revenue, data.books_paid_today_revenue].reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const ordersToday = data ? [data.orders_today, data.cakes_paid_today, data.books_paid_today].reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const qcTotal = data && (data.qc_available_minor !== null || data.qc_pending_minor !== null) ? (data.qc_available_minor ?? 0) + (data.qc_pending_minor ?? 0) : null;

  return (
    <Page testId="admin-dashboard">
      <PageHeader title="İcmal" subtitle="Bu günün əsas göstəriciləri və diqqət tələb edən növbələr · Bakı vaxtı"
        actions={<>
          <Btn onClick={go('analytics')}><BarChart3 size={15} />Analitika</Btn>
          <Btn onClick={go('premium-analytics')}><Crown size={15} />Premium mərkəzi</Btn>
          <Btn onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Yenilə"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} />Yenilə</Btn>
        </>} />

      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}

      <KpiRow columns={4}>
        <StatTile testId="kpi-users" label="İstifadəçilər" icon={<Users size={13} />} loading={loading} value={fmtNumber(data?.users_total)}
          hint={data ? `+${fmtNumber(data.users_today)} bu gün` : undefined}
          delta={data?.users_7d !== null && data?.users_prev_7d !== null && data ? pctChange(data.users_7d!, data.users_prev_7d!) : null} spark={data?.signups_series} onClick={go('users')} />
        <StatTile testId="kpi-active" label="Aktiv istifadəçi · bu gün" icon={<Activity size={13} />} loading={loading} value={fmtNumber(data?.active_today)}
          hint={data ? (data.active_7d === null ? 'Server hesabatı tələb olunur' : `7 gün: ${fmtNumber(data.active_7d)}`) : undefined}
          delta={data?.active_7d != null && data?.active_prev_7d != null ? pctChange(data.active_7d, data.active_prev_7d) : null} spark={data?.active_series} onClick={go('analytics')} />
        <StatTile testId="kpi-premium" label="Premium aktiv" tone="accent" icon={<Crown size={13} />} loading={loading} value={fmtNumber(data?.premium_active)}
          hint={data?.users_total ? `${((100 * (data.premium_active ?? 0)) / data.users_total).toFixed(1)}% istifadəçi` : undefined} onClick={go('premium-analytics')} />
        <StatTile testId="kpi-sales" label="Bugünkü satış" tone="success" icon={<ShoppingBag size={13} />} loading={loading} value={fmtMoney(salesToday)}
          hint={data ? `${fmtNumber(ordersToday)} sifariş` : undefined} spark={data?.orders_series} onClick={go('orders')} />
      </KpiRow>

      <Section title="Diqqət tələb edir" description="Gözləyən işlər. Kliklə bölməyə keçin." testId="admin-queues">
        <KpiRow columns={6}>
          <StatTile label="Aptek sifarişi" tone={data?.orders_pending ? 'warning' : 'default'} icon={<Package size={13} />} loading={loading} value={fmtNumber(data?.orders_pending)}
            hint={data ? `${fmtNumber(data.orders_processing)} yolda` : undefined} onClick={go('orders')} />
          <StatTile label="Tort sifarişi" tone={data?.cakes_pending ? 'warning' : 'default'} icon={<Cake size={13} />} loading={loading} value={fmtNumber(data?.cakes_pending)} hint="gözləyir" onClick={go('cakes')} />
          <StatTile label="Dəstək" tone={data?.support_new ? 'warning' : 'default'} icon={<LifeBuoy size={13} />} loading={loading} value={fmtNumber(data?.support_open)}
            hint={data ? `${fmtNumber(data.support_new)} cavabsız` : undefined} onClick={go('support')} />
          <StatTile label="Moderasiya" tone={data?.moderation_pending ? 'danger' : 'default'} icon={<Flag size={13} />} loading={loading} value={fmtNumber(data?.moderation_pending)}
            hint={data?.ad_review_pending ? `${fmtNumber(data.ad_review_pending)} reklam yoxlanışı` : 'şikayət'} onClick={go('moderation')} />
          <StatTile label="Xətalar · 24 saat" tone={data?.crashes_24h ? 'danger' : 'default'} icon={<AlertTriangle size={13} />} loading={loading} value={fmtNumber(data?.crashes_24h)} hint="crash hesabatı" onClick={go('crash-reports')} />
          <StatTile label="QayğıCash öhdəliyi" icon={<PiggyBank size={13} />} loading={loading} value={fmtMinor(qcTotal)}
            hint={data?.qc_pending_minor != null ? `${fmtMinor(data.qc_pending_minor)} gözləmədə` : undefined} onClick={go('qaygicash')} />
        </KpiRow>
      </Section>

      <div className="ak-grid ak-grid-2">
        <Section title="Sürətli əməliyyatlar">
          <div className="ak-actions-grid">
            <QuickAction icon={<Package size={18} />} title="Sifarişlər" sub="Aptek statusları" badge={data?.orders_pending} onClick={go('orders')} />
            <QuickAction icon={<Bell size={18} />} title="Push göndər" sub="Kampaniya yarat" onClick={go('push-notifications')} />
            <QuickAction icon={<Users size={18} />} title="İstifadəçi tap" sub="Ad, email" onClick={go('users')} />
            <QuickAction icon={<LifeBuoy size={18} />} title="Dəstək" sub="Cavab yaz" badge={data?.support_new} onClick={go('support')} />
            <QuickAction icon={<Image size={18} />} title="Bannerlər" sub="Yerləşdirmə" onClick={go('banners')} />
            <QuickAction icon={<Ticket size={18} />} title="Kupon yarat" sub="Endirim kodu" onClick={go('coupons')} />
          </div>
        </Section>
        <Section title="Son fəaliyyət" description="Qeydiyyat, sifariş və müraciətlər" testId="admin-recent">
          {loading ? <div className="ak-feed">{[0, 1, 2, 3, 4].map(index => <div key={index} className="ak-feed-item"><Skeleton style={{ width: 30, height: 30, borderRadius: 8 }} /><div className="ak-feed-text"><Skeleton style={{ width: '60%' }} /><Skeleton style={{ width: '35%', marginTop: 6 }} /></div></div>)}</div>
            : !data?.recent.length ? <EmptyState compact title="Hələ fəaliyyət yoxdur" />
              : <div className="ak-feed">{data.recent.map(item => {
                const meta = FEED[item.kind] ?? FEED.order;
                const detail = item.kind === 'signup' ? STAGE_LABEL[item.detail ?? ''] ?? 'Mərhələ seçilməyib' : ORDER_LABEL[item.detail ?? ''] ?? item.detail;
                return (
                  <button type="button" key={`${item.kind}-${item.id}`} className="ak-feed-item" onClick={go(meta.section)}>
                    <span className="ak-feed-icon"><meta.icon size={15} /></span>
                    <span className="ak-feed-text"><strong>{item.title}</strong><small>{meta.label}{item.amount != null ? ` · ${fmtMoney(item.amount)}` : ''}</small></span>
                    {detail && item.kind !== 'signup' ? <StatusPill tone={toneFor(item.detail)}>{detail}</StatusPill> : <span className="ak-hint">{detail}</span>}
                    <span className="ak-feed-time">{fmtRelative(item.at)}</span>
                  </button>
                );
              })}</div>}
        </Section>
      </div>
      {data && <p className="ak-hint" data-testid="admin-overview-source">
        {data.source === 'rpc' ? 'Mənbə: server hesabatı (admin_overview_v1)' : 'Mənbə: ehtiyat sorğular — aktiv istifadəçi sayı üçün admin_overview_v1 tətbiq olunmalıdır'} · yenilənib {fmtRelative(data.generated_at)}
      </p>}
    </Page>
  );
}

function QuickAction({ icon, title, sub, badge, onClick }: { icon: React.ReactNode; title: string; sub: string; badge?: number | null; onClick: () => void }) {
  return <button type="button" className="ak-action" onClick={onClick}>{icon}<span>{title}<small>{sub}</small></span>{!!badge && <b>{fmtNumber(badge)}</b>}</button>;
}
