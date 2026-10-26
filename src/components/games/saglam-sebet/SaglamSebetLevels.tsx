import { ShoppingBasket } from 'lucide-react';
import { tr } from '@/lib/tr';
import { TOTAL_LEVELS, getLevelSections } from './levelConfig';
import type { GameProgress } from '@/hooks/useLocalGameProgress';
import GameLevelSelectGrid from '../GameLevelSelectGrid';

interface SaglamSebetLevelsProps {
  progress: GameProgress;
  isLevelUnlocked: (level: number) => boolean;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

const SaglamSebetLevels = ({ progress, isLevelUnlocked, onSelectLevel, onBack }: SaglamSebetLevelsProps) => {
  return (
    <GameLevelSelectGrid
      title={tr('saglamsebet_title', 'Sağlam Səbət')}
      subtitle={tr('saglamsebet_choose_level', 'Səviyyə seçin')}
      icon={ShoppingBasket}
      sections={getLevelSections()}
      progress={progress}
      isLevelUnlocked={isLevelUnlocked}
      onSelectLevel={onSelectLevel}
      onBack={onBack}
      bestScoreLabel={tr('saglamsebet_best_score_label', 'Ən yaxşı xalınız')}
      unlockedLabel={tr('saglamsebet_levels_unlocked_prefix', 'Açılmış səviyyələr')}
      totalLevels={TOTAL_LEVELS}
      accentGradient="from-emerald-500 to-teal-600"
    />
  );
};

export default SaglamSebetLevels;
