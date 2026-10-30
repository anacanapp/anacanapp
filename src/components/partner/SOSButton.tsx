import React, { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Phone,
  MapPin,
  X,
  Check,
  Navigation,
  Clock } from
'lucide-react';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { Button } from '@/components/ui/button';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

interface SOSButtonProps {
  variant?: 'full' | 'compact';
}

// Basılı saxlama doldurması — 50ms state tick əvəzinə WAAPI (kompozitor),
// React yenidən render olunmur; MotionConfig reducedMotion-dan da asılı deyil.
const HoldFill: React.FC<{ className: string; from: string; to: string; duration: number; origin?: string }> = ({ className, from, to, duration, origin }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      if (el) el.style.transform = to;
      return;
    }
    const anim = el.animate([{ transform: from }, { transform: to }], { duration, easing: 'linear', fill: 'forwards' });
    return () => anim.cancel();
  }, [from, to, duration]);
  return <div ref={ref} className={className} style={{ transform: from, transformOrigin: origin }} />;
};

const SOSButton: React.FC<SOSButtonProps> = ({ variant = 'full' }) => {
  const { sendSOS, loading, hasPartner } = useSOSAlert();
  const [isHolding, setIsHolding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // one-shot qoruma (bax MotherSOSSheet.tsx eyni nümunə) — setHoldProgress-in
  // state-updater-i içindən handleSOS() çağırılırdı, guard olmadan: newProgress
  // 100-ə çatandan sonra HƏR 50ms tick-də təkrar >=100 şərti doğru qalır və
  // React setIsHolding(false)-u commit edənə qədər (yavaş cihazda bir neçə
  // tick) handleSOS TƏKRAR-TƏKRAR çağırıla bilər — real SOS 2-ci dəfə
  // partnyora göndərilə bilər (təkrar DB sətri + təkrar push).
  const firedRef = useRef(false);

  const HOLD_DURATION = 2000; // 2 seconds to activate

  useEffect(() => {
    if (!isHolding) return;
    firedRef.current = false;
    // Tək taymer: buraxılsa (isHolding=false) cleanup onu ləğv edir
    const timeout = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      handleSOS();
    }, HOLD_DURATION);
    return () => clearTimeout(timeout);
  }, [isHolding]);

  const handleSOS = async () => {
    setIsHolding(false);

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    const result = await sendSOS();
    if (!result.error) {
      setShowConfirmation(true);
      setTimeout(() => setShowConfirmation(false), 3000);
    }
  };

  if (!hasPartner) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onTouchStart={() => setIsHolding(true)}
        onTouchEnd={() => setIsHolding(false)}
        onMouseDown={() => setIsHolding(true)}
        onMouseUp={() => setIsHolding(false)}
        onMouseLeave={() => setIsHolding(false)}
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 flex items-center justify-center overflow-hidden">
        
        <AlertTriangle className="w-6 h-6 text-white" />
        {isHolding &&
        <HoldFill
          className="absolute inset-0 bg-white/30"
          from="scale(0)"
          to="scale(2)"
          duration={HOLD_DURATION} />

        }
      </motion.button>);

  }

  return (
    <>
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
        <motion.button
          whileTap={{ scale: 0.95 }}
          onTouchStart={() => setIsHolding(true)}
          onTouchEnd={() => setIsHolding(false)}
          onMouseDown={() => setIsHolding(true)}
          onMouseUp={() => setIsHolding(false)}
          onMouseLeave={() => setIsHolding(false)}
          disabled={loading}
          className="relative w-full p-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30 overflow-hidden">
          
          <div className="relative z-10 flex items-center justify-center gap-3">
            <AlertTriangle className="w-8 h-8 text-white" />
            <div className="text-start">
              <div className="text-xl font-bold text-white">SOS</div>
              <div className="text-white/80 text-sm">
                {loading ? tr("sosbutton_gonderilir_1d548c", "G\xF6nd\u0259rilir...") : tr("sosbutton_basib_saxla_2_san_27183d", "Bas\u0131b saxla (2 san)")}
              </div>
            </div>
          </div>

          {/* Progress overlay */}
          {isHolding &&
          <HoldFill
            className="absolute inset-0 bg-white/20"
            from="scaleX(0)"
            to="scaleX(1)"
            duration={HOLD_DURATION}
            origin="left" />

          }

          {/* Pulse animation */}
          <motion.div
            className="absolute inset-0 bg-white/10"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: 3
            }} />
          
        </motion.button>

        <p className="text-xs text-muted-foreground text-center mt-2">
          {tr("sosbutton_tecili_veziyyetde_partnyorunuz_902e41", "T\u0259cili v\u0259ziyy\u0259td\u0259 partnyorunuza bildiri\u015F v\u0259 lokasiya g\xF6nd\u0259rilir")}
        </p>
      </motion.div>

      {/* Confirmation overlay */}
      <AnimatePresence>
        {showConfirmation &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-green-500 flex items-center justify-center">
          
            <div className="text-center text-white">
              <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
              
                <Check className="w-10 h-10" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">{tr("sosbutton_sos_gonderildi_fa1202", "SOS Göndərildi!")}</h2>
              <p className="text-white/80">{tr("sosbutton_partnyorunuz_xeberdar_edildi_4497d5", "Partnyorunuz xəbərdar edildi")}</p>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </>);

};

export default SOSButton;