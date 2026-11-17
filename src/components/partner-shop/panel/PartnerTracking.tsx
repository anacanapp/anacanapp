/**
 * Partner workspace › İnteqrasiya: sales tracking for orders placed on the partner's own site (model V2).
 * Shows the public key, creates the server secret (shown once), the install snippets, coupons, and every
 * attributed order with its status and commission. Data: shop_partner_tracking_v1 and friends
 * (supabase/migrations/20261117150000_shop_partner_tracking.sql); install guide: docs/PARTNER_TRACKING_SDK.md.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Btn, DataTable, EmptyState, Field, FilterChips, KpiRow, Notice, Section, SideDrawer, StatTile, StatusPill,
  downloadCsv, fmtDateTime, fmtMoney, fmtNumber, useAdminConfirm, type Column,
} from '@/components/admin/kit';
import {
  PLACEMENT_LABEL, TRACKED_SOURCE_LABEL, TRACKED_STATUS_LABEL, bakuToday, canManageTeam, canWrite, daysAgo, prpc, trackingSnippets,
  type PanelPartner, type PanelTracking, type TrackedOrder, type TrackedStatus,
} from '@/lib/partner-panel';

const key = (...parts: unknown[]) => ['partner-panel', ...parts];
const STATUS_TONE: Record<TrackedStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending: 'warning', confirmed: 'info', delivered: 'success', cancelled: 'danger', returned: 'danger',
};

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('Kopyalandı'); } catch { toast.message('Mətni seçib kopyalayın'); }
}

function Code({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold">{title}</span>
        <Btn size="sm" variant="ghost" onClick={() => copy(text)}><Copy size={13} />Kopyala</Btn>
      </div>
      <pre className="m-0 overflow-x-auto rounded-xl bg-[#1D1512] p-3 text-[12px] leading-relaxed text-[#FCE1DA]"><code>{text}</code></pre>
    </div>
  );
}

export function PartnerTracking({ partner }: { partner: PanelPartner }) {
  const qc = useQueryClient(), confirm = useAdminConfirm();
  const owner = canManageTeam(partner.role), writable = canWrite(partner.role), admin = partner.role === 'admin';
  const [range, setRange] = useState<'30' | '90' | '365'>('30');
  const [mode, setMode] = useState<'live' | 'test'>('live');
  const [secret, setSecret] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const from = daysAgo(Number(range) - 1), to = bakuToday();
  const q = useQuery({
    queryKey: key('tracking', partner.id, from, to, mode),
    queryFn: () => prpc<PanelTracking>('shop_partner_tracking_v1', { p_partner: partner.id, p_from: from, p_to: to, p_test: mode === 'test' }),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: key('tracking', partner.id) }); qc.invalidateQueries({ queryKey: key('audit', partner.id) }); };
  const makeSecret = useMutation({
    mutationFn: () => prpc<{ key: string; secret: string }>('shop_partner_tracking_secret_v1', { p_partner: partner.id }),
    onSuccess: (r) => { setSecret(r.secret); refresh(); }, onError: (e: Error) => toast.error(e.message),
  });
  const saveSettings = useMutation({
    mutationFn: () => prpc('shop_partner_tracking_settings_v1', { p_partner: partner.id, p_data: {
      ...(coupons !== null ? { coupons: coupons.split(/[\s,;]+/).filter(Boolean) } : {}),
      ...(admin && days !== null ? { attribution_days: Number(days) } : {}),
    } }),
    onSuccess: () => { setCoupons(null); setDays(null); refresh(); toast.success('Yadda saxlanıldı'); }, onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: TrackedStatus }) => prpc('shop_partner_order_status_v1', { p_partner: partner.id, p_order: v.id, p_status: v.status }),
    onSuccess: () => { refresh(); toast.success('Status yeniləndi'); }, onError: (e: Error) => toast.error(e.message),
  });

  const d = q.data, s = d?.summary, rows = d?.orders || [];
  const snippets = d?.key ? trackingSnippets(d.key) : null;
  const pct = d?.commission_pct ?? partner.commission_pct;
  const conversion = s && s.clicks ? Math.round((s.orders / s.clicks) * 1000) / 10 : null;
  const cols: Column<TrackedOrder>[] = [
    { key: 'd', header: 'Tarix', mobile: 'subtitle', sortable: true, sortValue: (r) => r.ordered_at, cell: (r) => fmtDateTime(r.ordered_at) },
    { key: 'o', header: 'Sifariş', mobile: 'title', cell: (r) => (
      <span className="ak-cell-main">#{r.order_id}<span className="ak-cell-sub">{r.product_name || (r.items[0]?.name ?? '')}{r.items.length > 1 ? ` +${r.items.length - 1}` : ''}</span></span>) },
    { key: 'a', header: 'Məbləğ', align: 'end', sortable: true, sortValue: (r) => Number(r.amount), cell: (r) => fmtMoney(r.amount) },
    { key: 'c', header: 'Komissiya', align: 'end', cell: (r) => fmtMoney(r.commission) },
    { key: 's', header: 'Status', cell: (r) => writable ? (
      <select className="ak-select" aria-label="Status" value={r.status} onClick={(e) => e.stopPropagation()}
        onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value as TrackedStatus })}>
        {(Object.keys(TRACKED_STATUS_LABEL) as TrackedStatus[]).map((x) => <option key={x} value={x}>{TRACKED_STATUS_LABEL[x]}</option>)}
      </select>) : <StatusPill tone={STATUS_TONE[r.status]}>{TRACKED_STATUS_LABEL[r.status]}</StatusPill> },
    { key: 'src', header: 'Mənbə', mobile: 'meta', cell: (r) => (
      <span className="ak-cell-main">{TRACKED_SOURCE_LABEL[r.source]}{r.verified ? ' ✓' : ''}
        <span className="ak-cell-sub">{r.by === 'coupon' ? `Kupon ${r.coupon || ''}` : r.placement ? PLACEMENT_LABEL(r.placement) : 'Klik'}</span></span>) },
  ];

  return (
    <div className="grid gap-3">
      <Notice tone="info">
        Sifariş sizin saytınızda tamamlananda Anacan-dan gələn satışlar burada avtomatik görünür. Sayt kodu sifarişi dərhal bildirir,
        server inteqrasiyası isə statusları (təsdiq, çatdırılma, qaytarma) göndərir. Komissiya yalnız təsdiqlənmiş və çatdırılmış sifarişlərdən hesablanır.
      </Notice>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips<'30' | '90' | '365'> label="Müddət" value={range} onChange={setRange} options={[{ value: '30', label: '30 gün' }, { value: '90', label: '90 gün' }, { value: '365', label: '1 il' }]} />
        <div className="flex flex-wrap gap-2">
          <FilterChips<'live' | 'test'> label="Rejim" value={mode} onChange={setMode} options={[{ value: 'live', label: 'Real' }, { value: 'test', label: 'Test' }]} />
          <Btn size="sm" onClick={() => q.refetch()}><RefreshCw size={13} />Yenilə</Btn>
          <Btn size="sm" disabled={!rows.length} onClick={() => downloadCsv(`${partner.slug}-izlenen-sifarisler-${from}-${to}.csv`, [
            ['Tarix', 'Sifariş', 'Məbləğ', 'Valyuta', 'Status', 'Komissiya', 'Mənbə', 'Təsdiqli', 'Atribusiya', 'Kupon'],
            ...rows.map((r) => [r.ordered_at, r.order_id, r.amount, r.currency, TRACKED_STATUS_LABEL[r.status], r.commission, TRACKED_SOURCE_LABEL[r.source], r.verified ? 'bəli' : 'xeyr', r.by, r.coupon])])}>CSV</Btn>
        </div>
      </div>
      <KpiRow columns={5}>
        <StatTile label="Saytınıza keçid" value={s ? fmtNumber(s.clicks) : '—'} loading={q.isLoading} />
        <StatTile label="Sifariş" value={s ? fmtNumber(s.orders) : '—'} hint={conversion != null ? `Konversiya ${fmtNumber(conversion)}%` : undefined} loading={q.isLoading} />
        <StatTile label="Satış məbləği" value={s ? fmtMoney(s.amount) : '—'} loading={q.isLoading} />
        <StatTile label="Komissiya (təsdiqli)" value={s ? fmtMoney(s.commission) : '—'} hint={pct != null ? `${fmtNumber(pct)}%` : 'Faiz təyin olunmayıb'} tone="accent" loading={q.isLoading} />
        <StatTile label="Gözlənilən komissiya" value={s ? fmtMoney(s.expected_commission) : '—'} hint={s ? `${fmtNumber(s.pending)} sifariş gözləyir` : undefined} loading={q.isLoading} />
      </KpiRow>

      <Section flush>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pageSize={25}
          empty={<EmptyState title={mode === 'test' ? 'Test sifarişi yoxdur' : 'Bu müddətdə izlənən sifariş yoxdur'}
            description="Kod quraşdırılandan sonra Anacan-dan gələn sifarişlər burada görünəcək." />} />
      </Section>

      <Section title="Quraşdırma" description={`Atribusiya müddəti: klikdən sonra ${d?.attribution_days ?? 30} gün. Sayt: ${d?.website_url || 'təyin olunmayıb'}`}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="font-bold">Açıq açar:</span>
            <code className="rounded-lg bg-black/5 px-2 py-1">{d?.key || '—'}</code>
            {d?.key && <Btn size="sm" variant="ghost" onClick={() => copy(d.key!)}><Copy size={13} />Kopyala</Btn>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="font-bold">Server açarı:</span>
            {d?.has_secret ? <StatusPill tone="success">Yaradılıb {d.secret_set_at ? fmtDateTime(d.secret_set_at) : ''}</StatusPill> : <StatusPill tone="warning">Yoxdur</StatusPill>}
            {owner && <Btn size="sm" variant={d?.has_secret ? 'default' : 'primary'} disabled={makeSecret.isPending} onClick={async () => {
              if (d?.has_secret && !(await confirm({ title: 'Server açarı yenilənsin?', description: 'Köhnə açar dərhal işləməyəcək. Serverinizdə yenisini yazmalısınız.', confirmLabel: 'Yenilə', danger: true }))) return;
              makeSecret.mutate();
            }}><KeyRound size={13} />{d?.has_secret ? 'Yenilə' : 'Yarat'}</Btn>}
          </div>
          <div className="grid gap-1 text-[13px] text-muted-foreground">
            <span>Son sayt kodu bildirişi: {d?.last_pixel_at ? fmtDateTime(d.last_pixel_at) : 'hələ yoxdur'}</span>
            <span>Son server bildirişi: {d?.last_server_at ? fmtDateTime(d.last_server_at) : 'hələ yoxdur'}</span>
          </div>
          {snippets && (
            <div className="grid gap-4">
              <Code title="1. Bütün səhifələrə (head bölməsinə)" text={snippets.head} />
              <Code title="2. Sifariş təsdiqi (thank-you) səhifəsinə" text={snippets.order} />
              <Code title="3. Server bildirişi (statuslar üçün, tövsiyə olunur)" text={snippets.server} />
              <p className="m-0 text-[12px] text-muted-foreground">
                Test üçün skriptə <code>data-test="true"</code> əlavə edin: test sifarişləri yuxarıdakı “Test” rejimində görünür və komissiyaya düşmür.
                Serverdə <code>anacan_click</code> dəyərini sifarişlə birlikdə saxlayın (brauzerdə <code>anacan('click')</code> qaytarır).
              </p>
            </div>
          )}
          {(owner || admin) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anacan kuponları" hint="Bu kodlarla verilən sifarişlər də Anacan-a yazılır (vergül ilə ayırın)">{(id) => (
                <input id={id} className="ak-input" value={coupons ?? (d?.coupons || []).join(', ')} onChange={(e) => setCoupons(e.target.value)} placeholder="ANACAN10" />)}</Field>
              {admin && <Field label="Atribusiya müddəti (gün)" hint="Müqavilə şərtidir, yalnız Anacan admini dəyişir">{(id) => (
                <input id={id} className="ak-input" inputMode="numeric" value={days ?? String(d?.attribution_days ?? 30)} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />)}</Field>}
              <div className="sm:col-span-2"><Btn variant="primary" size="sm" disabled={(coupons === null && days === null) || saveSettings.isPending} onClick={() => saveSettings.mutate()}>Yadda saxla</Btn></div>
            </div>
          )}
        </div>
      </Section>

      <SideDrawer open={!!secret} onOpenChange={(o) => !o && setSecret(null)} title="Server açarı">
        <Notice tone="warning">Bu açar yalnız indi göstərilir. Onu serverinizin gizli ayarlarında saxlayın, sayt koduna və ya brauzerə qoymayın.</Notice>
        {secret && <Code title="Authorization: Bearer" text={secret} />}
      </SideDrawer>
    </div>
  );
}
