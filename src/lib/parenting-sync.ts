/**
 * Tərbiyə account sync: the device copy (localStorage) stays the source the UI reads — optimistic and offline —
 * and is merged with public.parenting_state (one row per account, RLS own row only) in the background.
 *
 * Merge rules (commutative, so two phones converge):
 *  - band: the newest choice (bandAt);
 *  - programmes: per programme the copy with more checked-off days (max progress), on a tie the newer change;
 *    a restart tombstone newer than the progress removes it;
 *  - quizzes: per quiz the newest result;
 *  - bookmarks: union, minus refs whose removal is newer than their add; newest first;
 *  - the reminder preference never leaves the phone.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  type ParentingLocal, type ProgrammeProgress, capMarks, sanitizeParenting,
} from './parenting';

const newer = (a: string | undefined, b: string | undefined) => (a || '') >= (b || '');

function maxMarks(a: Record<string, string> | undefined, b: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) if (!out[k] || v > out[k]) out[k] = v;
  return capMarks(out);
}

function betterProgress(a: ProgrammeProgress | undefined, b: ProgrammeProgress | undefined): ProgrammeProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.done.length !== b.done.length) return a.done.length > b.done.length ? a : b;
  return newer(a.updatedAt, b.updatedAt) ? a : b;
}

/** Merge two states (local first: ties keep the local copy; the local reminder preference is kept). */
export function mergeParenting(local: ParentingLocal, remote: ParentingLocal): ParentingLocal {
  const removed = maxMarks(local.removed, remote.removed);
  const savedAt = maxMarks(local.savedAt, remote.savedAt);

  const programmes: Record<string, ProgrammeProgress> = {};
  for (const id of new Set([...Object.keys(local.programmes), ...Object.keys(remote.programmes)])) {
    const pick = betterProgress(local.programmes[id], remote.programmes[id]);
    const gone = removed[`p:${id}`];
    if (pick && !(gone && gone > pick.updatedAt)) programmes[id] = pick;
  }

  const quizzes: ParentingLocal['quizzes'] = { ...remote.quizzes };
  for (const [id, q] of Object.entries(local.quizzes)) if (!quizzes[id] || newer(q.at, quizzes[id].at)) quizzes[id] = q;

  const order = [...local.saved, ...remote.saved.filter((r) => !local.saved.includes(r))];
  const saved = order
    .filter((ref) => { const gone = removed[`s:${ref}`]; return !gone || (savedAt[ref] || '') > gone; })
    .map((ref, i) => ({ ref, i, at: savedAt[ref] || '' }))
    .sort((x, y) => (x.at === y.at ? x.i - y.i : x.at < y.at ? 1 : -1))
    .map((x) => x.ref)
    .slice(0, 200);
  const keptAt = Object.fromEntries(Object.entries(savedAt).filter(([ref]) => saved.includes(ref)));

  const bandLocal = newer(local.bandAt, remote.bandAt);
  const out: ParentingLocal = {
    v: 1,
    band: bandLocal ? local.band : remote.band,
    programmes,
    quizzes,
    saved,
  };
  const bandAt = bandLocal ? local.bandAt : remote.bandAt;
  if (bandAt) out.bandAt = bandAt;
  if (Object.keys(keptAt).length) out.savedAt = keptAt;
  if (Object.keys(removed).length) out.removed = removed;
  if (local.reminder) out.reminder = local.reminder;
  if (local.dirty) out.dirty = true;
  return out;
}

/** What goes to the server: everything except device-only fields. */
export function toServerState(s: ParentingLocal): Omit<ParentingLocal, 'dirty' | 'reminder'> {
  const { dirty: _dirty, reminder: _reminder, ...rest } = s;
  return rest;
}

export const sameServerState = (a: ParentingLocal, b: ParentingLocal) =>
  JSON.stringify(toServerState(a)) === JSON.stringify(toServerState(b));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table newer than the generated types
const db = supabase as unknown as { from: (table: string) => any };

export async function fetchRemoteParenting(uid: string): Promise<ParentingLocal | null> {
  const { data, error } = await db.from('parenting_state').select('state, updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? sanitizeParenting((data as { state: unknown }).state) : null;
}

export async function pushRemoteParenting(uid: string, s: ParentingLocal): Promise<void> {
  const { error } = await db.from('parenting_state')
    .upsert({ user_id: uid, state: toServerState(s), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/**
 * Fetch → merge → push when the server copy differs. Never throws: on failure the local state comes back
 * unchanged (still dirty) with ok = false, and the next attempt retries.
 */
export async function syncParenting(uid: string, local: ParentingLocal): Promise<{ state: ParentingLocal; ok: boolean }> {
  try {
    const remote = await fetchRemoteParenting(uid);
    const merged = remote ? mergeParenting(local, remote) : local;
    const untouched = !remote && !local.dirty && sameServerState(local, { v: 1, band: null, programmes: {}, quizzes: {}, saved: [] });
    if (!untouched && (!remote || !sameServerState(merged, remote))) await pushRemoteParenting(uid, merged);
    const { dirty: _dirty, ...clean } = merged;
    return { state: clean, ok: true };
  } catch {
    return { state: local, ok: false };
  }
}
