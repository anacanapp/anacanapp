import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => { throw new Error('use the injected db'); } } }));

import { DEFAULT_PLAN_STATE, pickMethod, planStorageKey, setWake, type PlanState } from './sleep-training';
import {
  applyLocalChange, isMissingTable, legacyClaimKey, mergePlan, planStorageKeyV2, readLocalPlan, resetPlanTableState,
  syncPlan, fetchSharedSleepPlan, type KeyValueStorage, type StoredPlan,
} from './sleep-training-sync';

const TODAY = '2026-11-08';
const memory = (init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
};
const plan = (wake: string, method: PlanState['method'] = null): PlanState => {
  const p = setWake(DEFAULT_PLAN_STATE, wake);
  return method ? pickMethod(p, method, TODAY) : p;
};
const stored = (p: PlanState, updatedAt: string | null, dirty: boolean): StoredPlan => ({ v: 2, plan: p, updatedAt, dirty });

describe('device copy per child', () => {
  it('adopts the older per-account plan once, for the first child, and marks it for upload', () => {
    const s = memory({ [planStorageKey('u1')]: JSON.stringify({ ...plan('06:30', 'chair') }) });
    const a = readLocalPlan(s, 'u1', 'child-a', TODAY);
    expect(a.plan.wakeTime).toBe('06:30');
    expect(a.plan.method).toBe('chair');
    expect(a).toMatchObject({ dirty: true, updatedAt: null });
    expect(s.data[legacyClaimKey('u1')]).toBe('child-a');
    expect(JSON.parse(s.data[planStorageKeyV2('u1', 'child-a')]).plan.wakeTime).toBe('06:30');
    // A second child starts empty; the first keeps its own copy.
    expect(readLocalPlan(s, 'u1', 'child-b', TODAY).plan).toEqual(DEFAULT_PLAN_STATE);
    expect(readLocalPlan(s, 'u1', 'child-a', TODAY).plan.method).toBe('chair');
  });

  it('starts empty without a child, without storage or with garbage', () => {
    const s = memory({ [planStorageKey('u1')]: JSON.stringify(plan('06:30')) });
    expect(readLocalPlan(s, 'u1', null, TODAY).plan).toEqual(DEFAULT_PLAN_STATE);
    expect(s.data[legacyClaimKey('u1')]).toBeUndefined();
    expect(readLocalPlan(null, 'u1', 'c', TODAY).plan).toEqual(DEFAULT_PLAN_STATE);
    expect(readLocalPlan(memory({ [planStorageKeyV2('u1', 'c')]: '{oops' }), 'u1', 'c', TODAY).dirty).toBe(false);
  });

  it('stamps real changes only', () => {
    const base = stored(plan('07:00'), '2026-11-01T10:00:00.000Z', false);
    expect(applyLocalChange(base, plan('07:00'))).toBe(base);
    const next = applyLocalChange(base, plan('07:30'), new Date('2026-11-08T08:00:00.000Z'));
    expect(next).toMatchObject({ dirty: true, updatedAt: '2026-11-08T08:00:00.000Z' });
  });
});

describe('mergePlan (newest wins)', () => {
  const now = new Date('2026-11-08T09:00:00.000Z');
  it('uploads a newer local change and takes a newer server copy', () => {
    const local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
    expect(mergePlan(local, { plan: plan('08:00'), updatedAt: '2026-11-07T08:00:00.000Z' }, TODAY)).toEqual({ next: local, push: true });
    const r = mergePlan(local, { plan: plan('08:00'), updatedAt: '2026-11-08T08:30:00.000Z' }, TODAY);
    expect(r.push).toBe(false);
    expect(r.next).toMatchObject({ dirty: false, updatedAt: '2026-11-08T08:30:00.000Z' });
    expect(r.next.plan.wakeTime).toBe('08:00');
  });

  it('keeps an in-sync copy, uploads a first plan and lets a legacy copy lose to any server row', () => {
    const synced = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', false);
    expect(mergePlan(synced, { plan: plan('06:30'), updatedAt: '2026-11-08T08:00:00.000Z' }, TODAY)).toEqual({ next: synced, push: false });
    expect(mergePlan(stored(DEFAULT_PLAN_STATE, null, false), null, TODAY)).toMatchObject({ push: false });
    const legacy = stored(plan('06:00'), null, true);
    expect(mergePlan(legacy, null, TODAY, now)).toEqual({ next: { ...legacy, updatedAt: now.toISOString() }, push: true });
    expect(mergePlan(legacy, { plan: plan('08:00'), updatedAt: '2026-01-01T00:00:00.000Z' }, TODAY).next.plan.wakeTime).toBe('08:00');
  });

  it('sanitises the server copy', () => {
    const r = mergePlan(stored(DEFAULT_PLAN_STATE, null, false), { plan: { wakeTime: '99:99', method: 'nope', stepsDone: ['x'] }, updatedAt: '2026-11-08T08:00:00.000Z' }, TODAY);
    expect(r.next.plan).toEqual(DEFAULT_PLAN_STATE);
  });
});

/** Minimal PostgREST stand-in: one table, the filters the sync uses. */
function fakeDb(opts: { rows?: Array<Record<string, unknown>>; error?: { code: string; message: string } } = {}) {
  const rows = opts.rows ?? [];
  const calls: string[] = [];
  const query = (op: 'select' | 'update', patch?: Record<string, unknown>) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const match = () => rows.filter((r) => filters.every((f) => f(r)));
    const q = {
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return q; },
      lt: (c: string, v: string) => { filters.push((r) => Date.parse(r[c] as string) < Date.parse(v)); return q; },
      maybeSingle: async () => (opts.error ? { data: null, error: opts.error } : { data: match()[0] ?? null, error: null }),
      select: async () => {
        if (opts.error) return { data: null, error: opts.error };
        const hit = match();
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        return { data: hit.map((r) => ({ id: r.id })), error: null };
      },
    };
    return q;
  };
  return {
    rows, calls,
    from: () => ({
      select: () => { calls.push('select'); return query('select'); },
      update: (patch: Record<string, unknown>) => { calls.push('update'); return query('update', patch); },
      insert: async (row: Record<string, unknown>) => {
        calls.push('insert');
        if (rows.some((r) => r.user_id === row.user_id && r.child_id === row.child_id)) return { error: { code: '23505', message: 'dup' } };
        rows.push({ id: `id-${rows.length}`, ...row });
        return { error: null };
      },
    }),
  };
}

describe('syncPlan', () => {
  beforeEach(() => resetPlanTableState());

  it('inserts a first plan, then updates only an older row', async () => {
    const db = fakeDb();
    const local = stored(plan('06:30', 'fading'), '2026-11-08T08:00:00.000Z', true);
    const a = await syncPlan({ userId: 'u', childId: 'c', local, todayKey: TODAY, db });
    expect(a).toMatchObject({ ok: true, state: { dirty: false } });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ user_id: 'u', child_id: 'c', updated_at: '2026-11-08T08:00:00.000Z' });

    const newer = stored(plan('07:30', 'fading'), '2026-11-08T09:00:00.000Z', true);
    await syncPlan({ userId: 'u', childId: 'c', local: newer, todayKey: TODAY, db });
    expect((db.rows[0].plan as PlanState).wakeTime).toBe('07:30');
    expect(db.calls).toContain('update');
  });

  it('adopts a newer server copy instead of uploading an older local change', async () => {
    const db = fakeDb({ rows: [{ id: 'r', user_id: 'u', child_id: 'c', plan: plan('08:00'), updated_at: '2026-11-08T10:00:00.000Z' }] });
    const res = await syncPlan({ userId: 'u', childId: 'c', local: stored(plan('06:00'), '2026-11-08T09:00:00.000Z', true), todayKey: TODAY, db });
    expect(res.ok).toBe(true);
    expect(res.state.plan.wakeTime).toBe('08:00');
    expect(db.calls).not.toContain('update');
  });

  it('stays quietly local-only while the table is absent', async () => {
    const db = fakeDb({ error: { code: 'PGRST205', message: "Could not find the table 'public.sleep_training_plans' in the schema cache" } });
    const local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
    expect(await syncPlan({ userId: 'u', childId: 'c', local, todayKey: TODAY, db })).toEqual({ state: local, ok: false });
    const calls = db.calls.length;
    expect(await syncPlan({ userId: 'u', childId: 'c', local, todayKey: TODAY, db })).toEqual({ state: local, ok: false });
    expect(db.calls.length).toBe(calls);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '08006', message: 'network' })).toBe(false);
  });

  it('keeps the local copy (still dirty) on a network failure', async () => {
    const db = fakeDb({ error: { code: '08006', message: 'Failed to fetch' } });
    const local = stored(plan('06:30'), '2026-11-08T08:00:00.000Z', true);
    expect(await syncPlan({ userId: 'u', childId: 'c', local, todayKey: TODAY, db })).toEqual({ state: local, ok: false });
  });

  it('lets the partner read the shared plan', async () => {
    const db = fakeDb({ rows: [{ id: 'r', user_id: 'mom', child_id: 'c', plan: plan('06:45', 'chair'), updated_at: '2026-11-08T10:00:00.000Z' }] });
    const shared = await fetchSharedSleepPlan('mom', 'c', TODAY, db);
    expect(shared?.plan.method).toBe('chair');
    expect(await fetchSharedSleepPlan('mom', 'other', TODAY, db)).toBeNull();
  });
});
