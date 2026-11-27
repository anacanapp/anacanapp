import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Crown, User, X } from 'lucide-react';
import { addMonths, addYears } from 'date-fns';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AdminUsageStats from './AdminUsageStats';
import {
  Avatar, Btn, DataTable, EmptyState, Field, FilterChips, KpiRow, Page, PageHeader, SearchInput, Section, SideDrawer, StatTile, StatusPill, Toolbar,
  fmtDate, fmtNumber, useAdminConfirm, type Column,
} from './kit';
import { ADMIN_QUERY, ilikeTerm, unwrap } from './data/rpc';

interface UserProfile { id: string; user_id: string; name: string; email: string; is_premium: boolean; premium_until: string | null; badge_type: string; life_stage: string; created_at: string }
type Filter = 'all' | 'premium' | 'free';
type Duration = '1_month' | '3_months' | '1_year' | 'lifetime';
const PAGE = 40;

/** Server page of profiles (was: every profile loaded and filtered in the browser). */
async function fetchPage(filter: Filter, search: string, page: number) {
  let query = supabase.from('profiles').select('id, user_id, name, email, is_premium, premium_until, badge_type, life_stage, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (filter === 'premium') query = query.eq('is_premium', true);
  if (filter === 'free') query = query.or('is_premium.is.null,is_premium.eq.false');
  if (search.trim()) query = query.or(`name.ilike.${ilikeTerm(search)},email.ilike.${ilikeTerm(search)}`);
  const { data, count } = unwrap(await query.range(page * PAGE, page * PAGE + PAGE - 1));
  return { rows: data as unknown as UserProfile[], total: count };
}
async function fetchCounts() {
  const [all, premium] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_premium', true),
  ]);
  return { total: all.count ?? 0, premium: premium.count ?? 0, free: Math.max(0, (all.count ?? 0) - (premium.count ?? 0)) };
}

const AdminSubscriptions = () => {
  const { toast } = useToast();
  const confirm = useAdminConfirm();
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all'), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [grantTo, setGrantTo] = useState<UserProfile | null>(null), [duration, setDuration] = useState<Duration>('1_month'), [saving, setSaving] = useState(false);
  const list = useQuery({ queryKey: ['admin-subscriptions-page', filter, search, page], queryFn: () => fetchPage(filter, search, page), placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 20_000 });
  const counts = useQuery({ queryKey: ['admin-subscriptions-counts'], queryFn: fetchCounts, ...ADMIN_QUERY });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['admin-subscriptions-page'] }), client.invalidateQueries({ queryKey: ['admin-subscriptions-counts'] }), client.invalidateQueries({ queryKey: ['admin-users-page'] })]);

  const grantPremium = async () => {
    if (!grantTo) return;
    let premiumUntil: Date | null = null;
    switch (duration) {
      case '1_month': premiumUntil = addMonths(new Date(), 1); break;
      case '3_months': premiumUntil = addMonths(new Date(), 3); break;
      case '1_year': premiumUntil = addYears(new Date(), 1); break;
      case 'lifetime': premiumUntil = null; break; // null means lifetime
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ is_premium: true, premium_until: premiumUntil?.toISOString() || null, badge_type: 'premium' }).eq('id', grantTo.id);
    setSaving(false);
    if (error) toast({ title: tr('adminsubscriptions_xeta_3cdbb6', 'Xəta'), description: error.message, variant: 'destructive' });
    else {
      toast({ title: tr('adminsubscriptions_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminsubscriptions_premium_granted', '{name} üçün Premium aktivləşdirildi').replace('{name}', grantTo.name || '') });
      setGrantTo(null); void refresh();
    }
  };

  const revokePremium = async (user: UserProfile) => {
    if (!(await confirm({ title: tr('adminsubscriptions_revoke_confirm', '{name} üçün Premium-u ləğv etmək istəyirsiniz?').replace('{name}', user.name || ''), confirmLabel: 'Ləğv et', danger: true }))) return;
    const { error } = await supabase.from('profiles').update({ is_premium: false, premium_until: null, badge_type: 'user' }).eq('id', user.id);
    if (error) toast({ title: tr('adminsubscriptions_xeta_3cdbb6', 'Xəta'), description: error.message, variant: 'destructive' });
    else { toast({ title: tr('adminsubscriptions_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminsubscriptions_premium_revoked', '{name} üçün Premium ləğv edildi').replace('{name}', user.name || '') }); void refresh(); }
  };

  const columns = useMemo<Column<UserProfile>[]>(() => [
    { key: 'user', header: 'İstifadəçi', mobile: 'title', cell: user => <span className="ak-cell-user"><Avatar name={user.name} /><span className="min-w-0"><span className="ak-cell-main">{user.name || '—'}</span><span className="ak-cell-sub">{user.email}</span></span></span> },
    { key: 'status', header: 'Status', cell: user => user.is_premium ? <StatusPill tone="accent"><Crown size={11} />Premium</StatusPill> : <span className="ak-cell-sub">{tr('adminsubscriptions_pulsuz', 'Pulsuz')}</span> },
    { key: 'until', header: tr('adminsubscriptions_bitme_c270e3', 'Bitmə:').replace(':', ''), cell: user => user.is_premium ? <span className="ak-num"><Calendar size={12} className="inline me-1 opacity-60" />{user.premium_until ? fmtDate(user.premium_until) : tr('adminsubscriptions_omurluk_988e77', 'Ömürlük')}</span> : <span className="ak-cell-sub">—</span> },
    { key: 'created', header: 'Qeydiyyat', align: 'end', cell: user => <span className="ak-num">{fmtDate(user.created_at)}</span> },
  ], []);

  return (
    <Page testId="admin-subscriptions">
      <PageHeader title={tr('adminsubscriptions_abunelik_idareetmesi_3d3c6c', 'Abunəlik İdarəetməsi')} subtitle="Manual Premium hüququ vermək və ləğv etmək. Mağaza abunəlikləri RevenueCat ilə idarə olunur." />
      <KpiRow columns={3}>
        <StatTile label={tr('adminsubscriptions_umumi_1b5521', 'Ümumi')} icon={<User size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.total)} onClick={() => { setFilter('all'); setPage(0); }} />
        <StatTile label="Premium" tone="accent" icon={<Crown size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.premium)} onClick={() => { setFilter('premium'); setPage(0); }} />
        <StatTile label={tr('adminsubscriptions_pulsuz', 'Pulsuz')} icon={<User size={13} />} loading={counts.isLoading} value={fmtNumber(counts.data?.free)} onClick={() => { setFilter('free'); setPage(0); }} />
      </KpiRow>
      <Section flush>
        <div className="px-4 pb-3 grid gap-2.5">
          <Toolbar end={<FilterChips label="Filtr" value={filter} onChange={value => { setFilter(value); setPage(0); }}
            options={[{ value: 'all', label: tr('adminsubscriptions_hamisi_c73c4d', 'Hamısı') }, { value: 'premium', label: 'Premium' }, { value: 'free', label: tr('adminsubscriptions_pulsuz', 'Pulsuz') }]} />}>
            <SearchInput value={search} onChange={value => { setSearch(value); setPage(0); }} placeholder={tr('adminsubscriptions_istifadeci_axtar_4c82f8', 'İstifadəçi axtar...')} />
          </Toolbar>
        </div>
        <DataTable testId="admin-subscriptions-table" columns={columns} rows={list.data?.rows} rowKey={user => user.id} loading={list.isLoading} fetching={list.isFetching && !list.isLoading}
          error={list.isError ? list.error : null} onRetry={() => void list.refetch()} page={page} total={list.data?.total ?? 0} pageSize={PAGE} onPageChange={setPage}
          empty={<EmptyState title="İstifadəçi tapılmadı" />}
          actions={[
            { label: tr('adminsubscriptions_premium_ver', 'Premium Ver'), icon: <Crown size={14} />, hidden: user => user.is_premium, onSelect: user => { setDuration('1_month'); setGrantTo(user); } },
            { label: tr('adminsubscriptions_premium_legv_et_779f4b', 'Premium Ləğv Et'), icon: <X size={14} />, danger: true, hidden: user => !user.is_premium, onSelect: user => void revokePremium(user) },
          ]} />
      </Section>
      <AdminUsageStats eventNames={['premium_subscribed', 'premium_cancelled', 'premium_paywall_shown', 'premium_paywall_clicked']}
        title={tr('adminsubscriptions_premium_statistikasi_059afd', '👑 Premium Statistikası')} showEventData showUsers />
      {grantTo && (
        <SideDrawer open onOpenChange={open => { if (!open) setGrantTo(null); }} title={tr('adminsubscriptions_premium_aktivlesdir_b95d85', 'Premium Aktivləşdir')}
          description={`${grantTo.name} · ${grantTo.email}`} onSave={grantPremium} saving={saving} saveLabel={tr('adminsubscriptions_premium_ver', 'Premium Ver')}>
          <Field label={tr('adminsubscriptions_ucun_premium_abunelik_muddeti__9582da', 'üçün Premium abunəlik müddəti seçin:').replace(/^üçün /, '').replace(':', '')}>{id => (
            <div className="ak-chips" role="radiogroup" id={id}>
              {([['1_month', tr('adminsubscriptions_1_ay', '1 Ay')], ['3_months', tr('adminsubscriptions_3_ay', '3 Ay')], ['1_year', tr('adminsubscriptions_1_il_edbac9', '1 İl')], ['lifetime', tr('adminsubscriptions_omurluk_988e77', 'Ömürlük')]] as Array<[Duration, string]>)
                .map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={duration === value} aria-pressed={duration === value} className="ak-chip" onClick={() => setDuration(value)}>{label}</button>)}
            </div>)}</Field>
          <p className="ak-hint">Hüquq profilə yazılır (is_premium, premium_until, badge_type). Mağaza abunəliyinə təsir etmir.</p>
        </SideDrawer>
      )}
    </Page>
  );
};

export default AdminSubscriptions;
