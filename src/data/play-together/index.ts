import type { PlayGame } from '@/lib/play-together';
import { PLAY_GAMES_AZ } from './az';
import { PLAY_UI_AZ } from './ui-az';
import { hasPlayContent } from './tile';

export { hasPlayContent, playTileText } from './tile';
import type { PlayLocale, PlayUiText } from './types';

/**
 * Uşaqla oyun content per language: a lazy registry like Tərbiyə (src/data/parenting/index.ts).
 * Azerbaijani is the source (game structure, ages, book links and text). Every other language is its own chunk,
 * src/data/play-together/<lang>.ts, with the UI strings and the text of every game by id; the structure stays the
 * Azerbaijani one. Books (PDF store) are Azerbaijani only, so book links show only for az.
 */
type LocaleModule = { default: PlayLocale };

export const PLAY_LANGUAGE_LOADERS: Record<string, () => Promise<LocaleModule>> = {
  az: async () => ({ default: { ui: PLAY_UI_AZ, games: {} } }),
  en: () => import('./en'), ru: () => import('./ru'), tr: () => import('./tr'), kk: () => import('./kk'),
  de: () => import('./de'), ar: () => import('./ar'), uz: () => import('./uz'), ka: () => import('./ka'),
  zh: () => import('./zh'), id: () => import('./id'), fr: () => import('./fr'), es: () => import('./es'),
  pt: () => import('./pt'), vi: () => import('./vi'), hi: () => import('./hi'), ja: () => import('./ja'),
  ko: () => import('./ko'), pl: () => import('./pl'), nl: () => import('./nl'), sv: () => import('./sv'),
  ky: () => import('./ky'), et: () => import('./et'),
};


export interface PlayContent { language: string; ui: PlayUiText; games: PlayGame[] }

/** Applies a locale's text to the Azerbaijani game structure; a missing game text keeps the source. */
export function mergePlayLocale(language: string, locale: PlayLocale): PlayContent {
  const games = PLAY_GAMES_AZ.map((g) => {
    const t = locale.games[g.id];
    return t ? { ...g, title: t.title, why: t.why, materials: t.materials, steps: t.steps, tip: t.tip, safety: t.safety } : g;
  });
  return { language, ui: locale.ui, games };
}

const cache = new Map<string, Promise<PlayContent>>();
export function loadPlayContent(language: string): Promise<PlayContent> {
  const lang = hasPlayContent(language) ? language : 'az';
  let p = cache.get(lang);
  if (!p) {
    p = PLAY_LANGUAGE_LOADERS[lang]().then((m) => mergePlayLocale(lang, m.default)).catch(() => { cache.delete(lang); return mergePlayLocale('az', { ui: PLAY_UI_AZ, games: {} }); });
    cache.set(lang, p);
  }
  return p;
}
