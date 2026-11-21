// Uşaq məşqləri: illustrated movement exercises from birth to 5 years (src/data/kid-exercises/*).
// Progress (done today, favourites, chosen age group) stays on the phone, per account, bounded. No server relation.

export interface KidExerciseSet {
  id: string;
  /** Translated label, e.g. "0–1 yaş". */
  label: string;
  /** Translated month range, e.g. "0–12 ay". */
  months: string;
  /** Real age in months the set covers: minM <= age < maxM. */
  minM: number;
  maxM: number;
  rules: string[];
}

export interface KidExercise {
  /** "<set>/<file>", also the image path: /exercises/<id>.webp */
  id: string;
  set: string;
  /** Azerbaijani group label: the structure key (month range in the first two sets, kind of movement later). */
  groupKey: string;
  /** Translated group label. */
  group: string;
  title: string;
  age: string;
  how: string;
  duration: string;
  benefit: string;
  caution?: string;
}

export const exerciseImage = (id: string): string => `/exercises/${id}.webp`;

export const SET_IDS = ['0-1', '1-2', '2-3', '3-4', '4-5'] as const;

/** Age group for a child's age in months; older than 5 years stays in the last group. */
export const setForMonths = (months: number): string => {
  const m = Math.max(0, Math.floor(months));
  if (m < 12) return '0-1';
  if (m < 24) return '1-2';
  if (m < 36) return '2-3';
  if (m < 48) return '3-4';
  return '4-5';
};

/** Month range of a group whose Azerbaijani key is a range such as "0–3 ay"; null for kinds of movement. */
export const groupMonths = (groupKey: string): { min: number; max: number } | null => {
  const m = /^(\d+)\s*[–-]\s*(\d+)\s*ay$/.exec(groupKey.trim());
  return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
};

/** The group that holds the child's age (first two sets only). */
export const currentGroupKey = (exercises: KidExercise[], setId: string, months: number | null): string | null => {
  if (months == null) return null;
  for (const e of exercises) {
    if (e.set !== setId) continue;
    const r = groupMonths(e.groupKey);
    if (r && r.min <= months && months < r.max) return e.groupKey;
  }
  return null;
};

/** Groups of a set in source order. */
export const groupsOf = (exercises: KidExercise[]): { key: string; label: string; items: KidExercise[] }[] => {
  const out: { key: string; label: string; items: KidExercise[] }[] = [];
  for (const e of exercises) {
    let g = out.find((x) => x.key === e.groupKey);
    if (!g) { g = { key: e.groupKey, label: e.group, items: [] }; out.push(g); }
    g.items.push(e);
  }
  return out;
};

/** Accent-insensitive search text (ə/ı/ş/ç/ğ/ö/ü fold to plain Latin; other scripts stay as they are). */
export const foldSearch = (text: string): string =>
  text.toLocaleLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

export const searchExercises = (exercises: KidExercise[], query: string): KidExercise[] => {
  const q = foldSearch(query.trim());
  if (!q) return exercises;
  return exercises.filter((e) => foldSearch([e.title, e.how, e.benefit, e.group].join(' ')).includes(q));
};

// Deterministic per day, child and group: the same three picks all day, a new set tomorrow.
const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/**
 * Three picks for today. In the baby groups (month ranges) only exercises of the child's group and younger groups are
 * candidates, at most two from the current group first; later sets pick from different kinds of movement.
 */
export const todaysPicks = (exercises: KidExercise[], seed: string, months: number | null, count = 3): KidExercise[] => {
  let pool = exercises;
  let current: KidExercise[] = [];
  if (months != null) {
    const ranged = exercises.filter((e) => groupMonths(e.groupKey));
    if (ranged.length) {
      pool = ranged.filter((e) => (groupMonths(e.groupKey)?.min ?? 0) <= months);
      if (!pool.length) pool = ranged.filter((e) => (groupMonths(e.groupKey)?.min ?? 0) === 0);
      current = pool.filter((e) => { const r = groupMonths(e.groupKey)!; return r.min <= months && months < r.max; });
    }
  }
  const order = (list: KidExercise[]) => [...list].sort((a, b) => hash(`${seed}|${a.id}`) - hash(`${seed}|${b.id}`));
  const picks: KidExercise[] = [];
  for (const e of order(current)) { if (picks.length >= Math.min(2, count)) break; picks.push(e); }
  const usedGroups = new Set(picks.map((p) => p.groupKey));
  const rest = order(pool.filter((e) => !picks.includes(e)));
  for (const e of rest) { if (picks.length >= count) break; if (!usedGroups.has(e.groupKey) || current.length) { picks.push(e); usedGroups.add(e.groupKey); } }
  for (const e of rest) { if (picks.length >= count) break; if (!picks.includes(e)) picks.push(e); }
  return picks;
};

// ---- Progress on the phone ----

export interface KidExState {
  /** Chosen age group; null follows the child's age. */
  set: string | null;
  favs: string[];
  log: { d: string; id: string }[];
}
export const KIDEX_MAX_LOG = 400;
export const KIDEX_MAX_FAVS = 60;
const EMPTY: KidExState = { set: null, favs: [], log: [] };
const storageKey = (userId: string | null) => `anacan_kid_exercises_v1:${userId ?? 'guest'}`;

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Store = Pick<Storage, 'getItem' | 'setItem'> | null;

export function readKidExState(store: Store, userId: string | null): KidExState {
  try {
    const raw = store?.getItem(storageKey(userId));
    if (!raw) return { ...EMPTY };
    const v = JSON.parse(raw) as Partial<KidExState>;
    return {
      set: typeof v.set === 'string' && (SET_IDS as readonly string[]).includes(v.set) ? v.set : null,
      favs: Array.isArray(v.favs) ? v.favs.filter((x): x is string => typeof x === 'string').slice(0, KIDEX_MAX_FAVS) : [],
      log: Array.isArray(v.log) ? v.log.filter((x) => x && typeof x.d === 'string' && typeof x.id === 'string').slice(-KIDEX_MAX_LOG) : [],
    };
  } catch { return { ...EMPTY }; }
}

export function writeKidExState(store: Store, userId: string | null, state: KidExState): void {
  try {
    store?.setItem(storageKey(userId), JSON.stringify({
      set: state.set, favs: state.favs.slice(0, KIDEX_MAX_FAVS), log: state.log.slice(-KIDEX_MAX_LOG),
    }));
  } catch { /* storage full or blocked: progress is a convenience */ }
}

export const doneOn = (state: KidExState, day: string): Set<string> => new Set(state.log.filter((l) => l.d === day).map((l) => l.id));

export const logDone = (state: KidExState, id: string, now: Date): KidExState => {
  const d = dayKey(now);
  if (state.log.some((l) => l.d === d && l.id === id)) return state;
  return { ...state, log: [...state.log, { d, id }].slice(-KIDEX_MAX_LOG) };
};

export const unlogDone = (state: KidExState, id: string, now: Date): KidExState => {
  const d = dayKey(now);
  return { ...state, log: state.log.filter((l) => !(l.d === d && l.id === id)) };
};

export const toggleFav = (state: KidExState, id: string): KidExState => ({
  ...state,
  favs: state.favs.includes(id) ? state.favs.filter((f) => f !== id) : [id, ...state.favs].slice(0, KIDEX_MAX_FAVS),
});

/** Last 7 days, oldest first, with the number of exercises done each day. */
export const weekStrip = (state: KidExState, now: Date): { day: string; count: number; today: boolean }[] => {
  const out: { day: string; count: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const k = dayKey(d);
    out.push({ day: k, count: state.log.filter((l) => l.d === k).length, today: i === 0 });
  }
  return out;
};

/** Tile shows for the Ana module (admins everywhere) when the app language has content. */
export const isKidExTileVisible = (input: { lifeStage?: string | null; hasContent: boolean; disabled?: boolean; isAdmin?: boolean }): boolean =>
  !input.disabled && input.hasContent && (input.lifeStage === 'mommy' || !!input.isAdmin);
