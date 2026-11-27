/**
 * Süddən ayırma persistence: the device copy is the source the UI reads (optimistic, works offline);
 * changes are queued and pushed to public.weaning_plans / public.weaning_checkins (RLS: own rows only)
 * whenever the network is available. Readiness answers, the "continue breastfeeding" choice and the milk
 * cup counter are per-device preferences.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  type CheckinAnswers, type CheckinResult, type Feeds, type NightMode, type Pace, type PauseReason, type PlanStatus,
  type Readiness, type Tone, type WeaningPlan, type WeaningStep, DEFAULT_FEEDS, EMPTY_READINESS, isoDay, newUuid,
} from './weaning';

export interface StoredCheckin {
  id: string;
  planId: string | null;
  date: string;
  answers: CheckinAnswers;
  tone: Tone;
  createdAt: string;
  synced: boolean;
}

export interface WeaningLocal {
  v: 1;
  plan: WeaningPlan | null;
  planDirty: boolean;
  checkins: StoredCheckin[];
  lastResult: CheckinResult | null;
  continueBF: boolean;
  readiness: Readiness;
  feeds: Feeds;
  pace: Pace;
  nightMode: NightMode;
  cups: { date: string; n: number };
}

export const EMPTY_LOCAL = (): WeaningLocal => ({
  v: 1, plan: null, planDirty: false, checkins: [], lastResult: null, continueBF: false,
  readiness: { ...EMPTY_READINESS, reasons: [] }, feeds: { ...DEFAULT_FEEDS }, pace: 'gentle', nightMode: 'last',
  cups: { date: isoDay(new Date()), n: 0 },
});

const KEY = (uid: string | null | undefined) => `anacan.weaning.v1.${uid || 'guest'}`;
const MAX_CHECKINS = 60;

export function readLocal(uid: string | null | undefined): WeaningLocal {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(uid)) || 'null');
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return EMPTY_LOCAL();
    const base = EMPTY_LOCAL();
    return {
      ...base, ...raw,
      readiness: { ...base.readiness, ...(raw.readiness || {}), reasons: Array.isArray(raw.readiness?.reasons) ? raw.readiness.reasons : [] },
      feeds: { ...base.feeds, ...(raw.feeds || {}) },
      checkins: Array.isArray(raw.checkins) ? raw.checkins : [],
    };
  } catch {
    return EMPTY_LOCAL();
  }
}

export function writeLocal(uid: string | null | undefined, state: WeaningLocal): void {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify({ ...state, checkins: state.checkins.slice(0, MAX_CHECKINS) }));
  } catch { /* storage full or blocked: the in-memory state still works */ }
}

export function makeCheckin(answers: CheckinAnswers, res: CheckinResult, planId: string | null, now = new Date()): StoredCheckin {
  return { id: newUuid(), planId, date: isoDay(now), answers, tone: res.tone, createdAt: now.toISOString(), synced: false };
}

// ── Server rows ──────────────────────────────────────────────────────────────────────────
interface PlanRow {
  id: string; user_id: string; child_id: string | null; pace: Pace; night_mode: NightMode; steps: WeaningStep[];
  status: PlanStatus; pause_reason: PauseReason | null; started_at: string; created_at: string; updated_at: string;
}

export const planToRow = (uid: string, p: WeaningPlan): PlanRow => ({
  id: p.id, user_id: uid, child_id: p.childId, pace: p.pace, night_mode: p.nightMode, steps: p.steps,
  status: p.status, pause_reason: p.pauseReason, started_at: p.startedAt, created_at: p.createdAt, updated_at: p.updatedAt,
});

export const rowToPlan = (r: PlanRow): WeaningPlan => ({
  id: r.id, childId: r.child_id, pace: r.pace, nightMode: r.night_mode, steps: Array.isArray(r.steps) ? r.steps : [],
  status: r.status, pauseReason: r.pause_reason, startedAt: String(r.started_at).slice(0, 10), createdAt: r.created_at, updatedAt: r.updated_at,
});

export const checkinToRow = (uid: string, c: StoredCheckin) => ({
  id: c.id, user_id: uid, plan_id: c.planId, date: c.date,
  child_mood: c.answers.childMood, wet_diapers: c.answers.diapers, child_sick: c.answers.childSick,
  breast_fullness: c.answers.fullness, lump: c.answers.lump, redness: c.answers.red, fever: c.answers.fever,
  mother_mood: c.answers.motherMood, result_tone: c.tone, created_at: c.createdAt,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables newer than the generated types
const db = supabase as unknown as { from: (table: string) => any };

/** Latest plan of this user for the child that is still relevant (active, paused or finished). */
export async function fetchPlan(uid: string, childId: string | null): Promise<WeaningPlan | null> {
  let q = db.from('weaning_plans')
    .select('id, user_id, child_id, pace, night_mode, steps, status, pause_reason, started_at, created_at, updated_at')
    .eq('user_id', uid).in('status', ['active', 'paused', 'finished']);
  q = childId ? q.eq('child_id', childId) : q.is('child_id', null);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as PlanRow | undefined;
  return row ? rowToPlan(row) : null;
}

export async function pushPlan(uid: string, plan: WeaningPlan): Promise<void> {
  const { error } = await db.from('weaning_plans').upsert(planToRow(uid, plan), { onConflict: 'id' });
  if (error) throw error;
}

export async function pushCheckins(uid: string, list: StoredCheckin[]): Promise<string[]> {
  if (!list.length) return [];
  const { error } = await db.from('weaning_checkins').upsert(list.map((c) => checkinToRow(uid, c)), { onConflict: 'id' });
  if (error) throw error;
  return list.map((c) => c.id);
}

/**
 * Reconcile the device state with the server: unsynced local changes win and are pushed; otherwise a newer
 * server plan (another device) replaces the local one. Never throws; returns the new state and whether all
 * pending changes reached the server.
 */
export async function syncWeaning(uid: string, childId: string | null, state: WeaningLocal): Promise<{ state: WeaningLocal; ok: boolean }> {
  let next = state;
  let ok = true;
  try {
    if (next.plan && next.planDirty) {
      await pushPlan(uid, next.plan);
      next = { ...next, planDirty: false };
    }
  } catch { ok = false; }
  try {
    const pending = next.checkins.filter((c) => !c.synced);
    if (pending.length) {
      const done = new Set(await pushCheckins(uid, pending));
      next = { ...next, checkins: next.checkins.map((c) => (done.has(c.id) ? { ...c, synced: true } : c)) };
    }
  } catch { ok = false; }
  if (ok) {
    try {
      const remote = await fetchPlan(uid, childId);
      const local = next.plan && (next.plan.childId ?? null) === (childId ?? null) ? next.plan : null;
      // A newer server plan (edited or created on another device) wins; local changes were pushed above.
      if (remote && (!local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt))) next = { ...next, plan: remote, planDirty: false };
    } catch { ok = false; }
  }
  return { state: next, ok };
}
