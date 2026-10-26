import copy from '../../scripts/i18n/maternity36-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';
export function maternityText(key: string, language: string = readAppLanguage(), values: Record<string, string | number> = {}): string {
  const languages = copy.languages as Record<string, Record<string, string>>;
  const text = languages[normalizeAppLanguage(language)]?.[key] || languages.en[key] || '';
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, name: string) => values[name] === undefined ? token : String(values[name]));
}
