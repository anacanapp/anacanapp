import { tr } from "@/lib/tr";
import { motion, useReducedMotion } from 'framer-motion';
import { isLowEndDevice } from '@/lib/device-tier';
import { Sparkles } from 'lucide-react';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * AURORA variant — premium dark glass card with animated aurora gradient,
 * floating glow orbs, and a portrait-style baby image inside a gold ring.
 */
const MommyHeroAurora = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  // Sonsuz blur/ulduz animasiyaları zəif cihazlarda GPU/main thread-i yükləyir — statik variant
  const still = useReducedMotion() || isLowEndDevice();
  const ageLabel =
  exactMonths > 0 ?
  `${exactMonths} ${tr('time_month', 'ay')}${remainingDays > 0 ? ` ${remainingDays} ${tr('time_day', 'gün')}` : ''}` :
  `${babyData.ageInDays} ${tr('time_days_old', 'günlük')}`;

  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] min-h-[280px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}>
      
      {/* Deep aurora background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(260,50%,18%)] via-[hsl(280,55%,22%)] to-[hsl(340,60%,28%)]" />

      {/* Animated aurora ribbons */}
      <motion.div
        className="absolute -top-20 -start-10 w-[140%] h-56 bg-gradient-to-r from-[hsl(180,80%,55%)]/40 via-[hsl(280,90%,65%)]/30 to-[hsl(340,90%,65%)]/40 blur-3xl"
        animate={still ? undefined : { x: [-30, 30, -30], rotate: [0, 8, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
      
      <motion.div
        className="absolute -bottom-24 -end-10 w-[120%] h-56 bg-gradient-to-l from-[hsl(20,90%,60%)]/40 via-[hsl(330,90%,60%)]/30 to-[hsl(260,90%,60%)]/40 blur-3xl"
        animate={still ? undefined : { x: [20, -20, 20], rotate: [0, -6, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
      

      {/* Star particles */}
      <div className="absolute inset-0 opacity-40">
        {[...Array(14)].map((_, i) =>
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{ top: `${i * 37 % 100}%`, insetInlineStart: `${i * 53 % 100}%` }}
          animate={still ? undefined : { opacity: [0.2, 1, 0.2], scale: [0.6, 1.2, 0.6] }}
          transition={{ duration: 2 + i % 3, repeat: Infinity, delay: i * 0.2 }} />

        )}
      </div>

      <div className="relative z-10 p-5 flex flex-col items-center text-center">
        {/* Premium chip */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md mb-3">
          
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="text-[10px] font-bold text-white/90 tracking-widest uppercase">
            {ageLabel}
          </span>
        </motion.div>

        {/* Portrait with golden ring */}
        <motion.div
          className="relative mb-4"
          animate={still ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          
          {/* Outer rotating gold ring */}
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{
              background:
              'conic-gradient(from 0deg, hsl(45,95%,65%), hsl(20,90%,60%), hsl(330,80%,65%), hsl(45,95%,65%))',
              padding: '2px',
              maskImage: 'radial-gradient(circle, transparent 65%, black 66%)',
              WebkitMaskImage: 'radial-gradient(circle, transparent 65%, black 66%)'
            }}
            animate={still ? undefined : { rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} />
          
          {/* Glow */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-amber-300/30 via-pink-400/20 to-transparent blur-2xl" />

          <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-white/20 shadow-[0_20px_60px_-20px_rgba(255,200,100,0.5)] bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md flex items-center justify-center">
            <img
              src={babyIllustration}
              alt={`${babyData.name}`}
              className="w-full h-full object-contain p-2 drop-shadow-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }} />
            
          </div>
        </motion.div>

        {/* Name */}
        <motion.h2
          className="text-3xl font-black text-white tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, hsl(45,95%,80%) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
          
          {babyData.name}
        </motion.h2>
        <p className="text-xs text-white/60 mt-1 font-medium tracking-wider uppercase">
          {tr("mommyheroaurora_ulduz_korpem_ef4a3d", "Ulduz k\xF6rp\u0259m \u2726")}
        </p>
      </div>
    </motion.div>);

};

export default MommyHeroAurora;