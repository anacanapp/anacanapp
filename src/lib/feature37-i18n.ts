import copy from '../../scripts/i18n/feature37-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';
export function feature37Text(key: keyof typeof copy.languages.en, language: string = readAppLanguage()): string {
  return (copy.languages as Record<string, Record<string, string>>)[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key];
}
