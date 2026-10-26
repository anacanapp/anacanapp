import copy from '../../scripts/i18n/premium-copy.json';
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';
import { mapRowsTranslation } from './tr';

const values = copy.values as Record<string, Record<string, string>>;

/** Public Premium catalog fallback for all supported languages, including the
 * older Source schema. Bind to the whole source tuple so edits cannot reuse stale copy. */
export function localizePremiumRows<T extends Record<string, any>>(rows: T[], language: string, fields: string[]): T[] {
  const mapped = mapRowsTranslation(rows, language, fields);
  if (language === 'az') return mapped;
  return mapped.map((item, index) => {
    const row = rows[index], result = { ...item };
    for (const field of fields) {
      const server = row[`${field}_${language}`];
      if (typeof server === 'string' && server.trim()) continue;
      const key = contentTranslationKey(row, field), translated = key && values[key]?.[language];
      if (translated) { (result as Record<string, unknown>)[field] = translated; (result as Record<string, unknown>)[`${field}_${language}`] = translated; }
    }
    return result;
  });
}
