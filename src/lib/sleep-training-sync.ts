/**
 * Sleep-training plan sync. The device copy (localStorage per account and child) is what the screen reads:
 * optimistic and offline-first. In the background it is synced with public.sleep_training_plans (one row per
 * owner + child; the linked partner may read it while baby logs are shared):
 *  - the newest updated_at wins (a local change made after the server copy is uploaded, otherwise the server
 *    copy replaces the device copy);
 *  - an upload only replaces an older server row (`updated_at < ours`), so a slower phone never overwrites a
 *    newer plan;
 *  - the older per-account plan (v1 key, no child) is adopted once by the first child it is opened for and
 *    uploaded when the server has nothing newer;
 *  - while the table is absent (migration not applied yet) the tool stays quietly local-only.
 */
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PLAN_STATE, parsePlanState, planStorageKey, prunePlanState, type PlanState } from './sleep-training';

export const PLAN_TABLE = 'sleep_training_plans';

export interface StoredPlan {
  v: 2;
  plan: PlanState;
  /** ISO time of the last change (local) or of the server copy; null = unknown age (never synced, legacy). */
  updatedAt: string | null;
  /** Changed on this device and not uploaded yet. */
  dirty: boolean;
}

export interface RemotePlan { plan: unknown; updatedAt: string }

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const planStorageKeyV2 = (userId: string, childId: string | null) => `anacan.sleepTraining.v2.${userId}.${childId ?? 'none'}`;
export const legacyClaimKey = (userId: string) => `anacan.sleepTraining.v1.claimed.${userId}`;

const ms = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};
const isIso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

export const emptyStored = (): StoredPlan => ({ v: 2, plan: DEFAULT_PLAN_STATE, updatedAt: null, dirty: false });

export const samePlan = (a: PlanState, b: PlanState) => JSON.stringify(a) === JSON.stringify(b);
export const isDefaultPlan = (p: PlanState) => samePlan(p, DEFAULT_PLAN_STATE);

/** A stored v2 envelope, or null when it is missing or malformed. */
export function parseStored(raw: string | null, todayKey: string): StoredPlan | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (!r || typeof r !== 'object' || r.v !== 2) return null;
    return {
      v: 2,
      plan: prunePlanState(parsePlanState(r.plan), todayKey),
      updatedAt: isIso(r.updatedAt) ? r.updatedAt : null,
      dirty: r.dirty === true,
    };
  } catch { return null; }
}

/**
 * Reads the device copy for one child. Without one, the older per-account plan is adopted by the first child
 * that asks for it (the claim is remembered, so a second child starts empty) and marked for upload.
 */
export function readLocalPlan(storage: KeyValueStorage | null, userId: string, childId: string | null, todayKey: string): StoredPlan {
  if (!storage) return emptyStored();
  try {
    const own = parseStored(storage.getItem(planStorageKeyV2(userId, childId)), todayKey);
    if (own) return own;
    if (!childId) return emptyStored();
    const claimed = storage.getItem(legacyClaimKey(userId));
    if (claimed && claimed !== childId) return emptyStored();
    const legacyRaw = storage.getItem(planStorageKey(userId));
    if (!legacyRaw) return emptyStored();
    const plan = prunePlanState(parsePlanState(JSON.parse(legacyRaw)), todayKey);
    storage.setItem(legacyClaimKey(userId), childId);
    const adopted: StoredPlan = { v: 2, plan, updatedAt: null, dirty: !isDefaultPlan(plan) };
    storage.setItem(planStorageKeyV2(userId, childId), JSON.stringify(adopted));
    return adopted;
  } catch { return emptyStored(); }
}

export function writeLocalPlan(storage: KeyValueStorage | null, userId: string, childId: string | null, s: StoredPlan): void {
  if (!storage) return;
  try { storage.setItem(planStorageKeyV2(userId, childId), JSON.stringify(s)); } catch { /* storage optional */ }
}

/** Applies a local change: stamped now and marked for upload (unchanged plans stay as they are). */
export function applyLocalChange(s: StoredPlan, next: PlanState, now: Date = new Date()): StoredPlan {
  if (samePlan(s.plan, next)) return s;
  return { v: 2, plan: next, updatedAt: now.toISOString(), dirty: true };
}

/**
 * Newest wins. Returns the device copy to keep and whether it must be uploaded.
 * A local copy of unknown age (legacy, never synced) loses to any server row.
 */
export function mergePlan(local: StoredPlan, remote: RemotePlan | null, todayKey: string, now: Date = new Date()): { next: StoredPlan; push: boolean } {
  if (!remote) {
    if (!local.dirty) return { next: local, push: false };
    return { next: local.updatedAt ? local : { ...local, updatedAt: now.toISOString() }, push: true };
  }
  const lt = ms(local.updatedAt), rt = ms(remote.updatedAt);
  if (local.dirty && lt > rt) return { next: local, push: true };
  if (!local.dirty && lt === rt) return { next: local, push: false };
  return {
    next: { v: 2, plan: prunePlanState(parsePlanState(remote.plan), todayKey), updatedAt: remote.updatedAt, dirty: false },
    push: false,
  };
}

// ── Server ────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table newer than the generated types
type Db = { from: (table: string) => any };
const defaultDb = () => supabase as unknown as Db;

let tableMissing = false;
/** Test hook: forget that the table was missing. */
export const resetPlanTableState = () => { tableMissing = false; };

interface PgError { code?: string; status?: number; message?: string }
/** The table is not there yet (migration pending) or not in PostgREST's schema cache. */
export function isMissingTable(error: PgError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') return true;
  return /sleep_training_plans/.test(error.message ?? '') && /(does not exist|schema cache|not find)/i.test(error.message ?? '');
}

const scoped = (q: any, childId: string | null) => (childId ? q.eq('child_id', childId) : q.is('child_id', null)); // eslint-disable-line @typescript-eslint/no-explicit-any

export async function fetchRemotePlan(ownerId: string, childId: string | null, db: Db = defaultDb()): Promise<RemotePlan | null> {
  const { data, error } = await scoped(db.from(PLAN_TABLE).select('plan, updated_at').eq('user_id', ownerId), childId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { plan: unknown; updated_at: string };
  return { plan: row.plan, updatedAt: row.updated_at };
}

/** Upload: replaces only an older row; 'conflict' = the server has something newer (or a concurrent insert). */
export async function pushRemotePlan(ownerId: string, childId: string | null, s: StoredPlan, remoteExists: boolean, db: Db = defaultDb()): Promise<'ok' | 'conflict'> {
  const updatedAt = s.updatedAt ?? new Date().toISOString();
  if (remoteExists) {
    const { data, error } = await scoped(db.from(PLAN_TABLE).update({ plan: s.plan, updated_at: updatedAt }).eq('user_id', ownerId), childId)
      .lt('updated_at', updatedAt).select('id');
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? 'ok' : 'conflict';
  }
  const { error } = await db.from(PLAN_TABLE).insert({ user_id: ownerId, child_id: childId, plan: s.plan, updated_at: updatedAt });
  if (error) {
    if ((error as PgError).code === '23505') return 'conflict';
    throw error;
  }
  return 'ok';
}

/**
 * Fetch → merge → upload when ours is newer. Never throws: on failure (offline, table absent) the local copy
 * comes back unchanged with ok = false, and it stays dirty for the next attempt.
 */
export async function syncPlan(o: { userId: string; childId: string | null; local: StoredPlan; todayKey: string; db?: Db; now?: Date }): Promise<{ state: StoredPlan; ok: boolean }> {
  if (tableMissing) return { state: o.local, ok: false };
  const db = o.db ?? defaultDb();
  try {
    let local = o.local;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remote = await fetchRemotePlan(o.userId, o.childId, db);
      const { next, push } = mergePlan(local, remote, o.todayKey, o.now);
      if (!push) return { state: next, ok: true };
      const res = await pushRemotePlan(o.userId, o.childId, next, !!remote, db);
      if (res === 'ok') return { state: { ...next, dirty: false }, ok: true };
      local = next; // someone wrote meanwhile: fetch again and let the newest win
    }
    return { state: local, ok: false };
  } catch (error) {
    if (isMissingTable(error as PgError)) tableMissing = true;
    return { state: o.local, ok: false };
  }
}

/** The mother's plan for one of her children, for her linked partner (RLS: only while she shares baby logs). */
export async function fetchSharedSleepPlan(ownerId: string, childId: string, todayKey: string, db: Db = defaultDb()): Promise<{ plan: PlanState; updatedAt: string } | null> {
  if (tableMissing) return null;
  try {
    const remote = await fetchRemotePlan(ownerId, childId, db);
    return remote ? { plan: prunePlanState(parsePlanState(remote.plan), todayKey), updatedAt: remote.updatedAt } : null;
  } catch (error) {
    if (isMissingTable(error as PgError)) tableMissing = true;
    return null;
  }
}
