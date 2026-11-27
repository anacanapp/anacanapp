import { tr } from "@/lib/tr";
import { motion, useReducedMotion } from 'framer-motion';
import { isLowEndDevice } from '@/lib/device-tier';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * MESH GRADIENT — Apple-style animated mesh background, photo orb floating
 * on top, big number hero. Bold, modern, very "Vision Pro / Health app".
 */
const MommyHeroMesh = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  // Sonsuz blur animasiyaları zəif cihazlarda GPU/main thread-i yükləyir — statik variant
  const still = useReducedMotion() || isLowEndDevice();
  const primary = exactMonths > 0 ? exactMonths : babyData.ageInDays;
  const primaryUnit = exactMonths > 0 ? (exactMonths > 1 ? tr("time_months", "ay").toUpperCase() : tr("time_month", "ay").toUpperCase()) : tr("mommyheromesh_gun_b74b92", "GÜN");

  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] min-h-[260px]"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}>
      
      {/* Mesh gradient base */}
      <div className="absolute inset-0 bg-[hsl(15,30%,12%)]" />
      <motion.div
        className="absolute -top-20 -start-16 w-80 h-80 rounded-full bg-[hsl(15,90%,55%)] blur-3xl opacity-70"
        animate={still ? undefined : { x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
      
      <motion.div
        className="absolute top-10 -end-20 w-72 h-72 rounded-full bg-[hsl(340,90%,60%)] blur-3xl opacity-60"
        animate={still ? undefined : { x: [0, -25, 0], y: [0, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
      
      <motion.div
        className="absolute -bottom-16 start-1/3 w-72 h-72 rounded-full bg-[hsl(45,95%,60%)] blur-3xl opacity-55"
        animate={still ? undefined : { x: [0, 20, 0], y: [0, -10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
      
      {/* Grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
        }} />
      

      <div className="relative z-10 p-5 flex items-center gap-5 min-h-[260px]">
        {/* Floating glass orb with photo */}
        <motion.div
          className="relative shrink-0"
          animate={still ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          
          <div className="absolute -inset-3 rounded-full bg-white/20 blur-2xl" />
          <div className="relative w-36 h-36 rounded-full overflow-hidden bg-white/15 backdrop-blur-2xl border border-white/30 shadow-[inset_0_2px_20px_rgba(255,255,255,0.3),0_20px_40px_-10px_rgba(0,0,0,0.4)] flex items-center justify-center">
            <img
              src={babyIllustration}
              alt={babyData.name}
              className="w-full h-full object-contain p-1.5 drop-shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }} />
            
          </div>
        </motion.div>

        {/* Right typographic block */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/60">
            Mommy
          </p>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight mt-1 truncate">
            {babyData.name}
          </h2>

          <div className="mt-3 flex items-baseline gap-1.5">
            <span
              className="text-[64px] font-black leading-none tabular-nums"
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, hsl(45,90%,75%) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
              
              {primary}
            </span>
            <span className="text-xs font-black tracking-[0.2em] text-white/70">
              {primaryUnit}
            </span>
          </div>
          {exactMonths > 0 && remainingDays > 0 &&
          <p className="text-[11px] text-white/50 font-medium mt-1">
              + {remainingDays} {remainingDays > 1 ? tr("time_days", "gün") : tr("time_day", "gün")}
            </p>
          }
        </div>
      </div>
    </motion.div>);

};

export default MommyHeroMesh;