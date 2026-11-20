/**
 * Partnyor mağazaları (owner 2026-11-17): every shop partner (Olivia first) with its status, commission, team,
 * products, campaigns and statistics. Admins approve partner campaigns, clear or (for Olivia) re-import a catalog
 * in one click, and open any partner's workspace here or in the partner panel (/partner?p=<id>).
 * Partners themselves use /partner and only see their own store (server-checked in the shop_partner_* RPCs).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Plus, Settings2, Store, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  Btn, DataTable, EmptyState, Field, FieldGrid, Notice, Page, PageHeader, Section, SideDrawer, StatusPill,
  fmtDateTime, fmtNumber, useAdminConfirm, type Column,
} from './kit';
import { ADMIN_QUERY } from './data/rpc';
import { STATUS_LABEL, prpc, type PanelPartner, type PartnerStatus } from '@/lib/partner-panel';
import { OLIVIA_CATALOG, oliviaImportRows } from '@/lib/olivia-catalog';
import { ROSSMANN_CATALOG, rossmannImportRows } from '@/lib/rossmann-catalog';
import { PartnerWorkspace } from '@/components/partner-shop/panel/PartnerWorkspace';

interface AdminPartner {
  id: string; slug: string; name: string; logo_url: string | null; icon_url: string | null; website_url: string | null; brand_color: string;
  status: PartnerStatus; commission_pct: number | null; contact_email: string | null; notes: string | null; created_at: string;
  products: number; listed: number; members: number; pending_campaigns: number; events_30d: number;
}
interface Pending { id: string; partner_id: string; partner_name: string; title: string; description: string | null; discount_pct: number; products: number; starts_at: string; ends_at: string }
interface PartnerForm { slug: string; name: string; logo_url: string; icon_url: string; website_url: string; brand_color: string; status: PartnerStatus; commission_pct: string; contact_email: string; notes: string }
const emptyForm: PartnerForm = { slug: '', name: '', logo_url: '', icon_url: '', website_url: 'https://', brand_color: '#8A2BE2', status: 'admin_only', commission_pct: '', contact_email: '', notes: '' };
const statusTone = (s: PartnerStatus) => (s === 'live' ? 'success' : s === 'paused' ? 'danger' : 'warning');
/** Partners whose catalog ships with the app and can be re-imported in one click. */
const BUNDLED: Record<string, { count: number; rows: () => unknown[] }> = {
  olivia: { count: OLIVIA_CATALOG.products.length, rows: oliviaImportRows },
  rossmann: { count: ROSSMANN_CATALOG.products.length, rows: rossmannImportRows },
};

const AdminShopPartners = () => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPartner | 'new' | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [review, setReview] = useState<{ item: Pending; decision: 'approved' | 'rejected'; note: string } | null>(null);

  const list = useQuery({ queryKey: ['admin-shop-partners'], ...ADMIN_QUERY, queryFn: () => prpc<AdminPartner[]>('shop_partner_admin_list_v1') });
  const pending = useQuery({ queryKey: ['admin-shop-partners', 'pending'], ...ADMIN_QUERY, queryFn: () => prpc<Pending[]>('shop_partner_admin_pending_v1') });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-shop-partners'] }); qc.invalidateQueries({ queryKey: ['partner-panel'] }); qc.invalidateQueries({ queryKey: ['partner-storefront'] }); };
  const fail = (e: Error) => toast({ title: 'Alınmadı', description: e.message, variant: 'destructive' });

  const save = useMutation({
    mutationFn: () => prpc<string>('shop_partner_admin_save_v1', { p_partner: editing === 'new' ? null : (editing as AdminPartner).id, p_data: { ...form, commission_pct: form.commission_pct.replace(',', '.') } }),
    onSuccess: () => { refresh(); setEditing(null); toast({ title: 'Partnyor yadda saxlanıldı' }); }, onError: fail,
  });
  const clear = useMutation({
    mutationFn: (p: AdminPartner) => prpc<number>('shop_partner_admin_clear_v1', { p_partner: p.id }),
    onSuccess: (n) => { refresh(); toast({ title: `${n} məhsul silindi`, description: 'Mağaza bölməsi və ana səhifə kartları dərhal yeniləndi.' }); }, onError: fail,
  });
  const importAll = useMutation({
    mutationFn: (p: AdminPartner) => prpc<number>('shop_partner_admin_import_v1', { p_partner: p.id, p_rows: BUNDLED[p.slug].rows() }),
    onSuccess: (n) => { refresh(); toast({ title: `${n} məhsul yükləndi` }); }, onError: fail,
  });
  const decide = useMutation({
    mutationFn: () => prpc('shop_partner_campaign_review_v1', { p_campaign: review!.item.id, p_decision: review!.decision, p_note: review!.note }),
    onSuccess: () => { refresh(); setReview(null); toast({ title: review?.decision === 'approved' ? 'Kampaniya təsdiqləndi' : 'Kampaniya rədd edildi' }); }, onError: fail,
  });

  const edit = (p: AdminPartner | 'new') => {
    setForm(p === 'new' ? emptyForm : { slug: p.slug, name: p.name, logo_url: p.logo_url || '', icon_url: p.icon_url || '', website_url: p.website_url || '', brand_color: p.brand_color,
      status: p.status, commission_pct: p.commission_pct != null ? String(p.commission_pct) : '', contact_email: p.contact_email || '', notes: p.notes || '' });
    setEditing(p);
  };
  const set = <K extends keyof PartnerForm>(k: K, v: PartnerForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const removeAll = async (p: AdminPartner) => {
    // Bundled catalogs (Olivia, Rossmann) come back with one more click; other partners' own products would be lost, so they confirm.
    if (BUNDLED[p.slug] || await confirm({ title: `${p.name}: ${p.products} məhsul silinsin?`, description: 'Partnyorun əlavə etdiyi məhsullar geri qaytarılmır.', confirmLabel: 'Hamısını sil', danger: true }))
      clear.mutate(p);
  };

  const selected = list.data?.find((p) => p.id === open);
  const cols: Column<AdminPartner>[] = [
    { key: 'n', header: 'Partnyor', mobile: 'title', cell: (r) => (
      <span className="ak-cell-user">
        <span className="h-9 w-9 rounded-lg bg-white border flex items-center justify-center shrink-0 overflow-hidden">{r.icon_url ? <img src={r.icon_url} alt="" className="h-full w-full object-cover" /> : <Store size={16} />}</span>
        <span className="min-w-0"><span className="ak-cell-main">{r.name}</span><span className="ak-cell-sub ak-mono">{r.slug}</span></span>
      </span>) },
    { key: 's', header: 'Status', cell: (r) => <StatusPill tone={statusTone(r.status)}>{STATUS_LABEL[r.status]}</StatusPill> },
    { key: 'p', header: 'Məhsul', align: 'end', cell: (r) => `${fmtNumber(r.listed)} / ${fmtNumber(r.products)}` },
    { key: 'm', header: 'Komanda', align: 'end', cell: (r) => fmtNumber(r.members) },
    { key: 'c', header: 'Gözləyən kampaniya', align: 'end', cell: (r) => r.pending_campaigns ? <StatusPill tone="warning">{r.pending_campaigns}</StatusPill> : '0' },
    { key: 'e', header: 'Hadisə (30 gün)', align: 'end', mobile: 'meta', cell: (r) => fmtNumber(r.events_30d) },
    { key: 'k', header: 'Komissiya', align: 'end', mobile: 'meta', cell: (r) => (r.commission_pct != null ? `${fmtNumber(r.commission_pct)}%` : '—') },
  ];

  return (
    <Page testId="admin-shop-partners">
      <PageHeader title="Partnyor mağazaları" icon={<Store size={18} />}
        subtitle="Olivia və gələcək brendlər: məhsullar, qiymət, stok, kampaniyalar, satış və statistika. Partnyorlar /partner panelində yalnız öz mağazasını görür."
        actions={<Btn variant="primary" onClick={() => edit('new')}><Plus size={15} />Yeni partnyor</Btn>} />

      <Notice tone="info">
        Status "Önizləmə" olanda partnyorun məhsulları tətbiqdə yalnız adminlərə və partnyorun öz komandasına görünür. "Canlı" etdikdə bütün istifadəçilər görür.
        Partnyoru panelə qoşmaq üçün mağazanı açın, Komanda bölməsində dəvət linki yaradın və partnyora göndərin.
      </Notice>

      {!!pending.data?.length && (
        <Section title={`Təsdiq gözləyən kampaniyalar (${pending.data.length})`} flush>
          <DataTable columns={[
            { key: 'p', header: 'Partnyor', mobile: 'subtitle', cell: (r) => r.partner_name },
            { key: 't', header: 'Kampaniya', mobile: 'title', cell: (r) => <span className="ak-cell-main">{r.title}{r.description && <span className="ak-cell-sub">{r.description}</span>}</span> },
            { key: 'd', header: 'Endirim', align: 'end', cell: (r) => `−${fmtNumber(r.discount_pct)}%` },
            { key: 'n', header: 'Məhsullar', cell: (r) => (r.products ? `${r.products} məhsul` : 'Hamısı') },
            { key: 'w', header: 'Müddət', mobile: 'meta', cell: (r) => `${fmtDateTime(r.starts_at)} – ${fmtDateTime(r.ends_at)}` },
          ] as Column<Pending>[]} rows={pending.data} rowKey={(r) => r.id}
            actions={[
              { label: 'Təsdiqlə', icon: <Check size={14} />, onSelect: (r) => setReview({ item: r, decision: 'approved', note: '' }) },
              { label: 'Rədd et', icon: <X size={14} />, danger: true, onSelect: (r) => setReview({ item: r, decision: 'rejected', note: '' }) },
            ]} />
        </Section>
      )}

      <Section title="Partnyorlar" flush>
        <DataTable columns={cols} rows={list.data} rowKey={(r) => r.id} loading={list.isLoading} error={list.error} onRetry={() => list.refetch()}
          onRowClick={(r) => setOpen(r.id === open ? null : r.id)}
          actions={[
            { label: 'Mağazanı burada aç', icon: <Store size={14} />, onSelect: (r) => setOpen(r.id) },
            { label: 'Partnyor panelində aç', icon: <ExternalLink size={14} />, onSelect: (r) => window.open(`/partner?p=${r.id}`, '_blank', 'noopener') },
            { label: 'Ayarlar', icon: <Settings2 size={14} />, onSelect: (r) => edit(r) },
            { label: `Kataloqu yüklə`, icon: <Download size={14} />, hidden: (r) => !BUNDLED[r.slug], onSelect: (r) => importAll.mutate(r) },
            { label: 'Bütün məhsulları sil', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, hidden: (r) => !r.products, onSelect: removeAll },
          ]}
          empty={<EmptyState icon={<Store size={20} />} title="Hələ partnyor yoxdur" action={<Btn variant="primary" onClick={() => edit('new')}><Plus size={14} />Yeni partnyor</Btn>} />} />
      </Section>

      {selected && (
        <Section title={`${selected.name} · mağaza paneli`} description="Partnyorun gördüyü panel. Admin kimi bütün əməliyyatlar açıqdır, kampaniyalarınız birbaşa təsdiqlənir."
          actions={<div className="flex flex-wrap gap-2">
            {BUNDLED[selected.slug] && <Btn size="sm" disabled={importAll.isPending} onClick={() => importAll.mutate(selected)}><Download size={14} />{selected.products ? 'Kataloqu yenilə' : 'Kataloqu yüklə'} ({BUNDLED[selected.slug].count})</Btn>}
            <Btn size="sm" variant="danger" disabled={!selected.products || clear.isPending} onClick={() => removeAll(selected)} data-testid="partner-clear"><Trash2 size={14} />Hamısını təmizlə</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setOpen(null)}><X size={14} />Bağla</Btn>
          </div>}>
          <PartnerWorkspace key={selected.id} partner={{ ...selected, role: 'admin' } as PanelPartner} />
        </Section>
      )}

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Yeni partnyor' : 'Partnyor ayarları'}
        onSave={() => save.mutate()} saving={save.isPending} saveDisabled={!form.name.trim() || (editing === 'new' && !/^[a-z0-9][a-z0-9-]{1,39}$/.test(form.slug))} size="lg">
        <FieldGrid>
          <Field label="Ad" required>{(id) => <input id={id} className="ak-input" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Qısa ad (slug)" required hint="Kiçik hərf, rəqəm, tire. Sonradan dəyişmir.">{(id) => <input id={id} className="ak-input ak-mono" disabled={editing !== 'new'} value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="olivia" />}</Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Status">{(id) => (
            <select id={id} className="ak-select w-full" value={form.status} onChange={(e) => set('status', e.target.value as PartnerStatus)}>
              {(Object.keys(STATUS_LABEL) as PartnerStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>)}</Field>
          <Field label="Komissiya (%)" hint="Satış qeydlərindən hesablanır">{(id) => <input id={id} className="ak-input" inputMode="decimal" value={form.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} />}</Field>
        </FieldGrid>
        <Field label="Sayt" hint="https:// ilə">{(id) => <input id={id} className="ak-input" value={form.website_url} onChange={(e) => set('website_url', e.target.value)} />}</Field>
        <FieldGrid>
          <Field label="Loqo linki" hint="Məhsul səhifəsində 'by …' yanında">{(id) => (
            <div className="flex items-center gap-2"><span className="h-9 w-20 rounded bg-white border flex items-center justify-center shrink-0">{form.logo_url && <img src={form.logo_url} alt="" className="max-h-[80%] max-w-[90%] object-contain" />}</span>
              <input id={id} className="ak-input" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="/partners/olivia/logo.png" /></div>)}</Field>
          <Field label="İkon linki" hint="Məhsul şəkillərinin küncündə (kvadrat)">{(id) => (
            <div className="flex items-center gap-2"><span className="h-9 w-9 rounded bg-white border flex items-center justify-center shrink-0 overflow-hidden">{form.icon_url && <img src={form.icon_url} alt="" className="h-full w-full object-cover" />}</span>
              <input id={id} className="ak-input" value={form.icon_url} onChange={(e) => set('icon_url', e.target.value)} placeholder="/partners/olivia/icon.png" /></div>)}</Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Brend rəngi">{(id) => <input id={id} type="color" className="ak-input" style={{ height: 38, padding: 4 }} value={form.brand_color} onChange={(e) => set('brand_color', e.target.value.toUpperCase())} />}</Field>
          <Field label="Əlaqə e-poçtu">{(id) => <input id={id} type="email" className="ak-input" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />}</Field>
        </FieldGrid>
        <Field label="Qeydlər" hint="Yalnız adminlər görür">{(id) => <textarea id={id} className="ak-textarea" rows={3} maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
      </SideDrawer>

      <SideDrawer open={!!review} onOpenChange={(o) => !o && setReview(null)} title={review?.decision === 'approved' ? 'Kampaniyanı təsdiqlə' : 'Kampaniyanı rədd et'}
        description={review ? `${review.item.partner_name}: ${review.item.title} (−${fmtNumber(review.item.discount_pct)}%)` : undefined}
        onSave={() => decide.mutate()} saving={decide.isPending} saveLabel={review?.decision === 'approved' ? 'Təsdiqlə' : 'Rədd et'}>
        <Field label="Partnyora qeyd" hint="Partnyor bu qeydi kampaniyanın yanında görür">{(id) =>
          <textarea id={id} className="ak-textarea" rows={3} maxLength={1000} value={review?.note || ''} onChange={(e) => setReview((r) => r && { ...r, note: e.target.value })} />}</Field>
        {review?.decision === 'approved' && <label className="flex items-center gap-2 text-sm"><Switch checked disabled aria-label="Dərhal tətbiq olunur" />Başlama vaxtı gələndə tətbiqdə endirimli qiymət görünür</label>}
      </SideDrawer>
    </Page>
  );
};

export default AdminShopPartners;
