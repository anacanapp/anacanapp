/**
 * Open the Tərbiyə tool directly on an item from elsewhere (Anacan.AI suggestion card). The target is held here
 * until the tool mounts; the mother's app opens it through the Tools tab, the partner app through its own screen.
 */
import { PUSH_NAV_EVENT, type PushNavIntent } from './pushNav';

export type ParentingTarget = { kind: 'sos' | 'article' | 'programme'; id: string };

let pending: ParentingTarget | null = null;

export const PARTNER_PARENTING_SCREEN = 'partner-parenting';

export function openParentingTool(target: ParentingTarget | null, opts: { partner?: boolean } = {}) {
  pending = target;
  const detail: PushNavIntent = opts.partner ? { screen: PARTNER_PARENTING_SCREEN } : { tool: 'parenting' };
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail }));
}

/** The item the tool should open on (read on mount; cleared after mount so StrictMode re-renders still see it). */
export const peekParentingTarget = () => pending;
export const clearParentingTarget = () => { pending = null; };
