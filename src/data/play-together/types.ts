import type { PlayAgeBand, PlayCategory } from '@/lib/play-together';

/** Translated text of one game. Arrays keep the same length and order as the Azerbaijani source. */
export interface PlayGameText {
  title: string;
  why: string;
  materials: string[];
  steps: string[];
  tip?: string;
  safety?: string;
}

/** UI strings of the tool. `{n}` and `{name}` are placeholders. */
export interface PlayUiText {
  tileName: string;
  tileDesc: string;
  title: string;
  eyebrow: string;
  today: string;
  minutes: string;
  weekHint: string;
  picksTitle: string;
  picksSub: string;
  allGames: string;
  all: string;
  favs: string;
  noFavs: string;
  noGames: string;
  booksTitle: string;
  booksSub: string;
  ageFor: string;
  ageLabel: Record<PlayAgeBand, string>;
  ageMonths: string;
  ageYears: string;
  cats: Record<PlayCategory, string>;
  guide: { none: string; hour: string; family: string };
  guideSource: string;
  why: string;
  materials: string;
  steps: string;
  tip: string;
  safety: string;
  continueInBook: string;
  continueInBookSub: string;
  played: string;
  playedDone: string;
  pages: string;
  insideBook: string;
  openStore: string;
  close: string;
  fav: string;
  unfav: string;
}

/** One language: UI strings and every game's text by game id (src/data/play-together/az.ts ids). */
export interface PlayLocale {
  ui: PlayUiText;
  games: Record<string, PlayGameText>;
}
