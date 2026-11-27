import { mulberry32 } from './setup';
import data from '@/components/games/word-garden/data/az.json';
import dataV2 from '@/components/games/word-garden/data/az-v2.json';
import dataV1 from '@/components/games/word-garden/data/az-v1.json';
import { compileLexicon, normalizeGardenWord, wordsFromRack, displayGardenWord } from '@/components/games/word-garden/lexicon';
import { generateGardenLevel, validateGardenLevel, gardenSeed, gardenRandom, shuffleLetters } from '@/components/games/word-garden/generator';
import { completeGardenLevel, createGardenProfile, createGardenRound, gardenResult, revealGardenHint, submitGardenWord, validGardenRound, visibleGardenCells } from '@/components/games/word-garden/state';
import { gardenStorageKey, readGardenPreferences, readGardenProfile, writeGardenProfile } from '@/components/games/word-garden/storage';
import { cellKey, gardenTimeLimit, getGardenLevelProfile, type WordGardenLevel, type WordLexicon, type GardenProfile } from '@/components/games/word-garden/model';
import { selectWheelLetter, wheelPoints, crossedLetters } from '@/components/games/word-garden/wheel';
import { gardenText, WORD_GARDEN_MESSAGES } from '@/components/games/word-garden/messages';

export const messages = () => WORD_GARDEN_MESSAGES;

// Deterministic player seed for adoption fixtures (the real app uses crypto.getRandomValues).
Object.defineProperty(globalThis.crypto, 'getRandomValues', { configurable: true, value: (array: Uint32Array) => { array[0] = 123456789; return array; } });

const lexicons = () => ({
  v3: compileLexicon(data as WordLexicon, 'az'),
  v2: compileLexicon(dataV2 as WordLexicon, 'az'),
  v1: compileLexicon(dataV1 as WordLexicon, 'az'),
});
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

export function primitives() {
  const strings = ['', 'a', 'az:az-202611-v3:calm:1', 'işıq', 'ƏĞÖÜÇŞ', '😀x', 'az-202610-v2:timed:racks'];
  const random = gardenRandom(gardenSeed('fixture'));
  const big = gardenRandom(0xFFFFFFFF);
  const shuffled = shuffleLetters(range(0, 19), gardenRandom(42));
  return {
    seeds: strings.map(value => ({ value, seed: gardenSeed(value) })),
    random: Array.from({ length: 20 }, () => random()),
    randomBig: Array.from({ length: 20 }, () => big()),
    shuffled,
    profiles: [1, 10, 11, 40, 41, 100, 101, 220, 221, 222, 2147483647].map(level => ({ level, ...getGardenLevelProfile(level) })),
    timeLimits: [[[3, 3], 4, 1], [[4, 3, 3, 5], 5, 2], [[8, 7, 6, 5, 4, 3, 3, 4], 8, 5], [[3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 8, 5]]
      .map(([lengths, rack, difficulty]) => ({ lengths, rack, difficulty,
        value: gardenTimeLimit((lengths as number[]).map(length => ({ letters: Array(length).fill('a') })), rack as number, difficulty as 1) })),
    display: ['işıq', 'ılıq', 'çəkic'].map(word => ({ word, upper: displayGardenWord(word, 'az-AZ') })),
    normalize: ['İŞIQ', 'ALMA!', 'Işıq', 'ÇƏKİC', 'abc1'].map(word => ({ word, normalized: normalizeGardenWord(word, data as WordLexicon) })),
    wheel: { select: [[[], 0], [[0], 0], [[0, 1], 0], [[0, 1, 2], 1], [[0, 1], 2], [[0, 1, 2], 0]].map(([selected, index]) => ({ selected, index, result: selectWheelLetter(selected as number[], index as number) })),
      points: [4, 5, 7].map(count => wheelPoints(count)),
      crossed: [[{ x: 150, y: 45 }, { x: 150, y: 255 }, 6], [{ x: 50, y: 150 }, { x: 250, y: 150 }, 4], [{ x: 150, y: 45 }, { x: 150, y: 45 }, 5]]
        .map(([from, to, count]) => ({ from, to, count, result: crossedLetters(from as { x: number; y: number }, to as { x: number; y: number }, wheelPoints(count as number)) })) },
  };
}

export function lexiconStats() {
  const all = lexicons();
  return Object.fromEntries(Object.entries(all).map(([name, lexicon]) => [name, {
    revision: lexicon.data.revision, words: lexicon.words.size, targets: lexicon.targets.length, signatures: lexicon.bySignature.size,
    rack: ['a', 'l', 'm', 'a', 'r', 'ı'].length && wordsFromRack(lexicon, ['a', 'l', 'm', 'a', 'r', 'ı']).map(word => word.word),
  }]));
}

export function levels(which: 'v3' | 'v2' | 'v1') {
  const lexicon = lexicons()[which];
  const out: { mode: string; seed: number; level: number; puzzle: WordGardenLevel; valid: boolean }[] = [];
  const add = (mode: 'calm' | 'timed', seed: number, level: number) => {
    const puzzle = generateGardenLevel(lexicon, level, mode, seed);
    out.push({ mode, seed, level, puzzle, valid: validateGardenLevel(puzzle, lexicon) });
  };
  if (which === 'v3') {
    for (const mode of ['calm', 'timed'] as const) for (const level of [...range(1, 50), 60, 100, 101, 150, 220, 221, 222, 300, 1000, 10000, 1000000, 2147483647]) add(mode, 4242, level);
    for (const level of [...range(1, 12), 41, 221, 5000]) add('calm', 1, level);
    for (const level of [1, 2, 101, 230]) add('timed', 0xFFFFFFFF, level);
  } else {
    for (const mode of ['calm', 'timed'] as const) for (const level of [...range(1, 50), 100, 101, 220, 221, 500, 10000, 2147483647]) add(mode, 0, level);
  }
  return out;
}

export function play() {
  const { v3, v2 } = lexicons();
  const scenarios: { name: string; level: WordGardenLevel }[] = [
    { name: 'v3-25-bonus', level: Array.from({ length: 64 }, (_, seed) => generateGardenLevel(v3, 25, 'calm', seed)).find(item => item.bonusWords.length)! },
    { name: 'v3-1-timed', level: generateGardenLevel(v3, 1, 'timed', 4242) },
    { name: 'v3-221-calm', level: generateGardenLevel(v3, 221, 'calm', 77) },
    { name: 'v2-7-timed', level: generateGardenLevel(v2, 7, 'timed') },
  ];
  return scenarios.map(({ name, level }) => {
    const base = createGardenProfile('az', level.revision, level.mode);
    let profile: GardenProfile = { ...base, round: createGardenRound(level),
      progress: { ...base.progress, unlockedLevel: level.level, bonusClaims: { level: level.level, words: [] } } };
    const steps: unknown[] = [];
    const submit = (word: string) => { const result = submitGardenWord(profile, level, word); profile = result.profile; steps.push({ op: 'submit', word, decision: result.decision, reward: result.reward, profile }); };
    const hint = (key: string) => { const result = revealGardenHint(profile, level, key); profile = result.profile; steps.push({ op: 'hint', key, used: result.used, profile }); };
    submit('zzz'); submit('ab');
    if (level.bonusWords.length) { submit(level.bonusWords[0]); submit(level.bonusWords[0]); }
    const hidden = level.cells.map(cellKey);
    hint(hidden[0]); hint(hidden[0]); hint(hidden[hidden.length - 1]); hint('99:99');
    for (const word of level.words.slice(0, -1)) submit(word.word);
    steps.push({ op: 'visible', cells: [...visibleGardenCells(level, profile.round!)] });
    steps.push({ op: 'complete-early', result: completeGardenLevel(profile, level) });
    submit(level.words[level.words.length - 1].word);
    const done = completeGardenLevel(profile, level)!;
    steps.push({ op: 'complete', result: done.result, reward: done.reward, profile: done.profile });
    profile = done.profile;
    const again = completeGardenLevel(profile, level)!;
    steps.push({ op: 'complete-again', reward: again.reward });
    const timed = { ...profile.round!, remainingSeconds: level.mode === 'timed' ? 45.7 : null };
    return { name, level, steps,
      resultTimed: gardenResult(level, timed),
      validRound: validGardenRound(profile.round, level), validBad: validGardenRound({ ...profile.round, found: ['made-up'] }, level),
      validFresh: validGardenRound(createGardenRound(level), level) };
  });
}

export function storage() {
  const current = 'az-202611-v3';
  const { v3 } = lexicons();
  const level = generateGardenLevel(v3, 25, 'calm', 9);
  const make = (revision: string, mode: 'calm' | 'timed', extra: Partial<GardenProfile> = {}) => ({ ...createGardenProfile('az', revision, mode), ...extra });
  const cases: { name: string; key: string; raw: string | null; read: { language: string; revision: string; mode: 'calm' | 'timed' }; others?: Record<string, string> }[] = [];
  const legacyRound = { ...createGardenRound(level), levelId: 'az:az-202610-v1:calm:25:123', found: ['alma'] };
  const legacyProgress = { unlockedLevel: 25, coins: 183, totalWords: 67, totalBonusWords: 4, bestScore: 1050, levels: { 3: { stars: 2, bestScore: 410 }, 24: { stars: 3, bestScore: 990 } }, bonusClaims: { level: 25, words: ['ala'] } };
  cases.push({ name: 'v1-adopted', key: gardenStorageKey('az', 'az-202610-v1', 'calm'), raw: JSON.stringify(make('az-202610-v1', 'calm', { round: legacyRound, progress: legacyProgress } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'v2-adopted-awarded', key: gardenStorageKey('az', 'az-202610-v2', 'timed'), raw: JSON.stringify(make('az-202610-v2', 'timed', { round: { ...legacyRound, levelId: 'az:az-202610-v2:timed:25:9', awarded: true }, progress: legacyProgress, seed: 5 } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'timed' } });
  cases.push({ name: 'v1-read-directly', key: gardenStorageKey('az', 'az-202610-v1', 'calm'), raw: JSON.stringify(make('az-202610-v1', 'calm', { round: legacyRound, progress: legacyProgress } as Partial<GardenProfile>)), read: { language: 'az', revision: 'az-202610-v1', mode: 'calm' } });
  cases.push({ name: 'v3-with-seed', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 4294967295, round: createGardenRound(level), progress: legacyProgress } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'v3-bad-seed', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: -5 } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'v3-fresh', key: gardenStorageKey('az', current, 'timed'), raw: null, read: { language: 'az', revision: current, mode: 'timed' } });
  cases.push({ name: 'v2-fresh-no-seed', key: gardenStorageKey('az', 'az-202610-v2', 'timed'), raw: null, read: { language: 'az', revision: 'az-202610-v2', mode: 'timed' } });
  cases.push({ name: 'wrong-mode', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'timed', { seed: 1 } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'bad-level-key', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 1, progress: { ...legacyProgress, levels: { x: { stars: 1, bestScore: 1 } } } } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'bad-stars', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 1, progress: { ...legacyProgress, levels: { 3: { stars: 4, bestScore: 1 } } } } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'foreign-round', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 1, round: { ...legacyRound, levelId: 'az:az-202611-v3:timed:1:1' } } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'round-too-many-found', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 1, round: { ...legacyRound, levelId: 'az:az-202611-v3:calm:1:1', found: Array(9).fill('a') } } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'garbage', key: gardenStorageKey('az', current, 'calm'), raw: '{bad', read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'float-coins', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify(make(current, 'calm', { seed: 1, progress: { ...legacyProgress, coins: 1.5 } } as Partial<GardenProfile>)), read: { language: 'az', revision: current, mode: 'calm' } });
  cases.push({ name: 'tr-language', key: gardenStorageKey('tr', current, 'calm'), raw: null, read: { language: 'tr', revision: current, mode: 'calm' } });
  cases.push({ name: 'extra-fields', key: gardenStorageKey('az', current, 'calm'), raw: JSON.stringify({ ...make(current, 'calm', { seed: 7 } as Partial<GardenProfile>), future: { a: 1 } }), read: { language: 'az', revision: current, mode: 'calm' } });
  const results = cases.map(item => {
    localStorage.clear();
    if (item.raw !== null) localStorage.setItem(item.key, item.raw);
    const profile = readGardenProfile(item.read.language, item.read.revision, item.read.mode);
    writeGardenProfile(profile);
    return { ...item, profile, rewritten: localStorage.getItem(gardenStorageKey(profile.language, profile.revision, profile.mode)) };
  });
  const prefs = [null, '{"sound":true,"haptics":false,"highContrast":1,"reducedMotion":true,"theme":"night"}', '{"theme":"ocean"}', 'bad', 'null', '{}']
    .map(raw => { localStorage.clear(); if (raw !== null) localStorage.setItem('anacan_word_garden_preferences_v1', raw); return { raw, value: readGardenPreferences() }; });
  return { cases: results, preferences: prefs };
}

export function text() {
  return [['title', {}], ['level', { level: 7 }], ['hintPrice', { count: 25 }], ['letterLabel', { letter: 'Ə', number: 3 }], ['level', {}]]
    .map(([key, values]) => ({ key, values, text: gardenText('az', key as 'title', values as Record<string, string>) }));
}

export { mulberry32 };
