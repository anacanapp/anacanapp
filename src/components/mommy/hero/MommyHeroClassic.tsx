import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';

export interface MommyHeroProps {
  babyData: {
    name: string;
    ageInMonths: number;
    ageInDays: number;
  };
  exactMonths: number;
  remainingDays: number;
  babyIllustration: string;
}

/**
 * MommyHeroClassic — redesigned to match the Pregnancy Hero layout.
 * Same structural pattern: gradient card → centered image → main text → badge chips → progress bar.
 */
const MommyHeroClassic = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  // Mommy stage colors — Orange to Yellow gradient for visual continuity
  const colors = {
    bg: 'from-primary/20 via-primary/5 to-amber-100/60 dark:from-primary/20 dark:via-primary/10 dark:to-amber-900/20',
    border: 'border-primary/20 dark:border-primary/30',
    accent: 'bg-primary/10 dark:bg-primary/20',
    text: 'text-primary',
    badge: 'bg-primary/10 text-primary',
    progress: 'bg-primary'
  };

  const totalFirstYearDays = 365;
  const progressPercent = Math.min(babyData.ageInDays / totalFirstYearDays * 100, 100);


  return (
    <motion.div
      className={`relative overflow-hidden bg-gradient-to-br ${colors.bg} rounded-2xl p-4 shadow-card ${colors.border}`}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}>
      
      {/* Background blur orbs — same style as pregnancy hero */}
      <div className="absolute -top-12 -end-12 w-36 h-36 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute bottom-0 start-0 w-24 h-24 rounded-full bg-amber-200/40 blur-xl opacity-60" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Baby Image — centered with subtle float, matching pregnancy fetus image style */}
        <motion.div
          className="w-[178px] h-[178px] mb-3 relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: [0, -4, 0]
          }}
          transition={{
            scale: { delay: 0.2, type: 'spring' },
            opacity: { delay: 0.2 },
            y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          }}>
          
          <img
            src={babyIllustration}
            alt={tr("mommyheroclassic_alt_age", "{name} — {months} aylıq").replace("{name}", babyData.name).replace("{months}", String(babyData.ageInMonths))}
            className="w-full h-full object-contain drop-shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }} />
          
        </motion.div>

        {/* Main Text — baby name + day info */}
        <div className="text-center">
          <p className="text-lg font-bold text-foreground mb-1">
            {babyData.name} • {babyData.ageInDays}{tr("mommyheroclassic_gun_d96b5d", ". gün")}
          </p>

          {/* Badge chips — same style as pregnancy badges */}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {exactMonths > 0 &&
            <span className={`text-xs font-semibold ${colors.badge} px-2 py-0.5 rounded-full`}>
                {exactMonths} {exactMonths > 1 ? tr("time_months", "ay") : tr("time_month", "ay")}
              </span>
            }
            {remainingDays > 0 &&
            <span className={`text-xs font-semibold ${colors.badge} px-2 py-0.5 rounded-full`}>
                {remainingDays} {remainingDays > 1 ? tr("time_days", "gün") : tr("time_day", "gün")}
              </span>
            }
            <span className={`text-xs font-semibold ${colors.badge} px-2 py-0.5 rounded-full`}>
              {babyData.ageInDays} {babyData.ageInDays > 1 ? tr("time_days", "gün") : tr("time_day", "gün")}
            </span>
          </div>
        </div>

        {/* Progress Bar — progress through first year, matching pregnancy style */}
        <div className="w-full mt-3 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{tr("dashboard_dogus_6b7bfd", "Doğuş")}</span>
            <span className={`${colors.text} font-semibold`}>{Math.round(progressPercent)}%</span>
            <span>{tr("dashboard_1_yas_a1b2c3", "1 yaş")}</span>
          </div>
          <div className={`h-2 ${colors.accent} rounded-full overflow-hidden`}>
            <motion.div
              className={`h-full ${colors.progress} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, delay: 0.3 }} />
            
          </div>
        </div>
      </div>
    </motion.div>);

};

export default MommyHeroClassic;