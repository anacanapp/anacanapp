import { tr } from "@/lib/tr";import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface Venue {
  id?: string;
  name: string;
  category_key: string;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  discount_label: string;
  discount_value?: number | null;
  discount_terms?: string | null;
  redemption_cooldown_hours: number;
  redemption_lifetime_limit?: number | null;
  qr_ttl_seconds: number;
  pin_hash?: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  /** Boş = qlobal (bütün ölkələr); dolu = yalnız bu ISO kodlar */
  countries?: string[] | null;
}

const emptyVenue = (): Venue => ({
  name: '', category_key: 'spa', discount_label: '20% endirim',
  redemption_cooldown_hours: 24, qr_ttl_seconds: 300,
  is_active: true, is_featured: false, sort_order: 0,
  countries: []
});

export default function AdminPartnerVenues() {
    const localize = useAdminLocalize();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<{key: string;label_az: string;}[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [{ data: v }, { data: c }] = await Promise.all([
    supabase.from('partner_venues').select('*').order('sort_order'),
    supabase.from('partner_venue_categories').select('key, label_az').order('sort_order')]
    );
    setVenues(v as any || []);
    setCategories(c as any || []);
  };

  useEffect(() => {load();}, []);

  const openNew = () => {setEditing(emptyVenue());setPin('');setOpen(true);};
  const openEdit = (v: Venue) => {setEditing({ ...v });setPin('');setOpen(true);};

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.discount_label) {
      toast({ title: tr("adminpartnervenues_ad_ve_endirim_metni_vacibdir_8c2860", "Ad v\u0259 endirim m\u0259tni vacibdir"), variant: 'destructive' });return;
    }
    if (!editing.id && !pin) {
      toast({ title: tr("adminpartnervenues_yeni_mekan_ucun_pin_qoyun_12d054", "Yeni m\u0259kan \xFC\xE7\xFCn PIN qoyun"), variant: 'destructive' });return;
    }
    setLoading(true);
    try {
      const payload: any = { ...editing };
      delete payload.id;
      if (pin) payload.pin_hash = await bcrypt.hash(pin, 10);else
      delete payload.pin_hash;

      if (editing.id) {
        const { error } = await supabase.from('partner_venues').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('partner_venues').insert(payload);
        if (error) throw error;
      }
      toast({ title: tr("adminpartnervenues_yadda_saxlandi_f72ffd", "Yadda saxland\u0131") });
      setOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: tr("adminpartnervenues_xeta_3cdbb6", "X\u0259ta"), description: e.message, variant: 'destructive' });
    } finally {setLoading(false);}
  };

  const del = async (v: Venue) => {
    if (!confirm(`"${v.name}" silinsin?`)) return;
    const { error } = await supabase.from('partner_venues').delete().eq('id', v.id!);
    if (error) {toast({ title: tr("adminpartnervenues_xeta_3cdbb6", "X\u0259ta"), description: error.message, variant: 'destructive' });return;}
    toast({ title: 'Silindi' });
    await load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> {tr("adminpartnervenues_partnyor_mekanlari_3b1b0e", "Partnyor M\u0259kanlar\u0131")}</h1>
          <p className="text-sm text-muted-foreground">{tr("adminpartnervenues_premium_istifadecilere_endirim_87c381", "Premium istifad\u0259\xE7il\u0259r\u0259 endirim ver\u0259n m\u0259kanlar")}</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 me-1" /> {tr("adminpartnervenues_yeni_mekan_b6bd89", "Yeni m\u0259kan")}</Button>
      </div>

      <div className="grid gap-3">
        {venues.map((v) =>
        <Card key={v.id} className="p-3 flex items-center gap-3">
            {v.logo_url ? <img src={v.logo_url} className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Sparkles className="w-5 h-5 text-muted-foreground" /></div>}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{v.name}</h3>
                {v.is_featured && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">★</span>}
                {!v.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Deaktiv</span>}
              </div>
              <p className="text-xs text-muted-foreground">{v.category_key} • {v.discount_label} • cooldown {v.redemption_cooldown_hours}h • TTL {v.qr_ttl_seconds}s</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Edit className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => del(v)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </Card>
        )}
        {venues.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">{tr("adminpartnervenues_hele_partnyor_mekani_yoxdur_91d1c9", "H\u0259l\u0259 partnyor m\u0259kan\u0131 yoxdur.")}</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? tr("adminpartnervenues_mekani_redakte_et_b5f637", "M\u0259kan\u0131 redakt\u0259 et") : tr("adminpartnervenues_yeni_partnyor_mekani_e4d0c8", "Yeni partnyor m\u0259kan\u0131")}</DialogTitle></DialogHeader>
          {editing &&
          <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Ad" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <select className="h-10 border border-input rounded-md px-3 bg-background" value={editing.category_key} onChange={(e) => setEditing({ ...editing, category_key: e.target.value })}>
                  {categories.map((c) => <option key={c.key} value={c.key}>{c.label_az}</option>)}
                </select>
              </div>
              <textarea placeholder={tr("adminpartnervenues_tesvir_f85651", "T\u0259svir")} className="w-full min-h-[80px] border border-input rounded-md p-2 bg-background text-sm" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Logo URL" value={editing.logo_url || ''} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} />
                <Input placeholder="Cover URL" value={editing.cover_url || ''} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} />
                <Input placeholder={tr("adminpartnervenues_unvan_b8651a", "\xDCnvan")} value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
                <Input placeholder={tr("adminpartnervenues_seher_5f373c", "\u015E\u0259h\u0259r")} value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                <Input placeholder="Telefon" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                <Input placeholder="Veb sayt" value={editing.website || ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} />
                <Input placeholder="Instagram (@user)" value={editing.instagram || ''} onChange={(e) => setEditing({ ...editing, instagram: e.target.value })} />
              </div>
              <div>
                <Input
                placeholder={tr("adminpartnervenues_olkeler_ph", "Ölkələr (ISO, vergüllə — boş = qlobal): AZ, TR")}
                value={(editing.countries || []).join(', ')}
                onChange={(e) => setEditing({ ...editing, countries: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) })} />
                <p className="text-xs text-muted-foreground mt-1">
                  🌍 {tr("adminpartnervenues_olkeler_hint", "Boş saxlasanız məkan bütün ölkələrdə görünür (qlobal). ISO kod yazsanız yalnız o ölkələrdə.")}
                </p>
              </div>
              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">{tr("adminpartnervenues_endirim_qaydalari_ff9857", "Endirim qaydalar\u0131")}</h4>
                <Input placeholder={tr("adminpartnervenues_endirim_metni_mes_20_endirim_bf90b6", "Endirim m\u0259tni (m\u0259s: 20% endirim)")} value={editing.discount_label} onChange={(e) => setEditing({ ...editing, discount_label: e.target.value })} />
                <textarea placeholder={tr("adminpartnervenues_sertler_istisnalar_vaxt_limiti_f3107b", "\u015E\u0259rtl\u0259r (istisnalar, vaxt limiti)")} className="w-full mt-2 min-h-[60px] border border-input rounded-md p-2 bg-background text-sm" value={editing.discount_terms || ''} onChange={(e) => setEditing({ ...editing, discount_terms: e.target.value })} />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <label className="text-xs">Cooldown (saat)<Input type="number" value={editing.redemption_cooldown_hours} onChange={(e) => setEditing({ ...editing, redemption_cooldown_hours: parseInt(e.target.value) || 0 })} /></label>
                  <label className="text-xs">{tr("adminpartnervenues_umumi_limit_bos_limitsiz_007df7", "\xDCmumi limit (bo\u015F = limitsiz)")}<Input type="number" value={editing.redemption_lifetime_limit ?? ''} onChange={(e) => setEditing({ ...editing, redemption_lifetime_limit: e.target.value ? parseInt(e.target.value) : null })} /></label>
                  <label className="text-xs">QR TTL (san)<Input type="number" value={editing.qr_ttl_seconds} onChange={(e) => setEditing({ ...editing, qr_ttl_seconds: parseInt(e.target.value) || 60 })} /></label>
                </div>
              </div>
              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">{tr("adminpartnervenues_mekan_pin_kodu_138eb6", "M\u0259kan PIN kodu")} {editing.id && tr("adminpartnervenues_bos_buraxin_deyismez_218725", "(bo\u015F burax\u0131n \u2192 d\u0259yi\u015Fm\u0259z)")}</h4>
                <div className="relative">
                  <Input type={showPin ? 'text' : 'password'} placeholder={editing.id ? tr("adminpartnervenues_yeni_pin_bos_saxlanilir_b6dd56", "Yeni PIN (bo\u015F = saxlan\u0131l\u0131r)") : 'PIN qoy'} value={pin} onChange={(e) => setPin(e.target.value)} />
                  <button type="button" className="absolute end-2 top-2" onClick={() => setShowPin(!showPin)}>{showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Aktiv</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> {tr("adminpartnervenues_one_cixar_2d3484", "\xD6n\u0259 \xE7\u0131xar")}</label>
                <label className="text-sm flex items-center gap-2">{tr("adminpartnervenues_sira_d654d0", "S\u0131ra:")} <Input className="w-20" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></label>
              </div>
              <Button onClick={save} disabled={loading} className="w-full">{loading ? tr("adminpartnervenues_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Yadda saxla'}</Button>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

}