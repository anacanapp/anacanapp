import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  row: null as { state: unknown; updated_at: string } | null,
  upserts: [] as { user_id: string; state: unknown }[],
  fail: false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe('parenting_state');
      const chain = {
        select: () => chain,
        eq: (_c: string, _v: string) => chain,
        maybeSingle: async () => (db.fail ? { data: null, error: { message: 'offline' } } : { data: db.row, error: null }),
        upsert: async (row: { user_id: string; state: unknown }, opts: { onConflict: string }) => {
          expect(opts.onConflict).toBe('user_id');
          db.upserts.push(row);
          db.row = { state: row.state, updated_at: 'now' };
          return { error: null };
        },
      };
      return chain;
    },
  },
}));

import { EMPTY_PARENTING, sanitizeParenting, setBandState, setProgrammeState, toggleSavedState, type ParentingLocal } from './parenting';
import { mergeParenting, syncParenting, toServerState } from './parenting-sync';

const T1 = '2026-11-07T08:00:00.000Z';
const T2 = '2026-11-07T09:00:00.000Z';
const T3 = '2026-11-07T10:00:00.000Z';
const prog = (done: string[], updatedAt: string, paused?: boolean) => ({ startedAt: '2026-11-01', done, updatedAt, ...(paused ? { paused } : {}) });

beforeEach(() => { db.row = null; db.upserts = []; db.fail = false; });

describe('Tərbiyə state merge', () => {
  it('keeps the union of bookmarks, newest first', () => {
    const a = toggleSavedState(toggleSavedState(EMPTY_PARENTING(), 'a:lying', T1), 's:nightmare', T3);
    const b = toggleSavedState(EMPTY_PARENTING(), 'a:fears', T2);
    const m = mergeParenting(a, b);
    expect(m.saved).toEqual(['s:nightmare', 'a:fears', 'a:lying']);
    expect(mergeParenting(b, a).saved).toEqual(m.saved);
  });

  it('a removal on one phone wins over the older add on the other; a newer re-add wins over the removal', () => {
    const added = toggleSavedState(EMPTY_PARENTING(), 'a:lying', T1);
    const removed = toggleSavedState(added, 'a:lying', T2);
    expect(removed.saved).toEqual([]);
    expect(mergeParenting(added, removed).saved).toEqual([]);
    expect(mergeParenting(removed, added).saved).toEqual([]);
    const readded = toggleSavedState(removed, 'a:lying', T3);
    expect(mergeParenting(readded, removed).saved).toEqual(['a:lying']);
    expect(mergeParenting(removed, readded).saved).toEqual(['a:lying']);
  });

  it('takes the programme copy with more checked-off days (max progress), the newer one on a tie', () => {
    const a: ParentingLocal = { ...EMPTY_PARENTING(), programmes: { 'sleep-7': prog(['2026-11-01', '2026-11-02'], T1) } };
    const b: ParentingLocal = { ...EMPTY_PARENTING(), programmes: { 'sleep-7': prog(['2026-11-01'], T3), 'tantrums-14': prog([], T2) } };
    const m = mergeParenting(a, b);
    expect(m.programmes['sleep-7'].done).toHaveLength(2);
    expect(Object.keys(m.programmes).sort()).toEqual(['sleep-7', 'tantrums-14']);
    const paused = { ...EMPTY_PARENTING(), programmes: { 'sleep-7': prog(['2026-11-01', '2026-11-02'], T3, true) } };
    expect(mergeParenting(a, paused).programmes['sleep-7'].paused).toBe(true);
  });

  it('a restart (tombstone) removes older progress from the other phone but not a newer start', () => {
    const old: ParentingLocal = { ...EMPTY_PARENTING(), programmes: { 'sleep-7': prog(['2026-11-01'], T1) } };
    const restarted = setProgrammeState(old, 'sleep-7', null, T2);
    expect(mergeParenting(old, restarted).programmes['sleep-7']).toBeUndefined();
    const again = setProgrammeState(restarted, 'sleep-7', prog([], T3), T3);
    expect(mergeParenting(again, old).programmes['sleep-7']).toMatchObject({ done: ['2026-11-01'] });
    expect(mergeParenting(again, restarted).programmes['sleep-7']).toBeDefined();
  });

  it('keeps the newest band choice and quiz result; the reminder preference stays on the phone', () => {
    const a = { ...setBandState(EMPTY_PARENTING(), '3-6', T1), quizzes: { style: { at: '2026-11-05', result: 'gentle' } }, reminder: { on: true, time: '21:00' } };
    const b = { ...setBandState(EMPTY_PARENTING(), '6-12', T2), quizzes: { style: { at: '2026-11-06', result: 'balanced' }, milestones: { at: '2026-11-01', result: 'ontrack' } } };
    const m = mergeParenting(a, b);
    expect(m.band).toBe('6-12');
    expect(m.quizzes).toEqual({ style: { at: '2026-11-06', result: 'balanced' }, milestones: { at: '2026-11-01', result: 'ontrack' } });
    expect(m.reminder).toEqual({ on: true, time: '21:00' });
    expect(toServerState({ ...m, dirty: true })).not.toHaveProperty('reminder');
    expect(toServerState({ ...m, dirty: true })).not.toHaveProperty('dirty');
  });

  it('sanitises server data like device data', () => {
    const s = sanitizeParenting({ band: 'x', saved: ['a:ok', 'bad ref', 7], savedAt: { 'a:ok': T1, nope: T1 }, removed: { 'p:sleep-7': T2, 'x:y': T2 }, programmes: { 'Bad Id': prog([], T1) } });
    expect(s).toEqual({ v: 1, band: null, programmes: {}, quizzes: {}, saved: ['a:ok'], savedAt: { 'a:ok': T1 }, removed: { 'p:sleep-7': T2 } });
  });
});

describe('Tərbiyə account sync', () => {
  it('does not create a server row for a parent who never used the tool', async () => {
    const res = await syncParenting('u1', EMPTY_PARENTING());
    expect(res.ok).toBe(true);
    expect(db.upserts).toEqual([]);
  });

  it('pushes local changes, then merges another phone’s row on the next sync', async () => {
    const local = { ...toggleSavedState(EMPTY_PARENTING(), 'a:lying', T1), dirty: true };
    const first = await syncParenting('u1', local);
    expect(first.ok).toBe(true);
    expect(first.state.dirty).toBeUndefined();
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0].state).toMatchObject({ saved: ['a:lying'] });

    db.row = { state: { ...toServerState(first.state), saved: ['s:nightmare', 'a:lying'], savedAt: { 's:nightmare': T2, 'a:lying': T1 } }, updated_at: 'x' };
    const second = await syncParenting('u1', first.state);
    expect(second.state.saved).toEqual(['s:nightmare', 'a:lying']);
    expect(db.upserts).toHaveLength(1); // the merge equals the server copy: nothing to push
  });

  it('keeps the local state (still dirty) when offline', async () => {
    db.fail = true;
    const local = { ...setBandState(EMPTY_PARENTING(), '0-1', T1), dirty: true };
    const res = await syncParenting('u1', local);
    expect(res).toEqual({ state: local, ok: false });
  });
});
