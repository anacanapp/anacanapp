import copy from '../../scripts/i18n/app-entry-copy.json';
export type EntryTextKey = keyof typeof copy.az;
export function entryText(key: EntryTextKey, language = 'az'): string {
  return (copy as Record<string, Record<string, string>>)[language]?.[key] || copy.az[key];
}
