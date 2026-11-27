import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { STORIES_AZ, WEEKS, MONTHS, PHASES } from '@/data/stories/az';
import { STORY_THEMES, storyVars, type Story, type StorySlide, type StoryTemplate } from '@/lib/stories';
import { sanitizeStory } from '@/lib/server-stories';
import StoryViewer from '@/components/stories/StoryViewer';
import { ILLUSTRATION_NAMES } from '@/components/stories/illustrations';
import {
  Btn, DataTable, Notice, Page, PageHeader, Section, SideDrawer, StatusPill, fmtDateTime, useAdminConfirm, type Column,
} from './kit';

// Table added after the generated types; a loose client keeps this file free of casts to any.
const db = supabase as unknown as SupabaseClient;

export interface StoryRow {
  id: string; language: string; action: 'show' | 'hide'; story: Record<string, unknown>; audience: 'test' | 'all'; enabled: boolean;
  starts_at: string | null; ends_at: string | null; sort_order: number; note: string | null; updated_at?: string;
}

const BUNDLED = new Map(STORIES_AZ.map((s) => [s.id, s]));
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

/** Slide skeletons for the "add slide" buttons (Azerbaijani placeholders the admin overwrites). */
export const SLIDE_TEMPLATES: Record<StoryTemplate, StorySlide> = {
  cover: { t: 'cover', kicker: 'Bu gün', title: 'Başlıq ==vurğu== ilə', illus: 'heart' },
  fact: { t: 'fact', kicker: 'Fakt', value: '7', unit: 'saat', body: 'Qısa izah. Mənbə: ÜST.' },
  list: { t: 'list', kicker: 'Siyahı', title: 'Başlıq', items: ['Birinci', 'İkinci', 'Üçüncü'] },
  myth: { t: 'myth', kicker: 'Mif yoxsa həqiqət?', myth: 'Yanlış inanc', fact: 'Doğrusu budur.' },
  quiz: { t: 'quiz', kicker: 'Sual', title: 'Sual mətni?', options: ['Cavab 1', 'Cavab 2', 'Cavab 3'], correct: 0, explain: 'Niyə belədir.' },
  alert: { t: 'alert', kicker: 'Diqqət', title: 'Həkimə müraciət edin, əgər:', items: ['Əlamət 1', 'Əlamət 2'] },
  quote: { t: 'quote', quote: 'Qısa, isti bir fikir.', badge: 'Anacan' },
  cta: { t: 'cta', kicker: 'Daha ətraflı', title: 'Alətə keç', body: 'Bir cümlə.', cta: { label: 'Aç', nav: { tool: 'fetal-growth' } }, illus: 'heart' },
};
const NEW_STORY = (): Record<string, unknown> => ({
  module: 'all', title: 'Yeni story', theme: 'coral', illus: 'heart', source: '',
  slides: [SLIDE_TEMPLATES.cover, SLIDE_TEMPLATES.fact],
});
const blankRow = (): StoryRow => ({
  id: '', language: 'az', action: 'show', story: NEW_STORY(), audience: 'test', enabled: false,
  starts_at: null, ends_at: null, sort_order: 0, note: null,
});
const stripId = (s: Story): Record<string, unknown> => { const { id: _id, ...rest } = s; return rest; };

/** What would stop this row from saving or from showing in the app. */
export function storyRowProblems(row: StoryRow, json: string): { problems: string[]; story: Story | null; dropped: number } {
  const problems: string[] = [];
  if (!ID_RE.test(row.id)) problems.push('ID yalnız kiçik latın hərfləri, rəqəm və "-" ola bilər (2-64 simvol).');
  if (row.starts_at && row.ends_at && row.ends_at <= row.starts_at) problems.push('Bitmə tarixi başlamadan sonra olmalıdır.');
  if (row.action === 'hide') {
    if (!BUNDLED.has(row.id)) problems.push('Gizlətmək yalnız tətbiqdəki story üçün mümkündür.');
    return { problems, story: null, dropped: 0 };
  }
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { problems.push('JSON düzgün deyil.'); return { problems, story: null, dropped: 0 }; }
  const story = sanitizeStory(row.id || 'preview', raw);
  const total = raw && typeof raw === 'object' && Array.isArray((raw as { slides?: unknown }).slides) ? (raw as { slides: unknown[] }).slides.length : 0;
  if (!story) problems.push('Story göstərilə bilməz: module, title və ən azı bir düzgün slayd lazımdır.');
  if (total > 20) problems.push('Ən çox 20 slayd ola bilər.');
  if (json.includes('—')) problems.push('Uzun tire (—) istifadə etməyin.');
  return { problems, story, dropped: story ? Math.max(0, total - story.slides.length) : 0 };
}

const SAMPLE_VARS = storyVars({ stage: 'bump', week: 24, fruit: { name: 'Qarğıdalı', lengthCm: 30, weightG: 600 }, babyMonths: 6, babyName: 'Aylin', cycleDay: 14 },
  { weeks: WEEKS, months: MONTHS, phases: PHASES });
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * Story-lər (2026-11-12): add, replace or hide dashboard stories without an app update. Rows live in public.app_stories
 * and reach apps through get_app_stories_v1; builds before this feature keep their bundled stories.
 */
export default function AdminStories() {
  const qc = useQueryClient();
  const confirm = useAdminConfirm();
  const [editing, setEditing] = useState<StoryRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<Story | null>(null);

  const rows = useQuery({
    queryKey: ['admin-app-stories'],
    queryFn: async () => {
      const { data, error } = await db.from('app_stories').select('*').order('enabled', { ascending: false }).order('sort_order', { ascending: false }).order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoryRow[];
    },
  });
  const byId = useMemo(() => new Map((rows.data ?? []).map((r) => [r.id, r])), [rows.data]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-app-stories'] });

  const save = useMutation({
    mutationFn: async ({ row, story }: { row: StoryRow; story: Record<string, unknown> }) => {
      const payload = { ...row, story: row.action === 'hide' ? {} : story };
      delete (payload as { updated_at?: string }).updated_at;
      const { error } = isNew ? await db.from('app_stories').insert(payload) : await db.from('app_stories').update(payload).eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); invalidate(); toast.success('Story saxlanıldı'); },
    onError: (e) => toast.error(e instanceof Error && /duplicate|unique/i.test(e.message) ? 'Bu ID artıq var' : 'Saxlanmadı'),
  });
  const toggle = useMutation({
    mutationFn: async (r: StoryRow) => { const { error } = await db.from('app_stories').update({ enabled: !r.enabled }).eq('id', r.id); if (error) throw error; },
    onSuccess: invalidate, onError: () => toast.error('Dəyişmədi'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from('app_stories').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success('Silindi'); }, onError: () => toast.error('Silinmədi'),
  });
  const hideBundled = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('app_stories').upsert({ id, language: 'az', action: 'hide', story: {}, audience: 'all', enabled: true, sort_order: 0 });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Story gizlədildi'); }, onError: () => toast.error('Gizlədilmədi'),
  });

  const open = (row: StoryRow, fresh: boolean) => {
    setEditing(row); setIsNew(fresh);
    setJson(JSON.stringify(row.action === 'hide' ? {} : row.story, null, 2));
  };
  const check = editing ? storyRowProblems(editing, json) : null;
  const set = (patch: Partial<StoryRow>) => setEditing((e) => (e ? { ...e, ...patch } : e));
  const addSlide = (t: StoryTemplate) => {
    try {
      const s = JSON.parse(json) as { slides?: unknown[] };
      s.slides = [...(Array.isArray(s.slides) ? s.slides : []), SLIDE_TEMPLATES[t]];
      setJson(JSON.stringify(s, null, 2));
    } catch { toast.error('Əvvəl JSON-u düzəldin'); }
  };

  const columns: Column<StoryRow>[] = [
    { key: 'title', header: 'Story', mobile: 'title', cell: (r) => (
      <span><strong>{r.action === 'hide' ? BUNDLED.get(r.id)?.title ?? r.id : String(r.story.title ?? r.id)}</strong><br />
        <small className="ak-muted">{r.id}{BUNDLED.has(r.id) ? (r.action === 'hide' ? ' · tətbiqdəki story gizlədilib' : ' · tətbiqdəkini əvəz edir') : ' · yeni'}</small></span>) },
    { key: 'state', header: 'Vəziyyət', cell: (r) => <StatusPill tone={r.enabled ? 'success' : 'neutral'}>{r.enabled ? (r.audience === 'all' ? 'Hamı görür' : 'Yalnız adminlər') : 'Söndürülüb'}</StatusPill> },
    { key: 'window', header: 'Tarix', mobile: 'meta', cell: (r) => (r.starts_at || r.ends_at ? `${r.starts_at ? fmtDateTime(r.starts_at) : '...'} → ${r.ends_at ? fmtDateTime(r.ends_at) : '...'}` : 'Həmişə') },
    { key: 'on', header: 'Aktiv', align: 'end', cell: (r) => <Switch checked={r.enabled} onCheckedChange={() => toggle.mutate(r)} aria-label={`${r.id} aktiv`} onClick={(e) => e.stopPropagation()} /> },
  ];
  const bundledColumns: Column<Story>[] = [
    { key: 'title', header: 'Tətbiqdəki story', mobile: 'title', cell: (s) => <span><strong>{s.title}</strong><br /><small className="ak-muted">{s.module} · {s.id}</small></span> },
    { key: 'state', header: 'Server', cell: (s) => { const r = byId.get(s.id); return r ? <StatusPill tone={r.action === 'hide' ? 'warning' : 'info'}>{r.action === 'hide' ? 'Gizlədilib' : 'Əvəz olunur'}</StatusPill> : <StatusPill>Olduğu kimi</StatusPill>; } },
  ];

  return (
    <Page testId="admin-stories">
      <PageHeader title="Story-lər" subtitle="Ana səhifə story-lərini tətbiq yeniləməsi olmadan əlavə edin, dəyişin və ya gizlədin"
        actions={<Btn variant="primary" onClick={() => open(blankRow(), true)}><Plus size={14} /> Yeni story</Btn>} />
      <Notice>Server story-ləri bu funksiyanı daşıyan yeni build-dən başlayaraq görünür. Köhnə build-lər tətbiqdəki story-ləri göstərməyə davam edir.
        Yeni story-ni əvvəl "Yalnız adminlər" ilə yoxlayın, sonra "Hamı" edin. Baxış statistikası "Story statistikası" səhifəsindədir.</Notice>
      <Section title="Server story-ləri">
        <DataTable columns={columns} rows={rows.data} rowKey={(r) => r.id} loading={rows.isLoading} error={rows.error} onRetry={() => void rows.refetch()}
          onRowClick={(r) => open(r, false)} empty="Hələ server story-si yoxdur."
          actions={[
            { label: 'Redaktə et', icon: <Pencil size={14} />, onSelect: (r) => open(r, false) },
            { label: 'Sil', icon: <Trash2 size={14} />, danger: true, separatorBefore: true,
              onSelect: async (r) => { if (await confirm({ title: 'Story silinsin?', description: r.action === 'hide' ? 'Tətbiqdəki story yenidən görünəcək.' : 'Story tətbiqlərdən yox olacaq.', danger: true, confirmLabel: 'Sil' })) remove.mutate(r.id); } },
          ]} />
      </Section>
      <Section title="Tətbiqdəki story-lər" description="Bunlar build-in içindədir. Birini əvəz etmək üçün kopyalayın, lazım deyilsə gizlədin.">
        <DataTable columns={bundledColumns} rows={STORIES_AZ} rowKey={(s) => s.id}
          actions={[
            { label: 'Kopyala və dəyiş', icon: <Pencil size={14} />, onSelect: (s) => open({ ...blankRow(), id: s.id, story: stripId(s), audience: 'test' }, !byId.has(s.id)) },
            { label: 'Yeni story üçün şablon', icon: <Plus size={14} />, onSelect: (s) => open({ ...blankRow(), id: `${s.id}-2`, story: stripId(s) }, true) },
            { label: 'Gizlət', icon: <EyeOff size={14} />, hidden: (s) => byId.get(s.id)?.action === 'hide', onSelect: (s) => hideBundled.mutate(s.id) },
          ]} />
      </Section>

      <SideDrawer open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} size="lg"
        title={isNew ? 'Yeni story' : `Story: ${editing?.id ?? ''}`} description="Mətn işarələri: ==vurğu==, __rəngli__, **qalın**. {weekLabel}, {fruit}, {babyName} kimi dəyişənlər cihazda doldurulur."
        onSave={() => { if (editing && check && !check.problems.length) save.mutate({ row: editing, story: JSON.parse(json || '{}') }); }}
        saving={save.isPending} saveDisabled={!check || check.problems.length > 0}>
        {editing && (
          <div className="space-y-4">
            <label className="text-sm space-y-1 block"><span className="font-medium">ID (statistika bu ID ilə sayılır)</span>
              <Input value={editing.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value.trim().toLowerCase() })} placeholder="məs. bump-winter-tips" /></label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={editing.enabled} onCheckedChange={(v) => set({ enabled: v })} />Aktiv</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.audience === 'all'} onCheckedChange={(v) => set({ audience: v ? 'all' : 'test' })} />Hamı görsün (söndürülübsə yalnız adminlər)</label>
              {BUNDLED.has(editing.id) && <label className="flex items-center gap-2 text-sm"><Switch checked={editing.action === 'hide'} onCheckedChange={(v) => set({ action: v ? 'hide' : 'show' })} />Tətbiqdəki story-ni gizlət</label>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm space-y-1"><span className="font-medium">Başlama</span><Input type="datetime-local" value={toLocal(editing.starts_at)} onChange={(e) => set({ starts_at: fromLocal(e.target.value) })} /></label>
              <label className="text-sm space-y-1"><span className="font-medium">Bitmə</span><Input type="datetime-local" value={toLocal(editing.ends_at)} onChange={(e) => set({ ends_at: fromLocal(e.target.value) })} /></label>
              <label className="text-sm space-y-1"><span className="font-medium">Sıra (böyük öndə)</span><Input type="number" value={editing.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) || 0 })} /></label>
            </div>
            <label className="text-sm space-y-1 block"><span className="font-medium">Qeyd (yalnız admin üçün)</span>
              <Input value={editing.note ?? ''} maxLength={500} onChange={(e) => set({ note: e.target.value || null })} /></label>
            {editing.action === 'show' && (
              <>
                <div className="text-sm space-y-1">
                  <span className="font-medium">Slayd əlavə et</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(SLIDE_TEMPLATES) as StoryTemplate[]).map((t) => <Btn key={t} size="sm" onClick={() => addSlide(t)}>+ {t}</Btn>)}
                  </div>
                </div>
                <label className="text-sm space-y-1 block"><span className="font-medium">Story (JSON)</span>
                  <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={18} spellCheck={false} className="font-mono text-xs" /></label>
                <p className="text-xs ak-muted">module: bump | mommy | flow | all · theme: {Object.keys(STORY_THEMES).join(', ')} · illus: {ILLUSTRATION_NAMES.join(', ')} ·
                  şablonlar: cover, fact, list, myth, quiz, alert, quote, cta · audience: weekFrom/weekTo, monthsFrom/monthsTo, premium:false</p>
              </>
            )}
            {check && check.problems.length > 0 && <Notice tone="warning">{check.problems.map((p) => <div key={p}>{p}</div>)}</Notice>}
            {check && check.dropped > 0 && <Notice tone="warning">{check.dropped} slayd natamam olduğu üçün tətbiqdə göstərilməyəcək.</Notice>}
            {check?.story && <Btn onClick={() => setPreview(check.story)}><Eye size={14} /> Önizləmə</Btn>}
          </div>
        )}
      </SideDrawer>
      {preview && <StoryViewer stories={[preview]} startIndex={0} vars={SAMPLE_VARS} onClose={() => setPreview(null)} onSeen={() => {}} onCta={() => setPreview(null)} onEvent={() => {}} />}
    </Page>
  );
}
