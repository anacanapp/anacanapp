import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Eye, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { EmptyState, ErrorState, KpiRow, Section, SelectFilter, SkeletonRows, StatTile, StatusPill, fmtNumber } from './kit';
import { ADMIN_QUERY, optionalRpc, RPC_MISSING } from './data/rpc';

interface UsageUser { user_id: string; count: number; name?: string; email?: string; is_premium?: boolean; last_used?: string }
interface Usage { total: number; uniqueUsers: number; premiumUsers: number; daily: Array<{ date: string; count: number }>; breakdown: Array<{ label: string; count: number }>; users: UsageUser[]; sampled: boolean; source: 'rpc' | 'fallback' }

interface AdminUsageStatsProps {
  /** Event names to filter by */
  eventNames: string[];
  /** Title shown above the stats */
  title: string;
  /** Whether to show the detailed user table */
  showUsers?: boolean;
  /** Whether to show event_data details */
  showEventData?: boolean;
  /** Label mapping for event_data keys */
  dataLabels?: Record<string, string>;
}

/**
 * Server aggregate (admin_usage_stats_v1) — counts every matching event. Fallback keeps the previous
 * behaviour (newest 5 000 events, only the needed columns) and marks the numbers as a sample.
 */
async function fetchUsage(eventNames: string[], days: number): Promise<Usage> {
  const data = await optionalRpc<{ total: number; unique_users: number; premium_users: number; daily: Usage['daily']; breakdown: Usage['breakdown']; users: UsageUser[] }>(
    'admin_usage_stats_v1', { p_events: eventNames, p_days: days });
  if (data !== RPC_MISSING && data) {
    return { total: Number(data.total), uniqueUsers: Number(data.unique_users), premiumUsers: Number(data.premium_users), daily: data.daily ?? [], breakdown: data.breakdown ?? [],
      users: (data.users ?? []).map(user => ({ ...user, name: user.name || tr('adminusagestats_namelum_134662', 'Naməlum'), email: user.email || '' })), sampled: false, source: 'rpc' };
  }
  const sinceDate = subDays(new Date(), days).toISOString();
  const events = await fetchAllRows<{ user_id: string; created_at: string; is_premium: boolean | null; event_data: Record<string, unknown> | null }>(
    (from, to) => supabase.from('analytics_events').select('user_id, created_at, is_premium, event_data').in('event_name', eventNames).gte('created_at', sinceDate)
      .order('created_at', { ascending: false }).range(from, to) as any, 1000, 5000);
  const userCounts = new Map<string, { count: number; last_used: string }>();
  for (const event of events) {
    const existing = userCounts.get(event.user_id);
    if (!existing) userCounts.set(event.user_id, { count: 1, last_used: event.created_at });
    else { existing.count += 1; if (event.created_at > existing.last_used) existing.last_used = event.created_at; }
  }
  const top = [...userCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);
  const profileMap = new Map<string, { name: string; email: string | null; is_premium: boolean | null }>();
  if (top.length) {
    const { data: profiles } = await supabase.from('profiles').select('user_id, name, email, is_premium').in('user_id', top.map(([id]) => id));
    profiles?.forEach(profile => profileMap.set(profile.user_id, profile));
  }
  const trendDays = Math.min(days, 14), daily: Usage['daily'] = [];
  for (let i = trendDays - 1; i >= 0; i--) { const date = format(subDays(new Date(), i), 'yyyy-MM-dd'); daily.push({ date, count: events.filter(event => event.created_at?.startsWith(date)).length }); }
  const breakdown = new Map<string, number>();
  for (const event of events) {
    if (!event.event_data) continue;
    const key = Object.values(event.event_data).filter(Boolean).join(' / ') || 'Bilinmir';
    breakdown.set(key, (breakdown.get(key) || 0) + 1);
  }
  return {
    total: events.length, uniqueUsers: userCounts.size, premiumUsers: new Set(events.filter(event => event.is_premium).map(event => event.user_id)).size, daily,
    breakdown: [...breakdown.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 20),
    users: top.map(([user_id, value]) => ({ user_id, count: value.count, last_used: value.last_used, name: profileMap.get(user_id)?.name || tr('adminusagestats_namelum_134662', 'Naməlum'),
      email: profileMap.get(user_id)?.email || '', is_premium: !!profileMap.get(user_id)?.is_premium })),
    sampled: events.length >= 5000, source: 'fallback',
  };
}

const AdminUsageStats = ({ eventNames, title, showUsers = true, showEventData = false }: AdminUsageStatsProps) => {
  const [dateRange, setDateRange] = useState('30');
  const key = eventNames.join(',');
  const query = useQuery({ queryKey: ['admin-usage-stats', key, dateRange], queryFn: () => fetchUsage(eventNames, parseInt(dateRange)), ...ADMIN_QUERY });
  const data = query.data;
  const max = useMemo(() => Math.max(1, ...(data?.daily ?? []).map(day => day.count)), [data]);

  return (
    <Section title={<span className="flex items-center gap-2"><Activity size={15} className="text-primary" />{title}</span>}
      description={data?.sampled ? 'Ehtiyat rejim: son 5 000 hadisə əsasında. Dəqiq say üçün admin_usage_stats_v1 tətbiq olunmalıdır.' : undefined}
      actions={<>
        <SelectFilter label="Müddət" value={dateRange} onChange={setDateRange} options={[{ value: '1', label: tr('adminusagestats_bu_gun_786fd4', 'Bu gün') },
          { value: '7', label: tr('adminusagestats_7_gun_5782ea', '7 gün') }, { value: '30', label: tr('adminusagestats_30_gun_767ad9', '30 gün') }, { value: '90', label: tr('adminusagestats_90_gun_632564', '90 gün') }]} />
        <button type="button" className="ak-icon-btn" aria-label="Yenilə" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} /></button>
      </>}>
      <div className="grid gap-4">
        {query.isError && <ErrorState compact onRetry={() => void query.refetch()} />}
        <KpiRow columns={3}>
          <StatTile label={tr('adminusagestats_cemi_istifade_31f4fc', 'Cəmi istifadə')} icon={<Eye size={13} />} loading={query.isLoading} value={fmtNumber(data?.total)} />
          <StatTile label={tr('adminusagestats_unikal_istifadeci_c5640a', 'Unikal istifadəçi')} icon={<Users size={13} />} loading={query.isLoading} value={fmtNumber(data?.uniqueUsers)} />
          <StatTile label={tr('adminusagestats_premium_istifadeci_125a87', 'Premium istifadəçi')} icon={<TrendingUp size={13} />} loading={query.isLoading} value={fmtNumber(data?.premiumUsers)} />
        </KpiRow>
        {query.isLoading ? <SkeletonRows rows={3} columns={3} /> : data && data.total === 0 ? (
          <EmptyState compact title={tr('adminusagestats_bu_muddetde_istifade_melumati_yoxdur_d9a35a', 'Bu müddətdə istifadə məlumatı yoxdur')} />
        ) : data && (
          <>
            {data.daily.length > 0 && (
              <div className="flex items-end gap-1 h-28" role="img" aria-label="Günlük istifadə">
                {data.daily.map(day => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${day.date}: ${day.count}`}>
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(2, (day.count / max) * 88)}px` }} />
                    <span className="text-[10px] text-muted-foreground truncate">{format(new Date(day.date), 'dd MMM', { locale: getCurrentDateLocale() })}</span>
                  </div>
                ))}
              </div>
            )}
            {showEventData && data.breakdown.length > 0 && (
              <div>
                <h4 className="ak-label mb-2">{tr('adminusagestats_detalli_paylanma_f316d8', 'Detallı Paylanma')}</h4>
                <div className="ak-bars max-h-48 overflow-y-auto">{data.breakdown.map((item, index) => (
                  <div key={index}><span title={item.label}>{item.label}</span><span className="ak-meter"><i style={{ width: `${(item.count / data.breakdown[0].count) * 100}%` }} /></span><strong>{fmtNumber(item.count)}</strong></div>
                ))}</div>
              </div>
            )}
            {showUsers && data.users.length > 0 && (
              <div>
                <h4 className="ak-label mb-2">{tr('adminusagestats_en_aktiv_istifadeciler_a5e570', 'Ən aktiv istifadəçilər')}</h4>
                <div className="ak-table-scroll max-h-64 rounded-lg border">
                  <table className="ak-table"><thead><tr><th>{tr('adminusagestats_istifadeci_b6bdd6', 'İstifadəçi')}</th><th>Email</th><th>Premium</th><th style={{ textAlign: 'end' }}>{tr('adminusagestats_sayi_deaa4b', 'Sayı')}</th></tr></thead>
                    <tbody>{data.users.slice(0, 15).map(user => (
                      <tr key={user.user_id}><td>{user.name}</td><td className="ak-cell-sub">{user.email}</td><td>{user.is_premium ? <StatusPill tone="accent">Premium</StatusPill> : '—'}</td><td style={{ textAlign: 'end' }}><strong>{fmtNumber(user.count)}</strong></td></tr>
                    ))}</tbody></table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
};

export default AdminUsageStats;
