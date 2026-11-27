import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

/**
 * Server-side Premium funnel (migration 20261125150000). Two fire-and-forget calls, never awaited, never throwing:
 *
 *  - funnelHit(event, source): adds 1 to premium_funnel_daily (day × event × source × platform × stage × country).
 *    No user id is stored in the counters, so this works inside the privacy model without analytics consent
 *    (consent-gated product analytics stay in src/lib/analytics.ts). The server counts "paywall_shown" at most once per
 *    source per 10 minutes and every other event at most once per 10 seconds.
 *  - purchaseIntent(source, plan): the buy tap. A transactional record the server uses to attribute the purchase that
 *    follows (premium_purchases.source, 48 h window).
 *
 * `source` is the paywall placement (tool id, 'onboarding', 'billing', 'banner', …); it is normalised to [a-z0-9_:.-].
 */
export type FunnelEvent = 'paywall_shown' | 'paywall_clicked' | 'purchase_started' | 'purchase_cancelled'
  | 'purchase_failed' | 'purchase_pending' | 'restore_clicked' | 'epoint_started';
export type FunnelPlan = 'monthly' | 'yearly' | 'lifetime' | 'offer';

const EVENTS: readonly FunnelEvent[] = ['paywall_shown', 'paywall_clicked', 'purchase_started', 'purchase_cancelled',
  'purchase_failed', 'purchase_pending', 'restore_clicked', 'epoint_started'];
const STAGES = ['flow', 'bump', 'mommy', 'partner'];

/** Same normalisation as public._premium_funnel_source. */
export function normaliseFunnelSource(source: unknown): string {
  const value = (typeof source === 'string' ? source : '').trim().toLowerCase().replace(/[^a-z0-9_:.-]+/g, '_').slice(0, 48);
  return /^[a-z0-9_:.-]{1,48}$/.test(value) ? value : 'other';
}

export function funnelPlatform(): 'ios' | 'android' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android' ? platform : 'web';
  } catch { return 'web'; }
}

export function funnelLifeStage(): string | null {
  try {
    const stage = useUserStore.getState().lifeStage;
    return stage && STAGES.includes(stage) ? stage : null;
  } catch { return null; }
}

// The server throttles too; this only saves the request when a paywall re-renders or reopens quickly.
const SHOWN_GAP_MS = 10 * 60_000;
const OTHER_GAP_MS = 2_000;
const lastSent = new Map<string, number>();

function due(key: string, gap: number, now: number): boolean {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < gap) return false;
  lastSent.set(key, now);
  if (lastSent.size > 200) for (const [k, at] of lastSent) if (now - at > SHOWN_GAP_MS) lastSent.delete(k);
  return true;
}

function fire(name: string, args: Record<string, unknown>): void {
  try {
    const call = (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => PromiseLike<unknown>)(name, args);
    Promise.resolve(call).then(() => undefined, () => undefined);
  } catch { /* never block the paywall */ }
}

export function funnelHit(event: FunnelEvent, source: string | null | undefined, now = Date.now()): void {
  try {
    if (!EVENTS.includes(event)) return;
    const src = normaliseFunnelSource(source);
    if (!due(`${event}|${src}`, event === 'paywall_shown' ? SHOWN_GAP_MS : OTHER_GAP_MS, now)) return;
    fire('premium_funnel_hit_v1', { p_event: event, p_source: src, p_platform: funnelPlatform(), p_life_stage: funnelLifeStage() });
  } catch { /* never block the paywall */ }
}

export function purchaseIntent(source: string | null | undefined, plan: FunnelPlan | string, now = Date.now()): void {
  try {
    const src = normaliseFunnelSource(source);
    const value = ['monthly', 'yearly', 'lifetime', 'offer'].includes(plan) ? plan : 'unknown';
    if (!due(`intent|${src}|${value}`, OTHER_GAP_MS, now)) return;
    fire('premium_purchase_intent_v1', { p_source: src, p_platform: funnelPlatform(), p_plan: value });
  } catch { /* never block the purchase */ }
}

/** Test helper: forget the client-side throttle. */
export function resetFunnelThrottle(): void { lastSent.clear(); }
