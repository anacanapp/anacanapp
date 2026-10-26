import { tr } from "@/lib/tr";import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, X, Loader2, Check } from 'lucide-react';
import { AppliedCoupon } from '@/hooks/useCoupons';

interface CouponInputProps {
  couponCode: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
  appliedCoupon: AppliedCoupon | null;
  validating: boolean;
  discountAmount?: number;
}

const CouponInput = ({
  couponCode,
  onCodeChange,
  onApply,
  onRemove,
  appliedCoupon,
  validating
}: CouponInputProps) => {
  if (appliedCoupon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        
        <Check className="w-4 h-4 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-green-700 dark:text-green-400">{appliedCoupon.coupon.code}</span>
          <span className="text-[10px] text-green-600 dark:text-green-500 ms-1.5">
            -{appliedCoupon.discountAmount.toFixed(2)}₼
          </span>
        </div>
        <button onClick={onRemove} className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900">
          <X className="w-3.5 h-3.5 text-green-600" />
        </button>
      </motion.div>);

  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={couponCode}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          placeholder={tr("untranslated_kupon_kodu_xiawxh", "Kupon kodu")}
          className="w-full h-9 ps-9 pe-3 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:border-primary/40 transition-colors" />
        
      </div>
      <button
        onClick={onApply}
        disabled={!couponCode.trim() || validating}
        className="px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
        
        {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : tr("couponinput_tetbiq_et_e5077b", "T\u0259tbiq et")}
      </button>
    </div>);

};

export default CouponInput;