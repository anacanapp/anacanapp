import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, Pencil, Plus, Save, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

// Tables and RPCs added after the generated types; a loose client keeps this file free of casts to any.
const db = supabase as unknown as SupabaseClient;

type Mode = 'force' | 'soft' | 'banner';
type Platform = 'ios' | 'android' | 'both';
interface RuleText { title?: string; body?: string; whats_new?: string[]; button?: string; later?: string }
export interface UpdateRule {
  id?: string; name: string; mode: Mode; platform: Platform; below_version: string; min_version: string | null;
  languages: string[] | null; countries: string[] | null; audience: 'test' | 'all' | 'percent'; percent: number;
  frequency: 'every_launch' | 'daily' | 'once'; texts: Record<string, RuleText>; ios_url: string | null; android_url: string | null;
  starts_at: string | null; ends_at: string | null; priority: number; enabled: boolean; updated_at?: string;
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'force', label: 'Məcburi', hint: 'Tam ekran, bağlamaq olmur' },
  { id: 'soft', label: 'Könüllü', hint: 'Pəncərə, "Sonra" var' },
  { id: 'banner', label: 'Banner', hint: 'Ana səhifədə zolaq' },
];
const MODE_PILL: Record<Mode, string> = { force: 'bg-red-100 text-red-700', soft: 'bg-amber-100 text-amber-800', banner: 'bg-blue-100 text-blue-700' };
const PLATFORM_LABEL: Record<Platform, string> = { both: 'iOS + Android', ios: 'iOS', android: 'Android' };
const VERSION_RE = /^\d+(\.\d+){0,3}$/;

const emptyRule = (storeVersion?: string | null): UpdateRule => ({
  name: '', mode: 'soft', platform: 'both', below_version: storeVersion || '', min_version: null, languages: null, countries: null,
  audience: 'test', percent: 100, frequency: 'daily', texts: {}, ios_url: null, android_url: null, starts_at: null, ends_at: null,
  priority: 0, enabled: false,
});

function parseObject(value: unknown): Record<string, unknown> {
  let v = value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

/** Problems that block saving a rule (shown inline). Exported for tests. */
export function ruleProblems(rule: UpdateRule): string[] {
  const out: string[] = [];
  if (!rule.name.trim()) out.push('Qaydaya ad verin.');
  if (!VERSION_RE.test(rule.below_version.trim())) out.push('"Bu versiyadan aşağı" sahəsinə versiya yazın, məs. 50.0.');
  if (rule.min_version && !VERSION_RE.test(rule.min_version.trim())) out.push('"Bu versiyadan başlayaraq" sahəsi versiya olmalıdır.');
  if (rule.languages && rule.languages.length === 0) out.push('Ən azı bir dil seçin və ya "Bütün dillər".');
  const anyText = Object.values(rule.texts).some((t) => t.title?.trim() || t.body?.trim());
  if (!anyText) out.push('Ən azı bir dildə başlıq və ya mətn yazın (English tövsiyə olunur: mətni olmayan dillərə o gedir).');
  if (rule.audience === 'percent' && (rule.percent < 1 || rule.percent > 100)) out.push('Faiz 1 ilə 100 arasında olmalıdır.');
  return out;
}

export default function AdminAppUpdates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UpdateRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const store = useQuery({
    queryKey: ['admin-store-versions'],
    queryFn: async () => {
      const { data } = await db.from('app_settings').select('value').eq('key', 'store_versions').maybeSingle();
      const v = parseObject(data?.value);
      return { ios: (v.ios as string | null) ?? '', android: (v.android as string | null) ?? '' };
    },
  });
  const [storeForm, setStoreForm] = useState<{ ios: string; android: string } | null>(null);
  const storeValues = storeForm ?? store.data ?? { ios: '', android: '' };

  const versions = useQuery({
    queryKey: ['admin-app-versions'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_app_versions_v1', { p_days: 30 });
      if (error) throw error;
      return (data || []) as { platform: string; version: string; users: number }[];
    },
  });
  const rules = useQuery({
    queryKey: ['admin-app-update-rules'],
    queryFn: async () => {
      const { data, error } = await db.from('app_update_rules').select('*').order('enabled', { ascending: false }).order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UpdateRule[];
    },
  });

  const saveStore = useMutation({
    mutationFn: async (v: { ios: string; android: string }) => {
      for (const x of [v.ios, v.android]) if (x && !VERSION_RE.test(x.trim())) throw new Error('version');
      const value = { ios: v.ios.trim() || null, android: v.android.trim() || null };
      const { error } = await db.from('app_settings').upsert({ key: 'store_versions', value, description: 'Version each store currently serves' }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { setStoreForm(null); qc.invalidateQueries({ queryKey: ['admin-store-versions'] }); toast.success('Store versiyaları saxlanıldı'); },
    onError: (e) => toast.error(e instanceof Error && e.message === 'version' ? 'Versiyanı 50.0 formatında yazın' : 'Saxlanmadı'),
  });

  const saveRule = useMutation({
    mutationFn: async (rule: UpdateRule) => {
      const { data: auth } = await db.auth.getUser();
      const { id, updated_at: _u, ...rest } = rule;
      const row = { ...rest, name: rest.name.trim(), below_version: rest.below_version.trim(), min_version: rest.min_version?.trim() || null,
        updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null };
      const { error } = id ? await db.from('app_update_rules').update(row).eq('id', id) : await db.from('app_update_rules').insert(row);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin-app-update-rules'] }); toast.success('Qayda saxlanıldı'); },
    onError: () => toast.error('Qayda saxlanmadı'),
  });
  const toggleRule = useMutation({
    mutationFn: async (r: UpdateRule) => {
      const { error } = await db.from('app_update_rules').update({ enabled: !r.enabled, updated_at: new Date().toISOString() }).eq('id', r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-app-update-rules'] }),
  });
  const deleteRule = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from('app_update_rules').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { setConfirmDelete(null); qc.invalidateQueries({ queryKey: ['admin-app-update-rules'] }); toast.success('Qayda silindi'); },
  });

  const byPlatform = useMemo(() => {
    const groups: Record<string, { version: string; users: number }[]> = {};
    for (const row of versions.data || []) (groups[row.platform] ||= []).push({ version: row.version, users: row.users });
    return groups;
  }, [versions.data]);

  if (editing) return <RuleEditor rule={editing} storeVersions={storeValues} saving={saveRule.isPending}
    onCancel={() => setEditing(null)} onSave={(r) => saveRule.mutate(r)} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><ArrowUpCircle className="w-6 h-6 text-primary" />Yeniləmə mərkəzi</h2>
        <p className="text-muted-foreground text-sm mt-1">Tətbiqi yeniləmə xatırlatmaları: məcburi, könüllü və banner. Dilə, platformaya və versiyaya görə.</p>
      </div>

      <section className="rounded-2xl border p-4 space-y-3">
        <h3 className="font-semibold">Store-larda son versiya</h3>
        <p className="text-sm text-muted-foreground">Qayda yalnız store artıq həmin versiyanı verəndə göstərilir. Boş qalan platformaya heç bir qayda göstərilmir.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1"><span className="font-medium">App Store (iOS)</span>
            <Input value={storeValues.ios} placeholder="50.0" onChange={(e) => setStoreForm({ ...storeValues, ios: e.target.value })} /></label>
          <label className="text-sm space-y-1"><span className="font-medium">Google Play (Android)</span>
            <Input value={storeValues.android} placeholder="məs. 50.0" onChange={(e) => setStoreForm({ ...storeValues, android: e.target.value })} /></label>
        </div>
        {storeForm && <Button size="sm" onClick={() => saveStore.mutate(storeValues)} disabled={saveStore.isPending}><Save className="w-4 h-4 me-1" />Saxla</Button>}
      </section>

      <section className="rounded-2xl border p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Versiyalar üzrə istifadəçilər (son 30 gün)</h3>
        {versions.isLoading ? <p className="text-sm text-muted-foreground">Yüklənir...</p> :
          Object.keys(byPlatform).length === 0 ? <p className="text-sm text-muted-foreground">Hələ məlumat yoxdur. App açıldıqca toplanır.</p> :
          Object.entries(byPlatform).map(([platform, rows]) => {
            const total = rows.reduce((a, r) => a + r.users, 0);
            return (
              <div key={platform} className="space-y-1.5">
                <p className="text-sm font-medium">{platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : platform} · {total} nəfər</p>
                {rows.map((r) => (
                  <div key={r.version} className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-sm tabular-nums">
                    <span className="truncate">{r.version}</span>
                    <span className="h-2.5 rounded bg-muted overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${Math.max(2, (r.users / total) * 100)}%` }} /></span>
                    <span className="text-right">{r.users} · {Math.round((r.users / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            );
          })}
        <p className="text-xs text-muted-foreground">iOS versiyası telefonun göndərdiyi məlumatdan oxunur. Android-də versiya yalnız yeni build-lərdən gəlir, köhnələr "başlıqsız" görünür.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Qaydalar</h3>
          <Button size="sm" onClick={() => setEditing(emptyRule(storeValues.ios || storeValues.android))}><Plus className="w-4 h-4 me-1" />Yeni qayda</Button>
        </div>
        {rules.isLoading ? <p className="text-sm text-muted-foreground">Yüklənir...</p> :
          (rules.data || []).length === 0 ? <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-4">Hələ qayda yoxdur. "Yeni qayda" ilə başlayın; əvvəlcə "Yalnız test istifadəçiləri" ilə yoxlayın.</p> :
          (rules.data || []).map((r) => (
            <div key={r.id} className="rounded-2xl border p-3 flex items-start gap-3">
              <Switch checked={r.enabled} onCheckedChange={() => toggleRule.mutate(r)} aria-label={`${r.name} aktiv`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium flex flex-wrap items-center gap-2">{r.name}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODE_PILL[r.mode]}`}>{MODES.find((m) => m.id === r.mode)?.label}</span>
                  {r.audience !== 'all' && <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{r.audience === 'test' ? 'test' : `${r.percent}%`}</span>}
                </p>
                <p className="text-sm text-muted-foreground">{PLATFORM_LABEL[r.platform]} · {r.below_version}-dən aşağı{r.min_version ? `, ${r.min_version}-dən başlayaraq` : ''} · {r.languages ? r.languages.join(', ') : 'bütün dillər'} · mətn: {Object.keys(r.texts || {}).join(', ') || 'yoxdur'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing({ ...emptyRule(), ...r })} aria-label="Redaktə et"><Pencil className="w-4 h-4" /></Button>
              {confirmDelete === r.id ?
                <Button size="sm" variant="destructive" onClick={() => r.id && deleteRule.mutate(r.id)}>Silinsin</Button> :
                <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r.id || null)} aria-label="Sil"><Trash2 className="w-4 h-4" /></Button>}
            </div>
          ))}
      </section>
    </div>
  );
}

function RuleEditor({ rule: initial, storeVersions, saving, onCancel, onSave }: {
  rule: UpdateRule; storeVersions: { ios: string; android: string }; saving: boolean; onCancel: () => void; onSave: (r: UpdateRule) => void;
}) {
  const [rule, setRule] = useState<UpdateRule>(initial);
  const [lang, setLang] = useState('az');
  const [forceConfirmed, setForceConfirmed] = useState(false);
  const [reach, setReach] = useState<{ matching: number; unknown_version: number; seen: number } | null>(null);
  const set = (patch: Partial<UpdateRule>) => setRule((r) => ({ ...r, ...patch }));
  const text = rule.texts[lang] || {};
  const setText = (patch: Partial<RuleText>) => set({ texts: { ...rule.texts, [lang]: { ...text, ...patch } } });
  const problems = ruleProblems(rule);

  // Reach preview from recently seen clients.
  useEffect(() => {
    if (!VERSION_RE.test(rule.below_version.trim())) { setReach(null); return; }
    const t = setTimeout(async () => {
      const { data } = await db.rpc('admin_app_update_audience_v1', { p_platform: rule.platform, p_below: rule.below_version.trim(),
        p_min: rule.min_version?.trim() || null, p_languages: rule.languages });
      setReach(data || null);
    }, 400);
    return () => clearTimeout(t);
  }, [rule.platform, rule.below_version, rule.min_version, rule.languages]);

  const storeBlock = (['ios', 'android'] as const).filter((p) => rule.platform === 'both' || rule.platform === p)
    .filter((p) => { const sv = storeVersions[p]; return !sv || compareVersions(sv, rule.below_version) < 0; });
  const needsForceConfirm = rule.mode === 'force' && rule.enabled && rule.audience !== 'test';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{rule.id ? 'Qaydanı redaktə et' : 'Yeni qayda'}</h2>
        <Button variant="ghost" onClick={onCancel}>Ləğv et</Button>
      </div>

      <label className="block text-sm space-y-1"><span className="font-medium">Ad (yalnız admin görür)</span>
        <Input value={rule.name} onChange={(e) => set({ name: e.target.value })} placeholder="məs. 51 hazırdır (iOS)" /></label>

      <div className="space-y-1.5"><span className="text-sm font-medium">Növ</span>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => <button key={m.id} type="button" onClick={() => set({ mode: m.id })} aria-pressed={rule.mode === m.id}
            className={`rounded-xl border p-2.5 text-start text-sm ${rule.mode === m.id ? 'border-primary bg-primary/5' : ''}`}>
            <b className="block">{m.label}</b><span className="text-muted-foreground text-xs">{m.hint}</span></button>)}
        </div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5"><span className="text-sm font-medium">Platforma</span>
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(['both', 'ios', 'android'] as Platform[]).map((p) => <button key={p} type="button" aria-pressed={rule.platform === p} onClick={() => set({ platform: p })}
              className={`flex-1 rounded-lg py-1.5 text-sm ${rule.platform === p ? 'bg-background shadow font-semibold' : ''}`}>{PLATFORM_LABEL[p]}</button>)}
          </div></div>
        <label className="text-sm space-y-1"><span className="font-medium">Bu versiyadan aşağı olanlara</span>
          <Input value={rule.below_version} onChange={(e) => set({ below_version: e.target.value })} placeholder="50.0" /></label>
        <label className="text-sm space-y-1"><span className="font-medium">Bu versiyadan başlayaraq (istəyə görə)</span>
          <Input value={rule.min_version || ''} onChange={(e) => set({ min_version: e.target.value || null })} placeholder="boş = hamısı" /></label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm space-y-1"><span className="font-medium">Kimə</span>
          <select className="w-full h-10 rounded-md border bg-background px-2" value={rule.audience} onChange={(e) => set({ audience: e.target.value as UpdateRule['audience'] })}>
            <option value="test">Yalnız test istifadəçiləri (adminlər)</option><option value="percent">İstifadəçilərin bir hissəsi</option><option value="all">Hamıya</option>
          </select></label>
        {rule.audience === 'percent' && <label className="text-sm space-y-1"><span className="font-medium">Faiz</span>
          <Input type="number" min={1} max={100} value={rule.percent} onChange={(e) => set({ percent: Number(e.target.value) })} /></label>}
        {rule.mode === 'soft' && <label className="text-sm space-y-1"><span className="font-medium">Nə qədər tez-tez</span>
          <select className="w-full h-10 rounded-md border bg-background px-2" value={rule.frequency} onChange={(e) => set({ frequency: e.target.value as UpdateRule['frequency'] })}>
            <option value="daily">Gündə 1 dəfə</option><option value="every_launch">Hər açılışda</option><option value="once">Bir dəfə</option>
          </select></label>}
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Dillər</span>
        <label className="flex items-center gap-2 text-sm"><Switch checked={rule.languages === null} onCheckedChange={(v) => set({ languages: v ? null : ['az'] })} />Bütün dillər</label>
        {rule.languages !== null && <div className="flex flex-wrap gap-1.5">
          {APP_LANGUAGES.map((l) => { const on = rule.languages?.includes(l.code); return (
            <button key={l.code} type="button" aria-pressed={!!on} onClick={() => set({ languages: on ? rule.languages!.filter((x) => x !== l.code) : [...(rule.languages || []), l.code] })}
              className={`text-xs rounded-lg px-2 py-1 border ${on ? 'bg-primary text-primary-foreground border-primary' : ''}`}>{l.code}</button>); })}
        </div>}
      </div>

      <div className="rounded-2xl border p-3 space-y-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Mətn dili">
          {APP_LANGUAGES.map((l) => { const has = !!(rule.texts[l.code]?.title || rule.texts[l.code]?.body); return (
            <button key={l.code} type="button" role="tab" aria-selected={lang === l.code} onClick={() => setLang(l.code)}
              className={`text-xs rounded-lg px-2 py-1 ${lang === l.code ? 'bg-primary text-primary-foreground' : has ? 'bg-muted font-semibold' : 'border border-dashed text-muted-foreground'}`}>
              {l.code}{has ? ' ✓' : ''}</button>); })}
        </div>
        <p className="text-xs text-muted-foreground">Mətn yazılmayan dildə English, o da yoxdursa Azərbaycan mətni göstərilir. Düymə yazıları boş qalsa, hər dil üçün hazır yazı istifadə olunur.</p>
        <label className="block text-sm space-y-1"><span className="font-medium">Başlıq ({lang})</span>
          <Input dir="auto" value={text.title || ''} onChange={(e) => setText({ title: e.target.value })} /></label>
        <label className="block text-sm space-y-1"><span className="font-medium">Mətn ({lang})</span>
          <Textarea dir="auto" rows={2} value={text.body || ''} onChange={(e) => setText({ body: e.target.value })} /></label>
        {rule.mode !== 'banner' && <label className="block text-sm space-y-1"><span className="font-medium">Nə yenidir ({lang}), hər sətir bir bənd</span>
          <Textarea dir="auto" rows={3} value={(text.whats_new || []).join('\n')} onChange={(e) => setText({ whats_new: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6) })} /></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm space-y-1"><span className="font-medium">Düymə ({lang})</span><Input dir="auto" value={text.button || ''} placeholder="avtomatik" onChange={(e) => setText({ button: e.target.value })} /></label>
          {rule.mode === 'soft' && <label className="text-sm space-y-1"><span className="font-medium">"Sonra" ({lang})</span><Input dir="auto" value={text.later || ''} placeholder="avtomatik" onChange={(e) => setText({ later: e.target.value })} /></label>}
        </div>
      </div>

      <div className="rounded-2xl bg-muted/60 p-3 text-sm space-y-1">
        {reach ? <p><b>{reach.matching}</b> nəfər bu qaydaya uyğun gəlir (son 30 gündə görünənlərdən, dil filtri daxil). {reach.unknown_version > 0 && <>Versiyası bilinməyən: {reach.unknown_version}.</>}</p>
          : <p>Təsir sayı versiya yazılanda görünəcək.</p>}
        {storeBlock.length > 0 && <p className="text-amber-700">Diqqət: {storeBlock.map((p) => p === 'ios' ? 'App Store' : 'Google Play').join(' və ')} hələ {rule.below_version || '...'} versiyasını vermir, bu platformada qayda göstərilməyəcək.</p>}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={rule.enabled} onCheckedChange={(v) => { set({ enabled: v }); setForceConfirmed(false); }} />Aktiv</label>
      {needsForceConfirm && <label className="flex items-start gap-2 rounded-xl bg-red-50 text-red-800 p-3 text-sm">
        <input type="checkbox" className="mt-1" checked={forceConfirmed} onChange={(e) => setForceConfirmed(e.target.checked)} />
        <span>Bu məcburi qaydadır: uyğun gələn istifadəçilər tətbiqi yeniləmədən istifadə edə bilməyəcək{reach ? ` (${reach.matching} nəfər)` : ''}. Təsdiq edirəm.</span></label>}

      {problems.length > 0 && <ul className="text-sm text-red-700 list-disc ps-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="flex gap-2">
        <Button onClick={() => onSave(rule)} disabled={saving || problems.length > 0 || (needsForceConfirm && !forceConfirmed)}><Save className="w-4 h-4 me-1" />Yadda saxla</Button>
        <Button variant="outline" onClick={onCancel}>Ləğv et</Button>
      </div>
    </div>
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return Math.sign(d); }
  return 0;
}
