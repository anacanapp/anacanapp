import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Copy, Globe2, ListChecks, Plus, Settings, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { QUIZ_COPY } from '@/lib/daily-quiz/copy';
import {
  AdminTabs, Btn, DataTable, Field, FilterChips, KpiRow, Notice, Page, PageHeader, SearchInput, Section, SettingRow, SideDrawer,
  StatTile, StatusPill, fmtDate, fmtNumber, foldText, useAdminConfirm, type Column,
} from './kit';

// Tables added after the generated types; a loose client keeps this file free of casts to any.
const db = supabase as unknown as SupabaseClient;

export const QUIZ_CATEGORIES = ['pregnancy', 'baby_food', 'sleep', 'development', 'health', 'safety', 'postpartum'] as const;
type Category = typeof QUIZ_CATEGORIES[number];
export interface QuizRow {
  id?: string; group_id?: string; language: string; category: Category; question: string; options: string[]; correct_index: number;
  explanation: string; source: string | null; article_url: string | null; is_active: boolean; sort_order: number; updated_at?: string;
}
interface Stats {
  config: { enabled: boolean; languages: string[]; questions_per_day: number; seconds_per_question: number };
  languages: Record<string, { total: number; active: number }>;
  days: { date: string; players: number; finished: number; avg_correct: number | null }[];
  totals: { players: number; rounds: number; perfect: number };
  questions: Record<string, { answered: number; correct: number }>;
  leaderboard: { rank: number; points: number; rounds: number; name: string; user_id: string }[];
  week_start: string;
}

const CAT_LABEL = QUIZ_COPY.az.categories;
const LANG_NAME = Object.fromEntries(APP_LANGUAGES.map((l) => [l.code, `${l.native_name} (${l.code})`]));
const LETTERS = ['A', 'B', 'C', 'D'];
const blank = (language: string): QuizRow => ({
  language, category: 'pregnancy', question: '', options: ['', '', '', ''], correct_index: 0, explanation: '', source: null, article_url: null,
  is_active: false, sort_order: 0,
});

/** What would stop a question from saving (mirrors the table checks) plus house style. */
export function quizRowProblems(r: QuizRow): string[] {
  const p: string[] = [];
  if (r.question.trim().length < 5) p.push('Sual ən azı 5 simvol olmalıdır.');
  if (r.question.length > 300) p.push('Sual 300 simvoldan uzun ola bilməz.');
  if (r.options.length !== 4 || r.options.some((o) => !o.trim())) p.push('4 variantın hamısı doldurulmalıdır.');
  if (r.options.some((o) => o.length > 120)) p.push('Variant 120 simvoldan uzun ola bilməz.');
  if (new Set(r.options.map((o) => o.trim().toLowerCase())).size !== r.options.length) p.push('Variantlar təkrarlanmamalıdır.');
  if (r.explanation.length > 600) p.push('İzah 600 simvoldan uzun ola bilməz.');
  if ([r.question, r.explanation, ...r.options].some((s) => s.includes('—'))) p.push('Uzun tire (—) istifadə etməyin.');
  if (r.article_url && !/^(https:\/\/(www\.)?anacan\.az\/|anacan:\/\/|\/)/.test(r.article_url)) p.push('Məqalə linki anacan.az, anacan:// və ya / ilə başlamalıdır.');
  return p;
}

/**
 * Bilik Yarışı (2026-11-13): questions per language in public.quiz_questions (translations share group_id), the
 * languages that are live (app_settings.daily_quiz), statistics and the weekly leaderboard.
 */
export default function AdminDailyQuiz() {
  const [tab, setTab] = useState<'questions' | 'languages' | 'stats' | 'settings'>('questions');
  const [language, setLanguage] = useState('az');
  const stats = useQuery({
    queryKey: ['admin-daily-quiz-stats', language],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_daily_quiz_stats_v1', { p_language: language, p_days: 30 });
      if (error) throw error;
      return data as Stats;
    },
  });
  return (
    <Page testId="admin-daily-quiz">
      <PageHeader title="Bilik Yarışı" subtitle="Gündəlik sualları, dilləri, statistikanı və həftəlik reytinqi idarə edin" />
      <AdminTabs value={tab} onChange={setTab} items={[
        { value: 'questions', label: 'Suallar', icon: <ListChecks size={14} /> },
        { value: 'languages', label: 'Dillər və tərcümə', icon: <Globe2 size={14} /> },
        { value: 'stats', label: 'Statistika və reytinq', icon: <BarChart3 size={14} /> },
        { value: 'settings', label: 'Ayarlar', icon: <Settings size={14} /> },
      ]} />
      {tab === 'questions' && <Questions language={language} setLanguage={setLanguage} stats={stats.data} />}
      {tab === 'languages' && <Languages stats={stats.data} onEdit={(l) => { setLanguage(l); setTab('questions'); }} />}
      {tab === 'stats' && <StatsView language={language} setLanguage={setLanguage} stats={stats.data} loading={stats.isLoading} />}
      {tab === 'settings' && stats.data && <SettingsView config={stats.data.config} />}
    </Page>
  );
}

function LanguagePicker({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  return (
    <select className="ak-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Dil">
      {APP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{LANG_NAME[l.code]}</option>)}
    </select>
  );
}

function Questions({ language, setLanguage, stats }: { language: string; setLanguage: (l: string) => void; stats?: Stats }) {
  const qc = useQueryClient();
  const confirm = useAdminConfirm();
  const [category, setCategory] = useState<'all' | Category>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<QuizRow | null>(null);
  const rows = useQuery({
    queryKey: ['admin-quiz-questions', language],
    queryFn: async () => {
      const { data, error } = await db.from('quiz_questions').select('*').eq('language', language).order('sort_order').order('created_at');
      if (error) throw error;
      return (data ?? []) as QuizRow[];
    },
  });
  const source = useQuery({
    enabled: language !== 'az',
    queryKey: ['admin-quiz-questions', 'az'],
    queryFn: async () => {
      const { data, error } = await db.from('quiz_questions').select('*').eq('language', 'az');
      if (error) throw error;
      return (data ?? []) as QuizRow[];
    },
  });
  const sourceByGroup = useMemo(() => new Map((source.data ?? []).map((r) => [r.group_id, r])), [source.data]);
  const save = useMutation({
    mutationFn: async (r: QuizRow) => {
      const payload = { ...r, question: r.question.trim(), options: r.options.map((o) => o.trim()), explanation: r.explanation.trim(),
        source: r.source?.trim() || null, article_url: r.article_url?.trim() || null };
      delete payload.updated_at;
      const { error } = r.id ? await db.from('quiz_questions').update(payload).eq('id', r.id) : await db.from('quiz_questions').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Sual yadda saxlanıldı'); setEditing(null); void qc.invalidateQueries({ queryKey: ['admin-quiz-questions'] }); void qc.invalidateQueries({ queryKey: ['admin-daily-quiz-stats'] }); },
    onError: (e: Error) => toast.error('Yadda saxlamaq alınmadı: ' + e.message),
  });
  const toggle = useMutation({
    mutationFn: async (r: QuizRow) => { const { error } = await db.from('quiz_questions').update({ is_active: !r.is_active }).eq('id', r.id!); if (error) throw error; },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-quiz-questions'] }); void qc.invalidateQueries({ queryKey: ['admin-daily-quiz-stats'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = async (r: QuizRow) => {
    if (!(await confirm({ title: 'Sualı silmək?', description: r.question, confirmLabel: 'Sil', danger: true }))) return;
    const { error } = await db.from('quiz_questions').delete().eq('id', r.id!);
    if (error) toast.error(error.message); else { toast.success('Silindi'); void qc.invalidateQueries({ queryKey: ['admin-quiz-questions'] }); }
  };
  const q = foldText(search);
  const list = (rows.data ?? []).filter((r) => (category === 'all' || r.category === category)
    && (!q || foldText([r.question, ...r.options, r.explanation].join(' ')).includes(q)));
  const counts = Object.fromEntries(QUIZ_CATEGORIES.map((c) => [c, (rows.data ?? []).filter((r) => r.category === c).length]));
  const perQ = stats?.questions ?? {};
  const columns: Column<QuizRow>[] = [
    { key: 'q', header: 'Sual', mobile: 'title', cell: (r) => <span className="ak-cell-main" style={{ whiteSpace: 'normal' }}>{r.question}</span> },
    { key: 'cat', header: 'Kateqoriya', sortable: true, sortValue: (r) => r.category, cell: (r) => <span className="ak-cell-sub">{CAT_LABEL[r.category]}</span> },
    { key: 'answer', header: 'Düzgün cavab', mobile: 'hidden', cell: (r) => <span className="ak-cell-sub">{LETTERS[r.correct_index]}. {r.options[r.correct_index]}</span> },
    { key: 'rate', header: 'Düz cavab %', align: 'end', sortable: true, sortValue: (r) => (perQ[r.id!]?.answered ? perQ[r.id!].correct / perQ[r.id!].answered : -1),
      cell: (r) => { const s = perQ[r.id!]; return s?.answered ? <span className="ak-num">{Math.round((100 * s.correct) / s.answered)}%<span className="ak-cell-sub"> {s.answered} cavab</span></span> : <span className="ak-cell-sub">—</span>; } },
    { key: 'active', header: 'Aktiv', align: 'center', cell: (r) => <span onClick={(e) => e.stopPropagation()}><Switch checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} aria-label="Aktiv" /></span> },
  ];
  const problems = editing ? quizRowProblems(editing) : [];
  const src = editing && language !== 'az' ? sourceByGroup.get(editing.group_id) : undefined;
  return (
    <>
      <Section title={`Suallar: ${LANG_NAME[language] ?? language}`} description={`${rows.data?.length ?? 0} sual, ${(rows.data ?? []).filter((r) => r.is_active).length} aktiv. Gündə ${stats?.config.questions_per_day ?? 5} sual seçilir; oyunçuya son 60 gündə düşməyənlər əvvəl verilir.`}
        actions={<><LanguagePicker value={language} onChange={setLanguage} /><Btn variant="primary" onClick={() => setEditing(blank(language))}><Plus size={14} /> Yeni sual</Btn></>}>
        <div className="px-4 pb-3 flex flex-col gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Sual, variant və ya izahda axtar" />
          <FilterChips label="Kateqoriya" value={category} onChange={setCategory} options={[{ value: 'all', label: 'Hamısı', count: rows.data?.length ?? 0 },
            ...QUIZ_CATEGORIES.map((c) => ({ value: c, label: CAT_LABEL[c], count: counts[c] }))]} />
        </div>
        <DataTable columns={columns} rows={rows.isLoading ? undefined : list} rowKey={(r) => r.id!} loading={rows.isLoading} error={rows.error ? true : null}
          onRetry={() => void rows.refetch()} pageSize={25} onRowClick={(r) => setEditing({ ...r, options: [...r.options] })}
          actions={[{ label: 'Sil', icon: <Trash2 size={14} />, danger: true, onSelect: (r) => void remove(r) }]}
          empty={'Bu dildə sual yoxdur'} />
      </Section>
      <SideDrawer open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} size="lg" title={editing?.id ? 'Sualı redaktə et' : 'Yeni sual'}
        description={LANG_NAME[editing?.language ?? language]} onSave={() => editing && save.mutate(editing)} saving={save.isPending} saveDisabled={problems.length > 0}>
        {editing && <div className="flex flex-col gap-4">
          {src && <Notice tone="info"><b>Azərbaycan dilində mənbə</b> 
            <p style={{ whiteSpace: 'pre-wrap' }}>{src.question}{'\n'}{src.options.map((o, i) => `${LETTERS[i]}. ${o}${i === src.correct_index ? '  ✓' : ''}`).join('\n')}{'\n\n'}{src.explanation}</p>
          </Notice>}
          <Field label="Sual" required>{(id) => <Textarea id={id} rows={2} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />}</Field>
          <Field label="Kateqoriya">{(id) => <select id={id} className="ak-select" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as Category })}>
            {QUIZ_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>}</Field>
          {editing.options.map((o, i) => (
            <Field key={i} label={<span>{LETTERS[i]} variantı {i === editing.correct_index && <StatusPill tone="success" dot={false}>Düzgün</StatusPill>}</span>} required>
              {(id) => <div className="flex gap-2 items-center">
                <Input id={id} value={o} onChange={(e) => { const options = [...editing.options]; options[i] = e.target.value; setEditing({ ...editing, options }); }} />
                <Btn size="sm" variant={i === editing.correct_index ? 'primary' : 'default'} onClick={() => setEditing({ ...editing, correct_index: i })}>Düzgün</Btn>
              </div>}
            </Field>))}
          <Field label="İzah (cavabdan sonra göstərilir)">{(id) => <Textarea id={id} rows={3} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mənbə (ÜST, AAP…)">{(id) => <Input id={id} value={editing.source ?? ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />}</Field>
            <Field label="Sıra">{(id) => <Input id={id} type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} />}</Field>
          </div>
          <Field label="Məqalə linki (istəyə görə)" hint="https://anacan.az/… və ya anacan://…">{(id) => <Input id={id} value={editing.article_url ?? ''} onChange={(e) => setEditing({ ...editing, article_url: e.target.value })} />}</Field>
          <SettingRow title="Aktiv" description="Aktiv suallar gündəlik yarışa düşür." control={<Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />} />
          {problems.length > 0 && <Notice tone="warning"><b>Düzəldin</b> {problems.map((p) => <p key={p}>{p}</p>)}</Notice>}
        </div>}
      </SideDrawer>
    </>
  );
}

function Languages({ stats, onEdit }: { stats?: Stats; onEdit: (l: string) => void }) {
  const qc = useQueryClient();
  const confirm = useAdminConfirm();
  const cfg = stats?.config;
  const azTotal = stats?.languages.az?.total ?? 0;
  const setLanguages = useMutation({
    mutationFn: async (languages: string[]) => {
      const { error } = await db.rpc('admin_daily_quiz_settings_v1', { p_settings: { ...cfg, languages } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Yadda saxlanıldı'); void qc.invalidateQueries({ queryKey: ['admin-daily-quiz-stats'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const drafts = useMutation({
    mutationFn: async (target: string) => {
      const [{ data: az, error: e1 }, { data: have, error: e2 }] = await Promise.all([
        db.from('quiz_questions').select('*').eq('language', 'az'),
        db.from('quiz_questions').select('group_id').eq('language', target),
      ]);
      if (e1 || e2) throw e1 || e2;
      const done = new Set((have ?? []).map((r: { group_id: string }) => r.group_id));
      const rows = ((az ?? []) as QuizRow[]).filter((r) => !done.has(r.group_id)).map((r) => ({
        group_id: r.group_id, language: target, category: r.category, question: r.question, options: r.options, correct_index: r.correct_index,
        explanation: r.explanation, source: r.source, article_url: r.article_url, is_active: false, sort_order: r.sort_order,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from('quiz_questions').insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n, target) => { toast.success(`${n} qaralama yaradıldı`); void qc.invalidateQueries({ queryKey: ['admin-daily-quiz-stats'] }); onEdit(target); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!cfg) return null;
  const rows = APP_LANGUAGES.map((l) => ({ code: l.code, ...(stats?.languages[l.code] ?? { total: 0, active: 0 }), live: cfg.languages.includes(l.code) }));
  const columns: Column<typeof rows[number]>[] = [
    { key: 'lang', header: 'Dil', mobile: 'title', cell: (r) => <span className="ak-cell-main">{LANG_NAME[r.code]}</span> },
    { key: 'q', header: 'Suallar', align: 'end', sortable: true, sortValue: (r) => r.total,
      cell: (r) => <span className="ak-num">{r.active} aktiv<span className="ak-cell-sub"> / {r.total} · AZ {azTotal}</span></span> },
    { key: 'state', header: 'Vəziyyət', cell: (r) => r.live ? <StatusPill tone="success">Canlıdır</StatusPill>
      : r.active >= cfg.questions_per_day ? <StatusPill tone="info">Hazırdır</StatusPill> : <StatusPill tone="neutral">Sual azdır</StatusPill> },
    { key: 'act', header: '', align: 'end', cell: (r) => <span className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
      {r.code !== 'az' && r.total < azTotal && <Btn size="sm" disabled={drafts.isPending} onClick={() => drafts.mutate(r.code)}><Copy size={13} /> Tərcümə qaralaması</Btn>}
      <Btn size="sm" onClick={() => onEdit(r.code)}>Suallar</Btn>
      <Switch checked={r.live} disabled={setLanguages.isPending || (!r.live && r.active < cfg.questions_per_day)} aria-label="Canlı"
        onCheckedChange={async (on) => {
          if (on && !(await confirm({ title: `${LANG_NAME[r.code]} dilində yarışı açmaq?`, description: 'Bu dildə istifadəçilər Alətlər bölməsində "Bilik Yarışı"nı görəcək.', confirmLabel: 'Aç' }))) return;
          setLanguages.mutate(on ? [...cfg.languages, r.code] : cfg.languages.filter((x) => x !== r.code));
        }} />
    </span> },
  ];
  return (
    <Section title="Dillər və tərcümə" description={`Yeni dil üçün: 1) "Tərcümə qaralaması" Azərbaycan suallarını həmin dilə qeyri-aktiv kopyalayır. 2) Hər sualı açıb tərcümə edin (solda Azərbaycan mənbəyi görünür) və aktiv edin. 3) Ən azı ${cfg.questions_per_day} aktiv sual olanda dili "Canlı" edin. Ekran mətnləri 23 dildə hazırdır.`}>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.code} onRowClick={(r) => onEdit(r.code)} />
    </Section>
  );
}

function StatsView({ language, setLanguage, stats, loading }: { language: string; setLanguage: (l: string) => void; stats?: Stats; loading: boolean }) {
  const s = stats;
  const avg = s && s.days.length ? s.days.reduce((a, d) => a + Number(d.avg_correct ?? 0), 0) / s.days.length : 0;
  const boardCols: Column<Stats['leaderboard'][number]>[] = [
    { key: 'rank', header: '#', width: 48, cell: (r) => <b>{r.rank}</b> },
    { key: 'name', header: 'İstifadəçi', mobile: 'title', cell: (r) => <span className="ak-cell-main">{r.name}</span> },
    { key: 'rounds', header: 'Oyun', align: 'end', cell: (r) => r.rounds },
    { key: 'points', header: 'Xal', align: 'end', cell: (r) => <b>{fmtNumber(r.points)}</b> },
  ];
  const dayCols: Column<Stats['days'][number]>[] = [
    { key: 'date', header: 'Gün', mobile: 'title', cell: (d) => fmtDate(d.date) },
    { key: 'players', header: 'Başlayan', align: 'end', cell: (d) => d.players },
    { key: 'finished', header: 'Bitirən', align: 'end', cell: (d) => d.finished },
    { key: 'avg', header: 'Orta düz cavab', align: 'end', cell: (d) => d.avg_correct ?? '—' },
  ];
  return (
    <>
      <Section title="Son 30 gün" actions={<LanguagePicker value={language} onChange={setLanguage} />}>
        <KpiRow columns={4}>
          <StatTile label="Oyunçu" loading={loading} value={fmtNumber(s?.totals.players ?? 0)} />
          <StatTile label="Bitirilmiş oyun" loading={loading} value={fmtNumber(s?.totals.rounds ?? 0)} />
          <StatTile label="Tam düz (5/5)" loading={loading} value={fmtNumber(s?.totals.perfect ?? 0)} />
          <StatTile label="Orta düz cavab" loading={loading} value={avg.toFixed(2)} />
        </KpiRow>
      </Section>
      <Section title="Bu həftənin reytinqi" description={s ? `${fmtDate(s.week_start)} bazar ertəsindən. Tətbiqdə yalnız ad görünür.` : undefined}>
        <DataTable columns={boardCols} rows={s?.leaderboard} rowKey={(r) => r.user_id} loading={loading} pageSize={25}
          empty={'Bu həftə hələ oyun yoxdur'} />
      </Section>
      <Section title="Günlər">
        <DataTable columns={dayCols} rows={s?.days} rowKey={(d) => d.date} loading={loading} pageSize={31} empty={'Məlumat yoxdur'} />
      </Section>
      <Notice tone="info"><b><span><Trophy size={14} /> Sual üzrə düz cavab faizi</span></b> "Suallar" cədvəlində "Düz cavab %" sütununa görə sıralayın: çox çətin və ya çox asan sualları oradan tapın.</Notice>
    </>
  );
}

function SettingsView({ config }: { config: Stats['config'] }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(config);
  const save = useMutation({
    mutationFn: async () => { const { error } = await db.rpc('admin_daily_quiz_settings_v1', { p_settings: draft }); if (error) throw error; },
    onSuccess: () => { toast.success('Ayarlar yadda saxlanıldı'); void qc.invalidateQueries({ queryKey: ['admin-daily-quiz-stats'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Section title="Ayarlar">
      <div className="px-4 pb-4 flex flex-col gap-4">
        <SettingRow title="Bilik Yarışı açıqdır" description="Söndürsəniz, heç bir dildə görünməz (adminlərdən başqa)."
          control={<Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gündə sual sayı" hint="3-10">{(id) => <Input id={id} type="number" min={3} max={10} value={draft.questions_per_day}
            onChange={(e) => setDraft({ ...draft, questions_per_day: Number(e.target.value) || 5 })} />}</Field>
          <Field label="Hər suala saniyə" hint="10-60">{(id) => <Input id={id} type="number" min={10} max={60} value={draft.seconds_per_question}
            onChange={(e) => setDraft({ ...draft, seconds_per_question: Number(e.target.value) || 20 })} />}</Field>
        </div>
        <Notice tone="info"><b>Xal qaydası</b> Hər düz cavab 20 xal, hamısı düz olsa +20 bonus. Liqa həftəlik xala görə: Bürünc 0-149, Gümüş 150-349, Qızıl 350+. Hər bazar ertəsi (Bakı vaxtı) yenilənir.</Notice>
        <div><Btn variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>Yadda saxla</Btn></div>
      </div>
    </Section>
  );
}
