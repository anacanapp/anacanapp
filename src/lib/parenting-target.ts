/**
 * The Tərbiyə item the tool should open on next (from Anacan.AI, a programme reminder tap or the home card).
 * Kept in its own module so pushNav can set it without importing parenting-nav (which imports pushNav).
 */
export type ParentingTarget = {
  kind: 'sos' | 'article' | 'programme';
  id: string;
  /** The child the item is for (a running programme of a sibling); the tool switches to that child. */
  child?: string;
};

const ID = /^[a-z0-9-]{1,60}$/;
const CHILD = /^[A-Za-z0-9-]{1,64}$/;
let pending: ParentingTarget | null = null;

export function setParentingTarget(target: ParentingTarget | null) {
  if (!target || !ID.test(target.id)) { pending = null; return; }
  pending = target.child && CHILD.test(target.child) ? { kind: target.kind, id: target.id, child: target.child } : { kind: target.kind, id: target.id };
}
/** Read on mount; cleared after mount so StrictMode re-renders still see it. */
export const peekParentingTarget = () => pending;
export const clearParentingTarget = () => { pending = null; };
