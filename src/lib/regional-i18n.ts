import copy from '../../scripts/i18n/regional-copy.json';
import { normalizeAppLanguage } from './app-languages';

export type RegionalTextKey = keyof typeof copy.languages.en;
export function regionalText(key: RegionalTextKey, language: string): string {
  const values = copy.languages as Record<string, Record<RegionalTextKey, string>>;
  return values[normalizeAppLanguage(language)]?.[key] || values.en[key];
}
