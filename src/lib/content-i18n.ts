import { NEW_LANGUAGE_CODES, normalizeAppLanguage } from './app-languages';
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';

export interface ContentBundle {
  schema: 'anacan-content-translations-v1';
  language: string;
  sourceHash: string;
  values: Record<string, unknown>;
}
const loaders = import.meta.glob<ContentBundle>('../../scripts/i18n/content/*.json', { import: 'default' });
export function createContentTranslationCache(load: Record<string, () => Promise<ContentBundle>>) {
  const bundles = new Map<string, Record<string, unknown>>();
  const pending = new Map<string, Promise<void>>();

/** Public, source-bound catalog translations ship with the app, so the same
 * release also localizes an older Source schema without network translation. */
async function ensure(language: string): Promise<void> {
  language = normalizeAppLanguage(language);
  if (!(NEW_LANGUAGE_CODES as readonly string[]).includes(language) || bundles.has(language)) return;
  if (pending.has(language)) return pending.get(language);
  const loader = load[`../../scripts/i18n/content/${language}.json`];
  if (!loader) throw new Error('BUNDLED_CONTENT_LANGUAGE_MISSING');
  const operation = loader().then(bundle => {
    if (bundle.schema !== 'anacan-content-translations-v1' || bundle.language !== language
      || !/^[a-f0-9]{64}$/.test(bundle.sourceHash) || !bundle.values || typeof bundle.values !== 'object'
      || Array.isArray(bundle.values) || !Object.keys(bundle.values).length) throw new Error('BUNDLED_CONTENT_LANGUAGE_INVALID');
    bundles.set(language, bundle.values);
  }).finally(() => pending.delete(language));
  pending.set(language, operation);
  return operation;
}

function lookup(row: Record<string, unknown>, field: string, language: string): unknown {
  const bundle = bundles.get(normalizeAppLanguage(language));
  if (!bundle) return undefined;
  const key = contentTranslationKey(row, field);
  return key && Object.prototype.hasOwnProperty.call(bundle, key) ? bundle[key] : undefined;
}
  return { ensure, lookup };
}
const catalog = createContentTranslationCache(loaders);
export const ensureContentLanguageReady = catalog.ensure;
export const getBundledContentTranslation = catalog.lookup;
