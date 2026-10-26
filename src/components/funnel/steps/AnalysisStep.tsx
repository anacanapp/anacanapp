import { useEffect, useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';

interface AnalysisStepProps {
  userName: string;
  contextLine: string; // e.g. "24-cü həftə, 2-ci trimester"
  onComplete: () => void;
}

const STAGES = [
  { pct: 15, label: tr("analysisstep_melumatlar_toplanir_20c57a", "Məlumatlar toplanır...") },
  { pct: 45, label: tr("analysisstep_ferdi_profil_yaradilir_608df0", "Fərdi profil yaradılır...") },
  { pct: 75, label: tr("analysisstep_ai_analiz_aparir_0a8204", "AI analiz aparır...") },
  { pct: 100, label: tr("analysisstep_hazirdir_7750a8", "Hazırdır! ✨") },
];

export default function AnalysisStep({ userName, contextLine, onComplete }: AnalysisStepProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i), i * 900)
    );
    const done = setTimeout(onComplete, STAGES.length * 900 + 600);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [onComplete]);

  const current = STAGES[stage];

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      {/* Spinner */}
      <div className="relative w-28 h-28 mb-8">
        <svg className="w-full h-full animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${current.pct * 2.64} 264`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">{current.pct}%</span>
        </div>
      </div>

      <motion.p
        key={stage}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-base font-medium text-foreground mb-3"
      >
        {current.label}
      </motion.p>

      <div className="mt-4 px-4 py-3 bg-card rounded-2xl border border-border">
        <p className="text-sm text-muted-foreground">{userName}</p>
        <p className="text-xs text-muted-foreground/70">{contextLine}</p>
      </div>
    </div>
  );
}
