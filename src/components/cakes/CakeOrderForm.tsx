import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Cake as CakeIcon, CreditCard, Banknote, Lock, ArrowLeftRight, Upload, Loader2, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCakeOrders } from '@/hooks/useCakes';
import { useCakeCart } from '@/hooks/useCakeCart';
import { usePaymentMethods, type PaymentMethod } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';
import { tr } from "@/lib/tr";

interface CakeOrderFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

const CakeOrderForm = ({ onBack, onSuccess }: CakeOrderFormProps) => {
  const { toast } = useToast();
  const { createOrder } = useCakeOrders();
  const { items, totalPrice, clearCart } = useCakeCart();
  const { getActiveMethods, loading: pmLoading } = usePaymentMethods();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [showCardProcessing, setShowCardProcessing] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState<string | null>(null);

  const activeMethods = getActiveMethods();

  // Set default to first active method
  useEffect(() => {
    if (activeMethods.length > 0 && !activeMethods.find((m) => m.method_key === paymentMethod)) {
      setPaymentMethod(activeMethods[0].method_key);
    }
  }, [activeMethods]);

  const c2cMethod = activeMethods.find((m) => m.method_key === 'c2c_transfer');
  const c2cConfig = c2cMethod?.config || {};

  const [formData, setFormData] = useState({
    customer_name: '',
    child_name: '',
    contact_phone: '',
    delivery_date: '',
    delivery_address: '',
    notes: ''
  });

  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    holder: ''
  });

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const validateCard = () => {
    const digits = cardData.number.replace(/\s/g, '');
    if (digits.length < 16) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_kart_nomresi_16_reqem_olmalidir_b9c9c8", 'Kart nömrəsi 16 rəqəm olmalıdır'), variant: 'destructive' });
      return false;
    }
    if (cardData.expiry.length < 5) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_son_istifade_tarixi_duzgun_deyil_2e2746", 'Son istifadə tarixi düzgün deyil'), variant: 'destructive' });
      return false;
    }
    if (cardData.cvv.length < 3) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_cvv_duzgun_deyil_90757f", 'CVV düzgün deyil'), variant: 'destructive' });
      return false;
    }
    if (!cardData.holder.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_kart_sahibinin_adi_teleb_olunur_e035f1", 'Kart sahibinin adı tələb olunur'), variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_yalniz_sekil_jpg_png_ve_ya_pdf_yukleye_b_40df31", 'Yalnız şəkil (JPG, PNG) və ya PDF yükləyə bilərsiniz'), variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_fayl_max_10mb_ola_biler_145df4", 'Fayl max 10MB ola bilər'), variant: 'destructive' });
      return;
    }

    setUploadingProof(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `payment-proof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from('assets').upload(`payment-proofs/${fileName}`, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(`payment-proofs/${fileName}`);
      setProofUrl(publicUrl);
      setProofFileName(file.name);
      toast({ title: tr("cakeorderform_fayl_yuklendi_e6d838", 'Fayl yükləndi ✓') });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: tr("cakeorderform_yukleme_xetasi_eebca5", 'Yükləmə xətası'), variant: 'destructive' });
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.customer_name.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_musteri_adi_teleb_olunur_fc1733", 'Müştəri adı tələb olunur'), variant: 'destructive' });
      return;
    }
    if (!formData.contact_phone.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_elaqe_nomresi_teleb_olunur_1c55b7", 'Əlaqə nömrəsi tələb olunur'), variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_sebet_bosdur_ff5b34", 'Səbət boşdur'), variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'card_simulated' && !validateCard()) return;
    if (paymentMethod === 'c2c_transfer' && !proofUrl) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_zehmet_olmasa_kocurme_tesdiqini_yukleyin_526cd2", 'Zəhmət olmasa köçürmə təsdiqini yükləyin'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    // Simulate card processing
    if (paymentMethod === 'card_simulated') {
      setShowCardProcessing(true);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      setShowCardProcessing(false);
    }

    const allCustomFields: Record<string, string> = {};
    items.forEach((item) => {
      Object.entries(item.customFields).forEach(([k, v]) => {
        if (v) allCustomFields[`${item.cake.name} - ${k}`] = v;
      });
    });

    const itemsSummary = items.map((i) => `${i.cake.name} x${i.quantity}`).join(', ');

    const paymentLabel = paymentMethod === 'c2c_transfer' ? 'Kartdan Karta' :
    paymentMethod === 'card_simulated' ? tr("cakeorderform_kart_de91aa", "Kart") : tr("cakeorderform_nagd_fdeb10", "Na\u011Fd");

    const result = await createOrder({
      cake_id: items[0].cake.id,
      customer_name: formData.customer_name,
      child_name: formData.child_name || null,
      custom_text: itemsSummary,
      child_age_months: items[0].cake.month_number,
      contact_phone: formData.contact_phone,
      delivery_date: formData.delivery_date || null,
      delivery_address: formData.delivery_address || null,
      notes: `${formData.notes || ''} [${paymentLabel} ${tr("cake_payment", "ödəniş")} ]`.trim(),
      custom_fields: { ...allCustomFields, payment_method: paymentLabel },
      status: 'pending',
      total_price: totalPrice
    });

    // Update payment fields separately since they're not in the typed interface
    if (result) {
      try {
        await supabase.
        from('cake_orders').
        update({
          payment_method: paymentMethod,
          payment_proof_url: proofUrl,
          payment_status: paymentMethod === 'c2c_transfer' ? 'pending' : paymentMethod === 'card_simulated' ? 'paid' : 'pending'
        } as any).
        eq('id', (result as any).id);
      } catch (e) {
        console.error('Error updating payment info:', e);
      }

      clearCart();
      toast({ title: tr("cakeorderform_sifaris_gonderildi_712bb6", 'Sifariş göndərildi! 🎂') });
      onSuccess();
    } else {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_sifaris_gonderile_bilmedi_52b41e", 'Sifariş göndərilə bilmədi'), variant: 'destructive' });
    }
    setSubmitting(false);
  };

  // Card processing overlay
  if (showCardProcessing) {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--a-bg)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center">
          
          <motion.div
            animate={{ rotateY: [0, 180, 360] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--a-grad-peach)' }}>
            
            <CreditCard className="w-10 h-10" style={{ color: 'var(--a-accent-ink)' }} />
          </motion.div>
          <h2 className="text-lg mb-2 a-heading" style={{ margin: '0 0 8px', color: 'var(--a-ink)' }}>{tr("cakeorderform_odenis_emal_olunur_7b4caf", "Ödəniş emal olunur...")}</h2>
          <p className="text-sm" style={{ margin: 0, color: 'var(--a-on-bg-soft)' }}>{tr("cakeorderform_zehmet_olmasa_gozleyin_219fe5", "Zəhmət olmasa gözləyin")}</p>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <Lock className="w-3.5 h-3.5" style={{ color: 'var(--a-on-bg-soft)' }} />
            <span className="text-xs" style={{ color: 'var(--a-on-bg-soft)' }}>{tr("cakeorderform_tehlukesiz_odenis_4211a5", "Təhlükəsiz ödəniş")}</span>
          </div>
        </motion.div>
      </div>);

  }

  const getMethodIcon = (key: string) => {
    switch (key) {
      case 'cash':return <Banknote className="w-6 h-6" />;
      case 'card_simulated':return <CreditCard className="w-6 h-6" />;
      case 'c2c_transfer':return <ArrowLeftRight className="w-6 h-6" />;
      default:return <Banknote className="w-6 h-6" />;
    }
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method.method_key) {
      case 'cash':return { title: tr("cakeorderform_nagd_fdeb10", 'Nağd'), sub: tr("cakeorderform_catdirilmada_ode_fe4277", "\xC7atd\u0131r\u0131lmada \xF6d\u0259") };
      case 'card_simulated':return { title: tr("cakeorderform_kart_de91aa", "Kart"), sub: tr("cakeorderform_onlayn_odenis_fabfc1", "Onlayn \xF6d\u0259ni\u015F") };
      case 'c2c_transfer':return { title: tr("cakeorderform_kocurme_0a57a0", 'Köçürmə'), sub: 'Kartdan karta' };
      default:return { title: method.label_az || method.label, sub: method.description_az || '' };
    }
  };

  const fieldLabel = (text: string) =>
  <label className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{text}</label>;

  return (
    <div className="a-scope min-h-screen pb-44 overflow-y-auto" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell pt-2">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label="Back">
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              <p className="a-eyebrow">{items.length} tort, {totalPrice.toFixed(2)}₼</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("cakeorderform_sifaris_ver_f2be54", "Sifariş ver")}</p>
            </div>
          </div>
        </header>

        {/* Cart Summary */}
        <div className="a-list-card mb-4">
          {items.map((item, i) =>
          <div key={i} className="a-list-row">
              {item.cake.image_url ?
            <img src={item.cake.image_url} alt={item.cake.name} className="w-12 h-12 rounded-xl object-cover shrink-0" /> :

            <span className="a-list-icon" style={{ background: 'var(--a-peach-1)' }}>
                  <CakeIcon size={17} strokeWidth={2.2} style={{ color: 'var(--a-accent-ink)' }} />
                </span>
            }
              <div className="flex-1 min-w-0">
                <p className="a-list-title truncate">{item.cake.name}</p>
                <p className="a-list-sub">x{item.quantity} — {(item.cake.price * item.quantity).toFixed(2)}₼</p>
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            {fieldLabel(tr("cakeorderform_musteri_adi_e9554d", "Müştəri adı *"))}
            <input className="a-input w-full mt-1" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder={tr("cakeorderform_adinizi_daxil_edin_bd2b57", "Adınızı daxil edin")} />
          </div>
          <div>
            {fieldLabel(tr("cakeorderform_usagin_adi_80632b", "Uşağın adı"))}
            <input className="a-input w-full mt-1" value={formData.child_name} onChange={(e) => setFormData({ ...formData, child_name: e.target.value })} placeholder={tr("cakeorderform_korpenin_adi_8a4e9e", "Körpənin adı")} />
          </div>
          <div>
            {fieldLabel(tr("cakeorderform_elaqe_nomresi_feb8b9", "Əlaqə nömrəsi *"))}
            <input className="a-input w-full mt-1" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="+994 XX XXX XX XX" />
          </div>
          <div>
            {fieldLabel(tr("cakeorderform_catdirilma_tarixi_716cbd", "Çatdırılma tarixi"))}
            <input className="a-input w-full mt-1" type="date" value={formData.delivery_date} onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })} />
          </div>
          <div>
            {fieldLabel(tr("cakeorderform_catdirilma_unvani_5cec99", "Çatdırılma ünvanı"))}
            <input className="a-input w-full mt-1" value={formData.delivery_address} onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })} placeholder={tr("cakeorderform_unvani_daxil_edin_b8da41", "Ünvanı daxil edin")} />
          </div>
          <div>
            {fieldLabel(tr("cakeorderform_elave_qeydler_c98a42", "Əlavə qeydlər"))}
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={tr("cakeorderform_xususi_istekler_allergiya_ve_s_49d429", "Xüsusi istəklər, allergiya və s.")}
              className="a-input w-full mt-1 resize-none"
              style={{ minHeight: 80, height: 'auto', fontFamily: 'inherit' }} />
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            {fieldLabel(tr("cakeorderform_odenis_usulu_b9d87a", "Ödəniş üsulu"))}
            <div className={`grid gap-3 ${activeMethods.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {activeMethods.map((method) => {
                const { title, sub } = getMethodLabel(method);
                const isSelected = paymentMethod === method.method_key;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.method_key)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
                    style={isSelected ?
                    { border: '2px solid var(--a-peach-2)', background: 'var(--a-peach-1)', cursor: 'pointer' } :
                    { border: '2px solid var(--a-line)', background: 'var(--a-surface)', cursor: 'pointer' }}>
                    
                    <span style={{ color: isSelected ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)' }}>
                      {getMethodIcon(method.method_key)}
                    </span>
                    <span className="text-xs font-bold" style={{ color: isSelected ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)' }}>{title}</span>
                    <span className="text-[9px] leading-tight text-center" style={{ color: 'var(--a-ink-soft)' }}>{sub}</span>
                  </button>);

              })}
            </div>
          </div>

          {/* Card Details */}
          <AnimatePresence>
            {paymentMethod === 'card_simulated' &&
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden">
              
                <div className="a-card space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-3.5 h-3.5" style={{ color: 'var(--a-ink-soft)' }} />
                    <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_tehlukesiz_odenis_4211a5", "Təhlükəsiz ödəniş")}</span>
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_kart_nomresi_ace5c5", "Kart nömrəsi")}</label>
                    <input
                    className="a-input w-full mt-1 font-mono tracking-wider"
                    value={cardData.number}
                    onChange={(e) => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19} />
                  
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_son_istifade_9d3239", "Son istifadə")}</label>
                      <input
                      className="a-input w-full mt-1 font-mono"
                      value={cardData.expiry}
                      onChange={(e) => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
                      placeholder="MM/YY"
                      maxLength={5} />
                    
                    </div>
                    <div>
                      <label className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>CVV</label>
                      <input
                      className="a-input w-full mt-1 font-mono"
                      value={cardData.cvv}
                      onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="•••"
                      maxLength={4}
                      type="password" />
                    
                    </div>
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("untranslated_kart_sahibi_hixmbt", "Kart sahibi")}</label>
                    <input
                    className="a-input w-full mt-1 uppercase"
                    value={cardData.holder}
                    onChange={(e) => setCardData({ ...cardData, holder: e.target.value.toUpperCase() })}
                    placeholder={tr("untranslated_ad_soyad_by9a9b", "AD SOYAD")} />
                  
                  </div>
                </div>
              </motion.div>
            }
          </AnimatePresence>

          {/* C2C Transfer Details */}
          <AnimatePresence>
            {paymentMethod === 'c2c_transfer' &&
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden">
              
                <div className="a-card space-y-4">
                  {/* Transfer info */}
                  <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--a-peach-1)' }}>
                    <h4 className="font-bold text-sm" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{tr("cakeorderform_kocurme_melumatlari_1800d6", "💳 Köçürmə məlumatları")}</h4>
                    {c2cConfig.card_number &&
                  <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--a-accent-ink)', opacity: 0.7 }}>{tr("cakeorderform_kart_nomresi_3a8392", "Kart nömrəsi:")}</span>
                        <span className="font-mono font-bold text-sm" style={{ color: 'var(--a-accent-ink)' }}>{c2cConfig.card_number}</span>
                      </div>
                  }
                    {c2cConfig.card_holder &&
                  <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--a-accent-ink)', opacity: 0.7 }}>{tr("untranslated_kart_sahibi_lpyfn9", "Kart sahibi:")}</span>
                        <span className="font-bold text-sm" style={{ color: 'var(--a-accent-ink)' }}>{c2cConfig.card_holder}</span>
                      </div>
                  }
                    {c2cConfig.bank_name &&
                  <div className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: 'var(--a-accent-ink)', opacity: 0.7 }}>{tr("untranslated_bank_cclvmv", "Bank:")}</span>
                        <span className="text-sm" style={{ color: 'var(--a-accent-ink)' }}>{c2cConfig.bank_name}</span>
                      </div>
                  }
                    <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid rgba(138, 69, 20, 0.15)' }}>
                      <span className="text-xs" style={{ color: 'var(--a-accent-ink)', opacity: 0.7 }}>{tr("cakeorderform_mebleg_f038e4", "Məbləğ:")}</span>
                      <span className="a-heading" style={{ fontSize: 16, color: 'var(--a-accent-ink)' }}>{totalPrice.toFixed(2)} ₼</span>
                    </div>
                    {c2cConfig.instructions &&
                  <p className="text-[10px] mt-1" style={{ margin: '4px 0 0', color: 'var(--a-accent-ink)', opacity: 0.7 }}>ℹ️ {c2cConfig.instructions}</p>
                  }
                  </div>

                  {/* Upload proof */}
                  <div>
                    {fieldLabel(tr("cakeorderform_kocurme_tesdiqi_yukleyin_3bd84d", "Köçürmə təsdiqi yükləyin *"))}
                    <p className="text-[10px] mb-2" style={{ margin: '2px 0 8px', color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_kocurmenin_screenshotunu_ve_ya_pdf_ini_y_ff7238", "Köçürmənin screenshotunu və ya PDF-ini yükləyin")}</p>
                    
                    {proofUrl ?
                  <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--a-green-1)' }}>
                        <FileText className="w-5 h-5" style={{ color: 'var(--a-green-ink)' }} />
                        <span className="text-sm flex-1 truncate" style={{ color: 'var(--a-green-ink)' }}>{proofFileName}</span>
                        <button
                      onClick={() => {setProofUrl(null);setProofFileName(null);}}
                      className="p-1 rounded-full"
                      style={{ background: 'var(--a-chip-overlay)', border: 'none', cursor: 'pointer' }}>
                          <X className="w-4 h-4" style={{ color: 'var(--a-green-ink)' }} />
                        </button>
                      </div> :

                  <label
                    className="flex flex-col items-center justify-center w-full h-28 rounded-2xl cursor-pointer transition"
                    style={{ border: '2px dashed var(--a-line-strong)', background: 'var(--a-surface-soft)' }}>
                        <input type="file" accept="image/*,.pdf" onChange={handleProofUpload} className="hidden" />
                        {uploadingProof ?
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--a-peach-2)' }} /> :

                    <>
                            <Upload className="w-6 h-6 mb-1" style={{ color: 'var(--a-ink-soft)' }} />
                            <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_sekil_ve_ya_pdf_b7f3aa", "Şəkil və ya PDF")}</span>
                          </>
                    }
                      </label>
                  }
                  </div>
                </div>
              </motion.div>
            }
          </AnimatePresence>

          {/* Total & Submit */}
          <div className="a-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakeorderform_cemi_fbbec6", "Cəmi:")}</span>
              <span className="a-heading" style={{ fontSize: 20, color: 'var(--a-accent-ink)' }}>{totalPrice.toFixed(2)}₼</span>
            </div>
            <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 52, fontSize: 14, opacity: submitting ? 0.6 : 1 }}
              onClick={handleSubmit}
              disabled={submitting}>
              {submitting ?
              <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid var(--a-accent-ink)', borderTopColor: 'transparent' }} /> :

              <>
                  {paymentMethod === 'card_simulated' ? <CreditCard size={18} strokeWidth={2.2} /> :
                paymentMethod === 'c2c_transfer' ? <ArrowLeftRight size={18} strokeWidth={2.2} /> :
                <Send size={18} strokeWidth={2.2} />}
                  {paymentMethod === 'card_simulated' ? tr("cake_pay_and_order", "Ödə və sifariş ver") :
                paymentMethod === 'c2c_transfer' ? tr("cake_confirm_order", "Sifarişi təsdiqlə") :
                tr("cake_send_order", "Sifariş göndər")} — {totalPrice.toFixed(2)}₼
                </>
              }
            </button>
          </div>
        </div>
      </div>
    </div>);

};

export default CakeOrderForm;
