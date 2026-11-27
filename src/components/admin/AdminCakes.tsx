import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake as CakeIcon, Edit2, EyeOff, Image as ImageIcon, Plus, Settings, Trash2 } from 'lucide-react';
import { tr } from '@/lib/tr';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminCakes, type Cake, type CakeOrder } from '@/hooks/useCakes';
import { useAdminPaymentMethods } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';
import {
  AdminTabs, Btn, DataTable, DescriptionList, EmptyState, Field, FieldGrid, FilterChips, FormSection, ImageUpload, Page, PageHeader, Section, SettingRow, SideDrawer,
  SkeletonRows, StatusPill, fmtDate, fmtDateTime, fmtMoney, fmtNumber, toneFor, useAdminConfirm, type Column,
} from './kit';
import { ADMIN_QUERY, unwrap } from './data/rpc';

type CakeCategory = 'month' | 'milestone' | 'pregnancy' | 'family';
const MILESTONE_OPTIONS = [
  { value: 'forty_days', label: tr('admincakes_40_gun', '40 gün') }, { value: 'hundred_days', label: tr('admincakes_100_gun', '100 gün') },
  { value: 'gender_reveal', label: 'Gender reveal' }, { value: 'pregnancy_news', label: tr('admincakes_ata_olursan', 'Hamiləlik xəbəri') },
  { value: 'mother', label: tr('admincakes_ana_ucun', 'Ana üçün') }, { value: 'holiday', label: tr('admincakes_bayram', 'Bayram') }, { value: 'twins', label: tr('admincakes_ekizler', 'Əkizlər') },
  { value: 'name', label: tr('admincakes_adli', 'Adlı tort') }, { value: 'first_tooth', label: tr('admincakes_ilk_dis_03153e', 'İlk Diş') }, { value: 'first_step', label: tr('admincakes_ilk_addim_e1c5b9', 'İlk Addım') },
  { value: 'first_word', label: tr('admincakes_ilk_soz_2ce62a', 'İlk Söz') }, { value: 'first_birthday', label: tr('admincakes_1_yas_fee411', '1 Yaş') }, { value: 'first_food', label: tr('admincakes_ilk_yemek_92d22e', 'İlk Yemək') },
  { value: 'crawling', label: tr('admincakes_surunme_5dccab', 'Sürünmə') }, { value: 'sitting', label: 'Oturma' }, { value: 'standing', label: tr('admincakes_ayaga_durma_1d8061', 'Ayağa Durma') },
  { value: 'custom', label: tr('admincakes_xususi_1055b8', 'Xüsusi') },
];
const ORDER_STATUSES = [
  { value: 'pending', label: tr('admincakes_gozleyir_9ac18a', 'Gözləyir') }, { value: 'confirmed', label: tr('admincakes_tesdiqlendi_0c46e4', 'Təsdiqləndi') },
  { value: 'preparing', label: tr('admincakes_hazirlanir_c15a4b', 'Hazırlanır') }, { value: 'ready', label: tr('admincakes_hazirdir_acac14', 'Hazırdır') },
  { value: 'delivered', label: tr('admincakes_catdirildi_324039', 'Çatdırıldı') }, { value: 'cancelled', label: tr('admincakes_legv_edildi_bfa98b', 'Ləğv edildi') },
];
const PAYMENT_STATUSES = [{ value: 'pending', label: tr('admincakes_gozleyir_9ac18a', 'Gözləyir') }, { value: 'paid', label: tr('admincakes_odenilib_4f2298', 'Ödənilib') }, { value: 'failed', label: tr('admincakes_ugursuz_541932', 'Uğursuz') }];
const CATEGORY_LABEL: Record<string, string> = { month: tr('admincakes_ayliq_tort_db55bc', 'Aylıq Tort'), milestone: tr('admincakes_cat_milestone', 'Xüsusi günlər (milestone)'), pregnancy: tr('admincakes_cat_pregnancy', 'Hamiləlik'), family: tr('admincakes_cat_family', 'Ailə və bayram') };
const paymentMethodLabel = (method?: string | null) => method === 'c2c_transfer' ? 'Kartdan Karta' : method === 'card' || method === 'card_simulated' ? 'Kart' : method ? tr('admincakes_nagd_fdeb10', 'Nağd') : '—';
type AdminCakeOrder = CakeOrder & { payment_method?: string | null; payment_status?: string | null; payment_proof_url?: string | null; cashback_used?: number | null };
const PAGE = 30;

const emptyForm = { name: '', description: '', price: '', image_url: '', images: [] as string[], category: 'month' as CakeCategory, month_number: '1', milestone_type: '', milestone_label: '',
  is_active: true, sort_order: '0', has_custom_fields: false, custom_field_labels: '' };
type CakeForm = typeof emptyForm;

/** Server page of cake orders (was: every order loaded on open). */
async function fetchCakeOrders(status: string, page: number) {
  let query = supabase.from('cake_orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  return { rows: data as unknown as AdminCakeOrder[], total: count };
}
async function fetchCakeOrderCounts() {
  const entries = await Promise.all(['all', ...ORDER_STATUSES.map(status => status.value)].map(async status => {
    let query = supabase.from('cake_orders').select('id', { count: 'exact', head: true });
    if (status !== 'all') query = query.eq('status', status);
    return [status, (await query).count ?? 0] as const;
  }));
  return Object.fromEntries(entries) as Record<string, number>;
}

const AdminCakes = () => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const { cakes, loading, addCake, updateCake, deleteCake } = useAdminCakes();
  const [activeTab, setActiveTab] = useState<'cakes' | 'orders' | 'payments'>('cakes');
  const counts = useQuery({ queryKey: ['admin-cake-order-counts'], queryFn: fetchCakeOrderCounts, ...ADMIN_QUERY });
  const [showForm, setShowForm] = useState(false), [editingCake, setEditingCake] = useState<Cake | null>(null);
  const [formData, setFormData] = useState<CakeForm>(emptyForm), [initialForm, setInitialForm] = useState<CakeForm>(emptyForm), [saving, setSaving] = useState(false);

  const resetForm = () => { setFormData(emptyForm); setEditingCake(null); setShowForm(false); };
  const openForm = (cake?: Cake) => {
    const next: CakeForm = cake ? { name: cake.name, description: cake.description || '', price: String(cake.price), image_url: cake.image_url || '', images: Array.isArray(cake.images) ? cake.images : [],
      category: cake.category as CakeCategory, month_number: String(cake.month_number || 1), milestone_type: cake.milestone_type || '', milestone_label: cake.milestone_label || '',
      is_active: cake.is_active, sort_order: String(cake.sort_order), has_custom_fields: cake.has_custom_fields || false,
      custom_field_labels: Array.isArray(cake.custom_field_labels) ? cake.custom_field_labels.join(', ') : '' } : emptyForm;
    setEditingCake(cake ?? null); setFormData(next); setInitialForm(next); setShowForm(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) { toast({ title: tr('admincakes_fayl_cox_boyukdur_f5cf61', 'Fayl çox böyükdür'), description: 'Max 5MB', variant: 'destructive' }); return null; }
    const fileName = `cake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('assets').upload(`cakes/${fileName}`, file);
    if (error) { toast({ title: tr('admincakes_yukleme_xetasi_eebca5', 'Yükləmə xətası'), variant: 'destructive' }); return null; }
    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(`cakes/${fileName}`);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price) { toast({ title: tr('admincakes_xeta_3cdbb6', 'Xəta'), description: tr('admincakes_ad_ve_qiymet_teleb_olunur_9e671a', 'Ad və qiymət tələb olunur'), variant: 'destructive' }); return; }
    const customLabels = formData.custom_field_labels.split(',').map(item => item.trim()).filter(Boolean);
    const payload: Partial<Cake> = {
      name: formData.name, description: formData.description || null, price: parseFloat(formData.price), image_url: formData.image_url || null, images: formData.images,
      category: formData.category, month_number: formData.category === 'month' ? parseInt(formData.month_number) : null,
      milestone_type: formData.category !== 'month' ? formData.milestone_type : null, milestone_label: formData.category !== 'month' ? formData.milestone_label : null,
      is_active: formData.is_active, sort_order: parseInt(formData.sort_order) || 0, has_custom_fields: formData.has_custom_fields, custom_field_labels: customLabels,
    };
    setSaving(true);
    const success = editingCake ? await updateCake(editingCake.id, payload) : await addCake(payload);
    setSaving(false);
    if (success) { toast({ title: editingCake ? tr('admincakes_tort_yenilendi_6da7d2', 'Tort yeniləndi') : tr('admincakes_tort_elave_edildi_ed4f93', 'Tort əlavə edildi') }); resetForm(); }
    else toast({ title: tr('admincakes_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });
  };
  const handleDelete = async (cake: Cake) => {
    if (!(await confirm({ title: tr('admincakes_silmek_isteyirsiniz_77af6b', 'Silmək istəyirsiniz?'), description: cake.name, confirmLabel: 'Sil', danger: true }))) return;
    if (await deleteCake(cake.id)) toast({ title: 'Tort silindi' });
  };
  const set = <K extends keyof CakeForm>(key: K, value: CakeForm[K]) => setFormData(previous => ({ ...previous, [key]: value }));

  const cakeColumns = useMemo<Column<Cake>[]>(() => [
    { key: 'name', header: 'Tort', mobile: 'title', sortable: true, sortValue: cake => cake.name, cell: cake => (
      <span className="ak-cell-user">{cake.image_url ? <img src={cake.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><CakeIcon size={16} /></span>}
        <span className="min-w-0"><span className="ak-cell-main">{cake.name}</span><span className="ak-cell-sub line-clamp-1">{cake.description || '—'}</span></span></span>) },
    { key: 'category', header: 'Kateqoriya', sortable: true, sortValue: cake => `${cake.category}${String(cake.month_number ?? 0).padStart(2, '0')}`, cell: cake => <StatusPill tone="accent" dot={false}>{cake.category === 'month' ? `${cake.month_number}-ci ay` : cake.milestone_label || CATEGORY_LABEL[cake.category] || 'Milestone'}</StatusPill> },
    { key: 'price', header: 'Qiymət', align: 'end', sortable: true, sortValue: cake => cake.price, cell: cake => <strong className="ak-num">{fmtMoney(cake.price)}</strong> },
    { key: 'sort', header: 'Sıra', align: 'end', sortable: true, sortValue: cake => cake.sort_order, cell: cake => <span className="ak-num">{cake.sort_order}</span> },
    { key: 'active', header: 'Status', cell: cake => cake.is_active ? <StatusPill tone="success">Aktiv</StatusPill> : <StatusPill><EyeOff size={11} />Gizli</StatusPill> },
  ], []);

  return (
    <Page testId="admin-cakes">
      <PageHeader title="Tortlar" subtitle={tr('admincakes_ayliq_ve_milestone_tortlarini_idare_edin_10f658', 'Aylıq və Milestone tortlarını idarə edin')}
        actions={activeTab === 'cakes' && <Btn variant="primary" onClick={() => openForm()}><Plus size={15} />{tr('admincakes_tort_elave_et_5d759e', 'Tort əlavə et')}</Btn>} />
      <AdminTabs value={activeTab} onChange={setActiveTab} items={[{ value: 'cakes', label: 'Tortlar', icon: <CakeIcon size={14} />, count: cakes.length },
        { value: 'orders', label: 'Sifarişlər', count: counts.data?.pending }, { value: 'payments', label: tr('admincakes_odenis_a4610e', 'Ödəniş'), icon: <Settings size={14} /> }]} />
      {activeTab === 'cakes' && (
        <Section flush>
          <DataTable testId="admin-cakes-table" columns={cakeColumns} rows={loading ? undefined : cakes} rowKey={cake => cake.id} loading={loading} pageSize={25} onRowClick={cake => openForm(cake)}
            empty={<EmptyState icon={<CakeIcon size={20} />} title={tr('admincakes_hele_tort_elave_edilmeyib_fe2ab6', 'Hələ tort əlavə edilməyib')} />}
            actions={[{ label: 'Redaktə', icon: <Edit2 size={14} />, onSelect: cake => openForm(cake) }, { label: 'Sil', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, onSelect: cake => void handleDelete(cake) }]} />
        </Section>
      )}
      {activeTab === 'orders' && <CakeOrders counts={counts.data} />}
      {activeTab === 'payments' && <PaymentMethods />}

      <SideDrawer open={showForm} onOpenChange={open => { if (!open) resetForm(); }} size="lg" title={editingCake ? tr('admincakes_tortu_redakte_et_a96241', 'Tortu redaktə et') : 'Yeni tort'}
        dirty={JSON.stringify(formData) !== JSON.stringify(initialForm)} onSave={() => void handleSave()} saving={saving} testId="admin-cake-drawer">
        <FormSection title="Əsas">
          <FieldGrid>
            <Field label="Ad" required>{id => <input id={id} className="ak-input" value={formData.name} onChange={event => set('name', event.target.value)} />}</Field>
            <Field label="Qiymət (₼)" required>{id => <input id={id} className="ak-input" type="number" step="0.01" value={formData.price} onChange={event => set('price', event.target.value)} />}</Field>
            <Field label="Kateqoriya">{id => (
              <select id={id} className="ak-select w-full" value={formData.category} onChange={event => set('category', event.target.value as CakeCategory)}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>)}</Field>
            {formData.category === 'month' ? (
              <Field label="Ay">{id => <select id={id} className="ak-select w-full" value={formData.month_number} onChange={event => set('month_number', event.target.value)}>
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}-ci ay</option>)}</select>}</Field>
            ) : (
              <Field label={tr('admincakes_milestone_novu_096351', 'Milestone növü')}>{id => (
                <select id={id} className="ak-select w-full" value={formData.milestone_type} onChange={event => {
                  const option = MILESTONE_OPTIONS.find(item => item.value === event.target.value);
                  setFormData(previous => ({ ...previous, milestone_type: event.target.value, milestone_label: option && option.value !== 'custom' ? option.label : previous.milestone_label }));
                }}><option value="">{tr('admincakes_secin_5c0c8d', 'Seçin')}</option>{MILESTONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>)}</Field>
            )}
            {formData.category !== 'month' && <Field label="Milestone etiketi">{id => <input id={id} className="ak-input" value={formData.milestone_label} onChange={event => set('milestone_label', event.target.value)} />}</Field>}
            <Field label={tr('admincakes_siralama_9e1268', 'Sıralama')}>{id => <input id={id} className="ak-input" type="number" value={formData.sort_order} onChange={event => set('sort_order', event.target.value)} />}</Field>
          </FieldGrid>
          <Field label={tr('admincakes_aciqlama_c33d69', 'Açıqlama')}>{id => <textarea id={id} className="ak-textarea" value={formData.description} onChange={event => set('description', event.target.value)} />}</Field>
        </FormSection>
        <FormSection title="Şəkillər">
          <Field label={tr('admincakes_esas_sekil_829387', 'Əsas şəkil')}><ImageUpload value={formData.image_url} onChange={url => set('image_url', url)} upload={uploadImage} size={112} /></Field>
          <Field label={tr('admincakes_elave_sekiller_693a5b', 'Əlavə şəkillər')}>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((image, index) => <ImageUpload key={`${image}-${index}`} value={image} upload={uploadImage} size={80} onChange={url => set('images', url ? formData.images.map((item, i) => i === index ? url : item) : formData.images.filter((_, i) => i !== index))} />)}
              <ImageUpload value="" upload={uploadImage} size={80} label="Əlavə et" onChange={url => url && set('images', [...formData.images, url])} />
            </div>
          </Field>
        </FormSection>
        <FormSection title="Seçimlər">
          <label className="flex items-center gap-2 text-sm"><Switch checked={formData.is_active} onCheckedChange={value => set('is_active', value)} />Aktiv</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={formData.has_custom_fields} onCheckedChange={value => set('has_custom_fields', value)} />{tr('admincakes_ferdi_saheler_custom_fields_5c08c9', 'Fərdi sahələr (Custom Fields)')}</label>
          {formData.has_custom_fields && <Field label={tr('admincakes_sahe_adlari_vergulle_ayirin_d72a0e', 'Sahə adları (vergüllə ayırın)')} hint={tr('admincakes_musteri_bu_saheleri_sifaris_zamani_doldu_f0107d', 'Müştəri bu sahələri sifariş zamanı dolduracaq')}>{id => (
            <input id={id} className="ak-input" value={formData.custom_field_labels} onChange={event => set('custom_field_labels', event.target.value)} placeholder={tr('admincakes_mes_usaq_adi_tebrik_metni_reng_secimi_c15451', 'Məs: Uşaq adı, Təbrik mətni, Rəng seçimi')} />)}</Field>}
        </FormSection>
      </SideDrawer>
    </Page>
  );
};

function CakeOrders({ counts }: { counts?: Record<string, number> }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const [status, setStatus] = useState('all'), [page, setPage] = useState(0), [selected, setSelected] = useState<AdminCakeOrder | null>(null), [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['admin-cake-orders', status, page], queryFn: () => fetchCakeOrders(status, page), placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 20_000 });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['admin-cake-orders'] }), client.invalidateQueries({ queryKey: ['admin-cake-order-counts'] })]);

  // Same writes as before: cake_orders.status (useCakeOrders.updateOrderStatus) and cake_orders.payment_status.
  const handleStatusChange = async (order: AdminCakeOrder, next: string) => {
    const { error } = await supabase.from('cake_orders').update({ status: next } as any).eq('id', order.id);
    if (!error) { toast({ title: tr('admincakes_status_yenilendi_890662', 'Status yeniləndi') }); setSelected(current => current?.id === order.id ? { ...current, status: next } : current); void refresh(); }
    else toast({ title: tr('admincakes_xeta_3cdbb6', 'Xəta'), description: tr('admincakes_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });
  };
  const handlePaymentStatusChange = async (order: AdminCakeOrder, paymentStatus: string) => {
    try {
      const { error } = await supabase.from('cake_orders').update({ payment_status: paymentStatus } as any).eq('id', order.id);
      if (error) throw error;
      toast({ title: tr('admincakes_odenis_statusu_yenilendi_9fad6d', 'Ödəniş statusu yeniləndi') });
      setSelected(current => current?.id === order.id ? { ...current, payment_status: paymentStatus } : current); void refresh();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast({ title: tr('admincakes_xeta_3cdbb6', 'Xəta'), variant: 'destructive' });
    }
  };
  const columns: Column<AdminCakeOrder>[] = [
    { key: 'customer', header: 'Müştəri', mobile: 'title', cell: order => <span><span className="ak-cell-main">{order.customer_name}</span><span className="ak-cell-sub">{order.contact_phone || '—'}</span></span> },
    { key: 'child', header: 'Uşaq / mətn', cell: order => <span><span className="ak-cell-main">{order.child_name || '—'}</span><span className="ak-cell-sub line-clamp-1">{order.custom_text || ''}</span></span> },
    { key: 'delivery', header: 'Çatdırılma', cell: order => <span className="ak-num">{order.delivery_date ? fmtDate(order.delivery_date) : '—'}</span> },
    { key: 'payment', header: 'Ödəniş', cell: order => <span className="flex items-center gap-1.5"><StatusPill tone={toneFor(order.payment_status || 'pending')}>{PAYMENT_STATUSES.find(item => item.value === order.payment_status)?.label || tr('admincakes_gozleyir_9ac18a', 'Gözləyir')}</StatusPill><span className="ak-cell-sub">{paymentMethodLabel(order.payment_method)}</span></span> },
    { key: 'total', header: 'Məbləğ', align: 'end', cell: order => <span><strong className="ak-num">{fmtMoney(order.total_price)}</strong>{Number(order.cashback_used) > 0 && <span className="ak-cell-sub">QayğıCash −{fmtMoney(order.cashback_used)}</span>}</span> },
    { key: 'status', header: 'Status', cell: order => (
      <select className="ak-select" style={{ height: 30, fontSize: 12.5 }} aria-label="Status" value={order.status} onClick={event => event.stopPropagation()} onChange={event => void handleStatusChange(order, event.target.value)}>
        {ORDER_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>) },
  ];
  return (
    <Section flush>
      <div className="px-4 pb-3"><FilterChips label="Status" value={status} onChange={value => { setStatus(value); setPage(0); }}
        options={[{ value: 'all', label: 'Hamısı', count: counts?.all }, ...ORDER_STATUSES.map(item => ({ value: item.value, label: item.label, count: counts?.[item.value] }))]} /></div>
      <DataTable testId="admin-cake-orders" columns={columns} rows={list.data?.rows} rowKey={order => order.id} loading={list.isLoading} fetching={list.isFetching && !list.isLoading}
        error={list.isError ? list.error : null} onRetry={() => void list.refetch()} page={page} total={list.data?.total ?? 0} pageSize={PAGE} onPageChange={setPage} onRowClick={order => { setProofViewUrl(null); setSelected(order); }}
        empty={<EmptyState title={tr('admincakes_hele_sifaris_yoxdur_b283b8', 'Hələ sifariş yoxdur')} />} />
      {selected && (
        <SideDrawer open onOpenChange={open => { if (!open) setSelected(null); }} title={selected.customer_name} description={fmtDateTime(selected.created_at)} footer={null}>
          <DescriptionList items={[
            ['Məbləğ', <strong key="m">{fmtMoney(selected.total_price)}</strong>], ['Uşaq', selected.child_name], ['Mətn', selected.custom_text], ['Telefon', selected.contact_phone],
            ['Çatdırılma', selected.delivery_date], ['Ünvan', selected.delivery_address], ['Qeyd', selected.notes], ['Ödəniş üsulu', paymentMethodLabel(selected.payment_method)],
            ...Object.entries(selected.custom_fields ?? {}).map(([key, value]) => [key, String(value)] as [string, string]),
          ]} />
          <FieldGrid>
            <Field label="Sifariş statusu">{id => <select id={id} className="ak-select w-full" value={selected.status} onChange={event => void handleStatusChange(selected, event.target.value)}>{ORDER_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}</Field>
            <Field label="Ödəniş statusu">{id => <select id={id} className="ak-select w-full" value={selected.payment_status || 'pending'} onChange={event => void handlePaymentStatusChange(selected, event.target.value)}>{PAYMENT_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}</Field>
          </FieldGrid>
          {selected.payment_proof_url && (proofViewUrl ? (selected.payment_proof_url.endsWith('.pdf') ? <iframe title={tr('admincakes_odenis_tesdiqi_241387', 'Ödəniş Təsdiqi')} src={selected.payment_proof_url} className="w-full h-[480px] rounded-lg" />
            : <img src={selected.payment_proof_url} alt={tr('admincakes_odenis_tesdiqi_5feb93', 'Ödəniş təsdiqi')} className="w-full rounded-lg border" />)
            : <Btn onClick={() => setProofViewUrl(selected.payment_proof_url!)}><ImageIcon size={14} />{tr('admincakes_odenis_tesdiqini_gor_4fb44e', 'Ödəniş təsdiqini gör')}</Btn>)}
        </SideDrawer>
      )}
    </Section>
  );
}

function PaymentMethods() {
  const localize = useAdminLocalize();
  const { toast } = useToast();
  const { methods: paymentMethods, loading: pmLoading, updateMethod } = useAdminPaymentMethods();
  const [editingConfig, setEditingConfig] = useState<{ id: string; config: Record<string, any> } | null>(null), [saving, setSaving] = useState(false);
  const handleTogglePaymentMethod = async (id: string, isActive: boolean) => {
    const success = await updateMethod(id, { is_active: isActive });
    if (success) toast({ title: isActive ? tr('admincakes_odenis_metodu_aktivlesdirildi_d5e562', 'Ödəniş metodu aktivləşdirildi') : tr('admincakes_odenis_metodu_deaktiv_edildi_d694e7', 'Ödəniş metodu deaktiv edildi') });
  };
  const handleSaveC2CConfig = async () => {
    if (!editingConfig) return;
    setSaving(true);
    const success = await updateMethod(editingConfig.id, { config: editingConfig.config } as any);
    setSaving(false);
    if (success) { toast({ title: tr('admincakes_konfiqurasiya_yadda_saxlanildi_919f9e', 'Konfiqurasiya yadda saxlanıldı') }); setEditingConfig(null); }
    else toast({ title: tr('admincakes_xeta_3cdbb6', 'Xəta'), variant: 'destructive' });
  };
  const setConfig = (key: string, value: string) => setEditingConfig(current => current && { ...current, config: { ...current.config, [key]: value } });
  return (
    <Section title="Ödəniş üsulları" description={tr('admincakes_tort_sifarisleri_ucun_movcud_odenis_usul_72681e', 'Tort sifarişləri üçün mövcud ödəniş üsullarını aktiv/deaktiv edin')}>
      {pmLoading ? <SkeletonRows rows={3} columns={2} /> : paymentMethods.map(method => (
        <SettingRow key={method.id} title={localize(method, 'label')} description={<>{localize(method, 'description')}{method.method_key === 'c2c_transfer' && <button type="button" className="block text-primary text-xs mt-1 hover:underline"
          onClick={() => setEditingConfig({ id: method.id, config: method.config || {} })}>{tr('admincakes_kart_melumatlarini_redakte_et_c4cc82', '⚙️ Kart məlumatlarını redaktə et')}</button>}</>}
          control={<Switch checked={method.is_active} onCheckedChange={checked => void handleTogglePaymentMethod(method.id, checked)} aria-label={localize(method, 'label')} />} />
      ))}
      {editingConfig && (
        <SideDrawer open onOpenChange={open => { if (!open) setEditingConfig(null); }} title="Kartdan Karta - Konfiqurasiya" onSave={() => void handleSaveC2CConfig()} saving={saving}>
          <Field label={tr('admincakes_kart_nomresi_ace5c5', 'Kart nömrəsi')}>{id => <input id={id} className="ak-input ak-mono" value={editingConfig.config.card_number || ''} onChange={event => setConfig('card_number', event.target.value)} placeholder="0000 0000 0000 0000" />}</Field>
          <Field label="Kart sahibi">{id => <input id={id} className="ak-input" value={editingConfig.config.card_holder || ''} onChange={event => setConfig('card_holder', event.target.value)} placeholder="Ad Soyad" />}</Field>
          <Field label={tr('admincakes_bank_adi_5dc2f7', 'Bank adı')}>{id => <input id={id} className="ak-input" value={editingConfig.config.bank_name || ''} onChange={event => setConfig('bank_name', event.target.value)} placeholder={tr('admincakes_mes_kapital_bank_57ef78', 'Məs: Kapital Bank')} />}</Field>
          <Field label={tr('admincakes_elave_telimat_60b61b', 'Əlavə təlimat')}>{id => <textarea id={id} className="ak-textarea" value={editingConfig.config.instructions || ''} onChange={event => setConfig('instructions', event.target.value)} placeholder={tr('admincakes_kocurme_zamani_qeyd_hissesinde_sifaris_n_e15a2a', 'Köçürmə zamanı qeyd hissəsində sifariş nömrənizi yazın')} />}</Field>
        </SideDrawer>
      )}
    </Section>
  );
}

export default AdminCakes;
