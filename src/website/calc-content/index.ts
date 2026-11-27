import type { WebsiteLanguageCode } from '../../lib/app-languages';
import type { CalcContent } from './types';
export type { CalcContent, CalcPageText } from './types';

/** Server renderers register every language up front (`./all`); the browser loads only the
 * current language's module before rendering or hydrating (see `bootstrap.tsx`). */
const registry: Partial<Record<WebsiteLanguageCode, CalcContent>> = {};
export function registerCalcContent(language: WebsiteLanguageCode, content: CalcContent) { registry[language] = content; }
export function hasCalcContent(language: WebsiteLanguageCode) { return !!registry[language]; }
export function calcContent(language: WebsiteLanguageCode): CalcContent {
  const content = registry[language];
  if (!content) throw new Error('WEBSITE_CALC_CONTENT_MISSING');
  return content;
}
