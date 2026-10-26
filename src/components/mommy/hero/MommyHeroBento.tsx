import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Sparkles, Heart, Star } from 'lucide-react';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * BENTO — Apple-bento style modular grid. Multiple cards composed together:
 * photo block, big age block, small accent tiles. High info density yet airy.
 */
const MommyHeroBento = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  const weeks = Math.floor(babyData.ageInDays / 7);

  return (
    <motion.div
      className="grid grid-cols-5 grid-rows-2 gap-2 h-[260px]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}>
      
      {/* Photo tile - tall */}
      <motion.div
        className="relative col-span-2 row-span-2 rounded-[1.75rem] overflow-hidden bg-gradient-to-br from-[hsl(15,90%,60%)] to-[hsl(340,80%,60%)] shadow-lg"
        whileHover={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 200 }}>
        
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_white/30,_transparent_60%)]" />
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <img
            src={babyIllustration}
            alt={babyData.name}
            className="w-full h-full object-contain drop-shadow-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }} />
          
        </div>
        <div className="absolute bottom-0 start-0 end-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80">{tr("mommyherobento_bu_gun_786fd4", "Bu gün")}</p>
          <h3 className="text-base font-black text-white drop-shadow truncate">{babyData.name}</h3>
        </div>
      </motion.div>

      {/* Big age tile */}
      <motion.div
        className="relative col-span-3 row-span-1 rounded-[1.75rem] bg-foreground text-background p-4 overflow-hidden"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.05 }}>
        
        <div className="absolute -bottom-6 -end-4 w-32 h-32 rounded-full bg-[hsl(15,85%,60%)]/20 blur-2xl" />
        <div className="relative flex items-baseline gap-1.5">
          <span className="text-[56px] font-black leading-none tabular-nums tracking-tighter">
            {exactMonths > 0 ? exactMonths : babyData.ageInDays}
          </span>
          <span className="text-xs font-black tracking-[0.2em] uppercase opacity-70">
            {exactMonths > 0 ? (exactMonths > 1 ? tr("time_months", "ay").toUpperCase() : tr("time_month", "ay").toUpperCase()) : tr("mommyherobento_gun_b74b92", "GÜN")}
          </span>
        </div>
        <p className="text-[11px] font-medium opacity-60 mt-1">
          {exactMonths > 0 && remainingDays > 0 ?
          `+ ${remainingDays} ${remainingDays > 1 ? tr("time_days", "gün") : tr("time_day", "gün")} ${tr("mommyherobento_boyumeye_davam_edir", "böyüməyə davam edir")}` : tr("mommyherobento_yas_95595b", "Yaş")
          }
        </p>
        <div className="absolute top-3 end-3 w-8 h-8 rounded-full bg-[hsl(15,85%,60%)] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </motion.div>

      {/* Small tile 1 - milestone */}
      <motion.div
        className="relative col-span-1 row-span-1 rounded-[1.5rem] bg-[hsl(15,90%,95%)] p-3 flex flex-col justify-between overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        
        <Star className="w-4 h-4 text-[hsl(15,80%,50%)] fill-current" />
        <div>
          <div className="text-xl font-black text-[hsl(15,55%,25%)] tabular-nums leading-none">
            {weeks}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[hsl(15,55%,40%)]/70 mt-0.5">
            {tr("mommyherobento_hefte_3aa886", "Həftə")}
          </div>
        </div>
      </motion.div>

      {/* Small tile 2 - daily affirmation */}
      <motion.div
        className="relative col-span-2 row-span-1 rounded-[1.5rem] bg-gradient-to-br from-[hsl(340,90%,90%)] to-[hsl(15,90%,92%)] p-3 flex items-center justify-between overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>
        
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[hsl(15,55%,30%)]/70">
            {tr("mommyherobento_bu_gun_786fd4", "Bu gün")}
          </div>
          <div className="text-[13px] font-black text-[hsl(15,55%,25%)] leading-tight mt-0.5 truncate">
            {tr("mommyherobento_sevgi_ile_boyuyur_6b7588", "Sevgi ilə böyüyür ✨")}
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center shadow-sm shrink-0 ms-2">
          <Heart className="w-4 h-4 text-[hsl(340,80%,55%)] fill-current" />
        </div>
      </motion.div>
    </motion.div>);

};

export default MommyHeroBento;