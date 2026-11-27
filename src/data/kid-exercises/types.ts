/** UI strings of Uşaq məşqləri. `{n}` and `{name}` are placeholders. */
export interface KidExUiText {
  tileName: string;
  tileDesc: string;
  title: string;
  eyebrow: string;
  ageFor: string;
  today: string;
  doneCount: string;
  weekHint: string;
  picksTitle: string;
  picksSub: string;
  allTitle: string;
  count: string;
  nowBadge: string;
  search: string;
  all: string;
  favs: string;
  noFavs: string;
  noResults: string;
  rules: string;
  safetyNote: string;
  age: string;
  duration: string;
  how: string;
  benefit: string;
  caution: string;
  timer: string;
  start: string;
  pause: string;
  reset: string;
  done: string;
  doneToday: string;
  prev: string;
  next: string;
  fav: string;
  unfav: string;
  close: string;
}

/** Translated text of one age group (sets[].id of az.json). Rules keep the Azerbaijani count and order. */
export interface KidExSetText { label: string; months: string; rules: string[] }

/** Translated text of one exercise (exercises[].id of az.json). */
export interface KidExText { title: string; age: string; how: string; duration: string; benefit: string; caution?: string }

/** One language: UI strings, group labels by Azerbaijani group label, sets by id and exercises by id. */
export interface KidExLocale {
  ui: KidExUiText;
  sets: Record<string, KidExSetText>;
  groups: Record<string, string>;
  exercises: Record<string, KidExText>;
}

/** Shape of az.json (the source: structure, order and Azerbaijani text). */
export interface KidExSource {
  sets: { id: string; label: string; months: string; minM: number; maxM: number; rules: string[] }[];
  exercises: ({ id: string; set: string; group: string } & KidExText)[];
}
