import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Premium funnel (migration 20261125150000): consent-free daily counters by paywall placement, buy taps and the
// server-recorded purchases they lead to, and cancellation reasons. No user-level data leaves the server.
import { FUNNEL_EVENTS, summariseBySource, type Filters, type FunnelReport } from '@/lib/premium-funnel-report';

const EVENT_LABEL: Record<string, string> = {
  paywall_shown: 'Göstərildi', paywall_clicked: 'Klik', purchase_started: 'Alış başladı', epoint_started: 'Epoint', purchase_cancelled: 'İmtina',
  purchase_failed: 'Xəta', purchase_pending: 'Gözləmədə', restore_clicked: 'Bərpa',
};
const PROVIDER_LABEL: Record<string, string> = { app_store: 'App Store', play_store: 'Google Play', epoint: 'Epoint', promo: 'Promo', other: 'Digər' };

const uniq = (values: string[]) => [...new Set(values)].sort();
const money = (amount: number | string | null, currency: string | null) => amount == null || !Number.isFinite(Number(amount)) ? '—' : `${Number(amount).toFixed(2)} ${currency ?? ''}`.trim();

export default function AdminPremiumFunnel() {
  const [days, setDays] = useState('30');
  const [filters, setFilters] = useState<Filters>({ platform: 'all', country: 'all', stage: 'all' });
  const query = useQuery({
    queryKey: ['admin-premium-funnel', days],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>)(
        'admin_premium_funnel_v1', { p_days: Number(days) });
      if (error) throw new Error(error.message || 'funnel_failed');
      return data as FunnelReport;
    },
    staleTime: 60_000,
  });
  const report = query.data;
  const summary = useMemo(() => report ? summariseBySource(report, filters) : [], [report, filters]);
  const options = useMemo(() => ({
    platform: uniq((report?.funnel ?? []).map(r => r.platform)), country: uniq((report?.funnel ?? []).map(r => r.country)),
    stage: uniq((report?.funnel ?? []).map(r => r.life_stage)),
  }), [report]);
  const daily = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of report?.daily ?? []) map.set(r.day, { ...(map.get(r.day) ?? {}), [r.event]: r.count });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [report]);

  const filterSelect = (key: keyof Filters, label: string, values: string[]) => (
    <Select value={filters[key]} onValueChange={value => setFilters(f => ({ ...f, [key]: value }))}>
      <SelectTrigger className="h-8 w-[130px] text-xs" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: hamısı</SelectItem>
        {values.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><TrendingUp size={20} /> Premium funnel</h2>
          <p className="text-xs text-muted-foreground">Paywall yerləşməsi üzrə gündəlik saylar (istifadəçi ID-si yoxdur), alış cəhdləri, server tərəfindən qeydə alınan alışlar və ləğv səbəbləri.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Dövr"><SelectValue /></SelectTrigger>
            <SelectContent>{['7', '30', '90', '180'].map(d => <SelectItem key={d} value={d}>Son {d} gün</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Yenilə">
            <RefreshCw size={14} className={query.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {query.isError && <p className="text-sm text-destructive">Hesabat yüklənmədi: {(query.error as Error).message}</p>}
      {query.isLoading && <p className="text-sm text-muted-foreground">Yüklənir...</p>}

      {report && <>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base"><Filter size={16} /> Mənbə üzrə
              <span className="ms-auto flex flex-wrap gap-2">
                {filterSelect('platform', 'Platforma', options.platform)}
                {filterSelect('country', 'Ölkə', options.country)}
                {filterSelect('stage', 'Mərhələ', options.stage)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Mənbə</TableHead>
                {FUNNEL_EVENTS.map(e => <TableHead key={e} className="text-end">{EVENT_LABEL[e]}</TableHead>)}
                <TableHead className="text-end">Alış toxunuşu</TableHead>
                <TableHead className="text-end">Alış</TableHead>
                <TableHead className="text-end">İlk alış</TableHead>
                <TableHead className="text-end">Konversiya</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {summary.length === 0 && <TableRow><TableCell colSpan={FUNNEL_EVENTS.length + 5} className="text-center text-muted-foreground">Məlumat yoxdur</TableCell></TableRow>}
                {summary.map(s => (
                  <TableRow key={s.source}>
                    <TableCell className="font-mono text-xs">{s.source}</TableCell>
                    {FUNNEL_EVENTS.map(e => <TableCell key={e} className="text-end tabular-nums">{s.events[e] ?? 0}</TableCell>)}
                    <TableCell className="text-end tabular-nums">{s.intents}</TableCell>
                    <TableCell className="text-end tabular-nums font-semibold">{s.purchases}</TableCell>
                    <TableCell className="text-end tabular-nums">{s.firstPurchases}</TableCell>
                    <TableCell className="text-end tabular-nums">{s.conversion == null ? '—' : `${s.conversion}%`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">Konversiya = yeni alışlar / göstərilmə (yenilənmələr və promo daxil deyil). Alış toxunuşu və alışlarda yalnız platforma filtri işləyir.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Alışlar</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Mənbə</TableHead><TableHead>Provayder</TableHead><TableHead>Platforma</TableHead><TableHead>Plan</TableHead>
                  <TableHead className="text-end">Say</TableHead><TableHead className="text-end">Məbləğ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {report.purchases.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Alış yoxdur</TableCell></TableRow>}
                  {report.purchases.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{p.source}{p.first_purchase ? ' ★' : ''}</TableCell>
                      <TableCell>{PROVIDER_LABEL[p.provider] ?? p.provider}</TableCell>
                      <TableCell>{p.platform}</TableCell><TableCell>{p.plan}</TableCell>
                      <TableCell className="text-end tabular-nums">{p.count}</TableCell>
                      <TableCell className="text-end tabular-nums">{money(p.amount, p.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">★ ilk alış. Mənbə: son 48 saatdakı alış toxunuşu; “renewal” yenilənmədir, “unknown” toxunuş tapılmayıb.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Ləğv səbəbləri</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Səbəb</TableHead><TableHead>Axın</TableHead><TableHead className="text-end">Say</TableHead><TableHead className="text-end">Sınaq</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.cancellations.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Ləğv yoxdur</TableCell></TableRow>}
                  {report.cancellations.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{c.reason_code}</TableCell><TableCell>{c.cancel_flow}</TableCell>
                      <TableCell className="text-end tabular-nums">{c.count}</TableCell><TableCell className="text-end tabular-nums">{c.trials}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Gündəlik</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Gün</TableHead>{FUNNEL_EVENTS.map(e => <TableHead key={e} className="text-end">{EVENT_LABEL[e]}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {daily.length === 0 && <TableRow><TableCell colSpan={FUNNEL_EVENTS.length + 1} className="text-center text-muted-foreground">Məlumat yoxdur</TableCell></TableRow>}
                {daily.map(([day, counts]) => (
                  <TableRow key={day}>
                    <TableCell className="tabular-nums">{day}</TableCell>
                    {FUNNEL_EVENTS.map(e => <TableCell key={e} className="text-end tabular-nums">{counts[e] ?? 0}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </>}
    </div>
  );
}
