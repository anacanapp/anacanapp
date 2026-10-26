import copy from '../../scripts/i18n/followup36-content.json';
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';
import { mapRowsTranslation } from './tr';

/** Exact source tuple fallback for legacy Source schemas. Explicit server copy
 * wins, and an edited source never receives a stale bundled instruction. */
export function mapFollowupContent<T extends Record<string, any>>(rows: T[] | null | undefined, language: string, fields: string[]): T[] {
  const values = copy.values as Record<string, Record<string, unknown>>;
  const enriched = (rows || []).map(row => {
    const next = { ...row };
    for (const field of fields) {
      const key = `${field}_${language}`;
      if (next[key] == null || next[key] === '') {
        const translated = values[contentTranslationKey(row, field)]?.[language];
        if (translated !== undefined) (next as Record<string, unknown>)[key] = translated;
      }
    }
    return next;
  });
  return mapRowsTranslation(enriched, language, fields) as T[];
}
