import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, MapPin, Package, Phone, RefreshCw, Truck, Wallet, XCircle } from 'lucide-react';
import { tr } from '@/lib/tr';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/hooks/useOrders';
import {
  Btn, DataTable, DescriptionList, EmptyState, FilterChips, KpiRow, Notice, Page, PageHeader, SearchInput, Section, SideDrawer, StatTile, StatusPill, Toolbar,
  fmtDateTime, fmtMoney, fmtNumber, toneFor, useAdminConfirm, type Column,
} from './kit';
import { ADMIN_QUERY } from './data/rpc';
import { fetchOrdersPage, fetchOrderStats, ORDER_STATUSES, ORDERS_PAGE_SIZE, setOrderStatus, type AdminOrder } from './data/orders';

const STATUS_LABEL: Record<string, string> = {
  pending: tr('adminorders_gozleyir_9ac18a', 'Gözləyir'), confirmed: tr('adminorders_tesdiqlendi_0c46e4', 'Təsdiqləndi'), processing: tr('adminorders_hazirlanir_c15a4b', 'Hazırlanır'),
  shipped: tr('adminorders_gonderildi_6cf847', 'Göndərildi'), delivered: tr('adminorders_catdirildi_324039', 'Çatdırıldı'), cancelled: tr('adminorders_legv_edildi_bfa98b', 'Ləğv edildi'),
};
/** Normal forward flow; "cancelled" is available from any open status. */
const NEXT: Record<string, { status: Order['status']; label: string; icon: typeof CheckCircle } | undefined> = {
  pending: { status: 'confirmed', label: 'Təsdiqlə', icon: CheckCircle }, confirmed: { status: 'processing', label: 'Hazırlamağa başla', icon: Package },
  processing: { status: 'shipped', label: 'Göndərildi et', icon: Truck }, shipped: { status: 'delivered', label: 'Çatdırıldı et', icon: CheckCircle },
};
const customerName = (order: AdminOrder) => order.shipping_address?.name || '—';
const customerPhone = (order: AdminOrder) => order.phone || order.shipping_address?.phone || '';
const paymentLabel = (method?: string | null) => !method ? '—' : method === 'cash' ? tr('adminorders_pay_cash', 'Qapıda nağd') : method === 'card' ? tr('adminorders_pay_card', 'Qapıda kartla') : method;

export function StatusSelect({ value, onChange, disabled }: { value: string; onChange: (status: Order['status']) => void; disabled?: boolean }) {
  return (
    <select className="ak-select" aria-label="Status" value={value} disabled={disabled} onClick={event => event.stopPropagation()}
      onChange={event => onChange(event.target.value as Order['status'])} style={{ height: 30, fontSize: 12.5 }}>
      {ORDER_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
    </select>
  );
}

const AdminOrders = () => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const client = useQueryClient();
  const [status, setStatus] = useState('all'), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['admin-orders-page', status, search, page], queryFn: () => fetchOrdersPage(status, search, page), placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 20_000 });
  const stats = useQuery({ queryKey: ['admin-orders-stats'], queryFn: fetchOrderStats, ...ADMIN_QUERY });
  const counts = stats.data?.byStatus ?? {};

  const changeStatus = async (order: AdminOrder, next: Order['status']) => {
    if (next === order.status) return;
    if (next === 'cancelled' && !(await confirm({ title: `${order.order_number} ləğv edilsin?`, description: 'İstifadə olunmuş QayğıCash bonusu geri qaytarılır.', confirmLabel: 'Ləğv et', danger: true }))) return;
    setBusy(order.id);
    try {
      await setOrderStatus(order.id, next);
      toast({ title: tr('useorders_status_yenilendi_890662', 'Status yeniləndi') });
      setSelected(current => current?.id === order.id ? { ...current, status: next } : current);
      await Promise.all([client.invalidateQueries({ queryKey: ['admin-orders-page'] }), client.invalidateQueries({ queryKey: ['admin-orders-stats'] }), client.invalidateQueries({ queryKey: ['admin-overview-v1'] })]);
    } catch (error) {
      toast({ title: tr('useorders_xeta_3cdbb6', 'Xəta'), description: (error as Error).message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const bulkStatus = async (orders: AdminOrder[], next: Order['status'], clear: () => void) => {
    if (!(await confirm({ title: `${orders.length} sifarişin statusu “${STATUS_LABEL[next]}” olsun?`, confirmLabel: 'Təsdiqlə', danger: next === 'cancelled' }))) return;
    let failed = 0;
    for (const order of orders) { try { if (order.status !== next) await setOrderStatus(order.id, next); } catch { failed += 1; } }
    toast(failed ? { title: tr('useorders_xeta_3cdbb6', 'Xəta'), description: `${failed} sifariş yenilənmədi`, variant: 'destructive' } : { title: tr('useorders_status_yenilendi_890662', 'Status yeniləndi') });
    clear();
    await Promise.all([client.invalidateQueries({ queryKey: ['admin-orders-page'] }), client.invalidateQueries({ queryKey: ['admin-orders-stats'] })]);
  };

  const columns = useMemo<Column<AdminOrder>[]>(() => [
    { key: 'number', header: 'Sifariş', mobile: 'title', cell: order => <span><span className="ak-cell-main ak-mono">{order.order_number}</span><span className="ak-cell-sub">{fmtDateTime(order.created_at)}</span></span> },
    { key: 'customer', header: 'Müştəri', mobile: 'subtitle', cell: order => <span><span className="ak-cell-main">{customerName(order)}</span><span className="ak-cell-sub">{customerPhone(order) || '—'}</span></span> },
    { key: 'items', header: 'Məhsul', align: 'end', cell: order => <span className="ak-num">{order.items.reduce((sum, item) => sum + item.quantity, 0) || '—'}</span> },
    { key: 'payment', header: 'Ödəniş', mobile: 'hidden', cell: order => <span className="ak-cell-sub">{paymentLabel(order.payment_method)}</span> },
    { key: 'cashback', header: 'QayğıCash', align: 'end', cell: order => Number(order.cashback_used) > 0 ? <StatusPill tone="violet" dot={false}>−{fmtMoney(order.cashback_used)}</StatusPill> : <span className="ak-cell-sub">—</span> },
    { key: 'total', header: 'Məbləğ', align: 'end', cell: order => <strong className="ak-num">{fmtMoney(order.total_amount)}</strong> },
    { key: 'status', header: 'Status', cell: order => <StatusSelect value={order.status} disabled={busy === order.id} onChange={next => void changeStatus(order, next)} /> },
  ], [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page testId="admin-orders">
      <PageHeader title={tr('adminorders_sifarisler_660280', 'Sifarişlər')} subtitle="Anacan Aptek sifarişləri: status axını, çatdırılma və QayğıCash istifadəsi"
        actions={<Btn onClick={() => { void list.refetch(); void stats.refetch(); }} disabled={list.isFetching}><RefreshCw size={15} className={list.isFetching ? 'animate-spin' : ''} />Yenilə</Btn>} />
      <KpiRow columns={5}>
        <StatTile label={tr('adminorders_umumi_1b5521', 'Ümumi')} icon={<Package size={13} />} loading={stats.isLoading} value={fmtNumber(stats.data?.total)} />
        <StatTile label={tr('adminorders_gozleyir_9ac18a', 'Gözləyir')} tone={counts.pending ? 'warning' : 'default'} icon={<Clock size={13} />} loading={stats.isLoading} value={fmtNumber(counts.pending ?? 0)}
          onClick={() => { setStatus('pending'); setPage(0); }} />
        <StatTile label={tr('adminorders_hazirlanir_c15a4b', 'Hazırlanır')} icon={<Truck size={13} />} loading={stats.isLoading} value={fmtNumber((counts.confirmed ?? 0) + (counts.processing ?? 0))} hint={`${fmtNumber(counts.shipped ?? 0)} yolda`} />
        <StatTile label={tr('adminorders_catdirildi_324039', 'Çatdırıldı')} tone="success" icon={<CheckCircle size={13} />} loading={stats.isLoading} value={fmtNumber(counts.delivered ?? 0)} />
        <StatTile label={tr('adminorders_gelir_92208b', 'Gəlir')} tone="accent" icon={<Wallet size={13} />} loading={stats.isLoading} value={fmtMoney(stats.data?.deliveredRevenue)}
          hint={stats.data?.cashbackUsed != null ? `QayğıCash: ${fmtMoney(stats.data.cashbackUsed)}` : 'çatdırılmış sifarişlər'} />
      </KpiRow>
      <Section flush>
        <div className="px-4 pb-3 grid gap-2.5">
          <Toolbar><SearchInput value={search} onChange={value => { setSearch(value); setPage(0); }} placeholder={tr('adminorders_sifaris_nomresi_ad_ve_ya_telefon_24cdf0', 'Sifariş nömrəsi, ad və ya telefon...')} label="Sifariş axtar" /></Toolbar>
          <FilterChips label="Status" value={status} onChange={value => { setStatus(value); setPage(0); }}
            options={[{ value: 'all', label: tr('adminorders_hamisi_c73c4d', 'Hamısı'), count: stats.data?.total }, ...ORDER_STATUSES.map(value => ({ value, label: STATUS_LABEL[value], count: counts[value] ?? (stats.data ? 0 : null) }))]} />
        </div>
        <DataTable testId="admin-orders-table" rowTestId="admin-order-row" columns={columns} rows={list.data?.rows} rowKey={order => order.id} loading={list.isLoading}
          fetching={list.isFetching && !list.isLoading} error={list.isError ? list.error : null} onRetry={() => void list.refetch()}
          page={page} total={list.data?.total ?? 0} pageSize={ORDERS_PAGE_SIZE} onPageChange={setPage} onRowClick={order => setSelected(order)} selectable
          bulkActions={(rows, clear) => <>
            <Btn size="sm" onClick={() => void bulkStatus(rows, 'confirmed', clear)}>Təsdiqlə</Btn>
            <Btn size="sm" onClick={() => void bulkStatus(rows, 'shipped', clear)}>Göndərildi</Btn>
            <Btn size="sm" onClick={() => void bulkStatus(rows, 'delivered', clear)}>Çatdırıldı</Btn>
          </>}
          empty={<EmptyState icon={<Package size={20} />} title={tr('adminorders_sifaris_tapilmadi_08e5bf', 'Sifariş tapılmadı')} />} />
      </Section>
      {selected && <OrderDrawer order={selected} busy={busy === selected.id} onClose={() => setSelected(null)} onStatus={next => void changeStatus(selected, next)} />}
    </Page>
  );
};

function OrderDrawer({ order, busy, onClose, onStatus }: { order: AdminOrder; busy: boolean; onClose: () => void; onStatus: (status: Order['status']) => void }) {
  const next = NEXT[order.status];
  const flow: Order['status'][] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const reached = flow.indexOf(order.status);
  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} size="lg" testId="admin-order-drawer"
      title={<span className="flex items-center gap-2 flex-wrap"><span className="ak-mono">{order.order_number}</span><StatusPill tone={toneFor(order.status)}>{STATUS_LABEL[order.status] ?? order.status}</StatusPill></span>}
      description={fmtDateTime(order.created_at)}
      footer={<>
        {order.status !== 'cancelled' && order.status !== 'delivered' && <Btn variant="ghost" disabled={busy} onClick={() => onStatus('cancelled')}><XCircle size={14} />Ləğv et</Btn>}
        <StatusSelect value={order.status} disabled={busy} onChange={onStatus} />
        {next && <Btn variant="primary" disabled={busy} onClick={() => onStatus(next.status)}><next.icon size={14} />{next.label}</Btn>}
      </>}>
      <ol className="flex items-center gap-1" aria-label="Status axını">
        {flow.map((step, index) => (
          <li key={step} className="flex-1 grid gap-1 text-center" aria-current={step === order.status ? 'step' : undefined}>
            <span className="ak-meter"><i style={{ width: order.status !== 'cancelled' && index <= reached ? '100%' : '0%' }} /></span>
            <span className="ak-cell-sub" style={{ fontSize: 11, fontWeight: step === order.status ? 650 : 400 }}>{STATUS_LABEL[step]}</span>
          </li>
        ))}
      </ol>
      {order.status === 'cancelled' && <Notice tone="warning">Sifariş ləğv edilib. QayğıCash bonusu istifadəçiyə qaytarılıb.</Notice>}
      {order.shipping_address && (
        <Section title={<span className="flex items-center gap-2"><MapPin size={14} />{tr('adminorders_catdirilma_unvani_10ea11', 'Çatdırılma Ünvanı')}</span>}>
          <DescriptionList items={[
            ['Ad', order.shipping_address.name], ['Telefon', customerPhone(order) ? <a key="t" className="text-primary" href={`tel:${customerPhone(order)}`}><Phone size={12} className="inline me-1" />{customerPhone(order)}</a> : '—'],
            ['Ünvan', [order.shipping_address.address, order.shipping_address.line, order.shipping_address.city].filter(Boolean).join(', ') || '—'],
            ...(order.delivery_slot ? [[tr('adminorders_delivery_slot', 'Çatdırılma vaxtı'), order.delivery_slot] as [string, string]] : []),
            ...(order.payment_method ? [[tr('adminorders_payment', 'Ödəniş'), paymentLabel(order.payment_method)] as [string, string]] : []),
          ]} />
        </Section>
      )}
      {order.items.length > 0 && (
        <Section title={tr('adminorders_mehsullar_24a4ce', 'Məhsullar')} flush>
          <table className="ak-table"><thead><tr><th>Məhsul</th><th style={{ textAlign: 'end' }}>Say</th><th style={{ textAlign: 'end' }}>Qiymət</th><th style={{ textAlign: 'end' }}>Cəmi</th></tr></thead>
            <tbody>{order.items.map(item => <tr key={item.id}><td>{item.product_name}</td><td style={{ textAlign: 'end' }}>{item.quantity}</td><td style={{ textAlign: 'end' }}>{fmtMoney(item.unit_price)}</td><td style={{ textAlign: 'end' }}>{fmtMoney(item.total_price)}</td></tr>)}</tbody></table>
        </Section>
      )}
      <Section title="Hesab">
        <DescriptionList items={[
          ['Ara cəm', fmtMoney(order.subtotal ?? null)], ['Endirim', order.discount_amount ? `−${fmtMoney(order.discount_amount)}${order.coupon_code ? ` · ${order.coupon_code}` : ''}` : '—'],
          ['Çatdırılma', fmtMoney(order.shipping_fee ?? null)], ['QayğıCash istifadə', Number(order.cashback_used) > 0 ? `−${fmtMoney(order.cashback_used)}` : '—'],
          ['Yekun', <strong key="t">{fmtMoney(order.total_amount)}</strong>], ['Mağaza', order.store === 'aptek' ? 'Anacan Aptek' : order.store || '—'],
        ]} />
      </Section>
      {order.notes && <Notice>{tr('adminorders_qeydler_a7a98b', 'Qeydlər')}: {order.notes}</Notice>}
    </SideDrawer>
  );
}

export default AdminOrders;
