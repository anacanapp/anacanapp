import copy from '../../../scripts/i18n/books-copy.json';
import { normalizeAppLanguage } from '@/lib/app-languages';
import { useUserStore } from '@/store/userStore';

export type BooksCopyKey = keyof typeof copy.languages.az;
const table = copy.languages as Record<string, Record<string, string>>;

export function booksText(key: BooksCopyKey, language: string, vars?: Record<string, string | number>): string {
  let text = table[normalizeAppLanguage(language)]?.[key] || table.en?.[key] || copy.languages.az[key];
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
export function useBooksText() {
  const language = useUserStore(state => state.language);
  const t = (key: BooksCopyKey, vars?: Record<string, string | number>) => booksText(key, language, vars);
  return { t, language: normalizeAppLanguage(language) };
}
