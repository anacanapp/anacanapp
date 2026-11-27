import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import az from '@/data/parenting/az';
import {
  EMPTY_PARENTING, EMPTY_SLOT, type ParentingLocal, allSlots, childForProgramme, effectiveBand, hasParentingActivity, homeTipFor,
  isParentingTileVisible, normalizeForChild, pickParentingChild, programmeSummary, quizAnswer, quizBack, quizDone, readSlot, sanitizeParenting,
  setProgrammeState, setSlotBand, startQuiz, suggestNextProgramme, toggleSavedState, usesRoot, writeSlot,
} from './parenting';
import { mergeParenting, toServerState } from './parenting-sync';
import { activeProgramme } from './parenting-reminders';

const T1 = '2026-11-07T08:00:00.000Z';
const T2 = '2026-11-07T09:00:00.000Z';
const T3 = '2026-11-07T10:00:00.000Z';
const prog = (done: string[], updatedAt: string, startedAt = '2026-11-01') => ({ startedAt, done, updatedAt });
const NOW = new Date(2026, 10, 7, 10);

/** Data written by the app before multi-child support: one band, one result per quiz, one progress per programme. */
const legacy = (): ParentingLocal => ({
  ...EMPTY_PARENTING(),
  band: '3-6',
  bandAt: T1,
  programmes: { 'sleep-7': prog(['2026-11-01'], T1) },
  quizzes: { style: { at: '2026-11-01', result: 'gentle' } },
});

describe('Tərbiyə per child: slots and migration of account-level data', () => {
  it('existing account-level data becomes the first opened child’s data; a sibling starts empty', () => {
    const s = normalizeForChild(legacy(), 'kid-a', '1-3', T2);
    expect(s.rootChild).toBe('kid-a');
    expect(s.rootChildAt).toBe(T2);
    expect(readSlot(s, 'kid-a').programmes['sleep-7'].done).toEqual(['2026-11-01']);
    expect(readSlot(s, 'kid-a').quizzes.style.result).toBe('gentle');
    expect(readSlot(s, 'kid-b')).toEqual(EMPTY_SLOT());
    // Old app versions keep reading the same account-level fields.
    expect(s.programmes['sleep-7']).toBeDefined();
    expect(s.quizzes.style).toBeDefined();
  });

  it('before any child claims it, every child (and "no child") reads the account-level data', () => {
    const s = legacy();
    expect(usesRoot(s, 'kid-a')).toBe(true);
    expect(usesRoot(s, null)).toBe(true);
    expect(readSlot(s, 'kid-z').quizzes.style.result).toBe('gentle');
  });

  it('writes a sibling’s progress into children without touching the root child', () => {
    let s = normalizeForChild(legacy(), 'kid-a', '1-3', T2);
    s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'tantrums-14', prog([], T3, '2026-11-07'), T3));
    s = writeSlot(s, 'kid-b', (slot) => ({ ...slot, quizzes: { style: { at: '2026-11-07', result: 'balanced' } } }));
    expect(s.children?.['kid-b'].programmes['tantrums-14']).toBeDefined();
    expect(s.children?.['kid-b'].quizzes.style.result).toBe('balanced');
    expect(s.programmes['tantrums-14']).toBeUndefined();
    expect(s.quizzes.style.result).toBe('gentle');
    expect(allSlots(s).map((x) => x.childId)).toEqual(['kid-a', 'kid-b']);
    expect(childForProgramme(s, 'tantrums-14')).toBe('kid-b');
    expect(childForProgramme(s, 'sleep-7')).toBe('kid-a');
  });

  it('a restart in a child slot leaves a tombstone there and keeps root bookmark tombstones', () => {
    let s = toggleSavedState(toggleSavedState(EMPTY_PARENTING(), 'a:lying', T1), 'a:lying', T2);
    s = writeSlot(s, null, (slot) => setProgrammeState(slot, 'sleep-7', null, T3));
    expect(s.removed).toEqual({ 's:a:lying': T2, 'p:sleep-7': T3 });
    s = normalizeForChild(s, 'kid-a', null, T3);
    s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', null, T3));
    expect(s.children?.['kid-b'].removed).toEqual({ 'p:sleep-7': T3 });
  });

  it('sanitises children (bad ids, the root child duplicated, bad tombstones) and keeps them on the server copy', () => {
    const s = sanitizeParenting({
      ...legacy(), rootChild: 'kid-a', rootChildAt: T1,
      children: {
        'kid-b': { band: '0-1', bandAt: T2, bandFor: null, programmes: { 'sleep-7': prog([], T2) }, quizzes: {}, removed: { 'p:x': T2, 's:a:y': T2 } },
        'kid-a': { band: '6-12', programmes: {}, quizzes: {} },
        'bad id!': { band: '0-1', programmes: {}, quizzes: {} },
      },
    });
    expect(Object.keys(s.children || {})).toEqual(['kid-b']);
    expect(s.children?.['kid-b']).toMatchObject({ band: '0-1', bandFor: null, removed: { 'p:x': T2 } });
    expect(toServerState({ ...s, dirty: true, reminder: { on: true, time: '20:30' } })).toMatchObject({ rootChild: 'kid-a', children: { 'kid-b': { band: '0-1' } } });
  });

  it('has activity only once the parent used the tool (first-run intro)', () => {
    expect(hasParentingActivity(EMPTY_PARENTING())).toBe(false);
    expect(hasParentingActivity(legacy())).toBe(true);
    expect(hasParentingActivity(toggleSavedState(EMPTY_PARENTING(), 'a:lying', T1))).toBe(true);
    expect(hasParentingActivity({ ...EMPTY_PARENTING(), rootChild: 'a', children: { b: { ...EMPTY_SLOT(), quizzes: { style: { at: 'x', result: 'y' } } } } })).toBe(true);
  });
});

describe('Tərbiyə manual band expiry', () => {
  it('a manual band applies while the child is in the band it was chosen for, then the child band takes over', () => {
    const slot = setSlotBand(EMPTY_SLOT(), '6-12', '1-3', T1);
    expect(slot).toMatchObject({ band: '6-12', bandFor: '1-3', bandAt: T1 });
    expect(effectiveBand(slot, '1-3')).toBe('6-12');
    expect(effectiveBand(slot, '3-6')).toBe('3-6'); // birthday: the child moved on
    expect(effectiveBand(setSlotBand(EMPTY_SLOT(), '1-3', '1-3', T1), '1-3')).toBe('1-3');
    expect(setSlotBand(EMPTY_SLOT(), '1-3', '1-3', T1).band).toBeNull(); // own band = follow the child
  });

  it('a band chosen without a birth date expires once the birth date is known', () => {
    const slot = setSlotBand(EMPTY_SLOT(), '0-1', null, T1);
    expect(effectiveBand(slot, null)).toBe('0-1');
    expect(effectiveBand(slot, '1-3')).toBe('1-3');
  });

  it('normalising stamps a legacy band with the child band and later drops it when the child moves on', () => {
    let s = normalizeForChild(legacy(), 'kid-a', '1-3', T2);
    expect(s.bandFor).toBe('1-3');
    expect(s.band).toBe('3-6');
    expect(normalizeForChild(s, 'kid-a', '1-3', T3)).toBe(s); // nothing to change: same object, no write
    s = normalizeForChild(s, 'kid-a', '3-6', T3);
    expect(s).toMatchObject({ band: null, bandAt: T3, bandFor: '3-6' });
    // A legacy band without bandFor still applies until stamped.
    expect(effectiveBand({ band: '6-12' }, '0-1')).toBe('6-12');
  });

  it('the home tip follows the child’s slot band (expired manual band → the child’s band)', () => {
    const tip = (slot: Parameters<typeof homeTipFor>[1]['slot']) => homeTipFor(az.tips, { birthDate: '2024-07-07', slot, now: NOW })?.band;
    expect(tip(setSlotBand(EMPTY_SLOT(), '6-12', '1-3', T1))).toBe('6-12');
    expect(tip(setSlotBand(EMPTY_SLOT(), '6-12', '0-1', T1))).toBe('1-3');
    expect(tip(EMPTY_SLOT())).toBe('1-3');
  });
});

describe('Tərbiyə children: visibility and selection', () => {
  const base = { lifeStage: 'mommy', language: 'az', setting: 'on', now: NOW };
  const kids = [
    { id: 'old', name: 'Ali', birth_date: '2010-01-01' },
    { id: 'young', name: 'Aysel', birth_date: '2024-07-07' },
    { id: 'mid', name: 'Nur', birth_date: '2020-03-01' },
  ];

  it('stays visible while a younger sibling exists although the selected child is 13+', () => {
    expect(isParentingTileVisible({ ...base, birthDate: '2010-01-01' })).toBe(false);
    expect(isParentingTileVisible({ ...base, birthDate: '2010-01-01', birthDates: kids.map((k) => k.birth_date) })).toBe(true);
    expect(isParentingTileVisible({ ...base, birthDates: ['2010-01-01', '2011-05-05'] })).toBe(false);
    expect(isParentingTileVisible({ ...base, birthDates: ['2010-01-01', null] })).toBe(true);
    expect(isParentingTileVisible({ ...base, birthDates: [] , birthDate: '2024-07-07' })).toBe(true);
  });

  it('picks the switched child, else the preferred one when under 13, else the first younger sibling', () => {
    expect(pickParentingChild(kids, { preferred: 'old', now: NOW })?.id).toBe('young');
    expect(pickParentingChild(kids, { preferred: 'mid', now: NOW })?.id).toBe('mid');
    expect(pickParentingChild(kids, { picked: 'mid', preferred: 'young', now: NOW })?.id).toBe('mid');
    expect(pickParentingChild(kids, { picked: 'old', now: NOW })?.id).toBe('young');
    expect(pickParentingChild([kids[0]], { now: NOW })).toBeNull();
  });

  it('reminders and "Continue" follow the newest running programme over every child', () => {
    let s = normalizeForChild({ ...legacy(), reminder: { on: true, time: '20:30' } }, 'kid-a', '3-6', T1);
    s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'tantrums-14', prog(['2026-11-06'], T3, '2026-11-06'), T3));
    expect(activeProgramme(s, az.programmes)).toMatchObject({ programme: { id: 'tantrums-14' }, childId: 'kid-b' });
    s = writeSlot(s, 'kid-b', (slot) => ({ ...slot, programmes: { 'tantrums-14': { ...slot.programmes['tantrums-14'], paused: true } } }));
    expect(activeProgramme(s, az.programmes)).toMatchObject({ programme: { id: 'sleep-7' }, childId: 'kid-a' });
  });
});

describe('Tərbiyə merge per child', () => {
  const claimed = (child: string, at: string) => normalizeForChild(legacy(), child, '3-6', at);

  it('merges each child slot by the usual rules and keeps the union of children', () => {
    const a = writeSlot(claimed('kid-a', T1), 'kid-b', (slot) => ({ ...slot, quizzes: { style: { at: '2026-11-05', result: 'gentle' } } }));
    const b = writeSlot(claimed('kid-a', T1), 'kid-b', (slot) => ({ ...slot, quizzes: { style: { at: '2026-11-06', result: 'balanced' } } }));
    const c = writeSlot(claimed('kid-a', T1), 'kid-c', (slot) => setSlotBand(slot, '0-1', '1-3', T2));
    const m = mergeParenting(mergeParenting(a, b), c);
    expect(m.children?.['kid-b'].quizzes.style.result).toBe('balanced');
    expect(m.children?.['kid-c']).toMatchObject({ band: '0-1', bandFor: '1-3' });
    expect(mergeParenting(c, mergeParenting(b, a)).children).toEqual(m.children);
  });

  it('a child slot tombstone removes older progress from the other phone', () => {
    const run = writeSlot(claimed('kid-a', T1), 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', prog(['2026-11-01'], T1), T1));
    const restarted = writeSlot(run, 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', null, T2));
    expect(mergeParenting(run, restarted).children?.['kid-b'].programmes['sleep-7']).toBeUndefined();
    expect(mergeParenting(restarted, run).children?.['kid-b'].programmes['sleep-7']).toBeUndefined();
  });

  it('an old app version (no children in its copy) does not drop the children; its root changes still merge', () => {
    const fresh = writeSlot(claimed('kid-a', T1), 'kid-b', (slot) => setSlotBand(slot, '0-1', '1-3', T2));
    const oldClient: ParentingLocal = { ...legacy(), band: '6-12', bandAt: T3 }; // old build: no rootChild / children / bandFor
    const m = mergeParenting(fresh, oldClient);
    expect(m.rootChild).toBe('kid-a');
    expect(m.children?.['kid-b'].band).toBe('0-1');
    expect(m.band).toBe('6-12');
    expect(m.bandFor).toBeUndefined(); // picked from the old copy: stamped again on the next open
    expect(mergeParenting(oldClient, fresh)).toEqual({ ...m });
  });

  it('two phones that claimed different children converge: the earliest claim keeps the account level, the other moves to its child', () => {
    const a = writeSlot(claimed('kid-a', T1), null, (slot) => ({ ...slot, quizzes: { style: { at: '2026-11-05', result: 'gentle' } } }));
    const b0 = normalizeForChild({ ...EMPTY_PARENTING(), quizzes: { style: { at: '2026-11-06', result: 'strict' } } }, 'kid-b', '1-3', T2);
    const m1 = mergeParenting(a, b0);
    const m2 = mergeParenting(b0, a);
    expect(m1.rootChild).toBe('kid-a');
    expect(m2.rootChild).toBe('kid-a');
    expect(m1.quizzes.style.result).toBe('gentle');
    expect(m1.children?.['kid-b'].quizzes.style.result).toBe('strict');
    expect(m2.children?.['kid-b'].quizzes.style.result).toBe('strict');
    expect(m2.quizzes.style.result).toBe('gentle');
  });

  it('keeps the root child’s band stamp (bandFor) with the newest band', () => {
    const a = claimed('kid-a', T1);
    const b = writeSlot(a, 'kid-a', (slot) => setSlotBand(slot, '0-1', '3-6', T3));
    expect(mergeParenting(a, b)).toMatchObject({ band: '0-1', bandFor: '3-6', bandAt: T3 });
  });
});

describe('Tərbiyə quiz navigation and programme completion', () => {
  it('goes back one question keeping every answer; answering again overwrites only that one', () => {
    let nav = startQuiz<number>();
    nav = quizAnswer(nav, 3, 3);
    nav = quizAnswer(nav, 1, 3);
    expect(nav).toEqual({ pos: 2, answers: [3, 1] });
    nav = quizBack(nav);
    expect(nav).toEqual({ pos: 1, answers: [3, 1] });
    nav = quizBack(quizBack(nav));
    expect(nav.pos).toBe(0);
    nav = quizAnswer(nav, 0, 3);
    expect(nav).toEqual({ pos: 1, answers: [0, 1] });
    expect(quizDone(nav, 3)).toBe(false);
    nav = quizAnswer(quizAnswer(nav, 2, 3), 2, 3);
    expect(nav).toEqual({ pos: 3, answers: [0, 2, 2] });
    expect(quizDone(nav, 3)).toBe(true);
    expect(quizAnswer(nav, 1, 3)).toBe(nav); // done: nothing more to answer
    expect(quizDone(quizBack(nav), 3)).toBe(false);
  });

  it('summarises a finished programme: days and first / last day', () => {
    const done = Array.from({ length: 7 }, (_, i) => `2026-11-0${i + 1}`);
    expect(programmeSummary(prog(done, T1), 7)).toEqual({ days: 7, from: '2026-11-01', to: '2026-11-07' });
    expect(programmeSummary(prog(done.slice(0, 6), T1), 7)).toBeNull();
    expect(programmeSummary(undefined, 7)).toBeNull();
  });

  it('suggests another programme for the band: not started first, then running, then other bands; never a finished one', () => {
    const list = [
      { id: 'a', bands: ['1-3' as const], days: [1, 2] },
      { id: 'b', bands: ['1-3' as const], days: [1, 2] },
      { id: 'c', bands: ['6-12' as const], days: [1, 2] },
      { id: 'd', bands: ['1-3' as const], days: [1, 2] },
    ];
    const finished = prog(['2026-11-01', '2026-11-02'], T1);
    expect(suggestNextProgramme(list, { a: finished }, '1-3', 'a')?.id).toBe('b');
    expect(suggestNextProgramme(list, { a: finished, b: prog(['2026-11-01'], T1) }, '1-3', 'a')?.id).toBe('d');
    expect(suggestNextProgramme(list, { a: finished, b: finished, d: finished }, '1-3', 'a')?.id).toBe('c');
    expect(suggestNextProgramme(list, { a: finished, b: finished, c: finished, d: finished }, '1-3', 'a')).toBeNull();
  });
});
