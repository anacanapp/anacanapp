import { useState } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  applicable_to: string[];
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
}

export interface AppliedCoupon {
  coupon: Coupon;
  discountAmount: number;
}

export const useCouponValidator = (orderType: string = 'shop') => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [validating, setValidating] = useState(false);

  const validateCoupon = async (code: string, orderTotal: number): Promise<AppliedCoupon | null> => {
    if (!user || !code.trim()) return null;
    setValidating(true);

    try {
      const { data, error } = await supabase
        .from('coupons' as any)
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({ title: tr("usecoupons_kupon_tapilmadi_e41e4e", "Kupon tapılmadı"), description: tr("usecoupons_bu_kupon_kodu_movcud_deyil_6b3eb9", "Bu kupon kodu mövcud deyil"), variant: 'destructive' });
        return null;
      }

      const coupon = data as unknown as Coupon;

      // Check applicable_to
      if (!coupon.applicable_to.includes(orderType)) {
        toast({ title: tr("usecoupons_kupon_kecersizdir_42186d", "Kupon keçərsizdir"), description: tr("usecoupons_bu_kupon_bu_nov_sifaris_ucun_kecerli_dey_17536c", "Bu kupon bu növ sifariş üçün keçərli deyil"), variant: 'destructive' });
        return null;
      }

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast({ title: tr("usecoupons_kupon_muddeti_bitib_242f3f", "Kupon müddəti bitib"), variant: 'destructive' });
        return null;
      }

      // Check start date
      if (new Date(coupon.starts_at) > new Date()) {
        toast({ title: tr("usecoupons_kupon_hele_aktiv_deyil_1247d5", "Kupon hələ aktiv deyil"), variant: 'destructive' });
        return null;
      }

      // Check max uses
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        toast({ title: 'Kupon limiti dolub', variant: 'destructive' });
        return null;
      }

      // Check min order amount
      if (coupon.min_order_amount && orderTotal < coupon.min_order_amount) {
        toast({ title: tr("usecoupons_minimum_mebleg_435135", "Minimum məbləğ"), description: tr("usecoupons_min_order_desc", "Bu kupon minimum {amount}₼ sifariş üçün keçərlidir").replace("{amount}", String(coupon.min_order_amount)), variant: 'destructive' });
        return null;
      }

      // Check if user already used this coupon
      const { data: usage } = await supabase
        .from('coupon_usage' as any)
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', user.id);

      if (usage && (usage as any[]).length > 0) {
        toast({ title: tr("usecoupons_artiq_istifade_edilib_709c3e", "Artıq istifadə edilib"), description: tr("usecoupons_bu_kuponu_artiq_istifade_etmisiniz_a8e01e", "Bu kuponu artıq istifadə etmisiniz"), variant: 'destructive' });
        return null;
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = (orderTotal * coupon.discount_value) / 100;
      } else {
        discountAmount = Math.min(coupon.discount_value, orderTotal);
      }

      discountAmount = Math.round(discountAmount * 100) / 100;

      const applied: AppliedCoupon = { coupon, discountAmount };
      setAppliedCoupon(applied);
      toast({ title: tr("usecoupons_kupon_tetbiq_edildi_e2143c", "Kupon tətbiq edildi! ✅"), description: tr("usecoupons_discount_desc", "{amount}₼ endirim").replace("{amount}", discountAmount.toFixed(2)) });
      return applied;
    } catch (err) {
      toast({ title: tr("usecoupons_xeta_3cdbb6", "Xəta"), description: tr("usecoupons_kupon_yoxlanarken_xeta_bas_verdi_9f76a4", "Kupon yoxlanarkən xəta baş verdi"), variant: 'destructive' });
      return null;
    } finally {
      setValidating(false);
    }
  };

  const recordUsage = async (orderId?: string) => {
    if (!user || !appliedCoupon) return;
    try {
      await supabase.from('coupon_usage' as any).insert({
        coupon_id: appliedCoupon.coupon.id,
        user_id: user.id,
        order_type: orderType,
        order_id: orderId || null,
        discount_amount: appliedCoupon.discountAmount,
      });
      // used_count artırılması admin-only RLS-ə görə birbaşa `.update()` ilə
      // mümkün deyil (adi istifadəçi sıfır sətir dəyişdirirdi, max_uses limiti
      // heç vaxt tətbiq olunmurdu — bax Duzelis42.sql). Server-side atomic
      // RPC (row lock + limit yoxlaması daxil) istifadə olunur.
      const { error: rpcError } = await supabase.rpc('increment_coupon_usage' as any, {
        p_coupon_id: appliedCoupon.coupon.id,
      });
      if (rpcError) console.error('Error incrementing coupon usage:', rpcError);
    } catch (err) {
      console.error('Error recording coupon usage:', err);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  return {
    couponCode,
    setCouponCode,
    appliedCoupon,
    validating,
    validateCoupon,
    recordUsage,
    removeCoupon,
  };
};
