import copy from '../../scripts/i18n/aptek-copy.json';
import { appLanguageLocale, normalizeAppLanguage, readAppLanguage } from './app-languages';

export type AptekKey = keyof typeof copy.languages.en;

/** Anacan Aptek copy: all 21 languages live in scripts/i18n/aptek-copy.json; English is the safety net. */
export function ap(key: AptekKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  const languages = copy.languages as Record<string, Record<string, string>>;
  let text = languages[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key] || key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

/** "12,50 ₼" in the active language's number format. */
export function formatAzn(amount: number, language: string = readAppLanguage()): string {
  const n = new Intl.NumberFormat(appLanguageLocale(normalizeAppLanguage(language)), {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
  }).format(amount);
  // Non-breaking space keeps the sign on the number's line in narrow cards.
  return `${n}\u00a0₼`;
}
