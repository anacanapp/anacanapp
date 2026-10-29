import { motion } from 'framer-motion';
import { Droplets, Plus } from 'lucide-react';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';
import { appLanguageLocale } from '@/lib/app-languages';

// Fallback targets for different life stages
const fallbackTargets = {
  bump: { water_glasses: 10 },
  mommy: { water_glasses: 12 },
  flow: { water_glasses: 8 }
};

interface WaterWidgetProps {
  /** 'anacan' renders the compact one-row home tracker */
  variant?: 'default' | 'anacan';
}

export default function WaterWidget({ variant = 'default' }: WaterWidgetProps) {
  const { todayLog, updateWaterIntake } = useDailyLogs();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  
  const waterGlasses = todayLog?.water_intake || 0;
  const stage = lifeStage || 'flow';
  const target = fallbackTargets[stage as keyof typeof fallbackTargets]?.water_glasses || 8;
  
  const percentage = Math.min((waterGlasses / target) * 100, 100);

  if (variant === 'anacan') {
    const percent = new Intl.NumberFormat(appLanguageLocale(language), { style: 'percent', maximumFractionDigits: 0 }).format(percentage / 100);
    // Compact one-row tracker: icon, count + thin progress bar, add button.
    return (
      <div className="a-card a-fade-in a-water-row">
        <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
          <Droplets size={17} strokeWidth={2} />
        </span>
        <div className="a-water-main">
          <p className="a-list-title">
            {tr("common_su_water", "Su")}
            <span className="a-water-count"><bdi>{waterGlasses}/{target}</bdi> {tr('waterwidget_glass_unit', 'stəkan')} · <b data-water-percentage><bdi>{percent}</bdi></b></span>
          </p>
          <div className="a-water-bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(waterGlasses, target)}>
            <span style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            updateWaterIntake(1);
          }}
          className="a-water-add"
          aria-label={tr('waterwidget_add_glass', '1 stəkan əlavə et')}
        >
          <Plus size={16} strokeWidth={2.6} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="bg-cyan-50/80 border border-cyan-100/50 rounded-xl p-3 text-cyan-800 shadow-sm relative overflow-hidden h-full flex flex-col justify-between min-h-[80px]">
      <div className="absolute -top-3 -end-3 p-2 opacity-5">
        <Droplets className="w-16 h-16 text-cyan-600" />
      </div>
      
      <div className="relative z-10 flex justify-between items-center mb-1">
        <div>
          <h3 className="font-medium text-xs mb-0.5 flex items-center gap-1 opacity-80 text-cyan-700">
            <Droplets className="w-3 h-3" />
            {tr("common_su_water", "Su")}
          </h3>
          <div className="text-xl font-black leading-none flex items-baseline gap-1 text-cyan-950">
            {waterGlasses} <span className="text-[10px] font-medium opacity-50">/ {target}</span>
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            updateWaterIntake(1);
          }}
          className="w-7 h-7 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 rounded-full flex items-center justify-center transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>
      
      <div className="relative z-10 mt-auto pt-2">
        <div className="bg-cyan-100 h-1.5 rounded-full overflow-hidden w-full">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="bg-cyan-500 h-full rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
