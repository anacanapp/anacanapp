import { motion } from 'framer-motion';
import { Droplets, Plus } from 'lucide-react';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';
import { appLanguageLocale } from '@/lib/app-languages';
import { waterTarget } from '@/lib/water-target';

interface WaterWidgetProps {
  /** 'anacan' renders the redesigned (anacan-demo) progress-ring card */
  variant?: 'default' | 'anacan';
}

export default function WaterWidget({ variant = 'default' }: WaterWidgetProps) {
  const { todayLog, updateWaterIntake } = useDailyLogs();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  
  const waterGlasses = todayLog?.water_intake || 0;
  const target = waterTarget(lifeStage);
  
  const percentage = Math.min((waterGlasses / target) * 100, 100);

  if (variant === 'anacan') {
    return (
      <div className="a-card a-fade-in">
        <div className="a-card-head">
          <h3 className="a-card-title a-heading">{tr("common_su_water", "Su")}</h3>
          <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>
            {waterGlasses}/{target} {tr('waterwidget_glass_unit', 'stəkan')}
          </span>
        </div>
        <div className="a-ring-hero">
          <div className="a-ring a-water-ring" style={{ '--pct': percentage } as React.CSSProperties}>
            <div className="a-ring-inner">
              <b data-water-percentage><bdi>{new Intl.NumberFormat(appLanguageLocale(language), { style: 'percent', maximumFractionDigits: 0 }).format(percentage / 100)}</bdi></b>
              <span>{tr('mommy_daily_goal', 'günlük hədəf')}</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="a-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Droplets size={14} style={{ color: 'var(--a-blue-2)' }} />
              {waterGlasses} / {target} {tr('waterwidget_glass_unit', 'stəkan')}
            </p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', marginTop: 4 }}>
              {tr('waterwidget_hint', 'Ana üçün su balansı süd istehsalına dəstəkdir')}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                updateWaterIntake(1);
              }}
              className="a-btn-soft"
              style={{ marginTop: 10 }}
            >
              <Plus size={14} strokeWidth={2.5} />
              {tr('waterwidget_add_glass', '1 stəkan əlavə et')}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--a-blue-1)] border border-[color:var(--a-line)] rounded-xl p-3 text-[color:var(--a-blue-ink)] shadow-sm relative overflow-hidden h-full flex flex-col justify-between min-h-[80px]">
      <div className="absolute -top-3 -end-3 p-2 opacity-5">
        <Droplets className="w-16 h-16 text-[color:var(--a-blue-ink)]" />
      </div>
      
      <div className="relative z-10 flex justify-between items-center mb-1">
        <div>
          <h3 className="font-medium text-xs mb-0.5 flex items-center gap-1 opacity-80 text-[color:var(--a-blue-ink)]">
            <Droplets className="w-3 h-3" />
            {tr("common_su_water", "Su")}
          </h3>
          <div className="text-xl font-black leading-none flex items-baseline gap-1 text-[color:var(--a-blue-ink)]">
            {waterGlasses} <span className="text-[10px] font-medium opacity-50">/ {target}</span>
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            updateWaterIntake(1);
          }}
          className="w-7 h-7 bg-[color:var(--a-blue-1)] hover:bg-[color:var(--a-blue-1)] text-[color:var(--a-blue-ink)] rounded-full flex items-center justify-center transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>
      
      <div className="relative z-10 mt-auto pt-2">
        <div className="bg-[color:var(--a-blue-1)] h-1.5 rounded-full overflow-hidden w-full">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="bg-[color:var(--a-blue-2)] h-full rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
