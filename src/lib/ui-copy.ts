// UI copy for the redesign, Anacan Aptek and the baby-care tools.
// One file per language (scripts/i18n/copy/<lang>.json). English ships in the main bundle
// as the fallback; every other language is its own small chunk, loaded by ensureLanguageReady
// before the first render and before any language switch, so lookups stay synchronous.
import en from '../../scripts/i18n/copy/en.json';
import { normalizeAppLanguage } from './app-languages';

export type CopyFile = typeof en;
export type CopySection = keyof CopyFile;

const loaders = import.meta.glob<{ default: CopyFile }>('../../scripts/i18n/copy/*.json');
const loaded: Record<string, CopyFile> = { en };
const pending = new Map<string, Promise<void>>();

/** Loads one language's copy chunk (no-op for English or when already loaded). */
export function ensureCopyLanguage(language: string): Promise<void> {
  const lang = normalizeAppLanguage(language);
  if (loaded[lang]) return Promise.resolve();
  const load = loaders[`../../scripts/i18n/copy/${lang}.json`];
  if (!load) return Promise.resolve();
  if (!pending.has(lang)) {
    pending.set(lang, load().then((m) => { loaded[lang] = m.default; }).finally(() => pending.delete(lang)));
  }
  return pending.get(lang)!;
}

/** Copy text with {placeholder} substitution; falls back to English, then to the key. */
export function copyText<S extends CopySection>(section: S, key: keyof CopyFile[S], language: string, vars?: Record<string, string | number>): string {
  const own = loaded[normalizeAppLanguage(language)]?.[section] as Record<string, string> | undefined;
  const fallback = en[section] as Record<string, string>;
  let text = own?.[key as string] || fallback[key as string] || String(key);
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
