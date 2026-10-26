import copy from '../../scripts/i18n/community-moderation-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';

export type ModerationCopyKey = keyof typeof copy.languages.en;
export function moderationText(key: ModerationCopyKey, language: string = readAppLanguage()): string {
  return (copy.languages as Record<string, Record<string, string>>)[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key];
}
