import { supabase } from '@/integrations/supabase/client';
import { ilikeTerm, optionalRpc, RPC_MISSING, unwrap } from './rpc';

export type AppRole = 'admin' | 'moderator' | 'user';
export interface AdminUserRow {
  id: string; user_id: string; name: string; email: string | null; life_stage: string | null; partner_code: string | null; created_at: string;
  is_premium?: boolean | null; premium_until?: string | null; country_code?: string | null; avatar_url?: string | null; badge_type?: string | null;
  is_verified?: boolean | null; role: AppRole;
}
export interface UserFilters { search: string; stage: string; premium: 'all' | 'premium' | 'free'; role: 'all' | 'admin' | 'moderator'; country: string }
export const emptyUserFilters: UserFilters = { search: '', stage: 'all', premium: 'all', role: 'all', country: '' };
export const USERS_PAGE_SIZE = 50;

const profiles = () => supabase.from('profiles');

/**
 * Server-side page of profiles (was: every profile + every role loaded into the browser).
 * 2 requests per page: profiles (count exact, range) and user_roles for the ≤50 ids on the page.
 */
export async function fetchUsersPage(filters: UserFilters, page: number, sort: { key: string; dir: 'asc' | 'desc' } | null) {
  let roleIds: string[] | null = null;
  if (filters.role !== 'all') {
    const { data } = unwrap(await supabase.from('user_roles').select('user_id').eq('role', filters.role).limit(1000));
    roleIds = (data as Array<{ user_id: string }>).map(row => row.user_id);
    if (!roleIds.length) return { rows: [] as AdminUserRow[], total: 0 };
  }
  let query = profiles().select('*', { count: 'exact' });
  const term = filters.search.trim();
  if (term) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
    query = uuid ? query.or(`user_id.eq.${term},id.eq.${term}`) : query.or(`name.ilike.${ilikeTerm(term)},email.ilike.${ilikeTerm(term)}`);
  }
  if (filters.stage === 'none') query = query.is('life_stage', null);
  else if (filters.stage !== 'all') query = query.eq('life_stage', filters.stage);
  if (filters.premium === 'premium') query = query.eq('is_premium', true);
  else if (filters.premium === 'free') query = query.or('is_premium.is.null,is_premium.eq.false');
  if (filters.country) query = query.eq('country_code', filters.country);
  if (roleIds) query = query.in('user_id', roleIds);
  const column = sort?.key === 'name' ? 'name' : 'created_at';
  query = query.order(column, { ascending: sort ? sort.dir === 'asc' : false, nullsFirst: false });
  const { data, count } = unwrap(await query.range(page * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE + USERS_PAGE_SIZE - 1));
  const rows = data as unknown as Omit<AdminUserRow, 'role'>[];
  const roles = new Map<string, AppRole>();
  if (rows.length) {
    const { data: roleRows } = unwrap(await supabase.from('user_roles').select('user_id, role').in('user_id', rows.map(row => row.user_id)));
    for (const row of roleRows as Array<{ user_id: string; role: AppRole }>) {
      const previous = roles.get(row.user_id);
      if (row.role === 'admin' || (row.role === 'moderator' && previous !== 'admin')) roles.set(row.user_id, row.role);
    }
  }
  return { rows: rows.map(row => ({ ...row, role: roles.get(row.user_id) ?? 'user' })) as AdminUserRow[], total: count };
}

/** Header counters: 2 head-only count queries. */
export async function fetchUserCounts() {
  const [all, premium] = await Promise.all([
    profiles().select('id', { count: 'exact', head: true }),
    profiles().select('id', { count: 'exact', head: true }).eq('is_premium', true),
  ]);
  return { total: all.count ?? 0, premium: premium.count ?? 0 };
}

export interface UserDetail {
  profile: Record<string, unknown> | null; roles: string[]; subscriptions: Array<Record<string, unknown>>;
  children: Array<{ id: string; name: string; birth_date: string | null; due_date: string | null; gender: string | null; is_active: boolean | null }>;
  orders?: number; support_tickets?: number; last_seen?: string | null; qaygicash?: { available_minor: number; pending_minor: number } | null; source: 'rpc' | 'fallback';
}

/** Drawer details: one RPC when deployed, otherwise three small direct reads (subject to existing RLS). */
export async function fetchUserDetail(userId: string): Promise<UserDetail> {
  const data = await optionalRpc<Omit<UserDetail, 'source'>>('admin_user_detail_v1', { p_user: userId });
  if (data !== RPC_MISSING && data) return { ...data, source: 'rpc' };
  const read = async <T,>(promise: PromiseLike<{ data: T[] | null; error: unknown }>) => { try { const { data, error } = await promise; return error ? [] : data ?? []; } catch { return []; } };
  const [profile, roles, subscriptions, children] = await Promise.all([
    read<Record<string, unknown>>(profiles().select('*').eq('user_id', userId).limit(1)),
    read<{ role: string }>(supabase.from('user_roles').select('role').eq('user_id', userId)),
    read<Record<string, unknown>>(supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)),
    read<UserDetail['children'][number]>(supabase.from('user_children').select('id, name, birth_date, due_date, gender, is_active').eq('user_id', userId).limit(20)),
  ]);
  return { profile: profile[0] ?? null, roles: roles.map(row => row.role), subscriptions, children, source: 'fallback' };
}
