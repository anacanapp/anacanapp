import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, HeartHandshake, History, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { loadBundledParentingContent, PARENTING_CONTENT_LANGUAGES, resetParentingContentCache } from '@/data/parenting';
import type { ParentingContent, ParentingItemType } from '@/data/parenting/types';
import { LOCKED_KEYS, diffPatch, findParentingItem, patchItem } from '@/lib/parenting-overrides';
import {
  Btn, EmptyState, ErrorState, Field, FilterChips, Notice, Page, PageHeader, SearchInput, Section, SelectFilter, SkeletonRows, StatusPill,
  Toolbar, foldText, fmtDateTime, useAdminConfirm,
} from './kit';
import { RPC_MISSING, optionalRpc } from './data/rpc';

/** The item as the app renders it (lazy: pulls in the tool's screens only when an editor opens the preview). */
const ParentingPreview = lazy(() => import('@/components/tools/parenting/ParentingPreview'));

/**
 * Admin → Tərbiyə məzmunu: editors change the tool's texts without an app release. Pick a language → item type →
 * item, see the bundled text, edit the text fields, save a draft, publish (users get it on their next load, cached
 * up to 10 minutes), unpublish or revert to the bundled text. Structure (ids, age bands, Free/Premium, scoring) is
 * never editable here. Rows live in public.parenting_content_overrides; writes go through admin RPCs.
 */

export interface OverrideAdminRow {
  item_type: ParentingItemType;
  item_id: string;
  patch: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
}

const TYPE_LABELS: Record<ParentingItemType, string> = {
  article: 'Məqalə', sos: 'SOS kartı', programme: 'Proqram', programme_day: 'Proqram günü', tip: 'Gündəlik məsləhət',
  band: 'Yaş dövrü', area: 'Mövzu sahəsi', quiz: 'Test',
};
const TYPE_ORDER: ParentingItemType[] = ['article', 'sos', 'programme_day', 'tip', 'band', 'quiz', 'programme', 'area'];

const FIELD_LABELS: Record<string, string> = {
  title: 'Başlıq', summary: 'Qısa xülasə', emoji: 'Emoji', science: 'Elm nə deyir (hər sətir bir paraqraf)', tryToday: 'Bu gün sına',
  mistakes: 'Tez-tez edilən səhvlər', byAge: 'Yaşa görə qeydlər', specialist: 'Nə vaxt mütəxəssisə (həmişə pulsuz)', sources: 'Elmi mənbələr',
  tags: 'Açar sözlər (axtarış və Anacan.AI)', moment: 'An (bir cümlə)', steps: 'Üç addım', say: 'Belə deyə bilərsən', avoid: 'Bunu etmə',
  redFlag: 'Təhlükə siqnalı (həmişə pulsuz)', text: 'Mətn', intro: 'Giriş', task: 'Tapşırıq', why: 'Niyə işləyir', lead: 'Giriş cümləsi',
  brain: 'Beyində nə baş verir', needs: 'Səndən nəyə ehtiyacı var', normal: 'Bu yaşda normaldır', tryThis: 'Bu yaşda sına', who: 'Müəllif / təşkilat',
  year: 'İl', scale: 'Cavab şkalası', items: 'Suallar', results: 'Nəticələr', short: 'Qısa nəticə', detail: 'Ətraflı (Premium)', next: 'Növbəti addımlar',
  note: 'Qeyd', answers: 'Cavab variantları', regression: 'Geriləmə sualı', checkpoints: 'Yoxlama nöqtələri', support: 'Necə dəstəkləmək olar (Premium)',
  '0-1': '0–1 yaş', '1-3': '1–3 yaş', '3-6': '3–6 yaş', '6-12': '6–12 yaş',
};
/** Optional fields an editor may add per type (mirrors OPTIONAL_TEMPLATES in parenting-overrides). */
const OPTIONAL_BY_TYPE: Partial<Record<ParentingItemType, Record<string, unknown>>> = {
  article: { byAge: { '0-1': '', '1-3': '', '3-6': '', '6-12': '' }, tags: [] },
  sos: { byAge: { '0-1': '', '1-3': '', '3-6': '', '6-12': '' }, redFlag: '', tags: [] },
  programme: { tags: [] },
};
const EMERGENCY_DIGITS = /(^|[^\d])(103|112|911|999)(?!\d)/;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const languageName = (code: string) => APP_LANGUAGES.find((l) => l.code === code)?.native_name ?? code;
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>)(name, args);

/** The item list for one type: ids as stored in the overrides table. */
export function listItems(content: ParentingContent, type: ParentingItemType): { id: string; label: string; sub?: string }[] {
  switch (type) {
    case 'article': return content.articles.map((a) => ({ id: a.id, label: `${a.emoji} ${a.title}`, sub: a.summary }));
    case 'sos': return content.sos.map((c) => ({ id: c.id, label: `${c.emoji} ${c.title}`, sub: c.moment }));
    case 'programme': return content.programmes.map((p) => ({ id: p.id, label: `${p.emoji} ${p.title}`, sub: p.summary }));
    case 'programme_day': return content.programmes.flatMap((p) => p.days.map((d, i) => ({ id: `${p.id}:${i + 1}`, label: `${p.title} · ${i + 1}: ${d.title}`, sub: d.task })));
    case 'tip': return (Object.keys(content.tips) as (keyof ParentingContent['tips'])[]).flatMap((band) =>
      content.tips[band].map((t, i) => ({ id: `${band}:${i + 1}`, label: `${band} · ${t.title}`, sub: t.text })));
    case 'band': return content.bands.map((b) => ({ id: b.id, label: `${b.emoji} ${b.id}: ${b.title}`, sub: b.lead }));
    case 'area': return content.areas.map((a) => ({ id: a.id, label: `${a.emoji} ${a.title}` }));
    case 'quiz': return [content.styleQuiz, content.milestoneQuiz].map((q) => ({ id: q.id, label: `${q.emoji} ${q.title}`, sub: q.intro }));
  }
}

/** Safety checks before publishing: keep {emergency} placeholders, never hard-code emergency numbers. */
export function overrideProblems(base: object, edited: object): string[] {
  const problems: string[] = [];
  const b = JSON.stringify(base), e = JSON.stringify(edited);
  const count = (s: string) => (s.match(/\{emergency\}/g) || []).length;
  if (count(e) < count(b)) problems.push('{emergency} yer tutucusu silinib: təcili nömrə ölkəyə görə avtomatik yazılır, onu saxla.');
  if (EMERGENCY_DIGITS.test(e) && !EMERGENCY_DIGITS.test(b)) problems.push('Təcili nömrəni mətnə yazma — {emergency} istifadə et.');
  return problems;
}

/** One saved version of an item (public.parenting_content_override_history). */
export interface OverrideHistoryRow {
  id: string;
  patch: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  published: boolean;
  action: string;
  edited_by: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  baseline: 'İlkin vəziyyət', draft: 'Qaralama', publish: 'Dərc', unpublish: 'Dərcdən çıxarılma', revert: 'Orijinala qaytarılma',
  restore: 'Bərpa', edit: 'Dəyişiklik',
};

/** The text a version stands for: the live patch when it was published, else its draft. */
export const versionPatch = (h: Pick<OverrideHistoryRow, 'patch' | 'draft' | 'published'>): Record<string, unknown> =>
  (h.published ? h.patch : h.draft ?? h.patch) ?? {};

/**
 * Translations that may be stale: the Azerbaijani override of an item was published after this language's row
 * changed (or this language has no row). Keys are `${item_type}|${item_id}`.
 */
export function staleTranslations(language: string, rows: OverrideAdminRow[] | null | undefined, azRows: OverrideAdminRow[] | null | undefined): Set<string> {
  const out = new Set<string>();
  if (language === 'az' || !azRows) return out;
  const mine = new Map((rows ?? []).map((r) => [`${r.item_type}|${r.item_id}`, r]));
  for (const az of azRows) {
    if (!az.published || !az.published_at) continue;
    const key = `${az.item_type}|${az.item_id}`;
    const row = mine.get(key);
    if (!row || row.updated_at < az.published_at) out.add(key);
  }
  return out;
}

type Status = 'bundled' | 'draft' | 'published' | 'published_draft';
const statusOf = (row: OverrideAdminRow | undefined): Status =>
  !row ? 'bundled' : row.published ? (row.draft ? 'published_draft' : 'published') : 'draft';
const STATUS_PILL: Record<Status, { tone: 'neutral' | 'success' | 'warning' | 'info'; label: string }> = {
  bundled: { tone: 'neutral', label: 'Orijinal' },
  draft: { tone: 'warning', label: 'Qaralama' },
  published: { tone: 'success', label: 'Dərc olunub' },
  published_draft: { tone: 'info', label: 'Dərc olunub + qaralama' },
};

export default function AdminParentingContent() {
  const [language, setLanguage] = useState(PARENTING_CONTENT_LANGUAGES[0] ?? 'az');
  const [type, setType] = useState<ParentingItemType>('article');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const bundled = useQuery({ queryKey: ['admin-parenting-bundled', language], queryFn: () => loadBundledParentingContent(language), staleTime: Infinity });
  const rows = useQuery({
    queryKey: ['admin-parenting-overrides', language],
    queryFn: async () => {
      const res = await optionalRpc<OverrideAdminRow[]>('admin_parenting_overrides_v1', { p_language: language });
      return res === RPC_MISSING ? null : (res ?? []);
    },
  });
  const byKey = useMemo(() => new Map((rows.data ?? []).map((r) => [`${r.item_type}|${r.item_id}`, r])), [rows.data]);
  // Azerbaijani is the source language: a newer published az override flags the other languages' text as possibly stale.
  const azRows = useQuery({
    queryKey: ['admin-parenting-overrides', 'az'],
    enabled: language !== 'az',
    queryFn: async () => {
      const res = await optionalRpc<OverrideAdminRow[]>('admin_parenting_overrides_v1', { p_language: 'az' });
      return res === RPC_MISSING ? null : (res ?? []);
    },
  });
  const stale = useMemo(() => staleTranslations(language, rows.data, azRows.data), [language, rows.data, azRows.data]);

  const items = useMemo(() => {
    if (!bundled.data) return [];
    const q = foldText(search);
    return listItems(bundled.data, type).filter((it) => !q || foldText(`${it.label} ${it.sub ?? ''} ${it.id}`).includes(q));
  }, [bundled.data, type, search]);
  const counts = useMemo(() => {
    const c: Partial<Record<ParentingItemType, number>> = {};
    for (const r of rows.data ?? []) c[r.item_type] = (c[r.item_type] ?? 0) + 1;
    return c;
  }, [rows.data]);

  useEffect(() => { setSelected(null); }, [language, type]);
  const pick = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };
  const refresh = async () => {
    resetParentingContentCache(language);
    try { localStorage.removeItem(`anacan.parenting.overrides.v1.${language}`); } catch { /* storage blocked */ }
    await qc.invalidateQueries({ queryKey: ['admin-parenting-overrides', language] });
  };

  return (
    <Page testId="admin-parenting-content">
      <PageHeader icon={<HeartHandshake size={17} />} title="Tərbiyə məzmunu"
        subtitle="Alətin mətnlərini tətbiq buraxılışı olmadan dəyiş: qaralama, dərc, orijinala qaytarma" />
      <Toolbar>
        <SelectFilter label="Dil" value={language} onChange={setLanguage}
          options={PARENTING_CONTENT_LANGUAGES.map((code) => ({ value: code, label: `${languageName(code)} (${code})` }))} />
        <SearchInput value={search} onChange={setSearch} placeholder="Başlıq, mətn və ya id ilə axtar…" />
      </Toolbar>
      <FilterChips label="Element növü" value={type} onChange={setType}
        options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t], count: counts[t] ?? null }))} />
      {rows.data === null && (
        <Notice tone="warning">Redaktə cədvəli hələ serverdə yoxdur (miqrasiya 20261107200000_parenting_sync_cms tətbiq olunmayıb). Mətnlərə baxmaq olar, saxlamaq olmaz.</Notice>
      )}
      <div className="ak-grid ak-grid-2" style={{ alignItems: 'start' }}>
        <Section title={`${TYPE_LABELS[type]} · ${items.length}`} flush>
          {bundled.isLoading ? <SkeletonRows rows={8} columns={1} />
            : bundled.isError || !bundled.data ? <ErrorState onRetry={() => bundled.refetch()} compact />
              : !items.length ? <EmptyState title="Heç nə tapılmadı" compact />
                : (
                  <ul className="ak-list" role="listbox" aria-label={TYPE_LABELS[type]} style={{ maxHeight: 640, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
                    {items.map((it) => {
                      const st = statusOf(byKey.get(`${type}|${it.id}`));
                      return (
                        <li key={it.id}>
                          <button type="button" role="option" aria-selected={selected === it.id} onClick={() => pick(it.id)}
                            className="ak-list-row" data-testid={`par-item-${it.id}`}
                            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'start', padding: '10px 14px', border: 0,
                              borderBottom: '1px solid var(--ad-border)', background: selected === it.id ? 'var(--ad-accent-soft)' : 'transparent', cursor: 'pointer', color: 'var(--ad-text)' }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: 'block', fontSize: 13 }}>{it.label}</strong>
                              {it.sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--ad-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span>}
                            </span>
                            {stale.has(`${type}|${it.id}`) && <StatusPill tone="warning" dot={false}>Tərcümə köhnə ola bilər</StatusPill>}
                            {st !== 'bundled' && <StatusPill tone={STATUS_PILL[st].tone}>{STATUS_PILL[st].label}</StatusPill>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
        </Section>
        <div ref={editorRef}>
          {selected && bundled.data ? (
            <Editor key={`${language}|${type}|${selected}`} language={language} type={type} id={selected} content={bundled.data}
              row={byKey.get(`${type}|${selected}`)} canSave={rows.data !== null && !rows.isError} onSaved={refresh}
              stale={stale.has(`${type}|${selected}`)} />
          ) : (
            <Section><EmptyState title="Element seç" description="Soldan bir məqalə, SOS kartı, proqram günü və s. seç — orijinal mətn və redaktə forması burada açılacaq." compact /></Section>
          )}
        </div>
      </div>
      {rows.isError && <ErrorState onRetry={() => rows.refetch()} compact />}
    </Page>
  );
}

function Editor({ language, type, id, content, row, canSave, onSaved, stale }: {
  language: string; type: ParentingItemType; id: string; content: ParentingContent; row: OverrideAdminRow | undefined;
  canSave: boolean; onSaved: () => Promise<void>; stale?: boolean;
}) {
  const [panel, setPanel] = useState<'none' | 'preview' | 'history'>('none');
  const confirm = useAdminConfirm();
  const original = findParentingItem(content, type, id);
  // What the editor shows for "bundled": the item plus optional fields it may add.
  const base = useMemo(() => (original ? { ...original, ...Object.fromEntries(Object.entries(OPTIONAL_BY_TYPE[type] ?? {}).filter(([k]) => !(k in original))) } as Record<string, unknown> : null), [original, type]);
  const [value, setValue] = useState<Record<string, unknown> | null>(() =>
    (base ? patchItem(base, row?.draft ?? row?.patch ?? {}) as Record<string, unknown> : null));
  const [busy, setBusy] = useState<string | null>(null);
  if (!original || !base || !value) return <Section><ErrorState message="Element tapılmadı." compact /></Section>;

  const patch = diffPatch(base, value);
  const changed = Object.keys(patch);
  const live = row?.published ? patch && JSON.stringify(row.patch) === JSON.stringify(patch) : false;
  const problems = overrideProblems(base, value);
  const st = statusOf(row);

  const call = async (action: 'draft' | 'publish' | 'unpublish' | 'revert') => {
    if (action === 'revert' && !(await confirm({
      title: 'Orijinal mətnə qaytarılsın?', description: 'Bu element üçün dərc olunmuş dəyişiklik və qaralama silinəcək; istifadəçilər tətbiqdəki orijinal mətni görəcək.',
      confirmLabel: 'Orijinala qaytar', danger: true,
    }))) return;
    if (action === 'publish' && !(await confirm({
      title: 'Dərc edilsin?', description: `${changed.length} sahə dəyişib. İstifadəçilər yeni mətni növbəti açılışda görəcək (keş ən çox 10 dəqiqə).`, confirmLabel: 'Dərc et',
    }))) return;
    setBusy(action);
    try {
      const { error } = action === 'revert'
        ? await rpc('admin_parenting_override_revert_v1', { p_language: language, p_item_type: type, p_item_id: id })
        : await rpc('admin_parenting_override_save_v1', { p_language: language, p_item_type: type, p_item_id: id, p_patch: action === 'unpublish' ? null : patch, p_action: action });
      if (error) throw new Error(error.message || 'error');
      if (action === 'revert') setValue(base);
      toast.success({ draft: 'Qaralama saxlanıldı', publish: 'Dərc olundu', unpublish: 'Dərcdən çıxarıldı', revert: 'Orijinal mətnə qaytarıldı' }[action]);
      await onSaved();
    } catch (e) {
      toast.error(`Alınmadı: ${e instanceof Error ? e.message : 'xəta'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      testId="admin-parenting-editor"
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{TYPE_LABELS[type]} · <code>{id}</code><StatusPill tone={STATUS_PILL[st].tone}>{STATUS_PILL[st].label}</StatusPill></span>}
      description={row ? `Son dəyişiklik: ${fmtDateTime(row.updated_at)}${row.published_at ? ` · dərc: ${fmtDateTime(row.published_at)}` : ''}` : 'Tətbiqdəki orijinal mətn göstərilir'}
      actions={changed.length ? <StatusPill tone="info" dot={false}>{`${changed.length} sahə dəyişib`}</StatusPill> : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stale && <Notice tone="warning">Azərbaycan dilindəki mətn bu dildəki mətndən sonra dərc olunub: tərcüməni yoxla.</Notice>}
        {problems.map((p) => <Notice key={p} tone="warning">{p}</Notice>)}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" variant={panel === 'preview' ? 'primary' : undefined} aria-pressed={panel === 'preview'} onClick={() => setPanel(panel === 'preview' ? 'none' : 'preview')}>
            <Eye size={13} /> Önizləmə
          </Btn>
          <Btn size="sm" variant={panel === 'history' ? 'primary' : undefined} aria-pressed={panel === 'history'} onClick={() => setPanel(panel === 'history' ? 'none' : 'history')}>
            <History size={13} /> Tarixçə
          </Btn>
        </div>
        {panel === 'preview' && (
          <div style={{ border: '1px dashed var(--ad-border)', borderRadius: 12, padding: 12, background: 'var(--a-bg, transparent)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--ad-text-3)' }}>Formdakı mətn tətbiqdə belə görünəcək (Premium istifadəçi kimi).</p>
            <Suspense fallback={<SkeletonRows rows={3} columns={1} />}>
              <ParentingPreview content={content} type={type} id={id} patch={patch} />
            </Suspense>
          </div>
        )}
        {panel === 'history' && (
          <HistoryPanel language={language} type={type} id={id} canSave={canSave}
            onLoad={(p) => { setValue(patchItem(base, p) as Record<string, unknown>); setPanel('none'); }} onRestored={onSaved} />
        )}
        <ObjectFields base={base} value={value} onChange={(v) => setValue(v)} path={id} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--ad-surface)', padding: '10px 0 2px', borderTop: '1px solid var(--ad-border)' }}>
          <Btn variant="primary" disabled={!canSave || !!busy || !changed.length || !!problems.length || live} onClick={() => call('publish')}>
            {busy === 'publish' ? 'Dərc olunur…' : 'Dərc et'}
          </Btn>
          <Btn disabled={!canSave || !!busy || !!problems.length} onClick={() => call('draft')}>{busy === 'draft' ? 'Saxlanılır…' : 'Qaralamanı saxla'}</Btn>
          {row?.published && <Btn disabled={!canSave || !!busy} onClick={() => call('unpublish')}><Undo2 size={14} /> Dərcdən çıxar</Btn>}
          {row && <Btn variant="danger" disabled={!canSave || !!busy} onClick={() => call('revert')}><RotateCcw size={14} /> Orijinala qaytar</Btn>}
          {changed.length > 0 && <Btn variant="ghost" disabled={!!busy} onClick={() => setValue(base)}>Formu orijinala qaytar</Btn>}
        </div>
      </div>
    </Section>
  );
}

/** An item's saved versions with "load into form" and restore (as draft or published) via the history RPCs. */
function HistoryPanel({ language, type, id, canSave, onLoad, onRestored }: {
  language: string; type: ParentingItemType; id: string; canSave: boolean;
  onLoad: (patch: Record<string, unknown>) => void; onRestored: () => Promise<void>;
}) {
  const confirm = useAdminConfirm();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ['admin-parenting-history', language, type, id],
    queryFn: async () => {
      const res = await optionalRpc<OverrideHistoryRow[]>('admin_parenting_override_history_v1', { p_language: language, p_item_type: type, p_item_id: id, p_limit: 50 });
      return res === RPC_MISSING ? null : Array.isArray(res) ? res : [];
    },
  });

  const restore = async (h: OverrideHistoryRow, action: 'draft' | 'publish') => {
    if (!(await confirm({
      title: action === 'publish' ? 'Bu versiya dərc edilsin?' : 'Bu versiya qaralama kimi bərpa edilsin?',
      description: action === 'publish' ? 'İstifadəçilər bu mətni növbəti açılışda görəcək (keş ən çox 10 dəqiqə).' : 'Dərc olunmuş mətn dəyişmir; versiya qaralamaya yazılır.',
      confirmLabel: action === 'publish' ? 'Dərc et' : 'Bərpa et',
    }))) return;
    setBusy(`${h.id}|${action}`);
    try {
      const { error } = await rpc('admin_parenting_override_restore_v1', { p_history_id: h.id, p_action: action });
      if (error) throw new Error(error.message || 'error');
      toast.success(action === 'publish' ? 'Versiya dərc olundu' : 'Versiya qaralama kimi bərpa olundu');
      await onRestored();
      await qc.invalidateQueries({ queryKey: ['admin-parenting-history', language, type, id] });
    } catch (e) {
      toast.error(`Alınmadı: ${e instanceof Error ? e.message : 'xəta'}`);
    } finally {
      setBusy(null);
    }
  };

  if (history.isLoading) return <SkeletonRows rows={3} columns={1} />;
  if (history.isError) return <ErrorState onRetry={() => history.refetch()} compact />;
  if (history.data === null) {
    return <Notice tone="info">Versiya tarixçəsi hələ serverdə yoxdur (miqrasiya 20261108160000_parenting_cms_history tətbiq olunmayıb).</Notice>;
  }
  if (!history.data?.length) return <EmptyState title="Hələ versiya yoxdur" description="Qaralama saxlayanda və ya dərc edəndə burada görünəcək." compact />;
  return (
    <ol data-testid="admin-parenting-history" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.data.map((h) => {
        const fields = Object.keys(versionPatch(h));
        return (
          <li key={h.id} style={{ border: '1px solid var(--ad-border)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
              <strong>{ACTION_LABELS[h.action] ?? h.action}</strong>
              {h.published && <StatusPill tone="success" dot={false}>dərc olunmuşdu</StatusPill>}
              <span style={{ color: 'var(--ad-text-3)' }}>{fmtDateTime(h.created_at)}</span>
              <span style={{ color: 'var(--ad-text-3)' }}>{fields.length ? fields.map(label).join(', ') : 'orijinal mətn'}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={() => onLoad(versionPatch(h))}>Formaya yüklə</Btn>
              <Btn size="sm" disabled={!canSave || !!busy} onClick={() => restore(h, 'draft')}>{busy === `${h.id}|draft` ? 'Bərpa olunur…' : 'Qaralama kimi bərpa et'}</Btn>
              <Btn size="sm" disabled={!canSave || !!busy} onClick={() => restore(h, 'publish')}>{busy === `${h.id}|publish` ? 'Dərc olunur…' : 'Bu versiyanı dərc et'}</Btn>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const label = (key: string) => FIELD_LABELS[key] ?? key;

function ObjectFields({ base, value, onChange, path }: { base: Record<string, unknown>; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; path: string }) {
  return (
    <>
      {Object.keys(base).filter((k) => !LOCKED_KEYS.has(k) && typeof base[k] !== 'number' && typeof base[k] !== 'boolean').map((k) => (
        <ValueField key={k} name={k} base={base[k]} value={value[k] ?? base[k]} path={`${path}.${k}`}
          onChange={(v) => onChange({ ...value, [k]: v })} />
      ))}
    </>
  );
}

function Original({ text }: { text: string }) {
  return <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ad-text-3)', whiteSpace: 'pre-wrap' }}><b>Orijinal:</b> {text || '—'}</span>;
}

function ValueField({ name, base, value, onChange, path }: { name: string; base: unknown; value: unknown; onChange: (v: unknown) => void; path: string }): ReactNode {
  const changed = JSON.stringify(base) !== JSON.stringify(value);
  const revert = changed ? <button type="button" className="ak-link" onClick={() => onChange(base)} style={{ fontSize: 11.5, background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ad-accent)' }}>Bu sahəni qaytar</button> : null;

  if (typeof base === 'string') {
    const text = typeof value === 'string' ? value : '';
    const long = base.length > 70 || text.length > 70 || name === 'text' || name === 'task';
    return (
      <Field label={<>{label(name)} {changed && <StatusPill tone="info" dot={false}>dəyişib</StatusPill>}</>} hint={changed ? <><Original text={base} />{revert}</> : undefined}>
        {(fid) => long
          ? <textarea id={fid} className="ak-textarea" rows={Math.min(8, Math.max(2, Math.ceil(text.length / 70)))} value={text} onChange={(e) => onChange(e.target.value)} data-path={path} />
          : <input id={fid} className="ak-input" style={{ width: '100%' }} value={text} onChange={(e) => onChange(e.target.value)} data-path={path} />}
      </Field>
    );
  }
  if (Array.isArray(base) && (base.length === 0 || typeof base[0] === 'string')) {
    const list = Array.isArray(value) ? (value as string[]) : [];
    return (
      <Field label={<>{label(name)} {changed && <StatusPill tone="info" dot={false}>dəyişib</StatusPill>}</>}
        hint={<>{'Hər sətir ayrıca bənd.'}{changed && <Original text={(base as string[]).join('\n')} />}{revert}</>}>
        {(fid) => (
          <textarea id={fid} className="ak-textarea" rows={Math.min(14, Math.max(3, list.length + 1))} value={list.join('\n')} data-path={path}
            onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.replace(/\s+$/, '')).filter((s, i, all) => s.trim() || i < all.length - 1))} />
        )}
      </Field>
    );
  }
  if (Array.isArray(base)) {
    const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const resizable = name === 'sources';
    return (
      <fieldset className="ak-form-section">
        <legend>{label(name)} {changed && <StatusPill tone="info" dot={false}>dəyişib</StatusPill>}</legend>
        <div className="ak-form-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((item, i) => {
            const b = (base[i] ?? base[0]) as Record<string, unknown>;
            return (
              <div key={i} style={{ borderInlineStart: '3px solid var(--ad-border)', paddingInlineStart: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ad-text-3)', display: 'flex', justifyContent: 'space-between' }}>
                  #{i + 1}
                  {resizable && list.length > 1 && <button type="button" aria-label="Sil" onClick={() => onChange(list.filter((_, j) => j !== i))} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ad-text-3)' }}><Trash2 size={13} /></button>}
                </span>
                <ObjectFields base={b} value={isObj(item) ? item : b} path={`${path}.${i}`} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} />
              </div>
            );
          })}
          {resizable && <Btn size="sm" onClick={() => onChange([...list, { who: '', year: '', title: '' }])}><Plus size={13} /> Mənbə əlavə et</Btn>}
          {revert}
        </div>
      </fieldset>
    );
  }
  if (isObj(base)) {
    return (
      <fieldset className="ak-form-section">
        <legend>{label(name)} {changed && <StatusPill tone="info" dot={false}>dəyişib</StatusPill>}</legend>
        <div className="ak-form-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ObjectFields base={base} value={isObj(value) ? value : base} path={path} onChange={onChange} />
          {revert}
        </div>
      </fieldset>
    );
  }
  return null;
}
