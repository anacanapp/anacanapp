import { getLevelConfig, getLevelSections, getStarsForScore } from '@/components/games/saglam-sebet/levelConfig';

export function all() {
  return {
    configs: Array.from({ length: 63 }, (_, index) => getLevelConfig(index - 1)),
    stars: [[0, 50], [49, 50], [50, 50], [62, 50], [63, 50], [79, 50], [80, 50], [1300, 1300], [2080, 1300]].map(([score, target]) => ({ score, target, value: getStarsForScore(score, target) })),
    sections: getLevelSections(),
  };
}
