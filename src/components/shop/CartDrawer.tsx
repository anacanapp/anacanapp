import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useOrders';
import { useCouponValidator } from '@/hooks/useCoupons';
import { useIsRtl, rtlX } from '@/lib/rtl';
import CouponInput from './CouponInput';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (couponCode?: string, discountAmount?: number) => void;
}

const CartDrawer = ({ isOpen, onClose, onCheckout }: CartDrawerProps) => {
  const isRtl = useIsRtl();
  const { items, loading, updateQuantity, removeFromCart, totalPrice } = useCart();
  const { couponCode, setCouponCode, appliedCoupon, validating, validateCoupon, removeCoupon } = useCouponValidator('shop');

  if (!isOpen) return null;

  const finalPrice = appliedCoupon ? Math.max(0, totalPrice - appliedCoupon.discountAmount) : totalPrice;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose} />
      

      <motion.div
        initial={{ x: rtlX('100%', isRtl) }}
        animate={{ x: 0 }}
        exit={{ x: rtlX('100%', isRtl) }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed end-0 top-0 h-full w-full max-w-md bg-background z-50 shadow-xl flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">{tr("cartdrawer_sebet_9a08cf", "Səbət")}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ?
          <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div> :
          items.length === 0 ?
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-base font-medium">{tr("cartdrawer_sebet_bosdur_ff5b34", "Səbət boşdur")}</p>
              <p className="text-sm">{tr("cartdrawer_mehsullari_sebete_elave_edin_639c4a", "Məhsulları səbətə əlavə edin")}</p>
            </div> :

          items.map((item) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: rtlX(-100, isRtl) }}
            className="flex gap-3 bg-card rounded-xl p-3 border border-border">
            
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0">
                  🛍️
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm line-clamp-2">
                    {item.product?.name || tr("cartdrawer_mehsul_aa9ea7", "M\u0259hsul")}
                  </h3>
                  <p className="text-primary font-bold text-sm mt-0.5">
                    {item.product?.price?.toFixed(2) || '0.00'} ₼
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-medium text-sm w-6 text-center">{item.quantity}</span>
                    <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                  onClick={() => removeFromCart(item.id)}
                  className="ms-auto p-1.5 text-destructive hover:bg-destructive/10 rounded-lg">
                  
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
          )
          }
        </div>

        {items.length > 0 &&
        <div className="border-t border-border p-4 space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {/* Coupon Input */}
            <CouponInput
            couponCode={couponCode}
            onCodeChange={setCouponCode}
            onApply={() => validateCoupon(couponCode, totalPrice)}
            onRemove={removeCoupon}
            appliedCoupon={appliedCoupon}
            validating={validating} />
          

            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tr("cartdrawer_ara_cem_dc0699", "Ara cəm:")}</span>
                <span>{totalPrice.toFixed(2)} ₼</span>
              </div>
              {appliedCoupon &&
            <div className="flex justify-between items-center text-sm text-[color:var(--a-green-ink)]">
                  <span>{tr("untranslated_kupon_endirimi_hqg79o", "Kupon endirimi:")}</span>
                  <span>-{appliedCoupon.discountAmount.toFixed(2)} ₼</span>
                </div>
            }
              <div className="flex justify-between items-center pt-1 border-t border-border">
                <span className="font-semibold">{tr("cartdrawer_cemi_fbbec6", "Cəmi:")}</span>
                <span className="text-xl font-bold text-primary">{finalPrice.toFixed(2)} ₼</span>
              </div>
            </div>
            <Button
            onClick={() => onCheckout(appliedCoupon?.coupon.code, appliedCoupon?.discountAmount)}
            className="w-full h-11 text-sm font-bold">
              {tr("cartdrawer_sifarisi_tamamla_a8b546", "Sifari\u015Fi Tamamla")}
            
          </Button>
          </div>
        }
      </motion.div>
    </>);

};

export default CartDrawer;