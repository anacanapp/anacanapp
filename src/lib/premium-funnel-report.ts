// Pure aggregation for Admin › Premium funnel (admin_premium_funnel_v1, migration 20261125150000).
export interface FunnelRow { event: string; source: string; platform: string; country: string; life_stage: string; count: number }
export interface DailyRow { day: string; event: string; count: number }
export interface PurchaseRow { source: string; provider: string; platform: string; plan: string; first_purchase: boolean; currency: string | null; count: number; amount: number | string | null }
export interface IntentRow { source: string; platform: string; plan: string; count: number; users: number }
export interface CancellationRow { reason_code: string; cancel_flow: string; count: number; trials: number }
export interface FunnelReport { days: number; since: string; funnel: FunnelRow[]; daily: DailyRow[]; purchases: PurchaseRow[]; intents: IntentRow[]; cancellations: CancellationRow[] }
export interface Filters { platform: string; country: string; stage: string }
export interface SourceSummary { source: string; events: Record<string, number>; intents: number; purchases: number; firstPurchases: number; conversion: number | null }

export const FUNNEL_EVENTS = ['paywall_shown', 'paywall_clicked', 'purchase_started', 'epoint_started', 'purchase_cancelled', 'purchase_failed', 'purchase_pending', 'restore_clicked'] as const;

/** Per placement: funnel counts (filtered by platform / country / stage), buy taps and new (non-renewal) purchases. */
export function summariseBySource(report: Pick<FunnelReport, 'funnel' | 'purchases' | 'intents'>, filters: Filters): SourceSummary[] {
  const by = new Map<string, SourceSummary>();
  const row = (source: string) => {
    let value = by.get(source);
    if (!value) { value = { source, events: {}, intents: 0, purchases: 0, firstPurchases: 0, conversion: null }; by.set(source, value); }
    return value;
  };
  const platformOk = (p: string) => filters.platform === 'all' || p === filters.platform;
  for (const r of report.funnel) {
    if (!platformOk(r.platform) || (filters.country !== 'all' && r.country !== filters.country) || (filters.stage !== 'all' && r.life_stage !== filters.stage)) continue;
    const s = row(r.source);
    s.events[r.event] = (s.events[r.event] ?? 0) + r.count;
  }
  // Intents and purchases carry no country / stage (only platform), so only the platform filter applies to them.
  for (const r of report.intents) if (platformOk(r.platform)) row(r.source).intents += r.count;
  for (const r of report.purchases) {
    if (!platformOk(r.platform) || r.source === 'renewal' || r.provider === 'promo') continue;
    const s = row(r.source);
    s.purchases += r.count;
    if (r.first_purchase) s.firstPurchases += r.count;
  }
  for (const s of by.values()) {
    const shown = s.events.paywall_shown ?? 0;
    s.conversion = shown > 0 ? Math.round((s.purchases / shown) * 1000) / 10 : null;
  }
  return [...by.values()].sort((a, b) => (b.events.paywall_shown ?? 0) - (a.events.paywall_shown ?? 0) || b.purchases - a.purchases);
}
