import copy from '../../scripts/i18n/moderator-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';
export type ModeratorTextKey = keyof typeof copy.languages.en;
export function moderatorText(key: ModeratorTextKey, language: string = readAppLanguage()): string {
  return (copy.languages as Record<string, Record<string, string>>)[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key];
}
