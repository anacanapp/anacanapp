/** Partner workspace: sales log, team (invites, roles) and change history. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Btn, DataTable, EmptyState, Field, FieldGrid, FilterChips, KpiRow, Notice, Section, SideDrawer, StatTile, StatusPill,
  downloadCsv, fmtDate, fmtDateTime, fmtMoney, fmtNumber, useAdminConfirm, type Column,
} from '@/components/admin/kit';
import {
  CHANNEL_LABEL, ROLE_LABEL, auditLabel, bakuToday, canManageTeam, canWrite, daysAgo, inviteLink, prpc,
  type PanelAudit, type PanelPartner, type PanelProduct, type PanelSale, type PanelTeam, type PartnerRole,
} from '@/lib/partner-panel';

const key = (...parts: unknown[]) => ['partner-panel', ...parts];

/* ───────────── Sales ───────────── */
interface SaleForm { sale_date: string; product_id: string; quantity: string; revenue: string; channel: PanelSale['channel']; note: string }
const freshSale = (): SaleForm => ({ sale_date: bakuToday(), product_id: '', quantity: '1', revenue: '', channel: 'partner_site', note: '' });

export function PartnerSales({ partner }: { partner: PanelPartner }) {
  const qc = useQueryClient(), confirm = useAdminConfirm(), writable = canWrite(partner.role);
  const [range, setRange] = useState<'30' | '90' | '365'>('30');
  const [editing, setEditing] = useState<PanelSale | 'new' | null>(null);
  const [form, setForm] = useState<SaleForm>(freshSale);
  const from = daysAgo(Number(range) - 1), to = bakuToday();
  const q = useQuery({ queryKey: key('sales', partner.id, from, to), queryFn: () => prpc<PanelSale[]>('shop_partner_sales_v1', { p_partner: partner.id, p_from: from, p_to: to }) });
  const products = useQuery({ queryKey: key('products', partner.id), queryFn: () => prpc<PanelProduct[]>('shop_partner_products_v1', { p_partner: partner.id }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key('sales', partner.id) }); qc.invalidateQueries({ queryKey: key('dash', partner.id) }); };
  const save = useMutation({
    mutationFn: () => prpc<string>('shop_partner_sale_save_v1', { p_partner: partner.id, p_sale: editing === 'new' ? null : (editing as PanelSale).id,
      p_data: { ...form, revenue: form.revenue.replace(',', '.') } }),
    onSuccess: () => { refresh(); setEditing(null); toast.success('Satış yadda saxlanıldı'); }, onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => prpc('shop_partner_sale_delete_v1', { p_partner: partner.id, p_sale: id }),
    onSuccess: () => { refresh(); toast.success('Satış silindi'); }, onError: (e: Error) => toast.error(e.message),
  });
  const open = (s: PanelSale | 'new') => {
    setForm(s === 'new' ? freshSale() : { sale_date: s.sale_date, product_id: s.product_id || '', quantity: String(s.quantity), revenue: String(s.revenue), channel: s.channel, note: s.note || '' });
    setEditing(s);
  };
  const set = <K extends keyof SaleForm>(k: K, v: SaleForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const rows = q.data || [];
  const revenue = rows.reduce((a, r) => a + Number(r.revenue), 0), qty = rows.reduce((a, r) => a + r.quantity, 0);
  const cols: Column<PanelSale>[] = [
    { key: 'd', header: 'Tarix', mobile: 'subtitle', sortable: true, sortValue: (r) => r.sale_date, cell: (r) => fmtDate(r.sale_date) },
    { key: 'p', header: 'Məhsul', mobile: 'title', cell: (r) => r.product_name || 'Ümumi' },
    { key: 'q', header: 'Say', align: 'end', cell: (r) => fmtNumber(r.quantity) },
    { key: 'r', header: 'Məbləğ', align: 'end', sortable: true, sortValue: (r) => Number(r.revenue), cell: (r) => fmtMoney(r.revenue) },
    { key: 'c', header: 'Kanal', mobile: 'meta', cell: (r) => CHANNEL_LABEL[r.channel] },
    { key: 'n', header: 'Qeyd', mobile: 'hidden', cell: (r) => r.note || '' },
  ];
  return (
    <div className="grid gap-3">
      <Notice tone="info">Birinci mərhələdə sifariş sizin saytınızda tamamlanır. Anacan-dan gələn satışları (utm_source=anacan) burada qeyd edin, komissiya buradan hesablanır.</Notice>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips<'30' | '90' | '365'> label="Müddət" value={range} onChange={setRange} options={[{ value: '30', label: '30 gün' }, { value: '90', label: '90 gün' }, { value: '365', label: '1 il' }]} />
        <div className="flex gap-2">
          <Btn size="sm" disabled={!rows.length} onClick={() => downloadCsv(`${partner.slug}-satislar-${from}-${to}.csv`, [['Tarix', 'Məhsul', 'Say', 'Məbləğ', 'Kanal', 'Qeyd'],
            ...rows.map((r) => [r.sale_date, r.product_name || 'Ümumi', r.quantity, r.revenue, CHANNEL_LABEL[r.channel], r.note])])}>CSV</Btn>
          {writable && <Btn variant="primary" size="sm" onClick={() => open('new')}><Plus size={14} />Satış əlavə et</Btn>}
        </div>
      </div>
      <KpiRow columns={3}>
        <StatTile label="Satılan ədəd" value={fmtNumber(qty)} loading={q.isLoading} />
        <StatTile label="Gəlir" value={fmtMoney(revenue)} loading={q.isLoading} />
        <StatTile label="Komissiya" value={partner.commission_pct != null ? fmtMoney(Math.round(revenue * partner.commission_pct) / 100) : '—'}
          hint={partner.commission_pct != null ? `${fmtNumber(partner.commission_pct)}%` : 'Faiz təyin olunmayıb'} loading={q.isLoading} />
      </KpiRow>
      <Section flush>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pageSize={25}
          onRowClick={writable ? (r: PanelSale) => open(r) : undefined}
          actions={writable ? [{ label: 'Sil', danger: true, icon: <Trash2 size={14} />, onSelect: async (r) => {
            if (await confirm({ title: 'Satış qeydi silinsin?', confirmLabel: 'Sil', danger: true })) remove.mutate(r.id);
          } }] : undefined}
          empty={<EmptyState title="Bu müddətdə satış qeydi yoxdur" />} />
      </Section>
      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Satış əlavə et' : 'Satışı redaktə et'}
        onSave={() => save.mutate()} saving={save.isPending} saveDisabled={!form.sale_date || !form.quantity || form.revenue === ''}>
        <FieldGrid>
          <Field label="Tarix" required>{(id) => <input id={id} type="date" className="ak-input" max={bakuToday()} value={form.sale_date} onChange={(e) => set('sale_date', e.target.value)} />}</Field>
          <Field label="Kanal">{(id) => (
            <select id={id} className="ak-select w-full" value={form.channel} onChange={(e) => set('channel', e.target.value as SaleForm['channel'])}>
              {(Object.keys(CHANNEL_LABEL) as SaleForm['channel'][]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>)}</Field>
        </FieldGrid>
        <Field label="Məhsul" hint="Boş buraxsanız ümumi satış kimi yazılır">{(id) => (
          <select id={id} className="ak-select w-full" value={form.product_id} onChange={(e) => set('product_id', e.target.value)}>
            <option value="">Ümumi</option>
            {(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>)}</Field>
        <FieldGrid>
          <Field label="Say" required>{(id) => <input id={id} className="ak-input" inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value.replace(/\D/g, ''))} />}</Field>
          <Field label="Məbləğ (₼)" required>{(id) => <input id={id} className="ak-input" inputMode="decimal" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} />}</Field>
        </FieldGrid>
        <Field label="Qeyd">{(id) => <input id={id} className="ak-input" maxLength={500} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Məs.: sifariş nömrəsi" />}</Field>
      </SideDrawer>
    </div>
  );
}

/* ───────────── Team ───────────── */
type MemberRole = Exclude<PartnerRole, 'admin'>;
const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Hər şey, komandanı idarə etmək daxil',
  manager: 'Məhsul, qiymət, stok, kampaniya və satışlar',
  viewer: 'Yalnız statistika və siyahılara baxış',
};

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('Kopyalandı'); } catch { toast.message('Linki seçib kopyalayın'); }
}

export function PartnerTeam({ partner }: { partner: PanelPartner }) {
  const qc = useQueryClient(), confirm = useAdminConfirm(), manage = canManageTeam(partner.role);
  const [email, setEmail] = useState(''), [role, setRole] = useState<MemberRole>('manager');
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('team', partner.id), queryFn: () => prpc<PanelTeam>('shop_partner_team_v1', { p_partner: partner.id }) });
  const refresh = () => qc.invalidateQueries({ queryKey: key('team', partner.id) });
  const invite = useMutation({
    mutationFn: () => prpc<{ id: string; token: string }>('shop_partner_invite_v1', { p_partner: partner.id, p_email: email, p_role: role }),
    onSuccess: (r) => { setLink(inviteLink(r.token)); setEmail(''); refresh(); }, onError: (e: Error) => toast.error(e.message),
  });
  const setMember = useMutation({
    mutationFn: (v: { user: string; role: MemberRole | null }) => prpc('shop_partner_member_set_v1', { p_partner: partner.id, p_user: v.user, p_role: v.role }),
    onSuccess: () => { refresh(); toast.success('Yeniləndi'); }, onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => prpc('shop_partner_invite_revoke_v1', { p_partner: partner.id, p_invite: id }),
    onSuccess: () => { refresh(); toast.success('Dəvət ləğv olundu'); }, onError: (e: Error) => toast.error(e.message),
  });
  type Member = PanelTeam['members'][number];
  const cols: Column<Member>[] = [
    { key: 'e', header: 'E-poçt', mobile: 'title', cell: (r) => <span className="ak-cell-main">{r.email || 'naməlum'}{r.me && <span className="ak-cell-sub">siz</span>}</span> },
    { key: 'r', header: 'Rol', cell: (r) => manage && !r.me ? (
      <select className="ak-select" value={r.role} aria-label="Rol" onChange={(e) => setMember.mutate({ user: r.user_id, role: e.target.value as MemberRole })}>
        {(['owner', 'manager', 'viewer'] as MemberRole[]).map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
      </select>) : <StatusPill tone="info">{ROLE_LABEL[r.role]}</StatusPill> },
    { key: 'd', header: 'Qoşulub', mobile: 'meta', cell: (r) => fmtDate(r.created_at) },
  ];
  return (
    <div className="grid gap-3">
      {manage && (
        <Section title="Komandaya dəvət" description="Dəvət linki 14 gün etibarlıdır və yalnız həmin e-poçtla daxil olan hesab üçün işləyir.">
          <div className="grid gap-3">
            <FieldGrid cols={3}>
              <Field label="E-poçt">{(id) => <input id={id} type="email" className="ak-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@sirket.az" />}</Field>
              <Field label="Rol" hint={ROLE_HINT[role]}>{(id) => (
                <select id={id} className="ak-select w-full" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                  {(['manager', 'viewer', 'owner'] as MemberRole[]).map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
                </select>)}</Field>
              <Field label=" ">{() => <Btn variant="primary" disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()}><Link2 size={14} />Dəvət linki yarat</Btn>}</Field>
            </FieldGrid>
            {link && (
              <Notice tone="success">
                <div className="grid gap-2">
                  <span>Linki göndərin. Bu link yalnız indi göstərilir.</span>
                  <div className="flex gap-2 items-center"><input className="ak-input ak-mono" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Dəvət linki" />
                    <Btn size="sm" onClick={() => copy(link)}><Copy size={14} />Kopyala</Btn></div>
                </div>
              </Notice>
            )}
          </div>
        </Section>
      )}
      <Section title="Üzvlər" flush>
        <DataTable columns={cols} rows={q.data?.members} rowKey={(r) => r.user_id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()}
          actions={manage ? [{ label: 'Komandadan çıxar', danger: true, hidden: (r) => r.me, onSelect: async (r) => {
            if (await confirm({ title: `${r.email || 'Üzv'} komandadan çıxarılsın?`, confirmLabel: 'Çıxar', danger: true })) setMember.mutate({ user: r.user_id, role: null });
          } }] : undefined}
          empty={<EmptyState compact title="Hələ üzv yoxdur" />} />
      </Section>
      {!!q.data?.invites.length && (
        <Section title="Gözləyən dəvətlər" flush>
          <DataTable columns={[
            { key: 'e', header: 'E-poçt', mobile: 'title', cell: (r) => r.email },
            { key: 'r', header: 'Rol', cell: (r) => ROLE_LABEL[r.role] },
            { key: 'x', header: 'Bitir', mobile: 'meta', cell: (r) => fmtDate(r.expires_at) },
          ]} rows={q.data.invites} rowKey={(r) => r.id}
            actions={manage ? [{ label: 'Ləğv et', danger: true, onSelect: (r) => revoke.mutate(r.id) }] : undefined} />
        </Section>
      )}
    </div>
  );
}

/* ───────────── History ───────────── */
function describe(a: PanelAudit): string {
  const p = a.payload || {};
  const pair = (k: string, money = false) => {
    const v = p[k];
    if (!Array.isArray(v)) return null;
    const f = (x: unknown) => x == null ? '—' : money ? fmtMoney(x as number) : String(x);
    return `${k === 'price' ? 'qiymət' : k === 'original_price' ? 'köhnə qiymət' : k === 'stock' ? 'stok' : k === 'listed' ? 'görünür' : 'ad'}: ${f(v[0])} → ${f(v[1])}`;
  };
  const changes = ['name', 'price', 'original_price', 'stock', 'listed'].map((k) => pair(k, k.includes('price'))).filter(Boolean);
  if (changes.length) return changes.join(' · ');
  const bits: string[] = [];
  if (p.name) bits.push(String(p.name));
  if (p.title) bits.push(String(p.title));
  if (p.discount_pct != null) bits.push(`−${p.discount_pct}%`);
  if (p.count != null) bits.push(`${p.count} məhsul`);
  if (p.revenue != null) bits.push(fmtMoney(p.revenue as number));
  if (p.email) bits.push(String(p.email));
  if (p.role) bits.push(ROLE_LABEL[p.role as PartnerRole] || String(p.role));
  if (p.status && typeof p.status === 'string') bits.push(p.status);
  if (p.note) bits.push(String(p.note));
  return bits.join(' · ');
}

export function PartnerAudit({ partner }: { partner: PanelPartner }) {
  const q = useQuery({ queryKey: key('audit', partner.id), queryFn: () => prpc<PanelAudit[]>('shop_partner_audit_v1', { p_partner: partner.id }) });
  return (
    <Section title="Dəyişikliklər" description="Son 300 əməliyyat: kim, nə vaxt, nəyi dəyişib." flush>
      <DataTable columns={[
        { key: 't', header: 'Vaxt', mobile: 'subtitle', cell: (r) => fmtDateTime(r.created_at) },
        { key: 'a', header: 'Əməliyyat', mobile: 'title', cell: (r) => auditLabel(r.action) },
        { key: 'd', header: 'Təfərrüat', cell: (r) => describe(r) || '—' },
        { key: 'u', header: 'Kim', mobile: 'meta', cell: (r) => r.actor_email || 'sistem' },
      ]} rows={q.data} rowKey={(r) => r.id} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} pageSize={30}
        empty={<EmptyState compact title="Hələ dəyişiklik yoxdur" />} />
    </Section>
  );
}
