import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Crown, RefreshCw, Search } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ACCESS_LABELS, CYCLE_LABELS, MODULE_LABELS, adminErrorText, countryFlag, dateLabel, emptyInsightFilters, fetchAdminInsights, fetchAdminMembers, fetchProviderMetrics, monthPeriod, type InsightFilters } from '@/lib/admin-insights';
import countriesData from '../../../countries.json';
import { APP_LANGUAGES, localizedCountryName } from '@/lib/app-languages';
import { getLocaleTag } from '@/lib/i18n';
import { getPersistedLanguage, tr } from '@/lib/tr';

const countries = countriesData as Array<{ isoAlpha2: string; name: string; flag: string }>;
const countryName = (code: string) => { const item = countries.find(item => item.isoAlpha2 === code); return item ? `${countryFlag(code)} ${localizedCountryName(code, getPersistedLanguage(), item.name)}` : code === '??' ? tr('admin_not_recorded', 'Qeyd olunmayıb') : code; };
const number = (value: number | undefined) => Number(value ?? 0).toLocaleString(getLocaleTag());
const inputSelect = 'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm';
function exportRows(name: string, rows: Array<Array<string | number | null>>) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? ''); return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RevenuePanel() {
  const { user, isAdmin } = useAuth(), backend = getBackendConfig();
  const query = useQuery({ queryKey: ['admin-provider-revenue', backend.url, user?.id], queryFn: fetchProviderMetrics, enabled: !!user && isAdmin, retry: false, staleTime: 60_000 });
  return <section className="admin-panel" data-testid="admin-revenue"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h2>Gəlir · RevenueCat</h2><Button size="sm" variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={14} className={query.isFetching ? 'animate-spin' : ''} /></Button></div>
    {query.isLoading ? <p className="admin-panel-note">Mağaza məlumatları yoxlanır…</p> : query.isError || !query.data?.available ?
      <div className="space-y-3"><p className="font-semibold text-sm">{query.data?.reason === 'permission_required' ? 'RevenueCat metrics oxu icazəsi tələb olunur' : 'Gəlir mənbəyinə bağlantı tamamlanmalıdır'}</p><p className="admin-panel-note">Mövcud RevenueCat server açarı layihənin gəlir göstəricilərini oxuya bilməlidir. Alış düyməsi hadisələri və plan qiymətləri real gəlir kimi hesablanmır.</p>
        <a href="https://app.revenuecat.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-semibold">RevenueCat-ı aç<ArrowUpRight size={13} /></a></div> :
      <div className="grid grid-cols-2 gap-3">{query.data.metrics?.map(item => <div key={item.id} className="rounded-xl bg-muted/50 p-3"><small className="text-xs text-muted-foreground">{item.name}</small><strong className="block text-xl mt-1 tabular-nums">{number(item.value)} <span className="text-xs">{item.unit}</span></strong>{item.description && <p className="admin-panel-note mt-2">{item.description}</p>}</div>)}</div>}
    <p className="admin-panel-note mt-4">Provider göstəriciləri bütün layihə üçündür və öz hesablama pəncərəsinə əsaslanır. Aşağıdakı ölkə/tarix filtrləri verilənlər bazası hesabatlarına aiddir.</p>
  </section>;
}
export default function AdminInsightsPage({ premium = false, onNavigate }: { premium?: boolean; onNavigate?: (section: string) => void }) {
  const { user, isAdmin } = useAuth(), backend = getBackendConfig();
  const [period, setPeriod] = useState(() => monthPeriod()), [preset, setPreset] = useState('month');
  const [filters, setFilters] = useState<InsightFilters>(emptyInsightFilters), [memberAccess, setMemberAccess] = useState(premium ? 'premium' : 'all');
  const [search, setSearch] = useState(''), [querySearch, setQuerySearch] = useState(''), [page, setPage] = useState(0), [toolSearch, setToolSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setQuerySearch(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const validPeriod = !!period.from && !!period.to && period.to > period.from && (Date.parse(period.to) - Date.parse(period.from)) / 86400000 <= 366;
  const query = useQuery({ queryKey: ['admin-insights', backend.url, user?.id, period, filters], queryFn: () => fetchAdminInsights(period.from, period.to, filters), enabled: !!user && isAdmin && validPeriod, retry: false, staleTime: 30_000 });
  const memberFilters = useMemo(() => ({ ...filters, access: memberAccess, search: querySearch }), [filters, memberAccess, querySearch]);
  const members = useQuery({ queryKey: ['admin-members', backend.url, user?.id, memberFilters, page], queryFn: () => fetchAdminMembers(memberFilters, page), enabled: !!user && isAdmin, retry: false, staleTime: 30_000 });
  const data = query.data, kpis = data?.kpis;
  const setSingle = (key: 'countries' | 'languages' | 'modules', value: string) => { setFilters(previous => ({ ...previous, [key]: value ? [value] : [] })); setPage(0); };
  const choosePeriod = (value: string) => {
    setPreset(value); if (value === 'custom') return;
    if (value === 'month' || value === 'previous') { setPeriod(monthPeriod(value === 'previous' ? -1 : 0)); return; }
    const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1);
    setPeriod({ from: new Date(end.getTime() - Number(value) * 86400000).toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  };
  const cards = [['users', tr('admin_kpi_users', 'İstifadəçilər')], ['premium', tr('admin_kpi_premium', 'Premium hüququ aktiv')], ['monthly', ACCESS_LABELS.monthly], ['trial', tr('admin_kpi_trial', 'Aktiv trial')],
    ['cancelledMonthly', tr('admin_kpi_cancelled_monthly', 'Aylıq · yenilənmə ləğv')], ['cancelledTrial', tr('admin_kpi_cancelled_trial', 'Trial · yenilənmə ləğv')],
    ['annual', tr('admin_kpi_annual', 'Təsdiqlənmiş illik')], ['annualOrLifetime', tr('admin_kpi_legacy_annual', 'Köhnə illik / ömürlük')],
    ['manual', ACCESS_LABELS.manual], ['household', ACCESS_LABELS.household], ['expired', tr('admin_kpi_expired', 'Hüququ bitmiş')], ['expiring7d', tr('admin_kpi_expiring_week', '7 günə bitəcək')]];
  const tools = data?.tools.filter(item => `${item.tool_id} ${item.tool_name || ''}`.toLowerCase().includes(toolSearch.toLowerCase())) ?? [];
  return <div className="admin-page" data-testid={premium ? 'admin-premium-page' : 'admin-dashboard'}>
    <div className="admin-page-heading"><div><h1>{premium ? 'Premium mərkəzi' : 'Dashboard'}</h1><p>{premium ? 'Abunəlik, trial, ləğv, ölkə və istifadə göstəricilərinin vahid görünüşü.' : 'İstifadəçilər, abunəliklər və alət istifadəsinin cari vəziyyəti.'}</p></div>
      <div className="admin-page-actions">{!premium && <Button variant="outline" onClick={() => onNavigate?.('premium-analytics')}><Crown size={16} className="me-2" />Premium mərkəzi</Button>}
        <Button variant="outline" disabled={query.isFetching || members.isFetching} onClick={() => { void query.refetch(); void members.refetch(); }}><RefreshCw size={15} className={`me-2 ${query.isFetching ? 'animate-spin' : ''}`} />Yenilə</Button></div>
    </div>
    <div className="admin-panel space-y-4"><div className="admin-filters">
      <label>Hesabat müddəti<select aria-label="Hesabat müddəti" className={inputSelect} value={preset} onChange={event => choosePeriod(event.target.value)}><option value="month">Bu ay</option><option value="previous">Əvvəlki ay</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="custom">Öz intervalım</option></select></label>
      <label>Başlanğıc<Input type="date" aria-label="Hesabat başlanğıcı" value={period.from} onChange={event => { setPreset('custom'); setPeriod({ ...period, from: event.target.value }); }} /></label>
      <label>Son tarix · daxil deyil<Input type="date" aria-label="Hesabat sonu" value={period.to} onChange={event => { setPreset('custom'); setPeriod({ ...period, to: event.target.value }); }} /></label>
      <label>Ölkə<select aria-label="Analitika ölkəsi" className={inputSelect} value={filters.countries[0] || ''} onChange={event => setSingle('countries', event.target.value)}><option value="">Bütün ölkələr</option><option value="??">Qeyd olunmayıb</option>{countries.map(item => <option key={item.isoAlpha2} value={item.isoAlpha2}>{countryName(item.isoAlpha2)}</option>)}</select></label>
      <label>Modul<select aria-label="Analitika modulu" className={inputSelect} value={filters.modules[0] || ''} onChange={event => setSingle('modules', event.target.value)}><option value="">Bütün modullar</option>{Object.entries(MODULE_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>Dil<select aria-label="Analitika dili" className={inputSelect} value={filters.languages[0] || ''} onChange={event => setSingle('languages', event.target.value)}><option value="">Bütün dillər</option>{APP_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.native_name}</option>)}</select></label>
    </div><p className="admin-panel-note"><CalendarDays size={13} className="inline me-1" />Tarix pəncərəsi aktivlik, yeni qeydiyyatlar və ləğv hadisələrinə aiddir. Abunəlik kartları hazırkı hüququ göstərir. Vaxt zonası: UTC. Məlumat mənbəyi: {backend.azure ? 'Azure bazası' : 'Source bazası'}.</p></div>
    {!validPeriod && <div className="admin-error">Başlanğıcdan sonrakı son tarix seçin; maksimum 366 gün.</div>}
    {query.isError && <div className="admin-error" role="alert">{adminErrorText(query.error)}<Button size="sm" onClick={() => void query.refetch()}>Yenidən yoxla</Button></div>}
    {query.isLoading ? <div className="admin-kpis">{cards.map(([key]) => <div key={key} className="admin-kpi animate-pulse h-28 bg-muted/50" />)}</div> : data && <>
      <div className="admin-kpis">{cards.map(([key, label]) => <div className="admin-kpi" key={key} data-accent={['premium', 'monthly', 'trial'].includes(key)}><span className="metric-label">{label}</span><strong>{number(kpis?.[key])}</strong><small>{['cancelledMonthly', 'cancelledTrial'].includes(key) ? 'Yenilənmə dayanıb; hüquq ayrıca yoxlanır' : 'Cari vəziyyət'}</small></div>)}</div>
      {!!kpis?.legacyBillingClassification && <p className="admin-panel-note">{number(kpis.legacyBillingClassification)} abunənin köhnə plan kodu saxlanıb. Aylıq təsnifat köhnə Premium koduna əsaslanır; Premium+ illik/ömürlük ayrımı product ID olmadan fərz edilmir.</p>}
      <div className="admin-two-columns"><section className="admin-panel"><div className="flex flex-wrap justify-between gap-3 mb-5"><h2>Aktivlik və yeni istifadəçilər</h2><span className="admin-panel-note">{number(data.activity.activeUsers)} unikal aktiv · {number(kpis?.newUsers)} yeni</span></div>
        <div style={{ width: '100%', height: 260, minWidth: 0 }}><ResponsiveContainer><AreaChart data={data.daily}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} fontSize={10} minTickGap={30} /><YAxis fontSize={10} width={35} allowDecimals={false} /><Tooltip /><Area dataKey="active" name={tr('admin_chart_active', 'Aktiv istifadəçi')} stroke="#f28155" fill="#f2815522" strokeWidth={2} /><Area dataKey="joined" name={tr('admin_chart_joined', 'Yeni qeydiyyat')} stroke="#8977bb" fill="#8977bb15" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
      </section><RevenuePanel /></div>
      <div className="admin-two-columns"><section className="admin-panel"><div className="flex flex-wrap justify-between gap-3 mb-4"><h2>Ölkələr üzrə bölgü</h2><Button size="sm" variant="ghost" onClick={() => exportRows('anacan-countries.csv', [['Ölkə', 'İstifadəçi', 'Premium', 'Trial', 'Aylıq'], ...data.countries.map(item => [item.country, item.users, item.premium, item.trial, item.monthly])])}><ArrowDownToLine size={14} className="me-1" />CSV</Button></div>
        <div className="admin-table-scroll max-h-[340px]"><table className="admin-data-table" style={{ minWidth: 450 }}><thead><tr><th>Ölkə</th><th>İstifadəçi</th><th>Premium</th><th>Trial</th><th>Aylıq</th></tr></thead><tbody>{data.countries.map(item => <tr key={item.country}><td>{countryName(item.country)}</td><td>{number(item.users)}</td><td>{number(item.premium)}</td><td>{number(item.trial)}</td><td>{number(item.monthly)}</td></tr>)}</tbody></table></div>
      </section><section className="admin-panel"><h2>Ləğv hadisələri · seçilmiş müddət</h2><div className="grid grid-cols-2 gap-3 my-4"><div className="rounded-xl bg-muted/50 p-3"><strong className="text-2xl">{number(data.cancellations.storeUsers)}</strong><p className="admin-panel-note">Mağazadan qeydə alınan istifadəçi</p></div><div className="rounded-xl bg-muted/50 p-3"><strong className="text-2xl">{number(data.cancellations.surveyUsers)}</strong><p className="admin-panel-note">Tətbiqdaxili səbəb bildirən</p></div></div>
        <p className="admin-panel-note">Tətbiqdaxili sorğu mağazada ləğvin təsdiqi deyil. Ləğv edilmiş abunə müddəti bitənədək Premium qala bilər.</p><div className="mt-4 space-y-2 max-h-48 overflow-y-auto">{data.cancellations.reasons.map(item => <div className="flex justify-between gap-3 text-xs" key={`${item.cancel_flow}:${item.reason_code}`}><span className="break-words">{item.reason_code.replace(/_/g, ' ')} <small className="text-muted-foreground">· {item.cancel_flow === 'store_reported' ? 'Mağaza' : 'Sorğu'}</small></span><strong>{number(item.users)}</strong></div>)}</div>
      </section></div>
      <section className="admin-panel"><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2>İstifadə olunan alətlər</h2><p className="admin-panel-note">{number(data.activity.toolEvents)} hadisə · {number(data.activity.tools)} alət. Açılma və istifadə ayrıca sayılır.</p></div><div className="flex flex-wrap gap-2"><Input aria-label="Alət statistikasında axtar" placeholder="Alət axtar…" value={toolSearch} onChange={event => setToolSearch(event.target.value)} className="max-w-56" /><Button size="sm" variant="outline" onClick={() => exportRows('anacan-tools.csv', [['Alət ID', 'Ad', 'Açılma', 'İstifadə', 'Unikal', 'Premium'], ...tools.map(item => [item.tool_id, item.tool_name, item.opens, item.uses, item.users, item.premium_users])])}><ArrowDownToLine size={14} /></Button></div></div>
        {tools.length ? <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Alət</th><th>Açılma</th><th>İstifadə</th><th>Unikal istifadəçi</th><th>Cari Premium</th><th>Son istifadə</th></tr></thead><tbody>{tools.map(item => <tr key={item.tool_id}><td><strong>{item.tool_name || item.tool_id}</strong><small>{item.tool_id}</small></td><td>{number(item.opens)}</td><td>{number(item.uses)}</td><td>{number(item.users)}</td><td>{number(item.premium_users)}</td><td>{dateLabel(item.last_used)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Seçilmiş müddət və filtrlərdə alət istifadəsi qeydə alınmayıb.</p>}
      </section>
    </>}
    <section className="admin-panel" data-testid="admin-member-directory"><div className="flex flex-wrap justify-between gap-3 mb-4"><h2>{premium ? 'Premium istifadəçiləri · ətraflı siyahı' : 'İstifadəçi siyahısı'}</h2>{premium && <Button size="sm" variant="outline" onClick={() => onNavigate?.('subscriptions')}>Hüquqları idarə et<ArrowUpRight size={14} className="ms-1" /></Button>}</div>
      <div className="admin-filters mb-4"><label>Axtarış<div className="relative"><Search size={15} className="absolute start-3 top-3 text-muted-foreground" /><Input className="ps-9" aria-label="Premium istifadəçi axtar" placeholder="Ad və ya email" value={search} onChange={event => setSearch(event.target.value)} /></div></label><label>Hüquq / status<select aria-label="Abunəlik filtri" className={inputSelect} value={memberAccess} onChange={event => { setMemberAccess(event.target.value); setPage(0); }}>{Object.entries(ACCESS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      {members.isError ? <div className="admin-error" role="alert">{adminErrorText(members.error)}<Button size="sm" onClick={() => void members.refetch()}>Yenidən yoxla</Button></div> : members.isLoading ? <p className="admin-empty">Siyahı yüklənir…</p> : !members.data?.items.length ? <p className="admin-empty">Uyğun istifadəçi tapılmadı.</p> : <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>İstifadəçi</th><th>Hüquq / plan</th><th>Ölkə / modul</th><th>Yenilənmə</th><th>Bitmə</th><th>Qeydiyyat</th></tr></thead><tbody>{members.data.items.map(item => <tr key={item.user_id}><td><strong>{item.name || 'Adsız istifadəçi'}</strong><small>{item.email || 'Email qeyd olunmayıb'}</small></td><td><span className="admin-status-chip" data-kind={item.access_kind}>{ACCESS_LABELS[item.access_kind] || item.access_kind}</span><small>{CYCLE_LABELS[item.billing_cycle]}{item.billing_basis === 'legacy_plan' ? ' · köhnə plan kodu' : ''}</small>{item.product_id && <small>{item.product_id}</small>}</td><td>{countryName(item.country)}<small>{MODULE_LABELS[item.module]} · {item.language.toUpperCase()}</small></td><td>{item.subscription_status === 'cancelled' ? 'Ləğv edilib' : item.subscription_status === 'active' ? 'Aktiv qeyd' : item.subscription_status === 'expired' ? 'Bitib' : '—'}{item.cancelled_at && <small>{dateLabel(item.cancelled_at)}</small>}</td><td>{dateLabel(item.expires_at)}</td><td>{dateLabel(item.joined_at)}</td></tr>)}</tbody></table></div>}
      <div className="admin-pagination"><span>{number(members.data?.total)} nəticə · səhifədə 30</span><div><Button variant="outline" size="sm" disabled={page === 0 || members.isFetching} onClick={() => setPage(page - 1)} aria-label="Əvvəlki istifadəçi səhifəsi"><ChevronLeft size={15} /></Button><span>{page + 1}</span><Button variant="outline" size="sm" disabled={!members.data || (page + 1) * 30 >= members.data.total || members.isFetching} onClick={() => setPage(page + 1)} aria-label="Növbəti istifadəçi səhifəsi"><ChevronRight size={15} /></Button></div></div>
    </section>
    {data && <p className="admin-panel-note">Son yenilənmə: {new Date(data.generatedAt).toLocaleString(getLocaleTag())}. {backend.azure && 'Azure bazası Source-dan fərqli məlumat sərhədinə malik ola bilər; bu göstəricilər seçilmiş backend-in qeydləridir.'}</p>}
  </div>;
}
