import type { AgeBandId, ParentingContent, Programme, Tip } from './types';

/**
 * Tərbiyə content per language — an async, lazy registry.
 *
 * Every language is its own folder (src/data/parenting/<lang>/, same shape as az, default export a
 * ParentingContent) and its own lazy chunk, so the 23 app languages never sit in one bundle and the dashboard /
 * Tools hub only pay for this tiny file. Content is written per language, never machine-translated from az.
 *
 * On top of the bundled content, editors' published overrides (Admin → Tərbiyə məzmunu,
 * public.parenting_content_overrides) are merged by item id: cached on the device, fetched with a timeout and
 * skipped offline (src/lib/parenting-overrides.ts).
 */
export type ParentingContentModule = { default: ParentingContent };

export const PARENTING_LANGUAGE_LOADERS: Record<string, () => Promise<ParentingContentModule>> = {
  az: () => import('./az'),
  // Translated languages (each checked by scripts/parenting/check-translation.mjs).
  // The tile, home card, partner entry and Anacan.AI link appear for these app languages automatically.
  en: () => import('./en'),
  ru: () => import('./ru'),
  tr: () => import('./tr'),
  kk: () => import('./kk'),
  de: () => import('./de'),
  ar: () => import('./ar'),
  uz: () => import('./uz'),
  ka: () => import('./ka'),
  zh: () => import('./zh'),
  id: () => import('./id'),
  fr: () => import('./fr'),
  es: () => import('./es'),
  pt: () => import('./pt'),
  vi: () => import('./vi'),
  hi: () => import('./hi'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  pl: () => import('./pl'),
  nl: () => import('./nl'),
  sv: () => import('./sv'),
  ky: () => import('./ky'),
  et: () => import('./et'),
};

export const PARENTING_CONTENT_LANGUAGES = Object.keys(PARENTING_LANGUAGE_LOADERS);

/** Whether bundled content is registered for this app language (sync; no content is loaded). */
export function hasParentingContent(language: string | null | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(PARENTING_LANGUAGE_LOADERS, String(language || ''));
}

const bundled = new Map<string, Promise<ParentingContent>>();
const merged = new Map<string, { at: number; content: ParentingContent }>();
const inflight = new Map<string, Promise<ParentingContent | null>>();

/** The bundled content of a language (no overrides), loaded once; null when the language is not registered. */
export function loadBundledParentingContent(language: string): Promise<ParentingContent | null> {
  if (!hasParentingContent(language)) return Promise.resolve(null);
  let p = bundled.get(language);
  if (!p) {
    p = PARENTING_LANGUAGE_LOADERS[language]().then((m) => m.default);
    p.catch(() => bundled.delete(language)); // a failed chunk load can be retried
    bundled.set(language, p);
  }
  return p;
}

/** Last loaded content (with overrides) for synchronous first renders; null before the first load. */
export function peekParentingContent(language: string | null | undefined): ParentingContent | null {
  return merged.get(String(language || ''))?.content ?? null;
}

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Bundled content + published overrides for a language. Re-uses the in-memory result for 10 minutes; overrides
 * never block or break the tool (offline → cached overrides → bundled). Null when the language is not registered.
 */
export function loadParentingContent(language: string, opts: { overrides?: boolean; now?: number } = {}): Promise<ParentingContent | null> {
  const now = opts.now ?? Date.now();
  const hit = merged.get(language);
  if (hit && now - hit.at < REFRESH_MS) return Promise.resolve(hit.content);
  const running = inflight.get(language);
  if (running) return running;
  const job = (async () => {
    const base = await loadBundledParentingContent(language);
    if (!base) return null;
    let content = base;
    if (opts.overrides !== false) {
      try {
        const { applyParentingOverrides, fetchPublishedOverrides } = await import('@/lib/parenting-overrides');
        content = applyParentingOverrides(base, await fetchPublishedOverrides(language, { now }));
      } catch { /* overrides are optional */ }
    }
    merged.set(language, { at: now, content });
    return content;
  })().finally(() => inflight.delete(language));
  inflight.set(language, job);
  return job;
}

/** Test / admin hook: forget the merged content so the next load re-reads overrides. */
export function resetParentingContentCache(language?: string) {
  if (language) { merged.delete(language); homeMerged.delete(language); } else { merged.clear(); homeMerged.clear(); }
}

// ── Dashboard home card: daily tip + running programme ──────────────────────────────────
/** What the Ana home card needs: the daily tips and the programmes (titles, day titles for reminders). */
export interface ParentingHomeContent {
  tips: Record<AgeBandId, Tip[]>;
  programmes: Programme[];
}

type HomeModules = [{ TIPS: Record<AgeBandId, Tip[]> }, { PROGRAMMES: Programme[] }];

/**
 * Small per-language chunks for the home card (tips.ts + programmes.ts, which every language folder has): the card
 * never loads the whole content chunk (articles, SOS cards, quizzes); the full content still loads when the tool
 * opens. Keep in step with PARENTING_LANGUAGE_LOADERS (a test checks the keys match).
 */
export const PARENTING_HOME_LOADERS: Record<string, () => Promise<HomeModules>> = {
  az: () => Promise.all([import('./az/tips'), import('./az/programmes')]),
  en: () => Promise.all([import('./en/tips'), import('./en/programmes')]),
  ru: () => Promise.all([import('./ru/tips'), import('./ru/programmes')]),
  tr: () => Promise.all([import('./tr/tips'), import('./tr/programmes')]),
  kk: () => Promise.all([import('./kk/tips'), import('./kk/programmes')]),
  de: () => Promise.all([import('./de/tips'), import('./de/programmes')]),
  ar: () => Promise.all([import('./ar/tips'), import('./ar/programmes')]),
  uz: () => Promise.all([import('./uz/tips'), import('./uz/programmes')]),
  ka: () => Promise.all([import('./ka/tips'), import('./ka/programmes')]),
  zh: () => Promise.all([import('./zh/tips'), import('./zh/programmes')]),
  id: () => Promise.all([import('./id/tips'), import('./id/programmes')]),
  fr: () => Promise.all([import('./fr/tips'), import('./fr/programmes')]),
  es: () => Promise.all([import('./es/tips'), import('./es/programmes')]),
  pt: () => Promise.all([import('./pt/tips'), import('./pt/programmes')]),
  vi: () => Promise.all([import('./vi/tips'), import('./vi/programmes')]),
  hi: () => Promise.all([import('./hi/tips'), import('./hi/programmes')]),
  ja: () => Promise.all([import('./ja/tips'), import('./ja/programmes')]),
  ko: () => Promise.all([import('./ko/tips'), import('./ko/programmes')]),
  pl: () => Promise.all([import('./pl/tips'), import('./pl/programmes')]),
  nl: () => Promise.all([import('./nl/tips'), import('./nl/programmes')]),
  sv: () => Promise.all([import('./sv/tips'), import('./sv/programmes')]),
  ky: () => Promise.all([import('./ky/tips'), import('./ky/programmes')]),
  et: () => Promise.all([import('./et/tips'), import('./et/programmes')]),
};

const homeMerged = new Map<string, { at: number; content: ParentingHomeContent }>();
const homeInflight = new Map<string, Promise<ParentingHomeContent | null>>();

/** Last loaded home content: the full content when the tool already loaded it, else the small chunk. */
export function peekParentingTips(language: string | null | undefined): ParentingHomeContent | null {
  const lang = String(language || '');
  const full = peekParentingContent(lang);
  return full ? { tips: full.tips, programmes: full.programmes } : homeMerged.get(lang)?.content ?? null;
}

/**
 * Tips + programmes of a language with the editors' published overrides for tips, programmes and programme days
 * applied (as in the tool). Re-uses the full content when it is already in memory; null when not registered.
 */
export function loadParentingTips(language: string, opts: { overrides?: boolean; now?: number } = {}): Promise<ParentingHomeContent | null> {
  if (!hasParentingContent(language) || !Object.prototype.hasOwnProperty.call(PARENTING_HOME_LOADERS, language)) return Promise.resolve(null);
  const now = opts.now ?? Date.now();
  const full = merged.get(language);
  if (full && now - full.at < REFRESH_MS) return Promise.resolve({ tips: full.content.tips, programmes: full.content.programmes });
  const hit = homeMerged.get(language);
  if (hit && now - hit.at < REFRESH_MS) return Promise.resolve(hit.content);
  const running = homeInflight.get(language);
  if (running) return running;
  const job = (async () => {
    const [{ TIPS }, { PROGRAMMES }] = await PARENTING_HOME_LOADERS[language]();
    let content: ParentingHomeContent = { tips: TIPS, programmes: PROGRAMMES };
    if (opts.overrides !== false) {
      try {
        const { applyParentingOverrides, fetchPublishedOverrides } = await import('@/lib/parenting-overrides');
        const rows = (await fetchPublishedOverrides(language, { now })).filter((r) => r && ['tip', 'programme', 'programme_day'].includes(r.item_type));
        // Only tip / programme rows apply, so the other parts of this stand-in content are never read.
        const patched = applyParentingOverrides({ tips: TIPS, programmes: PROGRAMMES, articles: [], sos: [], bands: [], areas: [] } as unknown as ParentingContent, rows);
        content = { tips: patched.tips, programmes: patched.programmes };
      } catch { /* overrides are optional */ }
    }
    homeMerged.set(language, { at: now, content });
    return content;
  })().finally(() => homeInflight.delete(language));
  homeInflight.set(language, job);
  return job;
}
