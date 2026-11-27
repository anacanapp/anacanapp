import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import az from '@/data/kid-exercises/az.json';
import { mergeKidExLocale } from '@/data/kid-exercises';
import { KIDEX_UI_AZ } from '@/data/kid-exercises/ui-az';
import type { KidExSource } from '@/data/kid-exercises/types';
import {
  KIDEX_MAX_FAVS, currentGroupKey, doneOn, groupMonths, groupsOf, isKidExTileVisible, logDone, readKidExState,
  searchExercises, setForMonths, todaysPicks, toggleFav, unlogDone, weekStrip, writeKidExState,
} from './kid-exercises';

const content = mergeKidExLocale('az', az as KidExSource, { ui: KIDEX_UI_AZ, sets: {}, groups: {}, exercises: {} });
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('kid exercises content', () => {
  it('has 141 exercises in 5 age groups, each with an image and text', () => {
    expect(content.sets.map((s) => s.id)).toEqual(['0-1', '1-2', '2-3', '3-4', '4-5']);
    expect(content.exercises).toHaveLength(141);
    expect(new Set(content.exercises.map((e) => e.id)).size).toBe(141);
    for (const e of content.exercises) {
      expect(e.id.startsWith(`${e.set}/`)).toBe(true);
      expect(existsSync(`public/exercises/${e.id}.webp`)).toBe(true);
      for (const k of ['title', 'age', 'how', 'duration', 'benefit'] as const) expect(e[k].length).toBeGreaterThan(2);
    }
  });

  it('baby groups carry month ranges, later groups are kinds of movement', () => {
    expect(groupMonths('3–6 ay')).toEqual({ min: 3, max: 6 });
    expect(groupMonths('Topla oyunlar')).toBeNull();
    expect(currentGroupKey(content.exercises, '0-1', 4)).toBe('3–6 ay');
    expect(currentGroupKey(content.exercises, '1-2', 16)).toBe('15–18 ay');
    expect(currentGroupKey(content.exercises, '3-4', 40)).toBeNull();
  });
});

describe('age group and picks', () => {
  it('maps a child age to its group; older children stay in 4–5', () => {
    expect([0, 11, 12, 30, 47, 48, 80].map(setForMonths)).toEqual(['0-1', '0-1', '1-2', '2-3', '3-4', '4-5', '4-5']);
  });

  it('never picks an exercise from an older baby group', () => {
    const inSet = content.exercises.filter((e) => e.set === '0-1');
    for (let d = 1; d <= 20; d++) {
      const picks = todaysPicks(inSet, `2026-11-${d}|child|0-1`, 2);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((p) => p.id)).size).toBe(3);
      for (const p of picks) expect(groupMonths(p.groupKey)!.min).toBe(0);
    }
    const picks = todaysPicks(inSet, 'seed', 7);
    expect(picks.filter((p) => p.groupKey === '6–9 ay').length).toBeGreaterThanOrEqual(1);
    expect(picks.every((p) => groupMonths(p.groupKey)!.min <= 7)).toBe(true);
  });

  it('is stable for a day and differs between days', () => {
    const inSet = content.exercises.filter((e) => e.set === '3-4');
    const a = todaysPicks(inSet, 'day1|c|3-4', null).map((e) => e.id);
    expect(todaysPicks(inSet, 'day1|c|3-4', null).map((e) => e.id)).toEqual(a);
    const days = new Set(Array.from({ length: 10 }, (_, i) => todaysPicks(inSet, `day${i}|c|3-4`, null).map((e) => e.id).join()));
    expect(days.size).toBeGreaterThan(5);
  });

  it('groups keep source order and search folds Azerbaijani letters', () => {
    const groups = groupsOf(content.exercises.filter((e) => e.set === '0-1'));
    expect(groups.map((g) => g.key)).toEqual(['0–3 ay', '3–6 ay', '6–9 ay', '9–12 ay']);
    expect(searchExercises(content.exercises, 'qarin ustə').some((e) => e.id === '0-1/01_tummy_time')).toBe(true);
    expect(searchExercises(content.exercises, 'TOP').length).toBeGreaterThan(5);
  });
});

describe('progress on the phone', () => {
  it('logs done once per day, toggles favourites and survives a round trip', () => {
    const store = memory();
    const now = new Date(2026, 10, 21, 10);
    let s = readKidExState(store, 'u1');
    s = logDone(s, 'a', now); s = logDone(s, 'a', now); s = logDone(s, 'b', now);
    expect(doneOn(s, '2026-11-21')).toEqual(new Set(['a', 'b']));
    s = unlogDone(s, 'b', now);
    s = toggleFav(s, 'a'); s = { ...s, set: '2-3' };
    writeKidExState(store, 'u1', s);
    const back = readKidExState(store, 'u1');
    expect(back.favs).toEqual(['a']);
    expect(back.set).toBe('2-3');
    expect(readKidExState(store, 'u2').favs).toEqual([]);
    expect(weekStrip(back, now).map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it('is bounded and ignores bad stored data', () => {
    const store = memory();
    let s = readKidExState(store, null);
    for (let i = 0; i < 80; i++) s = toggleFav(s, `x${i}`);
    expect(s.favs).toHaveLength(KIDEX_MAX_FAVS);
    store.setItem('anacan_kid_exercises_v1:guest', '{"set":"9-9","favs":[1,"a"],"log":"x"}');
    expect(readKidExState(store, null)).toEqual({ set: null, favs: ['a'], log: [] });
    store.setItem('anacan_kid_exercises_v1:guest', 'not json');
    expect(readKidExState(store, null).log).toEqual([]);
  });

  it('tile is for the Ana module and admins, with content', () => {
    expect(isKidExTileVisible({ lifeStage: 'mommy', hasContent: true })).toBe(true);
    expect(isKidExTileVisible({ lifeStage: 'bump', hasContent: true })).toBe(false);
    expect(isKidExTileVisible({ lifeStage: 'bump', hasContent: true, isAdmin: true })).toBe(true);
    expect(isKidExTileVisible({ lifeStage: 'mommy', hasContent: false })).toBe(false);
    expect(isKidExTileVisible({ lifeStage: 'mommy', hasContent: true, disabled: true })).toBe(false);
  });
});
