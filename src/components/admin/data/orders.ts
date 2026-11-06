import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { ilikeTerm, optionalRpc, RPC_MISSING, unwrap } from './rpc';

export type AdminOrder = Order & { items: OrderItem[]; cashback_used?: number | null };
export const ORDERS_PAGE_SIZE = 30;
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

/**
 * One page of orders + their items in exactly 2 requests.
 * Before: every order was loaded (fetchAllRows) and then one `order_items` request per order (N+1).
 */
export async function fetchOrdersPage(status: string, search: string, page: number) {
  let query = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const term = search.trim();
  if (term) {
    const like = ilikeTerm(term);
    query = query.or(`order_number.ilike.${like},phone.ilike.${like},shipping_address->>name.ilike.${like},shipping_address->>phone.ilike.${like}`);
  }
  const { data, count } = unwrap(await query.range(page * ORDERS_PAGE_SIZE, page * ORDERS_PAGE_SIZE + ORDERS_PAGE_SIZE - 1));
  const orders = data as unknown as AdminOrder[];
  const items = new Map<string, OrderItem[]>();
  if (orders.length) {
    const { data: rows } = unwrap(await supabase.from('order_items').select('*').in('order_id', orders.map(order => order.id)));
    for (const item of rows as unknown as OrderItem[]) items.set(item.order_id, [...(items.get(item.order_id) ?? []), item]);
  }
  return { rows: orders.map(order => ({ ...order, items: items.get(order.id) ?? [] })), total: count };
}

export interface OrderStats { total: number; byStatus: Record<string, number>; deliveredRevenue: number; cashbackUsed: number | null; source: 'rpc' | 'fallback' }

/** Counters for the header: one RPC, or head-only counts per status + a single-column scan of delivered totals. */
export async function fetchOrderStats(): Promise<OrderStats> {
  const data = await optionalRpc<{ total: number; by_status: Record<string, number>; delivered_revenue: number; cashback_used: number }>('admin_order_stats_v1');
  if (data !== RPC_MISSING && data) return { total: Number(data.total), byStatus: data.by_status ?? {}, deliveredRevenue: Number(data.delivered_revenue ?? 0), cashbackUsed: Number(data.cashback_used ?? 0), source: 'rpc' };
  const counts = await Promise.all(['all', ...ORDER_STATUSES].map(async status => {
    let query = supabase.from('orders').select('id', { count: 'exact', head: true });
    if (status !== 'all') query = query.eq('status', status);
    const { count } = await query;
    return [status, count ?? 0] as const;
  }));
  const delivered = await fetchAllRows<{ total_amount: number }>((from, to) => supabase.from('orders').select('total_amount').eq('status', 'delivered').range(from, to));
  const byStatus = Object.fromEntries(counts.filter(([status]) => status !== 'all'));
  return { total: counts[0][1], byStatus, deliveredRevenue: delivered.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), cashbackUsed: null, source: 'fallback' };
}

/** Same write as useAllOrders().updateOrderStatus (the QayğıCash status trigger reacts server-side). */
export async function setOrderStatus(orderId: string, status: Order['status']) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}
