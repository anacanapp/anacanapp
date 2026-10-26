import { copyText, type CopyFile } from './ui-copy';
import { readAppLanguage } from './app-languages';
import { format } from 'date-fns';
import { getCurrentDateLocale } from './date-utils';

export type RedesignKey = keyof CopyFile['redesign'];

/** Copy for this area in all 21 languages (see ui-copy.ts); English is the safety net. */
export function rd(key: RedesignKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  return copyText('redesign', key, language, vars);
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
