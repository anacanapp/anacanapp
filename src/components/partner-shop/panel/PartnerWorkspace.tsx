/**
 * One partner's workspace: overview statistics, products (price, stock, visibility), campaigns, sales, team, history.
 * Used by the partner panel (/partner) and by Admin › Partnyor mağazaları. The server enforces the role on every call.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Eye, EyeOff, ExternalLink, History, Megaphone, MousePointerClick, Package, Plus, Receipt, ShoppingBag, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  AdminTabs, Btn, DataTable, EmptyState, Field, FieldGrid, FilterChips, KpiRow, MultiChips, Notice, Section, SideDrawer, StatTile, StatusPill,
  downloadCsv, fmtDate, fmtDateTime, fmtMoney, fmtNumber, useAdminConfirm, type Column,
} from '@/components/admin/kit';
import {
  CAMPAIGN_STATUS_LABEL, PLACEMENT_LABEL, canWrite, daysAgo, bakuToday, prpc, toLocalInput,
  type DashboardDay, type DashboardProduct, type PanelCampaign, type PanelDashboard, type PanelPartner, type PanelProduct,
} from '@/lib/partner-panel';
import { SHOP_COLLECTIONS, SHOP_COLLECTION_LABEL, type ShopCollection } from '@/lib/partner-shop';
import { PartnerAudit, PartnerSales, PartnerTeam } from './PartnerOps';

type Tab = 'overview' | 'products' | 'campaigns' | 'sales' | 'team' | 'audit';
const key = (...parts: unknown[]) => ['partner-panel', ...parts];

export function PartnerWorkspace({ partner }: { partner: PanelPartner }) {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="grid gap-4">
      {partner.status !== 'live' && (
        <Notice tone="warning">
          {partner.status === 'paused'
            ? 'Mağaza dayandırılıb: tətbiqdə istifadəçilərə göstərilmir. Panel işləməyə davam edir.'
            : 'Mağaza önizləmədədir: tətbiqdə hələlik yalnız Anacan adminləri və sizin komanda görür. Bu baxışlar statistikada "daxili" sayılır.'}
        </Notice>
      )}
      <AdminTabs<Tab> value={tab} onChange={setTab} label="Panel bölmələri" items={[
        { value: 'overview', label: 'İcmal', icon: <BarChart3 size={15} /> },
        { value: 'products', label: 'Məhsullar', icon: <Package size={15} /> },
        { value: 'campaigns', label: 'Kampaniyalar', icon: <Megaphone size={15} /> },
        { value: 'sales', label: 'Satışlar', icon: <Receipt size={15} /> },
        { value: 'team', label: 'Komanda', icon: <Users size={15} /> },
        { value: 'audit', label: 'Tarixçə', icon: <History size={15} /> },
      ]} />
      {tab === 'overview' && <Overview partner={partner} />}
      {tab === 'products' && <Products partner={partner} />}
      {tab === 'campaigns' && <Campaigns partner={partner} />}
      {tab === 'sales' && <PartnerSales partner={partner} />}
      {tab === 'team' && <PartnerTeam partner={partner} />}
      {tab === 'audit' && <PartnerAudit partner={partner} />}
    </div>
  );
}

/* ───────────── Overview ───────────── */
type Metric = 'impressions' | 'opens' | 'adds' | 'site' | 'revenue';
const METRIC_LABEL: Record<Metric, string> = { impressions: 'Göstərim', opens: 'Açılış', adds: 'Səbətə atma', site: 'Sayta keçid', revenue: 'Satış ₼' };
const pct = (a: number, b: number) => (b > 0 ? `${fmtNumber((a / b) * 100, 1)}%` : '—');

function DailyBars({ days, metric }: { days: DashboardDay[]; metric: Metric }) {
  const values = days.map((d) => Number(d[metric]) || 0);
  const max = Math.max(1, ...values);
  const W = 640, H = 160, pad = 22, bw = (W - pad) / Math.max(1, days.length);
  const ticks = [0, max / 2, max];
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`${METRIC_LABEL[metric]} günlər üzrə`} style={{ width: '100%', minWidth: 320, display: 'block' }}>
        {ticks.map((t) => {
          const y = H - (t / max) * (H - 10);
          return <g key={t}><line x1={pad} x2={W} y1={y} y2={y} stroke="var(--ad-border)" strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={10} fill="var(--ad-text-3)">{metric === 'revenue' ? Math.round(t) : Math.round(t)}</text></g>;
        })}
        {days.map((d, i) => {
          const v = values[i], h = (v / max) * (H - 10);
          return <g key={d.d}>
            <rect x={pad + i * bw + bw * 0.15} y={H - h} width={Math.max(1, bw * 0.7)} height={h} rx={2} fill="var(--ad-accent)" opacity={v ? 0.9 : 0.15}>
              <title>{`${fmtDate(d.d)}: ${metric === 'revenue' ? fmtMoney(v) : fmtNumber(v)}`}</title>
            </rect>
            {(i === 0 || i === days.length - 1 || (days.length <= 14) || i % Math.ceil(days.length / 6) === 0) &&
              <text x={pad + i * bw + bw / 2} y={H + 15} fontSize={10} textAnchor="middle" fill="var(--ad-text-3)">{d.d.slice(8, 10)}.{d.d.slice(5, 7)}</text>}
          </g>;
        })}
      </svg>
    </div>
  );
}

function Overview({ partner }: { partner: PanelPartner }) {
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [internal, setInternal] = useState(partner.status !== 'live');
  const [metric, setMetric] = useState<Metric>('impressions');
  const from = daysAgo(Number(range) - 1), to = bakuToday();
  const q = useQuery({
    queryKey: key('dash', partner.id, from, to, internal), staleTime: 60_000,
    queryFn: () => prpc<PanelDashboard>('shop_partner_dashboard_v1', { p_partner: partner.id, p_from: from, p_to: to, p_internal: internal }),
  });
  const d = q.data;
  const adds = d ? d.kpis.adds + d.kpis.bundles : 0;
  const cols: Column<DashboardProduct>[] = [
    { key: 'name', header: 'Məhsul', mobile: 'title', sortable: true, sortValue: (r) => r.name, cell: (r) => (
      <span className="ak-cell-user">
        <span className="h-9 w-9 rounded-lg bg-white border flex items-center justify-center shrink-0">{r.image_url && <img src={r.image_url} alt="" className="max-h-[90%] max-w-[90%] object-contain" />}</span>
        <span className="ak-cell-main">{r.name}{!r.listed && <span className="ak-cell-sub">gizlidir</span>}</span>
      </span>) },
    { key: 'i', header: 'Göstərim', align: 'end', sortable: true, sortValue: (r) => r.impressions, cell: (r) => fmtNumber(r.impressions) },
    { key: 'o', header: 'Açılış', align: 'end', sortable: true, sortValue: (r) => r.opens, cell: (r) => fmtNumber(r.opens) },
    { key: 'a', header: 'Səbət', align: 'end', sortable: true, sortValue: (r) => r.adds, cell: (r) => fmtNumber(r.adds) },
    { key: 's', header: 'Sayta keçid', align: 'end', sortable: true, sortValue: (r) => r.site, cell: (r) => fmtNumber(r.site) },
    { key: 'cr', header: 'Keçid / göstərim', align: 'end', mobile: 'meta', cell: (r) => pct(r.site, r.impressions) },
    { key: 'sold', header: 'Satılıb', align: 'end', sortable: true, sortValue: (r) => r.sold, cell: (r) => fmtNumber(r.sold) },
    { key: 'rev', header: 'Gəlir', align: 'end', sortable: true, sortValue: (r) => r.revenue, cell: (r) => fmtMoney(r.revenue) },
  ];
  const exportCsv = () => d && downloadCsv(`${partner.slug}-statistika-${from}-${to}.csv`, [
    ['Məhsul', 'Göstərim', 'Açılış', 'Səbət', 'Sayta keçid', 'Satılıb', 'Gəlir'],
    ...d.products.map((p) => [p.name, p.impressions, p.opens, p.adds, p.site, p.sold, p.revenue]),
  ]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips<'7' | '30' | '90'> label="Müddət" value={range} onChange={setRange} options={[{ value: '7', label: '7 gün' }, { value: '30', label: '30 gün' }, { value: '90', label: '90 gün' }]} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={internal} onCheckedChange={setInternal} aria-label="Daxili baxışları da say" />Daxili baxışları da say (admin və komanda)</label>
      </div>
      <KpiRow columns={6}>
        <StatTile label="Göstərim" icon={<Eye size={14} />} value={d ? fmtNumber(d.kpis.impressions) : '—'} loading={q.isLoading} hint="Kart ekranda görünüb (gündə 1 dəfə sayılır)" />
        <StatTile label="Məhsul açılışı" icon={<MousePointerClick size={14} />} value={d ? fmtNumber(d.kpis.opens) : '—'} loading={q.isLoading} hint={d ? `Göstərimin ${pct(d.kpis.opens, d.kpis.impressions)}` : undefined} />
        <StatTile label="Səbətə atma" icon={<ShoppingBag size={14} />} value={d ? fmtNumber(adds) : '—'} loading={q.isLoading} hint={d && d.kpis.bundles ? `${fmtNumber(d.kpis.bundles)} dəst daxil` : undefined} />
        <StatTile label="Sayta keçid" icon={<ExternalLink size={14} />} value={d ? fmtNumber(d.kpis.site) : '—'} loading={q.isLoading} tone="accent" hint="UTM: utm_source=anacan" />
        <StatTile label="Əhatə" icon={<Users size={14} />} value={d ? fmtNumber(d.kpis.reach) : '—'} loading={q.isLoading} hint="Unikal istifadəçi" />
        <StatTile label="Satış" icon={<Receipt size={14} />} value={d ? fmtMoney(d.sales.revenue) : '—'} loading={q.isLoading}
          hint={d ? `${fmtNumber(d.sales.quantity)} ədəd${d.commission_pct != null ? ` · komissiya ${fmtMoney(d.sales.commission)}` : ''}` : undefined} />
      </KpiRow>
      {d && !internal && d.internal_events > 0 && <p className="text-xs text-muted-foreground">Bu müddətdə {fmtNumber(d.internal_events)} daxili hadisə (admin və komanda) sayılmayıb.</p>}
      <Section title="Günlər üzrə">
        <div className="flex flex-wrap gap-2 mb-3">
          <FilterChips<Metric> label="Göstərici" value={metric} onChange={setMetric}
            options={(Object.keys(METRIC_LABEL) as Metric[]).map((m) => ({ value: m, label: METRIC_LABEL[m] }))} />
        </div>
        {d ? <DailyBars days={d.daily} metric={metric} /> : <div className="ak-skeleton" style={{ height: 160 }} />}
      </Section>
      <Section title="Məhsullar üzrə" flush actions={<Btn size="sm" onClick={exportCsv} disabled={!d}>CSV</Btn>}>
        <DataTable columns={cols} rows={d?.products} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pageSize={20}
          empty={<EmptyState compact title="Məhsul yoxdur" />} />
      </Section>
      {!!d?.placements.length && (
        <Section title="Harada göstərilib" flush>
          <DataTable columns={[
            { key: 'p', header: 'Yer', mobile: 'title', cell: (r) => PLACEMENT_LABEL(r.placement) },
            { key: 'i', header: 'Göstərim', align: 'end', cell: (r) => fmtNumber(r.impressions) },
            { key: 'o', header: 'Açılış', align: 'end', cell: (r) => fmtNumber(r.opens) },
            { key: 'a', header: 'Səbət', align: 'end', cell: (r) => fmtNumber(r.adds) },
            { key: 's', header: 'Sayta keçid', align: 'end', cell: (r) => fmtNumber(r.site) },
          ]} rows={d.placements} rowKey={(r) => r.placement} />
        </Section>
      )}
    </div>
  );
}

/* ───────────── Products ───────────── */
interface ProductForm { name: string; sku: string; price: string; original_price: string; stock: string; image_url: string; source_url: string; description: string; tags: ShopCollection[]; listed: boolean }
const emptyProduct: ProductForm = { name: '', sku: '', price: '', original_price: '', stock: '', image_url: '', source_url: '', description: '', tags: [], listed: true };
const toForm = (p: PanelProduct): ProductForm => ({
  name: p.name, sku: p.sku || '', price: String(p.price ?? ''), original_price: p.original_price != null ? String(p.original_price) : '',
  stock: p.stock != null ? String(p.stock) : '', image_url: p.image_url || '', source_url: p.source_url || '', description: p.description || '',
  tags: (p.tags || []).filter((t) => (SHOP_COLLECTIONS as string[]).includes(t)), listed: p.listed,
});

function Products({ partner }: { partner: PanelPartner }) {
  const qc = useQueryClient(), confirm = useAdminConfirm(), writable = canWrite(partner.role);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PanelProduct | 'new' | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [initial, setInitial] = useState<ProductForm>(emptyProduct);
  const [stockFor, setStockFor] = useState<{ ids: string[]; value: string } | null>(null);
  const q = useQuery({ queryKey: key('products', partner.id), queryFn: () => prpc<PanelProduct[]>('shop_partner_products_v1', { p_partner: partner.id }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key('products', partner.id) }); qc.invalidateQueries({ queryKey: key('dash', partner.id) }); qc.invalidateQueries({ queryKey: ['partner-storefront'] }); };
  const save = useMutation({
    mutationFn: () => prpc<string>('shop_partner_product_save_v1', { p_partner: partner.id, p_product: editing === 'new' ? null : (editing as PanelProduct).id, p_data: form }),
    onSuccess: () => { refresh(); setEditing(null); toast.success('Məhsul yadda saxlanıldı'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulk = useMutation({
    mutationFn: (v: { ids: string[]; action: 'list' | 'unlist' | 'stock' | 'delete'; value?: number | null }) =>
      prpc<number>('shop_partner_products_bulk_v1', { p_partner: partner.id, p_ids: v.ids, p_action: v.action, p_value: v.value ?? null }),
    onSuccess: (n) => { refresh(); setStockFor(null); toast.success(`${n} məhsul yeniləndi`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const open = (p: PanelProduct | 'new') => { const f = p === 'new' ? emptyProduct : toForm(p); setForm(f); setInitial(f); setEditing(p); };
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase('az');
    return (q.data || []).filter((p) => !s || `${p.name} ${p.sku || ''}`.toLocaleLowerCase('az').includes(s));
  }, [q.data, search]);
  const cols: Column<PanelProduct>[] = [
    { key: 'name', header: 'Məhsul', mobile: 'title', sortable: true, sortValue: (r) => r.name, cell: (r) => (
      <span className="ak-cell-user">
        <span className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shrink-0">{r.image_url && <img src={r.image_url} alt="" className="max-h-[90%] max-w-[90%] object-contain" loading="lazy" />}</span>
        <span className="min-w-0"><span className="ak-cell-main">{r.name}</span>{r.sku && <span className="ak-cell-sub ak-mono">{r.sku}</span>}</span>
      </span>) },
    { key: 'price', header: 'Qiymət', align: 'end', sortable: true, sortValue: (r) => r.price, cell: (r) => (
      <span className="tabular-nums">{fmtMoney(r.price)}{r.original_price ? <span className="ak-cell-sub line-through">{fmtMoney(r.original_price)}</span> : null}</span>) },
    { key: 'stock', header: 'Stok', align: 'end', sortable: true, sortValue: (r) => r.stock ?? Number.MAX_SAFE_INTEGER, cell: (r) =>
      r.stock == null ? <span className="text-muted-foreground">izlənmir</span> : r.stock === 0 ? <StatusPill tone="danger">Bitib</StatusPill> : fmtNumber(r.stock) },
    { key: 'listed', header: 'Tətbiqdə', cell: (r) => r.listed ? <StatusPill tone="success">Görünür</StatusPill> : <StatusPill tone="neutral">Gizli</StatusPill> },
    { key: 'tags', header: 'Kolleksiya', mobile: 'meta', cell: (r) => (r.tags || []).map((t) => SHOP_COLLECTION_LABEL[t as ShopCollection] || t).join(', ') || '—' },
  ];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <input className="ak-input" style={{ maxWidth: 320 }} placeholder="Ad və ya SKU ilə axtar" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Məhsul axtar" />
        <div className="flex gap-2">
          <Btn size="sm" disabled={!q.data?.length} onClick={() => downloadCsv(`${partner.slug}-mehsullar.csv`, [
            ['SKU', 'Ad', 'Qiymət', 'Köhnə qiymət', 'Stok', 'Tətbiqdə', 'Link'],
            ...(q.data || []).map((p) => [p.sku, p.name, p.price, p.original_price, p.stock, p.listed ? 'bəli' : 'xeyr', p.source_url])])}>CSV</Btn>
          {writable && <Btn variant="primary" size="sm" onClick={() => open('new')}><Plus size={14} />Yeni məhsul</Btn>}
        </div>
      </div>
      <Section flush>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pageSize={25}
          onRowClick={(r) => open(r)} selectable={writable}
          bulkActions={(selected, clear) => <>
            <Btn size="sm" onClick={() => bulk.mutate({ ids: selected.map((s) => s.id), action: 'list' }, { onSuccess: clear })}><Eye size={14} />Göstər</Btn>
            <Btn size="sm" onClick={() => bulk.mutate({ ids: selected.map((s) => s.id), action: 'unlist' }, { onSuccess: clear })}><EyeOff size={14} />Gizlə</Btn>
            <Btn size="sm" onClick={() => setStockFor({ ids: selected.map((s) => s.id), value: '' })}>Stok</Btn>
            <Btn size="sm" variant="danger" onClick={async () => {
              if (await confirm({ title: `${selected.length} məhsul silinsin?`, description: 'Statistikası tarixçədə qalır, məhsul isə geri qaytarılmır.', confirmLabel: 'Sil', danger: true }))
                bulk.mutate({ ids: selected.map((s) => s.id), action: 'delete' }, { onSuccess: clear });
            }}><Trash2 size={14} />Sil</Btn>
          </>}
          empty={<EmptyState title="Hələ məhsul yoxdur" description={writable ? 'İlk məhsulu əlavə edin.' : undefined}
            action={writable ? <Btn variant="primary" onClick={() => open('new')}><Plus size={14} />Yeni məhsul</Btn> : undefined} />} />
      </Section>

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Yeni məhsul' : 'Məhsulu redaktə et'}
        description={writable ? 'Dəyişikliklər tətbiqdə dərhal görünür.' : 'Sizin rolunuz yalnız baxış üçündür.'}
        onSave={writable ? () => save.mutate() : undefined} saving={save.isPending} saveDisabled={!writable || !form.name.trim() || form.price === ''}
        dirty={JSON.stringify(form) !== JSON.stringify(initial)} footer={writable ? undefined : null} size="lg">
        <fieldset disabled={!writable} className="grid gap-3">
          <Field label="Ad" required>{(id) => <input id={id} className="ak-input" value={form.name} maxLength={160} onChange={(e) => set('name', e.target.value)} />}</Field>
          <FieldGrid cols={3}>
            <Field label="Qiymət (₼)" required>{(id) => <input id={id} className="ak-input" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value.replace(',', '.'))} />}</Field>
            <Field label="Köhnə qiymət (₼)" hint="Üstündən xətt çəkilir">{(id) => <input id={id} className="ak-input" inputMode="decimal" value={form.original_price} onChange={(e) => set('original_price', e.target.value.replace(',', '.'))} />}</Field>
            <Field label="Stok" hint="Boş: izlənmir. 0: tətbiqdə gizlənir">{(id) => <input id={id} className="ak-input" inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} />}</Field>
          </FieldGrid>
          <FieldGrid>
            <Field label="SKU">{(id) => <input id={id} className="ak-input ak-mono" value={form.sku} maxLength={64} onChange={(e) => set('sku', e.target.value)} />}</Field>
            <Field label="Məhsul linki" hint="Saytınızdakı səhifə (https://)">{(id) => <input id={id} className="ak-input" value={form.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://" />}</Field>
          </FieldGrid>
          <Field label="Şəkil linki" hint="https:// ilə başlayan şəkil ünvanı">{(id) => (
            <div className="flex items-center gap-3">
              <span className="h-16 w-16 rounded-lg bg-white border flex items-center justify-center shrink-0">{form.image_url && <img src={form.image_url} alt="" className="max-h-[90%] max-w-[90%] object-contain" />}</span>
              <input id={id} className="ak-input" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://" />
            </div>)}</Field>
          <Field label="Qısa izah" hint="Tətbiqdə 'Niyə sənə' kimi görünür (1000 simvola qədər)">{(id) => <textarea id={id} className="ak-textarea" rows={3} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />}</Field>
          <Field label="Kolleksiyalar" hint="Məhsulun hansı istifadəçilərə təklif olunacağını müəyyən edir">{() =>
            <MultiChips<ShopCollection> label="Kolleksiyalar" value={form.tags} onChange={(v) => set('tags', v)} options={SHOP_COLLECTIONS.map((c) => ({ value: c, label: SHOP_COLLECTION_LABEL[c] }))} />}</Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.listed} onCheckedChange={(v) => set('listed', v)} aria-label="Tətbiqdə göstər" />Tətbiqdə göstər</label>
        </fieldset>
      </SideDrawer>

      <SideDrawer open={!!stockFor} onOpenChange={(o) => !o && setStockFor(null)} title={`${stockFor?.ids.length || 0} məhsulun stoku`}
        onSave={() => stockFor && bulk.mutate({ ids: stockFor.ids, action: 'stock', value: stockFor.value === '' ? null : Number(stockFor.value) })} saving={bulk.isPending}>
        <Field label="Stok" hint="Boş buraxsanız stok izlənmir">{(id) => <input id={id} className="ak-input" inputMode="numeric" value={stockFor?.value || ''} onChange={(e) => setStockFor((s) => s && { ...s, value: e.target.value.replace(/\D/g, '') })} />}</Field>
      </SideDrawer>
    </div>
  );
}

/* ───────────── Campaigns ───────────── */
interface CampaignForm { title: string; description: string; discount_pct: string; starts_at: string; ends_at: string; all: boolean; product_ids: string[] }
const freshCampaign = (): CampaignForm => {
  const now = new Date(), end = new Date(now.getTime() + 7 * 86400_000);
  return { title: '', description: '', discount_pct: '10', starts_at: toLocalInput(now.toISOString()), ends_at: toLocalInput(end.toISOString()), all: true, product_ids: [] };
};
const campaignTone = (c: PanelCampaign) => c.live ? 'success' : c.status === 'pending' ? 'warning' : c.status === 'rejected' ? 'danger' : c.status === 'approved' ? 'info' : 'neutral';

function Campaigns({ partner }: { partner: PanelPartner }) {
  const qc = useQueryClient(), confirm = useAdminConfirm(), writable = canWrite(partner.role);
  const [editing, setEditing] = useState<PanelCampaign | 'new' | null>(null);
  const [form, setForm] = useState<CampaignForm>(freshCampaign);
  const [pick, setPick] = useState('');
  const q = useQuery({ queryKey: key('campaigns', partner.id), queryFn: () => prpc<PanelCampaign[]>('shop_partner_campaigns_v1', { p_partner: partner.id }) });
  const products = useQuery({ queryKey: key('products', partner.id), queryFn: () => prpc<PanelProduct[]>('shop_partner_products_v1', { p_partner: partner.id }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key('campaigns', partner.id) }); qc.invalidateQueries({ queryKey: ['partner-storefront'] }); qc.invalidateQueries({ queryKey: ['admin-shop-partners'] }); };
  const save = useMutation({
    mutationFn: () => prpc<string>('shop_partner_campaign_save_v1', { p_partner: partner.id, p_campaign: editing === 'new' ? null : (editing as PanelCampaign).id, p_data: {
      title: form.title, description: form.description, discount_pct: form.discount_pct.replace(',', '.'),
      starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), product_ids: form.all ? [] : form.product_ids } }),
    onSuccess: () => { refresh(); setEditing(null); toast.success(partner.role === 'admin' ? 'Kampaniya yadda saxlanıldı və aktivdir' : 'Kampaniya təsdiqə göndərildi'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => prpc('shop_partner_campaign_cancel_v1', { p_partner: partner.id, p_campaign: id }),
    onSuccess: () => { refresh(); toast.success('Kampaniya ləğv olundu'); }, onError: (e: Error) => toast.error(e.message),
  });
  const open = (c: PanelCampaign | 'new') => {
    setForm(c === 'new' ? freshCampaign() : { title: c.title, description: c.description || '', discount_pct: String(c.discount_pct), starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at), all: !c.product_ids.length, product_ids: c.product_ids });
    setPick(''); setEditing(c);
  };
  const set = <K extends keyof CampaignForm>(k: K, v: CampaignForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const names = new Map((products.data || []).map((p) => [p.id, p.name]));
  const cols: Column<PanelCampaign>[] = [
    { key: 't', header: 'Kampaniya', mobile: 'title', cell: (r) => <span className="ak-cell-main">{r.title}{r.review_note && <span className="ak-cell-sub">Anacan: {r.review_note}</span>}</span> },
    { key: 'd', header: 'Endirim', align: 'end', cell: (r) => `−${fmtNumber(r.discount_pct)}%` },
    { key: 'p', header: 'Məhsullar', cell: (r) => r.product_ids.length ? `${r.product_ids.length} məhsul` : 'Hamısı' },
    { key: 'w', header: 'Müddət', mobile: 'meta', cell: (r) => `${fmtDateTime(r.starts_at)} – ${fmtDateTime(r.ends_at)}` },
    { key: 's', header: 'Status', cell: (r) => <StatusPill tone={campaignTone(r)}>{r.live ? 'Canlı' : CAMPAIGN_STATUS_LABEL[r.status]}</StatusPill> },
  ];
  const filtered = (products.data || []).filter((p) => !pick.trim() || p.name.toLocaleLowerCase('az').includes(pick.trim().toLocaleLowerCase('az')));
  return (
    <div className="grid gap-3">
      <Notice tone="info">Kampaniya Anacan tərəfindən təsdiqləndikdən sonra tətbiqdə endirimli qiymət və kampaniya adı ilə görünür. Dəyişiklik edəndə kampaniya yenidən təsdiqə gedir.</Notice>
      {writable && <div><Btn variant="primary" size="sm" onClick={() => open('new')}><Plus size={14} />Yeni kampaniya</Btn></div>}
      <Section flush>
        <DataTable columns={cols} rows={q.data} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}
          onRowClick={writable ? (r) => r.status !== 'cancelled' && open(r) : undefined}
          actions={writable ? [{ label: 'Ləğv et', danger: true, hidden: (r) => r.status === 'cancelled', onSelect: async (r) => {
            if (await confirm({ title: `"${r.title}" ləğv olunsun?`, confirmLabel: 'Ləğv et', danger: true })) cancel.mutate(r.id);
          } }] : undefined}
          empty={<EmptyState title="Kampaniya yoxdur" description="Endirim kampaniyası yaradın, təsdiqdən sonra tətbiqdə görünəcək." />} />
      </Section>
      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Yeni kampaniya' : 'Kampaniyanı redaktə et'}
        onSave={() => save.mutate()} saving={save.isPending} saveLabel={partner.role === 'admin' ? 'Yadda saxla' : 'Təsdiqə göndər'}
        saveDisabled={!form.title.trim() || !form.discount_pct || (!form.all && !form.product_ids.length)} size="lg">
        <Field label="Ad" required>{(id) => <input id={id} className="ak-input" maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Məs.: Payız endirimi" />}</Field>
        <Field label="Təsvir">{(id) => <textarea id={id} className="ak-textarea" rows={2} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        <FieldGrid cols={3}>
          <Field label="Endirim (%)" required>{(id) => <input id={id} className="ak-input" inputMode="decimal" value={form.discount_pct} onChange={(e) => set('discount_pct', e.target.value)} />}</Field>
          <Field label="Başlayır" required>{(id) => <input id={id} type="datetime-local" className="ak-input" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />}</Field>
          <Field label="Bitir" required>{(id) => <input id={id} type="datetime-local" className="ak-input" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />}</Field>
        </FieldGrid>
        <Field label="Məhsullar">{() => (
          <div className="grid gap-2">
            <FilterChips<'all' | 'some'> label="Məhsullar" value={form.all ? 'all' : 'some'} onChange={(v) => set('all', v === 'all')}
              options={[{ value: 'all', label: 'Bütün məhsullar' }, { value: 'some', label: `Seçilmiş (${form.product_ids.length})` }]} />
            {!form.all && <>
              <input className="ak-input" placeholder="Məhsul axtar" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Kampaniya üçün məhsul axtar" />
              <div className="grid gap-1 max-h-72 overflow-y-auto border rounded-lg p-2">
                {filtered.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                    <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={(e) => set('product_ids', e.target.checked ? [...form.product_ids, p.id] : form.product_ids.filter((x) => x !== p.id))} />
                    <span className="truncate">{p.name}</span><span className="ms-auto tabular-nums text-muted-foreground">{fmtMoney(p.price)}</span>
                  </label>))}
                {!filtered.length && <span className="text-sm text-muted-foreground">Tapılmadı</span>}
              </div>
              {!!form.product_ids.length && <p className="text-xs text-muted-foreground">{form.product_ids.map((id) => names.get(id)).filter(Boolean).slice(0, 6).join(', ')}{form.product_ids.length > 6 ? ' …' : ''}</p>}
            </>}
          </div>)}</Field>
      </SideDrawer>
    </div>
  );
}
