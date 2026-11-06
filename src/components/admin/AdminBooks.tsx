import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, Download, FileWarning, Gift, Mail, RefreshCw, Search, ShoppingBag, TrendingUp, Users, Wallet, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { BOOKS, bookCover, findBook } from '@/lib/books/catalog';
import { AdminTabs, Btn, DataTable, EmptyState, ErrorState, FilterChips, KpiRow, Page, PageHeader, SearchInput, Section, SkeletonRows, StatTile, StatusPill, Toolbar, fmtDateTime, toneFor, type Column } from './kit';
import { ADMIN_QUERY } from './data/rpc';
import { BOOK_PRICE_TIERS, formatAzn } from '@/lib/books/pricing';

interface Dashboard {
  revenue: number; paid_orders: number; buyers: number; repeat_buyers: number; books_sold: number; avg_order: number; avg_books: number; avg_unit: number;
  checkouts: number; pending: number; failed: number; refunded: number; gifted: number; emails_missing: number; all_time_revenue: number;
  by_day: { day: string; revenue: number; orders: number }[]; by_bundle: { bucket: string; orders: number; revenue: number }[];
  by_age: { age: string; books: number; revenue: number }[]; top_books: { id: string; title: string; age: string; sold: number; revenue: number }[];
}
interface OrderRow { id: string; user_id: string; name: string | null; email: string; book_ids: string[]; amount: number; unit_price: number; status: string; provider: string;
  language: string; created_at: string; paid_at: string | null; email_sent_at: string | null; provider_transaction: string | null; admin_note: string | null; total_count: number }
interface CatalogRow { id: string; age_group: string; title: string; pages: number; pdf_path: string; active: boolean; has_pdf: boolean; sold: number; revenue: number }

const AGE: Record<string, string> = { '6m': '6+ ay', '1y': '1+ yaş', '2y': '2+ yaş', '3y': '3+ yaş', '4y': '4+ yaş', '5y': '5+ yaş', '6y': '6+ yaş' };
const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Ödənilib', cls: 'bg-green-500/10 text-green-700' }, pending: { label: 'Gözləyir', cls: 'bg-yellow-500/10 text-yellow-700' },
  failed: { label: 'Uğursuz', cls: 'bg-red-500/10 text-red-700' }, cancelled: { label: 'Ləğv', cls: 'bg-muted text-muted-foreground' },
  refunded: { label: 'Geri qaytarılıb', cls: 'bg-orange-500/10 text-orange-700' },
};
const num = (value: unknown) => Number(value ?? 0);
const date = (value: string | null) => value ? new Date(value).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

type BookTab = 'stats' | 'orders' | 'catalog' | 'settings' | 'guide';
export default function AdminBooks() {
  const [tab, setTab] = useState<BookTab>('stats');
  return (
    <Page testId="admin-books">
      <PageHeader icon={<BookOpen size={17} />} title="PDF kitablar" subtitle="Çap kitablarının satışı, sifarişlər, kataloq və ayarlar" />
      <AdminTabs value={tab} onChange={setTab} items={[{ value: 'stats', label: 'Göstəricilər' }, { value: 'orders', label: 'Sifarişlər' }, { value: 'catalog', label: 'Kataloq' },
        { value: 'settings', label: 'Ayarlar' }, { value: 'guide', label: 'Necə işləyir' }]} />
      {tab === 'stats' && <Stats />}
      {tab === 'orders' && <Orders />}
      {tab === 'catalog' && <Catalog />}
      {tab === 'settings' && <Settings />}
      {tab === 'guide' && <Guide />}
    </Page>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return <StatTile icon={<Icon size={13} />} label={label} value={value} hint={hint} />;
}

function Bars({ rows, label, value, format }: { rows: any[]; label: (row: any) => string; value: (row: any) => number; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(value));
  if (!rows.length) return <p className="text-sm text-muted-foreground">Hələ məlumat yoxdur.</p>;
  return <div className="space-y-2">{rows.map((row, index) => (
    <div key={index} className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-muted-foreground">{label(row)}</span>
      <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(value(row) / max) * 100}%` }} /></div>
      <span className="w-20 shrink-0 text-end font-medium">{format(value(row))}</span>
    </div>
  ))}</div>;
}

function Stats() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['admin-books-dashboard', days], ...ADMIN_QUERY, queryFn: async () => {
    const { data, error } = await rpc('admin_book_dashboard_v1', { p_days: days }); if (error) throw error; return data as Dashboard; } });
  const periods = (
    <Toolbar end={<button type="button" className="ak-icon-btn" aria-label="Yenilə" onClick={() => refetch()}><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /></button>}>
      <FilterChips label="Müddət" value={String(days)} onChange={value => setDays(Number(value))} options={[7, 30, 90, 365].map(value => ({ value: String(value), label: value === 365 ? '1 il' : `${value} gün` }))} />
    </Toolbar>
  );
  if (isLoading) return <div className="grid gap-4">{periods}<KpiRow columns={4}>{[0, 1, 2, 3].map(index => <StatTile key={index} label="…" value="" loading />)}</KpiRow></div>;
  if (error || !data) return <div className="grid gap-4">{periods}<ErrorState message="Göstəricilər yüklənmədi. Miqrasiya tətbiq olunub?" onRetry={() => refetch()} /></div>;
  const conversion = data.checkouts ? Math.round((data.paid_orders / data.checkouts) * 100) : 0;
  return (
    <div className="grid gap-4">
      {periods}
      <KpiRow columns={4}>
        <Kpi icon={Wallet} label="Gəlir" value={formatAzn(num(data.revenue))} hint={`Bütün dövr: ${formatAzn(num(data.all_time_revenue))}`} />
        <Kpi icon={ShoppingBag} label="Ödənilmiş sifariş" value={String(data.paid_orders)} hint={`${data.books_sold} kitab satılıb`} />
        <Kpi icon={TrendingUp} label="Orta çek" value={formatAzn(num(data.avg_order))} hint={`Sifarişdə ${num(data.avg_books)} kitab · kitabı ${formatAzn(num(data.avg_unit))}`} />
        <Kpi icon={Users} label="Alıcılar" value={String(data.buyers)} hint={`${data.repeat_buyers} təkrar alıcı`} />
        <Kpi icon={CheckCircle2} label="Konversiya" value={`${conversion}%`} hint={`${data.checkouts} ödəniş cəhdi`} />
        <Kpi icon={Clock} label="Gözləyən" value={String(data.pending)} hint="Ödəniş səhifəsində qalanlar" />
        <Kpi icon={XCircle} label="Uğursuz / ləğv" value={String(data.failed)} hint={`${data.refunded} geri qaytarılıb`} />
        <Kpi icon={Gift} label="Hədiyyə edilib" value={String(data.gifted)} hint={data.emails_missing ? `${data.emails_missing} e-poçt göndərilməyib` : 'Bütün e-poçtlar göndərilib'} />
      </KpiRow>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Günlük gəlir</CardTitle></CardHeader><CardContent>
          <Bars rows={data.by_day.slice(-14)} label={row => new Date(row.day).toLocaleDateString('az-AZ', { day: '2-digit', month: 'short' })} value={row => num(row.revenue)} format={formatAzn} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Paket ölçüsü (sifariş sayı)</CardTitle></CardHeader><CardContent>
          <Bars rows={data.by_bundle} label={row => `${row.bucket} kitab`} value={row => num(row.orders)} format={n => `${n} sifariş`} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Yaş qrupları (satılan kitab)</CardTitle></CardHeader><CardContent>
          <Bars rows={data.by_age} label={row => AGE[row.age] ?? row.age} value={row => num(row.books)} format={n => `${n} kitab`} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ən çox satılan 10 kitab</CardTitle></CardHeader><CardContent className="space-y-2">
          {data.top_books.length ? data.top_books.map((book, index) => (
            <div key={book.id} className="flex items-center gap-3 text-sm"><span className="w-5 text-muted-foreground">{index + 1}</span>
              <img src={bookCover(book.id)} alt="" className="h-10 w-7 rounded object-cover" /><span className="flex-1 truncate">{book.title} <span className="text-muted-foreground">· {AGE[book.age]}</span></span>
              <span className="font-medium">{book.sold}</span></div>
          )) : <p className="text-sm text-muted-foreground">Hələ satış yoxdur.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

function Orders() {
  const client = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ['admin-books-orders', status, search, page], ...ADMIN_QUERY, staleTime: 20_000, queryFn: async () => {
    const { data, error } = await rpc('admin_book_orders_v1', { p_status: status, p_search: search.trim() || null, p_limit: 30, p_offset: page * 30 });
    if (error) throw error; return data as OrderRow[]; } });
  const total = data[0]?.total_count ?? 0;
  const resend = async (orderId: string) => {
    setBusy(orderId);
    const { data: result, error } = await supabase.functions.invoke('book-admin', { body: { action: 'resend_email', order_id: orderId } });
    setBusy(null);
    if (error || !result?.sent) toast.error('E-poçt göndərilmədi'); else { toast.success('Yükləmə linkləri yenidən göndərildi'); void client.invalidateQueries({ queryKey: ['admin-books-orders'] }); }
  };
  const columns: Column<OrderRow>[] = [
    { key: 'buyer', header: 'Alıcı', mobile: 'title', cell: order => <span><span className="ak-cell-main">{order.name || '—'}</span><span className="ak-cell-sub">{order.email}</span></span> },
    { key: 'books', header: 'Kitablar', cell: order => <span className="flex flex-wrap gap-1 max-w-[340px]">{order.book_ids.map(id => <span key={id} title={findBook(id)?.title ?? id} className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
      <img src={bookCover(id)} alt="" className="h-5 w-3.5 rounded-sm object-cover" /><span className="max-w-[110px] truncate">{findBook(id)?.title ?? id}</span></span>)}</span> },
    { key: 'amount', header: 'Məbləğ', align: 'end', cell: order => <span><strong className="ak-num">{formatAzn(num(order.amount))}</strong><span className="ak-cell-sub">{order.book_ids.length} × {formatAzn(num(order.unit_price))}</span></span> },
    { key: 'status', header: 'Status', cell: order => <span className="flex flex-wrap gap-1"><StatusPill tone={toneFor(order.status)}>{STATUS[order.status]?.label ?? order.status}</StatusPill>{order.provider === 'admin' && <StatusPill tone="violet" dot={false}><Gift size={11} />Hədiyyə</StatusPill>}</span> },
    { key: 'dates', header: 'Tarix', cell: order => <span><span className="ak-num">{fmtDateTime(order.created_at)}</span><span className="ak-cell-sub">Ödənilib: {date(order.paid_at)}</span></span> },
    { key: 'email', header: 'E-poçt', mobile: 'hidden', cell: order => <span className="ak-cell-sub inline-flex items-center gap-1"><Mail size={12} />{order.email_sent_at ? `Göndərilib ${date(order.email_sent_at)}` : 'Göndərilməyib'}</span> },
  ];
  return (
    <div className="grid gap-4">
      <Section flush>
        <div className="px-4 pb-3 grid gap-2.5">
          <Toolbar end={<button type="button" className="ak-icon-btn" aria-label="Yenilə" onClick={() => refetch()}><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /></button>}>
            <SearchInput value={search} onChange={value => { setSearch(value); setPage(0); }} placeholder="E-poçt, ad və ya sifariş ID" />
          </Toolbar>
          <FilterChips label="Status" value={status ?? 'all'} onChange={value => { setStatus(value === 'all' ? null : value); setPage(0); }}
            options={[{ value: 'all', label: 'Hamısı' }, ...['paid', 'pending', 'failed', 'refunded'].map(value => ({ value, label: STATUS[value].label }))]} />
        </div>
        <DataTable testId="admin-books-orders" columns={columns} rows={isLoading ? undefined : data} rowKey={order => order.id} loading={isLoading} error={isError ? true : null} onRetry={() => refetch()}
          page={page} total={total} pageSize={30} onPageChange={setPage} fetching={isFetching && !isLoading} empty={<EmptyState title="Sifariş tapılmadı." />}
          actions={[{ label: 'Linkləri yenidən göndər', icon: <Mail size={14} />, hidden: order => order.status !== 'paid' || busy === order.id, onSelect: order => void resend(order.id) }]} />
      </Section>
      <GrantCard />
    </div>
  );
}

function GrantCard() {
  const [email, setEmail] = useState('');
  const [ids, setIds] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    const bookIds = ids.split(/[\s,]+/).filter(Boolean);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('book-admin', { body: { action: 'grant', email, book_ids: bookIds, note } });
    setBusy(false);
    if (error || !data?.order_id) toast.error('Hədiyyə verilmədi: e-poçtu və kitab ID-lərini yoxlayın');
    else { toast.success(data.sent ? 'Kitablar verildi, e-poçt göndərildi' : 'Kitablar verildi (e-poçt göndərilmədi)'); setIds(''); setNote(''); }
  };
  return (
    <Section title={<span className="flex items-center gap-2"><Gift size={15} />Kitab hədiyyə et (dəstək)</span>}>
      <div className="grid gap-2 max-w-xl">
        <Input placeholder="İstifadəçinin e-poçtu" value={email} onChange={event => setEmail(event.target.value)} />
        <Input placeholder="Kitab ID-ləri, məs. 1_01, 1_02 (Kataloq bölməsində)" value={ids} onChange={event => setIds(event.target.value)} />
        <Textarea placeholder="Qeyd (səbəb), istəyə görə" value={note} onChange={event => setNote(event.target.value)} rows={2} />
        <Button disabled={busy || !email || !ids} onClick={grant}>Hədiyyə et</Button>
        <p className="ak-hint">0 ₼ sifariş kimi yazılır, gəlir statistikasına düşmür; istifadəçiyə yükləmə linkləri göndərilir.</p>
      </div></Section>
  );
}

function Catalog() {
  const [age, setAge] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-books-catalog'], queryFn: async () => {
    const { data, error } = await rpc('admin_book_catalog_v1'); if (error) throw error; return data as CatalogRow[]; } });
  const rows = useMemo(() => data.filter(row => !age || row.age_group === age), [data, age]);
  const missing = data.filter(row => !row.has_pdf).length;
  if (isLoading) return <SkeletonRows rows={6} columns={3} />;
  return (
    <div className="grid gap-3">
      {missing > 0 && <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 p-3 text-sm text-orange-800"><FileWarning size={16} />{missing} kitabın PDF faylı hələ yüklənməyib: alıcı həmin kitabı endirə bilməz.</div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!age ? 'default' : 'outline'} onClick={() => setAge(null)}>Hamısı ({data.length})</Button>
        {Object.entries(AGE).map(([key, label]) => <Button key={key} size="sm" variant={age === key ? 'default' : 'outline'} onClick={() => setAge(key)}>{label}</Button>)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{rows.map(row => (
        <Card key={row.id}><CardContent className="p-3 flex gap-3">
          <img src={bookCover(row.id)} alt="" className="h-20 w-14 rounded-md object-cover" />
          <div className="min-w-0 flex-1 text-sm">
            <b className="block truncate">{row.title}</b>
            <span className="text-xs text-muted-foreground">{row.id} · {AGE[row.age_group]} · {row.pages} səhifə</span>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${row.has_pdf ? 'bg-green-500/10 text-green-700' : 'bg-orange-500/10 text-orange-700'}`}>{row.has_pdf ? 'PDF var' : 'PDF yoxdur'}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">{num(row.sold)} satış · {formatAzn(num(row.revenue))}</span>
            </div>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground"><Download size={10} className="inline me-1" />book-pdfs/{row.pdf_path}</span>
          </div>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}

function Settings() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-books-settings'], queryFn: async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['books_payments_enabled', 'epoint_mode', 'epoint_public_key']);
    if (error) throw error;
    const map = Object.fromEntries((data ?? []).map(row => [row.key, typeof row.value === 'string' ? row.value.replace(/^"|"$/g, '') : JSON.stringify(row.value)]));
    return { enabled: map.books_payments_enabled === 'true', live: map.epoint_mode === 'live', keys: !!map.epoint_public_key && map.epoint_public_key !== 'null' };
  } });
  const toggle = async (value: boolean) => {
    const { error } = await supabase.from('app_settings').upsert({ key: 'books_payments_enabled', value: value as any, description: 'PDF çap kitablarının Epoint ilə satışı (true/false)' }, { onConflict: 'key' });
    if (error) toast.error('Yadda saxlanılmadı'); else { toast.success(value ? 'Kitab satışı aktivdir' : 'Kitab satışı dayandırıldı'); void client.invalidateQueries({ queryKey: ['admin-books-settings'] }); }
  };
  if (isLoading || !data) return <SkeletonRows rows={4} columns={2} />;
  return (
    <div className="grid gap-3 max-w-3xl">
      <Card><CardContent className="p-4 flex items-center justify-between gap-4">
        <div><b className="text-sm">Kartla satış (Epoint)</b><p className="text-xs text-muted-foreground mt-1">Söndürülü olanda mağaza açıqdır, amma "Kartla ödəniş tezliklə" göstərilir və ödəniş yaradılmır.</p></div>
        <Switch checked={data.enabled} onCheckedChange={toggle} disabled={!data.live || !data.keys} />
      </CardContent></Card>
      <Card><CardContent className="p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">{data.keys ? <CheckCircle2 size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}Epoint açarları {data.keys ? 'daxil edilib' : 'daxil edilməyib'}</div>
        <div className="flex items-center gap-2">{data.live ? <CheckCircle2 size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}Epoint rejimi: {data.live ? 'live' : 'live deyil'}</div>
        <p className="text-xs text-muted-foreground">Açarlar və rejim "Epoint ödəniş" bölməsində idarə olunur (mağaza, tort və albom ödənişləri ilə eyni hesab). Hər ikisi hazır olmadan açar aktivləşmir.</p>
      </CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Qiymət pillələri (serverdə hesablanır)</CardTitle></CardHeader><CardContent className="text-sm">
        {[...BOOK_PRICE_TIERS].reverse().map(tier => <div key={tier.min} className="flex justify-between border-b py-1.5 last:border-0"><span>{tier.min === 1 ? '1–2' : tier.min === 3 ? '3–4' : tier.min === 5 ? '5–9' : '10+'} kitab</span><b>kitabı {formatAzn(tier.unit)}</b></div>)}
        <p className="text-xs text-muted-foreground mt-2">Pillələri dəyişmək üçün <code>book-pricing.ts</code> (server + tətbiq) yenilənməlidir.</p>
      </CardContent></Card>
    </div>
  );
}

function Guide() {
  const sections: [string, string[]][] = [
    ['Nədir', [
      `Uşaqlar üçün ${BOOKS.length} PDF fəaliyyət kitabı: 7 yaş qrupu (6+ ay, 1+ … 6+ yaş), hər qrupda 10 kitab, 13–15 səhifə. Kitablar Azərbaycan dilindədir, mağaza interfeysi 23 dildədir.`,
      'Valideyn kitabı alır, evdə A4 kağızda çap edir və uşaqla birlikdə istifadə edir. Fiziki çatdırılma yoxdur.',
    ]],
    ['Tətbiqdə harada görünür', [
      'Dashboard kartı: körpəsi 5 aylıqdan böyük olan analara uşağın yaş qrupunun kitabları ("Nərmin üçün yeni kitablar"); hamiləliyin 28-ci həftəsindən 6+ ay kitabları.',
      'Mağaza: yaş və mövzu filtrləri, uşağın yaşına görə tövsiyə sırası, paket pillələri, "Tam kolleksiya" (yaşa görə 10 kitab), kitab detalı (bacarıqlar, təsvir, çap təlimatı).',
      'Kitablarım: alınmış kitablar və "PDF yüklə" düyməsi.',
    ]],
    ['Qiymət və paketlər', [
      'Qiyməti səbətdəki kitab sayı müəyyən edir: 1–2 kitab 4 ₼, 3–4 kitab 3 ₼, 5–9 kitab 2,60 ₼, 10+ kitab 2 ₼ (hər kitab üçün).',
      'Məsələn: 1 kitab 4 ₼, 3 kitab 9 ₼, 5 kitab 13 ₼, 10 kitab 20 ₼. Səbət növbəti pilləyə nə qədər kitab qaldığını göstərir.',
      'Məbləği həmişə server hesablayır; tətbiqdən gələn qiymət nəzərə alınmır.',
    ]],
    ['Ödəniş axını (Epoint)', [
      '1. "Ödənişə keç" → book-checkout funksiyası sifarişi (book_orders, status pending) yaradır və Epoint ödəniş səhifəsini açır.',
      '2. Ödənişdən sonra Epoint nəticəni mövcud Result URL-ə (epoint-payment?action=callback) göndərir; kitab sifarişləri avtomatik tanınır.',
      '3. İmza yoxlanır, ödəniş Epoint-dən əlavə sorğu ilə (get-status) təsdiqlənir və məbləğ sifarişlə tutuşdurulur. Yalnız bundan sonra kitablar verilir (book_entitlements) və sifariş "Ödənilib" olur.',
      '4. İstifadəçiyə e-poçt gedir: hər kitab üçün "PDF yüklə" linki. Kitablar tətbiqdə Kitablarım bölməsində də görünür.',
    ]],
    ['Yükləmə linkləri', [
      'PDF-lər tətbiqə yerləşdirilmir. Onlar qapalı book-pdfs bucket-ində saxlanılır və yalnız link ilə endirilir.',
      'Tətbiqdən: sahiblik yoxlanır və 15 dəqiqəlik imzalı link verilir. E-poçtdan: link sifarişin gizli tokeni ilə işləyir, hər açılışda yeni 15 dəqiqəlik link yaradılır, ona görə e-poçtdakı link köhnəlmir.',
      '"Linkləri yenidən göndər" yeni token yaradır; köhnə e-poçt linkləri etibarsız olur.',
    ]],
    ['PDF və qapaq faylları', [
      'Hər kitabın PDF-i book-pdfs bucket-ində Kataloq bölməsində göstərilən yolda olmalıdır (məs. pdf/1-yas/1_01_fermada.pdf). "PDF yoxdur" görünən kitab alınsa da endirilə bilməz.',
      'Qapaqlar tətbiqin içindədir (sürətli göstərilmə üçün) və e-poçt üçün book-covers bucket-indədir.',
    ]],
    ['Analitika', [
      'Tətbiq event-ləri: books_store_viewed, book_viewed, book_added_to_cart, book_removed_from_cart, books_collection_added, books_checkout_started, books_checkout_unavailable, book_downloaded, books_reco_clicked (razılıq verilibsə).',
      'Server event-i: books_purchase_completed (məbləğ, kitab sayı) ödəniş təsdiqlənəndə yazılır. Meta-ya yalnız səbət, checkout və satınalma gedir (reklam ölçmə razılığı ilə).',
    ]],
    ['Dəstək hallarında', [
      'İstifadəçi e-poçtu tapmırsa: Sifarişlər → "Linkləri yenidən göndər". Spam qovluğunu yoxlamağı tövsiyə edin.',
      'Ödəniş "Gözləyir"də qalıbsa: istifadəçi ödəniş səhifəsini bağlayıb. Kitab verilməyib, pul çıxılmayıb.',
      'Hədiyyə və ya kompensasiya: Sifarişlər → "Kitab hədiyyə et" (0 ₼, gəlirə düşmür).',
      'Geri qaytarma: Epoint kabinetində edilir; sifarişin statusu və kitab girişi əl ilə yenilənməlidir.',
    ]],
  ];
  return (
    <div className="grid gap-3 max-w-3xl">{sections.map(([title, items]) => (
      <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><ul className="list-disc ps-5 space-y-1.5 text-sm text-muted-foreground">{items.map(item => <li key={item}>{item}</li>)}</ul></CardContent></Card>
    ))}</div>
  );
}
