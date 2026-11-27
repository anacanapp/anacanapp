import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * STORY — Instagram-story full-bleed. Big background tint, photo center,
 * progress bar on top, name & age overlaid. Very social, very mobile.
 */
const MommyHeroStory = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  const ageLabel =
    exactMonths > 0
      ? `${exactMonths} ${tr('time_month', 'ay')}${remainingDays > 0 ? ` ${remainingDays} ${tr('time_day', 'gün')}` : ''}`
      : `${babyData.ageInDays} ${tr('time_days_old', 'günlük')}`;

  // Story progress: position in current month
  const progress = exactMonths > 0 ? Math.min(100, (remainingDays / 30) * 100) : Math.min(100, (babyData.ageInDays / 30) * 100);

  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] min-h-[300px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Soft pastel gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(15,90%,72%)] via-[hsl(340,80%,75%)] to-[hsl(280,60%,72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_white/30_0%,_transparent_60%)]" />

      {/* Top story progress bars */}
      <div className="absolute top-3 start-4 end-4 z-20 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
            {i === 0 && (
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Top label */}
      <div className="absolute top-7 start-4 end-4 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/30 backdrop-blur-md border border-white/50 flex items-center justify-center">
            <span className="text-xs">👶</span>
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tracking-wide">
            mommy.diary
          </span>
        </div>
        <span className="text-[10px] font-medium text-white/80 drop-shadow">
          indi
        </span>
      </div>

      {/* Centered photo */}
      <div className="relative z-10 flex items-center justify-center h-full pt-20 pb-20">
        <motion.div
          className="relative"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <div className="absolute -inset-4 rounded-full bg-white/20 blur-2xl" />
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.4)] bg-white/20 flex items-center justify-center">
            <img
              src={babyIllustration}
              alt={babyData.name}
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Bottom overlay text */}
      <div className="absolute bottom-0 start-0 end-0 z-10 p-5 pt-16 bg-gradient-to-t from-black/35 via-black/10 to-transparent">
        <motion.h2
          className="text-3xl font-black text-white tracking-tight drop-shadow-lg leading-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {babyData.name}
        </motion.h2>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-md border border-white/40">
            <span className="text-[11px] font-bold text-white drop-shadow">{ageLabel} ✨</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MommyHeroStory;
