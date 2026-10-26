// "Birləşdir" — Anacan-themed match-3 tile set.
// Icons chosen to fit the app's motherhood/self-care concept instead of
// generic candy/gems.

export interface TileDef {
  type: number;
  emoji: string;
  label: string;
}

export const TILE_DEFS: TileDef[] = [
  { type: 0, emoji: '☕', label: 'Qəhvə fincanı' },
  { type: 1, emoji: '🧸', label: 'Oyuncaq ayı' },
  { type: 2, emoji: '🍼', label: 'Əmzik' },
  { type: 3, emoji: '🥒', label: 'Üz maskası' },
  { type: 4, emoji: '🛁', label: 'İstirahət anı' },
  { type: 5, emoji: '🌸', label: 'Sakitlik çiçəyi' },
  { type: 6, emoji: '👑', label: 'Super Ana tacı' },
];

export function getTilePool(typeCount: number): TileDef[] {
  return TILE_DEFS.slice(0, Math.min(Math.max(typeCount, 3), TILE_DEFS.length));
}

// Bonus perk names shown when a special tile is created / activated.
// `key` is the translation key; `name` is the Azerbaijani fallback.
export const BONUS_NAMES = {
  'striped-h': { key: 'birlesdir_bonus_striped', name: 'Sakitlik Anı!', emoji: '💫' },
  'striped-v': { key: 'birlesdir_bonus_striped', name: 'Sakitlik Anı!', emoji: '💫' },
  wrapped: { key: 'birlesdir_bonus_wrapped', name: 'Super Ana!', emoji: '💥' },
  'color-bomb': { key: 'birlesdir_bonus_colorbomb', name: 'Ana Sehri!', emoji: '🌈' },
} as const;
