// A quick action tapped on a home-screen widget (anacan://tool/<tool>?widget_action=feed|sleep|diaper).
// The deep link handler stores it; the opened tool consumes it once on mount.
export type WidgetAction = 'feed' | 'sleep' | 'diaper';
let pending: { action: WidgetAction; at: number } | null = null;

export function setPendingWidgetAction(action: string | null | undefined): void {
  pending = action === 'feed' || action === 'sleep' || action === 'diaper' ? { action, at: Date.now() } : null;
}

/** The pending action if it is fresh (within 30 s), cleared on read. */
export function consumeWidgetAction(): WidgetAction | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < 30_000 ? p.action : null;
}
