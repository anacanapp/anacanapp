import { supabase } from '@/integrations/supabase/client';
import { optionalRpc, RPC_MISSING } from './rpc';

export interface ActivityItem { kind: 'signup' | 'order' | 'support' | 'cake' | 'book'; id: string; title: string; detail?: string; amount?: number; at: string }
export interface AdminOverview {
  source: 'rpc' | 'fallback';
  users_total: number | null; users_today: number | null; users_7d: number | null; users_prev_7d: number | null; premium_active: number | null;
  active_today: number | null; active_7d: number | null; active_prev_7d: number | null;
  orders_pending: number | null; orders_processing: number | null; orders_today: number | null; orders_today_revenue: number | null;
  cakes_pending: number | null; cakes_paid_today: number | null; cakes_paid_today_revenue: number | null;
  books_pending: number | null; books_paid_today: number | null; books_paid_today_revenue: number | null;
  qc_available_minor: number | null; qc_pending_minor: number | null;
  support_open: number | null; support_new: number | null; moderation_pending: number | null; ad_review_pending: number | null; crashes_24h: number | null;
  signups_series: number[]; orders_series: number[]; active_series: number[];
  recent: ActivityItem[]; generated_at: string;
}

const NUMERIC_KEYS: Array<keyof AdminOverview> = ['users_total', 'users_today', 'users_7d', 'users_prev_7d', 'premium_active', 'active_today', 'active_7d', 'active_prev_7d',
  'orders_pending', 'orders_processing', 'orders_today', 'orders_today_revenue', 'cakes_pending', 'cakes_paid_today', 'cakes_paid_today_revenue', 'books_pending',
  'books_paid_today', 'books_paid_today_revenue', 'qc_available_minor', 'qc_pending_minor', 'support_open', 'support_new', 'moderation_pending', 'ad_review_pending', 'crashes_24h'];

function normalize(raw: Record<string, unknown>, source: AdminOverview['source']): AdminOverview {
  const result = { source, recent: [], signups_series: [], orders_series: [], active_series: [], generated_at: new Date().toISOString() } as unknown as AdminOverview;
  for (const key of NUMERIC_KEYS) {
    const value = raw[key];
    (result as unknown as Record<string, unknown>)[key] = value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  }
  for (const key of ['signups_series', 'orders_series', 'active_series'] as const) result[key] = Array.isArray(raw[key]) ? (raw[key] as unknown[]).map(Number) : [];
  result.recent = Array.isArray(raw.recent) ? (raw.recent as ActivityItem[]) : [];
  if (typeof raw.generated_at === 'string') result.generated_at = raw.generated_at;
  return result;
}

/** Baku midnight (UTC+4, no DST) as ISO — matches the RPC's day boundary. */
export function bakuDayStart(now = new Date(), daysBack = 0) {
  const baku = new Date(now.getTime() + 4 * 3600_000);
  return new Date(Date.UTC(baku.getUTCFullYear(), baku.getUTCMonth(), baku.getUTCDate() - daysBack) - 4 * 3600_000).toISOString();
}

type CountQuery = PromiseLike<{ count: number | null; error: unknown }>;
const count = async (query: CountQuery) => { try { const { count, error } = await query; return error ? null : count ?? 0; } catch { return null; } };
const head = (table: string) => (supabase.from(table as never) as unknown as { select: (c: string, o: object) => any }).select('id', { count: 'exact', head: true });

/**
 * Fallback when admin_overview_v1 is not deployed: ~16 parallel `count: exact, head: true` queries (no rows
 * transferred) plus a few `limit 5` reads for the activity feed. Active-user counts need DISTINCT over
 * analytics_events and are only available from the RPC.
 */
export async function fetchOverviewFallback(now = new Date()): Promise<AdminOverview> {
  const today = bakuDayStart(now), week = bakuDayStart(now, 6), prevWeek = bakuDayStart(now, 13), dayAgo = new Date(now.getTime() - 86400_000).toISOString();
  const [usersTotal, usersToday, users7d, usersPrev7d, premium, ordersPending, ordersProcessing, cakesPending, supportOpen, supportNew, moderation, crashes, booksPending] = await Promise.all([
    count(head('profiles')),
    count(head('profiles').gte('created_at', today)),
    count(head('profiles').gte('created_at', week)),
    count(head('profiles').gte('created_at', prevWeek).lt('created_at', week)),
    count(head('profiles').eq('is_premium', true)),
    count(head('orders').eq('status', 'pending')),
    count(head('orders').in('status', ['confirmed', 'processing', 'shipped'])),
    count(head('cake_orders').eq('status', 'pending')),
    count(head('support_tickets').in('status', ['open', 'in_progress'])),
    count(head('support_tickets').eq('status', 'open')),
    count(head('post_reports').eq('status', 'pending')),
    count(head('crash_reports').gte('created_at', dayAgo)),
    count(head('book_orders').eq('status', 'pending').gte('created_at', new Date(now.getTime() - 2 * 86400_000).toISOString())),
  ]);
  const safe = async <T,>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => { try { const { data, error } = await promise; return error ? [] : data ?? []; } catch { return []; } };
  const from = (table: string) => supabase.from(table as never) as unknown as { select: (c: string) => any };
  const [todayOrders, recentProfiles, recentOrders, recentTickets, recentCakes, todayCakes, qc] = await Promise.all([
    safe<{ total_amount: number; status: string }>(from('orders').select('total_amount, status').gte('created_at', today).neq('status', 'cancelled').limit(1000)),
    safe<{ user_id: string; name: string | null; life_stage: string | null; created_at: string }>(from('profiles').select('user_id, name, life_stage, created_at').order('created_at', { ascending: false }).limit(5)),
    safe<{ id: string; order_number: string; status: string; total_amount: number; created_at: string }>(from('orders').select('id, order_number, status, total_amount, created_at').order('created_at', { ascending: false }).limit(5)),
    safe<{ id: string; subject: string; status: string | null; created_at: string }>(from('support_tickets').select('id, subject, status, created_at').order('created_at', { ascending: false }).limit(5)),
    safe<{ id: string; customer_name: string; status: string; total_price: number; created_at: string }>(from('cake_orders').select('id, customer_name, status, total_price, created_at').order('created_at', { ascending: false }).limit(5)),
    safe<{ total_price: number }>(from('cake_orders').select('total_price').gte('created_at', today).eq('payment_status', 'paid').limit(1000)),
    optionalRpc<{ liability_available_minor?: number; liability_pending_minor?: number }>('qaygicash_admin_overview_v1').catch(() => RPC_MISSING),
  ]);
  const recent: ActivityItem[] = [
    ...recentProfiles.map(row => ({ kind: 'signup' as const, id: row.user_id, title: row.name || 'Yeni istifadəçi', detail: row.life_stage ?? '', at: row.created_at })),
    ...recentOrders.map(row => ({ kind: 'order' as const, id: row.id, title: row.order_number, detail: row.status, amount: Number(row.total_amount), at: row.created_at })),
    ...recentTickets.map(row => ({ kind: 'support' as const, id: row.id, title: row.subject, detail: row.status ?? '', at: row.created_at })),
    ...recentCakes.map(row => ({ kind: 'cake' as const, id: row.id, title: row.customer_name, detail: row.status, amount: Number(row.total_price), at: row.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const qcData = typeof qc === 'object' && qc ? qc : null;
  return normalize({
    users_total: usersTotal, users_today: usersToday, users_7d: users7d, users_prev_7d: usersPrev7d, premium_active: premium,
    orders_pending: ordersPending, orders_processing: ordersProcessing, orders_today: todayOrders.length,
    orders_today_revenue: todayOrders.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    cakes_pending: cakesPending, cakes_paid_today: todayCakes.length, cakes_paid_today_revenue: todayCakes.reduce((sum, row) => sum + Number(row.total_price || 0), 0),
    books_pending: booksPending, qc_available_minor: qcData?.liability_available_minor ?? null, qc_pending_minor: qcData?.liability_pending_minor ?? null,
    support_open: supportOpen, support_new: supportNew, moderation_pending: moderation, crashes_24h: crashes, recent,
  }, 'fallback');
}

/** One RPC round-trip when deployed; otherwise the bounded fallback above. */
export async function fetchOverview(): Promise<AdminOverview> {
  const data = await optionalRpc<Record<string, unknown>>('admin_overview_v1');
  if (data === RPC_MISSING || !data || typeof data !== 'object') return fetchOverviewFallback();
  return normalize(data, 'rpc');
}
