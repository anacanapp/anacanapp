/**
 * The Tərbiyə item the tool should open on next (from Anacan.AI, a programme reminder tap or the home card).
 * Kept in its own module so pushNav can set it without importing parenting-nav (which imports pushNav).
 */
export type ParentingTarget = { kind: 'sos' | 'article' | 'programme'; id: string };

const ID = /^[a-z0-9-]{1,60}$/;
let pending: ParentingTarget | null = null;

export function setParentingTarget(target: ParentingTarget | null) {
  pending = target && ID.test(target.id) ? target : null;
}
/** Read on mount; cleared after mount so StrictMode re-renders still see it. */
export const peekParentingTarget = () => pending;
export const clearParentingTarget = () => { pending = null; };
