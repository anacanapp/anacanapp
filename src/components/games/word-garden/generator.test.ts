import { describe, expect, it } from 'vitest';
import data from './data/az.json';
import dataV2 from './data/az-v2.json';
import editorial from '../../../../scripts/word-garden/az-editorial-v3.json';
import { compileLexicon, displayGardenWord, normalizeGardenWord, wordsFromRack } from './lexicon';
import { generateGardenLevel, validateGardenLevel } from './generator';
import type { WordGardenLevel, WordLexicon } from './model';
import { hasWordGardenLibrary, loadGardenLexicon, WORD_GARDEN_LIBRARIES } from './library';

const lexicon = compileLexicon(data as WordLexicon, 'az');
const lexiconV2 = compileLexicon(dataV2 as WordLexicon, 'az');
const answers = (level: WordGardenLevel) => level.words.map(word => word.word);
const sequence = (seed: number, count: number, mode: 'calm' | 'timed' = 'calm', from = 1) =>
  Array.from({ length: count }, (_, index) => generateGardenLevel(lexicon, from + index, mode, seed));
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
      const puzzle = generateGardenLevel(lexicon, level, mode, 4242);
      expect(validateGardenLevel(puzzle, lexicon), `${mode} ${level}`).toBe(true);
      expect(generateGardenLevel(lexicon, level, mode, 4242)).toEqual(puzzle);
      expect(puzzle.timeLimit === null).toBe(mode === 'calm');
    }
    const variants = sequence(4242, 60, 'calm', 221);
    expect(new Set(variants.map(puzzle => answers(puzzle).sort().join(','))).size).toBe(60);
  }, 60000);
  it('ships a larger reviewed Azerbaijani v3 library without dropping any published word', () => {
    expect(lexicon.data.revision).toBe(WORD_GARDEN_LIBRARIES.az.revision);
    expect(lexicon.words.size).toBe(WORD_GARDEN_LIBRARIES.az.words);
    expect(lexicon.targets.length).toBe(WORD_GARDEN_LIBRARIES.az.targets);
    expect(lexicon.targets.length).toBeGreaterThan(lexiconV2.targets.length * 1.9);
    for (const word of lexiconV2.words.keys()) expect(lexicon.words.has(word), word).toBe(true);
    const targetsByLength = (value: typeof lexicon) => value.targets.reduce<Record<number, number>>((counts, word) =>
      ({ ...counts, [word.letters.length]: (counts[word.letters.length] || 0) + 1 }), {});
    const now = targetsByLength(lexicon), before = targetsByLength(lexiconV2);
    for (let length = 3; length <= 8; length++) expect(now[length], `length ${length}`).toBeGreaterThan(before[length]);
    for (let length = 5; length <= 8; length++) expect(now[length], `length ${length}`).toBeGreaterThan(before[length] * 1.7);
    // Editorial lists are Azerbaijani Latin lemmas, never other scripts/languages.
    const listed = [...editorial.commonWords, ...editorial.standardWords].join(' ').split(/\s+/);
    for (const word of listed) expect(lexicon.words.get(word)?.tier, word).not.toBe('bonus');
    for (const word of [...editorial.demoteToBonus, ...editorial.corpusPromotion.keepBonus].join(' ').split(/\s+/)) {
      expect(lexicon.words.get(word)?.tier ?? 'bonus', word).toBe('bonus');
    }
  });
  it('deals each player a reproducible sequence that differs from other players', () => {
    const first = sequence(1, 40), again = sequence(1, 40), other = sequence(2, 40), third = sequence(0xFFFFFFFF, 40);
    expect(again).toEqual(first);
    const differing = (a: WordGardenLevel[], b: WordGardenLevel[]) => a.filter((level, index) => answers(level).sort().join() !== answers(b[index]).sort().join()).length;
    expect(differing(first, other)).toBeGreaterThan(30);
    expect(differing(first, third)).toBeGreaterThan(30);
    expect(first[0].id).not.toBe(other[0].id);
    for (const level of [first[0], other[0], third[0]]) expect(validateGardenLevel(level, lexicon)).toBe(true);
    expect(generateGardenLevel(lexicon, 5000, 'timed', 2)).toEqual(generateGardenLevel(lexicon, 5000, 'timed', 2));
    expect(() => generateGardenLevel(lexicon, 1, 'calm', -1)).toThrow('WORD_GARDEN_PLAYER_SEED_INVALID');
    // Published v1/v2 rounds ignore the player seed so saved puzzles reopen unchanged.
    expect(generateGardenLevel(lexiconV2, 7, 'calm', 99)).toEqual(generateGardenLevel(lexiconV2, 7, 'calm'));
  }, 60000);
  it('does not repeat a rack or recent answer and spreads words across a long run', () => {
    for (const mode of ['calm', 'timed'] as const) {
      const levels = sequence(31337, 400, mode);
      // Every rack (and so every longest word) is new until its tier's pool is exhausted.
      const racks = levels.map(level => [...level.letters].sort().join(''));
      expect(new Set(racks.slice(0, 220)).size, mode).toBe(220);
      expect(new Set(racks.slice(220)).size, mode).toBe(180);
      const last = new Map<string, number>();
      let repeated = 0;
      levels.forEach((level, index) => {
        expect(validateGardenLevel(level, lexicon), `${mode} ${index + 1}`).toBe(true);
        for (const word of answers(level)) {
          // An answer may only return after the unused words fitting its rack ran out,
          // and never within the next few puzzles.
          if (last.has(word)) { repeated++; expect(index - last.get(word)!, `${mode} ${word}@${index + 1}`).toBeGreaterThan(2); }
          last.set(word, index);
        }
      });
      const total = levels.reduce((sum, level) => sum + level.words.length, 0);
      expect(last.size / total, mode).toBeGreaterThan(0.6);
      expect(repeated).toBe(total - last.size);
    }
  }, 60000);
  it('keeps other languages unavailable instead of substituting Azerbaijani puzzles', async () => {
    expect(hasWordGardenLibrary('az-AZ')).toBe(true);
    expect(hasWordGardenLibrary('en')).toBe(false);
    await expect(loadGardenLexicon('en')).rejects.toThrow('WORD_GARDEN_LANGUAGE_NOT_AVAILABLE');
  });
  it('keeps the published v2 curriculum: distinct beginner puzzles, no adjacent repeated answers', () => {
    for (const mode of ['calm', 'timed'] as const) {
      const levels = Array.from({ length: 240 }, (_, index) => generateGardenLevel(lexiconV2, index + 1, mode));
      expect(new Set(levels.slice(0, 20).map(level => level.words.map(word => word.word).sort().join('|'))).size).toBe(20);
      for (let index = 1; index < levels.length; index++) {
        const previous = new Set(levels[index - 1].words.map(word => word.word));
        expect(levels[index].words.some(word => previous.has(word.word)), `${mode} ${index + 1}`).toBe(false);
      }
      expect(levels[0].words[0].word).toBe('alma');
      expect(levels[1].words[0].word).toBe('işıq');
      expect(lexiconV2.targets.length).toBe(2921);
    }
  }, 30000);
  it('budgets a short timed challenge for the actual word load instead of several minutes', () => {
    const samples = [1, 2, 11, 41, 101, 221].map(level => generateGardenLevel(lexicon, level, 'timed', 77));
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
