import copy from '../../scripts/i18n/followup36-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';

export type FollowupCopyKey = keyof typeof copy.languages.en;
export function followupText(key: FollowupCopyKey, language: string = readAppLanguage(), values: Record<string, string | number> = {}): string {
  const dictionary = copy.languages as Record<string, Record<FollowupCopyKey, string>>;
  const text = dictionary[normalizeAppLanguage(language)]?.[key] || dictionary.en[key];
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, name: string) => values[name] === undefined ? token : String(values[name]));
}
