import type { WordLexicon, LexiconWord } from './model';

export interface CompiledWord extends LexiconWord { letters: string[]; signature: string }
export interface CompiledLexicon { data: WordLexicon; words: Map<string, CompiledWord>; bySignature: Map<string, CompiledWord[]>; targets: CompiledWord[] }
interface GraphemeSegmenter { segment(value: string): Iterable<{ segment: string }> }
const segmenters = new Map<string, GraphemeSegmenter>();
export function splitLetters(value: string, locale = 'az-AZ'): string[] {
  const normalized = value.normalize('NFC');
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: string }) => { segment(value: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Segmenter) return Array.from(normalized);
  if (!segmenters.has(locale)) segmenters.set(locale, new Segmenter(locale, { granularity: 'grapheme' }));
  return [...segmenters.get(locale)!.segment(normalized)].map(item => item.segment);
}
export function normalizeGardenWord(value: string, data: Pick<WordLexicon, 'locale' | 'alphabet'>): string | null {
  const word = value.normalize('NFC').toLocaleLowerCase(data.locale);
  const letters = splitLetters(word, data.locale);
  return letters.length && letters.every(letter => data.alphabet.includes(letter)) ? word : null;
}
export const displayGardenWord = (value: string, locale: string) => value.toLocaleUpperCase(locale);
export const letterSignature = (letters: readonly string[]) => [...letters].sort().join('|');
export function canSpellWord(letters: readonly string[], word: readonly string[]): boolean {
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) || 0) + 1);
  for (const letter of word) {
    if (!counts.get(letter)) return false;
    counts.set(letter, counts.get(letter)! - 1);
  }
  return true;
}
export function compileLexicon(data: WordLexicon, language: string): CompiledLexicon {
  if (data.schema !== 'anacan-word-garden-lexicon-v1' || data.language !== language || !data.revision
    || !Array.isArray(data.alphabet) || data.alphabet.length < 10 || !Array.isArray(data.words) || data.words.length < 3) throw new Error('WORD_GARDEN_LEXICON_INVALID');
  const words = new Map<string, CompiledWord>(), bySignature = new Map<string, CompiledWord[]>();
  for (const entry of data.words) {
    const normalized = normalizeGardenWord(entry.word, data), letters = splitLetters(entry.word, data.locale);
    if (!normalized || normalized !== entry.word || letters.length < data.minLength || letters.length > data.maxLength
      || words.has(normalized) || !Number.isFinite(entry.frequency) || !['common', 'standard', 'bonus'].includes(entry.tier)) throw new Error('WORD_GARDEN_LEXICON_ENTRY_INVALID');
    const word = { ...entry, letters, signature: letterSignature(letters) };
    words.set(normalized, word);
    bySignature.set(word.signature, [...(bySignature.get(word.signature) || []), word]);
  }
  const targets = [...words.values()].filter(word => word.tier !== 'bonus');
  return { data, words, bySignature, targets };
}
export function wordsFromRack(lexicon: CompiledLexicon, letters: readonly string[]): CompiledWord[] {
  const signatures = new Set<string>(), found = new Map<string, CompiledWord>();
  for (let mask = 1; mask < 2 ** letters.length; mask++) {
    const chosen = letters.filter((_, index) => mask & 2 ** index);
    if (chosen.length < lexicon.data.minLength) continue;
    const signature = letterSignature(chosen);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    for (const word of lexicon.bySignature.get(signature) || []) found.set(word.word, word);
  }
  return [...found.values()];
}
