import { Puzzle } from 'lucide-react';
import { tr } from '@/lib/tr';
import { TOTAL_LEVELS, getLevelSections } from './levelConfig';
import type { GameProgress } from '@/hooks/useLocalGameProgress';
import GameLevelSelectGrid from '../GameLevelSelectGrid';

interface BirlesdirLevelsProps {
  progress: GameProgress;
  isLevelUnlocked: (level: number) => boolean;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

const BirlesdirLevels = ({ progress, isLevelUnlocked, onSelectLevel, onBack }: BirlesdirLevelsProps) => {
  return (
    <GameLevelSelectGrid
      title={tr('birlesdir_title', 'Birləşdir')}
      subtitle={tr('birlesdir_choose_level', 'Səviyyə seçin')}
      icon={Puzzle}
      sections={getLevelSections()}
      progress={progress}
      isLevelUnlocked={isLevelUnlocked}
      onSelectLevel={onSelectLevel}
      onBack={onBack}
      bestScoreLabel={tr('birlesdir_best_score_label', 'Ən yaxşı xalınız')}
      unlockedLabel={tr('birlesdir_levels_unlocked_prefix', 'Açılmış səviyyələr')}
      totalLevels={TOTAL_LEVELS}
      accentGradient="from-violet-500 to-fuchsia-500"
    />
  );
};

export default BirlesdirLevels;
