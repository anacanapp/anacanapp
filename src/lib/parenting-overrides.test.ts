import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: 0,
  mode: 'ok' as 'ok' | 'error' | 'hang',
  filters: [] as [string, unknown][],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe('parenting_content_overrides');
      db.calls += 1;
      const result = () => (db.mode === 'hang' ? new Promise(() => {}) : Promise.resolve(db.mode === 'error' ? { data: null, error: { message: 'x' } } : { data: db.rows, error: null }));
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => { db.filters.push([c, v]); return chain; },
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => result().then(ok, ko),
      };
      return chain;
    },
  },
}));

import az from '@/data/parenting/az';
import { loadParentingContent, resetParentingContentCache } from '@/data/parenting';
import {
  OVERRIDES_FRESH_MS, applyParentingOverrides, diffPatch, fetchPublishedOverrides, findParentingItem, patchItem, type ParentingOverrideRow,
} from './parenting-overrides';

const row = (item_type: ParentingOverrideRow['item_type'], item_id: string, patch: Record<string, unknown>): ParentingOverrideRow => ({ item_type, item_id, patch });

beforeEach(() => {
  localStorage.clear();
  db.rows = []; db.calls = 0; db.mode = 'ok'; db.filters = [];
  resetParentingContentCache();
});

describe('Tərbiyə content overrides merge', () => {
  it('patches an article by id and never mutates the bundled content', () => {
    const before = JSON.stringify(az);
    const out = applyParentingOverrides(az, [row('article', 'lying', { title: 'Yalan: yeni başlıq', tryToday: ['Bir', 'İki'] })]);
    const a = out.articles.find((x) => x.id === 'lying')!;
    expect(a.title).toBe('Yalan: yeni başlıq');
    expect(a.tryToday).toEqual(['Bir', 'İki']);
    expect(a.science).toEqual(az.articles.find((x) => x.id === 'lying')!.science);
    expect(JSON.stringify(az)).toBe(before);
    expect(out.articles.filter((x) => x.id !== 'lying')).toEqual(az.articles.filter((x) => x.id !== 'lying'));
  });

  it('ignores structural fields, unknown fields and wrong types; keeps the rest of the patch', () => {
    const base = az.sos.find((x) => x.id === 'shop-tantrum')!;
    const out = patchItem(base, { id: 'hack', free: !base.free, bands: ['6-12'], title: 42, moment: 'Yeni an', bogus: 'x', say: 'not an array' });
    expect(out.id).toBe(base.id);
    expect(out.free).toBe(base.free);
    expect(out.bands).toEqual(base.bands);
    expect(out.title).toBe(base.title);
    expect(out.moment).toBe('Yeni an');
    expect(out.say).toEqual(base.say);
    expect(out).not.toHaveProperty('bogus');
  });

  it('keeps the three SOS steps (object arrays keep their length) and merges a step partially', () => {
    const base = az.sos[0];
    expect(patchItem(base, { steps: [{ title: 'Tək' }] }).steps).toEqual(base.steps);
    const out = patchItem(base, { steps: [{ title: 'Bir' }, {}, { text: 'Üç mətn' }] });
    expect(out.steps[0]).toEqual({ title: 'Bir', text: base.steps[0].text });
    expect(out.steps[2]).toEqual({ title: base.steps[2].title, text: 'Üç mətn' });
  });

  it('lets an editor add optional fields (byAge, redFlag, tags) and drops blank lines', () => {
    const base = az.articles.find((a) => !a.byAge)!;
    const out = patchItem(base, { byAge: { '3-6': 'Bağça yaşında…' }, tags: ['yeni', '  '], science: ['', ''] });
    expect(out.byAge?.['3-6']).toBe('Bağça yaşında…');
    expect(out.tags).toEqual(['yeni']);
    expect(out.science).toEqual(base.science); // a required list may not become empty
  });

  it('patches programme days, tips, bands, areas and quizzes by their ids', () => {
    const out = applyParentingOverrides(az, [
      row('programme_day', 'sleep-7:2', { task: 'Yeni tapşırıq' }),
      row('tip', '1-3:1', { title: 'Yeni məsləhət' }),
      row('band', '0-1', { lead: 'Yeni giriş' }),
      row('area', 'emotions', { title: 'Hisslər' }),
      row('quiz', 'style', { results: { balanced: { title: 'Tarazlı' } } }),
      row('quiz', 'milestones', { checkpoints: az.milestoneQuiz.checkpoints.map(() => ({ id: 'x', fromMonths: 99 })) }),
      row('programme_day', 'sleep-7:99', { task: 'yoxdur' }),
      row('tip', 'zz:1', { title: 'yoxdur' }),
    ]);
    const sleep = out.programmes.find((p) => p.id === 'sleep-7')!;
    expect(sleep.days[1].task).toBe('Yeni tapşırıq');
    expect(sleep.days[1].title).toBe(az.programmes.find((p) => p.id === 'sleep-7')!.days[1].title);
    expect(sleep.days).toHaveLength(7);
    expect(out.tips['1-3'][0].title).toBe('Yeni məsləhət');
    expect(out.bands.find((b) => b.id === '0-1')!.lead).toBe('Yeni giriş');
    expect(out.areas.find((a) => a.id === 'emotions')!.title).toBe('Hisslər');
    expect(out.styleQuiz.results.balanced.title).toBe('Tarazlı');
    expect(out.styleQuiz.results.balanced.detail).toEqual(az.styleQuiz.results.balanced.detail);
    expect(out.milestoneQuiz.checkpoints.map((c) => [c.id, c.fromMonths])).toEqual(az.milestoneQuiz.checkpoints.map((c) => [c.id, c.fromMonths]));
    expect(az.tips['1-3'][0].title).not.toBe('Yeni məsləhət');
  });

  it('finds items and diffs an edited copy by top-level field', () => {
    expect(findParentingItem(az, 'programme_day', 'sleep-7:1')).toBe(az.programmes.find((p) => p.id === 'sleep-7')!.days[0]);
    expect(findParentingItem(az, 'quiz', 'nope')).toBeNull();
    const base = az.articles[0];
    expect(diffPatch(base, { ...base, title: 'X', id: 'y' })).toEqual({ title: 'X' });
  });
});

describe('Tərbiyə overrides fetch (offline-safe)', () => {
  it('fetches published rows for the language and caches them for 10 minutes', async () => {
    db.rows = [row('article', 'lying', { title: 'Server' })];
    expect(await fetchPublishedOverrides('az', { now: 1000 })).toEqual(db.rows);
    expect(db.filters).toEqual([['language', 'az'], ['published', true]]);
    db.rows = [];
    expect(await fetchPublishedOverrides('az', { now: 1000 + OVERRIDES_FRESH_MS - 1 })).toHaveLength(1);
    expect(db.calls).toBe(1);
    expect(await fetchPublishedOverrides('az', { now: 1000 + OVERRIDES_FRESH_MS + 1 })).toEqual([]);
    expect(db.calls).toBe(2);
  });

  it('falls back to the cached rows on an error, and to none without a cache', async () => {
    db.mode = 'error';
    expect(await fetchPublishedOverrides('az', { now: 1 })).toEqual([]);
    db.mode = 'ok';
    db.rows = [row('sos', 'nightmare', { title: 'Cache' })];
    await fetchPublishedOverrides('az', { now: 2, force: true });
    db.mode = 'error';
    expect(await fetchPublishedOverrides('az', { now: 2 + OVERRIDES_FRESH_MS * 3 })).toEqual(db.rows);
  });

  it('times out instead of blocking the tool', async () => {
    vi.useFakeTimers();
    try {
      db.mode = 'hang';
      const p = fetchPublishedOverrides('az', { now: 5 });
      await vi.advanceTimersByTimeAsync(4100);
      expect(await p).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loadParentingContent merges published overrides over the lazy az chunk', async () => {
    db.rows = [row('sos', 'nightmare', { title: 'Gecə kabusu (redaktə)' })];
    const c = (await loadParentingContent('az'))!;
    expect(c.sos.find((s) => s.id === 'nightmare')!.title).toBe('Gecə kabusu (redaktə)');
    expect(await loadParentingContent('xx')).toBeNull();
  });
});
