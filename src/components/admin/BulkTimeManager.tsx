import { useEffect, useMemo, useState } from 'react';
import { tr } from '@/lib/tr';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Clock, ArrowRight, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type SourceKey = 'pregnancy_day_notifications' | 'mommy_day_notifications' | 'flow_reminders';

const SOURCES: {key: SourceKey;label: string;timeCol: string;labelCol: string;}[] = [
{ key: 'pregnancy_day_notifications', label: tr("bulktimemanager_hamilelik_bump_b450c6", "Hamiləlik (bump)"), timeCol: 'send_time', labelCol: 'title' },
{ key: 'mommy_day_notifications', label: 'Ana (mommy)', timeCol: 'send_time', labelCol: 'title' },
{ key: 'flow_reminders', label: 'Tsikl (flow)', timeCol: 'send_time', labelCol: 'title' }];

// DÜZƏLİŞ: pregnancy_day_notifications/mommy_day_notifications üçün
// supabase/functions/send-daily-notifications/index.ts (DAILY_RUN_SLOTS) YALNIZ
// bu 9 dəqiq saatı qəbul edir (tam bərabərlik, tolerans YOXDUR). Əvvəllər bu
// input sərbəst <Input type="time"/> idi — admin istənilən HH:MM yaza bilirdi
// (məs. "11:00", "16:00") və həmin sətir cron tərəfindən BİR DƏ HEÇ VAXT
// görünmürdü (sükutla, xəta vermədən). Bu siyahı DAILY_RUN_SLOTS ilə sinxron
// saxlanmalıdır — orada dəyişiklik olsa, burada da eyni siyahı yenilənməlidir.
const VALID_DAY_SLOT_TIMES = [
'09:00', '10:00', '12:00', '14:00', '14:30', '15:00', '15:30', '19:00', '19:30'];


/** Normalize "9:00" / "09:00:00" → "09:00" */
function normTime(v: string | null | undefined): string {
  if (!v) return '';
  const [h = '00', m = '00'] = v.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

type Row = {id: string;send_time: string;title?: string;day_number?: number | null;};

const BulkTimeManager = () => {
  const [source, setSource] = useState<SourceKey>('pregnancy_day_notifications');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [newTime, setNewTime] = useState<string>('12:00');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const cfg = SOURCES.find((s) => s.key === source)!;

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.
      from(source as any).
      select('*').
      limit(5000);
      if (error) throw error;
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        send_time: normTime(r[cfg.timeCol]),
        title: r[cfg.labelCol] ?? '—',
        day_number: r.day_number ?? null
      }));
      setRows(mapped);
    } catch (e: any) {
      toast.error(tr("bulktimemanager_yukleme_xetasi_7738cd", "Y\xFCkl\u0259m\u0259 x\u0259tas\u0131: ") + (e?.message ?? tr("bulktimemanager_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {load(); /* eslint-disable-next-line */}, [source]);

  const uniqueTimes = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.send_time || '—', (counts.get(r.send_time || '—') ?? 0) + 1));
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    if (timeFilter === 'all') return rows;
    return rows.filter((r) => (r.send_time || '—') === timeFilter);
  }, [rows, timeFilter]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((r) => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const applyBulk = async () => {
    if (selected.size === 0) {
      toast.error(tr("bulktimemanager_hec_bir_setir_secilmeyib_db256d", "He\xE7 bir s\u0259tir se\xE7ilm\u0259yib"));
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newTime)) {
      toast.error(tr("bulktimemanager_yeni_saat_formati_yanlisdir_hh_b2aa81", "Yeni saat format\u0131 yanl\u0131\u015Fd\u0131r (HH:MM)"));
      return;
    }
    if (!confirm(`${selected.size} sətrin saatı "${newTime}" olaraq dəyişdiriləcək. Davam edək?`)) return;
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const chunk = 500;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { error } = await supabase.
        from(source as any).
        update({ [cfg.timeCol]: newTime } as any).
        in('id', slice);
        if (error) throw error;
      }
      toast.success(`${ids.length} bildirişin saatı ${newTime} oldu`);
      await load();
    } catch (e: any) {
      toast.error(tr("bulktimemanager_yenileme_xetasi_c88be0", "Yenil\u0259m\u0259 x\u0259tas\u0131: ") + (e?.message ?? tr("bulktimemanager_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{tr("bulktimemanager_toplu_saat_deyisdirici_9723b3", "Toplu saat dəyişdirici")}</h3>
            <p className="text-xs text-muted-foreground">
              {tr("bulktimemanager_menbe_secin_movcud_saata_gore__e6c167", "M\u0259nb\u0259 se\xE7in \u2192 m\xF6vcud saata g\xF6r\u0259 filterl\u0259yin \u2192 yeni saat\u0131 t\u0259yin edib se\xE7il\u0259nl\u0259ri toplu yenil\u0259yin.")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">{tr("bulktimemanager_menbe_76eac8", "Mənbə")}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) =>
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" />{tr("bulktimemanager_movcud_saat_filteri_ea28d2", "Mövcud saat filteri")}</Label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("bulktimemanager_hamisi_3ff72c", "Ham\u0131s\u0131 (")}{rows.length})</SelectItem>
                {uniqueTimes.map(([t, c]) =>
                <SelectItem key={t} value={t}>{t} ({c})</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Yeni saat (HH:MM)</Label>
            {source === 'flow_reminders' ?
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)} /> :

            <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALID_DAY_SLOT_TIMES.map((t) =>
                <SelectItem key={t} value={t}>{t}</SelectItem>
                )}
                </SelectContent>
              </Select>
            }
            {source !== 'flow_reminders' &&
            <p className="text-[10px] text-muted-foreground mt-1">
                {tr("bulktimemanager_yalniz_bu_saatlar_cron_terefinden_oxunur", "Yalnız bu saatlar cron tərəfindən oxunur — başqa saat seçilən sətirləri sükutla gizlədər.")}
              </p>
            }
          </div>

          <div className="flex items-end">
            <Button onClick={applyBulk} disabled={saving || selected.size === 0} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <ArrowRight className="rtl:rotate-180 h-4 w-4 me-1" />}
              {selected.size} {tr("bulktimemanager_setre_tetbiq_et_873f93", "s\u0259tr\u0259 t\u0259tbiq et")}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{tr("bulktimemanager_cemi_yuklenen_c5d1cb", "C\u0259mi y\xFCkl\u0259n\u0259n:")} {rows.length}</Badge>
          <Badge variant="outline">{tr("bulktimemanager_filterlenmis_fdc550", "Filterl\u0259nmi\u015F:")} {filtered.length}</Badge>
          <Badge variant="secondary">{tr("bulktimemanager_secilmis_3c154a", "Se\xE7ilmi\u015F:")} {selected.size}</Badge>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : null} {tr("bulktimemanager_yenile_570ce2", "Yenil\u0259")}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="p-2 text-start w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="p-2 text-start">Saat</th>
                {source !== 'flow_reminders' && <th className="p-2 text-start">{tr("bulktimemanager_gun_18b2f4", "Gün")}</th>}
                <th className="p-2 text-start">{tr("bulktimemanager_basliq_e1f6c5", "Başlıq")}</th>
                <th className="p-2 text-start">ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) =>
              <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-2">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </td>
                  <td className="p-2 font-mono">{r.send_time || '—'}</td>
                  {source !== 'flow_reminders' && <td className="p-2">{r.day_number ?? '—'}</td>}
                  <td className="p-2 truncate max-w-md">{r.title}</td>
                  <td className="p-2 font-mono text-muted-foreground truncate max-w-[180px]">{r.id}</td>
                </tr>
              )}
              {filtered.length === 0 &&
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tr("bulktimemanager_setir_yoxdur_08da0f", "Sətir yoxdur")}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

};

export default BulkTimeManager;