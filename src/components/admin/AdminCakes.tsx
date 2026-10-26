import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Cake as CakeIcon, Loader2, Upload, X, Eye, EyeOff, Settings, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminCakes, type Cake } from '@/hooks/useCakes';
import { useCakeOrders } from '@/hooks/useCakes';
import { useAdminPaymentMethods } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const MILESTONE_OPTIONS = [
{ value: 'first_tooth', label: tr("admincakes_ilk_dis_03153e", "İlk Diş") },
{ value: 'first_step', label: tr("admincakes_ilk_addim_e1c5b9", "İlk Addım") },
{ value: 'first_word', label: tr("admincakes_ilk_soz_2ce62a", "İlk Söz") },
{ value: 'first_birthday', label: tr("admincakes_1_yas_fee411", "1 Yaş") },
{ value: 'first_food', label: tr("admincakes_ilk_yemek_92d22e", "İlk Yemək") },
{ value: 'crawling', label: tr("admincakes_surunme_5dccab", "Sürünmə") },
{ value: 'sitting', label: 'Oturma' },
{ value: 'standing', label: tr("admincakes_ayaga_durma_1d8061", "Ayağa Durma") },
{ value: 'custom', label: tr("admincakes_xususi_1055b8", "Xüsusi") }];


const ORDER_STATUSES = [
{ value: 'pending', label: tr("admincakes_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-100 text-yellow-700' },
{ value: 'confirmed', label: tr("admincakes_tesdiqlendi_0c46e4", "Təsdiqləndi"), color: 'bg-blue-100 text-blue-700' },
{ value: 'preparing', label: tr("admincakes_hazirlanir_c15a4b", "Hazırlanır"), color: 'bg-purple-100 text-purple-700' },
{ value: 'ready', label: tr("admincakes_hazirdir_acac14", "Hazırdır"), color: 'bg-green-100 text-green-700' },
{ value: 'delivered', label: tr("admincakes_catdirildi_324039", "Çatdırıldı"), color: 'bg-emerald-100 text-emerald-700' },
{ value: 'cancelled', label: tr("admincakes_legv_edildi_bfa98b", "Ləğv edildi"), color: 'bg-red-100 text-red-700' }];


const PAYMENT_STATUSES = [
{ value: 'pending', label: tr("admincakes_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-100 text-yellow-700' },
{ value: 'paid', label: tr("admincakes_odenilib_4f2298", "Ödənilib"), color: 'bg-green-100 text-green-700' },
{ value: 'failed', label: tr("admincakes_ugursuz_541932", "Uğursuz"), color: 'bg-red-100 text-red-700' }];


const AdminCakes = () => {
    const localize = useAdminLocalize();
  const { toast } = useToast();
  const { cakes, loading, addCake, updateCake, deleteCake } = useAdminCakes();
  const { orders, updateOrderStatus } = useCakeOrders();
  const { methods: paymentMethods, loading: pmLoading, updateMethod } = useAdminPaymentMethods();
  const [activeTab, setActiveTab] = useState<'cakes' | 'orders' | 'payments'>('cakes');
  const [showForm, setShowForm] = useState(false);
  const [editingCake, setEditingCake] = useState<Cake | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<{id: string;config: Record<string, any>;} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    images: [] as string[],
    category: 'month' as 'month' | 'milestone',
    month_number: '1',
    milestone_type: '',
    milestone_label: '',
    is_active: true,
    sort_order: '0',
    has_custom_fields: false,
    custom_field_labels: '' as string
  });

  const resetForm = () => {
    setFormData({
      name: '', description: '', price: '', image_url: '', images: [],
      category: 'month', month_number: '1', milestone_type: '',
      milestone_label: '', is_active: true, sort_order: '0',
      has_custom_fields: false, custom_field_labels: ''
    });
    setEditingCake(null);
    setShowForm(false);
  };

  const openEdit = (cake: Cake) => {
    setEditingCake(cake);
    setFormData({
      name: cake.name,
      description: cake.description || '',
      price: String(cake.price),
      image_url: cake.image_url || '',
      images: Array.isArray(cake.images) ? cake.images : [],
      category: cake.category as 'month' | 'milestone',
      month_number: String(cake.month_number || 1),
      milestone_type: cake.milestone_type || '',
      milestone_label: cake.milestone_label || '',
      is_active: cake.is_active,
      sort_order: String(cake.sort_order),
      has_custom_fields: cake.has_custom_fields || false,
      custom_field_labels: Array.isArray(cake.custom_field_labels) ? cake.custom_field_labels.join(', ') : ''
    });
    setShowForm(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: tr("admincakes_fayl_cox_boyukdur_f5cf61", "Fayl çox böyükdür"), description: 'Max 5MB', variant: 'destructive' });
      return null;
    }
    const fileName = `cake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('assets').upload(`cakes/${fileName}`, file);
    if (error) {
      toast({ title: tr("admincakes_yukleme_xetasi_eebca5", "Yükləmə xətası"), variant: 'destructive' });
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(`cakes/${fileName}`);
    return publicUrl;
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadImage(file);
    if (url) setFormData((prev) => ({ ...prev, image_url: url }));
    setUploadingImage(false);
  };

  const handleAdditionalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadImage(file);
    if (url) setFormData((prev) => ({ ...prev, images: [...prev.images, url] }));
    setUploadingImage(false);
  };

  const removeAdditionalImage = (index: number) => {
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price) {
      toast({ title: tr("admincakes_xeta_3cdbb6", "Xəta"), description: tr("admincakes_ad_ve_qiymet_teleb_olunur_9e671a", "Ad və qiymət tələb olunur"), variant: 'destructive' });
      return;
    }

    const customLabels = formData.custom_field_labels.
    split(',').
    map((s) => s.trim()).
    filter(Boolean);

    const payload: Partial<Cake> = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      image_url: formData.image_url || null,
      images: formData.images,
      category: formData.category,
      month_number: formData.category === 'month' ? parseInt(formData.month_number) : null,
      milestone_type: formData.category === 'milestone' ? formData.milestone_type : null,
      milestone_label: formData.category === 'milestone' ? formData.milestone_label : null,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
      has_custom_fields: formData.has_custom_fields,
      custom_field_labels: customLabels
    };

    const success = editingCake ?
    await updateCake(editingCake.id, payload) :
    await addCake(payload);

    if (success) {
      toast({ title: editingCake ? tr("admincakes_tort_yenilendi_6da7d2", "Tort yenil\u0259ndi") : tr("admincakes_tort_elave_edildi_ed4f93", "Tort \u0259lav\u0259 edildi") });
      resetForm();
    } else {
      toast({ title: tr("admincakes_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("admincakes_silmek_isteyirsiniz_77af6b", "Silm\u0259k ist\u0259yirsiniz?"))) return;
    const success = await deleteCake(id);
    if (success) toast({ title: 'Tort silindi' });
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    const success = await updateOrderStatus(orderId, status);
    if (success) {
      toast({ title: tr("admincakes_status_yenilendi_890662", "Status yeniləndi") });
    } else {
      toast({ title: tr("admincakes_xeta_3cdbb6", "Xəta"), description: tr("admincakes_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handlePaymentStatusChange = async (orderId: string, paymentStatus: string) => {
    try {
      const { error } = await supabase.
      from('cake_orders').
      update({ payment_status: paymentStatus } as any).
      eq('id', orderId);
      if (error) throw error;
      toast({ title: tr("admincakes_odenis_statusu_yenilendi_9fad6d", "Ödəniş statusu yeniləndi") });
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast({ title: tr("admincakes_xeta_3cdbb6", "Xəta"), variant: 'destructive' });
    }
  };

  const handleTogglePaymentMethod = async (id: string, isActive: boolean) => {
    const success = await updateMethod(id, { is_active: isActive });
    if (success) {
      toast({ title: isActive ? tr("admincakes_odenis_metodu_aktivlesdirildi_d5e562", "\xD6d\u0259ni\u015F metodu aktivl\u0259\u015Fdirildi") : tr("admincakes_odenis_metodu_deaktiv_edildi_d694e7", "\xD6d\u0259ni\u015F metodu deaktiv edildi") });
    }
  };

  const handleSaveC2CConfig = async () => {
    if (!editingConfig) return;
    const success = await updateMethod(editingConfig.id, { config: editingConfig.config } as any);
    if (success) {
      toast({ title: tr("admincakes_konfiqurasiya_yadda_saxlanildi_919f9e", "Konfiqurasiya yadda saxlanıldı") });
      setEditingConfig(null);
    } else {
      toast({ title: tr("admincakes_xeta_3cdbb6", "Xəta"), variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">🎂 Tortlar</h2>
          <p className="text-muted-foreground text-sm">{tr("admincakes_ayliq_ve_milestone_tortlarini_idare_edin_10f658", "Aylıq və Milestone tortlarını idarə edin")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={activeTab === 'cakes' ? 'default' : 'outline'}
            onClick={() => setActiveTab('cakes')}
            size="sm">
            
            <CakeIcon className="w-4 h-4 me-1" /> Tortlar ({cakes.length})
          </Button>
          <Button
            variant={activeTab === 'orders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('orders')}
            size="sm">
            {tr("admincakes_sifarisler_9a621a", "\uD83D\uDCCB Sifari\u015Fl\u0259r (")}
            {orders.length})
          </Button>
          <Button
            variant={activeTab === 'payments' ? 'default' : 'outline'}
            onClick={() => setActiveTab('payments')}
            size="sm">
            
            <Settings className="w-4 h-4 me-1" /> {tr("admincakes_odenis_a4610e", "\xD6d\u0259ni\u015F")}
          </Button>
        </div>
      </div>

      {activeTab === 'cakes' &&
      <>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 me-2" /> {tr("admincakes_tort_elave_et_5d759e", "Tort \u0259lav\u0259 et")}
          </Button>

          {showForm &&
        <motion.div
          className="bg-card rounded-xl p-6 border shadow-sm space-y-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}>
          
              <h3 className="font-bold text-lg">{editingCake ? tr("admincakes_tortu_redakte_et_a96241", "Tortu redakt\u0259 et") : 'Yeni tort'}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Ad *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <Label>{tr("admincakes_qiymet_b6ab33", "Qiymət (₼) *")}</Label>
                  <Input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div>
                  <Label>Kateqoriya</Label>
                  <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                
                    <option value="month">{tr("admincakes_ayliq_tort_db55bc", "Aylıq Tort")}</option>
                    <option value="milestone">Milestone Tort</option>
                  </select>
                </div>
                {formData.category === 'month' &&
            <div>
                    <Label>Ay</Label>
                    <select
                value={formData.month_number}
                onChange={(e) => setFormData({ ...formData, month_number: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                
                      {Array.from({ length: 12 }, (_, i) =>
                <option key={i + 1} value={i + 1}>{i + 1}-ci ay</option>
                )}
                    </select>
                  </div>
            }
                {formData.category === 'milestone' &&
            <>
                    <div>
                      <Label>{tr("admincakes_milestone_novu_096351", "Milestone növü")}</Label>
                      <select
                  value={formData.milestone_type}
                  onChange={(e) => {
                    const opt = MILESTONE_OPTIONS.find((o) => o.value === e.target.value);
                    setFormData({
                      ...formData,
                      milestone_type: e.target.value,
                      milestone_label: opt && opt.value !== 'custom' ? opt.label : formData.milestone_label
                    });
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  
                        <option value="">{tr("admincakes_secin_5c0c8d", "Seçin")}</option>
                        {MILESTONE_OPTIONS.map((o) =>
                  <option key={o.value} value={o.value}>{o.label}</option>
                  )}
                      </select>
                    </div>
                    <div>
                      <Label>Milestone etiketi</Label>
                      <Input value={formData.milestone_label} onChange={(e) => setFormData({ ...formData, milestone_label: e.target.value })} />
                    </div>
                  </>
            }
                <div>
                  <Label>{tr("admincakes_siralama_9e1268", "Sıralama")}</Label>
                  <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>{tr("admincakes_aciqlama_c33d69", "Açıqlama")}</Label>
                <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
            
              </div>

              {/* Main Image Upload */}
              <div>
                <Label>{tr("admincakes_esas_sekil_829387", "Əsas şəkil")}</Label>
                {formData.image_url ?
            <div className="relative inline-block mt-2">
                    <img src={formData.image_url} alt="preview" className="w-32 h-32 object-cover rounded-xl" />
                    <button onClick={() => setFormData({ ...formData, image_url: '' })} className="absolute -top-2 -end-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div> :

            <label className="mt-2 flex items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition">
                    <input type="file" accept="image/*" onChange={handleMainImageUpload} className="hidden" />
                    {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                  </label>
            }
              </div>

              {/* Additional Images */}
              <div>
                <Label>{tr("admincakes_elave_sekiller_693a5b", "Əlavə şəkillər")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.map((img, i) =>
              <div key={i} className="relative">
                      <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg" />
                      <button onClick={() => removeAdditionalImage(i)} className="absolute -top-1.5 -end-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                        <X className="w-2.5 h-2.5 text-destructive-foreground" />
                      </button>
                    </div>
              )}
                  <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition">
                    <input type="file" accept="image/*" onChange={handleAdditionalImageUpload} className="hidden" />
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                <Label>Aktiv</Label>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.has_custom_fields} onChange={(e) => setFormData({ ...formData, has_custom_fields: e.target.checked })} />
                <Label>{tr("admincakes_ferdi_saheler_custom_fields_5c08c9", "Fərdi sahələr (Custom Fields)")}</Label>
              </div>

              {formData.has_custom_fields &&
          <div>
                  <Label>{tr("admincakes_sahe_adlari_vergulle_ayirin_d72a0e", "Sahə adları (vergüllə ayırın)")}</Label>
                  <Input
              value={formData.custom_field_labels}
              onChange={(e) => setFormData({ ...formData, custom_field_labels: e.target.value })}
              placeholder={tr("admincakes_mes_usaq_adi_tebrik_metni_reng_secimi_c15451", "Məs: Uşaq adı, Təbrik mətni, Rəng seçimi")} />
            
                  <p className="text-[10px] text-muted-foreground mt-1">{tr("admincakes_musteri_bu_saheleri_sifaris_zamani_doldu_f0107d", "Müştəri bu sahələri sifariş zamanı dolduracaq")}</p>
                </div>
          }

              <div className="flex gap-2">
                <Button onClick={handleSave}>Yadda saxla</Button>
                <Button variant="outline" onClick={resetForm}>{tr("admincakes_legv_et_b5e49c", "Ləğv et")}</Button>
              </div>
            </motion.div>
        }

          {/* Cakes List */}
          <div className="grid gap-3">
            {cakes.map((cake) =>
          <motion.div
            key={cake.id}
            className="bg-card rounded-xl p-4 border border-border/50 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}>
            
                {cake.image_url ?
            <img src={cake.image_url} alt={cake.name} className="w-16 h-16 rounded-xl object-cover" /> :

            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CakeIcon className="w-6 h-6 text-primary" />
                  </div>
            }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate">{cake.name}</h3>
                    {!cake.is_active && <EyeOff className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {cake.category === 'month' ? `${cake.month_number}-ci ay` : cake.milestone_label || 'Milestone'}
                    </span>
                    <span className="text-sm font-bold text-primary">{cake.price}₼</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(cake)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cake.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
          )}
            {cakes.length === 0 &&
          <p className="text-center text-muted-foreground py-8">{tr("admincakes_hele_tort_elave_edilmeyib_fe2ab6", "Hələ tort əlavə edilməyib")}</p>
          }
          </div>
        </>
      }

      {activeTab === 'orders' &&
      <div className="space-y-3">
          {orders.map((order) => {
          const orderAny = order as any;
          return (
            <motion.div
              key={order.id}
              className="bg-card rounded-xl p-4 border border-border/50 space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>
              
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{order.customer_name}</h3>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('az-AZ')}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{order.total_price}₼</span>
                </div>
                {order.child_name && <p className="text-xs"><strong>{tr("admincakes_usaq_b70dbc", "Uşaq:")}</strong> {order.child_name}</p>}
                {order.custom_text && <p className="text-xs"><strong>{tr("admincakes_metn_efe3db", "Mətn:")}</strong> {order.custom_text}</p>}
                {order.contact_phone && <p className="text-xs"><strong>Telefon:</strong> {order.contact_phone}</p>}
                {order.delivery_date && <p className="text-xs"><strong>{tr("admincakes_catdirilma_fe6804", "Çatdırılma:")}</strong> {order.delivery_date}</p>}
                {order.delivery_address && <p className="text-xs"><strong>{tr("admincakes_unvan_23accf", "Ünvan:")}</strong> {order.delivery_address}</p>}
                {order.notes && <p className="text-xs"><strong>Qeyd:</strong> {order.notes}</p>}

                {/* Payment Info */}
                {orderAny.payment_method &&
              <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                    <p className="text-xs font-semibold">{tr("admincakes_odenis_ebdf0e", "\uD83D\uDCB3 \xD6d\u0259ni\u015F:")} {
                  orderAny.payment_method === 'c2c_transfer' ? 'Kartdan Karta' :
                  orderAny.payment_method === 'card' || orderAny.payment_method === 'card_simulated' ? 'Kart' : tr("admincakes_nagd_fdeb10", "Na\u011Fd")
                  }</p>
                    {orderAny.payment_status &&
                <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  PAYMENT_STATUSES.find((s) => s.value === orderAny.payment_status)?.color || 'bg-yellow-100 text-yellow-700'}`
                  }>
                          {PAYMENT_STATUSES.find((s) => s.value === orderAny.payment_status)?.label || tr("admincakes_gozleyir_9ac18a", "G\xF6zl\u0259yir")}
                        </span>
                        <select
                    value={orderAny.payment_status || 'pending'}
                    onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                    className="h-6 rounded-md border border-input bg-background px-1 text-[10px]">
                    
                          {PAYMENT_STATUSES.map((s) =>
                    <option key={s.value} value={s.value}>{s.label}</option>
                    )}
                        </select>
                      </div>
                }
                    {orderAny.payment_proof_url &&
                <button
                  onClick={() => setProofViewUrl(orderAny.payment_proof_url)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                  
                        <ImageIcon className="w-3 h-3" />
                        {tr("admincakes_odenis_tesdiqini_gor_4fb44e", "\xD6d\u0259ni\u015F t\u0259sdiqini g\xF6r")}
                      </button>
                }
                  </div>
              }

                {order.custom_fields && Object.keys(order.custom_fields).length > 0 &&
              <div className="text-xs space-y-0.5">
                    {Object.entries(order.custom_fields).map(([k, v]) =>
                <p key={k}><strong>{k}:</strong> {v}</p>
                )}
                  </div>
              }
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Status:</Label>
                  <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                  
                    {ORDER_STATUSES.map((s) =>
                  <option key={s.value} value={s.value}>{s.label}</option>
                  )}
                  </select>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ORDER_STATUSES.find((s) => s.value === order.status)?.color || ''}`}>
                    {ORDER_STATUSES.find((s) => s.value === order.status)?.label}
                  </span>
                </div>
              </motion.div>);

        })}
          {orders.length === 0 &&
        <p className="text-center text-muted-foreground py-8">{tr("admincakes_hele_sifaris_yoxdur_b283b8", "Hələ sifariş yoxdur")}</p>
        }
        </div>
      }

      {/* Payment Methods Tab */}
      {activeTab === 'payments' &&
      <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{tr("admincakes_tort_sifarisleri_ucun_movcud_odenis_usul_72681e", "Tort sifarişləri üçün mövcud ödəniş üsullarını aktiv/deaktiv edin")}</p>
          
          {pmLoading ?
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> :

        <div className="space-y-3">
              {paymentMethods.map((method) =>
          <motion.div
            key={method.id}
            className="bg-card rounded-xl p-4 border border-border/50 flex items-center justify-between gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}>
            
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">{localize(method, 'label')}</h3>
                    <p className="text-xs text-muted-foreground">{localize(method, 'description')}</p>
                    {method.method_key === 'c2c_transfer' &&
              <button
                onClick={() => setEditingConfig({ id: method.id, config: method.config || {} })}
                className="text-xs text-primary hover:underline mt-1">
                        {tr("admincakes_kart_melumatlarini_redakte_et_c4cc82", "\u2699\uFE0F Kart m\u0259lumatlar\u0131n\u0131 redakt\u0259 et")}
                      
              </button>
              }
                  </div>
                  <Switch
              checked={method.is_active}
              onCheckedChange={(checked) => handleTogglePaymentMethod(method.id, checked)} />
            
                </motion.div>
          )}
            </div>
        }
        </div>
      }

      {/* Payment Proof Viewer Dialog */}
      <Dialog open={!!proofViewUrl} onOpenChange={() => setProofViewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("admincakes_odenis_tesdiqi_241387", "Ödəniş Təsdiqi")}</DialogTitle>
          </DialogHeader>
          {proofViewUrl && (
          proofViewUrl.endsWith('.pdf') ?
          <iframe src={proofViewUrl} className="w-full h-[500px] rounded-lg" /> :

          <img src={proofViewUrl} alt={tr("admincakes_odenis_tesdiqi_5feb93", "Ödəniş təsdiqi")} className="w-full rounded-lg" />)

          }
        </DialogContent>
      </Dialog>

      {/* C2C Config Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kartdan Karta - Konfiqurasiya</DialogTitle>
          </DialogHeader>
          {editingConfig &&
          <div className="space-y-4">
              <div>
                <Label>{tr("admincakes_kart_nomresi_ace5c5", "Kart nömrəsi")}</Label>
                <Input
                value={editingConfig.config.card_number || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, config: { ...editingConfig.config, card_number: e.target.value } })}
                placeholder="0000 0000 0000 0000" />
              
              </div>
              <div>
                <Label>Kart sahibi</Label>
                <Input
                value={editingConfig.config.card_holder || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, config: { ...editingConfig.config, card_holder: e.target.value } })}
                placeholder="Ad Soyad" />
              
              </div>
              <div>
                <Label>{tr("admincakes_bank_adi_5dc2f7", "Bank adı")}</Label>
                <Input
                value={editingConfig.config.bank_name || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, config: { ...editingConfig.config, bank_name: e.target.value } })}
                placeholder={tr("admincakes_mes_kapital_bank_57ef78", "Məs: Kapital Bank")} />
              
              </div>
              <div>
                <Label>{tr("admincakes_elave_telimat_60b61b", "Əlavə təlimat")}</Label>
                <textarea
                value={editingConfig.config.instructions || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, config: { ...editingConfig.config, instructions: e.target.value } })}
                placeholder={tr("admincakes_kocurme_zamani_qeyd_hissesinde_sifaris_n_e15a2a", "Köçürmə zamanı qeyd hissəsində sifariş nömrənizi yazın")}
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
              
              </div>
              <Button onClick={handleSaveC2CConfig} className="w-full">Yadda saxla</Button>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminCakes;