import copy from '../../scripts/i18n/redesign-copy.json';
import { appLanguageLocale, normalizeAppLanguage, readAppLanguage } from './app-languages';

export type RedesignKey = keyof typeof copy.languages.en;

/** Redesign (v3) copy: all 21 languages live in scripts/i18n/redesign-copy.json; English is the safety net. */
export function rd(key: RedesignKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  const languages = copy.languages as Record<string, Record<string, string>>;
  let text = languages[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key] || key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

/** Short month name for the active language (timeline date tiles). */
export function shortMonth(date: Date, language: string = readAppLanguage()): string {
  return new Intl.DateTimeFormat(appLanguageLocale(normalizeAppLanguage(language)), { month: 'short' }).format(date).replace('.', '');
}

/** Day + month, e.g. "13 fevral", localized. */
export function dayMonth(date: Date | number, language: string = readAppLanguage()): string {
  return new Intl.DateTimeFormat(appLanguageLocale(normalizeAppLanguage(language)), { day: 'numeric', month: 'long' }).format(new Date(date));
}
