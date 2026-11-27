import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Apple, Monitor, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { Btn, DataTable, EmptyState, FilterChips, JsonView, KpiRow, Page, PageHeader, Section, SideDrawer, StatTile, StatusPill, fmtDateTime, fmtNumber, fmtRelative, useAdminConfirm, type Column } from './kit';
import { ADMIN_QUERY } from './data/rpc';

interface CrashReport {
  id: string; user_id: string | null; error_message: string; error_stack: string | null; component_stack: string | null; url: string | null; user_agent: string | null;
  app_version: string | null; platform: string | null; extra_data: unknown; created_at: string;
}
interface Group { key: string; items: CrashReport[]; platforms: string[]; versions: string[]; last: string }

const platformIcon = (platform: string | null) => platform === 'android' ? <Smartphone size={14} className="text-green-500" /> : platform === 'ios' ? <Apple size={14} className="text-muted-foreground" /> : <Monitor size={14} className="text-blue-500" />;

/** Same bounded read as before: newest 200 reports, optional platform filter. */
async function fetchReports(filter: string) {
  let query = supabase.from('crash_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (filter !== 'all') query = query.eq('platform', filter);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CrashReport[];
}

const AdminCrashReports = () => {
  const confirm = useAdminConfirm();
  const client = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['admin-crash-reports', filter], queryFn: () => fetchReports(filter), ...ADMIN_QUERY, staleTime: 30_000 });
  const reports = query.data ?? [];

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, CrashReport[]>();
    for (const report of reports) { const key = report.error_message.slice(0, 100); map.set(key, [...(map.get(key) ?? []), report]); }
    return [...map.entries()].map(([key, items]) => ({ key, items, platforms: [...new Set(items.map(item => item.platform || 'web'))], versions: [...new Set(items.map(item => item.app_version || '?'))], last: items[0].created_at }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [reports]);
  const last24 = reports.filter(report => Date.now() - Date.parse(report.created_at) < 86400_000).length;
  const selected = groups.find(group => group.key === openKey) ?? null;
  const setCache = (updater: (rows: CrashReport[]) => CrashReport[]) => client.setQueryData<CrashReport[]>(['admin-crash-reports', filter], rows => updater(rows ?? []));

  const deleteReport = async (id: string) => {
    await supabase.from('crash_reports').delete().eq('id', id);
    setCache(rows => rows.filter(row => row.id !== id));
    toast.success('Silindi');
  };
  const deleteAll = async () => {
    if (!(await confirm({ title: tr('admincrashreports_butun_crash_reportlari_silinsi_4f4311', 'Bütün crash reportları silinsin?'), description: 'Bütün platformalar üzrə bütün hesabatlar silinir.', confirmLabel: 'Hamısını sil', danger: true }))) return;
    await supabase.from('crash_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setCache(() => []);
    toast.success(tr('admincrashreports_hamisi_silindi_3b8089', 'Hamısı silindi'));
  };

  const columns = useMemo<Column<Group>[]>(() => [
    { key: 'message', header: 'Xəta', mobile: 'title', cell: group => <span className="flex items-start gap-2 min-w-0">{platformIcon(group.items[0].platform)}<span className="ak-cell-main ak-mono" style={{ fontSize: 12 }}>{group.key}</span></span> },
    { key: 'count', header: 'Say', align: 'end', sortable: true, sortValue: group => group.items.length, cell: group => <StatusPill tone={group.items.length > 5 ? 'danger' : 'neutral'} dot={false}>{group.items.length}×</StatusPill> },
    { key: 'platforms', header: 'Platforma', cell: group => <span className="ak-cell-sub">{group.platforms.join(', ')}</span> },
    { key: 'versions', header: 'Versiya', cell: group => <span className="ak-cell-sub">{group.versions.join(', ')}</span> },
    { key: 'last', header: 'Son', align: 'end', sortable: true, sortValue: group => group.last, cell: group => <span className="ak-num" title={fmtDateTime(group.last)}>{fmtRelative(group.last)}</span> },
  ], []);

  return (
    <Page testId="admin-crash-reports">
      <PageHeader title="Xəta hesabatları" subtitle="Son 200 crash report, eyni mesaja görə qruplaşdırılıb"
        actions={<>
          <Btn onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} />Yenilə</Btn>
          <Btn variant="danger" onClick={() => void deleteAll()} disabled={!reports.length}><Trash2 size={15} />{tr('admincrashreports_hamisini_sil_f6a3d6', 'Hamısını sil')}</Btn>
        </>} />
      <KpiRow columns={3}>
        <StatTile label="Hesabat" icon={<AlertTriangle size={13} />} loading={query.isLoading} value={fmtNumber(reports.length)} hint="son 200-dən" />
        <StatTile label="Unikal xəta" loading={query.isLoading} value={fmtNumber(groups.length)} />
        <StatTile label="Son 24 saat" tone={last24 ? 'danger' : 'default'} loading={query.isLoading} value={fmtNumber(last24)} />
      </KpiRow>
      <Section flush>
        <div className="px-4 pb-3">
          <FilterChips label="Platforma" value={filter} onChange={setFilter} options={['all', 'android', 'ios', 'web'].map(value => ({ value, label: value === 'all' ? tr('admincrashreports_hamisi_c73c4d', 'Hamısı') : value }))} />
        </div>
        {query.isError && <div className="px-4 pb-2"><p className="ak-hint">{tr('admincrashreports_crash_reportlari_yuklenmedi_d4ba13', 'Crash reportları yüklənmədi')}</p></div>}
        <DataTable testId="admin-crash-table" columns={columns} rows={query.isLoading ? undefined : groups} rowKey={group => group.key} loading={query.isLoading} error={query.isError ? query.error : null}
          onRetry={() => void query.refetch()} pageSize={25} onRowClick={group => setOpenKey(group.key)} defaultSort={{ key: 'count', dir: 'desc' }}
          empty={<EmptyState title="Crash report yoxdur 🎉" />} />
      </Section>
      {selected && (
        <SideDrawer open onOpenChange={open => { if (!open) setOpenKey(null); }} size="lg" footer={null} title={<span className="ak-mono" style={{ fontSize: 13 }}>{selected.key}</span>}
          description={`${selected.items.length} hesabat · ${selected.platforms.join(', ')} · versiya ${selected.versions.join(', ')}`}>
          {selected.items.slice(0, 5).map(report => (
            <div key={report.id} className="ak-card-row grid gap-2">
              <div className="flex items-center gap-2 text-xs">{platformIcon(report.platform)}<span>{fmtDateTime(report.created_at)}</span><span className="ak-cell-sub">{report.platform} · {report.app_version || '?'}</span>
                <button type="button" className="ak-icon-btn ms-auto" aria-label="Hesabatı sil" onClick={() => void deleteReport(report.id)}><Trash2 size={14} /></button></div>
              {report.url && <div className="text-xs"><strong>URL:</strong> {report.url}</div>}
              {report.user_id && <div className="text-xs"><strong>User:</strong> <span className="ak-mono">{report.user_id.slice(0, 8)}…</span></div>}
              {report.error_stack && <JsonView value={report.error_stack} maxHeight={160} />}
              {report.extra_data ? <JsonView value={report.extra_data} maxHeight={160} /> : null}
            </div>
          ))}
          {selected.items.length > 5 && <p className="ak-hint">+{selected.items.length - 5} daha...</p>}
        </SideDrawer>
      )}
    </Page>
  );
};

export default AdminCrashReports;
