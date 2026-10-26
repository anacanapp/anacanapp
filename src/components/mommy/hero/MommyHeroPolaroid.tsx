import { tr } from "@/lib/tr";
import { motion } from 'framer-motion';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * POLAROID — Peanut/Instagram-style. Tilted polaroid photo on warm paper,
 * handwritten-style caption, washi tape accents.
 */
const MommyHeroPolaroid = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  const ageLabel =
  exactMonths > 0 ?
  `${exactMonths} ${tr('time_month', 'ay')}${remainingDays > 0 ? ` ${remainingDays} ${tr('time_day', 'gün')}` : ''}` :
  `${babyData.ageInDays} ${tr('time_days_old', 'günlük')}`;

  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] bg-[hsl(35,40%,94%)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}>
      
      {/* Subtle paper grain */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")"
        }} />
      

      {/* Soft warm vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(15,80%,90%)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(340,60%,92%)_0%,_transparent_60%)]" />

      {/* Date stamp top-left */}
      <div className="absolute top-4 start-5 z-10">
        <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-[hsl(15,40%,40%)]/60">
          Mommy diary
        </p>
        <div className="w-10 h-px bg-[hsl(15,40%,40%)]/30 mt-1" />
      </div>

      <div className="relative z-10 px-5 pt-14 pb-6 flex items-end gap-4">
        {/* Polaroid */}
        <motion.div
          className="relative shrink-0"
          initial={{ rotate: -8, scale: 0.9 }}
          animate={{ rotate: -5, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}>
          
          {/* Washi tape */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-[hsl(45,90%,75%)]/80 rotate-[-4deg] z-20 shadow-sm" />
          <div className="bg-white p-2 pb-8 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)] rounded-[2px]">
            <div className="w-32 h-32 bg-gradient-to-br from-[hsl(15,30%,92%)] to-[hsl(35,40%,90%)] overflow-hidden flex items-center justify-center">
              <img
                src={babyIllustration}
                alt={babyData.name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }} />
              
            </div>
            <p className="absolute bottom-2 start-0 end-0 text-center text-[11px] font-bold text-[hsl(15,50%,30%)] [font-family:'Caveat',cursive] tracking-wide">
              {babyData.name} · {ageLabel}
            </p>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="flex-1 min-w-0 pb-1">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[hsl(15,70%,45%)]/70">
            {tr("mommyheropolaroid_bu_hefte_a5f60b", "Bu h\u0259ft\u0259")}
          </p>
          <h2 className="text-[28px] font-black leading-[0.95] text-[hsl(15,55%,22%)] tracking-tight mt-1">
            {babyData.name}
          </h2>
          <p className="text-[13px] text-[hsl(15,40%,35%)]/80 mt-1.5 leading-snug">
            {tr("mommyheropolaroid_her_gun_boyuyur_her_gun_yeni_x_9bad33", "H\u0259r g\xFCn b\xF6y\xFCy\xFCr, h\u0259r g\xFCn yeni xatir\u0259.")}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <div className="px-2.5 py-1 rounded-full bg-[hsl(15,80%,60%)] text-[10px] font-bold text-white shadow-sm">
              {ageLabel}
            </div>
          </div>
        </div>
      </div>
    </motion.div>);

};

export default MommyHeroPolaroid;