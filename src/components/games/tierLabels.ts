import { tr } from '@/lib/tr';

// Difficulty tier names come from the level configs as Azerbaijani strings
// (they are also persisted in section labels). Translate them at render time
// so the games stay fully multilanguage.
const TIER_KEY_MAP: Record<string, string> = {
  Rahat: 'games_tier_rahat',
  Orta: 'games_tier_orta',
  'Çətin': 'games_tier_cetin',
  Ekspert: 'games_tier_ekspert',
  Asan: 'games_tier_asan',
  Usta: 'games_tier_usta',
  'Əfsanə': 'games_tier_efsane',
};

export function trTierName(name: string): string {
  const key = TIER_KEY_MAP[name];
  return key ? tr(key, name) : name;
}
