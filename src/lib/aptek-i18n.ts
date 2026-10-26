import { copyText, type CopyFile } from './ui-copy';
import { appLanguageLocale, normalizeAppLanguage, readAppLanguage } from './app-languages';

export type AptekKey = keyof CopyFile['aptek'];

/** Copy for this area in all 21 languages (see ui-copy.ts); English is the safety net. */
export function ap(key: AptekKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  return copyText('aptek', key, language, vars);
}

/** "12,50 ₼" in the active language's number format. */
export function formatAzn(amount: number, language: string = readAppLanguage()): string {
  const n = new Intl.NumberFormat(appLanguageLocale(normalizeAppLanguage(language)), {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
  }).format(amount);
  // Non-breaking space keeps the sign on the number's line in narrow cards.
  return `${n}\u00a0₼`;
}
