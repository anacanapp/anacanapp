import { compileLexicon, type CompiledLexicon } from './lexicon';
import type { WordLexicon } from './model';
export { isSeededGardenRevision, WORD_GARDEN_UNSEEDED_REVISIONS } from './model';

export const WORD_GARDEN_LIBRARIES: Record<string, { name: string; revision: string; locale: string; words: number; targets: number; load: () => Promise<WordLexicon> }> = {
  az: { name: 'Azərbaycan dili', revision: 'az-202611-v3', locale: 'az-AZ', words: 7745, targets: 5606,
    load: async () => (await import('./data/az.json')).default as WordLexicon },
};
// Newest first: a profile without a current-revision save adopts the newest
// older save. Each published revision keeps its original bytes so unfinished
// rounds reopen with exactly the words they were dealt.
export const WORD_GARDEN_PREVIOUS_REVISIONS: Record<string, string[]> = { az: ['az-202610-v2', 'az-202610-v1'] };
const PUBLISHED_LIBRARIES: Record<string, () => Promise<WordLexicon>> = {
  'az-202610-v1': async () => (await import('./data/az-v1.json')).default as WordLexicon,
  'az-202610-v2': async () => (await import('./data/az-v2.json')).default as WordLexicon,
};
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
    const load = requested === descriptor.revision ? descriptor.load : PUBLISHED_LIBRARIES[requested];
    if (!load) throw new Error('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
    const promise = load().then(data => {
      if (data.revision !== requested || data.locale !== descriptor.locale) throw new Error('WORD_GARDEN_LIBRARY_REVISION_MISMATCH');
      return compileLexicon(data, code);
    }).catch(error => { loading.delete(key); throw error; });
    loading.set(key, promise);
  }
  return loading.get(key)!;
}
