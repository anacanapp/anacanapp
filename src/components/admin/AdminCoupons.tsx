import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ORDER_TYPES = [
{ key: 'shop', label: tr("admincoupons_magaza_defaa2", "Mağaza") },
{ key: 'cake', label: 'Tortlar' },
{ key: 'album', label: tr("admincoupons_albom_sifarisi_c85887", "Albom Sifarişi") }];


interface CouponForm {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  applicable_to: string[];
  is_active: boolean;
  expires_at: string;
}

const emptyForm: CouponForm = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  min_order_amount: 0,
  max_uses: null,
  applicable_to: ['shop'],
  is_active: true,
  expires_at: ''
};

const AdminCoupons = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('coupons' as any).
      select('*').
      order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_amount: form.min_order_amount || 0,
        max_uses: form.max_uses || null,
        applicable_to: form.applicable_to,
        is_active: form.is_active,
        expires_at: form.expires_at || null
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
      toast({ title: editing ? tr("admincoupons_yenilendi_d10a01", "Yenil\u0259ndi") : tr("admincoupons_yaradildi_5735d0", "Yarad\u0131ld\u0131") });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: tr("admincoupons_xeta_3cdbb6", "Xəta"), description: err.message, variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Silindi' });
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => toast({ title: tr("admincoupons_xeta_3cdbb6", "Xəta"), description: err.message, variant: 'destructive' })
  });

  const handleEdit = (coupon: any) => {
    setEditing(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || 0,
      max_uses: coupon.max_uses,
      applicable_to: coupon.applicable_to || ['shop'],
      is_active: coupon.is_active,
      expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : ''
    });
    setShowForm(true);
  };

  const toggleApplicable = (key: string) => {
    setForm((prev) => ({
      ...prev,
      applicable_to: prev.applicable_to.includes(key) ?
      prev.applicable_to.filter((k) => k !== key) :
      [...prev.applicable_to, key]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tr("admincoupons_kupon_kodlari_c425a7", "Kupon Kodları")}</h2>
          <p className="text-muted-foreground text-sm">{tr("admincoupons_endirim_kuponlarini_idare_edin_e8910a", "Endirim kuponlarını idarə edin")}</p>
        </div>
        <Button onClick={() => {setForm(emptyForm);setEditing(null);setShowForm(true);}} className="gap-2">
          <Plus className="w-4 h-4" /> Yeni Kupon
        </Button>
      </div>

      {/* Form */}
      {showForm &&
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-4 space-y-4">
        
          <h3 className="font-bold">{editing ? tr("admincoupons_kuponu_redakte_et_a2dc32", "Kuponu Redakt\u0259 Et") : 'Yeni Kupon'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kupon Kodu *</Label>
              <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="ANACAN20" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{tr("admincoupons_tesvir_f85651", "Təsvir")}</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="20% endirim" className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{tr("admincoupons_endirim_novu_f920da", "Endirim növü")}</Label>
              <select
              value={form.discount_type}
              onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value as any }))}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
              
                <option value="percentage">Faiz (%)</option>
                <option value="fixed">{tr("admincoupons_sabit_mebleg_7529ee", "Sabit məbləğ (₼)")}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">{tr("admincoupons_endirim_deyeri_09b16e", "Endirim dəyəri *")}</Label>
              <Input
              type="number"
              value={form.discount_value}
              onChange={(e) => setForm((p) => ({ ...p, discount_value: Number(e.target.value) }))}
              className="mt-1" />
            
            </div>
            <div>
              <Label className="text-xs">{tr("admincoupons_min_sifaris_meblegi_8d624c", "Min. sifariş məbləği (₼)")}</Label>
              <Input
              type="number"
              value={form.min_order_amount}
              onChange={(e) => setForm((p) => ({ ...p, min_order_amount: Number(e.target.value) }))}
              className="mt-1" />
            
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{tr("admincoupons_maks_istifade_sayi_bos_limitsiz_b97fbe", "Maks. istifadə sayı (boş = limitsiz)")}</Label>
              <Input
              type="number"
              value={form.max_uses ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value ? Number(e.target.value) : null }))}
              placeholder="Limitsiz"
              className="mt-1" />
            
            </div>
            <div>
              <Label className="text-xs">{tr("admincoupons_bitme_tarixi_bos_limitsiz_a2f8c4", "Bitmə tarixi (boş = limitsiz)")}</Label>
              <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
              className="mt-1" />
            
            </div>
          </div>

          {/* Applicable to */}
          <div>
            <Label className="text-xs mb-2 block">{tr("admincoupons_tetbiq_olunacaq_saheler_0c18fd", "Tətbiq olunacaq sahələr")}</Label>
            <div className="flex flex-wrap gap-2">
              {ORDER_TYPES.map((t) =>
            <button
              key={t.key}
              type="button"
              onClick={() => toggleApplicable(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              form.applicable_to.includes(t.key) ?
              'bg-primary text-primary-foreground border-primary' :
              'bg-muted text-muted-foreground border-border'}`
              }>
              
                  {t.label}
                </button>
            )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
            <Label className="text-sm">Aktiv</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={!form.code || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : null}
              {editing ? tr("admincoupons_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
            </Button>
            <Button variant="outline" onClick={() => {setShowForm(false);setEditing(null);}}>{tr("admincoupons_legv_et_b5e49c", "Ləğv et")}</Button>
          </div>
        </motion.div>
      }

      {/* List */}
      {isLoading ?
      <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> :
      coupons.length === 0 ?
      <div className="text-center py-8 text-muted-foreground">
          <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{tr("admincoupons_hele_kupon_yoxdur_e859a2", "Hələ kupon yoxdur")}</p>
        </div> :

      <div className="space-y-2">
          {coupons.map((c: any) =>
        <div key={c.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.is_active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <Tag className={`w-5 h-5 ${c.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{c.code}</span>
                  {!c.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">Deaktiv</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value}₼`} endirim
                  {' · '}
                  {(c.applicable_to || []).join(', ')}
                  {c.max_uses ? ` · ${c.used_count || 0}/${c.max_uses} istifadə` : ` · ${c.used_count || 0} istifadə`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteMutation.mutate(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
        )}
        </div>
      }
    </div>);

};

export default AdminCoupons;