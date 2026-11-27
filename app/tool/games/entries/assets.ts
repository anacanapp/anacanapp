// Offline data of every game, read from the ORIGINAL modules (never retyped).
import { WORD_GARDEN_MESSAGES } from '@/components/games/word-garden/messages';
import { FRIENDS_MESSAGES } from '@/components/games/iki-dost/messages';
import { CASUAL_MESSAGES } from '@/components/games/casual/messages';
import { MESSAGES as COLOR_SORT_MESSAGES } from '@/components/games/color-sort/messages';
import { BUBBLE_MESSAGES } from '@/components/games/qabarciq/messages';
import { TILE_DEFS, BONUS_NAMES } from '@/components/games/birlesdir/tileDefs';
import { GOOD_ITEMS, BAD_ITEMS } from '@/components/games/saglam-sebet/levelConfig';

export const assets = () => ({
  'word_garden/messages.json': { schema: 'anacan-game-messages-v1', game: 'word-garden', fallback: null, languages: WORD_GARDEN_MESSAGES },
  'iki_dost/messages.json': { schema: 'anacan-game-messages-v1', game: 'iki-dost', fallback: 'az', languages: FRIENDS_MESSAGES },
  'casual/messages.json': { schema: 'anacan-game-messages-v1', game: 'casual', fallback: 'az', languages: CASUAL_MESSAGES },
  'color_sort/messages.json': { schema: 'anacan-game-messages-v1', game: 'color-sort', fallback: 'az', languages: COLOR_SORT_MESSAGES },
  'qabarciq/messages.json': { schema: 'anacan-game-messages-v1', game: 'qabarciq', fallback: 'az', languages: BUBBLE_MESSAGES },
  'birlesdir/tiles.json': { tiles: TILE_DEFS, bonusNames: BONUS_NAMES },
  'saglam_sebet/items.json': { good: GOOD_ITEMS, bad: BAD_ITEMS },
});
