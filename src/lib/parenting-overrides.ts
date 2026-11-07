/**
 * Tərbiyə CMS: published editor overrides (public.parenting_content_overrides) on top of the bundled content.
 *
 * - Everyone can read published rows (RLS); only admins write them through SECURITY DEFINER RPCs.
 * - A row patches one item: { item_type, item_id, patch } where patch is a partial object of that item's text
 *   fields. It is merged by item id; structural fields (id, bands, area, free, …) can never change, values must
 *   keep the bundled type, and arrays of objects keep their length (steps, days, checkpoints).
 * - Fetching is offline-safe: a short timeout, the last good rows are cached per language on this device and
 *   any failure falls back to the cached rows or to the bundled content alone.
 */
import type { AgeBandId, ParentingContent, ParentingItemType } from '@/data/parenting/types';
import { PARENTING_ITEM_TYPES } from '@/data/parenting/types';

export interface ParentingOverrideRow {
  item_type: ParentingItemType;
  item_id: string;
  patch: Record<string, unknown>;
  updated_at?: string | null;
}

/** Never editable: identity, age bands, gating and scoring. */
export const LOCKED_KEYS = new Set(['id', 'bands', 'area', 'free', 'fromMonths', 'dim', 'flag', 'days', 'v']);
/** Optional fields an editor may add although the bundled item lacks them. */
const OPTIONAL_TEMPLATES: Record<string, unknown> = {
  byAge: { '0-1': '', '1-3': '', '3-6': '', '6-12': '' },
  redFlag: '',
  tags: [''],
};
/** Optional text that may be cleared (empty string hides it). */
const CLEARABLE = new Set(['redFlag', '0-1', '1-3', '3-6', '6-12']);
/** Arrays of objects whose length an editor may change (everything else keeps the bundled length). */
const RESIZABLE = new Set(['sources']);
const MAX_ARRAY = 200;
const MAX_TEXT = 8000;

const INVALID = Symbol('invalid');
type Out = unknown | typeof INVALID;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Merge one patch value onto the bundled value; INVALID when the type or shape does not match. */
function mergeValue(base: unknown, patch: unknown, key: string): Out {
  if (typeof base === 'string') {
    if (typeof patch !== 'string' || patch.length > MAX_TEXT) return INVALID;
    if (!patch.trim() && !CLEARABLE.has(key)) return INVALID;
    return patch;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(patch) || patch.length > MAX_ARRAY) return INVALID;
    const template = base[0];
    if (template === undefined || typeof template === 'string') {
      const list = patch.filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= MAX_TEXT);
      return list.length === patch.length ? list : INVALID;
    }
    if (isObject(template) && !RESIZABLE.has(key) && patch.length !== base.length) return INVALID;
    const out: unknown[] = [];
    for (let i = 0; i < patch.length; i++) {
      const v = mergeValue(base[i] ?? template, patch[i], key);
      if (v === INVALID) return INVALID;
      out.push(v);
    }
    return out;
  }
  if (isObject(base)) return mergeObject(base, patch);
  return INVALID; // numbers, booleans: never editable
}

function mergeObject(base: Record<string, unknown>, patch: unknown): Out {
  if (!isObject(patch)) return INVALID;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (LOCKED_KEYS.has(k)) continue;
    let b = base[k];
    if (k in OPTIONAL_TEMPLATES) b = b === undefined ? OPTIONAL_TEMPLATES[k] : isObject(b) ? { ...(OPTIONAL_TEMPLATES[k] as object), ...b } : b;
    if (b === undefined) continue; // unknown field
    const merged = mergeValue(b, v, k);
    if (merged !== INVALID) out[k] = merged; // a bad field is skipped, the rest of the patch still applies
  }
  return out;
}

/** Apply one patch to one item; the bundled item comes back unchanged when nothing valid is in the patch. */
export function patchItem<T extends object>(item: T, patch: unknown): T {
  const out = mergeObject(item as Record<string, unknown>, patch);
  return out === INVALID ? item : (out as T);
}

const splitIndex = (id: string): [string, number] | null => {
  const m = /^(.+):(\d{1,3})$/.exec(id);
  return m ? [m[1], Number(m[2]) - 1] : null;
};

/** Deep-merge the published rows into a copy of the content (the bundled object itself is never mutated). */
export function applyParentingOverrides(content: ParentingContent, rows: ParentingOverrideRow[] | null | undefined): ParentingContent {
  if (!rows?.length) return content;
  const c: ParentingContent = {
    ...content,
    articles: [...content.articles],
    sos: [...content.sos],
    programmes: [...content.programmes],
    bands: [...content.bands],
    areas: [...content.areas],
    tips: { ...content.tips },
  };
  const replace = <T extends { id: string }>(list: T[], id: string, patch: unknown) => {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = patchItem(list[i], patch);
  };
  for (const row of rows) {
    if (!row || !PARENTING_ITEM_TYPES.includes(row.item_type) || typeof row.item_id !== 'string' || !isObject(row.patch)) continue;
    switch (row.item_type) {
      case 'article': replace(c.articles, row.item_id, row.patch); break;
      case 'sos': replace(c.sos, row.item_id, row.patch); break;
      case 'programme': replace(c.programmes, row.item_id, row.patch); break;
      case 'band': replace(c.bands, row.item_id, row.patch); break;
      case 'area': replace(c.areas, row.item_id, row.patch); break;
      case 'programme_day': {
        const at = splitIndex(row.item_id);
        const pi = at ? c.programmes.findIndex((p) => p.id === at[0]) : -1;
        if (!at || pi < 0 || !c.programmes[pi].days[at[1]]) break;
        const days = [...c.programmes[pi].days];
        days[at[1]] = patchItem(days[at[1]], row.patch);
        c.programmes[pi] = { ...c.programmes[pi], days };
        break;
      }
      case 'tip': {
        const at = splitIndex(row.item_id);
        const band = at?.[0] as AgeBandId | undefined;
        if (!at || !band || !c.tips[band]?.[at[1]]) break;
        const list = [...c.tips[band]];
        list[at[1]] = patchItem(list[at[1]], row.patch);
        c.tips[band] = list;
        break;
      }
      case 'quiz':
        if (row.item_id === 'style') c.styleQuiz = patchItem(c.styleQuiz, row.patch);
        else if (row.item_id === 'milestones') c.milestoneQuiz = patchItem(c.milestoneQuiz, row.patch);
        break;
    }
  }
  return c;
}

/** The bundled item an override row targets (admin editor, tests). */
export function findParentingItem(content: ParentingContent, type: ParentingItemType, id: string): object | null {
  const at = splitIndex(id);
  switch (type) {
    case 'article': return content.articles.find((x) => x.id === id) ?? null;
    case 'sos': return content.sos.find((x) => x.id === id) ?? null;
    case 'programme': return content.programmes.find((x) => x.id === id) ?? null;
    case 'band': return content.bands.find((x) => x.id === id) ?? null;
    case 'area': return content.areas.find((x) => x.id === id) ?? null;
    case 'programme_day': return at ? content.programmes.find((p) => p.id === at[0])?.days[at[1]] ?? null : null;
    case 'tip': return at ? content.tips[at[0] as AgeBandId]?.[at[1]] ?? null : null;
    case 'quiz': return id === 'style' ? content.styleQuiz : id === 'milestones' ? content.milestoneQuiz : null;
    default: return null;
  }
}

/** Top-level fields of `edited` that differ from `base` (what an editor's draft stores). */
export function diffPatch(base: object, edited: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const b = base as Record<string, unknown>;
  for (const [k, v] of Object.entries(edited as Record<string, unknown>)) {
    if (LOCKED_KEYS.has(k)) continue;
    if (JSON.stringify(v) !== JSON.stringify(b[k])) out[k] = v;
  }
  return out;
}

// ── Fetching (cached, offline-safe) ──────────────────────────────────────────────────────
const CACHE_KEY = (language: string) => `anacan.parenting.overrides.v1.${language}`;
/** Re-check the server at most this often per language. */
export const OVERRIDES_FRESH_MS = 10 * 60 * 1000;
export const OVERRIDES_TIMEOUT_MS = 4000;

interface CachedOverrides { at: number; rows: ParentingOverrideRow[] }

export function readCachedOverrides(language: string): CachedOverrides | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY(language)) || 'null');
    if (!raw || typeof raw.at !== 'number' || !Array.isArray(raw.rows)) return null;
    return raw as CachedOverrides;
  } catch {
    return null;
  }
}

function writeCachedOverrides(language: string, rows: ParentingOverrideRow[], now: number) {
  try { localStorage.setItem(CACHE_KEY(language), JSON.stringify({ at: now, rows })); } catch { /* storage full */ }
}

const withTimeout = <T,>(p: PromiseLike<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('PARENTING_OVERRIDES_TIMEOUT')), ms);
  Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Published overrides for a language: fresh cache → no request; otherwise the server with a timeout; on any
 * failure the last cached rows (any age) or none. Never throws.
 */
export async function fetchPublishedOverrides(language: string, opts: { now?: number; force?: boolean } = {}): Promise<ParentingOverrideRow[]> {
  const now = opts.now ?? Date.now();
  const cached = readCachedOverrides(language);
  if (cached && !opts.force && now - cached.at < OVERRIDES_FRESH_MS) return cached.rows;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table newer than the generated types
    const db = supabase as unknown as { from: (t: string) => any };
    const res = await withTimeout<{ data: ParentingOverrideRow[] | null; error: unknown }>(
      db.from('parenting_content_overrides').select('item_type, item_id, patch, updated_at').eq('language', language).eq('published', true),
      OVERRIDES_TIMEOUT_MS,
    );
    if (res.error) throw res.error;
    const rows = (res.data ?? []).filter((r) => r && isObject(r.patch));
    writeCachedOverrides(language, rows, now);
    return rows;
  } catch {
    return cached?.rows ?? [];
  }
}
