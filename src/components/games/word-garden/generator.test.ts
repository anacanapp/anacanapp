import { describe, expect, it } from 'vitest';
import data from './data/az.json';
import { compileLexicon, displayGardenWord, normalizeGardenWord, wordsFromRack } from './lexicon';
import { generateGardenLevel, validateGardenLevel } from './generator';
import type { WordLexicon } from './model';
import { hasWordGardenLibrary, loadGardenLexicon } from './library';

const lexicon = compileLexicon(data as WordLexicon, 'az');
describe('dictionary-driven Word Garden', () => {
  it('preserves Azerbaijani letters and repeated-letter counts', () => {
    expect(displayGardenWord('işıq', 'az-AZ')).toBe('İŞIQ');
    expect(normalizeGardenWord('İŞIQ', lexicon.data)).toBe('işıq');
    expect(normalizeGardenWord('ALMA!', lexicon.data)).toBeNull();
    expect(wordsFromRack(lexicon, ['a', 'l', 'm', 'a']).map(word => word.word)).toContain('alma');
    expect(wordsFromRack(lexicon, ['a', 'l', 'm']).map(word => word.word)).not.toContain('alma');
    expect(() => compileLexicon(data as WordLexicon, 'en')).toThrow('WORD_GARDEN_LEXICON_INVALID');
  });
  it('generates connected, dictionary-valid and reproducible puzzles beyond a fixed catalog', () => {
    const samples = [1, 2, 3, 10, 11, 20, 40, 41, 100, 101, 220, 221, 1000, 10000, 1000000, 2147483647];
    for (const mode of ['calm', 'timed'] as const) for (const level of samples) {
      const puzzle = generateGardenLevel(lexicon, level, mode);
      expect(validateGardenLevel(puzzle, lexicon), `${mode} ${level}`).toBe(true);
      expect(generateGardenLevel(lexicon, level, mode)).toEqual(puzzle);
      expect(puzzle.timeLimit === null).toBe(mode === 'calm');
    }
    const variants = Array.from({ length: 60 }, (_, index) => generateGardenLevel(lexicon, 221 + index));
    expect(new Set(variants.map(puzzle => puzzle.words.map(word => word.word).sort().join(','))).size).toBeGreaterThan(30);
  }, 30000);
  it('keeps other languages unavailable instead of substituting Azerbaijani puzzles', async () => {
    expect(hasWordGardenLibrary('az-AZ')).toBe(true);
    expect(hasWordGardenLibrary('en')).toBe(false);
    await expect(loadGardenLexicon('en')).rejects.toThrow('WORD_GARDEN_LANGUAGE_NOT_AVAILABLE');
  });
  it('deals distinct beginner puzzles and avoids adjacent repeated answers through every difficulty tier', () => {
    for (const mode of ['calm', 'timed'] as const) {
      const levels = Array.from({ length: 240 }, (_, index) => generateGardenLevel(lexicon, index + 1, mode));
      expect(new Set(levels.slice(0, 20).map(level => level.words.map(word => word.word).sort().join('|'))).size).toBe(20);
      for (let index = 1; index < levels.length; index++) {
        const previous = new Set(levels[index - 1].words.map(word => word.word));
        expect(levels[index].words.some(word => previous.has(word.word)), `${mode} ${index + 1}`).toBe(false);
      }
      expect(levels[0].words[0].word).toBe('alma');
      expect(levels[1].words[0].word).toBe('işıq');
      expect(lexicon.targets.length).toBeGreaterThan(2900);
    }
  }, 30000);
  it('budgets a short timed challenge for the actual word load instead of several minutes', () => {
    const samples = [1, 2, 11, 41, 101, 221].map(level => generateGardenLevel(lexicon, level, 'timed'));
    expect(samples[0].timeLimit).toBeGreaterThanOrEqual(25); expect(samples[0].timeLimit).toBeLessThanOrEqual(35);
    for (const sample of samples) {
      expect(sample.timeLimit).toBeGreaterThanOrEqual(25); expect(sample.timeLimit).toBeLessThanOrEqual(100);
    }
    expect(samples[2].timeLimit).toBeGreaterThan(samples[0].timeLimit!);
    expect(samples[3].timeLimit).toBeGreaterThan(samples[2].timeLimit!);
    expect(samples[4].timeLimit).toBeGreaterThan(samples[3].timeLimit!);
    expect(samples[5].timeLimit).toBeGreaterThan(samples[4].timeLimit!);
  });
});
