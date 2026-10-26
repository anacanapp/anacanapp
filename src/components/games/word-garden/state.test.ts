import { describe, expect, it } from 'vitest';
import data from './data/az.json';
import { compileLexicon } from './lexicon';
import { generateGardenLevel } from './generator';
import { cellKey, type WordLexicon } from './model';
import { completeGardenLevel, createGardenProfile, createGardenRound, gardenResult, submitGardenWord, revealGardenHint, validGardenRound, visibleGardenCells } from './state';
import { readGardenProfile, writeGardenProfile } from './storage';

const lexicon = compileLexicon(data as WordLexicon, 'az');
const level = generateGardenLevel(lexicon, 25);
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
    localStorage.clear();
    const old = { ...createGardenProfile('az', 'az-202610-v1', 'calm'), round: {
      ...createGardenRound(level), levelId: 'az:az-202610-v1:calm:25:123', found: ['alma'] },
      progress: { ...start().progress, coins: 183, totalWords: 67, totalBonusWords: 4, bestScore: 1050 } };
    expect(writeGardenProfile(old)).toBe(true);
    const next = readGardenProfile('az', 'az-202610-v2', 'calm');
    expect(next.revision).toBe('az-202610-v2'); expect(next.progress).toEqual(old.progress); expect(next.round).toEqual(old.round);
    expect(writeGardenProfile(next)).toBe(true);
    expect(readGardenProfile('az', 'az-202610-v2', 'calm').round).toEqual(old.round);
    expect(readGardenProfile('az', 'az-202610-v1', 'calm')).toEqual(old);
  });
});
