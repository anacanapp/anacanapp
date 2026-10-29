import { tr } from "@/lib/tr";
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * STORYBOOK variant — soft pastel paper-card with hand-drawn feeling,
 * baby illustration on the right, age & name typeset like a children's book.
 */
const MommyHeroStorybook = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[hsl(35,100%,96%)] via-[hsl(15,100%,95%)] to-[hsl(340,90%,95%)]"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}>
      
      {/* Paper texture dots */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
          'radial-gradient(circle at 1px 1px, hsl(15,40%,30%) 1px, transparent 0)',
          backgroundSize: '14px 14px'
        }} />
      

      {/* Cloud blobs */}
      <motion.div
        className="absolute -top-8 -end-8 w-40 h-40 rounded-full bg-white/70 blur-2xl"
        animate={{ x: [0, 8, 0], y: [0, 4, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      
      <motion.div
        className="absolute -bottom-10 -start-10 w-44 h-44 rounded-full bg-[hsl(340,90%,90%)]/70 blur-2xl"
        animate={{ x: [0, -6, 0], y: [0, -4, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
      

      {/* Decorative emojis */}
      <span className="absolute top-3 start-4 text-xl opacity-60">🌷</span>
      <span className="absolute top-6 end-6 text-lg opacity-50">☁️</span>
      <span className="absolute bottom-4 end-4 text-xl opacity-60">🌙</span>

      <div className="relative z-10 p-5 flex items-center gap-3">
        {/* Left: text */}
        <div className="flex-1 min-w-0">
          <motion.p
            className="text-[10px] font-bold tracking-[0.25em] uppercase text-[hsl(15,70%,45%)]/70 mb-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}>
            {tr("mommyherostorybook_bir_gun_bir_hekaye_9efe41", "Bir g\xFCn, bir hekay\u0259\u2026")}
          
          </motion.p>
          <motion.h2
            className="text-3xl font-black leading-[1.05] tracking-tight text-[hsl(15,60%,25%)] [font-family:'Instrument_Serif',Georgia,serif] italic"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}>
            
            {babyData.name}
          </motion.h2>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-[hsl(15,60%,80%)] shadow-sm">
            <Heart className="w-3 h-3 text-[hsl(340,80%,55%)] fill-current" />
            <span className="text-[11px] font-bold text-[hsl(15,60%,30%)]">
              {exactMonths > 0 ?
              `${exactMonths} ${tr('time_month', 'ay')}${remainingDays > 0 ? ` ${remainingDays} ${tr('time_day', 'gün')}` : ''}` :
              `${babyData.ageInDays} ${tr('time_days_old', 'günlük')}`}
            </span>
          </div>

          <motion.div
            className="mt-3 flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}>
            
            {['🌟', '🌈', '🍼', '🧸'].map((e, i) =>
            <motion.span
              key={i}
              className="text-base"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>
              
                {e}
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Right: portrait inside a soft frame */}
        <motion.div
          className="relative shrink-0"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          
          <div className="absolute -inset-2 rounded-[1.6rem] bg-white/80 -rotate-3 shadow-md" />
          <div className="absolute -inset-2 rounded-[1.6rem] bg-[hsl(35,100%,90%)] rotate-3 shadow-sm" />
          <div className="relative w-32 h-32 rounded-[1.4rem] overflow-hidden bg-white shadow-lg border-2 border-white">
            <img
              src={babyIllustration}
              alt={`${babyData.name}`}
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }} />
            
          </div>
          <span className="absolute -bottom-1.5 -end-1.5 text-2xl drop-shadow-sm">💖</span>
        </motion.div>
      </div>
    </motion.div>);

};

export default MommyHeroStorybook;