import { APP_LANGUAGES, normalizeAppLanguage } from './app-languages';

const countryLanguages = Object.fromEntries(APP_LANGUAGES.map(item => [item.flag.toUpperCase(), item.code]));
export function nameCollectionLanguage(country: string | null | undefined, language: string): string {
  const code = country?.toUpperCase() || '';
  if (['US','AU','NZ','IE'].includes(code)) return 'en';
  return countryLanguages[code] || normalizeAppLanguage(language);
}
