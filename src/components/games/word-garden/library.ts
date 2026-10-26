import { compileLexicon, type CompiledLexicon } from './lexicon';
import type { WordLexicon } from './model';

export const WORD_GARDEN_LIBRARIES: Record<string, { name: string; revision: string; locale: string; words: number; targets: number; load: () => Promise<WordLexicon> }> = {
  az: { name: 'Azərbaycan dili', revision: 'az-202610-v2', locale: 'az-AZ', words: 6857, targets: 2921,
    load: async () => (await import('./data/az.json')).default as WordLexicon },
};
export const WORD_GARDEN_PREVIOUS_REVISIONS: Record<string, string[]> = { az: ['az-202610-v1'] };
export function wordGardenLanguage(language: string): string {
  return language.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
}
export const hasWordGardenLibrary = (language: string) => Object.prototype.hasOwnProperty.call(WORD_GARDEN_LIBRARIES, wordGardenLanguage(language));
const loading = new Map<string, Promise<CompiledLexicon>>();
export async function loadGardenLexicon(language: string, revision?: string): Promise<CompiledLexicon> {
  const code = wordGardenLanguage(language), descriptor = WORD_GARDEN_LIBRARIES[code];
  if (!descriptor) throw new Error('WORD_GARDEN_LANGUAGE_NOT_AVAILABLE');
  const requested = revision || descriptor.revision, key = `${code}:${requested}`;
  if (requested !== descriptor.revision && !WORD_GARDEN_PREVIOUS_REVISIONS[code]?.includes(requested)) throw new Error('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
  if (!loading.has(key)) {
    const load = requested === 'az-202610-v1' ? async () => (await import('./data/az-v1.json')).default as WordLexicon : descriptor.load;
    const promise = load().then(data => {
      if (data.revision !== requested || data.locale !== descriptor.locale) throw new Error('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
      return compileLexicon(data, code);
    }).catch(error => { loading.delete(key); throw error; });
    loading.set(key, promise);
  }
  return loading.get(key)!;
}
