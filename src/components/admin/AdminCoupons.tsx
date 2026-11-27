import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Tag, Trash2 } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Btn, DataTable, EmptyState, Field, FieldGrid, FilterChips, MultiChips, Page, PageHeader, Section, SideDrawer, StatusPill, fmtDate, fmtNumber, useAdminConfirm, type Column } from './kit';
import { ADMIN_QUERY } from './data/rpc';

const ORDER_TYPES = [
  { key: 'shop', label: tr('admincoupons_magaza_defaa2', 'Mağaza') },
  { key: 'cake', label: 'Tortlar' },
  { key: 'album', label: tr('admincoupons_albom_sifarisi_c85887', 'Albom Sifarişi') },
];

interface CouponForm {
  code: string; description: string; discount_type: 'percentage' | 'fixed'; discount_value: number; min_order_amount: number;
  max_uses: number | null; applicable_to: string[]; is_active: boolean; expires_at: string;
}
interface Coupon extends Omit<CouponForm, 'expires_at' | 'description'> { id: string; description: string | null; expires_at: string | null; used_count: number | null; created_at: string }

const emptyForm: CouponForm = { code: '', description: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 0, max_uses: null, applicable_to: ['shop'], is_active: true, expires_at: '' };
const toForm = (coupon: Coupon): CouponForm => ({ code: coupon.code, description: coupon.description || '', discount_type: coupon.discount_type, discount_value: coupon.discount_value,
  min_order_amount: coupon.min_order_amount || 0, max_uses: coupon.max_uses, applicable_to: coupon.applicable_to || ['shop'], is_active: coupon.is_active, expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '' });
const expired = (coupon: Coupon) => !!coupon.expires_at && Date.parse(coupon.expires_at) < Date.now();
const exhausted = (coupon: Coupon) => !!coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses;

const AdminCoupons = () => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [initial, setInitial] = useState<CouponForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: coupons = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-coupons'], ...ADMIN_QUERY,
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Coupon[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: form.code.trim().toUpperCase(), description: form.description || null, discount_type: form.discount_type, discount_value: form.discount_value,
        min_order_amount: form.min_order_amount || 0, max_uses: form.max_uses || null, applicable_to: form.applicable_to, is_active: form.is_active, expires_at: form.expires_at || null,
      };
      if (editing) {
        const { error } = await supabase.from('coupons' as any).update(payload).eq('id', editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? tr('admincoupons_yenilendi_d10a01', 'Yeniləndi') : tr('admincoupons_yaradildi_5735d0', 'Yaradıldı') });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setShowForm(false); setEditing(null); setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: tr('admincoupons_xeta_3cdbb6', 'Xəta'), description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Silindi' }); queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }); },
    onError: (err: any) => toast({ title: tr('admincoupons_xeta_3cdbb6', 'Xəta'), description: err.message, variant: 'destructive' }),
  });

  const open = (coupon?: Coupon) => {
    const next = coupon ? toForm(coupon) : emptyForm;
    setEditing(coupon?.id ?? null); setForm(next); setInitial(next); setShowForm(true);
  };
  const remove = async (coupon: Coupon) => {
    if (await confirm({ title: `${coupon.code} kuponu silinsin?`, description: 'Bu əməliyyat geri qaytarılmır.', confirmLabel: 'Sil', danger: true })) deleteMutation.mutate(coupon.id);
  };
  const rows = coupons.filter(coupon => filter === 'all' || (filter === 'active' ? coupon.is_active : !coupon.is_active));
  const set = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => setForm(previous => ({ ...previous, [key]: value }));

  const columns = useMemo<Column<Coupon>[]>(() => [
    { key: 'code', header: 'Kod', mobile: 'title', sortable: true, sortValue: coupon => coupon.code, cell: coupon => <span><span className="ak-cell-main ak-mono">{coupon.code}</span><span className="ak-cell-sub">{coupon.description || '—'}</span></span> },
    { key: 'discount', header: 'Endirim', sortable: true, sortValue: coupon => coupon.discount_value, cell: coupon => <strong>{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${coupon.discount_value} ₼`}</strong> },
    { key: 'applies', header: 'Sahə', cell: coupon => <span className="ak-cell-sub">{(coupon.applicable_to || []).map(key => ORDER_TYPES.find(type => type.key === key)?.label ?? key).join(', ')}</span> },
    { key: 'min', header: 'Min. sifariş', align: 'end', cell: coupon => <span className="ak-num">{coupon.min_order_amount ? `${coupon.min_order_amount} ₼` : '—'}</span> },
    { key: 'uses', header: 'İstifadə', align: 'end', sortable: true, sortValue: coupon => coupon.used_count || 0, cell: coupon => <span className="ak-num">{fmtNumber(coupon.used_count || 0)}{coupon.max_uses ? ` / ${fmtNumber(coupon.max_uses)}` : ''}</span> },
    { key: 'expires', header: 'Bitmə', sortable: true, sortValue: coupon => coupon.expires_at ?? '9999', cell: coupon => <span className="ak-num">{coupon.expires_at ? fmtDate(coupon.expires_at) : 'Limitsiz'}</span> },
    { key: 'status', header: 'Status', cell: coupon => !coupon.is_active ? <StatusPill>Deaktiv</StatusPill> : expired(coupon) ? <StatusPill tone="warning">Bitib</StatusPill> : exhausted(coupon) ? <StatusPill tone="warning">Limit dolub</StatusPill> : <StatusPill tone="success">Aktiv</StatusPill> },
  ], []);

  return (
    <Page testId="admin-coupons">
      <PageHeader title={tr('admincoupons_kupon_kodlari_c425a7', 'Kupon Kodları')} subtitle={tr('admincoupons_endirim_kuponlarini_idare_edin_e8910a', 'Endirim kuponlarını idarə edin')}
        actions={<Btn variant="primary" onClick={() => open()}><Plus size={15} />Yeni Kupon</Btn>} />
      <Section flush>
        <div className="px-4 pb-3">
          <FilterChips label="Status" value={filter} onChange={value => setFilter(value as typeof filter)} options={[{ value: 'all', label: 'Hamısı', count: coupons.length },
            { value: 'active', label: 'Aktiv', count: coupons.filter(coupon => coupon.is_active).length }, { value: 'inactive', label: 'Deaktiv', count: coupons.filter(coupon => !coupon.is_active).length }]} />
        </div>
        <DataTable testId="admin-coupons-table" columns={columns} rows={isLoading ? undefined : rows} rowKey={coupon => coupon.id} loading={isLoading} error={isError ? true : null} onRetry={() => void refetch()}
          pageSize={25} onRowClick={open} defaultSort={{ key: 'expires', dir: 'desc' }}
          empty={<EmptyState icon={<Tag size={20} />} title={tr('admincoupons_hele_kupon_yoxdur_e859a2', 'Hələ kupon yoxdur')} action={<Btn variant="primary" onClick={() => open()}><Plus size={14} />Yeni Kupon</Btn>} />}
          actions={[{ label: 'Redaktə', icon: <Edit2 size={14} />, onSelect: open }, { label: 'Sil', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, onSelect: coupon => void remove(coupon) }]} />
      </Section>
      <SideDrawer open={showForm} onOpenChange={value => { setShowForm(value); if (!value) setEditing(null); }} title={editing ? tr('admincoupons_kuponu_redakte_et_a2dc32', 'Kuponu Redaktə Et') : 'Yeni Kupon'}
        dirty={JSON.stringify(form) !== JSON.stringify(initial)} saving={saveMutation.isPending} onSave={() => saveMutation.mutate()} saveDisabled={!form.code}
        saveLabel={editing ? tr('admincoupons_yenile_570ce2', 'Yenilə') : 'Yarat'} testId="admin-coupon-drawer">
        <FieldGrid>
          <Field label="Kupon Kodu" required>{id => <input id={id} className="ak-input ak-mono" value={form.code} onChange={event => set('code', event.target.value.toUpperCase())} placeholder="ANACAN20" />}</Field>
          <Field label={tr('admincoupons_tesvir_f85651', 'Təsvir')}>{id => <input id={id} className="ak-input" value={form.description} onChange={event => set('description', event.target.value)} placeholder="20% endirim" />}</Field>
        </FieldGrid>
        <FieldGrid cols={3}>
          <Field label={tr('admincoupons_endirim_novu_f920da', 'Endirim növü')}>{id => (
            <select id={id} className="ak-select w-full" value={form.discount_type} onChange={event => set('discount_type', event.target.value as CouponForm['discount_type'])}>
              <option value="percentage">Faiz (%)</option><option value="fixed">{tr('admincoupons_sabit_mebleg_7529ee', 'Sabit məbləğ (₼)')}</option>
            </select>)}</Field>
          <Field label="Endirim dəyəri" required>{id => <input id={id} type="number" className="ak-input" value={form.discount_value} onChange={event => set('discount_value', Number(event.target.value))} />}</Field>
          <Field label={tr('admincoupons_min_sifaris_meblegi_8d624c', 'Min. sifariş məbləği (₼)')}>{id => <input id={id} type="number" className="ak-input" value={form.min_order_amount} onChange={event => set('min_order_amount', Number(event.target.value))} />}</Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Maks. istifadə sayı" hint="Boş = limitsiz">{id => <input id={id} type="number" className="ak-input" value={form.max_uses ?? ''} placeholder="Limitsiz" onChange={event => set('max_uses', event.target.value ? Number(event.target.value) : null)} />}</Field>
          <Field label="Bitmə tarixi" hint="Boş = limitsiz">{id => <input id={id} type="date" className="ak-input" value={form.expires_at} onChange={event => set('expires_at', event.target.value)} />}</Field>
        </FieldGrid>
        <Field label={tr('admincoupons_tetbiq_olunacaq_saheler_0c18fd', 'Tətbiq olunacaq sahələr')}>
          <MultiChips label="Sahələr" value={form.applicable_to} onChange={value => set('applicable_to', value)} options={ORDER_TYPES.map(type => ({ value: type.key, label: type.label }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={value => set('is_active', value)} />Aktiv</label>
      </SideDrawer>
    </Page>
  );
};

export default AdminCoupons;
