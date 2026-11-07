import type { ParentingContent } from './types';
import az from './az';

/**
 * Tərbiyə content per language. Only Azerbaijani exists for now; another language is added as its own folder
 * (src/data/parenting/<lang>/) with the same shape — never by machine-translating the Azerbaijani texts.
 */
const CONTENT: Record<string, ParentingContent> = { az };

export function getParentingContent(language: string | null | undefined): ParentingContent | null {
  return CONTENT[String(language || '')] ?? null;
}

export const PARENTING_CONTENT_LANGUAGES = Object.keys(CONTENT);
