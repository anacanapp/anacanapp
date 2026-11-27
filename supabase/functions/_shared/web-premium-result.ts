// Premium passes bought in the anacan.az funnel with Epoint share the merchant Result URL with cakes and books.
// epoint-payment checks the callback signature; here the payment is confirmed with get-status, the paid amount
// must equal the server price on the order, and only then a fixed-term web_subscriptions row is written
// (web_premium_epoint_grant_v1, idempotent). The row is linked to the Anacan account with the same verified
// e-mail and the entitlement is synced, exactly like a Dodo web subscription.
import { epointRequest, type EpointConfig } from './epoint.ts';
import { syncEntitlementForUser } from './revenuecat-sync.ts';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
export async function isWebPremiumOrder(admin: any, orderId: unknown): Promise<boolean> {
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return false;
  const { data } = await admin.from('web_premium_orders').select('id').eq('id', orderId).maybeSingle();
  return !!data;
}

export type WebPremiumResult = 'paid' | 'duplicate' | 'failed' | 'not_found' | 'not_confirmed' | 'grant_failed';

// deno-lint-ignore no-explicit-any
export async function applyWebPremiumResult(admin: any, config: EpointConfig, payload: Record<string, unknown>): Promise<WebPremiumResult> {
  const orderId = typeof payload.order_id === 'string' && ORDER_ID.test(payload.order_id) ? payload.order_id : null;
  if (!orderId) return 'not_found';
  const { data: order } = await admin.from('web_premium_orders').select('id,amount,status').eq('id', orderId).maybeSingle();
  if (!order) return 'not_found';
  if (order.status === 'paid') return 'duplicate';
  const now = new Date().toISOString();
  if (payload.status !== 'success') {
    await admin.from('web_premium_orders').update({ status: 'failed', updated_at: now }).eq('id', orderId).eq('status', 'pending');
    return 'failed';
  }
  const { result: status } = await epointRequest(config, 'get-status', { order_id: orderId });
  const paid = Number(status.amount ?? payload.amount);
  if (status.status !== 'success' || !Number.isFinite(paid) || Math.abs(paid - Number(order.amount)) > 0.001) return 'not_confirmed';
  const transaction = typeof payload.transaction === 'string' ? payload.transaction.slice(0, 128) : null;
  const { data: subscriptionId, error } = await admin.rpc('web_premium_epoint_grant_v1', { p_order_id: orderId, p_transaction: transaction, p_amount: paid });
  if (error || typeof subscriptionId !== 'string') {
    console.error('[web-premium] grant failed:', error?.message?.slice(0, 120) ?? 'no subscription');
    return 'grant_failed';
  }
  // Link to the account with this verified e-mail (Google/Apple identity or code-verified e-mail); otherwise
  // the pass waits and is linked when that account signs in (web_subscription_link_user_v1).
  const { data: userId } = await admin.rpc('web_subscription_link_email_v1', { p_subscription_id: subscriptionId });
  if (typeof userId === 'string' && userId) {
    const sync = await syncEntitlementForUser(userId);
    if (!sync.ok) console.error('[web-premium] entitlement sync failed:', sync.reason);
  }
  return 'paid';
}
