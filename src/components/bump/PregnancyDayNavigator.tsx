import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Crown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumModal from '@/components/PremiumModal';
import { tr } from "@/lib/tr";

interface PregnancyDayNavigatorProps {
  currentActualDay: number; // The real/current pregnancy day
  selectedDay: number;
  onDayChange: (day: number) => void;
  isPremium: boolean;
  maxDays?: number;
}

const PregnancyDayNavigator = ({
  currentActualDay,
  selectedDay,
  onDayChange,
  isPremium,
  maxDays = 280
}: PregnancyDayNavigatorProps) => {
  const FREE_RANGE = 3; // Free users can go ±3 days
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Calculate navigation limits
  const getNavigationLimits = useCallback(() => {
    if (isPremium) {
      return { min: 1, max: maxDays };
    }
    return {
      min: Math.max(1, currentActualDay - FREE_RANGE),
      max: Math.min(maxDays, currentActualDay + FREE_RANGE)
    };
  }, [isPremium, currentActualDay, maxDays]);

  const limits = getNavigationLimits();

  const canGoBack = selectedDay > limits.min;
  const canGoForward = selectedDay < limits.max;
  const isViewingCurrentDay = selectedDay === currentActualDay;

  const goBack = () => {
    if (canGoBack) {
      onDayChange(selectedDay - 1);
    } else if (!isPremium && selectedDay > 1) {
      // Pulsuz limitə çatıb — paywall aç (əvvəllər ölü nöqtə idi)
      setShowPremiumModal(true);
    }
  };

  const goForward = () => {
    if (canGoForward) {
      onDayChange(selectedDay + 1);
    } else if (!isPremium && selectedDay < maxDays) {
      setShowPremiumModal(true);
    }
  };

  const resetToCurrentDay = () => {
    onDayChange(currentActualDay);
  };

  // Determine offset from current day for display
  const dayOffset = selectedDay - currentActualDay;
  const getOffsetLabel = () => {
    if (dayOffset === 0) return tr("pregnancydaynavigator_bu_gun_786fd4", "Bu g\xFCn");
    if (dayOffset > 0) return `+${dayOffset} ${tr("common_gun", "gün")}`;
    return `${dayOffset} ${tr("common_gun", "gün")}`;
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Back button */}
      <motion.button
        onClick={goBack}
        disabled={!canGoBack && (isPremium || selectedDay <= 1)}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all border",
          canGoBack ?
          "bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 active:scale-95" :
          "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed"
        )}
        whileTap={canGoBack ? { scale: 0.9 } : {}}>
        
        <ChevronLeft className="rtl:rotate-180 w-5 h-5" />
      </motion.button>

      {/* Current day indicator */}
      <div className="flex flex-col items-center min-w-[80px]">
        <AnimatePresence mode="wait">
          <motion.span
            key={selectedDay}
            initial={{ y: dayOffset > 0 ? 10 : -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: dayOffset > 0 ? -10 : 10, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "text-sm font-bold px-3 py-1 rounded-full",
              isViewingCurrentDay ?
              "bg-primary/20 text-primary" :
              "bg-primary text-primary-foreground"
            )}>
            
            {getOffsetLabel()}
          </motion.span>
        </AnimatePresence>
        
        {/* Premium indicator for limit reached */}
        {!isPremium && (selectedDay === limits.min || selectedDay === limits.max) && !isViewingCurrentDay &&
        <motion.button
          onClick={() => setShowPremiumModal(true)}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 mt-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          
            <Crown className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-primary font-medium">{tr("pregnancydaynavigator_premium_ile_daha_cox_2aae14", "Premium ilə daha çox")}</span>
          </motion.button>
        }
      </div>

      {/* Forward button */}
      <motion.button
        onClick={goForward}
        disabled={!canGoForward && (isPremium || selectedDay >= maxDays)}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all border",
          canGoForward ?
          "bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 active:scale-95" :
          "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed"
        )}
        whileTap={canGoForward ? { scale: 0.9 } : {}}>
        
        <ChevronRight className="rtl:rotate-180 w-5 h-5" />
      </motion.button>

      {/* Reset button - only show when not viewing current day */}
      <AnimatePresence>
        {!isViewingCurrentDay &&
        <motion.button
          onClick={resetToCurrentDay}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 flex items-center justify-center ms-1"
          whileTap={{ scale: 0.9 }}
          title={tr("pregnancydaynavigator_bu_gune_qayit_9c007f", "Bu günə qayıt")}>
          
            <RotateCcw className="w-4 h-4" />
          </motion.button>
        }
      </AnimatePresence>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="pregnancy_days" />
    </div>);

};

export default PregnancyDayNavigator;