/**
 * Tərbiyə account sync: the device copy (localStorage) stays the source the UI reads — optimistic and offline —
 * and is merged with public.parenting_state (one row per account, RLS own row only) in the background.
 *
 * Merge rules (commutative, so two phones converge), applied to the account-level slot and to every child slot:
 *  - band: the newest choice (bandAt), with the child band it was chosen for (bandFor);
 *  - programmes: per programme the newest change of the same run (so an undo sticks); runs started on different
 *    days keep the copy with more checked-off days, on a tie the newer change;
 *    a restart tombstone newer than the progress removes it;
 *  - quizzes: per quiz the newest result;
 *  - bookmarks (account level, shared by all children): union, minus refs whose removal is newer than their add;
 *    newest first;
 *  - rootChild (the child the account-level fields belong to): the earliest claim;
 *  - children: union of child ids, each slot merged by the rules above;
 *  - the reminder preference never leaves the phone.
 * Older app versions read and write only the account-level fields, which stay the root child's data.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  type ChildSlot, type ParentingLocal, type ProgrammeProgress, EMPTY_PARENTING, capMarks, sanitizeParenting,
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
  // Same run (same start day): the newest change wins, so an undo on one phone is not reverted by the other copy.
  if (a.startedAt === b.startedAt && a.updatedAt !== b.updatedAt) return newer(a.updatedAt, b.updatedAt) ? a : b;
  if (a.done.length !== b.done.length) return a.done.length > b.done.length ? a : b;
  return newer(a.updatedAt, b.updatedAt) ? a : b;
}

/** Merge one slot (local first: ties keep the local copy). `removed` is the already merged tombstone map. */
function mergeSlot(local: ChildSlot, remote: ChildSlot, removed: Record<string, string>): ChildSlot {
  const programmes: Record<string, ProgrammeProgress> = {};
  for (const id of new Set([...Object.keys(local.programmes), ...Object.keys(remote.programmes)])) {
    const pick = betterProgress(local.programmes[id], remote.programmes[id]);
    const gone = removed[`p:${id}`];
    if (pick && !(gone && gone > pick.updatedAt)) programmes[id] = pick;
  }

  const quizzes: ChildSlot['quizzes'] = { ...remote.quizzes };
  for (const [id, q] of Object.entries(local.quizzes)) if (!quizzes[id] || newer(q.at, quizzes[id].at)) quizzes[id] = q;

  const bandSide = newer(local.bandAt, remote.bandAt) ? local : remote;
  const out: ChildSlot = { band: bandSide.band, programmes, quizzes };
  if (bandSide.bandAt) out.bandAt = bandSide.bandAt;
  if (bandSide.bandFor !== undefined) out.bandFor = bandSide.bandFor;
  return out;
}

/** The earliest claim of the account-level fields wins (ties: the smaller child id), so phones converge. */
function pickRoot(a: ParentingLocal, b: ParentingLocal): Pick<ParentingLocal, 'rootChild' | 'rootChildAt'> {
  if (!a.rootChild) return b.rootChild ? { rootChild: b.rootChild, rootChildAt: b.rootChildAt } : {};
  if (!b.rootChild) return { rootChild: a.rootChild, rootChildAt: a.rootChildAt };
  const ka = `${a.rootChildAt || '~'}|${a.rootChild}`;
  const kb = `${b.rootChildAt || '~'}|${b.rootChild}`;
  return ka <= kb ? { rootChild: a.rootChild, rootChildAt: a.rootChildAt } : { rootChild: b.rootChild, rootChildAt: b.rootChildAt };
}

const pick = (m: Record<string, string> | undefined, prefix: string) =>
  Object.fromEntries(Object.entries(m || {}).filter(([k]) => k.startsWith(prefix)));

/** One side's slots seen from the merged root owner: the root slot and every other child's slot. */
function rebase(side: ParentingLocal, owner: string | undefined): { root: ChildSlot; children: Record<string, ChildSlot> } {
  const rootSlot: ChildSlot = { band: side.band, programmes: side.programmes, quizzes: side.quizzes, removed: pick(side.removed, 'p:') };
  if (side.bandAt) rootSlot.bandAt = side.bandAt;
  if (side.bandFor !== undefined) rootSlot.bandFor = side.bandFor;
  const children = { ...(side.children || {}) };
  if (!owner || !side.rootChild || side.rootChild === owner) {
    // No claim on this side yet: its account-level data is the owner's (data from before multi-child support).
    if (owner && children[owner]) delete children[owner];
    return { root: rootSlot, children };
  }
  // This side's account-level data belonged to another child, which lost the claim: it moves to that child.
  children[side.rootChild] = rootSlot;
  const root = children[owner] ?? { band: null, programmes: {}, quizzes: {} };
  delete children[owner];
  return { root, children };
}

/** Merge two slots with their tombstones (one side may be missing). */
function mergeSlots(a: ChildSlot | undefined, b: ChildSlot | undefined): ChildSlot {
  const gone = maxMarks(a?.removed, b?.removed);
  const x = a ?? b!;
  const slot = mergeSlot(x, b ?? x, gone);
  if (Object.keys(gone).length) slot.removed = gone;
  return slot;
}

/** Merge two states (local first: ties keep the local copy; the local reminder preference is kept). */
export function mergeParenting(local: ParentingLocal, remote: ParentingLocal): ParentingLocal {
  const owner = pickRoot(local, remote);
  const l = rebase(local, owner.rootChild);
  const r = rebase(remote, owner.rootChild);
  const root = mergeSlots(l.root, r.root);
  const bookmarkGone = maxMarks(pick(local.removed, 's:'), pick(remote.removed, 's:'));
  const savedAt = maxMarks(local.savedAt, remote.savedAt);

  const order = [...local.saved, ...remote.saved.filter((x) => !local.saved.includes(x))];
  const saved = order
    .filter((ref) => { const gone = bookmarkGone[`s:${ref}`]; return !gone || (savedAt[ref] || '') > gone; })
    .map((ref, i) => ({ ref, i, at: savedAt[ref] || '' }))
    .sort((x, y) => (x.at === y.at ? x.i - y.i : x.at < y.at ? 1 : -1))
    .map((x) => x.ref)
    .slice(0, 200);
  const keptAt = Object.fromEntries(Object.entries(savedAt).filter(([ref]) => saved.includes(ref)));

  const { removed: rootGone, ...rootRest } = root;
  const out: ParentingLocal = { v: 1, ...rootRest, saved };
  if (Object.keys(keptAt).length) out.savedAt = keptAt;
  const removed = capMarks({ ...bookmarkGone, ...(rootGone || {}) });
  if (Object.keys(removed).length) out.removed = removed;
  if (owner.rootChild) {
    out.rootChild = owner.rootChild;
    if (owner.rootChildAt) out.rootChildAt = owner.rootChildAt;
  }

  const children: Record<string, ChildSlot> = {};
  for (const id of new Set([...Object.keys(l.children), ...Object.keys(r.children)])) children[id] = mergeSlots(l.children[id], r.children[id]);
  if (Object.keys(children).length) out.children = children;

  if (local.reminder) out.reminder = local.reminder;
  if (local.dirty) out.dirty = true;
  return out;
}

/** What goes to the server: everything except device-only fields. */
export function toServerState(s: ParentingLocal): Omit<ParentingLocal, 'dirty' | 'reminder'> {
  const { dirty: _dirty, reminder: _reminder, ...rest } = s;
  return rest;
}

/** JSON with sorted object keys (arrays keep their order), so equal states compare equal. */
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};

export const sameServerState = (a: ParentingLocal, b: ParentingLocal) => canonical(toServerState(a)) === canonical(toServerState(b));

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
    const untouched = !remote && !local.dirty && sameServerState(local, EMPTY_PARENTING());
    if (!untouched && (!remote || !sameServerState(merged, remote))) await pushRemoteParenting(uid, merged);
    const { dirty: _dirty, ...clean } = merged;
    return { state: clean, ok: true };
  } catch {
    return { state: local, ok: false };
  }
}
