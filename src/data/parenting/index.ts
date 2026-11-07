import type { ParentingContent } from './types';

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
  if (language) merged.delete(language); else merged.clear();
}
