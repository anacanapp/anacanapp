import { FlaskConical, Plus } from 'lucide-react';
import type { GameProgress } from '@/hooks/useLocalGameProgress';
import GameLevelSelectGrid, { type LevelSection } from '../GameLevelSelectGrid';
import { getLevelProfile, LEVEL_PACK_SIZE, MAX_LEVEL_COUNT } from './difficulty';
import { useColorSortText } from './useColorSortText';

interface Props {
  progress: GameProgress; isLevelUnlocked: (level: number) => boolean; onSelectLevel: (level: number) => void;
  onBack: () => void; levelCount: number; onAddLevels: () => void;
}
export default function ColorSortLevels({ levelCount, onAddLevels, ...props }: Props) {
  const { t, number } = useColorSortText();
  const sections: LevelSection[] = [];
  for (let start = 1; start <= levelCount;) {
    const end = Math.min(levelCount, start <= 30 ? start + 5 : start + LEVEL_PACK_SIZE - 1);
    sections.push({ label: `${t(`difficulty_${getLevelProfile(start).difficulty}`)} · ${number(start)}–${number(end)}`,
      levels: Array.from({ length: end - start + 1 }, (_, index) => start + index) });
    start = end + 1;
  }
  return <GameLevelSelectGrid {...props} title={t('title')} subtitle={t('choose_level')} icon={FlaskConical}
    sections={sections} bestScoreLabel={t('best_score')} unlockedLabel={t('unlocked')} totalLevels={levelCount}
    accentGradient="from-cyan-500 to-teal-600" levelLabel={level => t('level', { level })} backLabel={t('back')}
    footer={<div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 mb-4 dark:border-cyan-900 dark:bg-cyan-950/30">
      <p className="mb-3 text-center text-sm text-cyan-900 dark:text-cyan-100" role="status">{t('available_levels', { count: levelCount })}</p>
      {levelCount < MAX_LEVEL_COUNT && <button type="button" data-testid="colorsort-add-levels" onClick={onAddLevels}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 font-semibold text-white active:scale-[0.98]">
        <Plus size={18} /> {t('add_levels', { count: Math.min(LEVEL_PACK_SIZE, MAX_LEVEL_COUNT - levelCount) })}
      </button>}
    </div>} />;
}
