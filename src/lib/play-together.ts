// Uşaqla oyun: screen-free games for a parent and child (src/data/play-together/*), with Anacan PDF book links.
// Progress (games played, favourites) stays on the phone, per account, bounded. No server relation.
import { BOOKS, findBook, type Book } from '@/lib/books/catalog';

export type PlayCategory = 'craft' | 'move' | 'pretend' | 'kitchen' | 'calm' | 'outdoor' | 'words';
export const PLAY_CATEGORIES: PlayCategory[] = ['craft', 'move', 'pretend', 'kitchen', 'calm', 'outdoor', 'words'];

export interface PlayGame {
  id: string;
  emoji: string;
  cat: PlayCategory;
  /** Real age in months: shown when minM <= age < maxM. */
  minM: number;
  maxM: number;
  minutes: number;
  title: string;
  why: string;
  materials: string[];
  steps: string[];
  tip?: string;
  safety?: string;
  /** Anacan PDF book ids that continue the same play. */
  books: string[];
}

/** Age bands for the manual picker (no child, or a parent who wants another age). Value = months used for filtering. */
export const PLAY_AGE_BANDS = [
  { id: '6m', months: 8 },
  { id: '1y', months: 18 },
  { id: '2y', months: 30 },
  { id: '3y', months: 42 },
  { id: '4y', months: 54 },
  { id: '5y', months: 66 },
  { id: '6y', months: 80 },
] as const;
export type PlayAgeBand = typeof PLAY_AGE_BANDS[number]['id'];

export const bandForMonths = (months: number): PlayAgeBand => {
  if (months < 12) return '6m';
  const years = Math.min(6, Math.floor(months / 12));
  return `${years}y` as PlayAgeBand;
};
export const monthsForBand = (band: PlayAgeBand): number => PLAY_AGE_BANDS.find((b) => b.id === band)?.months ?? 30;

/** Youngest age the tool serves; younger babies get the 6-month band. */
export const PLAY_MIN_MONTHS = 6;
/** Oldest child the tool is meant for (under 9). */
export const PLAY_MAX_MONTHS = 108;

export const gamesForAge = (games: PlayGame[], months: number): PlayGame[] => {
  const age = Math.max(PLAY_MIN_MONTHS, Math.min(PLAY_MAX_MONTHS - 1, Math.floor(months)));
  return games.filter((g) => g.minM <= age && age < g.maxM);
};

/** Screen-time guidance group by age: WHO 2019 (under 5) and AAP. */
export type ScreenGuide = 'none' | 'hour' | 'family';
export const screenGuideFor = (months: number): ScreenGuide => (months < 24 ? 'none' : months < 60 ? 'hour' : 'family');

// Deterministic per day and child: the same three picks all day, a new set tomorrow.
const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** Up to `count` games for today, from different categories where possible; games played today go last. */
export function todaysPicks(games: PlayGame[], seed: string, playedToday: Set<string>, count = 3): PlayGame[] {
  const order = [...games].sort((a, b) => hash(`${seed}|${a.id}`) - hash(`${seed}|${b.id}`));
  const fresh = order.filter((g) => !playedToday.has(g.id));
  const picks: PlayGame[] = [];
  const cats = new Set<PlayCategory>();
  for (const g of fresh) { if (picks.length < count && !cats.has(g.cat)) { picks.push(g); cats.add(g.cat); } }
  for (const g of [...fresh, ...order]) { if (picks.length < count && !picks.includes(g)) picks.push(g); }
  return picks;
}

/** Books for a game: its own links first, then (optionally) nothing else; only books that exist in the catalogue. */
export const booksForGame = (game: PlayGame): Book[] => game.books.map(findBook).filter((b): b is Book => !!b);

/** Book page activities a parent can expect, from the catalogue skills (cut/paste, colouring, mazes...). */
const HANDS_ON = /kəs|yapış|rəngləmə|boya|labirint|izlə|yaz|birləşdir/iu;
export const handsOnSkills = (book: Book): string[] => book.skills.filter((s) => HANDS_ON.test(s));

/** Books of the child's age group that contain hands-on pages, hands-on first. */
export function booksForAgeGroup(months: number): Book[] {
  const band = bandForMonths(Math.max(PLAY_MIN_MONTHS, months));
  const list = BOOKS.filter((b) => b.age === band);
  return [...list].sort((a, b) => handsOnSkills(b).length - handsOnSkills(a).length);
}

// ---- Local progress ----------------------------------------------------------------------------------------------
export interface PlayLogEntry { id: string; day: string; minutes: number }
export interface PlayState { log: PlayLogEntry[]; favs: string[]; band?: PlayAgeBand | null }
const MAX_LOG = 300;
const MAX_FAVS = 60;
export const playStateKey = (userId: string | null | undefined) => `anacan.play-together.v1.${userId || 'anon'}`;
export const emptyPlayState = (): PlayState => ({ log: [], favs: [], band: null });

export const dayKey = (date: Date): string => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isBand = (value: unknown): value is PlayAgeBand => PLAY_AGE_BANDS.some((b) => b.id === value);

/** Parses stored state, dropping anything malformed and keeping the bounds. */
export function sanitizePlayState(raw: unknown): PlayState {
  if (!raw || typeof raw !== 'object') return emptyPlayState();
  const r = raw as Record<string, unknown>;
  const log = Array.isArray(r.log) ? r.log.filter((e): e is PlayLogEntry => !!e && typeof e === 'object'
    && typeof (e as PlayLogEntry).id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String((e as PlayLogEntry).day))
    && Number.isFinite((e as PlayLogEntry).minutes) && (e as PlayLogEntry).minutes > 0 && (e as PlayLogEntry).minutes <= 240).slice(-MAX_LOG) : [];
  const favs = Array.isArray(r.favs) ? [...new Set(r.favs.filter((f): f is string => typeof f === 'string'))].slice(0, MAX_FAVS) : [];
  return { log, favs, band: isBand(r.band) ? r.band : null };
}

export function readPlayState(storage: Pick<Storage, 'getItem'> | null, userId: string | null | undefined): PlayState {
  try { return sanitizePlayState(JSON.parse(storage?.getItem(playStateKey(userId)) || 'null')); } catch { return emptyPlayState(); }
}
export function writePlayState(storage: Pick<Storage, 'setItem'> | null, userId: string | null | undefined, state: PlayState): void {
  try { storage?.setItem(playStateKey(userId), JSON.stringify(sanitizePlayState(state))); } catch { /* storage full or blocked: progress is a convenience */ }
}

/** Marks a game as played today (once per game per day). */
export function logPlayed(state: PlayState, game: Pick<PlayGame, 'id' | 'minutes'>, now: Date): PlayState {
  const day = dayKey(now);
  if (state.log.some((e) => e.id === game.id && e.day === day)) return state;
  return { ...state, log: [...state.log, { id: game.id, day, minutes: game.minutes }].slice(-MAX_LOG) };
}
export function unlogPlayed(state: PlayState, gameId: string, now: Date): PlayState {
  const day = dayKey(now);
  return { ...state, log: state.log.filter((e) => !(e.id === gameId && e.day === day)) };
}
export const toggleFav = (state: PlayState, gameId: string): PlayState => ({
  ...state, favs: state.favs.includes(gameId) ? state.favs.filter((f) => f !== gameId) : [gameId, ...state.favs].slice(0, MAX_FAVS),
});

export const playedOn = (state: PlayState, day: string): Set<string> => new Set(state.log.filter((e) => e.day === day).map((e) => e.id));
export const minutesOn = (state: PlayState, day: string): number => state.log.filter((e) => e.day === day).reduce((s, e) => s + e.minutes, 0);

/** The last 7 days (oldest first) with the minutes played together each day. */
export function weekStrip(state: PlayState, now: Date): { day: string; minutes: number; today: boolean }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = dayKey(d);
    out.push({ day, minutes: minutesOn(state, day), today: i === 0 });
  }
  return out;
}

/** Tile rule: Ana module, content registered for the app language (src/data/play-together/index.ts), not disabled. */
export const isPlayTileVisible = (input: { lifeStage?: string | null; hasContent: boolean; disabled?: boolean; isAdmin?: boolean }): boolean =>
  !input.disabled && input.hasContent && (input.lifeStage === 'mommy' || !!input.isAdmin);
