/**
 * Open the Tərbiyə tool directly on an item from elsewhere (Anacan.AI suggestion card). The target is held here
 * until the tool mounts; the mother's app opens it through the Tools tab, the partner app through its own screen.
 */
import { PUSH_NAV_EVENT, type PushNavIntent } from './pushNav';
import { type ParentingTarget, setParentingTarget } from './parenting-target';

export { type ParentingTarget, peekParentingTarget, clearParentingTarget } from './parenting-target';

export const PARTNER_PARENTING_SCREEN = 'partner-parenting';

export function openParentingTool(target: ParentingTarget | null, opts: { partner?: boolean } = {}) {
  setParentingTarget(target);
  const detail: PushNavIntent = opts.partner ? { screen: PARTNER_PARENTING_SCREEN } : { tool: 'parenting' };
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail }));
}

/**
 * The item a parsed Tərbiyə link names (anacan://parenting/<kind>/<id>, https://app.anacan.az/parenting/…):
 * parseDeeplink returns it as the parenting tool with parenting_kind / parenting_id params.
 */
export function parentingTargetFromDeeplink(parsed: { action: string; params: Record<string, string> } | null | undefined): ParentingTarget | null {
  if (!parsed || parsed.action !== 'tool' || parsed.params.tool_id !== 'parenting') return null;
  const kind = parsed.params.parenting_kind;
  const id = parsed.params.parenting_id;
  if (!['sos', 'article', 'programme'].includes(kind) || !/^[a-z0-9-]{1,60}$/.test(id || '')) return null;
  return { kind: kind as ParentingTarget['kind'], id };
}

/** Open a parsed Tərbiyə link: the mother's tool or the partner's screen, on that item. */
export function openParentingDeeplink(parsed: Parameters<typeof parentingTargetFromDeeplink>[0], opts: { partner?: boolean } = {}): boolean {
  const target = parentingTargetFromDeeplink(parsed);
  if (!target) return false;
  openParentingTool(target, opts);
  return true;
}

/** The app's own emotional-support tool (mood / EPDS test + support resources), opened like any tool link. */
export const MENTAL_HEALTH_TOOL = 'mental-health';
export function openMentalHealthTool() {
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { tool: MENTAL_HEALTH_TOOL } }));
}
