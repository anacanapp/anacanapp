import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, MousePointerClick, PlayCircle, Download, Users } from 'lucide-react';
import { adminRpc } from '@/lib/admin-insights';
import { STORIES_AZ } from '@/data/stories/az';
import {
  DataTable, FilterChips, KpiRow, Notice, Page, PageHeader, Section, SideDrawer, StatTile, fmtDateTime, fmtNumber, type Column,
} from './kit';

interface StoryRow { id: string; opens: number; viewers: number; completes: number; completers: number; cta: number; downloads: number; quiz_ok: number; quiz_no: number; last_at: string }
interface StoryStats {
  since: string;
  totals: { opens: number; viewers: number; completes: number; cta: number; downloads: number };
  stories: StoryRow[];
  days: { day: string; opens: number; viewers: number }[];
}
interface ViewerRow { user_id: string; name: string | null; email: string | null; opens: number; stories: number; completes: number; cta: number; last_at: string }

const TITLES = new Map(STORIES_AZ.map((s) => [s.id, s.title]));
const MODULES = new Map(STORIES_AZ.map((s) => [s.id, s.module]));
const title = (id: string | null) => (id ? TITLES.get(id) ?? id : 'Bütün story-lər');
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '-');
type Days = '7' | '30' | '90' | '365';

/**
 * Story statistics (2026-11-12): how often each dashboard story was opened, finished and clicked, and who watched.
 * Source: analytics events the app already sends (only users who allowed analytics), via admin_story_stats_v1 /
 * admin_story_viewers_v1.
 */
export default function AdminStoryStats() {
  const [days, setDays] = useState<Days>('30');
  const [story, setStory] = useState<string | null | undefined>(undefined);
  const stats = useQuery({ queryKey: ['admin-story-stats', days], queryFn: () => adminRpc<StoryStats>('admin_story_stats_v1', { p_days: Number(days) }) });
  const viewers = useQuery({
    queryKey: ['admin-story-viewers', story, days], enabled: story !== undefined,
    queryFn: () => adminRpc<ViewerRow[]>('admin_story_viewers_v1', { p_story: story ?? null, p_days: Number(days) }),
  });
  const t = stats.data?.totals;
  const maxDay = useMemo(() => Math.max(1, ...(stats.data?.days ?? []).map((d) => d.opens)), [stats.data]);

  const columns: Column<StoryRow>[] = [
    { key: 'title', header: 'Story', mobile: 'title', cell: (r) => <span><strong>{title(r.id)}</strong><br /><small className="ak-muted">{MODULES.get(r.id) ?? ''} · {r.id}</small></span>, sortable: true, sortValue: (r) => title(r.id) },
    { key: 'opens', header: 'Baxış', align: 'end', cell: (r) => fmtNumber(r.opens), sortable: true, sortValue: (r) => r.opens },
    { key: 'viewers', header: 'Baxan', align: 'end', cell: (r) => fmtNumber(r.viewers), sortable: true, sortValue: (r) => r.viewers },
    { key: 'completes', header: 'Sona qədər', align: 'end', cell: (r) => `${fmtNumber(r.completes)} (${pct(r.completers, r.viewers)})`, sortable: true, sortValue: (r) => r.completes },
    { key: 'cta', header: 'Düymə', align: 'end', cell: (r) => fmtNumber(r.cta), sortable: true, sortValue: (r) => r.cta },
    { key: 'downloads', header: 'Yükləmə', align: 'end', cell: (r) => fmtNumber(r.downloads), sortable: true, sortValue: (r) => r.downloads },
    { key: 'quiz', header: 'Sual (düz/səhv)', align: 'end', mobile: 'hidden', cell: (r) => (r.quiz_ok + r.quiz_no ? `${r.quiz_ok}/${r.quiz_no}` : '-') },
    { key: 'last', header: 'Son baxış', mobile: 'meta', cell: (r) => fmtDateTime(r.last_at), sortable: true, sortValue: (r) => r.last_at },
  ];
  const viewerColumns: Column<ViewerRow>[] = [
    { key: 'who', header: 'İstifadəçi', mobile: 'title', cell: (r) => <span><strong>{r.name || 'Adsız'}</strong><br /><small className="ak-muted">{r.email || r.user_id}</small></span> },
    { key: 'opens', header: 'Baxış', align: 'end', cell: (r) => fmtNumber(r.opens) },
    { key: 'stories', header: 'Story sayı', align: 'end', cell: (r) => fmtNumber(r.stories) },
    { key: 'completes', header: 'Sona qədər', align: 'end', cell: (r) => fmtNumber(r.completes) },
    { key: 'last', header: 'Son baxış', mobile: 'meta', cell: (r) => fmtDateTime(r.last_at) },
  ];

  return (
    <Page testId="admin-story-stats">
      <PageHeader title="Story statistikası" subtitle="Ana səhifə story-lərinə kim, nəyə və nə qədər baxıb" />
      <FilterChips label="Dövr" value={days} onChange={setDays}
        options={[{ value: '7', label: '7 gün' }, { value: '30', label: '30 gün' }, { value: '90', label: '90 gün' }, { value: '365', label: '1 il' }]} />
      <Notice>Rəqəmlər tətbiqdə analitikaya icazə verən istifadəçiləri əhatə edir. Story-lər 12 noyabra qədər yalnız adminlərə açıq idi.</Notice>
      <KpiRow columns={5}>
        <StatTile label="Baxış" icon={<Eye size={14} />} value={fmtNumber(t?.opens ?? 0)} loading={stats.isLoading} />
        <StatTile label="Baxan istifadəçi" icon={<Users size={14} />} value={fmtNumber(t?.viewers ?? 0)} loading={stats.isLoading} onClick={() => setStory(null)} hint="Siyahı üçün toxunun" />
        <StatTile label="Sona qədər" icon={<PlayCircle size={14} />} value={fmtNumber(t?.completes ?? 0)} hint={t ? pct(t.completes, t.opens) : undefined} loading={stats.isLoading} />
        <StatTile label="Düyməyə keçid" icon={<MousePointerClick size={14} />} value={fmtNumber(t?.cta ?? 0)} loading={stats.isLoading} />
        <StatTile label="Yükləmə" icon={<Download size={14} />} value={fmtNumber(t?.downloads ?? 0)} loading={stats.isLoading} />
      </KpiRow>
      {(stats.data?.days.length ?? 0) > 0 && (
        <Section title="Günlər üzrə baxış">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90, overflowX: 'auto' }} role="img" aria-label="Günlər üzrə baxış">
            {stats.data!.days.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.opens} baxış, ${d.viewers} nəfər`} style={{ flex: '1 0 10px', minWidth: 10, height: `${Math.max(4, (90 * d.opens) / maxDay)}px`, background: 'var(--ak-accent, #FF5A5F)', borderRadius: 3 }} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Story-lər" description="Sətirə toxunanda o story-yə kimlərin baxdığı açılır.">
        <DataTable columns={columns} rows={stats.data?.stories} rowKey={(r) => r.id} loading={stats.isLoading} error={stats.error}
          onRetry={() => void stats.refetch()} onRowClick={(r) => setStory(r.id)} empty="Bu dövrdə story baxışı yoxdur."
          defaultSort={{ key: 'opens', dir: 'desc' }} />
      </Section>
      <SideDrawer open={story !== undefined} onOpenChange={(o) => { if (!o) setStory(undefined); }} title={`Kim baxıb: ${title(story ?? null)}`}
        description="Son baxana görə, ən çox 300 nəfər." size="lg">
        <DataTable columns={viewerColumns} rows={viewers.data} rowKey={(r) => r.user_id} loading={viewers.isLoading} error={viewers.error}
          onRetry={() => void viewers.refetch()} empty="Baxan yoxdur." />
      </SideDrawer>
    </Page>
  );
}
