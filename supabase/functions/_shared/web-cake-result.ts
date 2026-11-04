// Cake orders placed on anacan.az (cake_orders.channel = 'web') share the Epoint merchant Result URL.
// The callback signature is checked by epoint-payment; here the payment is confirmed with get-status and
// the amount must equal the server-priced total before the order is marked paid.
import { epointRequest, type EpointConfig } from './epoint.ts';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
export async function isWebCakeOrder(admin: any, orderId: unknown): Promise<boolean> {
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return false;
  const { data } = await admin.from('cake_orders').select('id').eq('id', orderId).eq('channel', 'web').maybeSingle();
  return !!data;
}

export type WebCakeResult = 'paid' | 'duplicate' | 'failed' | 'not_found' | 'not_confirmed';

// deno-lint-ignore no-explicit-any
export async function applyWebCakeResult(admin: any, config: EpointConfig, payload: Record<string, unknown>): Promise<WebCakeResult> {
  const orderId = typeof payload.order_id === 'string' && ORDER_ID.test(payload.order_id) ? payload.order_id : null;
  if (!orderId) return 'not_found';
  const { data: order } = await admin.from('cake_orders').select('id,total_price,payment_status').eq('id', orderId).eq('channel', 'web').maybeSingle();
  if (!order) return 'not_found';
  if (order.payment_status === 'paid') return 'duplicate';
  const now = new Date().toISOString();
  if (payload.status !== 'success') {
    await admin.from('cake_orders').update({ payment_status: 'failed', updated_at: now }).eq('id', orderId).eq('payment_status', 'pending');
    return 'failed';
  }
  const { result: status } = await epointRequest(config, 'get-status', { order_id: orderId });
  const paid = Number(status.amount ?? payload.amount);
  if (status.status !== 'success' || !Number.isFinite(paid) || Math.abs(paid - Number(order.total_price)) > 0.001) return 'not_confirmed';
  const { data: updated } = await admin.from('cake_orders').update({
    payment_status: 'paid', paid_at: now, updated_at: now,
    provider_transaction: typeof payload.transaction === 'string' ? payload.transaction.slice(0, 128) : null,
  }).eq('id', orderId).eq('payment_status', 'pending').select('id');
  return updated?.length ? 'paid' : 'duplicate';
}
