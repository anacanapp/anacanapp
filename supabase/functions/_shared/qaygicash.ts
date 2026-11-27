// QayğıCash (cashback) hooks used by edge functions. The ledger itself lives in SQL
// (migration 20261106150000_qaygicash): orders, cakes, books and web passes earn through status triggers;
// App Store / Google Play Premium earns here, from the authenticated RevenueCat webhook event.
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Admin = any;
const admin = (): Admin => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } });

const EARN_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE']);
const STORES = new Set(['APP_STORE', 'PLAY_STORE']);
const DAY = 86_400_000;

/** QC_* code from a Postgres error raised by the qc_* functions, else null. */
export function qcErrorCode(error: { message?: string } | null | undefined): string | null {
  const m = /\bQC_[A-Z_]+\b/.exec(error?.message || '');
  return m ? m[0] : null;
}

/** Plan of a store purchase from its period: 200+ days is yearly, 20+ days monthly; anything else earns nothing. */
export function storePlan(purchasedAtMs: unknown, expirationAtMs: unknown): 'yearly' | 'monthly' | null {
  if (typeof purchasedAtMs !== 'number' || typeof expirationAtMs !== 'number') return null;
  const days = (expirationAtMs - purchasedAtMs) / DAY;
  return days >= 200 ? 'yearly' : days >= 20 ? 'monthly' : null;
}

/**
 * Earn (purchase / renewal) or reverse (refund) for an authenticated RevenueCat webhook event.
 * Never throws: the entitlement sync already succeeded and must not be retried because of the bonus.
 */
export async function qaygicashFromStoreEvent(event: Record<string, unknown>): Promise<void> {
  try {
    const userId = event.app_user_id;
    const transaction = typeof event.transaction_id === 'string' ? event.transaction_id.slice(0, 150) : null;
    if (typeof userId !== 'string' || !transaction || event.environment !== 'PRODUCTION') return;
    if (event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT') {
      const { error } = await admin().rpc('qc_reverse_store_v1', { p_transaction: transaction });
      if (error) console.error('[qaygicash] reverse failed:', error.message.slice(0, 120));
      return;
    }
    if (!EARN_EVENTS.has(event.type as string) || !STORES.has(event.store as string)) return;
    if (event.period_type === 'TRIAL' || !(typeof event.price === 'number' && event.price > 0)) return;
    const plan = storePlan(event.purchased_at_ms, event.expiration_at_ms);
    const country = typeof event.country_code === 'string' ? event.country_code : '';
    if (!plan || !/^[A-Za-z]{2}$/.test(country)) return;
    const { error } = await admin().rpc('qc_earn_store_v1',
      { p_user: userId, p_transaction: transaction, p_plan: plan, p_country: country.toUpperCase() });
    if (error) console.error('[qaygicash] earn failed:', error.message.slice(0, 120));
  } catch (e) {
    console.error('[qaygicash] store event skipped:', e instanceof Error ? e.message.slice(0, 120) : 'unknown');
  }
}
