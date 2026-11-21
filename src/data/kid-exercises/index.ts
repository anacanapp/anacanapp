import type { KidExercise, KidExerciseSet } from '@/lib/kid-exercises';
import { KIDEX_UI_AZ } from './ui-az';
import { hasKidExContent } from './tile';
import type { KidExLocale, KidExSource, KidExUiText } from './types';

export { hasKidExContent, kidExTileText } from './tile';

/**
 * Uşaq məşqləri content per language: a lazy registry like Uşaqla oyun (src/data/play-together/index.ts).
 * az.json is the source (age groups, exercise order, groups and Azerbaijani text). Every other language is its own
 * chunk, src/data/kid-exercises/<lang>.json, with the UI strings and the text of every set, group and exercise by id;
 * the structure stays the Azerbaijani one. Images (public/exercises/<id>.webp) carry no text and are shared.
 */
type Json<T> = { default: T };
const source = (): Promise<Json<KidExSource>> => import('./az.json') as Promise<Json<KidExSource>>;
const json = (p: Promise<unknown>) => p as Promise<Json<KidExLocale>>;

export const KIDEX_LANGUAGE_LOADERS: Record<string, () => Promise<Json<KidExLocale>>> = {
  az: async () => ({ default: { ui: KIDEX_UI_AZ, sets: {}, groups: {}, exercises: {} } }),
  en: () => json(import('./en.json')),
  ru: () => json(import('./ru.json')),
  tr: () => json(import('./tr.json')),
  fr: () => json(import('./fr.json')),
  es: () => json(import('./es.json')),
  id: () => json(import('./id.json')),
  pt: () => json(import('./pt.json')),
  vi: () => json(import('./vi.json')),
  hi: () => json(import('./hi.json')),
  ja: () => json(import('./ja.json')),
  ko: () => json(import('./ko.json')),
  pl: () => json(import('./pl.json')),
  nl: () => json(import('./nl.json')),
  sv: () => json(import('./sv.json')),
  et: () => json(import('./et.json')),
  de: () => json(import('./de.json')),
  kk: () => json(import('./kk.json')),
  ar: () => json(import('./ar.json')),
};

export interface KidExContent { language: string; ui: KidExUiText; sets: KidExerciseSet[]; exercises: KidExercise[] }

/** Applies a locale's text to the Azerbaijani structure; anything missing keeps the source text. */
export function mergeKidExLocale(language: string, src: KidExSource, loc: KidExLocale): KidExContent {
  const sets = src.sets.map((s) => {
    const t = loc.sets[s.id];
    return { ...s, label: t?.label ?? s.label, months: t?.months ?? s.months, rules: t?.rules?.length === s.rules.length ? t.rules : s.rules };
  });
  const exercises = src.exercises.map((e) => {
    const t = loc.exercises[e.id];
    const base: KidExercise = { id: e.id, set: e.set, groupKey: e.group, group: loc.groups[e.group] ?? e.group, title: e.title, age: e.age, how: e.how, duration: e.duration, benefit: e.benefit, caution: e.caution };
    return t ? { ...base, title: t.title, age: t.age, how: t.how, duration: t.duration, benefit: t.benefit, caution: e.caution ? (t.caution ?? e.caution) : undefined } : base;
  });
  return { language, ui: { ...KIDEX_UI_AZ, ...loc.ui }, sets, exercises };
}

const cache = new Map<string, Promise<KidExContent>>();
export function loadKidExContent(language: string): Promise<KidExContent> {
  const lang = hasKidExContent(language) ? language : 'az';
  let p = cache.get(lang);
  if (!p) {
    p = Promise.all([source(), KIDEX_LANGUAGE_LOADERS[lang]()])
      .then(([s, l]) => mergeKidExLocale(lang, s.default, l.default))
      .catch(() => { cache.delete(lang); return source().then((s) => mergeKidExLocale('az', s.default, { ui: KIDEX_UI_AZ, sets: {}, groups: {}, exercises: {} })); });
    cache.set(lang, p);
  }
  return p;
}
