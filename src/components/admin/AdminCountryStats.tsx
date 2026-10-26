import { useMemo, useState } from 'react';
import { tr } from '@/lib/tr';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Globe2, Users, UserPlus, Activity, Crown, Radio, Search,
  Baby, HeartPulse, Droplets, UsersRound, AlertTriangle } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend } from
'recharts';
import { format } from 'date-fns';
import countriesData from '../../../countries.json';

interface Country {
  name: string;
  isoAlpha2: string;
  flag: string;
}
const COUNTRIES = countriesData as Country[];
const countryByCode = new Map(COUNTRIES.map((c) => [c.isoAlpha2, c]));

const flagSrc = (flag?: string) =>
flag ? flag.startsWith('data:') ? flag : `data:image/png;base64,${flag}` : '';

interface CountryStatRow {
  country_code: string;
  total_users: number;
  new_users: number;
  active_users: number;
  premium_users: number;
  bump_users: number;
  mommy_users: number;
  flow_users: number;
  partner_users: number;
}

interface TimeseriesRow {
  day: string;
  new_users: number;
  active_users: number;
}

interface FeatureRow {
  event_name: string;
  event_category: string;
  event_count: number;
  unique_users: number;
}

interface PlatformRow {
  platform: string;
  event_count: number;
  unique_users: number;
}

type Period = 'today' | '7d' | '30d' | 'custom';

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T[]> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return (data || []) as T[];
};

/**
 * Ölkələr üzrə tam statistika: hansı ölkədə neçə istifadəçi var, nə qədər
 * qeydiyyat/aktivlik olub, hansı feature-ları hansı platformada istifadə
 * edirlər. Dövr: bu gün / 7 gün / 30 gün / tarix aralığı + CANLI rejim.
 *
 * Bütün rəqəmlər DB-dəki admin-qorumalı RPC-lərdən gəlir (Duzelis62.sql):
 * admin_country_stats / _timeseries / _features / _platforms.
 */
const AdminCountryStats = () => {
  const [period, setPeriod] = useState<Period>('7d');
  const [customFrom, setCustomFrom] = useState(format(new Date(Date.now() - 6 * 86400000), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [live, setLive] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Dövr sərhədləri (lokal vaxt)
  const { fromISO, toISO } = useMemo(() => {
    const now = new Date();
    let from: Date;
    let to: Date = new Date(now.getTime() + 60_000);
    if (period === 'today') {
      from = new Date(now);from.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      from = new Date(now.getTime() - 7 * 86400000);
    } else if (period === '30d') {
      from = new Date(now.getTime() - 30 * 86400000);
    } else {
      from = new Date(`${customFrom}T00:00:00`);
      to = new Date(`${customTo}T23:59:59`);
    }
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }, [period, customFrom, customTo]);

  const statsQ = useQuery({
    queryKey: ['admin-country-stats', fromISO, toISO],
    queryFn: () => rpc<CountryStatRow>('admin_country_stats', { _from: fromISO, _to: toISO }),
    refetchInterval: live ? 30_000 : false
  });

  const tsQ = useQuery({
    queryKey: ['admin-country-ts', selectedCountry, fromISO, toISO],
    queryFn: () => rpc<TimeseriesRow>('admin_country_timeseries', { _country: selectedCountry, _from: fromISO, _to: toISO }),
    enabled: !statsQ.isError
  });

  const featQ = useQuery({
    queryKey: ['admin-country-features', selectedCountry, fromISO, toISO],
    queryFn: () => rpc<FeatureRow>('admin_country_features', { _country: selectedCountry, _from: fromISO, _to: toISO, _limit: 25 }),
    enabled: !statsQ.isError
  });

  const platQ = useQuery({
    queryKey: ['admin-country-platforms', selectedCountry, fromISO, toISO],
    queryFn: () => rpc<PlatformRow>('admin_country_platforms', { _country: selectedCountry, _from: fromISO, _to: toISO }),
    enabled: !statsQ.isError
  });

  // CANLI: son 5 dəqiqədə aktiv olanlar (15 saniyədən bir yenilənir)
  const liveQ = useQuery({
    queryKey: ['admin-country-live'],
    queryFn: () => {
      const from = new Date(Date.now() - 5 * 60_000).toISOString();
      const to = new Date(Date.now() + 60_000).toISOString();
      return rpc<CountryStatRow>('admin_country_stats', { _from: from, _to: to });
    },
    enabled: live,
    refetchInterval: 15_000
  });

  const rows = statsQ.data || [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const c = countryByCode.get(r.country_code);
      return r.country_code.toLowerCase().includes(q) || (c?.name || '').toLowerCase().includes(q);
    });
  }, [rows, search]);

  const totals = useMemo(() => ({
    countries: rows.filter((r) => r.total_users > 0).length,
    users: rows.reduce((s, r) => s + Number(r.total_users), 0),
    newUsers: rows.reduce((s, r) => s + Number(r.new_users), 0),
    active: rows.reduce((s, r) => s + Number(r.active_users), 0),
    premium: rows.reduce((s, r) => s + Number(r.premium_users), 0)
  }), [rows]);

  const liveActive = useMemo(() => {
    const list = (liveQ.data || []).filter((r) => Number(r.active_users) > 0);
    return { list, total: list.reduce((s, r) => s + Number(r.active_users), 0) };
  }, [liveQ.data]);

  const countryLabel = (code: string) =>
  code === 'XX' ? tr('admincountry_unknown', 'Naməlum') : countryByCode.get(code)?.name || code;

  const chartData = useMemo(() =>
  (tsQ.data || []).map((r) => ({
    day: format(new Date(r.day), 'dd.MM'),
    [tr('admincountry_new_users', 'Yeni qeydiyyat')]: Number(r.new_users),
    [tr('admincountry_active_users', 'Aktiv istifadəçi')]: Number(r.active_users)
  })), [tsQ.data]);

  const periodBtn = (p: Period, label: string) =>
  <Button
    key={p}
    variant={period === p ? 'default' : 'outline'}
    size="sm"
    onClick={() => setPeriod(p)}>
      {label}
    </Button>;

  const selectedName = selectedCountry ? countryLabel(selectedCountry) : tr('admincountry_all_countries', 'Bütün ölkələr');

  return (
    <div className="p-6 space-y-5">
      {/* Başlıq + dövr seçimi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" />
            {tr('admincountry_title', 'Ölkə Statistikası')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('admincountry_subtitle', 'Ölkələr üzrə istifadəçi, qeydiyyat, aktivlik və feature istifadəsi')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodBtn('today', tr('admincountry_period_today', 'Bu gün'))}
          {periodBtn('7d', tr('admincountry_period_7d', '7 gün'))}
          {periodBtn('30d', tr('admincountry_period_30d', '30 gün'))}
          {periodBtn('custom', tr('admincountry_period_custom', 'Tarix aralığı'))}
          <Button
            variant={live ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setLive(!live)}
            className="gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${live ? 'animate-pulse' : ''}`} />
            {tr('admincountry_live', 'Canlı')}
          </Button>
        </div>
      </div>

      {period === 'custom' &&
      <div className="flex items-center gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
        </div>
      }

      {/* RPC hələ tətbiq olunmayıbsa / schema keşi köhnədirsə */}
      {statsQ.isError &&
      <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              {tr('admincountry_rpc_missing', 'Statistika funksiyaları bazada tapılmadı')}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              {tr('admincountry_rpc_missing_hint', 'supabase/duzelis/Duzelis62.sql faylını Supabase SQL Editor-də işə salın, sonra bu səhifəni yeniləyin.')}
            </p>
            <p className="text-[11px] text-amber-600/80 mt-1 font-mono">{(statsQ.error as any)?.message}</p>
          </div>
          <Button
          variant="outline"
          size="sm"
          onClick={() => {statsQ.refetch();tsQ.refetch();featQ.refetch();platQ.refetch();}}>
            {tr('admincountry_retry', 'Yenidən yoxla')}
          </Button>
        </div>
      }

      {/* CANLI panel */}
      {live &&
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold text-red-600">
              {tr('admincountry_live_now', 'İndi aktiv (son 5 dəqiqə)')}: {liveActive.total}
            </span>
            <span className="text-[11px] text-muted-foreground">· {tr('admincountry_live_refresh', '15 saniyədən bir yenilənir')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {liveActive.list.map((r) =>
          <Badge key={r.country_code} variant="outline" className="gap-1.5 bg-background">
                {countryByCode.get(r.country_code)?.flag &&
            <img src={flagSrc(countryByCode.get(r.country_code)?.flag)} alt="" className="w-4 h-3 object-cover rounded-[2px]" />
            }
                {countryLabel(r.country_code)}
                <span className="font-bold text-red-600">{r.active_users}</span>
              </Badge>
          )}
            {liveActive.list.length === 0 && !liveQ.isLoading &&
          <span className="text-xs text-muted-foreground">{tr('admincountry_live_empty', 'Hazırda aktiv istifadəçi yoxdur')}</span>
          }
          </div>
        </div>
      }

      {/* İcmal kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
        { icon: Globe2, label: tr('admincountry_card_countries', 'Ölkə'), value: totals.countries, color: 'text-blue-600 bg-blue-100' },
        { icon: Users, label: tr('admincountry_card_total', 'Cəmi istifadəçi'), value: totals.users, color: 'text-violet-600 bg-violet-100' },
        { icon: UserPlus, label: tr('admincountry_card_new', 'Yeni qeydiyyat'), value: totals.newUsers, color: 'text-emerald-600 bg-emerald-100' },
        { icon: Activity, label: tr('admincountry_card_active', 'Aktiv'), value: totals.active, color: 'text-orange-600 bg-orange-100' },
        { icon: Crown, label: 'Premium', value: totals.premium, color: 'text-amber-600 bg-amber-100' }].
        map((c, i) =>
        <div key={i} className="bg-card rounded-xl p-4 border border-border">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold leading-none">{statsQ.isLoading ? '…' : c.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        )}
      </div>

      {/* Qrafik: seçilmiş ölkə (və ya hamısı) — günlük qeydiyyat + aktivlik */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {selectedName} — {tr('admincountry_chart_title', 'günlük dinamika')}
          </h3>
          {selectedCountry &&
          <Button variant="outline" size="sm" onClick={() => setSelectedCountry(null)}>
              {tr('admincountry_show_all', 'Bütün ölkələr')}
            </Button>
          }
        </div>
        {tsQ.isLoading ?
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">…</div> :
        chartData.length === 0 ?
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
            {tr('admincountry_no_data', 'Bu dövr üçün məlumat yoxdur')}
          </div> :

        <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={tr('admincountry_new_users', 'Yeni qeydiyyat')} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey={tr('admincountry_active_users', 'Aktiv istifadəçi')} stroke="#f28155" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        }
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Feature istifadəsi */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-3">{selectedName} — {tr('admincountry_features_title', 'nə istifadə olunur')}</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {(featQ.data || []).map((f, i) =>
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium truncate block">{f.event_name}</span>
                  <span className="text-[11px] text-muted-foreground">{f.event_category}</span>
                </div>
                <div className="text-end shrink-0">
                  <span className="font-bold">{Number(f.event_count).toLocaleString()}</span>
                  <span className="text-[11px] text-muted-foreground block">
                    {Number(f.unique_users).toLocaleString()} {tr('admincountry_users_short', 'istifadəçi')}
                  </span>
                </div>
              </div>
            )}
            {(featQ.data || []).length === 0 && !featQ.isLoading &&
            <p className="text-sm text-muted-foreground py-4 text-center">{tr('admincountry_no_data', 'Bu dövr üçün məlumat yoxdur')}</p>
            }
          </div>
        </div>

        {/* Platforma bölgüsü */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-3">{selectedName} — {tr('admincountry_platforms_title', 'platformalar')}</h3>
          <div className="space-y-3">
            {(platQ.data || []).map((p) => {
              const total = (platQ.data || []).reduce((s, x) => s + Number(x.unique_users), 0) || 1;
              const pct = Math.round(Number(p.unique_users) / total * 100);
              return (
                <div key={p.platform}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{p.platform}</span>
                    <span className="text-muted-foreground text-xs">
                      {Number(p.unique_users).toLocaleString()} {tr('admincountry_users_short', 'istifadəçi')} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.platform === 'ios' ? 'bg-slate-700' : p.platform === 'android' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>);
            })}
            {(platQ.data || []).length === 0 && !platQ.isLoading &&
            <p className="text-sm text-muted-foreground py-4 text-center">{tr('admincountry_no_data', 'Bu dövr üçün məlumat yoxdur')}</p>
            }
          </div>
        </div>
      </div>

      {/* Ölkə cədvəli */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold flex-1">{tr('admincountry_table_title', 'Ölkələr üzrə bölgü')}</h3>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('admincountry_search', 'Ölkə axtar...')}
              className="ps-9 w-56" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start bg-muted/40">
                <th className="p-3 text-start font-semibold">{tr('admincountry_col_country', 'Ölkə')}</th>
                <th className="p-3 text-end font-semibold">{tr('admincountry_col_total', 'Cəmi')}</th>
                <th className="p-3 text-end font-semibold">{tr('admincountry_col_new', 'Yeni')}</th>
                <th className="p-3 text-end font-semibold">{tr('admincountry_col_active', 'Aktiv')}</th>
                <th className="p-3 text-end font-semibold">Premium</th>
                <th className="p-3 text-end font-semibold hidden md:table-cell">
                  <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <Baby className="w-3.5 h-3.5" />
                    <HeartPulse className="w-3.5 h-3.5" />
                    <Droplets className="w-3.5 h-3.5" />
                    <UsersRound className="w-3.5 h-3.5" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {statsQ.isLoading &&
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">…</td></tr>
              }
              {filteredRows.map((r) => {
                const c = countryByCode.get(r.country_code);
                const isSel = selectedCountry === r.country_code;
                return (
                  <tr
                    key={r.country_code}
                    onClick={() => setSelectedCountry(isSel ? null : r.country_code)}
                    className={`border-b border-border/50 last:border-0 cursor-pointer transition-colors ${isSel ? 'bg-primary/10' : 'hover:bg-muted/40'}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {c?.flag ?
                        <img src={flagSrc(c.flag)} alt="" className="w-6 h-4 object-cover rounded-[3px] shrink-0" /> :
                        <span className="w-6 h-4 rounded-[3px] bg-muted inline-block shrink-0" />
                        }
                        <span className="font-medium">{countryLabel(r.country_code)}</span>
                        <span className="text-[11px] text-muted-foreground">{r.country_code}</span>
                      </div>
                    </td>
                    <td className="p-3 text-end font-bold">{Number(r.total_users).toLocaleString()}</td>
                    <td className="p-3 text-end">
                      {Number(r.new_users) > 0 ?
                      <span className="text-emerald-600 font-semibold">+{Number(r.new_users).toLocaleString()}</span> :
                      <span className="text-muted-foreground">0</span>
                      }
                    </td>
                    <td className="p-3 text-end">{Number(r.active_users).toLocaleString()}</td>
                    <td className="p-3 text-end">
                      {Number(r.premium_users) > 0 ?
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{Number(r.premium_users)}</Badge> :
                      <span className="text-muted-foreground">0</span>
                      }
                    </td>
                    <td className="p-3 text-end hidden md:table-cell">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {Number(r.bump_users)}/{Number(r.mommy_users)}/{Number(r.flow_users)}/{Number(r.partner_users)}
                      </span>
                    </td>
                  </tr>);
              })}
              {!statsQ.isLoading && filteredRows.length === 0 &&
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {tr('admincountry_no_data', 'Bu dövr üçün məlumat yoxdur')}
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        <div className="p-3 text-[11px] text-muted-foreground border-t border-border">
          {tr('admincountry_legend', 'Sütunlar: Cəmi = bütün zamanlar; Yeni/Aktiv = seçilmiş dövr. Son sütun: Hamilə/Ana/Flow/Partnyor. Sətrə klik — ölkə üzrə detallar.')}
        </div>
      </div>
    </div>);

};

export default AdminCountryStats;
