import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Star, LucideIcon } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { trTierName } from './tierLabels';
import { tr } from '@/lib/tr';
import type { ReactNode } from 'react';
import type { GameProgress } from '@/hooks/useLocalGameProgress';

export interface LevelSection {
  label: string;
  levels: number[];
}

interface GameLevelSelectGridProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  sections: LevelSection[];
  progress: GameProgress;
  isLevelUnlocked: (level: number) => boolean;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
  bestScoreLabel: string;
  unlockedLabel: string;
  totalLevels: number;
  accentGradient?: string;
  footer?: ReactNode;
  levelLabel?: (level: number) => string;
  backLabel?: string;
}

const GameLevelSelectGrid = ({
  title,
  subtitle,
  icon: Icon,
  sections,
  progress,
  isLevelUnlocked,
  onSelectLevel,
  onBack,
  bestScoreLabel,
  unlockedLabel,
  totalLevels,
  accentGradient = 'from-primary to-orange-500',
  footer,
  levelLabel,
  backLabel,
}: GameLevelSelectGridProps) => {
  return (
    <div className="a-scope min-h-screen pb-10" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label={backLabel ?? tr('common_back', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              <p className="a-eyebrow">{subtitle}</p>
              <p className="a-wordmark" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
            </div>
          </div>
          <div className="a-topbar-actions">
            <span className="a-icon-btn" style={{ cursor: 'default' }}>
              <Icon size={16} strokeWidth={2} />
            </span>
          </div>
        </header>

        {sections.map((section, sectionIndex) => (
          <div key={section.label} className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className={`px-2.5 py-1 rounded-full bg-gradient-to-r ${accentGradient} text-white text-[11px] font-bold`}
              >
                {trTierName(section.label)}
              </span>
              <div className="h-px flex-1" style={{ background: 'var(--a-line-strong)' }} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {section.levels.map((level, index) => {
                const unlocked = isLevelUnlocked(level);
                const levelProgress = progress.levels[level];
                const stars = levelProgress?.stars || 0;
                const isNext = unlocked && level === progress.unlockedLevel;

                return (
                  <motion.button
                    key={level}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min((sectionIndex * 10 + index) * 0.012, 0.4) }}
                    whileTap={unlocked ? { scale: 0.93 } : undefined}
                    disabled={!unlocked}
                    data-game-level={level}
                    aria-label={levelLabel?.(level)}
                    onClick={() => {
                      if (!unlocked) return;
                      hapticFeedback.light();
                      onSelectLevel(level);
                    }}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                      unlocked && isNext ? `bg-gradient-to-br ${accentGradient} shadow-button` : ''
                    }`}
                    style={
                    unlocked ?
                    isNext ?
                    { border: '1px solid transparent', cursor: 'pointer' } :
                    { background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' } :
                    { background: 'var(--a-surface-soft)', border: '1px solid var(--a-line)', opacity: 0.55 }}
                  >
                    {unlocked ? (
                      <>
                        <span className="text-lg font-extrabold" style={{ color: isNext ? '#fff' : 'var(--a-ink)' }}>
                          {level}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <Star
                              key={i}
                              className={`w-2.5 h-2.5 ${i < stars ? 'fill-current' : ''}`}
                              style={{
                                color: i < stars ?
                                isNext ? '#fff' : 'var(--a-yellow-2)' :
                                isNext ? 'rgba(255,255,255,0.35)' : 'var(--a-line-strong)'
                              }}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--a-ink-faint)' }}>{level}</span>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {footer}

        <div className="mt-2 a-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
          <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)' }}>
            <Star size={17} strokeWidth={2.2} className="fill-current" style={{ color: 'var(--a-warn-ink)' }} />
          </span>
          <div>
            <p className="a-list-title" style={{ margin: 0 }}>
              {bestScoreLabel}: {progress.bestScoreOverall}
            </p>
            <p className="a-list-sub" style={{ margin: 0 }}>
              {unlockedLabel}: {Math.min(progress.unlockedLevel, totalLevels)}/{totalLevels}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLevelSelectGrid;
