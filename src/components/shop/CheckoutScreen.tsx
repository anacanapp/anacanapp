import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, User, CreditCard, Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/useOrders';
import { useCouponValidator } from '@/hooks/useCoupons';
import CouponInput from './CouponInput';
import { toast } from '@/hooks/use-toast';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

interface CheckoutScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  initialCouponCode?: string;
  initialDiscount?: number;
}

const inputStyle: React.CSSProperties = { background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--a-ink)' };

const CheckoutScreen = ({ onBack, onSuccess, initialCouponCode, initialDiscount }: CheckoutScreenProps) => {
  const isRtl = useIsRtl();
  const { items, totalPrice, createOrder } = useCart();
  const { couponCode, setCouponCode, appliedCoupon, validating, validateCoupon, removeCoupon, recordUsage } = useCouponValidator('shop');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: tr("checkoutscreen_baki_998629", "Bak\u0131"),
    notes: ''
  });

  // Use either the coupon applied here or carried over from cart
  const discountAmount = appliedCoupon?.discountAmount ?? initialDiscount ?? 0;
  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address) {
      toast({ title: tr("checkoutscreen_xeta_3cdbb6", 'Xəta'), description: tr("checkoutscreen_zehmet_olmasa_butun_melumatlari_doldurun_9a9a4a", 'Zəhmət olmasa bütün məlumatları doldurun'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const shippingAddress = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        city: formData.city
      };

      const order = await createOrder(shippingAddress, formData.notes);
      if (order) {
        // Record coupon usage
        if (appliedCoupon) {
          await recordUsage(order.id);
        }
        onSuccess();
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({ title: tr("checkoutscreen_xeta_3cdbb6", 'Xəta'), description: tr("checkoutscreen_sifaris_yaradilmadi_025f3b", 'Sifariş yaradılmadı'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: rtlX(20, isRtl) }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
      className="a-scope min-h-screen"
      style={{ background: 'var(--a-bg)' }}>

      <div className="sticky top-0 z-10 px-4 py-2.5"
      style={{ background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{tr("checkoutscreen_sifarisi_tamamla_a8b546", "Sifarişi Tamamla")}</h1>
        </div>
      </div>



      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-32 max-w-md mx-auto">
        <div className="a-card space-y-3">
          <h2 className="flex items-center gap-2" style={sectionTitleStyle}>
            <User size={15} style={{ color: 'var(--a-accent-ink)' }} />
            {tr("checkoutscreen_elaqe_melumatlari_8a7aae", "\u018Flaq\u0259 M\u0259lumatlar\u0131")}
          </h2>
          <Input placeholder={tr("checkout_full_name", 'Ad Soyad')} value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl" style={inputStyle} />
          <Input placeholder={tr("checkout_phone_placeholder", 'Telefon (+994 XX XXX XX XX)')} value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} className="h-11 rounded-xl" style={inputStyle} />
        </div>

        <div className="a-card space-y-3">
          <h2 className="flex items-center gap-2" style={sectionTitleStyle}>
            <MapPin size={15} style={{ color: 'var(--a-accent-ink)' }} />
            {tr("checkoutscreen_catdirilma_unvani_10ea11", "\xC7atd\u0131r\u0131lma \xDCnvan\u0131")}
          </h2>
          <Input placeholder={tr("checkoutscreen_seher_5f373c", "Şəhər")} value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} className="h-11 rounded-xl" style={inputStyle} />
          <Textarea placeholder={tr("checkoutscreen_unvan_kuce_bina_menzil_ad3ef6", "Ünvan (küçə, bina, mənzil)")} value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} rows={2} className="rounded-xl" style={inputStyle} />
        </div>

        <div className="a-card space-y-3">
          <h2 className="flex items-center gap-2" style={sectionTitleStyle}>
            <Truck size={15} style={{ color: 'var(--a-accent-ink)' }} />
            {tr("checkoutscreen_elave_qeydler_49e1f1", "Əlavə Qeydlər")}
          </h2>
          <Textarea placeholder={tr("checkoutscreen_kuryere_mesaj_isteye_bagli_56df8d", "Kuryerə mesaj (istəyə bağlı)")} value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} rows={2} className="rounded-xl" style={inputStyle} />
        </div>

        {/* Coupon */}
        <div className="a-card space-y-2">
          <h2 className="flex items-center gap-2" style={sectionTitleStyle}>
            {tr("checkout_coupon_code_label", 'Kupon Kodu')}
          </h2>
          <CouponInput
            couponCode={couponCode}
            onCodeChange={setCouponCode}
            onApply={() => validateCoupon(couponCode, totalPrice)}
            onRemove={removeCoupon}
            appliedCoupon={appliedCoupon}
            validating={validating} />

        </div>

        {/* Order Summary */}
        <div className="a-card space-y-2">
          <h2 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("checkoutscreen_sifaris_xulasesi_14a242", "Sifariş Xülasəsi")}</h2>
          {items.map((item) =>
          <div key={item.id} className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--a-ink-soft)' }}>{item.product?.name} x{item.quantity}</span>
              <span style={{ color: 'var(--a-ink)', fontWeight: 600 }}>{((item.product?.price || 0) * item.quantity).toFixed(2)} ₼</span>
            </div>
          )}
          {discountAmount > 0 &&
          <div className="flex justify-between" style={{ fontSize: 13, color: 'var(--a-green-ink)', fontWeight: 600 }}>
              <span>{tr("untranslated_kupon_endirimi_itwejz", "Kupon endirimi")}</span>
              <span>-{discountAmount.toFixed(2)} ₼</span>
            </div>
          }
          <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--a-line)', fontWeight: 800 }}>
            <span style={{ color: 'var(--a-ink)' }}>{tr("checkoutscreen_cemi_fbbec6", "Cəmi:")}</span>
            <span style={{ color: 'var(--a-accent-ink)' }}>{finalPrice.toFixed(2)} ₼</span>
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ background: 'var(--a-green-1)', borderRadius: 16, padding: 13 }}>
          <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: 'var(--a-chip-overlay)' }}>
            <CreditCard size={19} style={{ color: 'var(--a-green-ink)' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-green-ink)' }}>{tr("checkoutscreen_qapida_odenis_312926", "Qapıda Ödəniş")}</p>
            <p style={{ fontSize: 11.5, color: 'var(--a-green-ink)' }}>{tr("checkoutscreen_nagd_ve_ya_kartla_c4ddd7", "Nağd və ya kartla")}</p>
          </div>
        </div>
      </form>

      <div className="fixed bottom-0 start-0 end-0 p-4 safe-bottom"
      style={{ background: 'var(--a-nav-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--a-line)' }}>
        <Button onClick={handleSubmit} disabled={loading}
        className="w-full h-12 text-base font-bold rounded-full text-white border-0 max-w-md mx-auto flex hover:opacity-95"
        style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
          {loading ?
          <><Loader2 className="w-5 h-5 me-2 animate-spin" />{tr("checkoutscreen_gozleyin_9c465b", "Gözləyin...")}</> :

          `${tr("checkout_place_order", "Sifariş Ver")} - ${finalPrice.toFixed(2)} ₼`
          }
        </Button>
      </div>
    </motion.div>);

};

export default CheckoutScreen;
