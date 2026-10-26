import { getCachedTranslation } from './i18n';
import { NEW_LANGUAGE_CODES, readAppLanguage } from './app-languages';
import { getBundledContentTranslation } from './content-i18n';
import { formatCountUnit } from './count-format';

export function getPersistedLanguage(): string {
  return readAppLanguage();
}

/**
 * Module-level translation helper. Works in any scope (utils, callbacks, module-level constants).
 * Reads current language from the Zustand store synchronously (no hook required).
 *
 * For 'az' (default), returns the hardcoded fallback. For other languages, looks up the cached
 * DB translation. If missing, returns the fallback.
 *
 * Note: Components that need to re-render on language change should still subscribe via
 * useUserStore(state => state.language) somewhere in their tree (Dashboard / App handles this globally).
 */
export function tr(key: string, defaultValue: string): string {
  const lang = getPersistedLanguage();
  const val = getCachedTranslation(key, lang);
  return val !== undefined ? val : defaultValue;
}

/** Static interface templates only; values stay local and are never translated. */
export function formatTr(key: string, defaultValue: string, values: Record<string, unknown>): string {
  const counted = formatCountUnit(getPersistedLanguage(), defaultValue, values);
  if (counted !== undefined) return counted;
  return tr(key, defaultValue).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (placeholder, name) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder);
}

/**
 * Maps translatable fields on a database row to the current language.
 * Checks for field_lang first, then field_az, and finally defaults to the base field value.
 */
export function mapRowTranslation<T extends Record<string, any>>(
  row: T | null | undefined,
  language: string,
  fields: string[]
): T | null {
  if (!row) return null;
  const result = { ...row } as any;
  for (const field of fields) {
    let val: any;
    let bundledField = false;
    if (language === 'az') {
      val = row[`${field}_az`] ?? row[field];
    } else if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) {
      const bundled = getBundledContentTranslation(row, field, language);
      bundledField = row[`${field}_${language}`] == null && bundled !== undefined;
      val = row[`${field}_${language}`] ?? bundled
        ?? row[`${field}_en`] ?? row[`${field}_az`] ?? row[field];
    } else if (language === 'kk') {
      // kk üçün ru körpüsü: kk hələ tərcümə olunmayıbsa rus mətn az-dan daha faydalıdır
      val = row[`${field}_kk`] ?? row[`${field}_ru`] ?? row[field] ?? row[`${field}_az`];
    } else if (language === 'uz') {
      // uz üçün ru körpüsü (kk ilə eyni məntiq): Özbəkistanda rus dili geniş
      // başa düşülür — _uz sütunları dolana qədər ru göstərilir
      val = row[`${field}_uz`] ?? row[`${field}_ru`] ?? row[field] ?? row[`${field}_az`];
    } else if (language === 'ka') {
      // ka üçün ru körpüsü: Gürcüstanda böyük nəsil rus dilini yaxşı bilir —
      // _ka sütunları dolana qədər ru göstərilir
      val = row[`${field}_ka`] ?? row[`${field}_ru`] ?? row[field] ?? row[`${field}_az`];
    } else if (language === 'de') {
      // de üçün en körpüsü: de hələ tərcümə olunmayıbsa ingilis mətn az-dan daha faydalıdır
      val = row[`${field}_de`] ?? row[`${field}_en`] ?? row[field] ?? row[`${field}_az`];
    } else if (language === 'ar') {
      // ar üçün en körpüsü
      val = row[`${field}_ar`] ?? row[`${field}_en`] ?? row[field] ?? row[`${field}_az`];
    } else {
      val = row[`${field}_${language}`] ?? row[field] ?? row[`${field}_az`];
    }

    // Safely parse array fields if the translation is stored as a JSON string
    if (Array.isArray(row[field]) && typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        if (val.includes('\n')) {
          val = val.split('\n').map((s: string) => s.trim()).filter(Boolean);
        } else {
          val = row[field]; // fallback to base array
        }
      }
    }

    result[field] = val;
    // Preserve an idempotent locale projection in client caches. A downstream
    // component may request this field again after the base display field changed.
    if (bundledField) result[`${field}_${language}`] = val;
  }
  return result as T;
}

/**
 * Maps translatable fields on an array of database rows to the current language.
 */
export function mapRowsTranslation<T extends Record<string, any>>(
  rows: T[] | null | undefined,
  language: string,
  fields: string[]
): T[] {
  if (!rows) return [];
  return rows.map(row => mapRowTranslation(row, language, fields) as T);
}
