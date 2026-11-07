import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_PARENTING, FREE_PROGRAMME_DAYS, MAX_MONTHS, ageBandFor, canCompleteToday, checkpointFor, completeDay, dailyTipIndex,
  homeTipFor, isDayLocked, isFinished, isParentingHomeCardVisible, isParentingTileVisible, milestoneResult, nextDayIndex, progressPercent, readParenting, readingMinutes,
  startProgramme, storageKey, styleResult, styleScores, toggleSaved, undoLastDay, writeParenting,
} from './parenting';
import type { MilestoneCheckpoint, StyleDimension } from '@/data/parenting/types';

const NOW = new Date(2026, 10, 7, 10);

describe('Tərbiyə tile visibility', () => {
  const base = { lifeStage: 'mommy', language: 'az', setting: 'on', birthDate: '2024-07-01', now: NOW };

  it('shows for an Azerbaijani-language mother with the switch on', () => {
    expect(isParentingTileVisible(base)).toBe(true);
  });

  it('is hidden while the admin switch is off or missing', () => {
    expect(isParentingTileVisible({ ...base, setting: 'off' })).toBe(false);
    expect(isParentingTileVisible({ ...base, setting: undefined })).toBe(false);
    expect(isParentingTileVisible({ ...base, setting: true })).toBe(false);
  });

  it('is shown only for the Azerbaijani app language (content is az only)', () => {
    for (const language of ['en', 'tr', 'ru', 'ky', 'et', '', null]) {
      expect(isParentingTileVisible({ ...base, language })).toBe(false);
    }
  });

  it('is shown only in the Ana module, never in flow, bump or partner', () => {
    for (const lifeStage of ['flow', 'bump', 'partner', null]) {
      expect(isParentingTileVisible({ ...base, lifeStage })).toBe(false);
    }
  });

  it('covers children up to 12 years and stays visible when the birth date is unknown', () => {
    expect(isParentingTileVisible({ ...base, birthDate: '2026-11-01' })).toBe(true);
    expect(isParentingTileVisible({ ...base, birthDate: '2013-11-08' })).toBe(true); // 12 years 11 months
    expect(isParentingTileVisible({ ...base, birthDate: '2013-11-07' })).toBe(false); // 13 today
    expect(isParentingTileVisible({ ...base, birthDate: null })).toBe(true);
  });
});

describe('age bands', () => {
  it('maps months to the four bands', () => {
    expect(ageBandFor(0)).toBe('0-1');
    expect(ageBandFor(11)).toBe('0-1');
    expect(ageBandFor(12)).toBe('1-3');
    expect(ageBandFor(35)).toBe('1-3');
    expect(ageBandFor(36)).toBe('3-6');
    expect(ageBandFor(71)).toBe('3-6');
    expect(ageBandFor(72)).toBe('6-12');
    expect(ageBandFor(MAX_MONTHS - 1)).toBe('6-12');
    expect(ageBandFor(MAX_MONTHS)).toBeNull();
    expect(ageBandFor(null)).toBeNull();
    expect(ageBandFor(-1)).toBeNull();
  });

  it('rotates the daily tip once a day', () => {
    const a = dailyTipIndex('2026-11-07', 10);
    expect(dailyTipIndex('2026-11-07', 10)).toBe(a);
    expect(dailyTipIndex('2026-11-08', 10)).toBe((a + 1) % 10);
    expect(dailyTipIndex('2026-11-07', 0)).toBe(-1);
  });
});

describe('programme progress', () => {
  it('allows one check-off per calendar day, in order', () => {
    let p = startProgramme('2026-11-01');
    expect(nextDayIndex(p)).toBe(0);
    expect(canCompleteToday(p, 7, '2026-11-01')).toBe(true);
    p = completeDay(p, 7, '2026-11-01');
    expect(p.done).toEqual(['2026-11-01']);
    expect(canCompleteToday(p, 7, '2026-11-01')).toBe(false);
    expect(completeDay(p, 7, '2026-11-01')).toBe(p);
    p = completeDay(p, 7, '2026-11-03');
    expect(nextDayIndex(p)).toBe(2);
    expect(progressPercent(p, 7)).toBe(29);
  });

  it('undoes only the last check-off and finishes at the last day', () => {
    let p = startProgramme('2026-11-01');
    for (let d = 1; d <= 7; d += 1) p = completeDay(p, 7, `2026-11-0${d}`);
    expect(isFinished(p, 7)).toBe(true);
    expect(progressPercent(p, 7)).toBe(100);
    expect(canCompleteToday(p, 7, '2026-11-09')).toBe(false);
    p = undoLastDay(p, '2026-11-07');
    expect(p.done).toHaveLength(6);
    expect(isFinished(p, 7)).toBe(false);
    expect(nextDayIndex(null)).toBe(0);
    expect(progressPercent(undefined, 7)).toBe(0);
  });

  it('keeps the first days free and locks the rest without Premium', () => {
    expect(FREE_PROGRAMME_DAYS).toBe(3);
    expect(isDayLocked(0, false)).toBe(false);
    expect(isDayLocked(2, false)).toBe(false);
    expect(isDayLocked(3, false)).toBe(true);
    expect(isDayLocked(20, true)).toBe(false);
  });
});

describe('quizzes', () => {
  const items: { dim: StyleDimension }[] = [
    { dim: 'warmth' }, { dim: 'warmth' }, { dim: 'structure' }, { dim: 'structure' }, { dim: 'giveIn' }, { dim: 'harsh' }, { dim: 'harsh' },
  ];
  it('scores the parenting style without judging', () => {
    expect(styleResult(styleScores(items, [3, 3, 3, 2, 0, 0, 1]))).toBe('balanced');
    expect(styleResult(styleScores(items, [3, 3, 1, 0, 3, 0, 0]))).toBe('gentle');
    expect(styleResult(styleScores(items, [3, 2, 2, 2, 0, 2, 2]))).toBe('storm');
    expect(styleResult(styleScores(items, [0, 1, 3, 3, 0, 2, 2]))).toBe('strict');
    expect(styleResult(styleScores(items, [1, 0, 1, 0, 3, 0, 1]))).toBe('stretched');
  });

  const cp: MilestoneCheckpoint = {
    id: 't', fromMonths: 18, title: '18',
    items: [{ text: 'a', flag: true, support: '' }, { text: 'b', support: '' }, { text: 'c', support: '' }, { text: 'd', support: '' }],
  };
  it('sends red flags and lost skills to the doctor', () => {
    expect(milestoneResult(cp, ['yes', 'yes', 'yes', 'yes'], 'no').id).toBe('ontrack');
    expect(milestoneResult(cp, ['no', 'yes', 'yes', 'yes'], 'no').id).toBe('talk');
    expect(milestoneResult(cp, ['yes', 'yes', 'yes', 'yes'], 'yes').id).toBe('talk');
    const watch = milestoneResult(cp, ['unsure', 'no', 'no', 'unsure'], 'no');
    expect(watch.id).toBe('watch');
    expect(watch.notYet).toEqual([0, 1, 2, 3]);
    expect(watch.flagged).toEqual([]);
  });

  it('picks the latest reached checkpoint', () => {
    const cps = [{ ...cp, id: 'a', fromMonths: 4 }, { ...cp, id: 'b', fromMonths: 9 }, { ...cp, id: 'c', fromMonths: 18 }];
    expect(checkpointFor(cps, 2)?.id).toBe('a');
    expect(checkpointFor(cps, 12)?.id).toBe('b');
    expect(checkpointFor(cps, 40)?.id).toBe('c');
    expect(checkpointFor(cps, null)?.id).toBe('a');
  });
});

describe('device store', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and sanitises stored state per account', () => {
    const s = { ...EMPTY_PARENTING(), band: '3-6' as const, saved: ['a:praise'], programmes: { x: { startedAt: '2026-11-01', done: ['2026-11-01'], updatedAt: '2026-11-01' } } };
    writeParenting('u1', s);
    expect(readParenting('u1')).toEqual({ ...s, quizzes: {} });
    expect(readParenting('u2')).toEqual(EMPTY_PARENTING());
    localStorage.setItem(storageKey('u3'), JSON.stringify({ band: 'x', saved: ['bad', 'a:ok', 'a:ok'], programmes: { y: { done: 'no' } } }));
    expect(readParenting('u3')).toEqual({ ...EMPTY_PARENTING(), saved: ['a:ok'] });
    localStorage.setItem(storageKey('u4'), '{broken');
    expect(readParenting('u4')).toEqual(EMPTY_PARENTING());
  });

  it('toggles bookmarks newest first', () => {
    expect(toggleSaved([], 'a:x')).toEqual(['a:x']);
    expect(toggleSaved(['a:x'], 's:y')).toEqual(['s:y', 'a:x']);
    expect(toggleSaved(['s:y', 'a:x'], 'a:x')).toEqual(['s:y']);
  });

  it('estimates reading time', () => {
    expect(readingMinutes(['one two'])).toBe(1);
    expect(readingMinutes([Array(540).fill('söz').join(' ')])).toBe(3);
  });
});

describe('Tərbiyə home card', () => {
  const base = { lifeStage: 'mommy', language: 'az', setting: 'on', birthDate: '2024-07-01', now: NOW };
  const tips = { '0-1': ['a0', 'a1'], '1-3': ['b0', 'b1', 'b2'], '3-6': ['c0'], '6-12': ['d0', 'd1'] };

  it('uses the tile rules and also hides for a disabled tool or the loss-recovery home', () => {
    expect(isParentingHomeCardVisible(base)).toBe(true);
    expect(isParentingHomeCardVisible({ ...base, setting: 'off' })).toBe(false);
    expect(isParentingHomeCardVisible({ ...base, language: 'ru' })).toBe(false);
    expect(isParentingHomeCardVisible({ ...base, lifeStage: 'flow' })).toBe(false);
    expect(isParentingHomeCardVisible({ ...base, birthDate: '2013-11-01' })).toBe(false);
    expect(isParentingHomeCardVisible({ ...base, toolDisabled: true })).toBe(false);
    expect(isParentingHomeCardVisible({ ...base, recovering: true })).toBe(false);
  });

  it('picks the band like the tool: chosen band, else the child, else 1–3', () => {
    expect(homeTipFor(tips, { birthDate: '2026-05-01', now: NOW })?.band).toBe('0-1');
    expect(homeTipFor(tips, { birthDate: '2021-01-01', now: NOW })?.band).toBe('3-6');
    expect(homeTipFor(tips, { birthDate: '2021-01-01', chosenBand: '6-12', now: NOW })?.band).toBe('6-12');
    expect(homeTipFor(tips, { birthDate: null, now: NOW })?.band).toBe('1-3');
  });

  it('shows the same tip as the tool for the day', () => {
    const r = homeTipFor(tips, { birthDate: '2024-07-01', now: NOW })!;
    expect(r.index).toBe(dailyTipIndex('2026-11-07', 3));
    expect(r.tip).toBe(tips['1-3'][r.index]);
    expect(homeTipFor({ ...tips, '1-3': [] }, { now: NOW })).toBeNull();
  });
});
