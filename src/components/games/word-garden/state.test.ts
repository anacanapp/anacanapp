import { describe, expect, it } from 'vitest';
import data from './data/az.json';
import { compileLexicon } from './lexicon';
import { generateGardenLevel } from './generator';
import { cellKey, isGardenPlayerSeed, type WordLexicon } from './model';
import { completeGardenLevel, createGardenProfile, createGardenRound, gardenResult, submitGardenWord, revealGardenHint, validGardenRound, visibleGardenCells } from './state';
import { gardenStorageKey, readGardenProfile, writeGardenProfile } from './storage';
import { WORD_GARDEN_LIBRARIES } from './library';

const lexicon = compileLexicon(data as WordLexicon, 'az'), current = WORD_GARDEN_LIBRARIES.az.revision;
// Level 25 of a player whose rack also offers a bonus word (deterministic search).
const level = Array.from({ length: 64 }, (_, seed) => generateGardenLevel(lexicon, 25, 'calm', seed)).find(item => item.bonusWords.length)!;
const start = () => ({ ...createGardenProfile('az', lexicon.data.revision, 'calm'), round: createGardenRound(level),
  progress: { ...createGardenProfile('az', lexicon.data.revision, 'calm').progress, unlockedLevel: 25, bonusClaims: { level: 25, words: [] } } });
describe('Word Garden local progression', () => {
  it('reveals crossing cells, accepts a dictionary bonus and awards it only once across restarts', () => {
    let profile = start();
    const word = level.words[0];
    profile = submitGardenWord(profile, level, word.word).profile;
    expect(visibleGardenCells(level, profile.round!)).toContain(cellKey(word));
    expect(submitGardenWord(profile, level, word.word).decision).toBe('already');
    expect(submitGardenWord(profile, level, 'not-a-word').decision).toBe('invalid');
    expect(level.bonusWords.length).toBeGreaterThan(0);
    const bonus = level.bonusWords[0], first = submitGardenWord(profile, level, bonus);
    expect(first.decision).toBe('bonus');
    expect(first.reward).toBe(5);
    profile = { ...first.profile, round: createGardenRound(level) };
    expect(submitGardenWord(profile, level, bonus).reward).toBe(0);
  });
  it('charges a paid hint only after the free first hint and never charges an already visible cell', () => {
    let profile = start();
    const firstKey = cellKey(level.cells[0]);
    let hint = revealGardenHint(profile, level, firstKey);
    expect(hint.used).toBe(true);
    expect(hint.profile.progress.coins).toBe(75);
    profile = hint.profile;
    expect(revealGardenHint(profile, level, firstKey)).toEqual({ profile, used: false });
    hint = revealGardenHint(profile, level, cellKey(level.cells[1]));
    expect(hint.used).toBe(true);
    expect(hint.profile.progress.coins).toBe(50);
    expect(hint.profile.round!.hintsUsed).toBe(2);
  });
  it('commits a completion once, unlocks the next level and prevents replay reward farming', () => {
    let profile = start();
    expect(completeGardenLevel(profile, level)).toBeNull();
    for (const word of level.words) profile = submitGardenWord(profile, level, word.word).profile;
    const completed = completeGardenLevel(profile, level)!;
    expect(completed.result.stars).toBe(3);
    expect(completed.profile.progress.unlockedLevel).toBe(26);
    expect(completed.reward).toBe(50);
    expect(completeGardenLevel(completed.profile, level)!.reward).toBe(0);
    profile = { ...completed.profile, round: createGardenRound(level) };
    for (const word of level.words) profile = submitGardenWord(profile, level, word.word).profile;
    expect(completeGardenLevel(profile, level)!.reward).toBe(0);
    expect(completeGardenLevel(profile, level)!.profile.progress.totalWords).toBe(level.words.length);
  });
  it('validates a restored round and keeps mode/language/revision storage separate', () => {
    localStorage.clear();
    const profile = start();
    expect(validGardenRound(profile.round, level)).toBe(true);
    expect(validGardenRound({ ...profile.round, found: ['made-up'] }, level)).toBe(false);
    expect(validGardenRound({ ...profile.round, awarded: true }, level)).toBe(false);
    expect(writeGardenProfile(profile)).toBe(true);
    expect(readGardenProfile('az', lexicon.data.revision, 'calm').progress.unlockedLevel).toBe(25);
    expect(readGardenProfile('az', lexicon.data.revision, 'timed').progress.unlockedLevel).toBe(1);
    expect(readGardenProfile('tr', lexicon.data.revision, 'calm').progress.unlockedLevel).toBe(1);
  });
  it('blocks submissions after time expires without changing saved words or hint currency', () => {
    const timed = generateGardenLevel(lexicon, 1, 'timed');
    const profile = { ...createGardenProfile('az', lexicon.data.revision, 'timed'), round: { ...createGardenRound(timed), remainingSeconds: 0 } };
    expect(submitGardenWord(profile, timed, timed.words[0].word).profile).toBe(profile);
    expect(revealGardenHint(profile, timed, cellKey(timed.cells[0])).used).toBe(false);
    expect(Number.isInteger(gardenResult(timed, { ...profile.round, remainingSeconds: 45.7 }).score)).toBe(true);
  });
  it('carries legacy aggregates and an unfinished round into a new revision without deleting the original save', () => {
    for (const legacy of ['az-202610-v1', 'az-202610-v2']) {
      localStorage.clear();
      const old = { ...createGardenProfile('az', legacy, 'calm'), round: {
        ...createGardenRound(level), levelId: `az:${legacy}:calm:25:123`, found: ['alma'] },
        progress: { ...start().progress, coins: 183, totalWords: 67, totalBonusWords: 4, bestScore: 1050 } };
      expect(writeGardenProfile(old)).toBe(true);
      const next = readGardenProfile('az', current, 'calm');
      expect(next.revision).toBe(current); expect(next.progress).toEqual(old.progress); expect(next.round).toEqual(old.round);
      expect(isGardenPlayerSeed(next.seed)).toBe(true);
      expect(writeGardenProfile(next)).toBe(true);
      const reread = readGardenProfile('az', current, 'calm');
      expect(reread.round).toEqual(old.round); expect(reread.seed).toBe(next.seed);
      expect(readGardenProfile('az', legacy, 'calm')).toEqual(old);
    }
  });
  it('creates one bounded per-player seed for the seeded revision and keeps it across reloads', () => {
    localStorage.clear();
    const fresh = readGardenProfile('az', current, 'timed');
    expect(isGardenPlayerSeed(fresh.seed)).toBe(true);
    // Merely opening the lobby does not write; the first progress write stores the seed.
    expect(localStorage.getItem(gardenStorageKey('az', current, 'timed'))).toBeNull();
    expect(writeGardenProfile({ ...fresh, round: createGardenRound(generateGardenLevel(lexicon, 1, 'timed', fresh.seed)) })).toBe(true);
    const reread = readGardenProfile('az', current, 'timed');
    expect(reread.seed).toBe(fresh.seed);
    expect(validGardenRound(reread.round, generateGardenLevel(lexicon, 1, 'timed', reread.seed))).toBe(true);
    expect(JSON.stringify(reread).length).toBeLessThan(2000);
    // Published revisions are dealt without a player seed.
    expect(readGardenProfile('az', 'az-202610-v2', 'timed').seed).toBeUndefined();
    localStorage.setItem(gardenStorageKey('az', current, 'calm'), JSON.stringify({ ...createGardenProfile('az', current, 'calm'), seed: -5 }));
    expect(isGardenPlayerSeed(readGardenProfile('az', current, 'calm').seed)).toBe(true);
  });
});
