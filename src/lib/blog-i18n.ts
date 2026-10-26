import copy from '../../scripts/i18n/blog-editorial-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';

export type BlogCopyKey = keyof typeof copy.az;
export function blogText(key: BlogCopyKey, language: string = readAppLanguage()): string {
  const values = copy as Record<string, Partial<Record<BlogCopyKey, string>>>;
  return values[normalizeAppLanguage(language)]?.[key] || copy.az[key];
}
