import copy from '../../scripts/i18n/redesign-copy.json';
import { format } from 'date-fns';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';
import { getCurrentDateLocale } from './date-utils';

export type RedesignKey = keyof typeof copy.languages.en;

/** Redesign (v3) copy: all 21 languages live in scripts/i18n/redesign-copy.json; English is the safety net. */
export function rd(key: RedesignKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  const languages = copy.languages as Record<string, Record<string, string>>;
  let text = languages[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key] || key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

/** Short month name for the active language (timeline date tiles). date-fns locales, since
 * some Android WebViews ship without full ICU and Intl then prints "M10". */
export function shortMonth(date: Date): string {
  return format(date, 'LLL', { locale: getCurrentDateLocale() }).replace('.', '');
}

/** Day + month, e.g. "13 fevral", localized. */
export function dayMonth(date: Date | number): string {
  return format(new Date(date), 'd MMMM', { locale: getCurrentDateLocale() });
}
